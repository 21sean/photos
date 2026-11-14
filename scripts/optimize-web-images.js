#!/usr/bin/env node

/**
 * Build web-optimized AVIFs from originals in R2 and upload to a separate folder.
 *
 * For every original "{album}/{name}.{ext}" this produces:
 *  - a "web master":       {prefix}/{album}/{name}.avif
 *      full resolution, only scaled down as far as needed to stay <= 5MB
 *  - responsive variants:  {prefix}/{album}/{name}-{W}w.avif
 *      one per W in VARIANT_WIDTHS that is smaller than the original's pixel
 *      width (never upscaled). Variants go through exactly the same encode
 *      path as the master (bit depth, chroma, CICP/ICC handling, avifenc-vs-
 *      sharp selection) so the colors match; only width and quality differ.
 *
 * Goals:
 *  - AVIF output
 *  - <= 5MB per master
 *  - Preserve HDR color info (ICC/EXIF) where present
 *  - Upload to separate prefix (default: "web/")
 *  - Incremental: every expected object is HEAD-checked and only the missing
 *    ones are encoded/uploaded. A photo whose master exists but whose variants
 *    do not gets only its variants; the master is left untouched. The original
 *    is not downloaded when nothing is missing for a photo.
 *
 * How the original's pixel width is known without downloading it:
 *  1. every object this script uploads carries "source-width"/"source-height"
 *     user metadata, which the HEAD request returns;
 *  2. otherwise the first 512KB of the original are fetched (ranged GET) and
 *     the image header is parsed;
 *  3. otherwise (and always before encoding) from the downloaded original.
 *
 * NOTE: run this with the same encoder that produced the existing masters
 * (avifenc CLI inside the Docker image vs. sharp), otherwise masters and
 * variants are signalled differently. The Docker image's default command
 * passes --force; to only backfill what is missing, override the command:
 *   docker run --rm -v ${PWD}/scripts/.env:/app/scripts/.env photos-optimizer \
 *     node scripts/optimize-web-images.js
 *
 * Usage:
 *   node scripts/optimize-web-images.js
 *   node scripts/optimize-web-images.js --dry-run
 *   node scripts/optimize-web-images.js --album lisbon
 *   node scripts/optimize-web-images.js --limit 50
 *   node scripts/optimize-web-images.js --dest-prefix web-optimized
 *   node scripts/optimize-web-images.js --no-variants
 *   node scripts/optimize-web-images.js --variant-quality 75
 *   node scripts/optimize-web-images.js --force
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

// Called from main() only, so that requiring this file (e.g. from a test) has
// no side effects and needs no env vars.
function loadEnv() {
  loadDotEnvIfPresent(path.join(__dirname, '.env'));
  loadDotEnvIfPresent(path.join(__dirname, '..', '.env'));
}

function getR2Endpoint() {
  return process.env.CF_URL?.replace(/\/+$/, '') || '';
}

const BUCKET_NAME = 'photos';
const TARGET_MAX_BYTES = 5 * 1024 * 1024; // 5MB limit (web master only)
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif'];

// Responsive variants live at {prefix}/{album}/{base}-{W}w.avif.
// scripts/sync-photos.js reports the widths that exist per photo in the
// `variants` field of photos.json, which is what the frontend reads.
const VARIANT_WIDTHS = [800, 1280, 1920, 2880];
const DEFAULT_VARIANT_QUALITY = 80;

const AVIF_CONTENT_TYPE = 'image/avif';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// User metadata stamped on every object this script uploads (master and
// variants) so that a later run learns the original's pixel size from the
// HEAD request alone, without downloading the original.
const META_SOURCE_WIDTH = 'source-width';
const META_SOURCE_HEIGHT = 'source-height';

// How much of an original to fetch when only its header is needed.
const PROBE_BYTES = 512 * 1024;

function ensureR2Env() {
  const R2_ENDPOINT = getR2Endpoint();
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

// Created on first use (after loadEnv() has run), never at require time.
let r2ClientInstance = null;
function getR2Client() {
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: 'auto',
      endpoint: getR2Endpoint(),
      credentials: {
        accessKeyId: process.env.Access_Key_ID || '',
        secretAccessKey: process.env.Secret_Access_Key || '',
      },
    });
  }
  return r2ClientInstance;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
    album: null,
    destPrefix: 'web',
    force: false,
    variants: true,
    variantQuality: DEFAULT_VARIANT_QUALITY,
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
    else if (a === '--no-variants') args.variants = false;
    else if (a === '--variant-quality') args.variantQuality = parseVariantQuality(argv[++i]);
    else if (a.startsWith('--variant-quality=')) {
      args.variantQuality = parseVariantQuality(a.slice(a.indexOf('=') + 1));
    }
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return args;
}

function parseVariantQuality(raw) {
  const n = Number(raw);
  if (raw == null || String(raw).trim() === '' || !Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error(`--variant-quality expects an integer between 1 and 100 (got "${raw}")`);
  }
  return n;
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

For each original {album}/{name}.{ext} this uploads
  {prefix}/{album}/{name}.avif        web master (full size, <= 5MB)
  {prefix}/{album}/{name}-{W}w.avif   variants, W in ${VARIANT_WIDTHS.join(', ')}
                                      (only widths smaller than the original)
Only objects that are missing are encoded and uploaded. An existing master is
left untouched when just its variants are missing.

Options:
  --dry-run              Preview which keys would be created, upload nothing
  --limit <n>            Process only first n images
  --album <name>         Process only one album
  --dest-prefix <name>   Destination folder prefix (default: "web")
  --force, -f            Re-encode and overwrite masters and variants
  --no-variants          Only build the web master, skip the width variants
  --variant-quality <n>  AVIF quality for the variants, 1-100 (default: ${DEFAULT_VARIANT_QUALITY})
  --help, -h             Show this help

Use the same encoder (avifenc CLI in the Docker image, or sharp) that built
the existing masters so that masters and variants are signalled identically.
`);
  process.exit(code);
}

async function listAllObjects(prefix) {
  const objects = [];
  let continuationToken;

  do {
    const response = await getR2Client().send(
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
  const response = await getR2Client().send(new GetObjectCommand({
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

function isNotFoundError(error) {
  return (
    error?.name === 'NotFound' ||
    error?.name === 'NoSuchKey' ||
    error?.$metadata?.httpStatusCode === 404
  );
}

/**
 * HEAD an object.
 * Returns null when it does not exist, otherwise { key, size, metadata }
 * (metadata = user metadata, keys lower-cased by S3/R2).
 *
 * Any other error (auth, network, throttling) is re-thrown: treating it as
 * "missing" would make a transient failure re-encode and overwrite objects
 * that are in fact there.
 */
