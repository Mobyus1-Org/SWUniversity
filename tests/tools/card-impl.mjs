#!/usr/bin/env node
/**
 * Set a card's implementation status on the /admin/cards-impl board.
 *
 *   node tests/tools/card-impl.mjs --list
 *   node tests/tools/card-impl.mjs --list --status needs-work
 *   node tests/tools/card-impl.mjs --card HMW_035 --status done
 *   node tests/tools/card-impl.mjs --card SOR_042 --status needs-work --note "On Attack fires twice"
 *
 * This is the ONLY write tool in this directory, and it is deliberately not a database client:
 * it talks to the app over HTTP as an admin and never opens a Mongo connection or reads
 * MONGODB_URI. The DB-direct tools here (puzzle-fetch.mjs) remain strictly read-only.
 *
 * Needs a running server and an admin session cookie:
 *   export CARD_IMPL_COOKIE='session=...'      # copy from your browser's devtools
 *   npm run dev
 *
 * Must be run from the repo root.
 */

const VALID = ["todo", "priority", "needs-work", "done"];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

const BASE = argValue("--base") ?? "http://localhost:3000";
const COOKIE = process.env.CARD_IMPL_COOKIE ?? "";
const URL_PATH = `${BASE}/api/admin/card-impl`;

function die(message) {
  console.error(message);
  process.exit(1);
}

async function readBoard() {
  const res = await fetch(URL_PATH, { headers: { cookie: COOKIE } });
  if (!res.ok) {
    die(`GET failed: ${res.status}${res.status === 401 || res.status === 403
      ? " — CARD_IMPL_COOKIE is missing, stale, or not an admin session."
      : ""}`);
  }
  return res.json();
}

async function main() {
  if (!COOKIE) {
    die("Set CARD_IMPL_COOKIE to an admin session cookie first (see the header of this file).");
  }

  if (process.argv.includes("--list")) {
    const { cards, statuses } = await readBoard();
    const filter = argValue("--status");
    const rows = filter ? statuses.filter((s) => s.status === filter) : statuses;

    const counts = statuses.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});
    const todo = cards.length - statuses.filter((s) => s.status !== "todo").length;
    console.log(`${cards.length} cards in scope`);
    console.log(`  todo ${todo}` + VALID.slice(1).map((l) => `  ${l} ${counts[l] ?? 0}`).join(""));
    if (rows.length > 0) console.log("");
    for (const s of rows.sort((a, b) => a.cardId.localeCompare(b.cardId))) {
      console.log(`  ${s.cardId.padEnd(10)} ${s.status.padEnd(11)} ${s.note ?? ""}`);
    }
    return;
  }

  const card = argValue("--card");
  const status = argValue("--status");
  const note = argValue("--note");

  if (!card || !status) {
    die("Usage: --card SET_NNN --status todo|priority|needs-work|done [--note '...']\n"
      + "       --list [--status <lane>]");
  }
  if (!VALID.includes(status)) {
    die(`Unknown status "${status}". One of: ${VALID.join(", ")}`);
  }

  const res = await fetch(URL_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ cardId: card, status, ...(note ? { note } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    die(`POST failed: ${res.status} ${body.error ?? ""}`);
  }
  console.log(`${card} -> ${status}${note ? ` (${note})` : ""}`);
}

main().catch((err) => die(err.message));
