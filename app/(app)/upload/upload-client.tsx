"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { FileVideo, FileImage, X, ChevronRight, Plus, Layers } from "lucide-react";
import type { AccountDefaults } from "@/lib/db/schema";

const CTA_OPTIONS = [
  "SHOP_NOW", "LEARN_MORE", "SIGN_UP", "SUBSCRIBE",
  "CONTACT_US", "BOOK_NOW", "DOWNLOAD", "GET_OFFER",
  "GET_QUOTE", "WATCH_MORE",
];

const CAMPAIGN_OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Ventas" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfico" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_AWARENESS", label: "Reconocimiento" },
  { value: "OUTCOME_ENGAGEMENT", label: "Interacción" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoción de app" },
];

const PATTERN_VARS = ["{filename}", "{date}", "{index}", "{campaign}", "{adset}"];

type Campaign = { id: string; name: string; effective_status: string };
type AdSet = { id: string; name: string; effective_status: string };
type Page = { id: string; name: string };

type AdCopy = {
  headline: string;
  primaryText: string;
  linkDescription: string;
  url: string;
  cta: string;
};

interface UploadClientProps {
  defaults: AccountDefaults | null;
}

function resolvePatternPreview(pattern: string, campaignName: string, adsetName: string): string {
  const date = new Date().toISOString().split("T")[0];
  return (pattern || "{filename}")
    .replace(/\{filename\}/g, "nombre_archivo")
    .replace(/\{date\}/g, date)
    .replace(/\{index\}/g, "1")
    .replace(/\{campaign\}/g, campaignName || "campaña")
    .replace(/\{adset\}/g, adsetName || "conjunto");
}

