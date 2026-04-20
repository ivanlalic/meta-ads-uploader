"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { upsertAccountDefaults } from "@/app/actions/accounts";
import type { Account, AccountDefaults } from "@/lib/db/schema";

type Page = { id: string; name: string; instagram_business_account?: { id: string } };
type Pixel = { id: string; name: string };

interface SettingsClientProps {
  account: Account;
  defaults: AccountDefaults | null;
}

export function SettingsClient({ account, defaults }: SettingsClientProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingPixels, setLoadingPixels] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedPageId, setSelectedPageId] = useState(defaults?.facebook_page_id ?? "");
  const [selectedPixelId, setSelectedPixelId] = useState(defaults?.pixel_id ?? "");

  useEffect(() => {
    fetch("/api/meta/pages")
      .then((r) => r.json())
      .then((d) => setPages(d.data ?? []))
      .catch(() => toast.error("Error cargando páginas"))
      .finally(() => setLoadingPages(false));

    fetch("/api/meta/pixels")
      .then((r) => r.json())
      .then((d) => setPixels(d.data ?? []))
      .catch(() => toast.error("Error cargando pixels"))
      .finally(() => setLoadingPixels(false));
  }, []);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  async function handleSave() {
    setSaving(true);
    const selectedPixel = pixels.find((p) => p.id === selectedPixelId);
    try {
      await upsertAccountDefaults(account.id, {
        facebook_page_id: selectedPageId || null,
        facebook_page_name: selectedPage?.name ?? null,
        instagram_account_id: selectedPage?.instagram_business_account?.id ?? null,
        pixel_id: selectedPixelId || null,
        pixel_name: selectedPixel?.name ?? null,
      });
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-semibold text-[#f5f5f5]">Settings</h1>
        <p className="text-[#555] text-sm font-mono mt-1">
          {account.ad_account_name} · {account.ad_account_id}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Página y Pixel</h2>

        <div className="space-y-1">
          <label className="text-xs font-mono text-[#555] uppercase tracking-widest">
            Facebook Page
          </label>
          {loadingPages ? (
            <p className="text-xs font-mono text-[#555]">Cargando...</p>
          ) : pages.length === 0 ? (
            <p className="text-xs font-mono text-[#ef4444]">No se encontraron páginas</p>
          ) : (
            <select
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
              className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]"
            >
              <option value="">Sin página</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {selectedPage?.instagram_business_account && (
            <p className="text-xs font-mono text-[#10b981]">
              IG vinculado: {selectedPage.instagram_business_account.id}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-mono text-[#555] uppercase tracking-widest">Pixel</label>
          {loadingPixels ? (
            <p className="text-xs font-mono text-[#555]">Cargando...</p>
          ) : pixels.length === 0 ? (
            <p className="text-xs font-mono text-[#555]">No se encontraron pixels</p>
          ) : (
            <select
              value={selectedPixelId}
              onChange={(e) => setSelectedPixelId(e.target.value)}
              className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]"
            >
              <option value="">Sin pixel</option>
              {pixels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-50 text-white font-mono text-sm px-6 py-2 rounded-md transition-colors"
      >
        {saving ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  );
}
