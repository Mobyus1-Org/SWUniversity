import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type MeResponse = {
  user: {
    id: string;
    username: string;
    email: string;
    role: "user" | "admin";
  } | null;
};

type ApiResponse = {
  error?: string;
};

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
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg bg-black/30 space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="text-sm space-y-1">
        <p><span className="font-semibold">Username:</span> {user.username}</p>
        <p><span className="font-semibold">Email:</span> {user.email}</p>
        <p><span className="font-semibold">Role:</span> {user.role}</p>
      </div>

      <h2 className="text-xl font-semibold">Change Password</h2>
      <form className="space-y-4" onSubmit={onChangePassword}>
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
  );
}
