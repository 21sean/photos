#!/usr/bin/env node

/**
 * Sync photos.json with R2 bucket contents + EXIF metadata
 *
 * Downloads images temporarily to extract EXIF metadata (dimensions, camera, GPS, etc.)
 * and to build a tiny blur placeholder, then generates photos.json with real metadata.
 *
 * Manifest shape: { [albumSlug]: Photo[] }. Besides the EXIF fields each photo gets
 *   variants  number[]  ascending widths W for which {web}/{album}/{base}-{W}w.avif
 *                       exists in the bucket (built by optimize-web-images.js);
 *                       omitted when there are none
 *   lqip      string    16px wide WebP blur placeholder as a data URI; omitted when
 *                       it could not be generated; not computed in --quick mode
 *
 * Objects under the web prefix ("web/") are the optimized AVIFs, never albums.
 *
 * Merge behavior: the existing photos.json is read first and each photo that is
 * still in the bucket starts from its existing entry, so fields this script does
 * not own (aiDescriptionHtml, fun_fact, aiLocationGuess, ... written by
 * enrich-photo-ai.js or by hand) survive a re-sync. On top of that:
 *   - filename, size, variants   always refreshed from the bucket listing
 *   - title                      kept when present, otherwise derived from the filename
 *   - width/height, EXIF fields  refreshed when EXIF could be read (not in --quick);
 *                                a value EXIF does not provide keeps its existing value
 *   - lqip                       regenerated when the original is downloaded,
 *                                otherwise (--quick, or generation failed) kept
 * Photos and albums that are no longer in the bucket are dropped.
 *
 * Usage:
 *   node scripts/sync-photos.js           # Update photos.json from R2
 *   node scripts/sync-photos.js --dry-run # Preview changes
 *   node scripts/sync-photos.js --quick   # Skip download (no EXIF/LQIP refresh)
 *   node scripts/sync-photos.js --web-prefix web-optimized
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

const BUCKET_NAME = 'photos';
const OUTPUT_FILE = path.join(__dirname, '../src/lib/photos.json');

// Prefix that holds the web-optimized AVIFs written by optimize-web-images.js
// (its --dest-prefix). Everything below it is a master or a variant, not a photo.
const WEB_PREFIX = 'web';

// Blur placeholder: 16px wide WebP, a few hundred bytes as a data URI
const LQIP_WIDTH = 16;
const LQIP_QUALITY = 50;

// Used when the real dimensions are unknown (--quick on a photo that is new)
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1280;

// R2 client, created on first use (after the .env file was loaded in main()),
// so that requiring this file has no side effects and needs no env vars.
let r2ClientInstance = null;
function getR2Client() {
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: 'auto',
      endpoint: process.env.CF_URL?.replace(/\/+$/, '') || '',
      credentials: {
        accessKeyId: process.env.Access_Key_ID || '',
        secretAccessKey: process.env.Secret_Access_Key || '',
      },
    });
  }
  return r2ClientInstance;
}

// exiftool-vendored installs process exit hooks when it is loaded and spawns a
// child process on first use, so it is only required when EXIF is really read.
let exiftoolInstance = null;
function getExiftool() {
  if (!exiftoolInstance) exiftoolInstance = require('exiftool-vendored').exiftool;
  return exiftoolInstance;
}

async function shutdownExiftool() {
  if (exiftoolInstance) await exiftoolInstance.end();
}

// Image extensions we care about (same list as optimize-web-images.js)
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif'];

// Download object to temp file
async function downloadToTemp(key) {
  const response = await getR2Client().send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));

  const tempPath = path.join(os.tmpdir(), 'r2-sync-' + Date.now() + '-' + path.basename(key));
  const chunks = [];

  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  fs.writeFileSync(tempPath, Buffer.concat(chunks));
  return tempPath;
}

// Extract EXIF metadata from image.
// Returns null when EXIF could not be read at all; fields that are simply
// absent come back as null so the merge can fall back to existing values.
async function extractMetadata(tempPath) {
  try {
    const tags = await getExiftool().read(tempPath);

    return {
      width: tags.ImageWidth || tags.ExifImageWidth || null,
      height: tags.ImageHeight || tags.ExifImageHeight || null,
      camera: tags.Model || null,
      lens: tags.LensModel || tags.Lens || null,
      iso: tags.ISO || null,
      aperture: tags.FNumber || tags.Aperture || null,
      shutterSpeed: tags.ExposureTime || tags.ShutterSpeed || null,
      focalLength: tags.FocalLength || null,
      dateTaken: tags.DateTimeOriginal || tags.CreateDate || null,
      gps: (tags.GPSLatitude && tags.GPSLongitude) ? {
        lat: tags.GPSLatitude,
        lng: tags.GPSLongitude,
        altitude: tags.GPSAltitude || null,
      } : null,
      colorSpace: tags.ColorSpace || null,
    };
  } catch (error) {
    console.warn('   Warning: Could not read EXIF: ' + error.message);
    return null;
  }
}

/**
 * Tiny blur placeholder for a local image: resized to LQIP_WIDTH px wide
 * (aspect kept), converted to sRGB, encoded as WebP and returned as a
 * "data:image/webp;base64,..." URI. Throws when sharp cannot read the image.
 *
 * pipelineColourspace('srgb') matters for 16-bit sources that embed an ICC
 * profile (10-bit AVIF, 16-bit PNG/TIFF): sharp otherwise processes those in
 * a wide-gamut space and the profile-less output would look desaturated.
 */
