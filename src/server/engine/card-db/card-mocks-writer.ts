import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import type { MockCard } from "@/server/engine/card-db/card-mocks";

export const CARD_MOCKS_FILE_PATH = path.join(process.cwd(), "src/server/engine/card-db/card-mocks.json");

/**
 * Reads the mock file from DISK rather than importing `cardMocks`. This runs inside a live dev
 * server, where the imported module is whatever the module cache last compiled and would not
 * reflect a write made moments earlier.
 */
export async function readMockFileAsync(filePath: string = CARD_MOCKS_FILE_PATH): Promise<Record<string, MockCard>> {
  try {
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
  await writeFile(filePath, serializeMockFile(mocks), "utf8");
  return mocks;
}

export async function deleteMockAsync(
  cardId: string,
  filePath: string = CARD_MOCKS_FILE_PATH,
): Promise<Record<string, MockCard>> {
  const mocks = await readMockFileAsync(filePath);
  delete mocks[cardId];
  await writeFile(filePath, serializeMockFile(mocks), "utf8");
  return mocks;
}
