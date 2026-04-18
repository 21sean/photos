#!/usr/bin/env node

/**
 * Build web-optimized AVIFs from originals in R2 and upload to a separate folder.
 *
 * Goals:
 *  - AVIF output
 *  - <= 5MB per image
 *  - Preserve HDR color info (ICC/EXIF) where present
 *  - Upload to separate prefix (default: "web/")
 *
 * Usage:
 *   node scripts/optimize-web-images.js
 *   node scripts/optimize-web-images.js --dry-run
 *   node scripts/optimize-web-images.js --album lisbon
 *   node scripts/optimize-web-images.js --limit 50
 *   node scripts/optimize-web-images.js --dest-prefix web-optimized
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

// Check if avifenc CLI is available (for 10-bit support)
let avifencAvailable = null;
function checkAvifenc() {
  if (avifencAvailable !== null) return avifencAvailable;
  try {
    execSync('avifenc --version', { stdio: 'pipe' });
    avifencAvailable = true;
    console.log('Using avifenc CLI for 10-bit AVIF encoding\n');
  } catch {
    avifencAvailable = false;
  }
  return avifencAvailable;
}

// Load environment variables from .env files
function loadDotEnvIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
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

const R2_ENDPOINT = process.env.CF_URL?.replace(/\/+$/, '') || '';
const BUCKET_NAME = 'photos';
const TARGET_MAX_BYTES = 5 * 1024 * 1024; // 5MB limit
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif'];

function ensureR2Env() {
  const missing = [];
  if (!process.env.CF_URL) missing.push('CF_URL');
  if (!process.env.Access_Key_ID) missing.push('Access_Key_ID');
  if (!process.env.Secret_Access_Key) missing.push('Secret_Access_Key');

  if (missing.length) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}.\n` +
      'Add them to scripts/.env or .env in repo root.'
    );
  }

  if (!/^https?:\/\//i.test(R2_ENDPOINT)) {
    throw new Error(
      `CF_URL must be a full URL (e.g. https://<accountid>.r2.cloudflarestorage.com).\n` +
      `Current value: "${process.env.CF_URL || ''}"`
    );
  }
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.Access_Key_ID || '',
    secretAccessKey: process.env.Secret_Access_Key || '',
  },
});

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
    album: null,
    destPrefix: 'web',
    force: false,
  };

  const startIndex = argv[1]?.startsWith('-') ? 1 : 2;

  for (let i = startIndex; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--dryrun' || a === '--dry' || a === '-n') {
      args.dryRun = true;
    } else if (a.startsWith('--dry-run=')) {
      args.dryRun = a.split('=')[1] !== 'false';
    }
    else if (a === '--limit') args.limit = Number(argv[++i] || 0) || null;
    else if (a === '--album') args.album = argv[++i];
    else if (a === '--dest-prefix') args.destPrefix = argv[++i];
    else if (a === '--force' || a === '-f') args.force = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return args;
}

function detectDryRunFromNpmEnv(args) {
  if (args.dryRun) return args;
  if (process.env.DRY_RUN && /^(1|true|yes)$/i.test(process.env.DRY_RUN)) {
    args.dryRun = true;
    return args;
  }
  const raw = process.env.npm_config_argv;
  if (!raw) return args;
  try {
    const parsed = JSON.parse(raw);
    const original = parsed?.original || [];
    const joined = original.join(' ');
    if (/(--dry-run|--dryrun|--dry|-n)(=true)?\b/.test(joined)) {
      args.dryRun = true;
    }
  } catch {
    // ignore
  }
  return args;
}

function detectForceFromEnv(args) {
  if (args.force) return args;
  if (process.env.FORCE && /^(1|true|yes)$/i.test(process.env.FORCE)) {
    args.force = true;
  }
  return args;
}

function usageAndExit(code = 0) {
  console.log(`
Build web-optimized AVIFs in R2

Usage:
  node scripts/optimize-web-images.js [options]

Options:
  --dry-run              Preview actions without uploading
  --limit <n>            Process only first n images
  --album <name>         Process only one album
  --dest-prefix <name>   Destination folder prefix (default: "web")
  --force, -f            Overwrite existing optimized images
`);
  process.exit(code);
}

async function listAllObjects(prefix) {
  const objects = [];
  let continuationToken;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
        Prefix: prefix || undefined,
      })
    );

    if (response.Contents) {
      objects.push(...response.Contents);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

async function downloadToTemp(key) {
  const response = await r2Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));

  const tempPath = path.join(os.tmpdir(), 'r2-opt-' + Date.now() + '-' + path.basename(key));
  const chunks = [];

  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  fs.writeFileSync(tempPath, Buffer.concat(chunks));
  return tempPath;
}

async function objectExists(key) {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') return false;
    return false;
  }
}

async function uploadToR2(key, buffer, contentType) {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

function isLikelyHDR(metadata) {
  const depth = Number(metadata?.depth || 8);
  const space = String(metadata?.space || '').toLowerCase();
  return depth >= 10 || space.includes('p3') || space.includes('rec2020');
}

/**
 * Detect color space information from image metadata for proper CICP signaling
 * Returns CICP values: { primaries, transfer, matrix }
 * 
 * CICP (Coding-Independent Code Points) are CRITICAL for browsers to correctly
 * interpret color data. Without them, browsers may incorrectly render wide-gamut
 * or HDR content as blown-out/clipped.
 * 
 * Common CICP values:
 * - sRGB:        P=1,  T=13, M=0  (BT.709 primaries, sRGB transfer)
 * - Display-P3:  P=12, T=13, M=0  (P3 primaries, sRGB transfer)  
 * - Rec.2020:    P=9,  T=1,  M=9  (BT.2020 primaries, BT.709 transfer for SDR)
 * - Rec.2020 PQ: P=9,  T=16, M=9  (BT.2020 primaries, PQ transfer for HDR)
 * - Rec.2020 HLG:P=9,  T=18, M=9  (BT.2020 primaries, HLG transfer for HDR)
 * 
 * Matrix coefficients: 0=Identity (RGB), 1=BT.709, 9=BT.2020
 */
