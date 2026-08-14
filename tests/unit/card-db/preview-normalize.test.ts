import { describe, it, expect } from "vitest";
import {
  normalizePreviewText,
  previewTraitList,
  PREVIEW_ASPECTS,
  PREVIEW_CARD_TYPES,
  PREVIEW_ARENAS,
  PREVIEW_RARITIES,
} from "@/server/engine/card-db/preview-normalize";

describe("normalizePreviewText — paragraphs and paired tags", () => {
  it("joins paragraphs with newlines and strips bold", () => {
    expect(normalizePreviewText("{p}{b}On Attack:{/b} Deal 1 damage.{/p}"))
      .toBe("On Attack: Deal 1 damage.");
  });

  it("splits multiple paragraphs onto separate lines", () => {
    expect(normalizePreviewText("{p}First.{/p}\n{p}Second.{/p}"))
      .toBe("First.\nSecond.");
  });

  it("keeps the contents of a paired trait tag", () => {
    expect(normalizePreviewText("{p}Choose a {trait}Kashyyyk{/trait} unit.{/p}"))
      .toBe("Choose a Kashyyyk unit.");
  });

  it("resolves nested paired tags", () => {
    expect(normalizePreviewText("{p}{b}Deal 1 to a {trait}Spy{/trait} unit{/b}.{/p}"))
      .toBe("Deal 1 to a Spy unit.");
  });

  it("never leaks an unbalanced closing tag into card text", () => {
    expect(normalizePreviewText("{p}Broken {/trait} text.{/p}")).toBe("Broken text.");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizePreviewText("   ")).toBe("");
  });
});

describe("normalizePreviewText — icon tags", () => {
  it("capitalizes a bare icon tag", () => {
    expect(normalizePreviewText("{p}The next {imperial} unit.{/p}"))
      .toBe("The next Imperial unit.");
  });

  it("renders a valued keyword tag as name plus value", () => {
    expect(normalizePreviewText("{p}{restore:2}{/p}")).toBe("Restore 2");
  });

  it("renders a valued keyword tag inside prose", () => {
    expect(normalizePreviewText("{p}{raid:1} {i}(This unit gets +1/+0 while attacking.){/i}{/p}"))
      .toBe("Raid 1 (This unit gets +1/+0 while attacking.)");
  });
});

describe("normalizePreviewText — cost tokens are bracket-context sensitive", () => {
  it("leaves an exhaust token bare inside an existing cost list", () => {
    expect(normalizePreviewText("{p}{b}Action [{T}]:{/b} Attack with a unit.{/p}"))
      .toBe("Action [Exhaust]: Attack with a unit.");
  });

  it("brackets a resource token standing alone in prose", () => {
    expect(normalizePreviewText("{p}It costs {R5} less.{/p}"))
      .toBe("It costs [5 resources] less.");
  });

  it("uses the singular noun for a single resource", () => {
    expect(normalizePreviewText("{p}It costs {R1} less.{/p}"))
      .toBe("It costs [1 resource] less.");
  });

  it("leaves a resource token bare inside an existing cost list", () => {
    expect(normalizePreviewText("{p}{b}Action [{R1}, {T}]:{/b} Draw a card.{/p}"))
      .toBe("Action [1 resource, Exhaust]: Draw a card.");
  });
});

describe("normalizePreviewText — epic action", () => {
  it("synthesizes the Epic Action label the source only implies", () => {
    const raw = "{p}Do a thing.{/p}\n{p-epic-action}If you control 8 or more resources, deploy this leader.{/p}";
    expect(normalizePreviewText(raw))
      .toBe("Do a thing.\nEpic Action: If you control 8 or more resources, deploy this leader.");
  });
});

describe("normalizePreviewText — spacing", () => {
  it("inserts the space the source omits before a parenthetical", () => {
    expect(normalizePreviewText("{p}{fortify}{i}(Attach to a base.){/i}{/p}"))
      .toBe("Fortify (Attach to a base.)");
  });
});

describe("previewTraitList", () => {
  it("trims the leading spaces the source emits", () => {
    expect(previewTraitList(["Mandalorian", " Trooper"])).toEqual(["Mandalorian", "Trooper"]);
  });

  it("splits a comma-joined element into separate traits", () => {
    expect(previewTraitList(["Imperial, Official"])).toEqual(["Imperial", "Official"]);
  });

  it("drops empty entries and duplicates", () => {
    expect(previewTraitList(["Spy", "", "Spy"])).toEqual(["Spy"]);
  });

  it("returns an empty list for a missing field", () => {
    expect(previewTraitList(undefined)).toEqual([]);
  });
});

describe("enum maps", () => {
  it("maps card types", () => {
    expect(PREVIEW_CARD_TYPES[0]).toBe("Leader");
    expect(PREVIEW_CARD_TYPES[2]).toBe("Unit");
    expect(PREVIEW_CARD_TYPES[3]).toBe("Event");
    expect(PREVIEW_CARD_TYPES[4]).toBe("Upgrade");
  });

  it("maps arenas", () => {
    expect(PREVIEW_ARENAS[0]).toBe("Ground");
    expect(PREVIEW_ARENAS[1]).toBe("Space");
  });

  // 1 is Aggression and 2 is Command, NOT the other way round. Guessing the intuitive order
  // silently mislabels every mono-Command and mono-Aggression card.
  it("maps aspects in the source's order, not the intuitive one", () => {
    expect(PREVIEW_ASPECTS[1]).toBe("Aggression");
    expect(PREVIEW_ASPECTS[2]).toBe("Command");
    expect(PREVIEW_ASPECTS[3]).toBe("Cunning");
    expect(PREVIEW_ASPECTS[4]).toBe("Vigilance");
    expect(PREVIEW_ASPECTS[5]).toBe("Heroism");
    expect(PREVIEW_ASPECTS[6]).toBe("Villainy");
  });

  it("maps rarities", () => {
    expect(PREVIEW_RARITIES[3]).toBe("Rare");
    expect(PREVIEW_RARITIES[5]).toBe("Special");
  });
});
