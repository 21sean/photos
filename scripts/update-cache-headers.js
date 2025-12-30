#!/usr/bin/env node

/**
 * Update cache headers on existing R2 objects
 * 
 * This script copies each object to itself with new metadata,
 * which is the S3-compatible way to update headers without re-uploading.
 * 
 * Usage:
 *   node scripts/update-cache-headers.js           # Update all files
 *   node scripts/update-cache-headers.js --dry-run # Preview changes
 */

const { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

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

// The cache header we want
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.Access_Key_ID || '',
    secretAccessKey: process.env.Secret_Access_Key || '',
  },
});

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

async function getObjectMetadata(key) {
  const response = await r2Client.send(
    new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
  return {
    contentType: response.ContentType,
    cacheControl: response.CacheControl,
  };
}

async function updateCacheHeader(key, contentType) {
  // Copy object to itself with new metadata
  await r2Client.send(
    new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      CopySource: `${BUCKET_NAME}/${encodeURIComponent(key)}`,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
      MetadataDirective: 'REPLACE',
    })
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🔄 Updating R2 Cache Headers\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '📝 UPDATE'}`);
  console.log(`Target: Cache-Control: ${CACHE_CONTROL}\n`);

  try {
    // List all objects
    console.log('📋 Listing objects...');
    const objects = await listAllObjects();
    
    // Filter out folder markers
    const files = objects.filter(obj => !obj.Key.endsWith('/'));
    console.log(`   Found ${files.length} files\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const obj of files) {
      const key = obj.Key;
      
      try {
        // Get current metadata
        const metadata = await getObjectMetadata(key);
        
        if (metadata.cacheControl === CACHE_CONTROL) {
          console.log(`⏭️  ${key} (already set)`);
          skipped++;
          continue;
        }

        console.log(`📝 ${key}`);
        console.log(`   Old: ${metadata.cacheControl || '(none)'}`);
        console.log(`   New: ${CACHE_CONTROL}`);

        if (!dryRun) {
          await updateCacheHeader(key, metadata.contentType);
          console.log(`   ✅ Updated`);
        }
        
        updated++;
      } catch (error) {
        console.log(`❌ ${key}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
