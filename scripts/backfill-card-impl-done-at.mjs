// backfill-card-impl-done-at.mjs [--push]
//
// One-time backfill for the /admin/cards-impl "Recents Only" filter. The board now stamps `doneAt`
// whenever a card ENTERS Done; rows finished before that have no stamp and are treated as not
// recent. This writes the date each card below was announced as added, so the recent batches
// show up under Recents Only from day one.
//
// Dates are written at 12:00 UTC so they read as the same calendar day in US time zones.
//
//   node scripts/backfill-card-impl-done-at.mjs           # dry run — reports, writes nothing
//   node scripts/backfill-card-impl-done-at.mjs --push    # apply
//
// Safe to re-run: it only writes rows that are in Done and have no doneAt yet, so it never
// overwrites a stamp the board itself recorded.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COLLECTION = "cardimplstatuses";
const push = process.argv.includes("--push");

/** Announced batch date → the cards added in it. */
const DONE_ON = {
  "2026-10-19": [
    "HMW_043", "HMW_045", "HMW_050", "HMW_051", "HMW_053", "HMW_054", "HMW_055", "HMW_062",
    "HMW_063", "HMW_065", "HMW_066", "HMW_073", "HMW_074", "HMW_097", "HMW_099", "HMW_102",
    "HMW_108", "HMW_110", "HMW_111", "HMW_113", "HMW_114", "HMW_119", "HMW_124", "HMW_126",
    "HMW_134", "HMW_138",
  ],
  "2026-10-27": [
    "HMW_002", "HMW_006", "HMW_012", "HMW_015", "HMW_039", "HMW_042", "HMW_047", "HMW_048",
    "HMW_049", "HMW_056", "HMW_058", "HMW_060", "HMW_068", "HMW_141", "HMW_146", "HMW_149",
    "HMW_156", "HMW_158", "HMW_164", "HMW_167", "HMW_169", "HMW_172", "SHD_189",
  ],
  "2026-10-31": [
    "HMW_069", "HMW_075", "HMW_076", "HMW_089", "HMW_096", "HMW_106", "HMW_120", "HMW_132",
    "HMW_139", "HMW_140", "HMW_143", "HMW_157", "HMW_175", "HMW_179", "HMW_181", "HMW_183",
    "HMW_187", "HMW_198", "HMW_201", "HMW_203", "HMW_209", "HMW_213", "HMW_220", "HMW_224",
    "HMW_226", "HMW_227", "HMW_229", "HMW_239", "HMW_245", "HMW_246", "HMW_254", "HMW_256",
    "HMW_269", "JTL_128", "JTL_237", "JTL_258", "LAW_108", "LAW_127", "LAW_181", "LAW_198",
    "LAW_241", "LAW_261", "LOF_095", "LOF_162", "LOF_164", "LOF_194", "LOF_224", "LOF_250",
    "LOF_259", "LOF_264", "SEC_047", "SEC_060", "SEC_063", "SEC_066", "SEC_100", "SEC_108",
    "SEC_113", "SEC_121", "SEC_138", "SEC_140", "SEC_146", "SEC_160", "SEC_173", "SEC_217",
    "SEC_222", "SEC_250", "SEC_259", "SHD_260", "TS26_05", "TS26_17", "TS26_21", "TS26_44",
    "TS26_65", "TS26_74", "TWI_107", "TWI_124", "TWI_127", "TWI_208", "TWI_225", "TWI_254",
  ],
  "2026-11-03": [
    "IC27_009", "IC27_010", "IC27_011", "IC27_012", "IC27_015", "IC27_016", "IC27_017", "IC27_020",
    "IC27_025", "IC27_027", "IC27_028", "IC27_030", "IC27_052", "IC27_073", "IC27_075", "IC27_080",
    "IC27_082", "IC27_085", "IC27_093", "IC27_097", "IC27_098", "IC27_105", "IC27_108", "IC27_129",
    "IC27_154", "IC27_161", "IC27_164", "IC27_169", "IC27_173", "IC27_175", "IC27_178", "IC27_180",
    "IC27_181", "IC27_182", "IC27_184", "IC27_185", "IC27_186", "IC27_188", "IC27_189", "IC27_190",
    "IC27_191", "IC27_192", "LOF_155", "LOF_235", "LOF_239", "SOR_238",
  ],
  "2026-11-04": [
    "IC27_001", "IC27_007", "IC27_008", "IC27_022", "IC27_024", "IC27_026", "IC27_079", "IC27_099",
    "IC27_147", "IC27_149", "IC27_166", "IC27_187", "LAW_202", "SEC_038",
  ],
  "2026-11-05": [
    "LAW_001", "LAW_004", "LAW_005", "LAW_006", "LAW_007", "LAW_009", "LAW_012", "LAW_014",
    "LAW_017", "SEC_002", "SEC_003", "SEC_008", "SEC_013", "SEC_016", "SEC_017", "SEC_018",
    "TS26_01", "TS26_02", "TS26_03", "TS26_04", "TS26_06", "TS26_07", "TS26_08",
  ],
  "2026-11-10": [
    "HMW_202", "IC27_002", "IC27_003", "IC27_004", "IC27_005", "IC27_006", "SEC_101",
  ],
  "2026-11-11": [
    "IC27_038", "IC27_039", "IC27_042", "IC27_043", "IC27_045", "IC27_046", "IC27_056", "IC27_057",
    "IC27_060", "IC27_066", "IC27_067", "IC27_068", "IC27_070", "IC27_071", "IC27_076", "IC27_077",
    "IC27_078", "IC27_081", "IC27_083", "IC27_084",
  ],
  "2026-11-12": [
    "IC27_103", "IC27_106", "IC27_107", "IC27_109", "IC27_110", "IC27_113", "IC27_115", "IC27_116",
    "IC27_117", "IC27_120", "IC27_123", "IC27_124", "IC27_126", "IC27_127", "IC27_136", "IC27_142",
    "IC27_144", "IC27_145", "IC27_146", "IC27_151", "IC27_158", "IC27_160", "IC27_162", "IC27_163",
    "IC27_165", "IC27_167", "IC27_168", "IC27_172", "IC27_194",
  ],
};

