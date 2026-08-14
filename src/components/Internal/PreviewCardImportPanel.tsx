import React from "react";

import type { MockCard } from "@/server/engine/card-db/card-mocks";
import type { PreviewSetRow, PreviewSetRowStatus } from "@/server/engine/card-db/preview-client";

const STATUS_STYLES: Record<PreviewSetRowStatus, { label: string; className: string }> = {
  official: { label: "official", className: "border-gray-400 bg-gray-200 text-gray-700" },
  mocked: { label: "mocked", className: "border-sky-500 bg-sky-100 text-sky-800" },
  new: { label: "new", className: "border-emerald-500 bg-emerald-100 text-emerald-800" },
};

const TEXT_FIELDS: Array<{ key: keyof MockCard; label: string; hint?: string }> = [
  { key: "title", label: "Title" },
  { key: "subtitle", label: "Subtitle" },
  { key: "type", label: "Type", hint: "Leader | Base | Unit | Event | Upgrade" },
  { key: "type2", label: "Type 2", hint: "Unit for a leader; Leader marks a double-sided leader. Not in the source — fill this in." },
  { key: "arena", label: "Arena", hint: "Ground | Space, or empty" },
  { key: "rarity", label: "Rarity" },
  { key: "set", label: "Set" },
];

const NUMBER_FIELDS: Array<{ key: keyof MockCard; label: string }> = [
  { key: "cost", label: "Cost" },
  { key: "power", label: "Power" },
  { key: "hp", label: "HP" },
  { key: "upgradePower", label: "Upgrade Power" },
  { key: "upgradeHp", label: "Upgrade HP" },
];

const AREA_FIELDS: Array<{ key: keyof MockCard; label: string }> = [
  { key: "text", label: "Text" },
  { key: "epicAction", label: "Epic Action" },
  { key: "leaderUnitText", label: "Deployed Side Text" },
];

const inputClass = "w-full rounded border border-gray-400 bg-white px-2 py-1 text-sm text-gray-900";

