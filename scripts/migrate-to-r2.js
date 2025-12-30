#!/usr/bin/env node

/**
 * Download images from URLs and upload to Cloudflare R2
 * 
 * Usage:
 *   node scripts/migrate-to-r2.js           # Migrate all images from mock-data.ts
 *   node scripts/migrate-to-r2.js --dry-run # Preview what would be migrated
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

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

const ACCOUNT_ID = process.env.Access_Key_ID?.split('').slice(0, 32).join('') || '';
const R2_ENDPOINT = process.env.CF_URL?.replace(/\/+$/, '') || '';
const BUCKET_NAME = 'photos';

// R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.Access_Key_ID || '',
    secretAccessKey: process.env.Secret_Access_Key || '',
  },
});

// Images to migrate - extracted from mock-data.ts
// Format: { album: folderName, url: sourceUrl, filename: targetFilename }
const IMAGES_TO_MIGRATE = [
  // Lisbon
  {
    album: 'lisbon',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/59953af5-125d-4722-bd7d-0d3b5d8117a7.jpeg?h=055f4fde8ffacf1685a131b248b76d28',
    filename: 'lisbon-streets-1.jpeg',
    title: 'Lisbon Streets'
  },
  {
    album: 'lisbon',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/38903464-91cc-4bd1-8e7c-9e50c05878e5.jpeg?h=70f626297e9c62ac9f701f489d2ecfdc',
    filename: 'lisbon-streets-2.jpeg',
    title: 'Lisbon Streets'
  },
  // Porto
  {
    album: 'porto',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/9085af66-a2f3-4a21-8d3f-822abe822066.jpeg?h=448cc7f82fb57528e152784ce2e47e09',
    filename: 'porto-1.jpeg',
    title: 'Porto'
  },
  {
    album: 'porto',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/6d443b63-49e2-42e1-a319-67e9014ead29.jpeg?h=97d63b2fae508530417b9055e0a0b53b',
    filename: 'porto-2.jpeg',
    title: 'Porto'
  },
  {
    album: 'porto',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/ed4a41e7-2626-4ed2-8a38-4d12fa8833e3.jpeg?h=72ff4b05c01a8cfba8b6debb51a0075f',
    filename: 'porto-3.jpeg',
    title: 'Porto'
  },
  // Prague
  {
    album: 'prague',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/25dbbb82-532c-4f87-8e52-62433f656137.jpeg?h=1fbc20a5ab3fadcfe77308e8980e9cc4',
    filename: 'prague-1.jpeg',
    title: 'Prague'
  },
  // Venice
  {
    album: 'venice',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/b9614653-4279-4751-951f-4af3ed81c288.jpeg?h=9d9b9878136972a44a6f6f946b608888',
    filename: 'venice-1.jpeg',
    title: 'Venice'
  },
  // Switzerland
  {
    album: 'switzerland',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/5f787495-fda7-40a8-9617-87267fe08c3b.jpeg?h=d7190021e8f42779daa9473f1165375e',
    filename: 'switzerland-1.jpeg',
    title: 'Switzerland'
  },
  {
    album: 'switzerland',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/2f80535e-3cb3-486c-9ce7-6c7744d63e61.jpeg?h=9575feda34345b09511ec8c36fd123c5',
    filename: 'switzerland-2.jpeg',
    title: 'Switzerland'
  },
  {
    album: 'switzerland',
    url: 'https://cdn.myportfolio.com/74004d49c2c7350fb26995a4a65b0df6/ad2384a2-f9e4-46c9-8cb7-6686761dfaff.jpeg?h=8d825d73540de5fe1bf3120fca60e302',
    filename: 'switzerland-3.jpeg',
    title: 'Switzerland'
  },
];

// Download a file from URL
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          contentType: response.headers['content-type'] || 'image/jpeg',
          contentLength: buffer.length,
        });
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Check if object exists in R2
async function objectExists(key) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') return false;
    throw error;
  }
}

// Upload to R2 with cache headers
async function uploadToR2(key, buffer, contentType) {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

// Main migration function
async function migrate(dryRun = false) {
  console.log('🚀 Starting Image Migration to R2\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '📤 LIVE UPLOAD'}`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Images to migrate: ${IMAGES_TO_MIGRATE.length}\n`);

  if (IMAGES_TO_MIGRATE.length === 0) {
    console.log('ℹ️  No images to migrate. Add images to IMAGES_TO_MIGRATE array.');
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < IMAGES_TO_MIGRATE.length; i++) {
    const image = IMAGES_TO_MIGRATE[i];
    const r2Key = `${image.album}/${image.filename}`;
    
    console.log(`[${i + 1}/${IMAGES_TO_MIGRATE.length}] ${image.title || image.filename}`);
    console.log(`   Source: ${image.url.substring(0, 60)}...`);
    console.log(`   Target: ${r2Key}`);

    try {
      // Check if already exists
      const exists = await objectExists(r2Key);
      if (exists) {
        console.log(`   ⏭️  Skipped (already exists)\n`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`   🔍 Would upload to: ${r2Key}\n`);
        uploaded++;
        continue;
      }

      // Download
      console.log(`   ⬇️  Downloading...`);
      const { buffer, contentType, contentLength } = await downloadFile(image.url);
      console.log(`   📦 Downloaded: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);

      // Upload
      console.log(`   ⬆️  Uploading to R2...`);
      await uploadToR2(r2Key, buffer, contentType);
      console.log(`   ✅ Uploaded successfully\n`);
      uploaded++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));

    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Uploaded: ${uploaded}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Total: ${IMAGES_TO_MIGRATE.length}`);

  if (!dryRun && uploaded > 0) {
    console.log('\n🎉 Migration complete!');
    console.log(`\nImages available at:`);
    console.log(`   https://images.sean.ventures/<album>/<filename>`);
  }
}

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

migrate(dryRun).catch(console.error);
