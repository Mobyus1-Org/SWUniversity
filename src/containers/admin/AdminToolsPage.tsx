import React from "react";

type AdminUser = {
  username: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
};

type UserSortKey = "username" | "email" | "role" | "createdAt";
type SortDir = "asc" | "desc";

export default function AdminToolsPage() {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<UserSortKey>("createdAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [previewUsers, setPreviewUsers] = React.useState<string[]>([]);
  const [newPreviewUser, setNewPreviewUser] = React.useState("");
  const [previewError, setPreviewError] = React.useState("");
  const [isMutating, setIsMutating] = React.useState(false);

  React.useEffect(() => {
    void fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch(() => setUsers([]));
    void fetch("/api/admin/preview-users", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setPreviewUsers(Array.isArray(data.previewUsers) ? data.previewUsers : []))
      .catch(() => setPreviewUsers([]));
  }, []);

  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return users;
    return users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const sortedUsers = React.useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;
    return [...filteredUsers].sort((a, b) => {
      if (sortKey === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mul;
      }
      return a[sortKey].localeCompare(b[sortKey]) * mul;
    });
  }, [filteredUsers, sortKey, sortDir]);

  const handleSortClick = (key: UserSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortLabel = (key: UserSortKey, label: string) =>
    key === sortKey ? `${label} ${sortDir === "asc" ? "↑" : "↓"}` : label;

  const addPreviewUser = async () => {
    const username = newPreviewUser.trim();
    if (username === "") return;
    setIsMutating(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/admin/preview-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPreviewError(data.error || "Failed to add preview user.");
        return;
      }
      setPreviewUsers(Array.isArray(data.previewUsers) ? data.previewUsers : []);
      setNewPreviewUser("");
    } catch {
      setPreviewError("Failed to add preview user.");
    } finally {
      setIsMutating(false);
    }
  };

  const removePreviewUser = async (username: string) => {
    setIsMutating(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/admin/preview-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPreviewError(data.error || "Failed to remove preview user.");
        return;
      }
      setPreviewUsers(Array.isArray(data.previewUsers) ? data.previewUsers : []);
    } catch {
      setPreviewError("Failed to remove preview user.");
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 space-y-8">
      <h1 className="text-3xl font-semibold">Admin Tools</h1>

      <section className="border rounded-lg bg-black/30 p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Registered Users</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username or email"
          className="w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
        />
        <p className="text-sm text-gray-400">{filteredUsers.length} of {users.length} users</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/15 text-gray-300">
                <th className="py-2 pr-4">
                  <button type="button" onClick={() => handleSortClick("username")} className="font-semibold hover:text-white">
                    {sortLabel("username", "Username")}
                  </button>
                </th>
                <th className="py-2 pr-4">
                  <button type="button" onClick={() => handleSortClick("email")} className="font-semibold hover:text-white">
                    {sortLabel("email", "Email")}
                  </button>
                </th>
                <th className="py-2 pr-4">
                  <button type="button" onClick={() => handleSortClick("role")} className="font-semibold hover:text-white">
                    {sortLabel("role", "Role")}
                  </button>
                </th>
                <th className="py-2 pr-4">
                  <button type="button" onClick={() => handleSortClick("createdAt")} className="font-semibold hover:text-white">
                    {sortLabel("createdAt", "Joined")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.username} className="border-b border-white/10">
                  <td className="py-2 pr-4 font-semibold">{user.username}</td>
                  <td className="py-2 pr-4 text-gray-300">{user.email}</td>
                  <td className="py-2 pr-4">{user.role}</td>
                  <td className="py-2 pr-4 text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && <p className="mt-3 text-sm text-gray-400">No users match your search.</p>}
        </div>
      </section>

      <section className="border rounded-lg bg-black/30 p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Preview Users</h2>
        <p className="text-sm text-gray-400">Usernames here get early access to Puzzles.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPreviewUser}
            onChange={(e) => setNewPreviewUser(e.target.value)}
            placeholder="Username to grant preview access"
            className="flex-1 rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void addPreviewUser()}
            disabled={isMutating || newPreviewUser.trim() === ""}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {previewError && <p className="text-red-300 text-sm">{previewError}</p>}
        {previewUsers.length === 0 ? (
          <p className="text-sm text-gray-400">No preview users yet.</p>
        ) : (
          <ul className="space-y-2">
            {previewUsers.map((username) => (
              <li key={username} className="flex items-center justify-between rounded border border-white/15 bg-black/20 px-3 py-2">
                <span className="font-semibold">{username}</span>
                <button
                  type="button"
                  onClick={() => void removePreviewUser(username)}
                  disabled={isMutating}
                  className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500/35 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