function detectColorSpaceCICP(metadata) {
  const space = String(metadata?.space || '').toLowerCase();
  const iccDescription = String(metadata?.icc?.description || '').toLowerCase();
  const depth = Number(metadata?.depth || 8);
  
  // Check ICC profile description for color space hints
  const hasP3 = space.includes('p3') || iccDescription.includes('p3') || iccDescription.includes('display p3');
  const hasRec2020 = space.includes('rec2020') || space.includes('2020') || iccDescription.includes('rec. 2020') || iccDescription.includes('bt.2020');
  const hasAdobeRGB = space.includes('adobe') || iccDescription.includes('adobe rgb');
  const hasPQ = iccDescription.includes('pq') || iccDescription.includes('perceptual quantizer') || iccDescription.includes('smpte st 2084');
  const hasHLG = iccDescription.includes('hlg') || iccDescription.includes('hybrid log');
  
  // For true HDR content with PQ or HLG transfer functions
  // Note: Most browsers can't properly display these yet, so we tone-map to SDR
  if (hasRec2020 && (hasPQ || hasHLG || depth >= 10)) {
    // Use Rec.2020 primaries with sRGB-like transfer for SDR compatibility
    // This preserves the wide gamut while ensuring browsers can display it
    return {
      primaries: 9,   // BT.2020
      transfer: 1,    // BT.709 (SDR-compatible transfer)
      matrix: 0,      // Identity (no YUV conversion needed for RGB output)
      isWideGamut: true,
      isHDR: true,
      description: 'Rec.2020 (tone-mapped to SDR)'
    };
  }
  
  // Display P3 - widely supported on modern Apple devices and many monitors
  if (hasP3) {
    return {
      primaries: 12,  // Display P3 (DCI-P3 with D65 white point)
      transfer: 13,   // sRGB transfer function
      matrix: 0,      // Identity
      isWideGamut: true,
      isHDR: false,
      description: 'Display P3'
    };
  }
  
  // Adobe RGB - convert to sRGB for web compatibility
  if (hasAdobeRGB) {
    return {
      primaries: 1,   // BT.709 (sRGB primaries)
      transfer: 13,   // sRGB transfer
      matrix: 0,      // Identity
      isWideGamut: false,
      isHDR: false,
      description: 'sRGB (from Adobe RGB)'
    };
  }
  
  // Default to sRGB - the web standard
  return {
    primaries: 1,   // BT.709 (sRGB primaries)
    transfer: 13,   // sRGB transfer function  
    matrix: 0,      // Identity (RGB, no YUV matrix needed)
    isWideGamut: false,
    isHDR: false,
    description: 'sRGB'
  };
}

let avifBitdepth10Supported = null;

function isBitdepthUnsupported(error) {
  const msg = String(error?.message || error);
  return msg.includes('bitdepth') && msg.includes('prebuilt');
}

/**
 * Encode AVIF using avifenc CLI (supports 10-bit)
 * 
 * IMPORTANT: This function now properly sets CICP values to ensure browsers
 * correctly interpret the color data. Missing CICP values cause browsers to
 * guess the color space, often resulting in blown-out/clipped images for
 * wide-gamut or HDR content.
 */
