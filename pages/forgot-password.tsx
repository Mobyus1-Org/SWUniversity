import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type ForgotPasswordResponse = {
  error?: string;
  message?: string;
};

type ResetPasswordResponse = {
  ok?: boolean;
  error?: string;
};

const REQUEST_CODE_COOLDOWN_SECONDS = 30;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [step, setStep] = React.useState<"request" | "verify">("request");
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = React.useState(false);
  const [cooldownSeconds, setCooldownSeconds] = React.useState(0);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (router.query.step === "verify") {
      setStep("verify");
    }
  }, [router.query.step]);

  React.useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownSeconds]);

  const requestCode = async () => {
    if (!username || !email) {
      setError("Username and email are required.");
      return;
    }

    if (cooldownSeconds > 0) {
      return;
    }

    setIsSubmittingRequest(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, email }),
      });

      const data = (await response.json()) as ForgotPasswordResponse;
      if (!response.ok) {
        setError(data.error || "Unable to submit request.");
        return;
      }

      setMessage(data.message || "If the account details are valid, a reset code has been sent.");
      setStep("verify");
      setCooldownSeconds(REQUEST_CODE_COOLDOWN_SECONDS);
    } catch {
      setError("Unable to submit request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const onRequestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await requestCode();
  };

  const onResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingReset(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
          code,
          newPassword,
        }),
      });

      const data = (await response.json()) as ResetPasswordResponse;
      if (!response.ok) {
        setError(data.error || "Unable to reset password.");
        return;
      }

      setMessage("Password reset successful. Redirecting to login...");
      setTimeout(() => {
        void router.push("/login");
      }, 900);
    } catch {
      setError("Unable to reset password.");
    } finally {
      setIsSubmittingReset(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg bg-black/30">
      <h1 className="text-2xl font-semibold mb-4">Reset Password</h1>
      <p className="text-sm text-gray-300 mb-4">
        Enter username and email, then use the 6-digit code to set a new password.
      </p>

      <form className="space-y-4" onSubmit={onRequestCode}>
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
          <span className="block mb-1">Email</span>
          <input
            type="email"
            className="input input-bordered w-full"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        {step === "request" && (
          <button type="submit" className="btn btn-primary w-full" disabled={isSubmittingRequest}>
            {isSubmittingRequest ? "Sending code..." : "Send Reset Code"}
          </button>
        )}
      </form>

      {step === "verify" && (
        <form className="space-y-4 mt-4" onSubmit={onResetPassword}>
          <label className="block">
            <span className="block mb-1">6-digit code</span>
            <input
              className="input input-bordered w-full"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>

          <label className="block">
            <span className="block mb-1">New password</span>
            <input
              type="password"
              className="input input-bordered w-full"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <button type="submit" className="btn btn-primary w-full" disabled={isSubmittingReset}>
            {isSubmittingReset ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}

      {step === "verify" && (
        <p className="mt-4 text-sm">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            className="underline disabled:opacity-50"
            onClick={() => {
              void requestCode();
            }}
            disabled={cooldownSeconds > 0 || isSubmittingRequest}
          >
            {cooldownSeconds > 0
              ? `Request a new code (${cooldownSeconds}s)`
              : (isSubmittingRequest ? "Requesting..." : "Request a new code")}
          </button>
        </p>
      )}

        {error && <p className="text-red-300 text-sm">{error}</p>}
        {message && <p className="text-green-300 text-sm">{message}</p>}
      <p className="mt-2 text-sm">
        Back to <Link href="/login" className="underline">Log in</Link>
      </p>
    </div>
  );
}