import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readMockFileAsync,
  serializeMockFile,
  upsertMockAsync,
  deleteMockAsync,
} from "@/server/engine/card-db/card-mocks-writer";
import type { MockCard } from "@/server/engine/card-db/card-mocks";

function mock(title: string): MockCard {
  return {
    title,
    subtitle: "",
    type: "Unit",
    type2: "",
    arena: "Ground",
    cost: 3,
    power: 2,
    hp: 4,
    upgradePower: null,
    upgradeHp: null,
    aspects: ["Command"],
    traits: ["Rebel"],
    text: "",
    epicAction: "",
    leaderUnitText: "",
    unique: false,
    rarity: "Common",
    set: "HMW",
    imageUrl: "https://example.test/cards/HMW/010.png",
    imageUrlBack: "",
  };
}

let directory = "";
let filePath = "";

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "card-mocks-"));
  filePath = path.join(directory, "card-mocks.json");
  await writeFile(filePath, "{}\n", "utf8");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("readMockFileAsync", () => {
  it("reads an empty file as an empty record", async () => {
    expect(await readMockFileAsync(filePath)).toEqual({});
  });

  it("reads existing entries", async () => {
    await writeFile(filePath, JSON.stringify({ HMW_010: mock("A") }), "utf8");
    expect((await readMockFileAsync(filePath)).HMW_010.title).toBe("A");
  });

  it("treats a missing file as empty rather than throwing", async () => {
    expect(await readMockFileAsync(path.join(directory, "absent.json"))).toEqual({});
  });
});

describe("serializeMockFile", () => {
  it("sorts keys so the diff is stable regardless of insert order", () => {
    const output = serializeMockFile({ HMW_011: mock("B"), HMW_010: mock("A") });
    expect(output.indexOf("HMW_010")).toBeLessThan(output.indexOf("HMW_011"));
  });

  it("ends with a trailing newline", () => {
    expect(serializeMockFile({})).toBe("{}\n");
  });

  it("indents for readability, since the file is reviewed as a diff", () => {
    expect(serializeMockFile({ HMW_010: mock("A") })).toContain('\n  "HMW_010": {');
  });
});

describe("upsertMockAsync", () => {
  it("adds a new entry", async () => {
    const result = await upsertMockAsync("HMW_010", mock("A"), filePath);
    expect(result.HMW_010.title).toBe("A");
    expect(JSON.parse(await readFile(filePath, "utf8")).HMW_010.title).toBe("A");
  });

  it("replaces an existing entry rather than merging into it", async () => {
    await upsertMockAsync("HMW_010", mock("A"), filePath);
    await upsertMockAsync("HMW_010", { ...mock("B"), traits: [] }, filePath);

    const written = JSON.parse(await readFile(filePath, "utf8"));
    expect(written.HMW_010.title).toBe("B");
    expect(written.HMW_010.traits).toEqual([]);
  });

  it("leaves other entries untouched", async () => {
    await upsertMockAsync("HMW_010", mock("A"), filePath);
    await upsertMockAsync("HMW_011", mock("B"), filePath);

    const written = JSON.parse(await readFile(filePath, "utf8"));
    expect(Object.keys(written)).toEqual(["HMW_010", "HMW_011"]);
  });

  it("is idempotent for the same input", async () => {
    await upsertMockAsync("HMW_010", mock("A"), filePath);
    const first = await readFile(filePath, "utf8");
    await upsertMockAsync("HMW_010", mock("A"), filePath);
    expect(await readFile(filePath, "utf8")).toBe(first);
  });
});

describe("deleteMockAsync", () => {
  it("removes the entry", async () => {
    await upsertMockAsync("HMW_010", mock("A"), filePath);
    const result = await deleteMockAsync("HMW_010", filePath);

    expect(result.HMW_010).toBeUndefined();
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({});
  });

  it("is a no-op for an id that is not mocked", async () => {
    await upsertMockAsync("HMW_010", mock("A"), filePath);
    await deleteMockAsync("HMW_999", filePath);
    expect(Object.keys(JSON.parse(await readFile(filePath, "utf8")))).toEqual(["HMW_010"]);
  });
});
