import path from "node:path";
import { access, appendFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { promosToIgnore } from "@/server/engine/card-db/promosToIgnore";

const PAGE_SIZE = 100;
const SWU_CARD_API_BASE = "https://admin.starwarsunlimited.com/api/cards";
const SWUDB_CDN_BASE = "https://swudb.com/cdn-cgi/image/quality=95/images/cards";
const MISSING_LEADERS_LOG = path.join(process.cwd(), "missing-leaders.txt");
const GENERATED_MODULE_PATH = path.join(process.cwd(), "src/server/engine/card-db/generated.ts");
const GENERATED_OVERRIDES_MODULE_PATH = path.join(process.cwd(), "src/server/engine/card-db/overrides-generated.ts");
const GENERATED_CARD_IMAGE_FULL_DIR = path.join(process.cwd(), "public/assets/cards/full");
const GENERATED_CARD_IMAGE_SQUARE_DIR = path.join(process.cwd(), "public/assets/cards/square");
const SQUARE_IMAGE_SIZE = 512;

type SwuMediaFormats = {
  card?: {
    url?: string | null;
  } | null;
} | null;

type SwuRelationAttributes = {
  code?: string | null;
  englishName?: string | null;
  name?: string | null;
  url?: string | null;
  formats?: SwuMediaFormats;
};

type SwuRelationData = {
  attributes?: SwuRelationAttributes | null;
} | null;

type SwuRelation = {
  data?: SwuRelationData;
};

type SwuRelationList = {
  data?: Array<{
    attributes?: SwuRelationAttributes | null;
  }>;
};

type SwuCardAttributes = {
  cardId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  cardNumber?: number | string | null;
  cost?: number | null;
  hp?: number | null;
  power?: number | null;
  upgradeHp?: number | null;
  upgradePower?: number | null;
  text?: string | null;
  unique?: boolean | null;
  rarity?: SwuRelation;
  type?: SwuRelation;
  type2?: SwuRelation;
  expansion?: SwuRelation;
  aspects?: SwuRelationList;
  aspectDuplicates?: SwuRelationList;
  traits?: SwuRelationList;
  arenas?: SwuRelationList;
  artFront?: SwuRelation;
  artBack?: SwuRelation;
  artThumbnail?: SwuRelation;
  reprintOf?: {
    data?: {
      attributes?: SwuCardAttributes | null;
    } | null;
  };
};

type SwuCardRecord = {
  id: number;
  attributes?: SwuCardAttributes | null;
};

type SwuCardsResponse = {
  data?: SwuCardRecord[];
  meta?: {
    pagination?: {
      page?: number;
      pageCount?: number;
      pageSize?: number;
      total?: number;
    };
  };
};

type StringDictionary = Record<string, string>;
type NumberDictionary = Record<string, number>;
type BooleanDictionary = Record<string, true>;

type CardDictionaries = {
  cardTitle: StringDictionary;
  cardSubtitle: StringDictionary;
  cardText: StringDictionary;
  cardCost: NumberDictionary;
  cardHp: NumberDictionary;
  cardPower: NumberDictionary;
  cardUpgradeHp: NumberDictionary;
  cardUpgradePower: NumberDictionary;
  cardType: StringDictionary;
  cardType2: StringDictionary;
  cardSet: StringDictionary;
  cardRarity: StringDictionary;
  cardIsUnique: BooleanDictionary;
  cardHasWhenPlayed: BooleanDictionary;
  cardHasWhenDefeated: BooleanDictionary;
  cardAspects: StringDictionary;
  cardTraits: StringDictionary;
  cardArena: StringDictionary;
};

export type CardDbGenerationSummary = {
  generatedAt: string;
  generatedFilePaths: string[];
  processedCards: number;
  fetchedPages: number;
  dictionaryCount: number;
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

function createEmptyDictionaries(): CardDictionaries {
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
    const numeric = Number.parseInt(numStr, 10);
    const numericCandidates = Number.isFinite(numeric)
      ? [String(numeric), String(numeric).padStart(2, "0"), numStr]
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

  return `${setCode}_${String(normalizedCardNumber).padStart(3, "0")}`;
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

function renderGeneratedModule(dictionaries: CardDictionaries, summary: Omit<CardDbGenerationSummary, "generatedFilePaths">): string {
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

  return `// This file is auto-generated by /internal/zzCardCodeGenerator.\n// Do not edit by hand. Re-run the generator instead.\n\n${dictionaryExports}\n${getterExports}\n${getAllCardIdsExport}\nexport const cardDbGenerationMetadata = {\n  generatedAt: ${JSON.stringify(summary.generatedAt)},\n  processedCards: ${summary.processedCards},\n  fetchedPages: ${summary.fetchedPages},\n  dictionaryCount: ${summary.dictionaryCount},\n} as const;\n`;
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

  return `${setCode}_${String(normalizedCardNumber).padStart(3, "0")}`;
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

function populateDictionaries(cardId: string, attributes: SwuCardAttributes, dictionaries: CardDictionaries): void {
  assignStringValue(dictionaries.cardTitle, cardId, attributes.title ?? "");
  assignStringValue(dictionaries.cardSubtitle, cardId, attributes.subtitle ?? "");
  assignStringValue(dictionaries.cardText, cardId, attributes.text ?? "");
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

  const cardText = attributes.text ?? "";
  if (/When Played/i.test(cardText)) {
    dictionaries.cardHasWhenPlayed[cardId] = true;
  }

  if (/When Defeated:/i.test(cardText)) {
    dictionaries.cardHasWhenDefeated[cardId] = true;
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

type ResolvedCardsResult = {
  resolvedCardAttributes: Map<string, SwuCardAttributes>;
  resolvedCardOverrides: Record<string, string>;
  processedCards: number;
  fetchedPages: number;
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

  const resolvedCardOverrides = await writeGeneratedOverridesModuleAsync(promoOverridesByCardId);

  return {
    resolvedCardAttributes,
    resolvedCardOverrides,
    processedCards,
    fetchedPages: currentPage - 1,
  };
}

async function imageFileExistsAsync(filePath: string): Promise<boolean> {
  try {
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


async function generateCardDbFromResolvedCardsAsync(
  resolvedCardAttributes: Map<string, SwuCardAttributes>,
  resolvedCardOverrides: Record<string, string>,
  processedCards: number,
  fetchedPages: number,
): Promise<CardDbGenerationSummary> {
  const dictionaries = createEmptyDictionaries();

  for (const [cardId, attributes] of resolvedCardAttributes.entries()) {
    populateDictionaries(cardId, attributes, dictionaries);
  }

  applyCardOverridesToDictionaries(dictionaries, resolvedCardOverrides);

  const summaryBase = {
    generatedAt: new Date().toISOString(),
    processedCards,
    fetchedPages,
    dictionaryCount: Object.keys(dictionaries).length,
  };

  await writeFile(GENERATED_MODULE_PATH, renderGeneratedModule(dictionaries, summaryBase), "utf8");

  return {
    ...summaryBase,
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
  await mkdir(GENERATED_CARD_IMAGE_FULL_DIR, { recursive: true });
  await mkdir(GENERATED_CARD_IMAGE_SQUARE_DIR, { recursive: true });

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

    const frontAlreadyExists = await imageFileExistsAsync(
      path.join(GENERATED_CARD_IMAGE_FULL_DIR, `${cardId}.webp`),
    );
    if (frontAlreadyExists) {
      summary.skipped += 1;
      continue;
    }

    const isLeader = getRelationValue(attributes.type, "name") === "Leader";
    const { setCode: cardSetCode, numStr: cardNumStr } = parseCardNumStr(cardId);
    const { swudbSetCode, swudbCardNumCandidates } = getSwudbPathParts(cardSetCode, cardNumStr);
    const frontUrls = swudbCardNumCandidates.map((candidate) => `${SWUDB_CDN_BASE}/${swudbSetCode}/${candidate}.png`);

    let frontBuffer: Buffer | null = null;
    try {
      ({ buffer: frontBuffer } = await fetchFirstAvailableImageBuffer(frontUrls));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackImageFailure(summary, cardId, `Front image download failed: ${message}`);
    }

    if (frontBuffer) {
      try {
        await writeFullImageAsync(frontBuffer, `${cardId}.webp`);
        summary.generatedFull += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trackImageFailure(summary, cardId, `Front full image generation failed: ${message}`);
      }

      try {
        await writeSquareImageAsync(frontBuffer, `${cardId}.webp`);
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
    if (isLeader) {
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
      await writeFullImageAsync(backBuffer, `${cardId}_BACK.webp`);
      summary.generatedBackFull += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackImageFailure(summary, cardId, `Back full image generation failed: ${message}`);
    }

    try {
      await writeSquareImageAsync(backBuffer, `${cardId}_BACK.webp`);
      summary.generatedBackSquare += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackImageFailure(summary, cardId, `Back square image generation failed: ${message}`);
    }
  }


  return summary;
}

export async function generateCardDbAsync(): Promise<CardDbGenerationSummary> {
  const { resolvedCardAttributes, resolvedCardOverrides, processedCards, fetchedPages } = await fetchResolvedCardsAsync();
  return generateCardDbFromResolvedCardsAsync(resolvedCardAttributes, resolvedCardOverrides, processedCards, fetchedPages);
}

export async function generateCardImagesAsync(): Promise<CardImageGenerationSummary> {
  const { resolvedCardAttributes, fetchedPages } = await fetchResolvedCardsAsync();
  return generateCardImagesFromResolvedCardsAsync(resolvedCardAttributes, fetchedPages);
}

export async function generateCardAssetsAsync(): Promise<CardAssetsGenerationSummary> {
  const { resolvedCardAttributes, resolvedCardOverrides, processedCards, fetchedPages } = await fetchResolvedCardsAsync();

  const [cardDb, images] = await Promise.all([
    generateCardDbFromResolvedCardsAsync(resolvedCardAttributes, resolvedCardOverrides, processedCards, fetchedPages),
    generateCardImagesFromResolvedCardsAsync(resolvedCardAttributes, fetchedPages),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    fetchedPages,
    cardDb,
    images,
  };
}