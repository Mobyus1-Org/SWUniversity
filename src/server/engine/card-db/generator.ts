import path from "node:path";
// fs is loaded LAZILY at each call site, never as a static import. A static `node:fs` import in
// a page's module graph makes Turbopack emit that page's bundle as ESM, which Vercel's CommonJS
// launcher cannot require() (ERR_REQUIRE_ESM). See vercel/next.js discussion #91663.
import sharp from "sharp";
import { promosToIgnore } from "@/server/engine/card-db/promosToIgnore";
import { type MockCard } from "@/server/engine/card-db/card-mocks";
import { readMockFileAsync } from "@/server/engine/card-db/card-mocks-writer";
import { mockToSwuAttributes } from "@/server/engine/card-db/mock-adapter";
import { applyTraitSupplement, cardTraitSupplement } from "@/server/engine/card-db/card-trait-supplement";
import type {
  SwuCardAttributes,
  SwuCardsResponse,
  SwuRelation,
  SwuRelationList,
  StringDictionary,
  NumberDictionary,
  CardDictionaries,
} from "@/server/engine/card-db/swu-api-types";

const PAGE_SIZE = 100;
const SWU_CARD_API_BASE = "https://admin.starwarsunlimited.com/api/cards";
const SWUDB_CDN_BASE = "https://swudb.com/cdn-cgi/image/quality=95/images/cards";
const MISSING_LEADERS_LOG = path.join(process.cwd(), "missing-leaders.txt");
const GENERATED_MODULE_PATH = path.join(process.cwd(), "src/server/engine/card-db/generated.ts");
const GENERATED_OVERRIDES_MODULE_PATH = path.join(process.cwd(), "src/server/engine/card-db/overrides-generated.ts");
const GENERATED_CARD_IMAGE_FULL_DIR = path.join(process.cwd(), "public/assets/cards/full");
const GENERATED_CARD_IMAGE_SQUARE_DIR = path.join(process.cwd(), "public/assets/cards/square");
const SQUARE_IMAGE_SIZE = 512;
// Most sets number their cards with 3 digits (SOR_001). TS26 is printed and indexed
// by the card databases (SWUDB et al.) with 2 digits, so its ids follow suit.
const TWO_DIGIT_CARD_NUMBER_SETS = new Set(["TS26"]);

export type CardDbGenerationSummary = {
  generatedAt: string;
  generatedFilePaths: string[];
  processedCards: number;
  fetchedPages: number;
  dictionaryCount: number;
  /** Mock cards that reached the dictionaries this run. */
  appliedMockIds: string[];
  /** Mock cards ignored because official data has landed — safe to delete from card-mocks.json. */
  supersededMockIds: string[];
};

export type CardImageGenerationFailure = {
  cardId: string;
  reason: string;
};

export type CardImageGenerationSummary = {
  generatedAt: string;
  attempted: number;
  fetchedPages: number;
  generatedFull: number;
  generatedSquare: number;
  generatedBackFull: number;
  generatedBackSquare: number;
  skipped: number;
  failed: CardImageGenerationFailure[];
  outputDirectories: string[];
};

export type CardAssetsGenerationSummary = {
  generatedAt: string;
  fetchedPages: number;
  cardDb: CardDbGenerationSummary;
  images: CardImageGenerationSummary;
};

export function createEmptyDictionaries(): CardDictionaries {
  return {
    cardTitle: {},
    cardSubtitle: {},
    cardText: {},
    cardCost: {},
    cardHp: {},
    cardPower: {},
    cardUpgradeHp: {},
    cardUpgradePower: {},
    cardType: {},
    cardType2: {},
    cardSet: {},
    cardRarity: {},
    cardIsUnique: {},
    cardHasWhenPlayed: {},
    cardHasWhenDefeated: {},
    cardLeaderUnitText: {},
    cardAspects: {},
    cardTraits: {},
    cardArena: {},
  };
}

function getRelationValue(relation: SwuRelation | undefined, property: "name" | "englishName" | "code"): string {
  const attributes = relation?.data?.attributes;
  const value = attributes?.[property] ?? attributes?.name ?? "";
  return typeof value === "string" ? value.trim() : "";
}

