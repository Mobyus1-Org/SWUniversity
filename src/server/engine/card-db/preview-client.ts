import type { MockCard } from "@/server/engine/card-db/card-mocks";
import {
  PREVIEW_ARENAS,
  PREVIEW_ASPECTS,
  PREVIEW_CARD_TYPES,
  PREVIEW_RARITIES,
  normalizePreviewText,
  previewTraitList,
} from "@/server/engine/card-db/preview-normalize";

const SWU_PREVIEW_API = "https://swudb.com/api/card";
const SWU_PREVIEW_IMAGE_BASE = "https://swudb.com/cdn-cgi/image/quality=95/images";

// Kept in step with TWO_DIGIT_CARD_NUMBER_SETS in generator.ts. A number padded to three digits for
// one of these sets returns an EMPTY record from the endpoint rather than an error.
const TWO_DIGIT_PREVIEW_SETS = new Set(["TS26"]);

const EPIC_ACTION_LABEL = "Epic Action: ";

/** A raw record as returned by swudb's getPrintingInfo. Untyped on purpose — external shape. */
export type PreviewRecord = Record<string, unknown>;

export function padPreviewCardNumber(setCode: string, cardNumber: string): string {
  const width = TWO_DIGIT_PREVIEW_SETS.has(setCode.toUpperCase()) ? 2 : 3;
  const stripped = cardNumber.replace(/^0+/, "");
  const digits = stripped === "" ? "0" : stripped;
  return digits.padStart(width, "0");
}

/** "https://swudb.com/card/HMW/004" or "HMW/4" -> { set: "HMW", number: "004" } */
export function parsePreviewLink(link: string): { set: string; number: string } | null {
  const match = /([A-Z0-9]{2,5})\s*\/\s*(\d{1,3})\s*\/?$/i.exec(link.trim());
  if (!match) {
    return null;
  }

  const set = match[1].toUpperCase();
  return { set, number: padPreviewCardNumber(set, match[2]) };
}

