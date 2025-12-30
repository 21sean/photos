#!/usr/bin/env node

/**
 * Test script for Cloudflare R2 access
 * This script lists all buckets and tests basic connectivity
 */

const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
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

// Cloudflare R2 Configuration
const R2_ENDPOINT = process.env.CF_URL?.replace(/\/+$/, '') || '';

// Create R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.Access_Key_ID || '',
    secretAccessKey: process.env.Secret_Access_Key || '',
  },
});

async function testR2Access() {
  console.log('🔍 Testing Cloudflare R2 Access...\n');
  console.log(`Endpoint: ${R2_ENDPOINT}\n`);

  try {
    // List all buckets
    console.log('📦 Listing buckets...');
    const listBucketsResponse = await r2Client.send(new ListBucketsCommand({}));
    
    if (!listBucketsResponse.Buckets || listBucketsResponse.Buckets.length === 0) {
      console.log('⚠️  No buckets found. You may need to create one first.');
      console.log('\nTo create a bucket, use the Cloudflare dashboard or run:');
      console.log('npm run create-bucket <bucket-name>');
      return;
    }

    console.log(`✅ Found ${listBucketsResponse.Buckets.length} bucket(s):\n`);
    
    for (const bucket of listBucketsResponse.Buckets) {
      console.log(`  • ${bucket.Name}`);
      console.log(`    Created: ${bucket.CreationDate}`);
      
      // Try to list objects in the bucket
      try {
        const listObjectsResponse = await r2Client.send(
          new ListObjectsV2Command({
            Bucket: bucket.Name,
            MaxKeys: 5, // Just list a few objects as a test
          })
        );
        
        const objectCount = listObjectsResponse.KeyCount || 0;
        console.log(`    Objects: ${objectCount}`);
        
        if (objectCount > 0 && listObjectsResponse.Contents) {
          console.log(`    Sample files:`);
          listObjectsResponse.Contents.slice(0, 3).forEach(obj => {
            console.log(`      - ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
          });
        }
      } catch (error) {
        console.log(`    ⚠️  Could not list objects: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('✅ R2 access test completed successfully!');
    console.log('\nYour domain configuration:');
    console.log('  Custom domain: images.sean.ventures');
    console.log('  (Configure this in Cloudflare R2 bucket settings)');

  } catch (error) {
    console.error('❌ Error testing R2 access:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testR2Access();