async function encodeAvifCli({
  inputPath,
  width,
  quality,
  bitdepth,
  chromaSubsampling,
  cicp,
}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avifenc-'));
  const pngPath = path.join(tempDir, 'input.png');
  const avifPath = path.join(tempDir, 'output.avif');

  try {
    // Use sharp to resize and convert to PNG (avifenc input)
    // IMPORTANT: We use toColorspace to ensure proper color handling
    let pipeline = sharp(inputPath, { limitInputPixels: false, sequentialRead: true });
    
    if (width) {
      pipeline = pipeline.resize({ width, withoutEnlargement: true });
    }
    
    // For wide gamut content, keep the color profile; for SDR, convert to sRGB
    // This helps ensure consistent rendering across browsers
    if (cicp && !cicp.isWideGamut) {
      pipeline = pipeline.toColorspace('srgb');
    }
    
    // Output as 16-bit PNG to preserve quality for 10-bit AVIF
    // keepMetadata preserves ICC profile which avifenc can read
    await pipeline.png({ compressionLevel: 0 }).toFile(pngPath);

    // Map quality (0-100) to avifenc quantizer (0-63, where 0=lossless, 63=worst)
    // quality 100 → q=0, quality 0 → q=63
    const quantizer = Math.round((100 - quality) * 0.63);
    
    // Map chromaSubsampling to avifenc yuv format
    const yuvFormat = chromaSubsampling === '4:4:4' ? '444' : '420';
    
    // Build avifenc arguments with CICP values for proper color interpretation
    const args = [
      '--depth', String(bitdepth),
      '--yuv', yuvFormat,
      '--min', String(quantizer),
      '--max', String(quantizer),
      '--speed', '4',  // Balance between speed and compression
      '-r', 'full',    // Full range (0-255) for better web compatibility
    ];
    
    // Add CICP values if provided - CRITICAL for correct color rendering
    // Without these, browsers may misinterpret wide-gamut/HDR as blown-out
    if (cicp) {
      args.push('--cicp', `${cicp.primaries}/${cicp.transfer}/${cicp.matrix}`);
    }
    
    // Add input and output paths
    args.push(pngPath, avifPath);
    
    const result = spawnSync('avifenc', args, { stdio: 'pipe' });
    
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() || '';
      throw new Error(`avifenc failed: ${stderr}`);
    }
    
    // Read the output AVIF
    const buffer = fs.readFileSync(avifPath);
    const size = buffer.length;
    
    return {
      result: { data: buffer, info: { size } },
      usedBitdepth: bitdepth,
      usedChroma: chromaSubsampling,
    };
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
      if (fs.existsSync(avifPath)) fs.unlinkSync(avifPath);
      fs.rmdirSync(tempDir);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Encode AVIF using sharp (only supports 8-bit on prebuilt binaries)
 * Note: sharp doesn't support explicit CICP setting, but preserving ICC profile
 * with withMetadata() helps browsers interpret color correctly.
 */
async function encodeAvifSharp({
  inputPath,
  width,
  quality,
  bitdepth,
  chromaSubsampling,
  keepMetadata,
  cicp,
}) {
  // If we already know bitdepth 10 isn't supported, fail immediately
  if (bitdepth === 10 && avifBitdepth10Supported === false) {
    throw new Error('Bitdepth 10 not supported by prebuilt binaries');
  }

  try {
    let pipeline = sharp(inputPath, { limitInputPixels: false, sequentialRead: true });

    if (width) {
      pipeline = pipeline.resize({ width, withoutEnlargement: true });
    }
    
    // For non-wide-gamut content, convert to sRGB for consistent web rendering
    if (cicp && !cicp.isWideGamut) {
      pipeline = pipeline.toColorspace('srgb');
    }

    pipeline = pipeline.avif({
      quality,
      effort: 9,
      chromaSubsampling,
      bitdepth,
    });

    if (keepMetadata) {
      // Preserve ICC/EXIF - this helps browsers interpret color correctly
      // even though sharp doesn't support explicit CICP setting
      pipeline = pipeline.withMetadata();
    }

    const result = await pipeline.toBuffer({ resolveWithObject: true });
    avifBitdepth10Supported = true;
    return { result, usedBitdepth: bitdepth, usedChroma: chromaSubsampling };
  } catch (error) {
    if (bitdepth === 10 && isBitdepthUnsupported(error)) {
      avifBitdepth10Supported = false;
      throw new Error('Bitdepth 10 not supported - skipping image');
    }
    throw error;
  }
}

/**
 * Encode AVIF - uses avifenc CLI if available, falls back to sharp
 */
async function encodeAvif(opts) {
  if (checkAvifenc()) {
    return encodeAvifCli(opts);
  }
  return encodeAvifSharp(opts);
}

async function buildOptimizedAvif(inputPath, targetBytes) {
  const metadata = await sharp(inputPath, { limitInputPixels: false }).metadata();
  const width = metadata.width || 0;
  const isHDR = isLikelyHDR(metadata);
  
  // Detect color space and get proper CICP values for browser compatibility
  const cicp = detectColorSpaceCICP(metadata);

  const bitdepth = 10;
  // Use 4:4:4 to avoid YUV matrix conversion issues that cause clipping on iOS Safari
  const chromaSubsampling = '4:4:4';
  const keepMetadata = Boolean(metadata.icc || metadata.exif);

  const qualitySteps = [85];
  const scaleSteps = [1, 0.92, 0.85, 0.78, 0.7, 0.62, 0.55];

  let best = null;

  for (const scale of scaleSteps) {
    const scaledWidth = Math.max(1, Math.floor(width * scale));

    for (const quality of qualitySteps) {
      const encoded = await encodeAvif({
        inputPath,
        width: scaledWidth,
        quality,
        bitdepth,
        chromaSubsampling,
        keepMetadata,
        cicp,
      });

      const size = encoded.result.info.size;
      const candidate = {
        buffer: encoded.result.data,
        size,
        width: scaledWidth,
        quality,
        isHDR,
        bitdepth: encoded.usedBitdepth,
        chromaSubsampling: encoded.usedChroma,
        colorSpace: cicp.description,
      };

      if (!best || size < best.size) best = candidate;

      if (size <= targetBytes) {
        return candidate;
      }
    }
  }

  return best;
}

function buildDestKey({ destPrefix, album, filename }) {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${destPrefix}/${album}/${base}.avif`;
}

async function main() {
  const args = detectForceFromEnv(detectDryRunFromNpmEnv(parseArgs(process.argv)));
  if (args.help) usageAndExit(0);
  ensureR2Env();

  const destPrefix = String(args.destPrefix || 'web').replace(/^\/+|\/+$/g, '');
  const albumFilter = args.album ? String(args.album).replace(/^\/+|\/+$/g, '') : null;

  console.log('📦 Web image optimization for R2\n');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Destination prefix: ${destPrefix}/`);
  if (albumFilter) console.log(`Album filter: ${albumFilter}`);
  if (args.limit) console.log(`Limit: ${args.limit}`);
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE UPLOAD'}`);
  console.log(`Target size: ${(TARGET_MAX_BYTES / 1024 / 1024).toFixed(1)} MB\n`);

  const prefix = albumFilter ? `${albumFilter}/` : undefined;
  const objects = await listAllObjects(prefix);
  const images = objects.filter((obj) => {
    const key = obj.Key || '';
    if (key.endsWith('/')) return false;
    if (key.startsWith(`${destPrefix}/`)) return false;
    const ext = path.extname(key).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  });

  const list = args.limit ? images.slice(0, args.limit) : images;
  console.log(`Found ${images.length} images (${list.length} to process)\n`);

  let processed = 0;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const obj of list) {
    const key = obj.Key;
    if (!key) continue;

    const parts = key.split('/');
    if (parts.length < 2) continue;
    const album = parts[0];
    const filename = parts.slice(1).join('/');

    const destKey = buildDestKey({ destPrefix, album, filename });

    process.stdout.write(`[${processed + 1}/${list.length}] ${album}/${filename}\n`);
    process.stdout.write(`   -> ${destKey}\n`);

    let tempPath = null;
    try {
      const exists = await objectExists(destKey);
      if (exists && !args.force) {
        process.stdout.write('   ⏭️  Skipped (already exists)\n\n');
        skipped++;
        continue;
      }
      if (exists && args.force) {
        process.stdout.write('   🔁 Overwriting existing file\n');
      }

      if (args.dryRun) {
        process.stdout.write('   🔍 Dry run (skip download/encode/upload)\n\n');
        continue;
      }

      tempPath = await downloadToTemp(key);
      const optimized = await buildOptimizedAvif(tempPath, TARGET_MAX_BYTES);

      if (!optimized || !optimized.buffer) {
        throw new Error('Failed to encode AVIF');
      }

      const sizeMb = (optimized.size / 1024 / 1024).toFixed(2);
      const colorInfo = optimized.colorSpace ? `, ${optimized.colorSpace}` : '';
      process.stdout.write(
        `   ✅ Encoded AVIF ${optimized.width}px @ q${optimized.quality}, ${optimized.bitdepth}bit, ${optimized.chromaSubsampling}${colorInfo} (${sizeMb} MB)\n`
      );

      await uploadToR2(destKey, optimized.buffer, 'image/avif');
      process.stdout.write('   ⬆️  Uploaded\n\n');
      uploaded++;
    } catch (error) {
      process.stdout.write(`   ❌ Failed: ${error.message}\n\n`);
      failed++;
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
      processed++;
    }
  }

  console.log('\nSummary:');
  console.log(`  ✅ Uploaded: ${uploaded}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📁 Total processed: ${processed}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
