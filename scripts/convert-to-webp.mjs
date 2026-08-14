import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Per CONVERTER-REQ-2: Process both folders
const SWUDB_IMPORT_DIR = path.join(__dirname, '../public/assets/swudb-import');
const DYKSWU_DIR = path.join(__dirname, '../public/assets/dykswu');

/**
 * Convert PNG to WEBP with size optimization
 * Per CONVERTER-DATA-1: Target 30kB preferred, 50kB maximum
 *
 * Uses binary search algorithm to find optimal quality setting
 */
async function convertToWebp(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');

  // Target sizes in bytes
  const preferredSizeBytes = 30 * 1024; // 30kB
  const maxSizeBytes = 50 * 1024; // 50kB

  // Binary search for optimal quality
  let minQuality = 10;
  let maxQuality = 100;
  let bestQuality = 80;
  let bestBuffer = null;

  while (minQuality <= maxQuality) {
    const quality = Math.floor((minQuality + maxQuality) / 2);

    const buffer = await sharp(pngPath)
      .webp({ quality })
      .toBuffer();

    const sizeBytes = buffer.length;

    // If size is within preferred range, we found optimal
    if (sizeBytes <= preferredSizeBytes) {
      bestQuality = quality;
      bestBuffer = buffer;
      // Try higher quality to get closer to preferred size
      minQuality = quality + 1;
    } else if (sizeBytes <= maxSizeBytes) {
      // Acceptable but not preferred, keep searching
      bestQuality = quality;
      bestBuffer = buffer;
      // Try lower quality
      maxQuality = quality - 1;
    } else {
      // Too large, must reduce quality
      maxQuality = quality - 1;
    }
  }

  // If no acceptable quality found, use lowest quality
  if (!bestBuffer) {
    bestQuality = 10;
    bestBuffer = await sharp(pngPath)
      .webp({ quality: bestQuality })
      .toBuffer();
  }

  // Per CONVERTER-REQ-3: Create WEBP as sibling to PNG
  fs.writeFileSync(webpPath, bestBuffer);

  const originalSize = fs.statSync(pngPath).size;
  const newSize = bestBuffer.length;

  return {
    webpPath,
    originalSizeKb: (originalSize / 1024).toFixed(1),
    newSizeKb: (newSize / 1024).toFixed(1),
    quality: bestQuality,
    compressionRatio: ((1 - newSize / originalSize) * 100).toFixed(1)
  };
}

/**
 * Process directory and convert all PNGs to WEBPs
 * Per CONVERTER-REQ-2 & CONVERTER-REQ-3
 */
async function processDirectory(dirPath, dirName) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️  Directory not found: ${dirPath}`);
    return { converted: 0, deleted: 0, failed: 0 };
  }

  const files = fs.readdirSync(dirPath);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));

  if (pngFiles.length === 0) {
    console.log(`ℹ️  No PNG files found in ${dirName}`);
    return { converted: 0, deleted: 0, failed: 0 };
  }

  console.log(`\n📂 Processing ${pngFiles.length} PNG files in ${dirName}...\n`);

  let converted = 0;
  let deleted = 0;
  let failed = 0;
  const failedFiles = [];

  for (const file of pngFiles) {
    const pngPath = path.join(dirPath, file);

    try {
      const result = await convertToWebp(pngPath);
      console.log(
        `✅ ${file}: ${result.originalSizeKb}kB → ${result.newSizeKb}kB ` +
        `(quality=${result.quality}, -${result.compressionRatio}%)`
      );
      converted++;

      // Per CONVERTER-REQ-3: Delete PNG after successful conversion
      fs.unlinkSync(pngPath);
      deleted++;

    } catch (error) {
      console.error(`❌ Failed to convert ${file}: ${error.message}`);
      failed++;
      failedFiles.push({ file, error: error.message });
    }
  }

  return { converted, deleted, failed, failedFiles };
}

/**
 * Verify TEST-2: Only WEBPs should remain after conversion
 */
function verifyNoRemainingPngs(dirPath, dirName) {
  if (!fs.existsSync(dirPath)) {
    return { hasRemainingPngs: false, remainingCount: 0 };
  }

  const files = fs.readdirSync(dirPath);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));

  return {
    hasRemainingPngs: pngFiles.length > 0,
    remainingCount: pngFiles.length,
    remainingFiles: pngFiles
  };
}

async function main() {
  console.log('🎨 Starting PNG to WEBP conversion...\n');

  // Verify sharp is installed and working
  try {
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).webp().toBuffer();
  } catch (error) {
    console.error('\n❌ Error: "sharp" package not installed or not working.');
    console.error('Please install it: npm install --save-dev sharp\n');
    process.exit(1);
  }

  // Process both directories per CONVERTER-REQ-2
  const swudbResults = await processDirectory(SWUDB_IMPORT_DIR, 'swudb-import');
  const dykswuResults = await processDirectory(DYKSWU_DIR, 'dykswu');

  const totalConverted = swudbResults.converted + dykswuResults.converted;
  const totalDeleted = swudbResults.deleted + dykswuResults.deleted;
  const totalFailed = swudbResults.failed + dykswuResults.failed;

  console.log('\n' + '='.repeat(50));
  console.log('📈 CONVERSION SUMMARY');
  console.log('='.repeat(50));
  console.log(`swudb-import: ${swudbResults.converted} converted, ${swudbResults.deleted} deleted`);
  console.log(`dykswu:       ${dykswuResults.converted} converted, ${dykswuResults.deleted} deleted`);
  console.log(`─────────────────────────────────────────────────`);
  console.log(`Total:        ${totalConverted} converted, ${totalDeleted} deleted`);
  if (totalFailed > 0) {
    console.log(`Failed:       ${totalFailed}`);
  }
  console.log('='.repeat(50));

  // Display failed conversions
  if (swudbResults.failedFiles && swudbResults.failedFiles.length > 0) {
    console.log('\n⚠️  Failed conversions in swudb-import:');
    swudbResults.failedFiles.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
  }

  if (dykswuResults.failedFiles && dykswuResults.failedFiles.length > 0) {
    console.log('\n⚠️  Failed conversions in dykswu:');
    dykswuResults.failedFiles.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
  }

  // Per TEST-2: Verify only WEBPs remain
  console.log('\n' + '='.repeat(50));
  console.log('🧪 TEST-2 VERIFICATION');
  console.log('='.repeat(50));

  const swudbVerification = verifyNoRemainingPngs(SWUDB_IMPORT_DIR, 'swudb-import');
  const dykswuVerification = verifyNoRemainingPngs(DYKSWU_DIR, 'dykswu');

  if (!swudbVerification.hasRemainingPngs && !dykswuVerification.hasRemainingPngs) {
    console.log('✅ TEST-2 PASSED: All PNGs have been cleaned up');
    console.log('   Only WEBPs remain in both folders');
  } else {
    console.log('⚠️  TEST-2 WARNING: Some PNGs remain:');
    if (swudbVerification.hasRemainingPngs) {
      console.log(`   - swudb-import: ${swudbVerification.remainingCount} PNG(s)`);
      swudbVerification.remainingFiles.forEach(file => console.log(`     • ${file}`));
    }
    if (dykswuVerification.hasRemainingPngs) {
      console.log(`   - dykswu: ${dykswuVerification.remainingCount} PNG(s)`);
      dykswuVerification.remainingFiles.forEach(file => console.log(`     • ${file}`));
    }
  }
  console.log('='.repeat(50));
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
