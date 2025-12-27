#!/bin/bash

# Generate photos.json from R2 bucket using rclone
# This should be run as part of your build process
#
# Usage:
#   ./scripts/build-photos-manifest.sh
#
# Output:
#   src/lib/photos.json - Photo manifest used by the app

set -e

BUCKET="r2:photos"
OUTPUT_FILE="src/lib/photos.json"

echo "📷 Building photos manifest from R2..."

# Get JSON listing from R2
echo "   Fetching from R2..."
R2_JSON=$(rclone lsjson "$BUCKET" --recursive 2>/dev/null)

# Transform to our app's schema using node
echo "   Transforming to app schema..."
node -e "
const data = $R2_JSON;

// Filter to only images (not directories)
const images = data.filter(item => 
  !item.IsDir && 
  /\.(jpe?g|png|webp|avif|heic)$/i.test(item.Name)
);

// Group by album (first directory in path)
const albums = {};
for (const img of images) {
  const parts = img.Path.split('/');
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
  
  albums[album].push({
    filename,
    title,
    size: img.Size,
    // Default dimensions - can be overridden in photos-meta.json
    width: 1920,
    height: 1280
  });
}

// Sort photos within each album
for (const album of Object.keys(albums)) {
  albums[album].sort((a, b) => a.filename.localeCompare(b.filename));
}

console.log(JSON.stringify(albums, null, 2));
" > "$OUTPUT_FILE"

# Count results
ALBUM_COUNT=$(node -e "console.log(Object.keys(require('./$OUTPUT_FILE')).length)")
PHOTO_COUNT=$(node -e "const d = require('./$OUTPUT_FILE'); console.log(Object.values(d).flat().length)")

echo "✅ Generated $OUTPUT_FILE"
echo "   Albums: $ALBUM_COUNT"
echo "   Photos: $PHOTO_COUNT"
