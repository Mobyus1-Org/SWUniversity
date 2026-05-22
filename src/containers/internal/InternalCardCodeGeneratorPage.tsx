import React from "react";

import { globalBackgroundStyle } from "@/util/style-const";

type GenerationResult = {
  generatedAt: string;
  generatedFilePaths: string[];
  processedCards: number;
  fetchedPages: number;
  dictionaryCount: number;
};

type ImageGenerationResult = {
  generatedAt: string;
  attempted: number;
  fetchedPages: number;
  generatedFull: number;
  generatedSquare: number;
  generatedBackFull: number;
  generatedBackSquare: number;
  skipped: number;
  failed: Array<{
    cardId: string;
    reason: string;
  }>;
  outputDirectories: string[];
};

type CombinedGenerationResult = {
  generatedAt: string;
  fetchedPages: number;
  cardDb: GenerationResult;
  images: ImageGenerationResult;
};

export default function InternalCardCodeGeneratorPage() {
  const [generatorLoading, setGeneratorLoading] = React.useState(false);
  const [generatorError, setGeneratorError] = React.useState("");
  const [generatorResult, setGeneratorResult] = React.useState<CombinedGenerationResult | null>(null);

  const runGenerator = React.useCallback(async () => {
    setGeneratorLoading(true);
    setGeneratorError("");

    try {
      const response = await fetch("/api/internal/zz-card-code-generator", {
        method: "POST",
        credentials: "include",
      });

      const payload = (await response.json()) as CombinedGenerationResult | { error?: string };
      if (!response.ok) {
        setGeneratorResult(null);
        setGeneratorError(("error" in payload ? payload.error : undefined) ?? "Unable to generate SWU cards and images.");
        return;
      }

      setGeneratorResult(payload as CombinedGenerationResult);
    } catch {
      setGeneratorResult(null);
      setGeneratorError("Unable to generate SWU cards and images.");
    } finally {
      setGeneratorLoading(false);
    }
  }, []);

  return (
    <div className={`${globalBackgroundStyle} m-4 h-[80vh] overflow-y-auto border p-6 4k:m-8 4k:p-10`}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-100">SWU Internal Generators</h1>
            <p className="mt-1 text-sm text-gray-300">
              Local-dev-only admin tools that fetch official SWU API data for code dictionaries and image assets in one run.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runGenerator}
              className="inline-flex items-center gap-2 rounded border border-gray-400 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={generatorLoading}
            >
              {generatorLoading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"
                    aria-hidden="true"
                  />
                  Generating...
                </>
              ) : "Fetch SWU Cards + Images"}
            </button>
          </div>
        </div>

        {generatorError ? <div className="rounded border border-red-500 bg-red-950/40 p-4 text-red-200">{generatorError}</div> : null}

        {generatorLoading ? (
          <div className="rounded border border-sky-400 bg-sky-950/40 p-5 text-sky-100">
            <div className="flex items-center gap-3">
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-sky-200 border-t-transparent"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">Generating card dictionaries and images</p>
                <p className="mt-1 text-sm text-sky-100/85">
                  The SWU API fetch and image processing can take a bit. This page is still working.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded border border-gray-500 bg-gray-200 p-5 text-gray-900">
          <p className="font-semibold">Output</p>
          <p className="mt-2 text-sm">Generated files are written to <span className="font-mono">src/server/engine/card-db</span>.</p>
          <p className="mt-2 text-sm">Generated images are written to <span className="font-mono">public/assets/cards/full</span> and <span className="font-mono">public/assets/cards/square</span>.</p>
          <p className="mt-2 text-sm">This route is intentionally limited to local development.</p>
        </div>

        {generatorResult ? (
          <div className="space-y-4 rounded border border-gray-500 bg-gray-200 p-5 text-gray-900">
            <h2 className="text-xl font-semibold">Combined Generator Run</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Processed Cards</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.cardDb.processedCards}</p>
              </div>
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Fetched Pages</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.fetchedPages}</p>
              </div>
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Dictionaries</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.cardDb.dictionaryCount}</p>
              </div>
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Generated At</p>
                <p className="mt-1 text-sm font-semibold">{new Date(generatorResult.generatedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Generated Full</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.images.generatedFull}</p>
              </div>
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Generated Square</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.images.generatedSquare}</p>
              </div>
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Generated Back Full</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.images.generatedBackFull}</p>
              </div>
              <div className="rounded border border-gray-400 bg-gray-100 p-4">
                <p className="text-sm text-gray-700">Generated Back Square</p>
                <p className="mt-1 text-2xl font-semibold">{generatorResult.images.generatedBackSquare}</p>
              </div>
            </div>

            <div>
              <p className="font-semibold">Written Files</p>
              <ul className="mt-2 space-y-2 text-sm">
                {generatorResult.cardDb.generatedFilePaths.map((filePath) => (
                  <li key={filePath} className="rounded border border-gray-400 bg-gray-100 px-3 py-2 font-mono">
                    {filePath}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold">Image Output Directories</p>
              <ul className="mt-2 space-y-2 text-sm">
                {generatorResult.images.outputDirectories.map((directoryPath) => (
                  <li key={directoryPath} className="rounded border border-gray-400 bg-gray-100 px-3 py-2 font-mono">
                    {directoryPath}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold">Image Failures ({generatorResult.images.failed.length})</p>
              {generatorResult.images.failed.length > 0 ? (
                <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-sm">
                  {generatorResult.images.failed.map((failure, index) => (
                    <li key={`${failure.cardId}-${failure.reason}-${index}`} className="rounded border border-red-300 bg-red-50 px-3 py-2">
                      <span className="font-mono">{failure.cardId}</span>: {failure.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-700">No failures.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}