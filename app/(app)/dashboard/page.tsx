import { getAllAccounts, getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { db } from "@/lib/db";
import { upload_history } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import Link from "next/link";

export default async function DashboardPage() {
  const [allAccounts, activeId] = await Promise.all([
    getAllAccounts(),
    getActiveAccountId(),
  ]);

  const accountId = activeId ?? allAccounts[0]?.id ?? null;

  if (!accountId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <pre className="text-[#555] text-xs font-mono text-center">
          {`  ╔══════════════════╗\n  ║  sin cuentas     ║\n  ╚══════════════════╝`}
        </pre>
        <p className="text-[#888] text-sm font-mono">Conectá una cuenta para empezar.</p>
        <a href="/connect" className="text-[#3b82f6] text-sm font-mono hover:underline">→ /connect</a>
      </div>
    );
  }

  const [activeAccount, recentHistory, statsRows] = await Promise.all([
    getAccountById(accountId),
    db
      .select()
      .from(upload_history)
      .where(eq(upload_history.account_id, accountId))
      .orderBy(desc(upload_history.created_at))
      .limit(10),
    db
      .select({
        result: upload_history.result,
        count: sql<number>`count(*)::int`,
      })
      .from(upload_history)
      .where(eq(upload_history.account_id, accountId))
      .groupBy(upload_history.result),
  ]);

  const totalUploads = statsRows.reduce((s, r) => s + r.count, 0);
  const successCount = statsRows.find((r) => r.result === "success")?.count ?? 0;
  const errorCount = statsRows.find((r) => r.result === "error")?.count ?? 0;

  const tokenExpiresAt = activeAccount?.token_expires_at;
  const daysLeft = tokenExpiresAt
    ? Math.ceil((new Date(tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-semibold text-[#f5f5f5]">Dashboard</h1>
        <p className="text-[#555] text-sm font-mono mt-1">
          {activeAccount?.name} · {activeAccount?.ad_account_id}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Total uploads</p>
          <p className="text-2xl font-mono font-semibold text-[#f5f5f5] mt-1">{totalUploads}</p>
        </div>
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Exitosos</p>
          <p className="text-2xl font-mono font-semibold text-[#10b981] mt-1">{successCount}</p>
        </div>
        <div className="border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest">Errores</p>
          <p className="text-2xl font-mono font-semibold text-[#ef4444] mt-1">{errorCount}</p>
        </div>
      </div>

      {/* Token expiry warning */}
      {daysLeft !== null && daysLeft <= 14 && (
        <div className={`border rounded-md px-4 py-3 ${
          daysLeft <= 3
            ? "border-[#ef4444]/30 bg-[#ef4444]/5"
            : "border-[#f59e0b]/30 bg-[#f59e0b]/5"
        }`}>
          <p className={`text-xs font-mono ${daysLeft <= 3 ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>
            Token expira en {daysLeft} día{daysLeft !== 1 ? "s" : ""}.{" "}
            <Link href="/connect" className="underline">Reconectá la cuenta.</Link>
          </p>
        </div>
      )}

      {/* Recent activity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs text-[#555] uppercase tracking-widest">Actividad reciente</h2>
          {recentHistory.length > 0 && (
            <Link href="/history" className="text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa]">
              Ver todo →
            </Link>
          )}
        </div>
        {recentHistory.length === 0 ? (
          <p className="text-[#555] text-sm font-mono">Sin actividad aún.</p>
        ) : (
          <div className="border border-[#2a2a2a] rounded-md divide-y divide-[#2a2a2a]">
            {recentHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-mono text-[#f5f5f5] truncate">{h.ad_name ?? h.ad_id}</p>
                  <p className="text-xs font-mono text-[#555]">
                    {h.adset_name ?? h.adset_id} ·{" "}
                    {h.created_at
                      ? new Date(h.created_at).toLocaleString("es-AR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })
                      : ""}
                  </p>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ml-4 ${
                  h.result === "success"
                    ? "text-[#10b981] bg-[#10b981]/10"
                    : "text-[#ef4444] bg-[#ef4444]/10"
                }`}>
                  {h.result === "success" ? "ok" : "error"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