function getRelationListValues(relationList: SwuRelationList | undefined): string[] {
  const items = relationList?.data ?? [];
  return items
    .map((item) => item.attributes?.englishName ?? item.attributes?.name ?? "")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

function normalizeType(typeName: string): string {
  if (typeName === "Token Unit") {
    return "Unit";
  }

  if (typeName === "Token Upgrade") {
    return "Upgrade";
  }

  return typeName;
}

function getRawTypeName(attributes: SwuCardAttributes): string {
  return getRelationValue(attributes.type, "name");
}

function formatCardNumber(setCode: string, cardNumber: number | null | undefined): string {
  const padWidth = TWO_DIGIT_CARD_NUMBER_SETS.has(setCode) ? 2 : 3;
  return String(cardNumber).padStart(padWidth, "0");
}

function parseCardNumStr(cardId: string): { setCode: string; numStr: string } {
  const underscore = cardId.indexOf("_");
  return {
    setCode: cardId.slice(0, underscore),
    numStr: cardId.slice(underscore + 1),
  };
}

function getSwudbPathParts(setCode: string, numStr: string): { swudbSetCode: string; swudbCardNumCandidates: string[] } {
  // SWUDB token cards use a token-prefixed set code and token-prefixed number,
  // e.g. SOR_T01 -> TSOR/T01.png
  if (/^T\d+$/i.test(numStr)) {
    return {
      swudbSetCode: `T${setCode}`,
      swudbCardNumCandidates: [numStr.toUpperCase()],
    };
  }

  if (setCode === "TS26") {
    // SWUDB is inconsistent about zero-padding for this set, so try every width.
    const numeric = Number.parseInt(numStr, 10);
    const numericCandidates = Number.isFinite(numeric)
      ? [String(numeric), String(numeric).padStart(2, "0"), String(numeric).padStart(3, "0")]
      : [numStr];
    const uniqueCandidates = [...new Set(numericCandidates)];
    return {
      swudbSetCode: setCode,
      swudbCardNumCandidates: uniqueCandidates,
    };
  }

  return {
    swudbSetCode: setCode,
    swudbCardNumCandidates: [numStr],
  };
}

async function appendMissingLeader(cardId: string, url: string): Promise<void> {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(MISSING_LEADERS_LOG, `${cardId}\t${url}\n`, "utf8");
}

function isTokenCard(attributes: SwuCardAttributes): boolean {
  return /token/i.test(getRawTypeName(attributes));
}

function normalizeType2(typeName: string): string {
  if (typeName === "Leader Unit") {
    return "Unit";
  }

  return typeName;
}

function buildCardId(attributes: SwuCardAttributes): string {
  const setCode = getRelationValue(attributes.expansion, "code");
  const cardNumber = attributes.cardNumber;
  const normalizedCardNumber = typeof cardNumber === "string"
    ? (/^\d+$/.test(cardNumber.trim()) ? Number(cardNumber.trim()) : Number.NaN)
    : cardNumber;

  if (!setCode || !Number.isFinite(normalizedCardNumber)) {
    throw new Error(`Unable to build card id from set "${setCode}" and card number "${String(cardNumber)}".`);
  }

  if (isTokenCard(attributes)) {
    return `${setCode}_T${String(normalizedCardNumber).padStart(2, "0")}`;
  }

  return `${setCode}_${formatCardNumber(setCode, normalizedCardNumber)}`;
}

function assignStringValue(dictionary: StringDictionary, key: string, value: string): void {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return;
  }

  dictionary[key] = normalizedValue.replaceAll('"', "'");
}

function assignNumberValue(dictionary: NumberDictionary, key: string, value: number | null | undefined): void {
  if (typeof value !== "number" || value === 0) {
    return;
  }

  dictionary[key] = value;
}

function serializeDictionary(name: string, dictionary: Record<string, string | number | true>, valueType: "string" | "number" | "boolean"): string {
  const entries = Object.entries(dictionary).sort(([left], [right]) => left.localeCompare(right));
  const serializedEntries = entries
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

  return `const ${name}: Record<string, ${valueType}> = {\n${serializedEntries}\n};\n`;
}