function readString(record: PreviewRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNumber(record: PreviewRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

/** This printing's own row inside alternativePrintings, which carries the rarity the top level omits. */
function currentPrinting(record: PreviewRecord): PreviewRecord {
  const printings = record.alternativePrintings;
  if (!Array.isArray(printings)) {
    return {};
  }

  for (const printing of printings) {
    if (printing && typeof printing === "object" && (printing as PreviewRecord).isCurrent) {
      return printing as PreviewRecord;
    }
  }

  return {};
}

function imageUrl(imagePath: string): string {
  return imagePath === "" ? "" : `${SWU_PREVIEW_IMAGE_BASE}${imagePath}`;
}

export function previewRecordToMock(record: PreviewRecord): MockCard {
  const printing = currentPrinting(record);

  const aspectValues = Array.isArray(record.aspects) ? record.aspects : [];
  const aspects = aspectValues
    .map((aspect) => (typeof aspect === "number" ? PREVIEW_ASPECTS[aspect] : undefined))
    .filter((aspect): aspect is string => typeof aspect === "string");

  const cardTypeValue = readNumber(record, "cardType");
  const arenaValue = readNumber(record, "arena");
  const rarityValue = readNumber(record, "rarity") ?? readNumber(printing, "rarity");

  // The front text blob holds the card's own ability AND its epic action. Normalization labels the
  // epic-action paragraph, so split on that label to fill the two fields the way the official API
  // delivers them.
  let text = normalizePreviewText(readString(record, "frontAbilityText"));
  let epicAction = "";
  const epicIndex = text.indexOf(EPIC_ACTION_LABEL);
  if (epicIndex !== -1) {
    epicAction = text.slice(epicIndex).trim();
    text = text.slice(0, epicIndex).trim();
  }

  return {
    title: readString(record, "cardName"),
    subtitle: readString(record, "title"),
    type: cardTypeValue === null ? "" : (PREVIEW_CARD_TYPES[cardTypeValue] ?? ""),
    // The source has no second-side type; the review form supplies it.
    type2: "",
    arena: arenaValue === null ? "" : (PREVIEW_ARENAS[arenaValue] ?? ""),
    cost: readNumber(record, "cost"),
    power: readNumber(record, "power"),
    hp: readNumber(record, "hitPoints"),
    upgradePower: readNumber(record, "powerBonus"),
    upgradeHp: readNumber(record, "hitPointBonus"),
    aspects,
    traits: previewTraitList(record.traits),
    text,
    epicAction,
    leaderUnitText: normalizePreviewText(readString(record, "backAbilityText")),
    unique: record.isUnique === true,
    rarity: rarityValue === null ? "" : (PREVIEW_RARITIES[rarityValue] ?? ""),
    set: readString(printing, "expansionAbbreviation").toUpperCase(),
    imageUrl: imageUrl(readString(record, "frontImagePath")),
    imageUrlBack: imageUrl(readString(record, "backImagePath")),
  };
}

/** One previewed printing in a set, enough to find and import it. */
export type PreviewSetEntry = {
  cardId: string;
  cardNumber: string;
  cardName: string;
  imageUrl: string;
};

/**
 * `official` — already in the generated dictionaries, so it needs no mock at all.
 * `mocked`   — already has an entry in card-mocks.json.
 * `new`      — previewed but not yet available here; this is what you import.
 */
export type PreviewSetRowStatus = "official" | "mocked" | "new";

export type PreviewSetRow = PreviewSetEntry & {
  status: PreviewSetRowStatus;
};

/**
 * Every previewed printing in a set, from a getSetInfo payload.
 *
 * Only the `Normal` printing group is read. The response also carries Hyperspace, Hyperfoil,
 * Showcase, Prestige and Prestige Foil groups, which are alternate art of the SAME cards — reading
 * them would offer six duplicate rows per card, all resolving to one card number.
 */
export function previewSetListFromResponse(setCode: string, payload: PreviewRecord): PreviewSetEntry[] {
  const groups = payload.printingGroups;
  if (!Array.isArray(groups)) {
    return [];
  }

  const normalGroup = groups.find(
    (group) => group && typeof group === "object" && (group as PreviewRecord).header === "Normal",
  ) as PreviewRecord | undefined;

  const printings = normalGroup?.printings;
  if (!Array.isArray(printings)) {
    return [];
  }

  const set = setCode.toUpperCase();
  const entries: PreviewSetEntry[] = [];

  for (const printing of printings) {
    if (!printing || typeof printing !== "object") {
      continue;
    }

    const record = printing as PreviewRecord;
    const rawNumber = readString(record, "cardNumber");
    if (rawNumber === "") {
      continue;
    }

    // The endpoint returns numbers unpadded in places, so build the id through the padder.
    const cardNumber = padPreviewCardNumber(set, rawNumber);
    entries.push({
      cardId: `${set}_${cardNumber}`,
      cardNumber,
      cardName: readString(record, "cardName"),
      imageUrl: imageUrl(readString(record, "frontImagePath")),
    });
  }

  return entries;
}

/** Every previewed printing in a set. `language` is REQUIRED — omitting it returns HTTP 400. */
export async function fetchPreviewSetListAsync(setCode: string): Promise<PreviewSetEntry[]> {
  const response = await fetch(`${SWU_PREVIEW_API}/getSetInfo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expansionAbbreviation: setCode.toUpperCase(),
      language: "en",
      pageNumber: 1,
      pageSize: 500,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object") {
    return [];
  }

  return previewSetListFromResponse(setCode, payload as PreviewRecord);
}

/**
 * One card's full record. `language` is REQUIRED — omitting it returns HTTP 400. The number is
 * padded to its SET's width before the call.
 */
export async function fetchPreviewCardAsync(setCode: string, cardNumber: string): Promise<PreviewRecord | null> {
  const response = await fetch(`${SWU_PREVIEW_API}/getPrintingInfo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expansionAbbreviation: setCode.toUpperCase(),
      cardNumber: padPreviewCardNumber(setCode, cardNumber),
      isFoil: false,
      language: "en",
      stamp: null,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as PreviewRecord;
  // An unknown card number returns 200 with an empty record rather than a 404.
  return typeof record.cardName === "string" && record.cardName !== "" ? record : null;
}
