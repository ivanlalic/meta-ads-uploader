import { redirect } from "next/navigation";
import { getActiveAccountId } from "@/app/actions/accounts";
import { db } from "@/lib/db";
import { upload_history } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function HistoryPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) redirect("/connect");

  const history = await db
    .select()
    .from(upload_history)
    .where(eq(upload_history.account_id, accountId))
    .orderBy(desc(upload_history.created_at))
    .limit(200);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-mono text-xl font-semibold text-foreground">History</h1>
        <p className="text-[#888] text-sm font-mono mt-1">{history.length} uploads registrados</p>
      </div>

      {history.length === 0 ? (
        <p className="text-[#888] text-sm font-mono">Sin actividad aún. Subí tu primer ad desde Upload.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-[#888]">Fecha</th>
                <th className="text-left px-4 py-3 text-[#888]">Ad</th>
                <th className="text-left px-4 py-3 text-[#888]">Campaña</th>
                <th className="text-left px-4 py-3 text-[#888]">Ad Set</th>
                <th className="text-left px-4 py-3 text-[#888]">Tipo</th>
                <th className="text-left px-4 py-3 text-[#888]">Estado inicial</th>
                <th className="text-left px-4 py-3 text-[#888]">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-card transition-colors">
                  <td className="px-4 py-3 text-[#888] whitespace-nowrap">
                    {h.created_at
                      ? new Date(h.created_at).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground max-w-[160px] truncate">
                    {h.ad_name ?? h.ad_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#aaa] max-w-[140px] truncate">
                    {h.campaign_name ?? h.campaign_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#aaa] max-w-[140px] truncate">
                    {h.adset_name ?? h.adset_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#888] capitalize">
                    {h.creative_type ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      h.initial_status === "PAUSED"
                        ? "bg-[#555]/20 text-[#888]"
                        : "bg-success/10 text-success"
                    }`}>
                      {h.initial_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {h.result === "success" ? (
                      <span className="text-success">✓ ok</span>
                    ) : (
                      <span className="text-destructive" title={h.error_message ?? ""}>
                        ✗ error
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
