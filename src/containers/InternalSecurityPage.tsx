import React from "react";

import { globalBackgroundStyle } from "@/util/style-const";

type SecurityReport = {
  activePepperVersion: string;
  totalUsers: number;
  usersOnActivePepperVersion: number;
  usersNotOnActivePepperVersion: number;
  usersWithoutPepperVersion: number;
  hasPreviousPepperConfigured: boolean;
  migrationWindowOpen: boolean;
};

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-gray-500 bg-gray-200 p-4">
      <p className="text-sm text-gray-700">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function InternalSecurityPage() {
  const [data, setData] = React.useState<SecurityReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/internal/security", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setData(null);
        setError("Unable to load security report.");
        return;
      }

      const payload = (await response.json()) as SecurityReport;
      setData(payload);
    } catch {
      setData(null);
      setError("Unable to load security report.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const allUsersOnActiveVersion = data ? data.usersNotOnActivePepperVersion === 0 : false;

  return (
    <div className={`${globalBackgroundStyle} m-4 h-[80vh] overflow-y-auto border p-6 4k:m-8 4k:p-10`}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-100">Security Report</h1>
            <p className="mt-1 text-sm text-gray-300">Internal admin diagnostics for pepper migration.</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded border border-gray-400 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-600"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? <div className="rounded border border-red-500 bg-red-950/40 p-4 text-red-200">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Users" value={data?.totalUsers ?? "-"} />
          <MetricCard label="Active Version" value={data?.activePepperVersion ?? "-"} />
          <MetricCard label="On Active Version" value={data?.usersOnActivePepperVersion ?? "-"} />
          <MetricCard label="Not On Active" value={data?.usersNotOnActivePepperVersion ?? "-"} />
          <MetricCard label="Prev Pepper Configured" value={data?.hasPreviousPepperConfigured ? "Yes" : "No"} />
        </div>

        {data ? (
          <div className="space-y-3 rounded border border-gray-500 bg-gray-200 p-5 text-gray-900">
            <p>
              <span className="font-semibold">Active pepper version:</span>{" "}
              {data.activePepperVersion}
            </p>
            <p>
              <span className="font-semibold">Migration window:</span>{" "}
              {data.migrationWindowOpen ? "Open" : "Closed"}
            </p>
            <p>
              <span className="font-semibold">Version alignment:</span>{" "}
              {allUsersOnActiveVersion
                ? "All users are on the active PEPPER_VERSION."
                : "Some users are still on older or missing versions. They migrate on successful login."}
            </p>
            <p>
              <span className="font-semibold">Missing version metadata:</span>{" "}
              {data.usersWithoutPepperVersion}
            </p>
            <p>
              <span className="font-semibold">Recommendation:</span>{" "}
              {data.migrationWindowOpen && allUsersOnActiveVersion
                ? "You can safely clear CRYPTO_PEPPER_PREVIOUS when ready."
                : "Keep CRYPTO_PEPPER_PREVIOUS configured until users not on active version have migrated."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
