import { getAllAccounts, getActiveAccountId } from "@/app/actions/accounts";
import { db } from "@/lib/db";
import { upload_history } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function DashboardPage() {
  const [allAccounts, activeId] = await Promise.all([
    getAllAccounts(),
    getActiveAccountId(),
  ]);

  const accountId = activeId ?? allAccounts[0]?.id ?? null;
  const recentHistory = accountId
    ? await db
        .select()
        .from(upload_history)
        .where(eq(upload_history.account_id, accountId))
        .orderBy(desc(upload_history.created_at))
        .limit(5)
    : [];

  if (!accountId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <pre className="text-[#555] text-xs font-mono text-center">
          {`  ╔══════════════════╗\n  ║  sin cuentas     ║\n  ╚══════════════════╝`}
        </pre>
        <p className="text-[#888] text-sm font-mono">
          Conectá una cuenta para empezar.
        </p>
        <a
          href="/connect"
          className="text-[#3b82f6] text-sm font-mono hover:underline"
        >
          → /connect
        </a>
      </div>
    );
  }

  const activeAccount = allAccounts.find((a) => a.id === accountId);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-semibold text-[#f5f5f5]">
          Dashboard
        </h1>
        <p className="text-[#555] text-sm font-mono mt-1">
          {activeAccount?.name} · {activeAccount?.ad_account_id}
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="font-mono text-xs text-[#555] uppercase tracking-widest">
          Actividad reciente
        </h2>
        {recentHistory.length === 0 ? (
          <p className="text-[#555] text-sm font-mono">Sin actividad aún.</p>
        ) : (
          <div className="border border-[#2a2a2a] rounded-md divide-y divide-[#2a2a2a]">
            {recentHistory.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-mono text-[#f5f5f5]">
                    {h.ad_name ?? h.ad_id}
                  </p>
                  <p className="text-xs font-mono text-[#555]">
                    {h.action} · {h.adset_name}
                  </p>
                </div>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    h.result === "success"
                      ? "text-[#10b981] bg-[#10b981]/10"
                      : "text-[#ef4444] bg-[#ef4444]/10"
                  }`}
                >
                  {h.result}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