export function UploadClient({ defaults }: UploadClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<number[][]>([]); // arrays of file indices grouped together

  // Campaigns & adsets
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

  // Create campaign
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignObjective, setNewCampaignObjective] = useState("OUTCOME_SALES");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Create adset (duplicate)
  const [showCreateAdset, setShowCreateAdset] = useState(false);
  const [newAdsetName, setNewAdsetName] = useState("");
  const [newAdsetSourceId, setNewAdsetSourceId] = useState("");
  const [creatingAdset, setCreatingAdset] = useState(false);
  const [sourceAdsets, setSourceAdsets] = useState<(AdSet & { campaignName: string })[]>([]);
  const [loadingSourceAdsets, setLoadingSourceAdsets] = useState(false);

  // Copy
  const [copyMode, setCopyMode] = useState<"common" | "unique">("common");
  const [commonCopy, setCommonCopy] = useState<AdCopy>({ headline: "", primaryText: "", linkDescription: "", url: "", cta: "SHOP_NOW" });
  const [perAdCopy, setPerAdCopy] = useState<AdCopy[]>([]);
  const [pageId, setPageId] = useState(defaults?.facebook_page_id ?? "");

  // Ad name pattern
  const [adNamePattern, setAdNamePattern] = useState("{filename}");

  // Publication
  const [createPaused, setCreatePaused] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("00:00");

  // Advantage+
  const [advantagePlus, setAdvantagePlus] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
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
    setNewAdsetSourceId("");
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
        while (next.length < newFiles.length) next.push({ headline: "", primaryText: "", linkDescription: "", url: "", cta: "SHOP_NOW" });
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
  }, []);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPerAdCopy((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => { const next = { ...prev }; delete next[index]; return next; });
    setSelectedFileIndices((prev) => { const next = new Set(prev); next.delete(index); return next; });
    setGroups((prev) => prev.map((g) => g.filter((i) => i !== index).map((i) => i > index ? i - 1 : i)).filter((g) => g.length > 1));
  }

  function toggleFileSelect(index: number) {
    setSelectedFileIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function groupSelected() {
    if (selectedFileIndices.size < 2) return;
    const indices = Array.from(selectedFileIndices).sort((a, b) => a - b);
    // Remove selected from any existing groups
    setGroups((prev) => {
      const cleaned = prev.map((g) => g.filter((i) => !selectedFileIndices.has(i))).filter((g) => g.length > 1);
      return [...cleaned, indices];
    });
    setSelectedFileIndices(new Set());
  }

  function ungroup(groupIndex: number) {
    setGroups((prev) => prev.filter((_, i) => i !== groupIndex));
  }

  const groupedIndices = new Set(groups.flat());

  // Ad items: singles (ungrouped) + groups
  const adItems: Array<{ type: "single"; fileIdx: number } | { type: "group"; groupIdx: number; fileIndices: number[] }> = [];
  for (let i = 0; i < files.length; i++) {
    if (!groupedIndices.has(i)) adItems.push({ type: "single", fileIdx: i });
  }
  groups.forEach((g, gi) => adItems.push({ type: "group", groupIdx: gi, fileIndices: g }));

  function updatePerAdCopy(index: number, field: keyof AdCopy, value: string) {
    setPerAdCopy((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
  }

  function applyCommonToAll() {
    setPerAdCopy(files.map(() => ({ ...commonCopy })));
  }

  async function handleCreateCampaign() {
    if (!newCampaignName.trim()) { toast.error("Ingresá el nombre"); return; }
    setCreatingCampaign(true);
    try {
      const res = await fetch("/api/meta/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCampaignName.trim(), objective: newCampaignObjective }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaigns((prev) => [...prev, data]);
      setSelectedCampaignId(data.id);
      setNewCampaignName("");
      setShowCreateCampaign(false);
      toast.success(`Campaña "${data.name}" creada`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function openCreateAdset() {
    setShowCreateAdset(true);
    if (sourceAdsets.length > 0) return;
    setLoadingSourceAdsets(true);
    try {
      const all: (AdSet & { campaignName: string })[] = [];
      await Promise.all(
        campaigns.map(async (c) => {
          const r = await fetch(`/api/meta/adsets?campaignId=${c.id}`);
          const d = await r.json();
          (d.data ?? []).forEach((a: AdSet) => all.push({ ...a, campaignName: c.name }));
        })
      );
      setSourceAdsets(all);
    } finally {
      setLoadingSourceAdsets(false);
    }
  }

  async function handleCreateAdset() {
    if (!newAdsetName.trim()) { toast.error("Ingresá el nombre"); return; }
    if (!newAdsetSourceId) { toast.error("Seleccioná un Ad Set plantilla"); return; }
    if (!selectedCampaignId) { toast.error("Seleccioná una campaña primero"); return; }
    setCreatingAdset(true);
    try {
      const res = await fetch("/api/meta/adsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAdsetName.trim(), campaignId: selectedCampaignId, sourceAdsetId: newAdsetSourceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdsets((prev) => [...prev, data]);
      setSelectedAdsetId(data.id);
      setNewAdsetName("");
      setShowCreateAdset(false);
      toast.success(`Ad Set "${data.name}" creado`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreatingAdset(false);
    }
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

    const copies = copyMode === "common" ? adItems.map(() => commonCopy) : adItems.map((_, i) => perAdCopy[i] ?? commonCopy);
    if (copies.some((c) => !c.headline || !c.url)) { toast.error("Completá headline y URL en todos los ads"); return; }

    let startTime: string | undefined;
    if (scheduleEnabled && scheduledDate) {
      startTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    }

    setUploading(true);
    setUploadStep("");
    setResults([]);

    try {
      // Phase 1: upload each file individually to /api/upload/media
      const media: { type: "image" | "video"; hash?: string; video_id?: string; filename: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStep(`Subiendo archivo ${i + 1} de ${files.length}: ${file.name}`);
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/media", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(`${file.name}: ${data.error ?? "Error al subir"}`);
        media.push(data);
      }

      // Phase 2: create ads with pre-uploaded media IDs
      setUploadStep("Creando ads...");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adsetId: selectedAdsetId,
          campaignId: selectedCampaignId,
          campaignName: selectedCampaign?.name ?? "",
          adsetName: selectedAdset?.name ?? "",
          pageId,
          status: (scheduleEnabled && scheduledDate) ? "ACTIVE" : (createPaused ? "PAUSED" : "ACTIVE"),
          copies,
          adNamePattern,
          startTime,
          advantagePlus,
          groups,
          media,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear ads");
      setResults(data.results);
      const errors = data.results.filter((r: { error: string | null }) => r.error);
      if (errors.length === 0) toast.success(`${data.results.length} ads creados`);
      else toast.warning(`${data.results.length - errors.length} creados, ${errors.length} con errores`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setUploading(false);
      setUploadStep("");
    }
  }

  const inputClass = "w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6]";
  const selectClass = "w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]";
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
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-[#3b82f6] bg-[#3b82f6]/5" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm font-mono text-[#555]">Arrastrá archivos o hacé click para seleccionar</p>
          <p className="text-xs font-mono text-[#333] mt-1">JPG, PNG, WEBP, GIF, MP4, MOV</p>
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>

        {files.length > 0 && (
          <>
            {selectedFileIndices.size >= 2 && (
              <button onClick={groupSelected} className="flex items-center gap-2 text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
                <Layers className="w-3.5 h-3.5" />
                Agrupar {selectedFileIndices.size} archivos como un ad (multi-ratio)
              </button>
            )}

            <div className="border border-[#2a2a2a] rounded-lg divide-y divide-[#2a2a2a]">
              {files.map((file, i) => {
                const isInGroup = groupedIndices.has(i);
                const groupIdx = groups.findIndex((g) => g.includes(i));
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${isInGroup ? "bg-[#3b82f6]/5" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selectedFileIndices.has(i)}
                      onChange={() => toggleFileSelect(i)}
                      className="accent-[#3b82f6] shrink-0"
                    />
                    {previews[i] ? (
                      <img src={previews[i]} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                    ) : file.type.startsWith("video/") ? (
                      <div className="w-10 h-10 bg-[#1c1c1c] rounded flex items-center justify-center shrink-0">
                        <FileVideo className="w-5 h-5 text-[#3b82f6]" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-[#1c1c1c] rounded flex items-center justify-center shrink-0">
                        <FileImage className="w-5 h-5 text-[#555]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-[#f5f5f5] truncate">{file.name}</p>
                      <p className="text-xs font-mono text-[#555]">
                        {file.type.startsWith("video/") ? "Video" : "Imagen"} · {(file.size / 1024 / 1024).toFixed(1)} MB
                        {isInGroup && <span className="text-[#3b82f6] ml-2">Grupo {groupIdx + 1}</span>}
                      </p>
                    </div>
                    {isInGroup && (
                      <button onClick={() => ungroup(groupIdx)} className="text-xs font-mono text-[#555] hover:text-[#f5f5f5] transition-colors mr-2">
                        desagrupar
                      </button>
                    )}
                    <button onClick={() => removeFile(i)} className="text-[#555] hover:text-[#ef4444] transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {groups.length > 0 && (
              <p className="text-xs font-mono text-[#555]">
                {groups.length} grupo{groups.length > 1 ? "s" : ""} multi-ratio · {adItems.length} ads en total
              </p>
            )}
          </>
        )}
      </section>

      {/* Section 2: Destino */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Destino</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[#3b82f6]" />
          <span className="text-xs font-mono text-[#555]">Solo activos</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          {/* Campaign column */}
          <div className="space-y-2">
            <label className={labelClass}>Campaña</label>
            <input type="text" placeholder="Buscar..." value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} className={inputClass} />
            {loadingCampaigns ? (
              <p className="text-xs font-mono text-[#555] px-1">Cargando...</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-48 overflow-y-auto">
                {filteredCampaigns.length === 0 ? (
                  <p className="text-xs font-mono text-[#555] px-3 py-3">Sin resultados</p>
                ) : filteredCampaigns.map((c) => (
                  <button key={c.id} onClick={() => setSelectedCampaignId(c.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${selectedCampaignId === c.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"}`}>
                    <span className="truncate">{c.name}</span>
                    {selectedCampaignId === c.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Create campaign */}
            <button onClick={() => setShowCreateCampaign((v) => !v)} className="flex items-center gap-1.5 text-xs font-mono text-[#555] hover:text-[#3b82f6] transition-colors">
              <Plus className="w-3 h-3" /> Nueva campaña
            </button>
            {showCreateCampaign && (
              <div className="border border-[#2a2a2a] rounded-md p-3 space-y-2 bg-[#141414]">
                <input type="text" placeholder="Nombre de la campaña" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} className={inputClass} />
                <select value={newCampaignObjective} onChange={(e) => setNewCampaignObjective(e.target.value)} className={selectClass}>
                  {CAMPAIGN_OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleCreateCampaign} disabled={creatingCampaign}
                    className="flex-1 bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-40 text-white font-mono text-xs py-1.5 rounded transition-colors">
                    {creatingCampaign ? "Creando..." : "Crear"}
                  </button>
                  <button onClick={() => setShowCreateCampaign(false)} className="text-xs font-mono text-[#555] hover:text-[#f5f5f5] px-3 transition-colors">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Ad Set column */}
          <div className="space-y-2">
            <label className={labelClass}>Ad Set</label>
            <input type="text" placeholder="Buscar..." value={adsetSearch} onChange={(e) => setAdsetSearch(e.target.value)} disabled={!selectedCampaignId} className={`${inputClass} disabled:opacity-40`} />
            {!selectedCampaignId ? (
              <p className="text-xs font-mono text-[#333] px-1">Seleccioná una campaña primero</p>
            ) : loadingAdsets ? (
              <p className="text-xs font-mono text-[#555] px-1">Cargando...</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-48 overflow-y-auto">
                {filteredAdsets.length === 0 ? (
                  <p className="text-xs font-mono text-[#555] px-3 py-3">Sin resultados</p>
                ) : filteredAdsets.map((a) => (
                  <button key={a.id} onClick={() => setSelectedAdsetId(a.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${selectedAdsetId === a.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"}`}>
                    <span className="truncate">{a.name}</span>
                    {selectedAdsetId === a.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Create adset (duplicate) */}
            {selectedCampaignId && (
              <>
                <button onClick={openCreateAdset} className="flex items-center gap-1.5 text-xs font-mono text-[#555] hover:text-[#3b82f6] transition-colors">
                  <Plus className="w-3 h-3" /> Nuevo Ad Set
                </button>
                {showCreateAdset && (
                  <div className="border border-[#2a2a2a] rounded-md p-3 space-y-2 bg-[#141414]">
                    {loadingSourceAdsets ? (
                      <p className="text-xs font-mono text-[#555]">Cargando Ad Sets...</p>
                    ) : sourceAdsets.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-mono text-[#aaa]">No hay Ad Sets en la cuenta. Creá uno en Ads Manager primero.</p>
                        <a
                          href="https://adsmanager.facebook.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa]"
                        >
                          → Abrir Ads Manager
                        </a>
                        <div className="pt-1">
                          <button onClick={() => setShowCreateAdset(false)} className="text-xs font-mono text-[#555] hover:text-[#f5f5f5] transition-colors">Cerrar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <p className="text-xs font-mono text-[#555]">Copiar configuración de:</p>
                          <select value={newAdsetSourceId} onChange={(e) => setNewAdsetSourceId(e.target.value)} className={selectClass}>
                            <option value="">Seleccioná Ad Set base...</option>
                            {sourceAdsets.map((a) => <option key={a.id} value={a.id}>{a.campaignName} → {a.name}</option>)}
                          </select>
                        </div>
                        <input type="text" placeholder="Nombre del nuevo Ad Set" value={newAdsetName} onChange={(e) => setNewAdsetName(e.target.value)} className={inputClass} />
                        <div className="flex gap-2">
                          <button onClick={handleCreateAdset} disabled={creatingAdset}
                            className="flex-1 bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-40 text-white font-mono text-xs py-1.5 rounded transition-colors">
                            {creatingAdset ? "Creando..." : "Crear"}
                          </button>
                          <button onClick={() => setShowCreateAdset(false)} className="text-xs font-mono text-[#555] hover:text-[#f5f5f5] px-3 transition-colors">Cancelar</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
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
              <input type="radio" name="copyMode" value={mode} checked={copyMode === mode} onChange={() => setCopyMode(mode)} className="accent-[#3b82f6]" />
              <span className="text-sm font-mono text-[#aaa]">{mode === "common" ? "Mismo texto para todos" : "Texto único por ad"}</span>
            </label>
          ))}
        </div>

        {copyMode === "common" ? (
          <div className="space-y-3 p-4 border border-[#2a2a2a] rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Headline</label>
                <input type="text" value={commonCopy.headline} onChange={(e) => setCommonCopy((p) => ({ ...p, headline: e.target.value }))} placeholder="Título del anuncio" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>URL destino</label>
                <input type="url" value={commonCopy.url} onChange={(e) => setCommonCopy((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." className={inputClass} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Primary Text</label>
              <textarea value={commonCopy.primaryText} onChange={(e) => setCommonCopy((p) => ({ ...p, primaryText: e.target.value }))} placeholder="Texto principal del anuncio..." rows={3} className={`${inputClass} resize-none`} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Link Description</label>
              <input type="text" value={commonCopy.linkDescription} onChange={(e) => setCommonCopy((p) => ({ ...p, linkDescription: e.target.value }))} placeholder="Descripción del enlace (opcional)" className={inputClass} />
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
              <button onClick={applyCommonToAll} className="text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa] transition-colors">Aplicar copy común a todos</button>
            </div>
            {adItems.length === 0 ? (
              <p className="text-xs font-mono text-[#333]">Subí archivos primero</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#555] w-12">Ad</th>
                      <th className="text-left px-3 py-2 text-[#555]">Headline</th>
                      <th className="text-left px-3 py-2 text-[#555]">Primary Text</th>
                      <th className="text-left px-3 py-2 text-[#555]">Descripción</th>
                      <th className="text-left px-3 py-2 text-[#555]">URL</th>
                      <th className="text-left px-3 py-2 text-[#555] w-28">CTA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {adItems.map((item, i) => {
                      const thumb = item.type === "single" ? previews[item.fileIdx] : previews[item.fileIndices[0]];
                      const isVideo = item.type === "single"
                        ? files[item.fileIdx]?.type.startsWith("video/")
                        : item.fileIndices.some((idx) => files[idx]?.type.startsWith("video/"));
                      return (
                        <tr key={i} className="bg-[#0a0a0a]">
                          <td className="px-3 py-2">
                            <div className="relative">
                              {thumb ? <img src={thumb} alt="" className="w-8 h-8 object-cover rounded" /> : (
                                <div className="w-8 h-8 bg-[#1c1c1c] rounded flex items-center justify-center">
                                  {isVideo ? <FileVideo className="w-4 h-4 text-[#3b82f6]" /> : <FileImage className="w-4 h-4 text-[#555]" />}
                                </div>
                              )}
                              {item.type === "group" && <span className="absolute -top-1 -right-1 bg-[#3b82f6] text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">{item.fileIndices.length}</span>}
                            </div>
                          </td>
                          {(["headline", "primaryText", "linkDescription", "url"] as const).map((field) => (
                            <td key={field} className="px-2 py-2">
                              {field === "primaryText" ? (
                                <textarea value={perAdCopy[i]?.[field] ?? ""} onChange={(e) => updatePerAdCopy(i, field, e.target.value)} placeholder={field === "primaryText" ? "Texto..." : field} rows={2} className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6] resize-none" />
                              ) : (
                                <input type={field === "url" ? "url" : "text"} value={perAdCopy[i]?.[field] ?? ""} onChange={(e) => updatePerAdCopy(i, field, e.target.value)} placeholder={field === "url" ? "https://..." : field} className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] placeholder:text-[#333] focus:outline-none focus:border-[#3b82f6]" />
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <select value={perAdCopy[i]?.cta ?? "SHOP_NOW"} onChange={(e) => updatePerAdCopy(i, "cta", e.target.value)} className="w-full bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]">
                              {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Ad Name Pattern */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Nombre de ads</h2>
        <div className="space-y-2">
          <input type="text" value={adNamePattern} onChange={(e) => setAdNamePattern(e.target.value)} placeholder="{filename}" className={inputClass} />
          <div className="flex gap-2 flex-wrap">
            {PATTERN_VARS.map((v) => (
              <button key={v} onClick={() => setAdNamePattern((p) => p + v)}
                className="text-[10px] font-mono px-2 py-0.5 bg-[#141414] border border-[#2a2a2a] rounded text-[#555] hover:text-[#3b82f6] hover:border-[#3b82f6] transition-colors">
                {v}
              </button>
            ))}
          </div>
          {adNamePattern && (
            <p className="text-xs font-mono text-[#555]">
              Preview: <span className="text-[#aaa]">{resolvePatternPreview(adNamePattern, selectedCampaign?.name ?? "", selectedAdset?.name ?? "")}</span>
            </p>
          )}
        </div>
      </section>

      {/* Section 5: Publication + Scheduling */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Publicación</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={createPaused} onChange={(e) => { setCreatePaused(e.target.checked); if (e.target.checked) setScheduleEnabled(false); }} className="accent-[#3b82f6]" />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Crear ads en pausa</p>
            <p className="text-xs font-mono text-[#555]">Activalos manualmente en Ads Manager</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={scheduleEnabled} onChange={(e) => { setScheduleEnabled(e.target.checked); if (e.target.checked) setCreatePaused(false); }} className="accent-[#3b82f6]" />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Programar inicio</p>
            <p className="text-xs font-mono text-[#555]">Ads se crean activos con fecha de inicio programada</p>
          </div>
        </label>
        {scheduleEnabled && (
          <div className="flex gap-3 pl-7">
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]" />
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm font-mono text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]" />
          </div>
        )}
      </section>

      {/* Section 6: Advantage+ */}
      <section className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Advantage+</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={advantagePlus} onChange={(e) => setAdvantagePlus(e.target.checked)} className="accent-[#3b82f6]" />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Creative Enhancements (Meta Defaults)</p>
            <p className="text-xs font-mono text-[#555]">Meta aplica automáticamente mejoras básicas al creativo</p>
          </div>
        </label>
      </section>

      {/* Section 7: Preview */}
      {adItems.length > 0 && selectedAdsetId && (
        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#555]">Preview</h2>
          <p className="text-xs font-mono text-[#555]">
            Se crearán <span className="text-[#f5f5f5]">{adItems.length} ads</span> en{" "}
            <span className="text-[#f5f5f5]">{selectedAdset?.name ?? selectedAdsetId}</span>
            {selectedCampaign && <> › <span className="text-[#3b82f6]">{selectedCampaign.name}</span></>}
          </p>
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#555]">Nombre</th>
                  <th className="text-left px-3 py-2 text-[#555]">Tipo</th>
                  <th className="text-left px-3 py-2 text-[#555]">Headline</th>
                  <th className="text-left px-3 py-2 text-[#555]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {adItems.map((item, i) => {
                  const copy = copyMode === "common" ? commonCopy : (perAdCopy[i] ?? commonCopy);
                  const result = results[i];
                  const file = item.type === "single" ? files[item.fileIdx] : files[item.fileIndices[0]];
                  const filename = file?.name.replace(/\.[^.]+$/, "") ?? "";
                  const resolvedName = resolvePatternPreview(adNamePattern, selectedCampaign?.name ?? "", selectedAdset?.name ?? "").replace("nombre_archivo", filename);
                  const tipo = item.type === "group" ? `multi-ratio (${item.fileIndices.length})` : (file?.type.startsWith("video/") ? "video" : "imagen");
                  return (
                    <tr key={i} className="bg-[#0a0a0a]">
                      <td className="px-3 py-2 text-[#f5f5f5] max-w-[160px] truncate">{resolvedName}</td>
                      <td className="px-3 py-2 text-[#555]">{tipo}</td>
                      <td className="px-3 py-2 text-[#aaa] max-w-[180px] truncate">{copy?.headline || "—"}</td>
                      <td className="px-3 py-2">
                        {result ? (
                          result.error ? <span className="text-[#ef4444]">Error</span> : <span className="text-[#10b981]">Creado</span>
                        ) : (
                          <span className="text-[#555]">
                            {scheduleEnabled && scheduledDate ? `Prog. ${scheduledDate}` : createPaused ? "Pausa" : "Activo"}
                          </span>
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
        disabled={uploading || adItems.length === 0 || !selectedAdsetId || !pageId}
        className="w-full bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-40 text-white font-mono text-sm py-3 rounded-md transition-colors"
      >
        {uploading ? (uploadStep || "Creando ads...") : `Crear ${adItems.length > 0 ? adItems.length : ""} ads`}
      </button>
    </div>
  );
}
