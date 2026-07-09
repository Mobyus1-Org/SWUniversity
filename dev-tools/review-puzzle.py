#!/usr/bin/env python3
"""Review a puzzle from MongoDB: fetch it, and list the cards you actually need
to implement for it in single-player (P1) puzzle mode.

Given a puzzle name, this fetches the puzzle document from the `puzzles`
collection and reports every distinct card, flagging two kinds of gap:
  - UNIMPLEMENTED — has ability text but its card id never appears in
    src/server/engine/.
  - PARTIALLY IMPLEMENTED — its id appears ONLY in a keyword dictionary
    (card-db/keyword-dictionaries.ts/), so only a keyword is wired, yet its text
    has non-keyword clauses (triggers, actions, static buffs) that need per-card
    code. This catches e.g. a leader whose Overwhelm is wired but its Action
    ability and stat buff are not.
It then narrows both to the cards that can actually fire during P1's turn.

Reachability model (a 1-turn P1 puzzle):
    RELEVANT — P1 card in hand / in play (ground or space) / leader / base(with an
               ability); P2 card in play / base / leader ONLY if it has a
               defender-side or constant ability (Sentinel, On Defense, When
               Defeated, Shielded, Grit, or a "While…"/affects-enemy passive).
    SKIP     — P1 resources or deck (inert / not drawn); any P2 card in hand /
               deck / resources; a P2 in-play card whose only abilities are
               attacker/on-play (On Attack, When Played, Ambush, "completes an
               attack", …) since P2 never attacks in puzzle mode.

Usage:
    python3 dev-tools/review-puzzle.py "This is Where the Fun Begins!"
    python3 dev-tools/review-puzzle.py "..." --json-only
    python3 dev-tools/review-puzzle.py "..." --no-json
    python3 dev-tools/review-puzzle.py "..." --save out.json

Reads MONGO_CONNECTION_STRING from the repo's .env file.
Requires pymongo (and certifi for Atlas TLS on macOS):  pip install pymongo certifi

Note: these are heuristics. Partial detection only catches the keyword-only case
(referenced solely in a keyword dictionary); a card referenced in a logic file for
one ability but missing another ability is NOT caught. The P2 relevance signals
are conservative and can over-surface (e.g. a P2 leader whose text merely mentions
"Sentinel" via an ability it grants). The tool never silently drops a card — every
gap is shown under TO IMPLEMENT, PARTIALLY IMPLEMENTED, or the skip list with a
reason, so you can override its judgment.
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_FILE = REPO / ".env"
GENERATED = REPO / "src/server/engine/card-db/generated.ts"
ENGINE_DIR = REPO / "src/server/engine"

# card-db files that are pure DATA (every card id appears in them), so they must
# not count as "the card is implemented".
DATA_FILE_NAMES = {"generated.ts", "overrides-generated.ts", "generator.ts"}

CARD_ID_TOKEN = re.compile(r"[A-Z]{2,4}\d{0,2}_[A-Z0-9]+")

# Zones scanned per player. base/leader are single objects, the rest are lists.
LIST_ZONES = ("groundArena", "spaceArena", "hand", "resources", "deck")
SINGLE_ZONES = ("base", "leader")
IN_PLAY = {"groundArena", "spaceArena"}


# ---------------------------------------------------------------------------
# .env / Mongo
# ---------------------------------------------------------------------------
def load_mongo_uri() -> str:
    if not ENV_FILE.is_file():
        sys.exit(f"No .env file found at {ENV_FILE}")
    for line in ENV_FILE.read_text().splitlines():
        m = re.match(r"^\s*MONGO_CONNECTION_STRING\s*=\s*(.*)$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    sys.exit("MONGO_CONNECTION_STRING not found in .env")


def fetch_puzzle(name: str) -> dict:
    try:
        from pymongo import MongoClient
    except ImportError:
        sys.exit("pymongo is not installed. Run: pip install pymongo")

    kwargs = {"serverSelectionTimeoutMS": 15000}
    try:  # certifi supplies CA certs so Atlas TLS verifies on macOS Python
        import certifi
        kwargs["tlsCAFile"] = certifi.where()
    except ImportError:
        pass

    client = MongoClient(load_mongo_uri(), **kwargs)
    try:
        coll = client.get_default_database()["puzzles"]
        doc = coll.find_one({"name": name}) or coll.find_one(
            {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
        )
        if doc is None:
            names = sorted(d.get("name", "") for d in coll.find({}, {"name": 1}))
            hint = "\n".join(f"  - {n}" for n in names)
            sys.exit(f'No puzzle named "{name}".\nAvailable puzzles:\n{hint}')
        doc["_id"] = str(doc["_id"])
        return doc
    finally:
        client.close()


# ---------------------------------------------------------------------------
# generated.ts card-data maps
# ---------------------------------------------------------------------------
def parse_ts_map(text: str, var_name: str) -> dict[str, str]:
    """Parse a flat `const <var_name>: Record<...> = { "ID": <value>, ... };` block."""
    start = text.find(f"const {var_name}")
    if start == -1:
        return {}
    brace = text.find("{", start)
    result: dict[str, str] = {}
    for line in text[brace:].splitlines()[1:]:
        if line.strip() == "};":
            break
        m = re.match(r'^\s*"([A-Za-z0-9_]+)"\s*:\s*(.*)$', line)
        if not m:
            continue
        key, raw = m.group(1), m.group(2).rstrip()
        if raw.endswith(","):
            raw = raw[:-1]
        if len(raw) >= 2 and raw[0] == '"' and raw[-1] == '"':
            try:  # TS string literals use JSON escaping; this keeps UTF-8 (→, ×) intact
                raw = json.loads(raw)
            except json.JSONDecodeError:
                raw = raw[1:-1]
        result[key] = raw
    return result


# ---------------------------------------------------------------------------
# Card placements + engine reference index
# ---------------------------------------------------------------------------
def card_placements(gamestate: dict) -> dict[str, set[tuple[str, str]]]:
    """cardId -> set of (player, zone). Upgrades inherit their unit's arena zone."""
    out: dict[str, set[tuple[str, str]]] = defaultdict(set)
    for player in ("player1", "player2"):
        p = gamestate.get(player) or {}
        for zone in LIST_ZONES:
            for card in (p.get(zone) or []):
                cid = card.get("cardId")
                if cid:
                    out[cid].add((player, zone))
                for up in (card.get("upgrades") or []):
                    uid = up.get("cardId")
                    if uid:
                        out[uid].add((player, zone))
        for zone in SINGLE_ZONES:
            card = p.get(zone) or {}
            cid = card.get("cardId")
            if cid:
                out[cid].add((player, zone))
    return out