function connectionString() {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("No .env at the repo root — cannot reach the database.");
    process.exit(1);
  }
  const line = fs.readFileSync(envPath, "utf8").split("\n")
    .find((l) => l.startsWith("MONGO_CONNECTION_STRING="));
  if (!line) {
    console.error("MONGO_CONNECTION_STRING is not set in .env.");
    process.exit(1);
  }
  return line.slice("MONGO_CONNECTION_STRING=".length).trim().replace(/^["']|["']$/g, "");
}

const { default: mongoose } = await import("mongoose");
await mongoose.connect(connectionString(), { bufferCommands: false });
const coll = mongoose.connection.db.collection(COLLECTION);

try {
  const writes = [];
  const skipped = [];
  for (const [day, cardIds] of Object.entries(DONE_ON)) {
    const doneAt = new Date(`${day}T12:00:00.000Z`);
    const rows = await coll.find({ cardId: { $in: cardIds } }).toArray();
    const byId = new Map(rows.map((r) => [r.cardId, r]));
    for (const cardId of cardIds) {
      const r = byId.get(cardId);
      if (!r) skipped.push(`${cardId}  no row`);
      else if (r.status !== "done") skipped.push(`${cardId}  in ${r.status}, not done`);
      else if (r.doneAt) skipped.push(`${cardId}  already stamped ${new Date(r.doneAt).toISOString()}`);
      else writes.push({ cardId, doneAt });
    }
  }

  console.log(`${writes.length} row(s) to stamp, ${skipped.length} skipped.`);
  for (const s of skipped) console.log(`  skip ${s}`);

  if (writes.length === 0) {
    console.log("\nNothing to backfill.");
  } else if (!push) {
    console.log("\nDry run — nothing written. Re-run with --push to apply.");
  } else {
    // doneAt is the only field touched — updatedAt/updatedBy stay as the last real edit left them.
    for (const w of writes) {
      await coll.updateOne({ cardId: w.cardId, doneAt: { $exists: false } }, { $set: { doneAt: w.doneAt } });
    }
    console.log(`\nStamped ${writes.length} row(s).`);
  }
} finally {
  await mongoose.disconnect();
}
