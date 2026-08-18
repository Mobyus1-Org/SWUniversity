import { describe, expect, it } from "vitest";

import { renderInlineMarkup } from "@/util/func";

/**
 * React elements are plain objects, so the render tree can be inspected without a DOM. These walk
 * it and report the tags/classes/text a fragment produces — enough to pin the markup grammar even
 * though the project has no browser test environment.
 */
type Node = { type?: unknown; props?: { className?: string; children?: unknown; alt?: string } };

function walk(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") { out.push(node); return out; }
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) { node.forEach(n => walk(n, out)); return out; }
  const el = node as Node;
  const tag = typeof el.type === "string" ? el.type : null;
  if (tag === "img") { out.push(`<img alt=${el.props?.alt}>`); return out; }
  if (tag && tag !== "span") out.push(`<${tag}>`);
  if (el.props?.className?.includes("text-red-400")) out.push("[red]");
  if (el.props?.className?.includes("text-red-300")) out.push("[power]");
  if (el.props?.className?.includes("text-blue-300")) out.push("[hp]");
  walk(el.props?.children, out);
  return out;
}

const render = (s: string) => walk(renderInlineMarkup(s)).join("");

describe("renderInlineMarkup — %{…} attention token", () => {
  it("renders bold AND red", () => {
    expect(render("%{Sentinel}")).toBe("<strong>[red]Sentinel");
  });

  it("works on arbitrary text, not just keywords", () => {
    expect(render("%{read this bit}")).toBe("<strong>[red]read this bit");
  });

  it("keeps the surrounding text plain", () => {
    expect(render("before %{loud} after")).toBe("before <strong>[red]loud after");
  });

  it("handles several tokens in one line", () => {
    expect(render("%{one} and %{two}")).toBe("<strong>[red]one and <strong>[red]two");
  });

  it("leaves an unclosed token as literal text", () => {
    expect(render("a %{unclosed here")).toBe("a %{unclosed here");
  });

  it("does not span across a closing brace", () => {
    expect(render("%{a} plain %{b}")).toContain("plain");
  });

  it("renders an empty token literally rather than as an empty bold run", () => {
    expect(render("%{}")).toBe("%{}");
  });

  it("does not treat a bare percentage as a token", () => {
    expect(render("deals 50% of its power, up to 20% more")).toBe("deals 50% of its power, up to 20% more");
  });
});

describe("renderInlineMarkup — the existing grammar still holds", () => {
  it("**bold** is bold and NOT red", () => {
    expect(render("**Sentinel**")).toBe("<strong>Sentinel");
  });

  it("a bare keyword is plain text — no hard-coded colouring left", () => {
    expect(render("it gains Sentinel this phase")).toBe("it gains Sentinel this phase");
  });

  it("_italic_ is emphasis", () => {
    expect(render("_word_")).toBe("<em>word");
  });

  it("**_nested_** is both", () => {
    expect(render("**_word_**")).toBe("<strong><em>word");
  });

  it("+X/+Y still colours power and HP", () => {
    expect(render("gets +2/+3 now")).toContain("[power]");
    expect(render("gets +2/+3 now")).toContain("[hp]");
  });

  it("an aspect name still renders as its icon", () => {
    expect(render("_Heroism_")).toBe("<img alt=Heroism>");
  });

  it("single asterisks are not emphasis", () => {
    expect(render("*NOT*")).toBe("*NOT*");
  });
});