function renderGeneratedModule(
  dictionaries: CardDictionaries,
  summary: Pick<CardDbGenerationSummary, "generatedAt" | "processedCards" | "fetchedPages" | "dictionaryCount">,
): string {
  const orderedDictionaries: Array<{
    dictionaryName: keyof CardDictionaries;
    functionName: string;
    returnType: "string" | "number" | "boolean";
    getterReturnType?: "string[]";
  }> = [
    { dictionaryName: "cardTitle", functionName: "CardTitle", returnType: "string" },
    { dictionaryName: "cardSubtitle", functionName: "CardSubtitle", returnType: "string" },
    { dictionaryName: "cardText", functionName: "CardText", returnType: "string" },
    { dictionaryName: "cardCost", functionName: "CardCost", returnType: "number" },
    { dictionaryName: "cardHp", functionName: "CardHp", returnType: "number" },
    { dictionaryName: "cardPower", functionName: "CardPower", returnType: "number" },
    { dictionaryName: "cardUpgradeHp", functionName: "CardUpgradeHp", returnType: "number" },
    { dictionaryName: "cardUpgradePower", functionName: "CardUpgradePower", returnType: "number" },
    { dictionaryName: "cardType", functionName: "CardType", returnType: "string" },
    { dictionaryName: "cardType2", functionName: "CardType2", returnType: "string" },
    { dictionaryName: "cardSet", functionName: "CardSet", returnType: "string" },
    { dictionaryName: "cardRarity", functionName: "CardRarity", returnType: "string" },
    { dictionaryName: "cardIsUnique", functionName: "CardIsUnique", returnType: "boolean" },
    { dictionaryName: "cardHasWhenPlayed", functionName: "CardHasWhenPlayed", returnType: "boolean" },
    { dictionaryName: "cardHasWhenDefeated", functionName: "CardHasWhenDefeated", returnType: "boolean" },
    { dictionaryName: "cardLeaderUnitText", functionName: "CardLeaderUnitText", returnType: "string" },
    { dictionaryName: "cardAspects", functionName: "CardAspects", returnType: "string", getterReturnType: "string[]" },
    { dictionaryName: "cardTraits", functionName: "CardTraits", returnType: "string", getterReturnType: "string[]" },
    { dictionaryName: "cardArena", functionName: "CardArena", returnType: "string" },
  ];

  const dictionaryExports = orderedDictionaries
    .map(({ dictionaryName, returnType }) => serializeDictionary(dictionaryName, dictionaries[dictionaryName], returnType))
    .join("\n");

  const getterExports = orderedDictionaries
    .map(({ dictionaryName, functionName, returnType, getterReturnType }) => {
      if (getterReturnType === "string[]") {
        return `export function ${functionName}(cardId: string): string[] {\n  return ${dictionaryName}[cardId]?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];\n}\n`;
      }

      if (returnType === "boolean") {
        return `export function ${functionName}(cardId: string): boolean {\n  return ${dictionaryName}[cardId] === true;\n}\n`;
      }

      if (returnType === "number") {
        return `export function ${functionName}(cardId: string): number {\n  return ${dictionaryName}[cardId] ?? 0;\n}\n`;
      }

      return `export function ${functionName}(cardId: string): string {\n  return ${dictionaryName}[cardId] ?? "";\n}\n`;
    })
    .join("\n");

  const getAllCardIdsExport = `export function GetAllCardIds(): string[] {\n  return Object.keys(cardTitle);\n}\n`;
  const getAllCardTitlesExport = `export function AllCardTitles(): string[] {\n  return [...new Set(Object.values(cardTitle))].sort();\n}\n`;

  return `// This file is auto-generated by /internal/zzCardCodeGenerator.\n// Do not edit by hand. Re-run the generator instead.\n\n${dictionaryExports}\n${getterExports}\n${getAllCardIdsExport}\n${getAllCardTitlesExport}\nexport const cardDbGenerationMetadata = {\n  generatedAt: ${JSON.stringify(summary.generatedAt)},\n  processedCards: ${summary.processedCards},\n  fetchedPages: ${summary.fetchedPages},\n  dictionaryCount: ${summary.dictionaryCount},\n} as const;\n`;
}

