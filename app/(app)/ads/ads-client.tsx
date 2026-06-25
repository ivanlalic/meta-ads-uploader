"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

type Ad = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  created_time: string;
  adset: { id: string; name: string };
  campaign: { id: string; name: string };
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-success bg-success/10",
  PAUSED: "text-[#888] bg-[#555]/20",
  ARCHIVED: "text-[#888] bg-[#333]/20",
  DELETED: "text-destructive bg-destructive/10",
  DISAPPROVED: "text-destructive bg-destructive/10",
  WITH_ISSUES: "text-warning bg-warning/10",
  IN_PROCESS: "text-primary bg-primary/10",
  PENDING_REVIEW: "text-warning bg-warning/10",
};

export function AdsClient() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/meta/ads")
      .then((r) => r.json())
      .then((d) => setAds(d.data ?? []))
      .catch(() => toast.error("Error cargando ads"))
      .finally(() => setLoading(false));
  }, []);

  const statuses = ["ALL", ...Array.from(new Set(ads.map((a) => a.effective_status)))];

  const filtered = ads.filter((a) => {
    if (statusFilter !== "ALL" && a.effective_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.campaign?.name?.toLowerCase().includes(q) ||
        a.adset?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-mono text-xl font-semibold text-foreground">Ads</h1>
        <p className="text-[#888] text-sm font-mono mt-1">
          {loading ? "Cargando..." : `${ads.length} ads en esta cuenta`}
        </p>
      </div>

      {!loading && ads.length > 0 && (
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre, campaña, adset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-[#3b82f6]"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "Todos los estados" : s}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-[#888] text-sm font-mono">Cargando ads...</p>
      ) : ads.length === 0 ? (
        <p className="text-[#888] text-sm font-mono">No hay ads en esta cuenta.</p>
      ) : filtered.length === 0 ? (
        <p className="text-[#888] text-sm font-mono">Sin resultados para esa búsqueda.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-[#888]">Nombre</th>
                <th className="text-left px-4 py-3 text-[#888]">Campaña</th>
                <th className="text-left px-4 py-3 text-[#888]">Ad Set</th>
                <th className="text-left px-4 py-3 text-[#888]">Estado</th>
                <th className="text-left px-4 py-3 text-[#888]">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {filtered.map((ad) => (
                <tr key={ad.id} className="hover:bg-card transition-colors">
                  <td className="px-4 py-3 text-foreground max-w-[180px] truncate">
                    {ad.name}
                  </td>
                  <td className="px-4 py-3 text-[#aaa] max-w-[160px] truncate">
                    {ad.campaign?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#aaa] max-w-[160px] truncate">
                    {ad.adset?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      STATUS_COLORS[ad.effective_status] ?? "text-[#888] bg-[#333]/20"
                    }`}>
                      {ad.effective_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#888] whitespace-nowrap">
                    {new Date(ad.created_time).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
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
