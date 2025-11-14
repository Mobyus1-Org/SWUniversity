import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to script location
const QUIZ_DB_PATH = path.join(__dirname, '../public/quiz-database.json');
const DYKSWU_DB_PATH = path.join(__dirname, '../public/dykswu-database.json');
const OUTPUT_DIR = path.join(__dirname, '../public/assets/swudb-import');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Convert card pattern (e.g., "SOR/123") to filename (e.g., "SOR_123.png")
 * Per DOWNLOADER-REQ-2: replace slash with underscores
 */
function patternToFilename(pattern) {
  return pattern.replace(/\//g, '_') + '.png';
}

/**
 * Download image from SWUDB CDN
 * Per DOWNLOADER-REQ-1 & DOWNLOADER-REQ-2: use SWUDB CDN URL pattern
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        if (response.headers.location) {
          https.get(response.headers.location, (redirectResponse) => {
            if (redirectResponse.statusCode === 200) {
              const fileStream = fs.createWriteStream(filepath);
              redirectResponse.pipe(fileStream);
              fileStream.on('finish', () => {
                fileStream.close();
                resolve();
              });
              fileStream.on('error', reject);
            } else {
              reject(new Error(`Failed after redirect: ${redirectResponse.statusCode}`));
            }
          }).on('error', reject);
        } else {
          reject(new Error(`Redirect without location header: ${response.statusCode}`));
        }
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('🚀 Starting SWUDB image download...\n');

  // Read databases
  let quizDb, dykswuDb;

  try {
    quizDb = JSON.parse(fs.readFileSync(QUIZ_DB_PATH, 'utf-8'));
    console.log(`✅ Loaded quiz database: ${quizDb.length} quizzes`);
  } catch (error) {
    console.error(`❌ Failed to read quiz database: ${error.message}`);
    process.exit(1);
  }

  try {
    dykswuDb = JSON.parse(fs.readFileSync(DYKSWU_DB_PATH, 'utf-8'));
    console.log(`✅ Loaded DYKSWU database: ${dykswuDb.length} questions`);
  } catch (error) {
    console.error(`❌ Failed to read DYKSWU database: ${error.message}`);
    process.exit(1);
  }

  // Collect unique card patterns
  const patterns = new Set();

  // Per DOWNLOADER-REQ-1: Extract from quiz database's relevantCards arrays
  quizDb.forEach(quiz => {
    if (quiz.relevantCards && Array.isArray(quiz.relevantCards)) {
      quiz.relevantCards.forEach(card => {
        if (card && typeof card === 'string') {
          patterns.add(card);
        }
      });
    }
  });

  // Per DOWNLOADER-REQ-2: Extract from DYKSWU database's actualCard property
  dykswuDb.forEach(question => {
    if (question.actualCard && typeof question.actualCard === 'string') {
      patterns.add(question.actualCard);
    }
  });

  console.log(`\n📊 Found ${patterns.size} unique card patterns\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedPatterns = [];

  for (const pattern of patterns) {
    const filename = patternToFilename(pattern);
    const filepath = path.join(OUTPUT_DIR, filename);

    // Per DOWNLOADER-REQ-3: Skip if PNG already exists
    if (fs.existsSync(filepath)) {
      console.log(`⏭️  Skipped: ${pattern} (already exists)`);
      skipped++;
      continue;
    }

    // Download image using SWUDB CDN URL pattern
    const url = `https://swudb.com/cdn-cgi/image/quality=1/images/cards/${pattern}.png`;

    try {
      await downloadImage(url, filepath);
      console.log(`✅ Downloaded: ${pattern}`);
      downloaded++;

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Failed: ${pattern} - ${error.message}`);
      failed++;
      failedPatterns.push({ pattern, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📈 DOWNLOAD SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Downloaded: ${downloaded}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total patterns: ${patterns.size}`);
  console.log('='.repeat(50));

  if (failedPatterns.length > 0) {
    console.log('\n⚠️  Failed downloads:');
    failedPatterns.forEach(({ pattern, error }) => {
      console.log(`   - ${pattern}: ${error}`);
    });
  }

  // Per TEST-1: Verify all unique cards have corresponding PNGs
  const missingPngs = [];
  for (const pattern of patterns) {
    const filename = patternToFilename(pattern);
    const filepath = path.join(OUTPUT_DIR, filename);
    if (!fs.existsSync(filepath)) {
      missingPngs.push(pattern);
    }
  }

  if (missingPngs.length === 0) {
    console.log('\n✅ TEST-1 PASSED: All unique cards have corresponding PNGs');
  } else {
    console.log(`\n⚠️  TEST-1 WARNING: ${missingPngs.length} cards missing PNGs:`);
    missingPngs.forEach(pattern => console.log(`   - ${pattern}`));
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
