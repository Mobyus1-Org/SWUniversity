import { describe, it, expect } from "vitest";
import {
  padPreviewCardNumber,
  parsePreviewLink,
  previewRecordToMock,
  type PreviewRecord,
} from "@/server/engine/card-db/preview-client";
import ash004 from "./fixtures/ash-004.json";
import {
  CardTitle,
  CardSubtitle,
  CardText,
  CardCost,
  CardHp,
  CardPower,
  CardRarity,
  CardIsUnique,
  CardAspects,
  CardTraits,
  CardArena,
  CardLeaderUnitText,
} from "@/server/engine/card-db/generated";

describe("padPreviewCardNumber", () => {
  it("pads an ordinary set to three digits", () => {
    expect(padPreviewCardNumber("ASH", "4")).toBe("004");
  });

  it("leaves an already-padded number alone", () => {
    expect(padPreviewCardNumber("ASH", "004")).toBe("004");
  });

  // Padding a two-digit set to three returns an EMPTY record from the endpoint rather than an
  // error, so this is the difference between "card not found" and a silent blank import.
  it("pads a two-digit set to two digits", () => {
    expect(padPreviewCardNumber("TS26", "9")).toBe("09");
    expect(padPreviewCardNumber("TS26", "012")).toBe("12");
  });
});

describe("parsePreviewLink", () => {
  it("parses a full swudb card URL", () => {
    expect(parsePreviewLink("https://swudb.com/card/HMW/004")).toEqual({ set: "HMW", number: "004" });
  });

  it("parses a URL with a trailing slash", () => {
    expect(parsePreviewLink("https://swudb.com/card/HMW/004/")).toEqual({ set: "HMW", number: "004" });
  });

  it("parses the bare shorthand and pads it", () => {
    expect(parsePreviewLink("HMW/4")).toEqual({ set: "HMW", number: "004" });
  });

  it("uppercases a lowercase set code", () => {
    expect(parsePreviewLink("hmw/4")).toEqual({ set: "HMW", number: "004" });
  });

  it("applies the two-digit rule for TS26", () => {
    expect(parsePreviewLink("TS26/9")).toEqual({ set: "TS26", number: "09" });
  });

  it("returns null for input with no set and number", () => {
    expect(parsePreviewLink("not a card link")).toBeNull();
  });
});

// ASH_004 is released, so the same card exists in both sources. Checking the mapping against our
// own dictionaries is the only way to test the enum maps against ground truth.
describe("previewRecordToMock — ground truth against our official dictionaries", () => {
  const mock = previewRecordToMock(ash004 as PreviewRecord);

  it("maps the name and subtitle", () => {
    expect(mock.title).toBe(CardTitle("ASH_004"));
    expect(mock.subtitle).toBe(CardSubtitle("ASH_004"));
  });

  it("maps the numeric stats", () => {
    expect(mock.cost).toBe(CardCost("ASH_004"));
    expect(mock.power).toBe(CardPower("ASH_004"));
    expect(mock.hp).toBe(CardHp("ASH_004"));
  });

  it("decodes the card type enum", () => {
    expect(mock.type).toBe("Leader");
  });

  it("decodes the arena enum", () => {
    expect(mock.arena).toBe(CardArena("ASH_004"));
  });

  it("decodes the aspect enums", () => {
    expect(mock.aspects).toEqual(CardAspects("ASH_004"));
  });

  it("cleans the trait list", () => {
    expect(mock.traits).toEqual(CardTraits("ASH_004"));
  });

  // The top-level rarity field is null on some products; the real value lives on the
  // alternativePrintings row flagged isCurrent.
  it("reads rarity from the current printing row, not the top level", () => {
    expect(mock.rarity).toBe(CardRarity("ASH_004"));
  });

  it("maps uniqueness", () => {
    expect(mock.unique).toBe(CardIsUnique("ASH_004"));
  });

  it("reproduces the front text and epic action, which our dictionary stores joined", () => {
    expect(`${mock.text}\n${mock.epicAction}`).toBe(CardText("ASH_004"));
  });

  it("reproduces the deployed side's text", () => {
    expect(mock.leaderUnitText).toBe(CardLeaderUnitText("ASH_004"));
  });

  it("builds absolute art URLs from the source image paths", () => {
    expect(mock.imageUrl).toBe("https://swudb.com/cdn-cgi/image/quality=95/images/cards/ASH/004.png");
    expect(mock.imageUrlBack).toBe("https://swudb.com/cdn-cgi/image/quality=95/images/cards/ASH/004-back.png");
  });

  // The source carries the LEADER side's name and traits alongside the DEPLOYED side's stats. It
  // has no second-side type at all, so the human supplies it in the review form.
  it("leaves type2 empty for the human to fill in", () => {
    expect(mock.type2).toBe("");
  });
});

describe("previewRecordToMock — empty and missing fields", () => {
  it("returns nulls rather than zeros for absent stats", () => {
    const mock = previewRecordToMock({ cardName: "Nothing" } as PreviewRecord);
    expect(mock.cost).toBeNull();
    expect(mock.power).toBeNull();
    expect(mock.hp).toBeNull();
    expect(mock.upgradePower).toBeNull();
    expect(mock.upgradeHp).toBeNull();
  });

  it("returns an empty arena when the card has none", () => {
    const mock = previewRecordToMock({ cardName: "Event", arena: null } as PreviewRecord);
    expect(mock.arena).toBe("");
  });

  it("returns empty art URLs when the source has no image paths", () => {
    const mock = previewRecordToMock({ cardName: "Nothing" } as PreviewRecord);
    expect(mock.imageUrl).toBe("");
    expect(mock.imageUrlBack).toBe("");
  });
});