def engine_reference_index() -> tuple[set[str], set[str]]:
    """Split card-id references in engine logic into (keyword_grant, ability_logic).

    keyword_grant: ids that appear only inside card-db/keyword-dictionaries.ts/ —
    i.e. the card is on a keyword allowlist but nothing else. ability_logic: ids in
    any other logic file (actions/, dispatch-listener, unit.ts, …) — a real ability.
    """
    keyword_refs: set[str] = set()
    logic_refs: set[str] = set()
    for path in ENGINE_DIR.rglob("*.ts"):
        if not path.is_file() or path.name in DATA_FILE_NAMES:
            continue
        ids = set(CARD_ID_TOKEN.findall(path.read_text(errors="ignore")))
        if "keyword-dictionaries.ts" in path.parts:
            keyword_refs |= ids
        else:
            logic_refs |= ids
    return keyword_refs, logic_refs


# SWU keyword tokens (optionally followed by a number, e.g. "Raid 2"). Used to tell
# keyword-only card text apart from real ability clauses.
KEYWORDS = ["Ambush", "Bounty", "Coordinate", "Grit", "Hidden", "Overwhelm",
            "Piloting", "Plot", "Raid", "Restore", "Saboteur", "Sentinel",
            "Shielded", "Smuggle", "Exploit"]