function renderGeneratedOverridesModule(overrides: Record<string, string>): string {
  const sortedEntries = Object.entries(overrides).sort(([left], [right]) => left.localeCompare(right));
  const serializedEntries = sortedEntries
    .map(([promoCardId, originalCardId]) => `  ${JSON.stringify(promoCardId)}: ${JSON.stringify(originalCardId)},`)
    .join("\n");

  return `// This file is auto-generated by /internal/zzCardCodeGenerator.\n// Do not edit by hand.\n\nexport const cardOverrides = {\n${serializedEntries}\n} as const;\n`;
}

async function writeGeneratedOverridesModuleAsync(
  promoOverridesByCardId: Map<string, string>,
): Promise<Record<string, string>> {
  const resolvedOverrides: Record<string, string> = {};

  for (const [promoCardId, resolvedCardId] of promoOverridesByCardId.entries()) {
    resolvedOverrides[promoCardId] = resolvedCardId || "FILL_LATER";
  }

  const { writeFile } = await import("node:fs/promises");
  await writeFile(GENERATED_OVERRIDES_MODULE_PATH, renderGeneratedOverridesModule(resolvedOverrides), "utf8");
  return resolvedOverrides;
}

function buildCardIdFromPartialAttributes(attributes?: SwuCardAttributes | null): string {
  if (!attributes) {
    return "";
  }

  const setCode = getRelationValue(attributes.expansion, "code");
  const cardNumber = attributes.cardNumber;
  const normalizedCardNumber = typeof cardNumber === "string"
    ? (/^\d+$/.test(cardNumber.trim()) ? Number(cardNumber.trim()) : Number.NaN)
    : cardNumber;

  if (!setCode || !Number.isFinite(normalizedCardNumber)) {
    return "";
  }

  if (isTokenCard(attributes)) {
    return `${setCode}_T${String(normalizedCardNumber).padStart(2, "0")}`;
  }

  return `${setCode}_${formatCardNumber(setCode, normalizedCardNumber)}`;
}

