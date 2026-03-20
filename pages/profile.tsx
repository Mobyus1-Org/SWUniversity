import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { UserProfile } from "@/util/profile-api";
import { deriveProfileStats, type DerivedAppStats } from "@/util/profile-data";

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

function AppStatsSection({ title, stats }: { title: string; stats: DerivedAppStats }) {
  return (
    <details className="rounded border border-white/15 bg-black/20 p-4" open>
      <summary className="cursor-pointer text-lg font-semibold">{title}</summary>
      <div className="mt-4 space-y-2 text-sm text-gray-200">
        <p><span className="font-semibold">Padawan:</span> {formatScore(stats.difficultyBreakdown.padawan.correct)} / {formatScore(stats.difficultyBreakdown.padawan.total)} ({stats.difficultyBreakdown.padawan.total > 0 ? ((stats.difficultyBreakdown.padawan.correct / stats.difficultyBreakdown.padawan.total) * 100).toFixed(2) : "0"}%)</p>
        <p><span className="font-semibold">Knight:</span> {formatScore(stats.difficultyBreakdown.knight.correct)} / {formatScore(stats.difficultyBreakdown.knight.total)} ({stats.difficultyBreakdown.knight.total > 0 ? ((stats.difficultyBreakdown.knight.correct / stats.difficultyBreakdown.knight.total) * 100).toFixed(2) : "0"}%)</p>
        <p><span className="font-semibold">Master:</span> {formatScore(stats.difficultyBreakdown.master.correct)} / {formatScore(stats.difficultyBreakdown.master.total)} ({stats.difficultyBreakdown.master.total > 0 ? ((stats.difficultyBreakdown.master.correct / stats.difficultyBreakdown.master.total) * 100).toFixed(2) : "0"}%)</p>
        <p><span className="font-semibold">Standard Runs Completed:</span> {stats.standardRunsCompleted}</p>
        <p><span className="font-semibold">Iron Man Completions:</span> {stats.ironManCompletions}</p>
      </div>
    </details>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [user, setUser] = React.useState<MeResponse["user"]>(null);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const loadUser = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });
      const data = (await response.json()) as MeResponse;
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUser();
  }, [loadUser]);

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

  if (isLoading) {
    return <div className="max-w-md mx-auto mt-8 p-6">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg bg-black/30 space-y-3">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p>You need to log in first.</p>
        <Link href="/login" className="underline">Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 p-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="border rounded-lg bg-black/30 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
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
            <p className="text-sm text-gray-300">No badges earned yet.</p>
          )}
        </div>

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
      </div>

      <div className="border rounded-lg bg-black/30 p-6 space-y-4 h-fit">
        <h2 className="text-2xl font-semibold">Stats</h2>
        <div className="rounded border border-white/15 bg-black/20 p-4 space-y-2 text-sm">
          <p><span className="font-semibold">Total Questions Answered:</span> {formatScore(profileStats.totalAnswered)}</p>
          <p><span className="font-semibold">Total Questions Correct:</span> {formatScore(profileStats.totalCorrect)}</p>
          <p><span className="font-semibold">Overall Percent Accuracy:</span> {profileStats.totalAnswered > 0 ? ((profileStats.totalCorrect / profileStats.totalAnswered) * 100).toFixed(2) : "0"}%</p>
        </div>
        <AppStatsSection title="Quiz Stats" stats={profileStats.quiz} />
        <AppStatsSection title="Do You Know SWU Stats" stats={profileStats.dykswu} />
      </div>
    </div>
  );
}