def nonkeyword_clauses(text: str) -> list[str]:
    """Lines of card text that remain after stripping keyword tokens and reminder
    text — i.e. real abilities (triggers, actions, static buffs) that need per-card code."""
    stripped_reminders = re.sub(r"\([^)]*\)", "", text)  # drop "(reminder text)"
    out = []
    for line in stripped_reminders.split("\n"):
        core = line.strip()
        prev = None
        while core != prev:  # peel leading keyword tokens (and separators) repeatedly
            prev = core
            for kw in KEYWORDS:
                m = re.match(rf"^{kw}(\s+\d+)?\b[\s,]*", core, re.IGNORECASE)
                if m:
                    core = core[m.end():].lstrip(" ,")
                    break
        if core.strip(" ,.—-"):  # anything substantive left → a real clause
            out.append(line.strip())
    return out


# ---------------------------------------------------------------------------
# Relevance model
# ---------------------------------------------------------------------------
def defender_signals(text: str, when_defeated: bool) -> list[str]:
    """Signals that a P2 card can still affect P1's turn while P2 is passive."""
    low = text.lower()
    sigs = []
    if "sentinel" in low:
        sigs.append("Sentinel")
    if "on defense" in low:
        sigs.append("On Defense")
    if "shielded" in low:
        sigs.append("Shielded")
    if "grit" in low:
        sigs.append("Grit")
    if when_defeated:
        sigs.append("When Defeated")
    if re.search(r"\benem(y|ies)\b", low):
        sigs.append("affects enemy")
    if re.search(r"(^|\n)\s*while\b", low):
        sigs.append("constant (While…)")
    return sigs


def reachability(places: set[tuple[str, str]], has_ability: bool,
                 d_signals: list[str]) -> tuple[list[str], str]:
    """Return (relevant_reasons, skip_reason). Reachable if relevant_reasons is non-empty."""
    reasons: list[str] = []
    sig = f" ({', '.join(d_signals)})" if d_signals else ""
    for player, zone in places:
        if player == "player1":
            if zone == "hand":
                reasons.append("P1 hand")
            elif zone in IN_PLAY:
                reasons.append("P1 in play")
            elif zone == "leader":
                reasons.append("P1 leader")
            elif zone == "base" and has_ability:
                reasons.append("P1 base")
        else:  # player2 — only if it has a defender/constant ability
            if d_signals and (zone in IN_PLAY or zone in SINGLE_ZONES):
                label = "P2 in play" if zone in IN_PLAY else f"P2 {zone}"
                reasons.append(label + sig)
    reasons = sorted(set(reasons))
    if reasons:
        return reasons, ""

    # Not reachable — build a readable reason from where it sits.
    places_str = ", ".join(sorted({f"{'P1' if pl == 'player1' else 'P2'} {z}"
                                   for pl, z in places}))
    if any(pl == "player2" and z in IN_PLAY for pl, z in places):
        return [], f"{places_str} — attacker/on-play only, no defender ability"
    return [], places_str


