import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type LoginResponse = {
  error?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          rememberMe,
        }),
      });

      const data = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setError(data.error || "Unable to sign in.");
        return;
      }

      await router.push("/");
    } catch {
      setError("Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg bg-black/30">
      <h1 className="text-2xl font-semibold mb-4">Log In</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="block mb-1">Username</span>
          <input
            className="input input-bordered w-full"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="block mb-1">Password</span>
          <input
            type="password"
            className="input input-bordered w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          <span>Remember Me</span>
        </label>

        <p className="text-xs text-gray-300">
          If enabled, an authentication cookie will be stored in your browser so your session can persist.
        </p>

        {error && <p className="text-red-300 text-sm">{error}</p>}

        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Log In"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        Need an account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
      <p className="mt-2 text-sm">
        Forgot your password? <Link href="/forgot-password" className="underline">Request a reset code</Link>
      </p>
    </div>
  );
}
