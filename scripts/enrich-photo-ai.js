#!/usr/bin/env node

/**
 * Enrich a single photo in src/lib/photos.json with:
 *  - aiDescriptionHtml: a Wikipedia-style 1–2 sentence overview with <a> links
 *  - gps: guessed location coordinates (if missing)
 *
 * IMPORTANT:
 *  - Requires OPENAI_API_KEY in your environment.
 *  - Only updates ONE photo per run (to validate output quality before batch runs).
 *
 * Usage:
 *   node scripts/enrich-photo-ai.js --album mexico --filename IMG_4648.jpeg
 *   node scripts/enrich-photo-ai.js --album mexico --filename IMG_4648.jpeg --dry-run
 *
 * Optional (recommended if you have it):
 *   --image-url https://images.sean.ventures/mexico/IMG_4648.jpeg
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { z } = require('zod');

// Load OPENAI_API_KEY from local env files (kept out of git).
// Supports:
//   - scripts/.env (local to scripts)
//   - .env         (repo root)
function loadDotEnvIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');

  let lastKey = null;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    // Support accidental line-wrapping of long values (like API keys):
    // if a line doesn't contain KEY=..., treat it as continuation of the previous key.
    if (eq <= 0) {
      if (lastKey && process.env[lastKey] != null) {
        process.env[lastKey] = String(process.env[lastKey]) + trimmed;
      }
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    lastKey = key;

    let val = trimmed.slice(eq + 1).trim();
    // Strip optional surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (process.env[key] == null) process.env[key] = val;
  }
}

loadDotEnvIfPresent(path.join(__dirname, '.env'));
loadDotEnvIfPresent(path.join(__dirname, '..', '.env'));

const OUTPUT_FILE = path.join(__dirname, '../src/lib/photos.json');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    album: null,
    filename: null,
    imageUrl: null,
    all: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--all') args.all = true;
    else if (a === '--album') args.album = argv[++i];
    else if (a === '--filename') args.filename = argv[++i];
    else if (a === '--image-url') args.imageUrl = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return args;
}

function usageAndExit(code = 0) {
  console.log(`\nEnrich one photo with AI description + guessed GPS\n\nUsage:\n  node scripts/enrich-photo-ai.js --album <album> --filename <filename> [--image-url <url>] [--dry-run]\n`);
  process.exit(code);
}

function joinUrl(base, segment) {
  if (!base) return null;
  return String(base).replace(/\/+$/, '') + '/' + String(segment).replace(/^\/+/, '');
}

async function enrichOne({ photosByAlbum, album, filename, imageUrl, dryRun }) {
  const albumPhotos = photosByAlbum[album];
  if (!Array.isArray(albumPhotos)) {
    throw new Error(`Album not found: ${album}`);
  }

  const idx = albumPhotos.findIndex((p) => p && p.filename === filename);
  if (idx < 0) {
    throw new Error(`Photo not found in album '${album}': ${filename}`);
  }

  const existing = albumPhotos[idx];

  console.log(`Enriching: ${album}/${filename}`);
  if (imageUrl) console.log(`Using image URL: ${imageUrl}`);

  const ai = await callOpenAI({ imageUrl, filename, album });

  const next = { ...existing };
  next.aiDescriptionHtml = sanitizeSingleLine(ai.descriptionHtml);
  next.fun_fact = sanitizeSingleLine(ai.fun_fact);

  // Only add gps if missing in the source data and AI gave us something.
  if (!next.gps && ai.gps) {
    next.gps = {
      lat: ai.gps.lat,
      lng: ai.gps.lng,
      ...(ai.gps.altitude != null ? { altitude: ai.gps.altitude } : {}),
    };
  }

  next.aiLocationGuess = {
    name: ai.locationName ?? null,
    confidence: ai.confidence ?? null,
    reasoningShort: ai.reasoningShort ? sanitizeSingleLine(ai.reasoningShort) : null,
    generatedAt: new Date().toISOString(),
    model: 'gpt-4.1-mini',
  };

  albumPhotos[idx] = next;

  if (dryRun) {
    console.log(JSON.stringify({ album, filename, updatedFields: {
      aiDescriptionHtml: next.aiDescriptionHtml,
      fun_fact: next.fun_fact,
      gpsAdded: Boolean(!existing.gps && next.gps),
    } }, null, 2));
  }

  return next;
}

const AiResponseSchema = z.object({
  descriptionHtml: z
    .string()
    .min(1)
    .describe('Wikipedia-style 1–2 sentence overview with <a href="..."> links; no markdown.'),
  fun_fact: z
    .string()
    .min(1)
    .max(240)
    .describe(
      'A single fun fact sentence related to the place/subject (no meta phrasing, no markdown); may include HTML links.'
    ),
  gps: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      altitude: z.number().nullable().optional(),
    })
    .nullable()
    .describe('Best guess; null if you cannot provide a reasonable guess.'),
  locationName: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  reasoningShort: z
    .string()
    .max(240)
    .nullable()
    .optional()
    .describe('Very short explanation of the guess; will be stored for debugging.'),
});

function sanitizeSingleLine(s) {
  if (typeof s !== 'string') return s;
  // Replace newlines/CR with spaces, collapse whitespace, trim.
  return s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function downloadUrlToFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function makeJpegThumbnailMac({ inputPath, maxDimension = 1600, quality = 70 }) {
  // Creates a JPEG thumbnail next to the temp file.
  const outPath = inputPath.replace(/\.[^.]+$/, '') + `.thumb-${maxDimension}.jpg`;

  // Convert to JPEG, resize, and compress.
  // sips is available by default on macOS.
  execFileSync('sips', ['-s', 'format', 'jpeg', inputPath, '--out', outPath], {
    stdio: 'pipe',
  });
  execFileSync('sips', ['-Z', String(maxDimension), outPath], { stdio: 'pipe' });
  execFileSync('sips', ['-s', 'formatOptions', String(quality), outPath], { stdio: 'pipe' });

  const size = fs.statSync(outPath).size;
  return { outPath, size };
}

function makeJpegThumbnailUnderBytesMac({
  inputPath,
  targetBytes = 1 * 1024 * 1024,
}) {
  // Heuristic loop: reduce max dimension and quality until we're under targetBytes.
  // This keeps token/cost down for vision.
  const candidates = [
    { maxDimension: 1600, quality: 65 },
    { maxDimension: 1400, quality: 60 },
    { maxDimension: 1200, quality: 55 },
    { maxDimension: 1000, quality: 50 },
    { maxDimension: 900, quality: 45 },
    { maxDimension: 800, quality: 40 },
  ];

  let last = null;
  for (const c of candidates) {
    last = makeJpegThumbnailMac({
      inputPath,
      maxDimension: c.maxDimension,
      quality: c.quality,
    });
    if (last.size <= targetBytes) return last;
  }

  // If still larger than target, keep the smallest attempt.
  return last;
}

function fileToDataUrl(filePath, mime) {
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

async function callOpenAI({ imageUrl, filename, album }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY in environment.');
  }

  // If the remote image is large or in a format OpenAI can't fetch reliably (e.g. AVIF),
  // download it locally, create a small JPEG thumbnail, and send as inline base64.
  let inputImage = null;
  let tempDir = null;
  if (imageUrl) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-ai-'));
    const ext = (() => {
      try {
        const u = new URL(imageUrl);
        return path.extname(u.pathname) || '.img';
      } catch {
        return '.img';
      }
    })();

    const downloadedPath = path.join(tempDir, `input${ext}`);
    await downloadUrlToFile(imageUrl, downloadedPath);

    // Target ~1MB JPEG to reduce vision token/cost.
    const { outPath } = makeJpegThumbnailUnderBytesMac({
      inputPath: downloadedPath,
      targetBytes: 1 * 1024 * 1024,
    });

    inputImage = fileToDataUrl(outPath, 'image/jpeg');
  }

  // Use the Responses API (no extra deps).
  // Note: if you omit imageUrl, the model will rely only on filename/album.
  const inputText = [
    `You are generating metadata for a personal photo archive.`,
    `Return STRICT JSON only that matches the schema described below.`,
    `\nRules:`,
    `- Output MUST be valid JSON (no trailing commas, no comments).`,
  `- descriptionHtml: 1–2 sentences max, Wikipedia-like tone, include hyperlinks as HTML <a href="...">text</a> where appropriate.`,
  `- Write like a polished caption: avoid bland openers like "This image shows..." or "This photo shows...". Just describe the scene directly.`,
  `- If visible, mention atmosphere like weather/light (e.g. "on a cloudy day").`,
  `- fun_fact: put one natural fun fact as a single sentence here (no meta phrasing like "here's a fact" / "a memorable fact is").`,
    `- descriptionHtml MUST be a single line (no \n or \r). Do not wrap URLs across lines.`,
    `- Do NOT use markdown.`,
    `- If you can identify the location, provide gps lat/lng and (optional) altitude in meters; otherwise gps=null.`,
    `- If gps is provided, locationName should be a best-guess place name (e.g. "Chichén Itzá").`,
    `- Confidence: 0..1 (null if unknown).`,
    `\nSchema (JSON shape):`,
    `- descriptionHtml: string`,
  `- fun_fact: string`,
    `- gps: { lat: number, lng: number, altitude?: number|null } | null`,
    `- locationName?: string | null`,
    `- confidence?: number | null`,
    `- reasoningShort?: string | null`,
    `\nContext: album=${album}, filename=${filename}.`,
    imageUrl
      ? `Image URL (downloaded locally + thumbnailed before sending): ${imageUrl}`
      : `No image URL provided; infer only from the context and filename.`,
  ].join('\n');

  const body = {
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: inputImage
          ? [
              { type: 'input_text', text: inputText },
              { type: 'input_image', image_url: inputImage },
            ]
          : [{ type: 'input_text', text: inputText }],
      },
    ],
    // Force JSON output
    text: { format: { type: 'json_object' } },
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Cleanup temp files
  if (tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // Responses API payloads differ by SDK/version. Prefer output_text if present,
  // otherwise extract from output[].content[].
  let outputText = typeof data.output_text === 'string' ? data.output_text : '';
  if (!outputText && Array.isArray(data.output)) {
    const chunks = [];
    for (const out of data.output) {
      if (!out || !Array.isArray(out.content)) continue;
      for (const c of out.content) {
        if (!c) continue;
        // Common shapes include { type: 'output_text', text: '...' }
        // and sometimes { type: 'message', content: [...] } depending on API.
        if (typeof c.text === 'string') chunks.push(c.text);
        else if (typeof c.content === 'string') chunks.push(c.content);
      }
    }
    outputText = chunks.join('').trim();
  }

  if (typeof outputText !== 'string' || !outputText.trim()) {
    throw new Error(
      'OpenAI response did not include extractable text (missing output_text/output.content text).'
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (e) {
    throw new Error(`Failed to JSON.parse model output_text: ${outputText}`);
  }

  return AiResponseSchema.parse(parsed);
}

function loadPhotosJson() {
  const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
  return JSON.parse(raw);
}

function savePhotosJson(obj) {
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(OUTPUT_FILE, json);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) usageAndExit(0);
  if (!args.album) usageAndExit(1);
  if (!args.all && !args.filename) usageAndExit(1);

  const photosByAlbum = loadPhotosJson();

  if (args.all) {
    const albumPhotos = photosByAlbum[args.album];
    if (!Array.isArray(albumPhotos)) {
      throw new Error(`Album not found: ${args.album}`);
    }

    console.log(`Enriching ALL photos in album: ${args.album}`);
    if (args.imageUrl) console.log(`Using image URL base: ${args.imageUrl}`);
    if (args.dryRun) console.log('Mode: DRY RUN (no file will be written)');

    for (const p of albumPhotos) {
      if (!p || !p.filename) continue;
      await enrichOne({
        photosByAlbum,
        album: args.album,
        filename: p.filename,
        imageUrl: args.imageUrl ? joinUrl(args.imageUrl, p.filename) : null,
        dryRun: args.dryRun,
      });
    }

    if (!args.dryRun) {
      savePhotosJson(photosByAlbum);
      console.log(`\nUpdated ${OUTPUT_FILE}`);
    }
    return;
  }

  if (args.dryRun) console.log('Mode: DRY RUN (no file will be written)');
  await enrichOne({
    photosByAlbum,
    album: args.album,
    filename: args.filename,
    imageUrl: args.imageUrl,
    dryRun: args.dryRun,
  });
  if (!args.dryRun) {
    savePhotosJson(photosByAlbum);
    console.log(`\nUpdated ${OUTPUT_FILE}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
