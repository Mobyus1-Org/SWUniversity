import path from "node:path";

// fs is loaded LAZILY, never as a static import. A static `node:fs` import anywhere in a page's
// module graph makes Turbopack emit that page's bundle as ESM, which Vercel's CommonJS launcher
// cannot require() (ERR_REQUIRE_ESM). See vercel/next.js discussion #91663.

import type { MockCard } from "@/server/engine/card-db/card-mocks";

export const CARD_MOCKS_FILE_PATH = path.join(process.cwd(), "src/server/engine/card-db/card-mocks.json");

/**
 * Reads the mock file from DISK rather than importing `cardMocks`. This runs inside a live dev
 * server, where the imported module is whatever the module cache last compiled and would not
 * reflect a write made moments earlier.
 */
export async function readMockFileAsync(filePath: string = CARD_MOCKS_FILE_PATH): Promise<Record<string, MockCard>> {
  try {
    const { readFile } = await import("node:fs/promises");
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MockCard>) : {};
  } catch {
    return {};
  }
}

/** Key-sorted and indented, because this file is reviewed as a git diff. */
export function serializeMockFile(mocks: Record<string, MockCard>): string {
  const sorted: Record<string, MockCard> = {};
  for (const cardId of Object.keys(mocks).sort((left, right) => left.localeCompare(right))) {
    sorted[cardId] = mocks[cardId];
  }

  return `${JSON.stringify(sorted, null, 2)}\n`;
}

export async function upsertMockAsync(
  cardId: string,
  mock: MockCard,
  filePath: string = CARD_MOCKS_FILE_PATH,
): Promise<Record<string, MockCard>> {
  const mocks = await readMockFileAsync(filePath);
  mocks[cardId] = mock;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, serializeMockFile(mocks), "utf8");
  return mocks;
}

export async function deleteMockAsync(
  cardId: string,
  filePath: string = CARD_MOCKS_FILE_PATH,
): Promise<Record<string, MockCard>> {
  const mocks = await readMockFileAsync(filePath);
  delete mocks[cardId];
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, serializeMockFile(mocks), "utf8");
  return mocks;
}
