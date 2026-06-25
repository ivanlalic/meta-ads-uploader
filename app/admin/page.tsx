import { db } from "@/lib/db";
import { users, accounts, upload_history } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export default async function AdminPage() {
  const [totalUsers, totalAccounts, statsRows, userList] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users).then(r => r[0].count),
    db.select({ count: sql<number>`count(*)::int` }).from(accounts).then(r => r[0].count),
    db.select({
      result: upload_history.result,
      count: sql<number>`count(*)::int`,
    })
      .from(upload_history)
      .groupBy(upload_history.result),
    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      created_at: users.created_at,
      accountCount: sql<number>`(select count(*)::int from ${accounts} where ${accounts.user_id} = ${users.id})`,
    })
      .from(users)
      .orderBy(desc(users.created_at)),
  ]);

  const totalUploads = statsRows.reduce((s, r) => s + r.count, 0);
  const successCount = statsRows.find(r => r.result === "success")?.count ?? 0;
  const errorCount = statsRows.find(r => r.result === "error")?.count ?? 0;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-semibold text-[#f5f5f5]">Admin Dashboard</h1>
          <p className="text-[#555] text-sm font-mono mt-1">Panel de administración de la plataforma</p>
        </div>
        <a href="/dashboard" className="text-xs font-mono text-[#555] hover:text-[#888] underline">← Dashboard</a>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Usuarios</p>
          <p className="text-2xl font-mono font-semibold text-[#f5f5f5] mt-1">{totalUsers}</p>
        </div>
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Cuentas Meta</p>
          <p className="text-2xl font-mono font-semibold text-[#f5f5f5] mt-1">{totalAccounts}</p>
        </div>
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Uploads exitosos</p>
          <p className="text-2xl font-mono font-semibold text-[#10b981] mt-1">{successCount}</p>
        </div>
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Uploads fallidos</p>
          <p className="text-2xl font-mono font-semibold text-[#ef4444] mt-1">{errorCount}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Usuarios registrados</h2>
        {userList.length === 0 ? (
          <p className="text-sm font-mono text-[#555]">Sin usuarios aún</p>
        ) : (
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                <tr>
                  <th className="text-left px-4 py-3 text-[#555]">Nombre</th>
                  <th className="text-left px-4 py-3 text-[#555]">Email</th>
                  <th className="text-left px-4 py-3 text-[#555]">Rol</th>
                  <th className="text-left px-4 py-3 text-[#555]">Cuentas</th>
                  <th className="text-left px-4 py-3 text-[#555]">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-[#141414] transition-colors">
                    <td className="px-4 py-3 text-[#f5f5f5]">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[#aaa]">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        u.role === "admin" ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "bg-[#3b82f6]/10 text-[#3b82f6]"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#f5f5f5]">{u.accountCount}</td>
                    <td className="px-4 py-3 text-[#555]">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleString("es-AR", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
