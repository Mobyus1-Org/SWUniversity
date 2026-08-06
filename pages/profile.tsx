import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { UserProfile } from "@/util/profile-api";
import { deriveProfileStats, type DerivedAppStats, type DatabankCompletion } from "@/util/profile-data";
import type { PuzzleSummary } from "./api/puzzles/summaries";

type MeResponse = {
  user: {
    id: string;
    username: string;
    email: string;
    role: "user" | "admin";
    profile: UserProfile | null;
  } | null;
};

type ApiResponse = {
  error?: string;
};

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pct(correct: number, total: number): string {
  return total > 0 ? ((correct / total) * 100).toFixed(2) : "0";
}

/**
 * Solved-puzzle progress, collapsed by default.
 *
 * Lists every puzzle the VIEWER may see, marking the ones this profile has solved, so the ratio
 * and the list always agree. The solved count is the intersection rather than the raw length of
 * `solvedPuzzleIds` — a puzzle that was deleted, or that the viewer can't see, would otherwise
 * push the count above the total and read as a bug.
 */
function PuzzleProgress({ solvedIds, summaries }: { solvedIds: string[]; summaries: PuzzleSummary[] | null }) {
  const solved = React.useMemo(() => new Set(solvedIds), [solvedIds]);
  const sorted = React.useMemo(
    () => (summaries ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [summaries],
  );

  if (summaries === null) {
    return <p className="text-sm text-gray-300">Loading puzzle progress…</p>;
  }
  if (sorted.length === 0) {
    return <p className="text-sm text-gray-300">No puzzles available.</p>;
  }

  const solvedCount = sorted.filter((p) => solved.has(p.id)).length;

  return (
    <details className="rounded border border-white/10 bg-black/20">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-gray-200">
        Puzzles Solved: {solvedCount} / {sorted.length} ({pct(solvedCount, sorted.length)}%)
      </summary>
      <ul className="max-h-80 overflow-y-auto border-t border-white/10 px-3 py-2 text-sm">
        {sorted.map((puzzle) => {
          const isSolved = solved.has(puzzle.id);
          return (
            <li key={puzzle.id} className={`flex items-center gap-2 py-0.5 ${isSolved ? "text-green-300" : "text-gray-400"}`}>
              <span aria-hidden className="w-4 shrink-0 text-center">{isSolved ? "✓" : "○"}</span>
              <span>{puzzle.name}</span>
              <span className="sr-only">{isSolved ? "solved" : "not solved"}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function DatabankRow({ label, stats }: { label: string; stats: { mastered: number; total: number } }) {
  return (
    <p>
      <span className="font-semibold">{label}:</span> {stats.mastered} / {stats.total} ({pct(stats.mastered, stats.total)}%)
    </p>
  );
}

function ModeStatsBoxes({ stats, databank }: { stats: DerivedAppStats; databank?: DatabankCompletion }) {
  return (
    <div className="space-y-4 text-sm text-gray-200">
      <div className="rounded border border-white/10 bg-black/20 p-3 space-y-1">
        <p className="font-semibold text-base">Standard</p>
        <p><span className="font-semibold">Runs Completed:</span> {stats.standardRunsCompleted}</p>
        <p><span className="font-semibold">Total Questions Answered:</span> {formatScore(stats.total)}</p>
        <p><span className="font-semibold">Total Questions Correct:</span> {formatScore(stats.correct)}</p>
        <p><span className="font-semibold">Overall Percent Accuracy:</span> {pct(stats.correct, stats.total)}%</p>
        <p><span className="font-semibold">Padawan:</span> {stats.difficultyBreakdown.padawan.correct} / {stats.difficultyBreakdown.padawan.total} ({pct(stats.difficultyBreakdown.padawan.correct, stats.difficultyBreakdown.padawan.total)}%)</p>
        <p><span className="font-semibold">Knight:</span> {stats.difficultyBreakdown.knight.correct} / {stats.difficultyBreakdown.knight.total} ({pct(stats.difficultyBreakdown.knight.correct, stats.difficultyBreakdown.knight.total)}%)</p>
        <p><span className="font-semibold">Master:</span> {stats.difficultyBreakdown.master.correct} / {stats.difficultyBreakdown.master.total} ({pct(stats.difficultyBreakdown.master.correct, stats.difficultyBreakdown.master.total)}%)</p>
      </div>
      <div className="rounded border border-white/10 bg-black/20 p-3 space-y-1">
        <p className="font-semibold text-base">Ironman</p>
        <p><span className="font-semibold">Runs Attempted:</span> {stats.ironManRunsAttempted}</p>
        <p><span className="font-semibold">Runs Completed:</span> {stats.ironManRunsCompleted}</p>
        <p><span className="font-semibold">Longest Run:</span> {stats.longestIronManRun}</p>
      </div>
      <div className="rounded border border-white/10 bg-black/20 p-3 space-y-1">
        <p className="font-semibold text-base">Databank Completion</p>
        {databank ? (
          <>
            <DatabankRow label="Padawan" stats={databank.padawan} />
            <DatabankRow label="Knight" stats={databank.knight} />
            <DatabankRow label="Master" stats={databank.master} />
          </>
        ) : (
          <p className="text-gray-400">Loading…</p>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  // Admin-only read-only view of someone else's profile: /profile?user=<username>
  const viewingUsername = typeof router.query.user === "string" ? router.query.user : "";
  const isViewingOther = viewingUsername !== "";
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [user, setUser] = React.useState<MeResponse["user"]>(null);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [showResetPuzzleConfirm, setShowResetPuzzleConfirm] = React.useState(false);
  const [resetPuzzleMessage, setResetPuzzleMessage] = React.useState("");
  const [resetPuzzleError, setResetPuzzleError] = React.useState("");
  const [isResettingPuzzles, setIsResettingPuzzles] = React.useState(false);
  const [resetPending, setResetPending] = React.useState<"quiz" | "dykswu" | null>(null);
  const [isResettingStats, setIsResettingStats] = React.useState(false);
  const [resetStatsError, setResetStatsError] = React.useState("");

  const loadUser = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const url = isViewingOther
        ? `/api/admin/user-profile?username=${encodeURIComponent(viewingUsername)}`
        : "/api/auth/me";
      const response = await fetch(url, { method: "GET", credentials: "include" });
      if (!response.ok) {
        // 403 (not an admin) or 404 (no such user) — show the empty state, never a partial profile.
        setUser(null);
        return;
      }
      const data = (await response.json()) as MeResponse;
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [isViewingOther, viewingUsername]);

  React.useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Puzzle names for the progress list. Independent of loadUser: the ids live on the profile,
  // the names do not, and this list is the same whichever profile is being viewed.
  const [puzzleSummaries, setPuzzleSummaries] = React.useState<PuzzleSummary[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/puzzles/summaries", { method: "GET", credentials: "include" });
        const data = res.ok ? ((await res.json()) as { puzzles: PuzzleSummary[] }) : { puzzles: [] };
        if (!cancelled) setPuzzleSummaries(data.puzzles);
      } catch {
        if (!cancelled) setPuzzleSummaries([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const profileStats = React.useMemo(() => deriveProfileStats(user?.profile ?? null), [user?.profile]);

  const onChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(data.error || "Unable to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed. Please log in again.");
      await router.push("/login");
    } catch {
      setError("Unable to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPuzzleCompletion = async () => {
    setIsResettingPuzzles(true);
    setResetPuzzleError("");
    setResetPuzzleMessage("");
    try {
      const response = await fetch("/api/profile/reset-puzzle-completion", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setResetPuzzleError(data.error || "Unable to reset puzzle completion.");
        return;
      }
      setResetPuzzleMessage("Puzzle completion reset.");
      setShowResetPuzzleConfirm(false);
    } catch {
      setResetPuzzleError("Unable to reset puzzle completion.");
    } finally {
      setIsResettingPuzzles(false);
    }
  };

  const onResetStats = async (app: "quiz" | "dykswu") => {
    setIsResettingStats(true);
    setResetStatsError("");
    try {
      const response = await fetch("/api/profile/reset-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ app }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setResetStatsError(data.error || "Unable to reset stats.");
        return;
      }
      setResetPending(null);
      await loadUser();
    } catch {
      setResetStatsError("Unable to reset stats.");
    } finally {
      setIsResettingStats(false);
    }
  };

  const renderResetStats = (app: "quiz" | "dykswu", label: string) => (
    <div className="mt-4">
      {resetPending === app ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 space-y-2">
          <p className="text-sm text-rose-200">This clears your {label} run history and Ironman stats. Databank Completion is kept. Are you sure?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onResetStats(app)}
              disabled={isResettingStats}
              className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500/35 disabled:opacity-50"
            >
              {isResettingStats ? "Resetting..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setResetPending(null)}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
          {resetStatsError && <p className="text-red-300 text-sm">{resetStatsError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setResetStatsError(""); setResetPending(app); }}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Reset {label} Stats
        </button>
      )}
    </div>
  );

  if (isLoading) {
    return <div className="max-w-md mx-auto mt-8 p-6">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg bg-black/30 space-y-3">
        <h1 className="text-2xl font-semibold">Profile</h1>
        {isViewingOther ? (
          <>
            <p>That profile could not be loaded. It may not exist, or you may not have access.</p>
            <Link href="/admin/tools" className="underline">Back to Admin Tools</Link>
          </>
        ) : (
          <>
            <p>You need to log in first.</p>
            <Link href="/login" className="underline">Go to Login</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 p-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="border rounded-lg bg-black/30 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          {isViewingOther && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
              <p className="text-sm text-amber-200">
                Viewing <span className="font-semibold">{viewingUsername}</span> — read only.
              </p>
              <Link href="/admin/tools" className="text-xs underline text-amber-200/80 hover:text-amber-100">
                Back to Admin Tools
              </Link>
            </div>
          )}
          <div className="mt-4 text-sm space-y-1">
            <p><span className="font-semibold">Username:</span> {user.username}</p>
            <p><span className="font-semibold">Email:</span> {user.email}</p>
            <p><span className="font-semibold">Role:</span> {user.role}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Badges</h2>
          {user.profile?.badgeDetails.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {user.profile.badgeDetails.map((badge) => (
                <div key={badge.id} className="flex items-center gap-3 rounded border border-white/15 bg-black/20 p-3">
                  <img
                    src={badge.img}
                    alt={badge.displayName}
                    className="h-16 w-16 rounded object-cover"
                  />
                  <div>
                    <p className="font-semibold">{badge.displayName}</p>
                    <p className="text-sm text-gray-300">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-300">Badges coming soon!</p>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold">Puzzles</h2>
          <div className="mt-4 space-y-3">
            {/* Progress is shown for whichever profile is being viewed; only the destructive
                reset below is restricted to your own. */}
            <PuzzleProgress solvedIds={user.profile?.solvedPuzzleIds ?? []} summaries={puzzleSummaries} />
          </div>
        </div>

        {!isViewingOther && (
        <div>
          <h2 className="text-xl font-semibold">Reset Puzzles</h2>
          <div className="mt-4 space-y-3">
            {showResetPuzzleConfirm ? (
              <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 space-y-3">
                <p className="text-sm text-rose-200">This will clear all solved puzzle records. Are you sure?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onResetPuzzleCompletion()}
                    disabled={isResettingPuzzles}
                    className="btn btn-sm rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500/35 disabled:opacity-50"
                  >
                    {isResettingPuzzles ? "Resetting..." : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetPuzzleConfirm(false)}
                    className="btn btn-sm rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setResetPuzzleMessage(""); setResetPuzzleError(""); setShowResetPuzzleConfirm(true); }}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Reset Puzzle Completion
              </button>
            )}
            {resetPuzzleError && <p className="text-red-300 text-sm">{resetPuzzleError}</p>}
            {resetPuzzleMessage && <p className="text-green-300 text-sm">{resetPuzzleMessage}</p>}
          </div>
        </div>
        )}

        {!isViewingOther && (
        <div>
          <h2 className="text-xl font-semibold">Change Password</h2>
          <form className="space-y-4 mt-4" onSubmit={onChangePassword}>
            <label className="block">
              <span className="block mb-1">Current Password</span>
              <input
                type="password"
                className="input input-bordered w-full"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="block">
              <span className="block mb-1">New Password</span>
              <input
                type="password"
                className="input input-bordered w-full"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {error && <p className="text-red-300 text-sm">{error}</p>}
            {message && <p className="text-green-300 text-sm">{message}</p>}

            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Change Password"}
            </button>
          </form>
        </div>
        )}
      </div>

      <div className="border rounded-lg bg-black/30 p-6 space-y-4 h-fit">
        <h2 className="text-2xl font-semibold">Stats</h2>
        <details className="rounded border border-white/15 bg-black/20 p-4" open>
          <summary className="cursor-pointer text-lg font-semibold">Quiz Mode</summary>
          <div className="mt-4">
            <ModeStatsBoxes stats={profileStats.quiz} databank={user.profile?.databankCompletion?.quiz} />
            {!isViewingOther && renderResetStats("quiz", "Quiz")}
          </div>
        </details>
        <details className="rounded border border-white/15 bg-black/20 p-4" open>
          <summary className="cursor-pointer text-lg font-semibold">Do You Know SWU Mode</summary>
          <div className="mt-4">
            <ModeStatsBoxes stats={profileStats.dykswu} databank={user.profile?.databankCompletion?.dykswu} />
            {!isViewingOther && renderResetStats("dykswu", "DYKSWU")}
          </div>
        </details>
      </div>
    </div>
  );
}