export default function PreviewCardImportPanel() {
  const [link, setLink] = React.useState("");
  const [cardId, setCardId] = React.useState("");
  const [draft, setDraft] = React.useState<MockCard | null>(null);
  const [mocks, setMocks] = React.useState<Record<string, MockCard>>({});
  const [setCode, setSetCode] = React.useState("");
  const [setRows, setSetRows] = React.useState<PreviewSetRow[]>([]);
  const [hideNonImportable, setHideNonImportable] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const loadMocks = React.useCallback(async () => {
    const response = await fetch("/api/internal/card-mocks", { credentials: "include" });
    if (response.ok) {
      const payload = (await response.json()) as { mocks: Record<string, MockCard> };
      setMocks(payload.mocks);
    }
  }, []);

  React.useEffect(() => {
    void loadMocks();
  }, [loadMocks]);

  const importFromLink = React.useCallback(async (targetLink: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/internal/preview-card", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: targetLink }),
      });
      const payload = (await response.json()) as { cardId?: string; mock?: MockCard; error?: string };
      if (!response.ok || !payload.mock || !payload.cardId) {
        setDraft(null);
        setError(payload.error ?? "Unable to import preview card.");
        return;
      }
      setCardId(payload.cardId);
      setDraft(payload.mock);
    } catch {
      setDraft(null);
      setError("Unable to import preview card.");
    } finally {
      setBusy(false);
    }
  }, []);

  const importCard = React.useCallback(() => importFromLink(link), [importFromLink, link]);

  /** Keeps a listed row's badge in step after a save or delete, without re-fetching the set. */
  const markSetRowStatus = React.useCallback((targetCardId: string, status: PreviewSetRowStatus) => {
    setSetRows((current) => current.map((row) => (row.cardId === targetCardId ? { ...row, status } : row)));
  }, []);

  const listSet = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/internal/preview-set?set=${encodeURIComponent(setCode)}`, {
        credentials: "include",
      });
      const payload = (await response.json()) as { rows?: PreviewSetRow[]; error?: string };
      if (!response.ok || !payload.rows) {
        setSetRows([]);
        setError(payload.error ?? "Unable to list previewed cards for that set.");
        return;
      }
      setSetRows(payload.rows);
    } catch {
      setSetRows([]);
      setError("Unable to list previewed cards for that set.");
    } finally {
      setBusy(false);
    }
  }, [setCode]);

  const saveMock = React.useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/internal/card-mocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, mock: draft }),
      });
      const payload = (await response.json()) as { mocks?: Record<string, MockCard>; error?: string };
      if (!response.ok || !payload.mocks) {
        setError(payload.error ?? "Unable to save mock.");
        return;
      }
      setMocks(payload.mocks);
      markSetRowStatus(cardId, "mocked");
      setDraft(null);
      setCardId("");
      setLink("");
    } finally {
      setBusy(false);
    }
  }, [cardId, draft, markSetRowStatus]);

  const deleteMock = React.useCallback(async (targetCardId: string) => {
    if (!window.confirm(`Delete the mock for ${targetCardId} and its mock_ art files?`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/internal/card-mocks", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: targetCardId }),
      });
      const payload = (await response.json()) as { mocks?: Record<string, MockCard>; error?: string };
      if (response.ok && payload.mocks) {
        setMocks(payload.mocks);
        markSetRowStatus(targetCardId, "new");
      } else {
        setError(payload.error ?? "Unable to delete mock.");
      }
    } finally {
      setBusy(false);
    }
  }, [markSetRowStatus]);

  const setField = React.useCallback((key: keyof MockCard, value: string | number | boolean | null | string[]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  return (
    <div className="space-y-4 rounded border border-gray-500 bg-gray-200 p-5 text-gray-900">
      <div>
        <h2 className="text-xl font-semibold">Preview Card Import</h2>
        <p className="mt-1 text-sm">
          Paste a swudb card link to mock a previewed card. Review every field before saving — the
          source is unofficial and the normalizer can mangle unusual markup. After saving, re-run the
          generator above to build dictionaries and download art.
        </p>
      </div>

      <div className="space-y-2 rounded border border-gray-400 bg-gray-100 p-4">
        <p className="text-sm font-medium">Browse a set</p>
        <p className="text-xs text-gray-600">
          Lists every previewed card in a set so you can find one without hunting for its number.
          Only the Normal printing group is shown — the Hyperspace, Showcase and Prestige groups are
          alternate art of the same cards.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={setCode}
            onChange={(event) => setSetCode(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && setCode.trim() !== "") void listSet(); }}
            placeholder="HMW"
            className={`${inputClass} max-w-[12rem]`}
          />
          <button
            type="button"
            onClick={listSet}
            disabled={busy || setCode.trim() === ""}
            className="rounded border border-gray-400 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            List Set
          </button>
          {setRows.length > 0 ? (
            <>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hideNonImportable}
                  onChange={(event) => setHideNonImportable(event.target.checked)}
                />
                Only show cards worth importing
              </label>
              <span className="text-xs text-gray-600">
                {setRows.filter((row) => row.status === "new").length} new ·{" "}
                {setRows.filter((row) => row.status === "mocked").length} mocked ·{" "}
                {setRows.filter((row) => row.status === "official").length} official
              </span>
            </>
          ) : null}
        </div>

        {setRows.length > 0 ? (
          <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto">
            {setRows
              .filter((row) => !hideNonImportable || row.status !== "official")
              .map((row) => (
                <li key={row.cardId} className="flex items-center gap-3 rounded border border-gray-300 bg-white px-2 py-1 text-sm">
                  {row.imageUrl ? (
                    <img src={row.imageUrl} alt="" className="h-10 w-10 rounded object-cover object-top" />
                  ) : (
                    <span className="h-10 w-10 rounded bg-gray-200" />
                  )}
                  <span className="font-mono text-xs">{row.cardNumber}</span>
                  <span className="flex-1 truncate">{row.cardName}</span>
                  <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLES[row.status].className}`}>
                    {STATUS_STYLES[row.status].label}
                  </span>
                  <button
                    type="button"
                    onClick={() => void importFromLink(`${row.cardId.split("_")[0]}/${row.cardNumber}`)}
                    disabled={busy}
                    className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-60"
                  >
                    {row.status === "mocked" ? "Re-import" : "Import"}
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://swudb.com/card/HMW/004  or  HMW/4"
          className={`${inputClass} max-w-xl flex-1`}
        />
        <button
          type="button"
          onClick={importCard}
          disabled={busy || link.trim() === ""}
          className="rounded border border-gray-400 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Import
        </button>
      </div>

      {error ? <p className="rounded border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {draft ? (
        <div className="space-y-4 rounded border border-gray-400 bg-gray-100 p-4">
          <p className="font-mono text-sm font-semibold">{cardId}</p>

          <div className="flex flex-wrap gap-4">
            {draft.imageUrl ? <img src={draft.imageUrl} alt="Front art" className="h-64 w-auto rounded" /> : null}
            {draft.imageUrlBack ? <img src={draft.imageUrlBack} alt="Back art" className="h-64 w-auto rounded" /> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="font-medium">{field.label}</span>
                {field.hint ? <span className="ml-1 text-xs text-gray-600">{field.hint}</span> : null}
                <input
                  type="text"
                  value={String(draft[field.key] ?? "")}
                  onChange={(event) => setField(field.key, event.target.value)}
                  className={inputClass}
                />
              </label>
            ))}
            {NUMBER_FIELDS.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="font-medium">{field.label}</span>
                <input
                  type="number"
                  value={draft[field.key] === null ? "" : String(draft[field.key])}
                  onChange={(event) => setField(field.key, event.target.value === "" ? null : Number(event.target.value))}
                  className={inputClass}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="font-medium">Aspects</span>
              <span className="ml-1 text-xs text-gray-600">comma separated</span>
              <input
                type="text"
                value={draft.aspects.join(", ")}
                onChange={(event) => setField("aspects", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Traits</span>
              <span className="ml-1 text-xs text-gray-600">comma separated</span>
              <input
                type="text"
                value={draft.traits.join(", ")}
                onChange={(event) => setField("traits", event.target.value.split(",").map((v) => v.trim()).filter(Boolean))}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.unique} onChange={(event) => setField("unique", event.target.checked)} />
              <span className="font-medium">Unique</span>
            </label>
          </div>

          {AREA_FIELDS.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="font-medium">{field.label}</span>
              <textarea
                value={String(draft[field.key] ?? "")}
                onChange={(event) => setField(field.key, event.target.value)}
                rows={3}
                className={`${inputClass} font-mono`}
              />
            </label>
          ))}

          <button
            type="button"
            onClick={saveMock}
            disabled={busy}
            className="rounded border border-gray-400 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save Mock
          </button>
        </div>
      ) : null}

      <div>
        <p className="font-semibold">Existing Mocks ({Object.keys(mocks).length})</p>
        {Object.keys(mocks).length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {Object.entries(mocks).map(([mockCardId, mock]) => (
              <li key={mockCardId} className="flex items-center justify-between gap-3 rounded border border-gray-400 bg-gray-100 px-3 py-2">
                <span>
                  <span className="font-mono">{mockCardId}</span> — {mock.title}
                  {mock.subtitle ? `, ${mock.subtitle}` : ""}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setCardId(mockCardId); setDraft(mock); }}
                    className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteMock(mockCardId)}
                    disabled={busy}
                    className="rounded border border-red-400 px-2 py-1 text-xs text-red-800 hover:bg-red-50 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-700">No mocks. Import a previewed card above.</p>
        )}
      </div>
    </div>
  );
}