async function generateLqip(inputPath) {
  const buffer = await sharp(inputPath, { limitInputPixels: false, sequentialRead: true })
    .pipelineColourspace('srgb')
    .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
    .toColorspace('srgb')
    .webp({ quality: LQIP_QUALITY })
    .toBuffer();

  return 'data:image/webp;base64,' + buffer.toString('base64');
}

async function listAllObjects() {
  const objects = [];
  let continuationToken;

  do {
    const response = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      objects.push(...response.Contents);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O) - exported for tests
// ---------------------------------------------------------------------------

function normalizePrefix(prefix) {
  return String(prefix == null ? WEB_PREFIX : prefix).replace(/^\/+|\/+$/g, '');
}

// Same rule the web master and its variants use for {base}
function stripExtension(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

// Generate title from filename
function titleFromFilename(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Is this key one of the web-optimized objects (master or variant)? */
function isWebKey(key, webPrefix = WEB_PREFIX) {
  return String(key).startsWith(normalizePrefix(webPrefix) + '/');
}

/**
 * "album/file.jpg" -> { album, filename } for an original photo, null for
 * everything else: folder markers, non-images, top-level files and anything
 * under the web prefix (those are optimized copies, not albums).
 */
function parsePhotoKey(key, webPrefix = WEB_PREFIX) {
  if (!key || key.endsWith('/')) return null;
  if (isWebKey(key, webPrefix)) return null;

  const ext = path.extname(key).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return null;

  const parts = key.split('/');
  if (parts.length < 2) return null;

  return { album: parts[0], filename: parts.slice(1).join('/') };
}

/** Key of the web master of a photo: {web}/{album}/{base}.avif */
function buildMasterKey(album, filename, webPrefix = WEB_PREFIX) {
  return normalizePrefix(webPrefix) + '/' + album + '/' + stripExtension(filename) + '.avif';
}

/**
 * "{web}/{album}/{base}-{W}w.avif" -> { album, base, width }, otherwise null.
 * Only the trailing "-{W}w.avif" counts, so a base name that itself contains
 * "-800w" (e.g. "IMG-2024-800w-final") is not mistaken for a variant.
 */
function parseVariantKey(key, webPrefix = WEB_PREFIX) {
  const prefix = normalizePrefix(webPrefix) + '/';
  if (!key || !key.startsWith(prefix)) return null;

  const rest = key.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;

  const match = /^(.+)-([1-9]\d*)w\.avif$/.exec(rest.slice(slash + 1));
  if (!match) return null;

  return { album: rest.slice(0, slash), base: match[1], width: Number(match[2]) };
}

/** Split a bucket listing into original photos and web-optimized keys. */
function classifyObjects(objects, webPrefix = WEB_PREFIX) {
  const originals = [];
  const webKeys = [];

  for (const obj of objects || []) {
    const key = obj && obj.Key;
    if (!key) continue;

    if (isWebKey(key, webPrefix)) {
      if (!key.endsWith('/')) webKeys.push(key);
      continue;
    }

    const parsed = parsePhotoKey(key, webPrefix);
    if (parsed) originals.push({ key, album: parsed.album, filename: parsed.filename, size: obj.Size });
  }

  return { originals, webKeys };
}

/**
 * Which variant widths exist for which photo, derived from the bucket listing.
 * Returns { [album]: { [filename]: number[] } } with ascending widths; photos
 * without variants are absent.
 *
 * A web key that is the master of some original is never read as a variant:
 * with "a.jpg" and "a-800w.jpg" in one album, "web/x/a-800w.avif" is the
 * master of the second photo, not the 800w variant of the first.
 */
function extractVariants(objects, webPrefix = WEB_PREFIX) {
  const { originals, webKeys } = classifyObjects(objects, webPrefix);
  const masterKeys = new Set(originals.map(o => buildMasterKey(o.album, o.filename, webPrefix)));

  // "{album}/{base}" -> Set of widths
  const widthsByBase = new Map();
  for (const key of webKeys) {
    if (masterKeys.has(key)) continue;
    const parsed = parseVariantKey(key, webPrefix);
    if (!parsed) continue;

    const id = parsed.album + '/' + parsed.base;
    if (!widthsByBase.has(id)) widthsByBase.set(id, new Set());
    widthsByBase.get(id).add(parsed.width);
  }

  const result = {};
  for (const { album, filename } of originals) {
    const widths = widthsByBase.get(album + '/' + stripExtension(filename));
    if (!widths || widths.size === 0) continue;

    if (!Object.prototype.hasOwnProperty.call(result, album)) result[album] = {};
    result[album][filename] = [...widths].sort((a, b) => a - b);
  }

  return result;
}

/** Entry of a photo in an already loaded manifest, or null. */
function findExistingPhoto(manifest, album, filename) {
  if (!manifest || !Object.prototype.hasOwnProperty.call(manifest, album)) return null;
  const list = manifest[album];
  if (!Array.isArray(list)) return null;
  return list.find(p => p && typeof p === 'object' && p.filename === filename) || null;
}

/**
 * Build the manifest entry of one photo.
 *
 *   existing  entry from the current photos.json (or null): every field it has
 *             is carried over unless listed below
 *   metadata  result of extractMetadata(), or null when EXIF was not read
 *             (--quick, download failed, exiftool failed)
 *   variants  widths found in the bucket listing ([] / undefined = none)
 *   lqip      freshly generated data URI, or null to keep the existing one
 */
function mergePhoto({ existing = null, filename, size, metadata = null, variants = null, lqip = null }) {
  const prev = existing && typeof existing === 'object' ? existing : {};
  const photo = { ...prev };

  photo.filename = filename;
  photo.title = typeof prev.title === 'string' && prev.title !== ''
    ? prev.title
    : titleFromFilename(filename);

  // Dimensions: fresh EXIF, else what the manifest already has, else defaults
  if (metadata && metadata.width > 0 && metadata.height > 0) {
    photo.width = metadata.width;
    photo.height = metadata.height;
  } else if (!(prev.width > 0 && prev.height > 0)) {
    photo.width = DEFAULT_WIDTH;
    photo.height = DEFAULT_HEIGHT;
  }

  photo.size = size;

  // Add optional metadata if available (absent values keep what was there)
  if (metadata) {
    if (metadata.camera) photo.camera = metadata.camera;
    if (metadata.lens) photo.lens = metadata.lens;
    if (metadata.iso) photo.iso = metadata.iso;
    if (metadata.aperture) photo.aperture = metadata.aperture;
    if (metadata.shutterSpeed) photo.shutterSpeed = String(metadata.shutterSpeed);
    if (metadata.focalLength) photo.focalLength = String(metadata.focalLength);
    if (metadata.dateTaken) photo.dateTaken = String(metadata.dateTaken);
    if (metadata.gps) photo.gps = metadata.gps;
  }

  // Responsive variants mirror the bucket: set when present, removed when not
  if (Array.isArray(variants) && variants.length > 0) {
    photo.variants = [...variants].sort((a, b) => a - b);
  } else {
    delete photo.variants;
  }

  // Blur placeholder: a new one replaces the old one, otherwise keep the old one
  if (typeof lqip === 'string' && lqip !== '') photo.lqip = lqip;

  return photo;
}

function parseArgs(argv) {
  const args = { dryRun: false, quick: false, webPrefix: WEB_PREFIX, help: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--quick') args.quick = true;
    else if (a === '--web-prefix') {
      if (argv[i + 1] == null) throw new Error('--web-prefix expects a value');
      args.webPrefix = argv[++i];
    }
    else if (a.startsWith('--web-prefix=')) args.webPrefix = a.slice(a.indexOf('=') + 1);
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error('Unknown arg: ' + a);
  }

  args.webPrefix = normalizePrefix(args.webPrefix);
  if (!args.webPrefix) throw new Error('--web-prefix must not be empty');
  return args;
}

function usage() {
  console.log(`
Sync src/lib/photos.json with the R2 bucket

Usage:
  node scripts/sync-photos.js [options]

Options:
  --dry-run             Print the manifest instead of writing it
  --quick               Do not download originals: no EXIF/dimension refresh and
                        no new blur placeholders (existing values are kept)
  --web-prefix <name>   Prefix of the web-optimized AVIFs (default: "${WEB_PREFIX}");
                        must match --dest-prefix of optimize-web-images.js
  --help, -h            Show this help

Fields already in photos.json that this script does not derive itself
(aiDescriptionHtml, fun_fact, ...) are preserved.
`);
}

// ---------------------------------------------------------------------------
// Manifest building
// ---------------------------------------------------------------------------

/**
 * Read the current manifest so its fields can be carried over.
 * A missing or empty file is fine (first sync). An unreadable one is an
 * error: carrying on would silently drop every field other tools wrote.
 */
function loadExistingManifest(filePath = OUTPUT_FILE) {
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      'Existing ' + filePath + ' is not valid JSON (' + error.message + '). ' +
      'Fix or remove it first; syncing over it would drop the fields other tools added.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Existing ' + filePath + ' does not have the shape { [album]: Photo[] }.');
  }

  return parsed;
}

const defaultDeps = {
  download: downloadToTemp,          // (key) -> temp file path
  extractMetadata,                   // (path) -> metadata | null
  generateLqip,                      // (path) -> data URI (throws on failure)
};

/**
 * Build the manifest from a bucket listing.
 *
 *   skipExif          --quick: download nothing (no EXIF, no LQIP)
 *   existingManifest  current photos.json content, merged into the result
 *   webPrefix         prefix of the web-optimized AVIFs
 *   deps              I/O functions, replaceable in tests
 */
async function processImages(objects, options = {}) {
  const {
    skipExif = false,
    existingManifest = {},
    webPrefix = WEB_PREFIX,
    deps = {},
  } = options;
  const io = { ...defaultDeps, ...deps };

  const { originals } = classifyObjects(objects, webPrefix);
  const variantsByPhoto = extractVariants(objects, webPrefix);
  const albums = {};

  for (const { key, album, filename, size } of originals) {
    if (!albums[album]) {
      albums[album] = [];
    }

    console.log('   Photo: ' + album + '/' + filename);

    const existing = findExistingPhoto(existingManifest, album, filename);
    let metadata = null;
    let lqip = null;

    if (!skipExif) {
      // Download once, extract EXIF and build the blur placeholder
      let tempPath = null;
      try {
        tempPath = await io.download(key);
        metadata = await io.extractMetadata(tempPath);

        try {
          lqip = await io.generateLqip(tempPath);
        } catch (error) {
          console.warn(
            '      Warning: Could not generate LQIP' +
            (existing && existing.lqip ? ' (keeping the existing one): ' : ': ') +
            error.message
          );
        }
      } catch (error) {
        console.warn('      Warning: Download failed: ' + error.message);
      } finally {
        // Cleanup temp file
        if (tempPath && fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }

    const variants = variantsByPhoto[album] ? variantsByPhoto[album][filename] : null;
    const photo = mergePhoto({ existing, filename, size, metadata, variants, lqip });

    if (!skipExif) {
      const cameraInfo = photo.camera ? ' - ' + photo.camera : '';
      const variantInfo = photo.variants ? ' - variants ' + photo.variants.join('/') : ' - no variants';
      const lqipInfo = lqip ? ' - lqip ' + lqip.length + ' chars' : '';
      console.log('      ' + photo.width + 'x' + photo.height + cameraInfo + variantInfo + lqipInfo);
    }

    albums[album].push(photo);
  }

  // Sort photos within each album
  for (const album of Object.keys(albums)) {
    albums[album].sort((a, b) => a.filename.localeCompare(b.filename));
  }

  return albums;
}

/** "album/filename" of manifest entries that are gone from the new manifest. */
function listRemovedPhotos(previous, next) {
  const removed = [];
  for (const album of Object.keys(previous || {})) {
    if (!Array.isArray(previous[album])) continue;
    for (const photo of previous[album]) {
      if (!photo || typeof photo.filename !== 'string') continue;
      if (!findExistingPhoto(next, album, photo.filename)) removed.push(album + '/' + photo.filename);
    }
  }
  return removed;
}

async function main() {
  loadDotEnvIfPresent(path.join(__dirname, '.env'));

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const dryRun = args.dryRun;
  const skipExif = args.quick;
  const webPrefix = args.webPrefix;

  console.log('Syncing photos from R2...\n');
  console.log('Mode: ' + (dryRun ? 'DRY RUN' : 'WRITE'));
  console.log('EXIF: ' + (skipExif ? 'SKIP (quick mode)' : 'EXTRACT'));
  console.log('LQIP: ' + (skipExif ? 'KEEP EXISTING (quick mode)' : 'GENERATE'));
  console.log('Bucket: ' + BUCKET_NAME);
  console.log('Web prefix: ' + webPrefix + '/ (masters and variants, not treated as an album)\n');

  try {
    // Existing manifest: its fields are merged into the new one
    const existingManifest = loadExistingManifest(OUTPUT_FILE);

    // List all objects
    console.log('Listing R2 objects...');
    const objects = await listAllObjects();
    const imageCount = classifyObjects(objects, webPrefix).originals.length;
    console.log('   Found ' + imageCount + ' images\n');

    // Process images and extract metadata
    console.log('Processing images...');
    const albums = await processImages(objects, { skipExif, existingManifest, webPrefix });
    const albumNames = Object.keys(albums);

    console.log('\nAlbums (' + albumNames.length + '):');
    for (const album of albumNames.sort()) {
      console.log('   ' + album + ': ' + albums[album].length + ' photos');
    }

    const allPhotos = albumNames.flatMap(album => albums[album]);
    console.log('\nResponsive variants: ' + allPhotos.filter(p => p.variants).length + ' of ' + allPhotos.length + ' photos');
    console.log('Blur placeholders:   ' + allPhotos.filter(p => p.lqip).length + ' of ' + allPhotos.length + ' photos');

    const removed = listRemovedPhotos(existingManifest, albums);
    if (removed.length) {
      console.log('\nNo longer in the bucket, dropped from the manifest (' + removed.length + '):');
      for (const name of removed) console.log('   ' + name);
    }

    // Generate JSON
    const json = JSON.stringify(albums, null, 2);

    if (dryRun) {
      console.log('\nGenerated photos.json preview:\n');
      console.log(json);
    } else {
      fs.writeFileSync(OUTPUT_FILE, json + '\n');
      console.log('\nSaved to ' + OUTPUT_FILE);
    }

    // Shutdown exiftool
    await shutdownExiftool();

    console.log('\nDone!');

  } catch (error) {
    console.error('Error: ' + error.message);
    await shutdownExiftool();
    process.exit(1);
  }
}

module.exports = {
  // constants
  IMAGE_EXTENSIONS,
  WEB_PREFIX,
  LQIP_WIDTH,
  LQIP_QUALITY,
  OUTPUT_FILE,
  // pure helpers
  parseArgs,
  stripExtension,
  titleFromFilename,
  isWebKey,
  parsePhotoKey,
  parseVariantKey,
  buildMasterKey,
  classifyObjects,
  extractVariants,
  findExistingPhoto,
  mergePhoto,
  listRemovedPhotos,
  // local file / injectable I/O
  loadExistingManifest,
  generateLqip,
  processImages,
};

// Only run when executed directly; requiring this file has no side effects.
if (require.main === module) {
  main().catch((error) => {
    console.error('Error: ' + (error && error.message ? error.message : error));
    process.exit(1);
  });
}