async function headObject(key) {
  try {
    const response = await getR2Client().send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
    return {
      key,
      size: response.ContentLength,
      metadata: response.Metadata || {},
    };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw new Error(`HEAD ${key} failed: ${error?.name || 'Error'}: ${error?.message || error}`);
  }
}

/**
 * Read the original's pixel width from its header only: fetch the first
 * PROBE_BYTES with a ranged GET and let sharp parse the (truncated) file.
 * Returns null when that does not work (the caller then falls back to
 * downloading the whole original, or reports the width as unknown in a dry run).
 */
async function probeSourceWidth(key) {
  try {
    const response = await getR2Client().send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: `bytes=0-${PROBE_BYTES - 1}`,
    }));

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    const metadata = await sharp(Buffer.concat(chunks), { limitInputPixels: false }).metadata();
    return metadata.width > 0 ? metadata.width : null;
  } catch {
    return null;
  }
}

async function uploadToR2(key, buffer, contentType, metadata) {
  await getR2Client().send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL,
    ...(metadata ? { Metadata: metadata } : {}),
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

/**
 * Inspect a local source image once and derive the encode settings that the
 * master and every variant share, so that all of them are encoded (and
 * color-signalled) identically.
 */
async function describeSource(inputPath) {
  const metadata = await sharp(inputPath, { limitInputPixels: false }).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const isHDR = isLikelyHDR(metadata);

  // Detect color space and get proper CICP values for browser compatibility
  const cicp = detectColorSpaceCICP(metadata);

  const bitdepth = 10;
  // Use 4:4:4 to avoid YUV matrix conversion issues that cause clipping on iOS Safari
  const chromaSubsampling = '4:4:4';
  const keepMetadata = Boolean(metadata.icc || metadata.exif);

  return { width, height, isHDR, cicp, bitdepth, chromaSubsampling, keepMetadata };
}

async function buildOptimizedAvif(inputPath, targetBytes, source = null) {
  const { width, isHDR, cicp, bitdepth, chromaSubsampling, keepMetadata } =
    source || (await describeSource(inputPath));

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

/**
 * Encode one width variant. It goes through the same encodeAvif() path as the
 * master (avifenc CLI when available, sharp otherwise) with the very same
 * settings from describeSource(); only `width` and `quality` differ.
 */
async function buildVariantAvif(inputPath, width, { quality = DEFAULT_VARIANT_QUALITY, source = null } = {}) {
  const src = source || (await describeSource(inputPath));

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Invalid variant width: ${width}`);
  }
  if (width >= src.width) {
    throw new Error(`Variant ${width}w would upscale a ${src.width}px wide source`);
  }

  const encoded = await encodeAvif({
    inputPath,
    width,
    quality,
    bitdepth: src.bitdepth,
    chromaSubsampling: src.chromaSubsampling,
    keepMetadata: src.keepMetadata,
    cicp: src.cicp,
  });

  return {
    buffer: encoded.result.data,
    size: encoded.result.info.size,
    width,
    quality,
    isHDR: src.isHDR,
    bitdepth: encoded.usedBitdepth,
    chromaSubsampling: encoded.usedChroma,
    colorSpace: src.cicp.description,
  };
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O) - exported for tests
// ---------------------------------------------------------------------------

function stripExtension(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

/** "album/dir/file.jpg" -> { album: "album", filename: "dir/file.jpg" }, or null for top-level keys. */
function splitObjectKey(key) {
  if (!key) return null;
  const parts = key.split('/');
  if (parts.length < 2) return null;
  return { album: parts[0], filename: parts.slice(1).join('/') };
}

function buildDestKey({ destPrefix, album, filename }) {
  const base = stripExtension(filename);
  return `${destPrefix}/${album}/${base}.avif`;
}

/**
 * Key of the W pixel wide variant: {prefix}/{album}/{base}-{W}w.avif
 * ({base} = original filename without its extension, same rule as the master).
 */
function buildVariantKey({ destPrefix, album, filename, width }) {
  const base = stripExtension(filename);
  return `${destPrefix}/${album}/${base}-${width}w.avif`;
}

/** Unique positive integer widths, ascending. */
function normalizeWidths(widths) {
  const valid = (widths || []).map(Number).filter((w) => Number.isInteger(w) && w > 0);
  return [...new Set(valid)].sort((a, b) => a - b);
}

/**
 * Which variant widths apply to a source that is `sourceWidth` pixels wide.
 * Never upscale: a width is only used when it is strictly smaller than the
 * source (so W >= source width is skipped). Unknown/invalid width -> none.
 */
function selectVariantWidths(sourceWidth, widths = VARIANT_WIDTHS) {
  const w = Number(sourceWidth);
  if (!Number.isFinite(w) || w <= 0) return [];
  return normalizeWidths(widths).filter((v) => v < w);
}

/**
 * The original's pixel width as recorded in the user metadata of objects that
 * were uploaded earlier (see META_SOURCE_WIDTH), or null when unknown.
 * `heads` are headObject() results (null = object does not exist).
 */
function sourceWidthFromHeads(heads) {
  for (const head of heads || []) {
    const raw = head?.metadata?.[META_SOURCE_WIDTH];
    const w = Number(raw);
    if (raw != null && Number.isInteger(w) && w > 0) return w;
  }
  return null;
}

/**
 * Decide what has to be produced for one photo.
 *
 * With a known `sourceWidth` the result is exact. Without it (`widthKnown`
 * false) `encodeVariants` is an upper bound: every configured width that does
 * not exist yet, some of which may turn out not to apply once the width of
 * the original is known.
 *
 *  - encodeMaster:    (re)build the master
 *  - encodeVariants:  variant widths to (re)build
 *  - skipVariants:    variant widths that exist and are kept
 *  - notApplicable:   configured widths that would upscale (only when widthKnown)
 *  - needsSource:     whether the original is needed at all
 */
function planPhotoWork({
  masterExists,
  existingVariantWidths = [],
  sourceWidth = null,
  variantWidths = VARIANT_WIDTHS,
  includeVariants = true,
  force = false,
}) {
  const widthKnown = Number.isFinite(sourceWidth) && sourceWidth > 0;
  const configured = includeVariants ? normalizeWidths(variantWidths) : [];
  const applicable = widthKnown ? selectVariantWidths(sourceWidth, configured) : configured;
  const existing = new Set(existingVariantWidths);

  const encodeMaster = Boolean(force) || !masterExists;
  const encodeVariants = force ? applicable : applicable.filter((w) => !existing.has(w));
  const skipVariants = force ? [] : applicable.filter((w) => existing.has(w));
  const notApplicable = widthKnown ? configured.filter((w) => !applicable.includes(w)) : [];

  return {
    widthKnown,
    encodeMaster,
    encodeVariants,
    skipVariants,
    notApplicable,
    needsSource: encodeMaster || encodeVariants.length > 0,
  };
}

function formatWidths(widths) {
  return widths.map((w) => `${w}w`).join(', ');
}

function createStats() {
  return {
    photosFailed: 0,
    downloaded: 0,
    master: { created: 0, skipped: 0, failed: 0 },
    variants: { created: 0, skipped: 0, failed: 0, notApplicable: 0, collisions: 0, uncertain: 0 },
  };
}

/** Add one processPhoto() result to the run totals. */
function tallyResult(stats, result) {
  if (result.error) stats.photosFailed++;
  if (result.downloaded) stats.downloaded++;

  if (result.master === 'created' || result.master === 'would-create') stats.master.created++;
  else if (result.master === 'skipped') stats.master.skipped++;
  else if (result.master === 'failed') stats.master.failed++;

  const v = result.variants;
  stats.variants.created += v.created.length + v.wouldCreate.length;
  stats.variants.skipped += v.skipped.length;
  stats.variants.failed += v.failed.length;
  stats.variants.notApplicable += v.notApplicable.length;
  stats.variants.collisions += v.collisions.length;
  if (v.wouldCreate.length && !result.sourceWidth) stats.variants.uncertain += v.wouldCreate.length;
  return stats;
}

// ---------------------------------------------------------------------------
// Per-photo orchestration
// ---------------------------------------------------------------------------

function defaultLog(line) {
  process.stdout.write(line + '\n');
}

const defaultDeps = {
  head: headObject,             // (key) -> null | { metadata }
  probe: probeSourceWidth,      // (originalKey) -> width | null   (header only)
  download: downloadToTemp,     // (originalKey) -> temp file path
  describe: describeSource,     // (path) -> { width, height, cicp, ... }
  buildMaster: buildOptimizedAvif,
  buildVariant: buildVariantAvif,
  upload: uploadToR2,           // (key, buffer, contentType, metadata)
};

/**
 * Bring one photo up to date: HEAD the master and every candidate variant,
 * then encode and upload only what is missing (everything with `force`).
 * The original is downloaded only when something has to be encoded.
 *
 * All I/O goes through `deps` (defaults: the real R2/sharp functions) so the
 * decision logic can be exercised with stubs. Returns what happened; it does
 * not throw (a HEAD/download failure is reported in `result.error`).
 */
async function processPhoto(photo, options = {}, deps = {}) {
  const { key, album, filename } = photo;
  const {
    destPrefix = 'web',
    force = false,
    dryRun = false,
    includeVariants = true,
    variantWidths = VARIANT_WIDTHS,
    variantQuality = DEFAULT_VARIANT_QUALITY,
    reservedKeys = null,
    log = defaultLog,
  } = options;
  const io = { ...defaultDeps, ...deps };

  const masterKey = buildDestKey({ destPrefix, album, filename });
  const variantKey = (width) => buildVariantKey({ destPrefix, album, filename, width });

  const result = {
    key,
    masterKey,
    master: null, // 'created' | 'would-create' | 'skipped' | 'failed'
    variants: { created: [], wouldCreate: [], skipped: [], failed: [], notApplicable: [], collisions: [] },
    sourceWidth: null,
    widthSource: null, // 'metadata' | 'probe' | 'download'
    downloaded: false,
    error: null,
  };

  // A variant key that is also the master key of another original (e.g.
  // "a-800w.jpg" next to "a.jpg" -> both want ".../a-800w.avif") is never written.
  const candidateWidths = [];
  for (const width of includeVariants ? normalizeWidths(variantWidths) : []) {
    if (reservedKeys && reservedKeys.has(variantKey(width))) {
      result.variants.collisions.push(width);
      log(`   ⚠️  Variant ${width}w not built: ${variantKey(width)} is the master of another photo`);
    } else {
      candidateWidths.push(width);
    }
  }

  // 1) What is there already?
  let masterHead;
  let variantHeads;
  try {
    [masterHead, ...variantHeads] = await Promise.all([
      io.head(masterKey),
      ...candidateWidths.map((width) => io.head(variantKey(width))),
    ]);
  } catch (error) {
    result.error = error.message;
    log(`   ❌ Failed: ${error.message}`);
    return result;
  }

  const masterExists = Boolean(masterHead);
  const existingVariantWidths = candidateWidths.filter((_, i) => variantHeads[i]);
  const planFor = (sourceWidth) => planPhotoWork({
    masterExists,
    existingVariantWidths,
    sourceWidth,
    variantWidths: candidateWidths,
    includeVariants,
    force,
  });

  // 2) How wide is the original? First try the metadata of what was uploaded before.
  result.sourceWidth = sourceWidthFromHeads([masterHead, ...variantHeads]);
  if (result.sourceWidth) result.widthSource = 'metadata';
  let plan = planFor(result.sourceWidth);

  // Still unknown and it matters (some variant may or may not apply): read the
  // header of the original. Not needed when the original is downloaded anyway.
  if (!plan.widthKnown && plan.encodeVariants.length > 0 && (dryRun || !plan.encodeMaster)) {
    const probed = await io.probe(key);
    if (probed) {
      result.sourceWidth = probed;
      result.widthSource = 'probe';
      plan = planFor(probed);
    }
  }

  const describeSkips = () => {
    const notes = [];
    if (plan.skipVariants.length) notes.push(`variants ${formatWidths(plan.skipVariants)} exist`);
    if (plan.notApplicable.length) {
      notes.push(`${formatWidths(plan.notApplicable)} not applicable (source is ${result.sourceWidth}px wide)`);
    }
    return notes;
  };

  // 3) Nothing missing: no download at all.
  if (!plan.needsSource) {
    result.master = 'skipped';
    result.variants.skipped = plan.skipVariants;
    result.variants.notApplicable = plan.notApplicable;
    const notes = describeSkips();
    log(`   ⏭️  Skipped (already exists${notes.length ? '; ' + notes.join('; ') : ''})`);
    return result;
  }

  if (dryRun) {
    result.master = plan.encodeMaster ? 'would-create' : 'skipped';
    result.variants.wouldCreate = plan.encodeVariants;
    result.variants.skipped = plan.skipVariants;
    result.variants.notApplicable = plan.notApplicable;

    if (plan.encodeMaster) {
      log(`   🔍 Would ${masterExists ? 'overwrite' : 'create'} master:  ${masterKey}`);
    } else {
      log('   ⏭️  Master exists (kept as is)');
    }
    for (const width of plan.encodeVariants) {
      const existsNow = existingVariantWidths.includes(width);
      const caveat = plan.widthKnown ? '' : `  (only if the source is wider than ${width}px)`;
      log(`   🔍 Would ${existsNow ? 'overwrite' : 'create'} variant: ${variantKey(width)}${caveat}`);
    }
    for (const note of describeSkips()) log(`   ⏭️  ${note}`);
    if (!plan.widthKnown && plan.encodeVariants.length) {
      log('   ℹ️  Source width unknown (header probe failed); listed variants are an upper bound');
    }
    log('   🔍 Dry run (skip download/encode/upload)');
    return result;
  }

  // 4) Something is missing: download the original once and encode from it.
  let tempPath = null;
  try {
    let source;
    try {
      tempPath = await io.download(key);
      result.downloaded = true;
      source = await io.describe(tempPath);
      if (!(source.width > 0)) throw new Error('Could not read the dimensions of the original');
    } catch (error) {
      result.error = error.message;
      log(`   ❌ Failed: ${error.message}`);
      return result;
    }

    // The downloaded file is authoritative for the width.
    result.sourceWidth = source.width;
    result.widthSource = 'download';
    plan = planFor(source.width);
    result.variants.skipped = plan.skipVariants;
    result.variants.notApplicable = plan.notApplicable;

    const sourceMetadata = {
      [META_SOURCE_WIDTH]: String(source.width),
      [META_SOURCE_HEIGHT]: String(source.height || 0),
    };

    if (plan.encodeMaster) {
      if (masterExists) log('   🔁 Overwriting existing file');
      try {
        const optimized = await io.buildMaster(tempPath, TARGET_MAX_BYTES, source);

        if (!optimized || !optimized.buffer) {
          throw new Error('Failed to encode AVIF');
        }

        const sizeMb = (optimized.size / 1024 / 1024).toFixed(2);
        const colorInfo = optimized.colorSpace ? `, ${optimized.colorSpace}` : '';
        log(
          `   ✅ Encoded AVIF ${optimized.width}px @ q${optimized.quality}, ${optimized.bitdepth}bit, ${optimized.chromaSubsampling}${colorInfo} (${sizeMb} MB)`
        );

        await io.upload(masterKey, optimized.buffer, AVIF_CONTENT_TYPE, sourceMetadata);
        log('   ⬆️  Uploaded');
        result.master = 'created';
      } catch (error) {
        log(`   ❌ Master failed: ${error.message}`);
        result.master = 'failed';
      }
    } else {
      result.master = 'skipped';
      log('   ⏭️  Master exists (kept as is)');
    }

    for (const note of describeSkips()) log(`   ⏭️  ${note}`);

    for (const width of plan.encodeVariants) {
      const destKey = variantKey(width);
      try {
        const variant = await io.buildVariant(tempPath, width, { quality: variantQuality, source });

        if (!variant || !variant.buffer) {
          throw new Error('Failed to encode AVIF');
        }

        const sizeKb = (variant.size / 1024).toFixed(0);
        const colorInfo = variant.colorSpace ? `, ${variant.colorSpace}` : '';
        log(
          `   ✅ Encoded variant ${width}w @ q${variant.quality}, ${variant.bitdepth}bit, ${variant.chromaSubsampling}${colorInfo} (${sizeKb} KB)`
        );

        await io.upload(destKey, variant.buffer, AVIF_CONTENT_TYPE, sourceMetadata);
        log(`   ⬆️  Uploaded ${destKey}`);
        result.variants.created.push(width);
      } catch (error) {
        log(`   ❌ Variant ${width}w failed: ${error.message}`);
        result.variants.failed.push(width);
      }
    }

    return result;
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
  }
}

function printSummary(stats, { dryRun, includeVariants, processed }) {
  const made = dryRun ? 'Would create' : 'Uploaded';

  console.log('\nSummary:');
  console.log('  Masters');
  console.log(`    ✅ ${made}: ${stats.master.created}`);
  console.log(`    ⏭️  Skipped (already exist): ${stats.master.skipped}`);
  console.log(`    ❌ Failed: ${stats.master.failed}`);

  if (includeVariants) {
    const uncertain = stats.variants.uncertain
      ? ` (${stats.variants.uncertain} of them only if the source is wide enough)`
      : '';
    console.log('  Variants');
    console.log(`    ✅ ${made}: ${stats.variants.created}${uncertain}`);
    console.log(`    ⏭️  Skipped (already exist): ${stats.variants.skipped}`);
    console.log(`    ➖ Not applicable (would upscale): ${stats.variants.notApplicable}`);
    if (stats.variants.collisions) {
      console.log(`    ⚠️  Not built (key is another photo's master): ${stats.variants.collisions}`);
    }
    console.log(`    ❌ Failed: ${stats.variants.failed}`);
  } else {
    console.log('  Variants: disabled (--no-variants)');
  }

  console.log(`  ⬇️  Originals downloaded: ${stats.downloaded}`);
  console.log(`  ❌ Photos failed before encoding (HEAD/download error): ${stats.photosFailed}`);
  console.log(`  📁 Total processed: ${processed}`);
}

async function main() {
  loadEnv();
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
  if (args.force) console.log('Force: re-encode and overwrite existing masters and variants');
  console.log(`Target size: ${(TARGET_MAX_BYTES / 1024 / 1024).toFixed(1)} MB (master)`);
  console.log(
    args.variants
      ? `Variants: ${VARIANT_WIDTHS.join(', ')} px wide @ q${args.variantQuality} (never upscaled)`
      : 'Variants: disabled (--no-variants)'
  );
  console.log('');

  // Say up front which encoder runs (checkAvifenc() announces the CLI itself).
  if (!args.dryRun && !checkAvifenc()) {
    console.log('Encoder: sharp (avifenc CLI not found)\n');
  }

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

  // Master keys of every original in scope: a variant must never be written
  // to a key that is another photo's master.
  const reservedKeys = new Set();
  for (const obj of images) {
    const parsed = splitObjectKey(obj.Key);
    if (parsed) reservedKeys.add(buildDestKey({ destPrefix, ...parsed }));
  }

  const stats = createStats();
  let processed = 0;

  for (const obj of list) {
    const key = obj.Key;
    const parsed = splitObjectKey(key);
    if (!parsed) continue;
    const { album, filename } = parsed;

    const destKey = buildDestKey({ destPrefix, album, filename });

    process.stdout.write(`[${processed + 1}/${list.length}] ${album}/${filename}\n`);
    process.stdout.write(`   -> ${destKey}\n`);

    try {
      const result = await processPhoto(
        { key, album, filename },
        {
          destPrefix,
          force: args.force,
          dryRun: args.dryRun,
          includeVariants: args.variants,
          variantWidths: VARIANT_WIDTHS,
          variantQuality: args.variantQuality,
          reservedKeys,
        }
      );
      tallyResult(stats, result);
    } catch (error) {
      // processPhoto() reports its own failures; this is only a safety net.
      process.stdout.write(`   ❌ Failed: ${error.message}\n`);
      stats.photosFailed++;
    } finally {
      process.stdout.write('\n');
      processed++;
    }
  }

  printSummary(stats, { dryRun: args.dryRun, includeVariants: args.variants, processed });
}

module.exports = {
  // constants
  VARIANT_WIDTHS,
  DEFAULT_VARIANT_QUALITY,
  TARGET_MAX_BYTES,
  IMAGE_EXTENSIONS,
  AVIF_CONTENT_TYPE,
  CACHE_CONTROL,
  META_SOURCE_WIDTH,
  META_SOURCE_HEIGHT,
  // pure helpers
  parseArgs,
  stripExtension,
  splitObjectKey,
  buildDestKey,
  buildVariantKey,
  selectVariantWidths,
  sourceWidthFromHeads,
  planPhotoWork,
  createStats,
  tallyResult,
  isNotFoundError,
  isLikelyHDR,
  detectColorSpaceCICP,
  // encoding (local files only, no R2 access)
  describeSource,
  encodeAvif,
  buildOptimizedAvif,
  buildVariantAvif,
  // per-photo orchestration (all I/O injectable through `deps`)
  processPhoto,
  // R2 access (talks to the bucket when called)
  headObject,
  probeSourceWidth,
  uploadToR2,
};

// Only run when executed directly; requiring this file has no side effects.
if (require.main === module) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