async function fetchCardsPage(page: number): Promise<SwuCardsResponse> {
  const url = new URL(SWU_CARD_API_BASE);
  url.searchParams.set("locale", "EN");
  url.searchParams.set("pagination[page]", String(page));
  url.searchParams.set("pagination[pageSize]", String(PAGE_SIZE));
  url.searchParams.set("filters[variantOf][id][$null]", "true");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`SWU card API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as SwuCardsResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error("SWU card API returned an unexpected payload.");
  }

  return payload;
}

export function populateDictionaries(cardId: string, attributes: SwuCardAttributes, dictionaries: CardDictionaries): void {
  assignStringValue(dictionaries.cardTitle, cardId, attributes.title ?? "");
  assignStringValue(dictionaries.cardSubtitle, cardId, attributes.subtitle ?? "");
  assignStringValue(dictionaries.cardText, cardId, (attributes.text ?? "") + "\n" + (attributes.epicAction ?? ""));
  assignNumberValue(dictionaries.cardCost, cardId, attributes.cost);
  assignNumberValue(dictionaries.cardHp, cardId, attributes.hp);
  assignNumberValue(dictionaries.cardPower, cardId, attributes.power);
  assignNumberValue(dictionaries.cardUpgradeHp, cardId, attributes.upgradeHp);
  assignNumberValue(dictionaries.cardUpgradePower, cardId, attributes.upgradePower);

  assignStringValue(dictionaries.cardType, cardId, normalizeType(getRelationValue(attributes.type, "name")));
  assignStringValue(dictionaries.cardType2, cardId, normalizeType2(getRelationValue(attributes.type2, "name")));
  assignStringValue(dictionaries.cardSet, cardId, getRelationValue(attributes.expansion, "code"));
  assignStringValue(dictionaries.cardRarity, cardId, getRelationValue(attributes.rarity, "englishName"));

  if (attributes.unique) {
    dictionaries.cardIsUnique[cardId] = true;
  }

  const cardText = (attributes.text ?? "") + "\n" + (attributes.epicAction ?? "");
  if (/When Played/i.test(cardText)) {
    dictionaries.cardHasWhenPlayed[cardId] = true;
  }

  if (/When Defeated:/i.test(cardText)) {
    dictionaries.cardHasWhenDefeated[cardId] = true;
  }

  if (getRawTypeName(attributes) === "Leader") {
    assignStringValue(dictionaries.cardLeaderUnitText, cardId, attributes.deployBox ?? "");
  }

  const aspectValues = [
    ...getRelationListValues(attributes.aspects),
    ...getRelationListValues(attributes.aspectDuplicates),
  ];
  if (aspectValues.length > 0) {
    assignStringValue(dictionaries.cardAspects, cardId, aspectValues.join(","));
  }

  const traitValues = getRelationListValues(attributes.traits);
  if (traitValues.length > 0) {
    assignStringValue(dictionaries.cardTraits, cardId, traitValues.join(","));
  }

  const arenaValues = getRelationListValues(attributes.arenas);
  if (arenaValues.length > 0) {
    assignStringValue(dictionaries.cardArena, cardId, arenaValues.join(","));
  }
}

function resolveDuplicateAttributes(
  cardId: string,
  existingAttributes: SwuCardAttributes,
  incomingAttributes: SwuCardAttributes,
): SwuCardAttributes {
  const existingIsToken = isTokenCard(existingAttributes);
  const incomingIsToken = isTokenCard(incomingAttributes);

  if (existingIsToken && !incomingIsToken) {
    return incomingAttributes;
  }

  if (!existingIsToken && incomingIsToken) {
    return existingAttributes;
  }

  throw new Error(
    `Duplicate generated card id detected: ${cardId} (${existingAttributes.title ?? "Unknown"} vs ${incomingAttributes.title ?? "Unknown"}).`,
  );
}

const MOCK_ART_PREFIX = "mock_";

/**
 * Mock art is stored under a `mock_` filename prefix so stale preview art cannot masquerade as
 * official art after release. Only the FILENAME is prefixed — the card id stays SET_NNN
 * everywhere in dictionaries, card logic, puzzles and tests.
 */
export function mockArtFileName(cardId: string, suffix = ""): string {
  return `${MOCK_ART_PREFIX}${cardId}${suffix}.webp`;
}

/**
 * Merges hand-curated mock cards into the resolved card map. Official data ALWAYS wins: a mock
 * whose id is present in the API response is ignored and reported as superseded, so an ordinary
 * regen on release day switches every card over and tells you what to delete.
 */
export function mergeMocksIntoResolvedCards(
  resolved: Map<string, SwuCardAttributes>,
  mocks: Record<string, MockCard>,
): { appliedMockIds: string[]; supersededMockIds: string[] } {
  const appliedMockIds: string[] = [];
  const supersededMockIds: string[] = [];

  for (const [cardId, mock] of Object.entries(mocks)) {
    if (resolved.has(cardId)) {
      supersededMockIds.push(cardId);
      console.warn(`mock ${cardId} superseded by official data — safe to remove`);
      continue;
    }

    resolved.set(cardId, mockToSwuAttributes(cardId, mock));
    appliedMockIds.push(cardId);
  }

  return { appliedMockIds, supersededMockIds };
}

type ResolvedCardsResult = {
  resolvedCardAttributes: Map<string, SwuCardAttributes>;
  resolvedCardOverrides: Record<string, string>;
  processedCards: number;
  fetchedPages: number;
  appliedMockIds: string[];
  supersededMockIds: string[];
};

async function fetchResolvedCardsAsync(): Promise<ResolvedCardsResult> {
  const resolvedCardAttributes = new Map<string, SwuCardAttributes>();
  const promoOverridesByCardId = new Map<string, string>();
  let currentPage = 1;
  let pageCount = 1;
  let processedCards = 0;

  while (currentPage <= pageCount) {
    const payload = await fetchCardsPage(currentPage);
    const cards = payload.data ?? [];
    const pagination = payload.meta?.pagination;
    pageCount = pagination?.pageCount ?? (cards.length === PAGE_SIZE ? currentPage + 1 : currentPage);

    for (const card of cards) {
      const attributes = card.attributes;
      if (!attributes) {
        continue;
      }

      const cardId = buildCardId(attributes);

      const promoSetCode = getRelationValue(attributes.expansion, "code");
      if ((promosToIgnore as readonly string[]).includes(promoSetCode)) {
        const promoOverrideId = buildCardIdFromPartialAttributes(attributes.reprintOf?.data?.attributes);
        promoOverridesByCardId.set(cardId, promoOverrideId || "FILL_LATER");
        continue;
      }

      const existingAttributes = resolvedCardAttributes.get(cardId);
      if (existingAttributes) {
        resolvedCardAttributes.set(cardId, resolveDuplicateAttributes(cardId, existingAttributes, attributes));
      } else {
        resolvedCardAttributes.set(cardId, attributes);
      }
      processedCards += 1;
    }

    currentPage += 1;
  }

  // From DISK, not the imported `cardMocks`. Inside a live dev server that import is whatever the
  // module cache last compiled, so a mock added moments earlier through the mock editor would be
  // missing — silently dropping the newest card from the generated database. The mock WRITER
  // already reads from disk for the same reason; this is the read side of that rule.
  const mocksOnDisk = await readMockFileAsync();
  const mockReport = mergeMocksIntoResolvedCards(resolvedCardAttributes, mocksOnDisk);

  const resolvedCardOverrides = await writeGeneratedOverridesModuleAsync(promoOverridesByCardId);

  return {
    resolvedCardAttributes,
    resolvedCardOverrides,
    processedCards,
    fetchedPages: currentPage - 1,
    appliedMockIds: mockReport.appliedMockIds,
    supersededMockIds: mockReport.supersededMockIds,
  };
}

async function imageFileExistsAsync(filePath: string): Promise<boolean> {
  try {
    const { access } = await import("node:fs/promises");
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl, {
    headers: {
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(`image request failed with status ${response.status}`);
  }

  const imageArrayBuffer = await response.arrayBuffer();
  return Buffer.from(imageArrayBuffer);
}

async function fetchFirstAvailableImageBuffer(urls: string[]): Promise<{ buffer: Buffer; resolvedUrl: string }> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const buffer = await fetchImageBuffer(url);
      return { buffer, resolvedUrl: url };
    } catch (error) {
      lastError = error;
    }
  }

  throw (lastError ?? new Error("No URL candidates to fetch."));
}

async function writeFullImageAsync(sourceBuffer: Buffer, fileName: string): Promise<void> {
  await sharp(sourceBuffer)
    .webp()
    .toFile(path.join(GENERATED_CARD_IMAGE_FULL_DIR, fileName));
}

async function writeSquareImageAsync(sourceBuffer: Buffer, fileName: string): Promise<void> {
  await sharp(sourceBuffer)
    .resize(SQUARE_IMAGE_SIZE, SQUARE_IMAGE_SIZE, { fit: "cover", position: "north" })
    .webp()
    .toFile(path.join(GENERATED_CARD_IMAGE_SQUARE_DIR, fileName));
}

function trackImageFailure(summary: CardImageGenerationSummary, cardId: string, reason: string): void {
  summary.failed.push({ cardId, reason });
}

function applyCardOverridesToDictionaries(
  dictionaries: CardDictionaries,
  cardOverrides: Record<string, string>,
): void {
  const allDictionaries = Object.values(dictionaries) as Array<Record<string, string | number | true>>;

  for (const [promoCardId, originalCardId] of Object.entries(cardOverrides)) {
    if (!originalCardId || originalCardId === "FILL_LATER") {
      continue;
    }

    for (const dictionary of allDictionaries) {
      if (!(originalCardId in dictionary)) {
        continue;
      }

      dictionary[promoCardId] = dictionary[originalCardId] as string | number | true;
    }
  }
}


/**
 * Every card row, from resolved attributes to finished dictionaries.
 *
 * Order matters: the trait supplement runs BEFORE promo overrides. The supplement is keyed by the
 * ORIGINAL card id, so a promo reprint of a base only inherits its location trait if the original
 * already has one by the time the override copies its rows across.
 */
export function buildDictionaries(
  resolvedCardAttributes: Map<string, SwuCardAttributes>,
  resolvedCardOverrides: Record<string, string>,
  traitSupplement: Record<string, string> = cardTraitSupplement,
): CardDictionaries {
  const dictionaries = createEmptyDictionaries();

  for (const [cardId, attributes] of resolvedCardAttributes.entries()) {
    populateDictionaries(cardId, attributes, dictionaries);
  }

  applyTraitSupplement(dictionaries.cardTraits, traitSupplement);
  applyCardOverridesToDictionaries(dictionaries, resolvedCardOverrides);

  return dictionaries;
}

async function generateCardDbFromResolvedCardsAsync(
  resolvedCardAttributes: Map<string, SwuCardAttributes>,
  resolvedCardOverrides: Record<string, string>,
  processedCards: number,
  fetchedPages: number,
  appliedMockIds: string[],
  supersededMockIds: string[],
): Promise<CardDbGenerationSummary> {
  const dictionaries = buildDictionaries(resolvedCardAttributes, resolvedCardOverrides);

  const summaryBase = {
    generatedAt: new Date().toISOString(),
    processedCards,
    fetchedPages,
    dictionaryCount: Object.keys(dictionaries).length,
  };

  const { writeFile } = await import("node:fs/promises");
  await writeFile(GENERATED_MODULE_PATH, renderGeneratedModule(dictionaries, summaryBase), "utf8");

  return {
    ...summaryBase,
    appliedMockIds,
    supersededMockIds,
    generatedFilePaths: [
      path.relative(process.cwd(), GENERATED_MODULE_PATH),
      path.relative(process.cwd(), GENERATED_OVERRIDES_MODULE_PATH),
    ],
  };
}

async function generateCardImagesFromResolvedCardsAsync(
  resolvedCardAttributes: Map<string, SwuCardAttributes>,
  fetchedPages: number,
): Promise<CardImageGenerationSummary> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(GENERATED_CARD_IMAGE_FULL_DIR, { recursive: true });
  await mkdir(GENERATED_CARD_IMAGE_SQUARE_DIR, { recursive: true });
  // From disk for the same reason as the database run — see mergeMocksIntoResolvedCards' caller.
  const mocksForArt = await readMockFileAsync();

  const summary: CardImageGenerationSummary = {
    generatedAt: new Date().toISOString(),
    attempted: 0,
    fetchedPages,
    generatedFull: 0,
    generatedSquare: 0,
    generatedBackFull: 0,
    generatedBackSquare: 0,
    skipped: 0,
    failed: [],
    outputDirectories: [
      path.relative(process.cwd(), GENERATED_CARD_IMAGE_FULL_DIR),
      path.relative(process.cwd(), GENERATED_CARD_IMAGE_SQUARE_DIR),
    ],
  };

  const sortedCardIds = [...resolvedCardAttributes.keys()].sort((left, right) => left.localeCompare(right));

  for (const cardId of sortedCardIds) {
    const attributes = resolvedCardAttributes.get(cardId);
    if (!attributes) {
      continue;
    }

    summary.attempted += 1;

    // Mock art is written under a mock_ prefix so that official art, when it lands, has no file to
    // skip. The existing-file check must test the name that will actually be written, or a mocked
    // card re-downloads on every run.
    const mock = mocksForArt[cardId];
    const frontFileName = mock ? mockArtFileName(cardId) : `${cardId}.webp`;
    const backFileName = mock ? mockArtFileName(cardId, "_BACK") : `${cardId}_BACK.webp`;

    const frontAlreadyExists = await imageFileExistsAsync(
      path.join(GENERATED_CARD_IMAGE_FULL_DIR, frontFileName),
    );
    if (frontAlreadyExists) {
      summary.skipped += 1;
      continue;
    }

    const isLeader = getRelationValue(attributes.type, "name") === "Leader";
    const { setCode: cardSetCode, numStr: cardNumStr } = parseCardNumStr(cardId);
    const { swudbSetCode, swudbCardNumCandidates } = getSwudbPathParts(cardSetCode, cardNumStr);
    // SwuCardAttributes carries no art URL — the official path derives it from the card id, and
    // preview art is not addressable by that convention, so a mock supplies its own.
    const frontUrls = mock
      ? [mock.imageUrl]
      : swudbCardNumCandidates.map((candidate) => `${SWUDB_CDN_BASE}/${swudbSetCode}/${candidate}.png`);

    let frontBuffer: Buffer | null = null;
    try {
      ({ buffer: frontBuffer } = await fetchFirstAvailableImageBuffer(frontUrls));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackImageFailure(summary, cardId, `Front image download failed: ${message}`);
    }

    if (frontBuffer) {
      try {
        await writeFullImageAsync(frontBuffer, frontFileName);
        summary.generatedFull += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trackImageFailure(summary, cardId, `Front full image generation failed: ${message}`);
      }

      try {
        await writeSquareImageAsync(frontBuffer, frontFileName);
        summary.generatedSquare += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trackImageFailure(summary, cardId, `Front square image generation failed: ${message}`);
      }
    }

    const hasBack = Boolean(attributes.artBack?.data);
    if (!hasBack) {
      continue;
    }
    let backBuffer: Buffer | null = null;
    if (mock) {
      try {
        ({ buffer: backBuffer } = await fetchFirstAvailableImageBuffer([mock.imageUrlBack]));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trackImageFailure(summary, cardId, `Back image download failed: ${message}`);
      }
    } else if (isLeader) {
      const leaderBackUrls = swudbCardNumCandidates.map((candidate) => `${SWUDB_CDN_BASE}/${swudbSetCode}/${candidate}-back.png`);
      const leaderPortraitUrls = swudbCardNumCandidates.map((candidate) => `${SWUDB_CDN_BASE}/${swudbSetCode}/${candidate}-portrait.png`);
      const leaderCandidates = [...leaderBackUrls, ...leaderPortraitUrls];

      try {
        ({ buffer: backBuffer } = await fetchFirstAvailableImageBuffer(leaderCandidates));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendMissingLeader(cardId, leaderCandidates.join(" | "));
        trackImageFailure(summary, cardId, `Back image download failed: ${message}`);
      }
    } else {
      const backUrls = swudbCardNumCandidates.map((candidate) => `${SWUDB_CDN_BASE}/${swudbSetCode}/${candidate}-back.png`);
      try {
        ({ buffer: backBuffer } = await fetchFirstAvailableImageBuffer(backUrls));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trackImageFailure(summary, cardId, `Back image download failed: ${message}`);
      }
    }

    if (!backBuffer) {
      continue;
    }

    try {
      await writeFullImageAsync(backBuffer, backFileName);
      summary.generatedBackFull += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackImageFailure(summary, cardId, `Back full image generation failed: ${message}`);
    }

    try {
      await writeSquareImageAsync(backBuffer, backFileName);
      summary.generatedBackSquare += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackImageFailure(summary, cardId, `Back square image generation failed: ${message}`);
    }
  }


  return summary;
}

export async function generateCardDbAsync(): Promise<CardDbGenerationSummary> {
  const {
    resolvedCardAttributes,
    resolvedCardOverrides,
    processedCards,
    fetchedPages,
    appliedMockIds,
    supersededMockIds,
  } = await fetchResolvedCardsAsync();
  return generateCardDbFromResolvedCardsAsync(
    resolvedCardAttributes,
    resolvedCardOverrides,
    processedCards,
    fetchedPages,
    appliedMockIds,
    supersededMockIds,
  );
}

export async function generateCardImagesAsync(): Promise<CardImageGenerationSummary> {
  const { resolvedCardAttributes, fetchedPages } = await fetchResolvedCardsAsync();
  return generateCardImagesFromResolvedCardsAsync(resolvedCardAttributes, fetchedPages);
}

export async function generateCardAssetsAsync(): Promise<CardAssetsGenerationSummary> {
  const {
    resolvedCardAttributes,
    resolvedCardOverrides,
    processedCards,
    fetchedPages,
    appliedMockIds,
    supersededMockIds,
  } = await fetchResolvedCardsAsync();

  const [cardDb, images] = await Promise.all([
    generateCardDbFromResolvedCardsAsync(
      resolvedCardAttributes,
      resolvedCardOverrides,
      processedCards,
      fetchedPages,
      appliedMockIds,
      supersededMockIds,
    ),
    generateCardImagesFromResolvedCardsAsync(resolvedCardAttributes, fetchedPages),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    fetchedPages,
    cardDb,
    images,
  };
}