def analyze(doc: dict) -> None:
    gamestate = doc.get("initialGamestate", {})
    places = card_placements(gamestate)

    generated = GENERATED.read_text()
    titles = parse_ts_map(generated, "cardTitle")
    texts = parse_ts_map(generated, "cardText")
    leader_texts = parse_ts_map(generated, "cardLeaderUnitText")
    when_played = parse_ts_map(generated, "cardHasWhenPlayed")
    when_defeated = parse_ts_map(generated, "cardHasWhenDefeated")
    keyword_refs, logic_refs = engine_reference_index()

    to_implement, partial, skip, implemented, vanilla = [], [], [], [], []
    for cid in sorted(places):
        title = titles.get(cid, "?")
        # Leaders carry two texts: the leader ability (cardText) and the deployed
        # leader-unit ability (cardLeaderUnitText). Consider both.
        text = "\n".join(t for t in (texts.get(cid, "").strip(),
                                     leader_texts.get(cid, "").strip()) if t)
        wd = when_defeated.get(cid) == "true"
        markers = []
        if when_played.get(cid) == "true":
            markers.append("When Played")
        if wd:
            markers.append("When Defeated")
        has_ability = bool(text or markers)

        if not has_ability:
            vanilla.append((cid, title))
            continue
        if cid in logic_refs:
            implemented.append((cid, title))
            continue

        if cid in keyword_refs:
            # Referenced only in keyword dictionaries. If the text is more than
            # keywords, the non-keyword clauses are almost certainly unimplemented.
            clauses = nonkeyword_clauses(text)
            if not clauses:
                implemented.append((cid, title))  # purely keyword card, fully covered
                continue
            relevant, skip_reason = reachability(places[cid], has_ability,
                                                 defender_signals(text, wd))
            if relevant:
                partial.append((cid, title, clauses, ", ".join(relevant)))
            else:
                skip.append((cid, title, f"partial (keyword-only); {skip_reason}"))
            continue

        relevant, skip_reason = reachability(places[cid], has_ability,
                                             defender_signals(text, wd))
        if relevant:
            to_implement.append((cid, title, text, markers, ", ".join(relevant)))
        else:
            skip.append((cid, title, skip_reason))

    reachable = len(to_implement) + len(partial)
    print(f"\nCards in board state: {len(places)}  "
          f"(needs work: {len(to_implement)} missing + {len(partial)} partial "
          f"= {reachable} reachable)")

    if to_implement:
        print("\n⚠  TO IMPLEMENT (unimplemented AND reachable in P1's turn):")
        for cid, title, text, markers, where in to_implement:
            tag = f"  [{', '.join(markers)}]" if markers else ""
            print(f"\n  {cid}  {title}   ({where}){tag}")
            for line in text.split("\n"):
                print(f"      {line}")

    if partial:
        print("\n⚠  PARTIALLY IMPLEMENTED (reachable — only keyword(s) wired; "
              "these clauses look unimplemented):")
        for cid, title, clauses, where in partial:
            print(f"\n  {cid}  {title}   ({where})")
            for clause in clauses:
                print(f"      • {clause}")

    if skip:
        print("\n·  Not reachable this turn (skip):")
        for cid, title, reason in skip:
            print(f"  {cid}  {title:28} — {reason}")

    print(f"\n(implemented/referenced: {len(implemented)}, vanilla: {len(vanilla)})")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Review a puzzle from MongoDB and list the cards to implement for it."
    )
    parser.add_argument("name", help='puzzle name, e.g. "This is Where the Fun Begins!"')
    parser.add_argument("--json-only", action="store_true", help="print only the puzzle JSON")
    parser.add_argument("--no-json", action="store_true", help="skip printing the puzzle JSON")
    parser.add_argument("--save", type=Path, metavar="PATH", help="write the puzzle JSON to a file")
    args = parser.parse_args()

    doc = fetch_puzzle(args.name)
    pretty = json.dumps(doc, indent=2, ensure_ascii=False, default=str)

    if args.save:
        args.save.write_text(pretty)
        print(f"Wrote {args.save}")

    if args.json_only:
        print(pretty)
        return

    print(f'\n=== {doc.get("name")} ===')
    print(f'id: {doc["_id"]}   difficulty: {doc.get("difficulty")}   '
          f'author: {doc.get("author") or "—"}   deploy: {doc.get("deploy")}')
    if doc.get("description"):
        print(f'{doc["description"]}')

    analyze(doc)

    if not args.no_json:
        print("\n=== puzzle JSON ===")
        print(pretty)


if __name__ == "__main__":
    main()
