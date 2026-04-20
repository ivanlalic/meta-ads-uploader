"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { FileVideo, FileImage, X, ChevronRight } from "lucide-react";
import type { AccountDefaults } from "@/lib/db/schema";

const CTA_OPTIONS = [
  "SHOP_NOW", "LEARN_MORE", "SIGN_UP", "SUBSCRIBE",
  "CONTACT_US", "BOOK_NOW", "DOWNLOAD", "GET_OFFER",
  "GET_QUOTE", "WATCH_MORE",
];

type Campaign = { id: string; name: string; effective_status: string };
type AdSet = { id: string; name: string; effective_status: string };
type Page = { id: string; name: string };

type AdCopy = {
  headline: string;
  primaryText: string;
  url: string;
  cta: string;
};

interface UploadClientProps {
  defaults: AccountDefaults | null;
}

export function UploadClient({ defaults }: UploadClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingAdsets, setLoadingAdsets] = useState(false);

  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [adsetSearch, setAdsetSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [copyMode, setCopyMode] = useState<"common" | "unique">("common");
  const [commonCopy, setCommonCopy] = useState<AdCopy>({
    headline: "",
    primaryText: "",
    url: "",
    cta: "SHOP_NOW",
  });
  const [perAdCopy, setPerAdCopy] = useState<AdCopy[]>([]);
  const [pageId, setPageId] = useState(defaults?.facebook_page_id ?? "");

  const [createPaused, setCreatePaused] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ name: string; adId: string | null; error: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/meta/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.data ?? []))
      .catch(() => toast.error("Error cargando campañas"))
      .finally(() => setLoadingCampaigns(false));

    fetch("/api/meta/pages")
      .then((r) => r.json())
      .then((d) => setPages(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) { setAdsets([]); return; }
    setLoadingAdsets(true);
    setSelectedAdsetId("");
    fetch(`/api/meta/adsets?campaignId=${selectedCampaignId}`)
      .then((r) => r.json())
      .then((d) => setAdsets(d.data ?? []))
      .catch(() => toast.error("Error cargando conjuntos"))
      .finally(() => setLoadingAdsets(false));
  }, [selectedCampaignId]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles((prev) => {
      const newFiles = [...prev, ...arr];
      setPerAdCopy((prevCopy) => {
        const next = [...prevCopy];
        while (next.length < newFiles.length) {
          next.push({ ...commonCopy });
        }
        return next;
      });
      arr.forEach((file, i) => {
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          setPreviews((p) => ({ ...p, [prev.length + i]: url }));
        }
      });
      return newFiles;
    });
  }, [commonCopy]);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPerAdCopy((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function updatePerAdCopy(index: number, field: keyof AdCopy, value: string) {
    setPerAdCopy((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function applyCommonToAll() {
    setPerAdCopy(files.map(() => ({ ...commonCopy })));
  }

  const filteredCampaigns = campaigns.filter((c) => {
    if (onlyActive && c.effective_status !== "ACTIVE") return false;
    if (campaignSearch) return c.name.toLowerCase().includes(campaignSearch.toLowerCase());
    return true;
  });

  const filteredAdsets = adsets.filter((a) => {
    if (onlyActive && a.effective_status !== "ACTIVE") return false;
    if (adsetSearch) return a.name.toLowerCase().includes(adsetSearch.toLowerCase());
    return true;
  });

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const selectedAdset = adsets.find((a) => a.id === selectedAdsetId);

  async function handleSubmit() {
    if (files.length === 0) { toast.error("Seleccioná al menos un archivo"); return; }
    if (!selectedAdsetId) { toast.error("Seleccioná un Ad Set"); return; }
    if (!pageId) { toast.error("Seleccioná una Página de Facebook"); return; }

    const copies = copyMode === "common"
      ? files.map(() => commonCopy)
      : perAdCopy;

    const hasEmptyCopy = copies.some((c) => !c.headline || !c.url);
    if (hasEmptyCopy) { toast.error("Completá headline y URL en todos los ads"); return; }

    setUploading(true);
    setResults([]);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("config", JSON.stringify({
      adsetId: selectedAdsetId,
      campaignId: selectedCampaignId,
      campaignName: selectedCampaign?.name ?? "",
      adsetName: selectedAdset?.name ?? "",
      pageId,
      status: createPaused ? "PAUSED" : "ACTIVE",
      copies,
    }));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear ads");
      setResults(data.results);
      const errors = data.results.filter((r: { error: string | null }) => r.error);
      if (errors.length === 0) {
        toast.success(`${data.results.length} ads creados`);
      } else {
        toast.warning(`${data.results.length - errors.length} ads creados, ${errors.length} con errores`);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setUploading(false);
    }
  }

  const selectClass = "w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]";
  const inputClass = "w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6]";
  const labelClass = "text-xs font-mono text-[#555] uppercase tracking-widest";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-semibold text-[#f5f5f5]">Upload</h1>
        <p className="text-[#555] text-sm font-mono mt-1">Subir creativos y crear ads en Meta</p>
      </div>

      {/* Section 1: Files */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Archivos</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-[#3b82f6] bg-[#3b82f6]/5" : "border-[#2a2a2a] hover:border-[#3a3a3a]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm font-mono text-[#555]">
            Arrastrá archivos o hacé click para seleccionar
          </p>
          <p className="text-xs font-mono text-[#333] mt-1">JPG, PNG, WEBP, GIF, MP4, MOV</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="border border-[#2a2a2a] rounded-lg divide-y divide-[#2a2a2a]">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                {previews[i] ? (
                  <img src={previews[i]} alt="" className="w-10 h-10 object-cover rounded" />
                ) : file.type.startsWith("video/") ? (
                  <div className="w-10 h-10 bg-[#1c1c1c] rounded flex items-center justify-center">
                    <FileVideo className="w-5 h-5 text-[#3b82f6]" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-[#1c1c1c] rounded flex items-center justify-center">
                    <FileImage className="w-5 h-5 text-[#555]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-[#f5f5f5] truncate">{file.name}</p>
                  <p className="text-xs font-mono text-[#555]">
                    {file.type.startsWith("video/") ? "Video" : "Imagen"} · {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button onClick={() => removeFile(i)} className="text-[#555] hover:text-[#ef4444] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Campaign + Adset */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Destino</h2>
        <div className="flex items-center gap-2 mb-2">
          <input
            id="only-active"
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="accent-[#3b82f6]"
          />
          <label htmlFor="only-active" className="text-xs font-mono text-[#555]">Solo activos</label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Campaña</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              className={inputClass}
            />
            {loadingCampaigns ? (
              <p className="text-xs font-mono text-[#555] px-1">Cargando...</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-56 overflow-y-auto">
                {filteredCampaigns.length === 0 ? (
                  <p className="text-xs font-mono text-[#555] px-3 py-3">Sin resultados</p>
                ) : filteredCampaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${
                      selectedCampaignId === c.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {selectedCampaignId === c.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Ad Set</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={adsetSearch}
              onChange={(e) => setAdsetSearch(e.target.value)}
              disabled={!selectedCampaignId}
              className={`${inputClass} disabled:opacity-40`}
            />
            {!selectedCampaignId ? (
              <p className="text-xs font-mono text-[#333] px-1">Seleccioná una campaña primero</p>
            ) : loadingAdsets ? (
              <p className="text-xs font-mono text-[#555] px-1">Cargando...</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-56 overflow-y-auto">
                {filteredAdsets.length === 0 ? (
                  <p className="text-xs font-mono text-[#555] px-3 py-3">Sin resultados</p>
                ) : filteredAdsets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAdsetId(a.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${
                      selectedAdsetId === a.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"
                    }`}
                  >
                    <span className="truncate">{a.name}</span>
                    {selectedAdsetId === a.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Copy */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Copy</h2>

        <div className="space-y-1">
          <label className={labelClass}>Página de Facebook</label>
          <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={selectClass}>
            <option value="">Seleccioná una página</option>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex gap-4">
          {(["common", "unique"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="copyMode"
                value={mode}
                checked={copyMode === mode}
                onChange={() => setCopyMode(mode)}
                className="accent-[#3b82f6]"
              />
              <span className="text-sm font-mono text-[#aaa]">
                {mode === "common" ? "Mismo texto para todos" : "Texto único por ad"}
              </span>
            </label>
          ))}
        </div>

        {copyMode === "common" ? (
          <div className="space-y-3 p-4 border border-[#2a2a2a] rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Headline</label>
                <input
                  type="text"
                  value={commonCopy.headline}
                  onChange={(e) => setCommonCopy((p) => ({ ...p, headline: e.target.value }))}
                  placeholder="Título del anuncio"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>URL destino</label>
                <input
                  type="url"
                  value={commonCopy.url}
                  onChange={(e) => setCommonCopy((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Primary Text</label>
              <textarea
                value={commonCopy.primaryText}
                onChange={(e) => setCommonCopy((p) => ({ ...p, primaryText: e.target.value }))}
                placeholder="Texto principal del anuncio..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>CTA</label>
              <select value={commonCopy.cta} onChange={(e) => setCommonCopy((p) => ({ ...p, cta: e.target.value }))} className={selectClass}>
                {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-[#555]">Editá el copy de cada ad individualmente</p>
              <button
                onClick={applyCommonToAll}
                className="text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                Aplicar copy común a todos
              </button>
            </div>
            {files.length === 0 ? (
              <p className="text-xs font-mono text-[#333]">Subí archivos primero</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#555] w-12">Ad</th>
                      <th className="text-left px-3 py-2 text-[#555]">Headline</th>
                      <th className="text-left px-3 py-2 text-[#555]">Primary Text</th>
                      <th className="text-left px-3 py-2 text-[#555]">URL</th>
                      <th className="text-left px-3 py-2 text-[#555] w-32">CTA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {files.map((file, i) => (
                      <tr key={i} className="bg-[#0a0a0a]">
                        <td className="px-3 py-2">
                          {previews[i] ? (
                            <img src={previews[i]} alt="" className="w-8 h-8 object-cover rounded" />
                          ) : (
                            <div className="w-8 h-8 bg-[#1c1c1c] rounded flex items-center justify-center">
                              <FileVideo className="w-4 h-4 text-[#3b82f6]" />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={perAdCopy[i]?.headline ?? ""}
                            onChange={(e) => updatePerAdCopy(i, "headline", e.target.value)}
                            placeholder="Headline"
                            className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <textarea
                            value={perAdCopy[i]?.primaryText ?? ""}
                            onChange={(e) => updatePerAdCopy(i, "primaryText", e.target.value)}
                            placeholder="Texto..."
                            rows={2}
                            className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6] resize-none"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="url"
                            value={perAdCopy[i]?.url ?? ""}
                            onChange={(e) => updatePerAdCopy(i, "url", e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={perAdCopy[i]?.cta ?? "SHOP_NOW"}
                            onChange={(e) => updatePerAdCopy(i, "cta", e.target.value)}
                            className="w-full bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]"
                          >
                            {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Publication Options */}
      <section className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Publicación</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={createPaused}
            onChange={(e) => setCreatePaused(e.target.checked)}
            className="accent-[#3b82f6]"
          />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Crear ads en pausa</p>
            <p className="text-xs font-mono text-[#555]">Los ads se crean pero no se publican hasta que los activés en Ads Manager</p>
          </div>
        </label>
      </section>

      {/* Section 5: Preview */}
      {files.length > 0 && selectedAdsetId && (
        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Preview</h2>
          <p className="text-xs font-mono text-[#555]">
            Se crearán <span className="text-[#f5f5f5]">{files.length} ads</span> en{" "}
            <span className="text-[#f5f5f5]">{selectedAdset?.name ?? selectedAdsetId}</span>
            {selectedCampaign && (
              <> › <span className="text-[#3b82f6]">{selectedCampaign.name}</span></>
            )}
          </p>
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#555]">Ad</th>
                  <th className="text-left px-3 py-2 text-[#555]">Tipo</th>
                  <th className="text-left px-3 py-2 text-[#555]">Headline</th>
                  <th className="text-left px-3 py-2 text-[#555]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {files.map((file, i) => {
                  const copy = copyMode === "common" ? commonCopy : perAdCopy[i];
                  const result = results[i];
                  return (
                    <tr key={i} className="bg-[#0a0a0a]">
                      <td className="px-3 py-2 text-[#f5f5f5] truncate max-w-[150px]">{file.name.replace(/\.[^.]+$/, "")}</td>
                      <td className="px-3 py-2 text-[#555]">{file.type.startsWith("video/") ? "Video" : "Imagen"}</td>
                      <td className="px-3 py-2 text-[#aaa] truncate max-w-[200px]">{copy?.headline || "—"}</td>
                      <td className="px-3 py-2">
                        {result ? (
                          result.error ? (
                            <span className="text-[#ef4444]">Error</span>
                          ) : (
                            <span className="text-[#10b981]">Creado</span>
                          )
                        ) : (
                          <span className="text-[#555]">{createPaused ? "Pausa" : "Activo"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {results.length > 0 && results.some((r) => r.error) && (
            <div className="space-y-1">
              {results.filter((r) => r.error).map((r, i) => (
                <p key={i} className="text-xs font-mono text-[#ef4444]">{r.name}: {r.error}</p>
              ))}
            </div>
          )}
        </section>
      )}

      <button
        onClick={handleSubmit}
        disabled={uploading || files.length === 0 || !selectedAdsetId || !pageId}
        className="w-full bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-40 text-white font-mono text-sm py-3 rounded-md transition-colors"
      >
        {uploading ? "Creando ads..." : `Crear ${files.length > 0 ? files.length : ""} ads`}
      </button>
    </div>
  );
}
