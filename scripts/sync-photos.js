#!/usr/bin/env node

/**
 * Sync photos.json with R2 bucket contents + EXIF metadata
 * 
 * Downloads images temporarily to extract EXIF metadata (dimensions, camera, GPS, etc.)
 * then generates photos.json with real metadata.
 * 
 * Usage:
 *   node scripts/sync-photos.js           # Update photos.json from R2
 *   node scripts/sync-photos.js --dry-run # Preview changes
 *   node scripts/sync-photos.js --quick   # Skip EXIF extraction (use defaults)
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { exiftool } = require('exiftool-vendored');
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

loadDotEnvIfPresent(path.join(__dirname, '.env'));

const R2_ENDPOINT = process.env.CF_URL?.replace(/\/+$/, '') || '';
const BUCKET_NAME = 'photos';
const OUTPUT_FILE = path.join(__dirname, '../src/lib/photos.json');

// R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.Access_Key_ID || '',
    secretAccessKey: process.env.Secret_Access_Key || '',
  },
});

// Image extensions we care about
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic'];

// Download object to temp file
async function downloadToTemp(key) {
  const response = await r2Client.send(new GetObjectCommand({
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

// Extract EXIF metadata from image
async function extractMetadata(tempPath) {
  try {
    const tags = await exiftool.read(tempPath);
    
    return {
      width: tags.ImageWidth || tags.ExifImageWidth || 1920,
      height: tags.ImageHeight || tags.ExifImageHeight || 1280,
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
    return { width: 1920, height: 1280 };
  }
}

async function listAllObjects() {
  const objects = [];
  let continuationToken;

  do {
    const response = await r2Client.send(
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

async function processImages(objects, skipExif = false) {
  const albums = {};

  for (const obj of objects) {
    const key = obj.Key;
    
    // Skip folder markers and non-images
    if (key.endsWith('/')) continue;
    const ext = path.extname(key).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) continue;

    // Parse album/filename
    const parts = key.split('/');
    if (parts.length < 2) continue;
    
    const album = parts[0];
    const filename = parts.slice(1).join('/');
    
    if (!albums[album]) {
      albums[album] = [];
    }

    // Generate title from filename
    const title = filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    console.log('   Photo: ' + album + '/' + filename);

    let metadata = { width: 1920, height: 1280 };
    
    if (!skipExif) {
      // Download and extract EXIF
      let tempPath = null;
      try {
        tempPath = await downloadToTemp(key);
        metadata = await extractMetadata(tempPath);
        const cameraInfo = metadata.camera ? ' - ' + metadata.camera : '';
        console.log('      ' + metadata.width + 'x' + metadata.height + cameraInfo);
      } catch (error) {
        console.warn('      Warning: Download failed: ' + error.message);
      } finally {
        // Cleanup temp file
        if (tempPath && fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }

    const photo = {
      filename,
      title,
      width: metadata.width,
      height: metadata.height,
      size: obj.Size,
    };

    // Add optional metadata if available
    if (metadata.camera) photo.camera = metadata.camera;
    if (metadata.lens) photo.lens = metadata.lens;
    if (metadata.iso) photo.iso = metadata.iso;
    if (metadata.aperture) photo.aperture = metadata.aperture;
    if (metadata.shutterSpeed) photo.shutterSpeed = String(metadata.shutterSpeed);
    if (metadata.focalLength) photo.focalLength = String(metadata.focalLength);
    if (metadata.dateTaken) photo.dateTaken = String(metadata.dateTaken);
    if (metadata.gps) photo.gps = metadata.gps;

    albums[album].push(photo);
  }

  // Sort photos within each album
  for (const album of Object.keys(albums)) {
    albums[album].sort((a, b) => a.filename.localeCompare(b.filename));
  }

  return albums;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipExif = args.includes('--quick');
  
  console.log('Syncing photos from R2...\n');
  console.log('Mode: ' + (dryRun ? 'DRY RUN' : 'WRITE'));
  console.log('EXIF: ' + (skipExif ? 'SKIP (quick mode)' : 'EXTRACT'));
  console.log('Bucket: ' + BUCKET_NAME + '\n');

  try {
    // List all objects
    console.log('Listing R2 objects...');
    const objects = await listAllObjects();
    const imageCount = objects.filter(o => 
      !o.Key.endsWith('/') && 
      IMAGE_EXTENSIONS.includes(path.extname(o.Key).toLowerCase())
    ).length;
    console.log('   Found ' + imageCount + ' images\n');

    // Process images and extract metadata
    console.log('Processing images...');
    const albums = await processImages(objects, skipExif);
    const albumNames = Object.keys(albums);
    
    console.log('\nAlbums (' + albumNames.length + '):');
    for (const album of albumNames.sort()) {
      console.log('   ' + album + ': ' + albums[album].length + ' photos');
    }

    // Generate JSON
    const json = JSON.stringify(albums, null, 2);

    if (dryRun) {
      console.log('\nGenerated photos.json preview:\n');
      console.log(json);
    } else {
      fs.writeFileSync(OUTPUT_FILE, json);
      console.log('\nSaved to ' + OUTPUT_FILE);
    }

    // Shutdown exiftool
    await exiftool.end();

    console.log('\nDone!');

  } catch (error) {
    console.error('Error: ' + error.message);
    await exiftool.end();
    process.exit(1);
  }
}

main();
