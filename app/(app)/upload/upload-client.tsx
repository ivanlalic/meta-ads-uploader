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
  const [groups, setGroups] = useState<{ fileIdx: number; placement: "feed" | "stories" }[][]>([]);

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

  // Source ad (copy from existing)
  const [sourceAds, setSourceAds] = useState<{ id: string; name: string; effective_status: string }[]>([]);
  const [loadingSourceAds, setLoadingSourceAds] = useState(false);
  const [selectedSourceAdId, setSelectedSourceAdId] = useState("");
  const [loadingAdDetails, setLoadingAdDetails] = useState(false);
  const [sourceCopies, setSourceCopies] = useState<{ headline: string; primaryText: string; linkDescription: string }[]>([]);

  // Pre-upload media
  const [mediaUploads, setMediaUploads] = useState<{ fileIdx: number; status: "pending" | "uploading" | "done" | "error"; type?: string; hash?: string; video_id?: string; filename?: string; error?: string }[]>([]);

  useEffect(() => {
    fetch("/api/meta/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.data ?? []))
      .catch(() => toast.error("Error cargando campañas"))
      .finally(() => setLoadingCampaigns(false));
    fetch("/api/meta/pages")
      .then((r) => r.json())
      .then((d) => {
        const list = d.data ?? [];
        setPages(list);
        if (!pageId && list.length === 1) {
          setPageId(list[0].id);
        }
      });
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

  useEffect(() => {
    if (!selectedAdsetId) { setSourceAds([]); return; }
    setLoadingSourceAds(true);
    setSelectedSourceAdId("");
    fetch(`/api/meta/ads?adsetId=${selectedAdsetId}`)
      .then((r) => r.json())
      .then((d) => setSourceAds(d.data ?? []))
      .catch(() => toast.error("Error cargando anuncios"))
      .finally(() => setLoadingSourceAds(false));
  }, [selectedAdsetId]);

  // Upload all files to Meta
  const [uploadingMedia, setUploadingMedia] = useState(false);
  async function uploadAllFiles() {
    if (files.length === 0) return;
    setUploadingMedia(true);
    // Re-initialize upload state for all files
    const init = files.map((f, i) => ({ fileIdx: i, status: "uploading" as const, filename: f.name }));
    setMediaUploads(init);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/media", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al subir");
        setMediaUploads((prev) => prev.map((m) => m.fileIdx === i ? { ...m, ...data, status: "done" } : m));
      } catch (e) {
        setMediaUploads((prev) => prev.map((m) => m.fileIdx === i ? { ...m, status: "error", error: String(e) } : m));
      }
    }
    setUploadingMedia(false);
  }

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
    setMediaUploads([]);
    setGroups((prev) => prev.map((g) => g.filter((m) => m.fileIdx !== index).map((m) => ({ ...m, fileIdx: m.fileIdx > index ? m.fileIdx - 1 : m.fileIdx }))).filter((g) => g.length > 1));
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
    setGroups((prev) => {
      const cleaned = prev.map((g) => g.filter((m) => !selectedFileIndices.has(m.fileIdx))).filter((g) => g.length > 1);
      const newGroup = indices.map((idx, i) => ({ fileIdx: idx, placement: (i === 0 ? "feed" : "stories") as "feed" | "stories" }));
      return [...cleaned, newGroup];
    });
    setSelectedFileIndices(new Set());
  }

  function setPlacement(groupIdx: number, fileIdx: number, placement: "feed" | "stories") {
    setGroups((prev) => prev.map((g, gi) => gi !== groupIdx ? g : g.map((m) => m.fileIdx === fileIdx ? { ...m, placement } : m)));
  }

  function ungroup(groupIndex: number) {
    setGroups((prev) => prev.filter((_, i) => i !== groupIndex));
  }

  const groupedIndices = new Set(groups.flat().map((m) => m.fileIdx));

  // Ad items: singles (ungrouped) + groups
  const adItems: Array<{ type: "single"; fileIdx: number } | { type: "group"; groupIdx: number; members: { fileIdx: number; placement: "feed" | "stories" }[] }> = [];
  for (let i = 0; i < files.length; i++) {
    if (!groupedIndices.has(i)) adItems.push({ type: "single", fileIdx: i });
  }
  groups.forEach((g, gi) => adItems.push({ type: "group", groupIdx: gi, members: g }));

  function updateSourceCopy(index: number, field: string, value: string) {
    setSourceCopies((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  function removeSourceCopy(index: number) {
    setSourceCopies((prev) => prev.filter((_, i) => i !== index));
  }

  function applySourceCopyToCommon(index: number) {
    const c = sourceCopies[index];
    if (!c) return;
    setCommonCopy((prev) => ({ ...prev, headline: c.headline, primaryText: c.primaryText, linkDescription: c.linkDescription }));
    setPerAdCopy(files.map(() => ({ ...commonCopy, headline: c.headline, primaryText: c.primaryText, linkDescription: c.linkDescription })));
    toast.success("Variante aplicada al formulario");
  }

  function updatePerAdCopy(index: number, field: keyof AdCopy, value: string) {
    setPerAdCopy((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
  }

  function applyCommonToAll() {
    setPerAdCopy(files.map(() => ({ ...commonCopy })));
  }

  async function loadAdDetails(adId: string) {
    if (!adId) return;
    setLoadingAdDetails(true);
    try {
      const res = await fetch(`/api/meta/ad-details?adId=${adId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.copy) {
        const loaded = {
          headline: data.copy.headline ?? "",
          primaryText: data.copy.primaryText ?? "",
          linkDescription: data.copy.linkDescription ?? "",
          url: data.copy.url ?? "",
          cta: data.copy.cta ?? "SHOP_NOW",
        };
        setCommonCopy(loaded);
        setPerAdCopy(files.map(() => ({ ...loaded })));
        setSourceCopies(data.copies ?? []);
        const count = data.copies?.length ?? 1;
        toast.success(`Copy cargado desde el anuncio (${count} variante${count > 1 ? "s" : ""})`);
      } else {
        toast.error("No se pudo extraer el copy del anuncio (probablemente es multi-ratio)");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingAdDetails(false);
    }
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
      // Check pre-uploaded media
      if (mediaUploads.length === 0) {
        throw new Error("Primero subí los archivos a Meta con el botón 'Subir archivos a Meta'");
      }
      const pending = mediaUploads.filter((m) => m.status === "pending" || m.status === "uploading");
      const failed = mediaUploads.filter((m) => m.status === "error");
      if (pending.length > 0) {
        throw new Error("Esperá a que terminen de subirse los archivos");
      }
      if (failed.length > 0) {
        throw new Error(`Error en archivos: ${failed.map((e) => e.filename).join(", ")}`);
      }
      const media: { type: "image" | "video"; hash?: string; video_id?: string; filename: string }[] = [];
      for (const mu of mediaUploads) {
        if (mu.status === "done" && (mu.hash || mu.video_id)) {
          media.push({ type: mu.type as "image" | "video", hash: mu.hash, video_id: mu.video_id, filename: mu.filename ?? "" });
        }
      }
      if (media.length === 0) {
        throw new Error("No hay archivos subidos correctamente");
      }

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
  const labelClass = "text-xs font-mono text-[#888] uppercase tracking-widest";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-semibold text-[#f5f5f5]">Upload</h1>
        <p className="text-[#888] text-sm font-mono mt-1">Subir creativos y crear ads en Meta</p>
      </div>

      {/* Section 1: Files */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Archivos</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-[#3b82f6] bg-[#3b82f6]/5" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm font-mono text-[#888]">Arrastrá archivos o hacé click para seleccionar</p>
          <p className="text-xs font-mono text-[#333] mt-1">JPG, PNG, WEBP, GIF, MP4, MOV</p>
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>

        {files.length > 0 && (
          <>
            {false && selectedFileIndices.size >= 2 && (
              <button onClick={groupSelected} className="flex items-center gap-2 text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
                <Layers className="w-3.5 h-3.5" />
                Agrupar {selectedFileIndices.size} archivos como un ad (multi-ratio)
              </button>
            )}

            <div className="border border-[#2a2a2a] rounded-lg divide-y divide-[#2a2a2a]">
              {files.map((file, i) => {
                const isInGroup = groupedIndices.has(i);
                const groupIdx = groups.findIndex((g) => g.some((m) => m.fileIdx === i));
                const member = isInGroup ? groups[groupIdx].find((m) => m.fileIdx === i) : null;
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${isInGroup ? "bg-[#3b82f6]/5" : ""}`}>
                    {false && (
                      <input
                        type="checkbox"
                        checked={selectedFileIndices.has(i)}
                        onChange={() => toggleFileSelect(i)}
                        className="accent-[#3b82f6] shrink-0"
                      />
                    )}
                    {previews[i] ? (
                      <img src={previews[i]} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                    ) : file.type.startsWith("video/") ? (
                      <div className="w-10 h-10 bg-[#1c1c1c] rounded flex items-center justify-center shrink-0">
                        <FileVideo className="w-5 h-5 text-[#3b82f6]" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-[#1c1c1c] rounded flex items-center justify-center shrink-0">
                        <FileImage className="w-5 h-5 text-[#888]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-[#f5f5f5] truncate">{file.name}</p>
                      <p className="text-xs font-mono text-[#888]">
                        {file.type.startsWith("video/") ? "Video" : "Imagen"} · {(file.size / 1024 / 1024).toFixed(1)} MB
                        {isInGroup && <span className="text-[#3b82f6] ml-2">Grupo {groupIdx + 1}</span>}
                        {(() => {
                          const mu = mediaUploads.find((m) => m.fileIdx === i);
                          if (!mu || mu.status === "pending") return null;
                          if (mu.status === "uploading") return <span className="text-[#f5a623] ml-2">Subiendo...</span>;
                          if (mu.status === "done") return <span className="text-[#10b981] ml-2">✓ {mu.type === "video" ? mu.video_id?.slice(0,8) : mu.hash?.slice(0,8)}</span>;
                          if (mu.status === "error") return <span className="text-[#ef4444] ml-2">✗ {mu.error?.slice(0,40)}</span>;
                          return null;
                        })()}
                      </p>
                    </div>
                    {false && (
                      <select
                        value={member?.placement ?? "feed"}
                        onChange={(e) => setPlacement(groupIdx, i, e.target.value as "feed" | "stories")}
                        className="text-xs font-mono bg-[#1c1c1c] border border-[#2a2a2a] rounded px-2 py-1 text-[#aaa] focus:outline-none focus:border-[#3b82f6] mr-2"
                      >
                        <option value="feed">Feed (1:1 / 4:5)</option>
                        <option value="stories">Stories / 9:16</option>
                      </select>
                    )}
                    {false && (
                      <button onClick={() => ungroup(groupIdx)} className="text-xs font-mono text-[#888] hover:text-[#f5f5f5] transition-colors mr-2">
                        desagrupar
                      </button>
                    )}
                    <button onClick={() => removeFile(i)} className="text-[#888] hover:text-[#ef4444] transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {false && groups.length > 0 && (
              <p className="text-xs font-mono text-[#888]">
                {groups.length} grupo{groups.length > 1 ? "s" : ""} multi-ratio · {adItems.length} ads en total
              </p>
            )}

            {/* Upload to Meta button */}
            {mediaUploads.length === 0 && (
              <button
                onClick={uploadAllFiles}
                disabled={uploadingMedia}
                className="w-full bg-[#1c1c1c] hover:bg-[#2a2a2a] disabled:opacity-40 text-[#f5f5f5] font-mono text-sm py-2.5 rounded-md border border-[#2a2a2a] transition-colors"
              >
                {uploadingMedia ? "Subiendo..." : "Subir archivos a Meta"}
              </button>
            )}
            {mediaUploads.length > 0 && mediaUploads.every((m) => m.status === "done") && (
              <p className="text-xs font-mono text-[#10b981] text-center">✓ Todos los archivos subidos a Meta</p>
            )}
            {mediaUploads.some((m) => m.status === "error") && (
              <button
                onClick={uploadAllFiles}
                disabled={uploadingMedia}
                className="w-full bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] font-mono text-sm py-2.5 rounded-md border border-[#ef4444]/30 transition-colors"
              >
                Reintentar subida
              </button>
            )}
          </>
        )}
      </section>

      {/* Section 2: Destino */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Destino</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[#3b82f6]" />
          <span className="text-xs font-mono text-[#888]">Solo activos</span>
        </label>

        <div className="grid grid-cols-3 gap-4">
          {/* Campaign column */}
          <div className="space-y-2">
            <label className={labelClass}>Campaña</label>
            <input type="text" placeholder="Buscar..." value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} className={inputClass} />
            {loadingCampaigns ? (
              <p className="text-xs font-mono text-[#888] px-1">Cargando...</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-48 overflow-y-auto">
                {filteredCampaigns.length === 0 ? (
                  <p className="text-xs font-mono text-[#888] px-3 py-3">Sin resultados</p>
                ) : filteredCampaigns.map((c) => (
                  <button key={c.id} onClick={() => setSelectedCampaignId(c.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${selectedCampaignId === c.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"}`}>
                    <span className="truncate">{c.name}</span>
                    {selectedCampaignId === c.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
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
              <p className="text-xs font-mono text-[#888] px-1">Cargando...</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-48 overflow-y-auto">
                {filteredAdsets.length === 0 ? (
                  <p className="text-xs font-mono text-[#888] px-3 py-3">Sin resultados</p>
                ) : filteredAdsets.map((a) => (
                  <button key={a.id} onClick={() => setSelectedAdsetId(a.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${selectedAdsetId === a.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"}`}>
                    <span className="truncate">{a.name}</span>
                    {selectedAdsetId === a.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ads column */}
          <div className="space-y-2">
            <label className={labelClass}>Anuncio fuente</label>
            {!selectedAdsetId ? (
              <p className="text-xs font-mono text-[#333] px-1">Seleccioná un Ad Set primero</p>
            ) : loadingSourceAds ? (
              <p className="text-xs font-mono text-[#888] px-1">Cargando...</p>
            ) : sourceAds.length === 0 ? (
              <p className="text-xs font-mono text-[#888] px-3 py-3">Sin anuncios en este Ad Set</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-md max-h-48 overflow-y-auto">
                {sourceAds.map((a) => (
                  <button key={a.id} onClick={() => { setSelectedSourceAdId(a.id); loadAdDetails(a.id); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-mono transition-colors ${selectedSourceAdId === a.id ? "bg-[#3b82f6]/10 text-[#f5f5f5]" : "text-[#aaa] hover:bg-[#1c1c1c]"}`}>
                    <span className="truncate">{a.name}</span>
                    {selectedSourceAdId === a.id && <ChevronRight className="w-3 h-3 shrink-0 text-[#3b82f6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 2.75: Variantes de copy del anuncio fuente */}
      {sourceCopies.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Variantes de copy ({sourceCopies.length})</h2>
            <button
              onClick={() => { setSourceCopies([]); setCommonCopy({ headline: "", primaryText: "", linkDescription: "", url: "", cta: "SHOP_NOW" }); setPerAdCopy(files.map(() => ({ headline: "", primaryText: "", linkDescription: "", url: "", cta: "SHOP_NOW" }))); }}
              className="text-xs font-mono text-[#888] hover:text-[#ef4444] transition-colors"
            >
              Limpiar
            </button>
          </div>
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#888] w-8">#</th>
                  <th className="text-left px-3 py-2 text-[#888]">Headline</th>
                  <th className="text-left px-3 py-2 text-[#888]">Primary Text</th>
                  <th className="text-left px-3 py-2 text-[#888]">Descripción</th>
                  <th className="text-left px-3 py-2 text-[#888] w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {sourceCopies.map((c, i) => (
                  <tr key={i} className="bg-[#0a0a0a]">
                    <td className="px-3 py-2 text-[#888] text-center">{i + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={c.headline}
                        onChange={(e) => updateSourceCopy(i, "headline", e.target.value)}
                        className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <textarea
                        value={c.primaryText}
                        onChange={(e) => updateSourceCopy(i, "primaryText", e.target.value)}
                        rows={2}
                        className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6] resize-none"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={c.linkDescription}
                        onChange={(e) => updateSourceCopy(i, "linkDescription", e.target.value)}
                        className="w-full bg-transparent border border-[#2a2a2a] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#3b82f6]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => applySourceCopyToCommon(i)}
                          className="text-[10px] font-mono px-2 py-1 bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 rounded transition-colors"
                          title="Usar esta variante en el formulario"
                        >
                          Usar
                        </button>
                        <button
                          onClick={() => removeSourceCopy(i)}
                          className="text-[10px] font-mono px-2 py-1 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 rounded transition-colors"
                          title="Eliminar variante"
                        >
                          X
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 3: Copy */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Copy</h2>
        {!defaults?.facebook_page_id && (
          <div className="space-y-1">
            <label className={labelClass}>Página de Facebook</label>
            <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={selectClass}>
              <option value="">Seleccioná una página</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

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
              <p className="text-xs font-mono text-[#888]">Editá el copy de cada ad individualmente</p>
              <button onClick={applyCommonToAll} className="text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa] transition-colors">Aplicar copy común a todos</button>
            </div>
            {adItems.length === 0 ? (
              <p className="text-xs font-mono text-[#333]">Subí archivos primero</p>
            ) : (
              <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#888] w-12">Ad</th>
                      <th className="text-left px-3 py-2 text-[#888]">Headline</th>
                      <th className="text-left px-3 py-2 text-[#888]">Primary Text</th>
                      <th className="text-left px-3 py-2 text-[#888]">Descripción</th>
                      <th className="text-left px-3 py-2 text-[#888]">URL</th>
                      <th className="text-left px-3 py-2 text-[#888] w-28">CTA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {adItems.map((item, i) => {
                      const thumb = item.type === "single" ? previews[item.fileIdx] : previews[item.members[0].fileIdx];
                      const isVideo = item.type === "single"
                        ? files[item.fileIdx]?.type.startsWith("video/")
                        : item.members.some((m) => files[m.fileIdx]?.type.startsWith("video/"));
                      return (
                        <tr key={i} className="bg-[#0a0a0a]">
                          <td className="px-3 py-2">
                            <div className="relative">
                              {thumb ? <img src={thumb} alt="" className="w-8 h-8 object-cover rounded" /> : (
                                <div className="w-8 h-8 bg-[#1c1c1c] rounded flex items-center justify-center">
                                  {isVideo ? <FileVideo className="w-4 h-4 text-[#3b82f6]" /> : <FileImage className="w-4 h-4 text-[#888]" />}
                                </div>
                              )}
                              {item.type === "group" && <span className="absolute -top-1 -right-1 bg-[#3b82f6] text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">{item.members.length}</span>}
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
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Nombre de ads</h2>
        <div className="space-y-2">
          <input type="text" value={adNamePattern} onChange={(e) => setAdNamePattern(e.target.value)} placeholder="{filename}" className={inputClass} />
          <div className="flex gap-2 flex-wrap">
            {PATTERN_VARS.map((v) => (
              <button key={v} onClick={() => setAdNamePattern((p) => p + v)}
                className="text-[10px] font-mono px-2 py-0.5 bg-[#141414] border border-[#2a2a2a] rounded text-[#888] hover:text-[#3b82f6] hover:border-[#3b82f6] transition-colors">
                {v}
              </button>
            ))}
          </div>
          {adNamePattern && (
            <p className="text-xs font-mono text-[#888]">
              Preview: <span className="text-[#aaa]">{resolvePatternPreview(adNamePattern, selectedCampaign?.name ?? "", selectedAdset?.name ?? "")}</span>
            </p>
          )}
        </div>
      </section>

      {/* Section 5: Publication + Scheduling */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Publicación</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={createPaused} onChange={(e) => { setCreatePaused(e.target.checked); if (e.target.checked) setScheduleEnabled(false); }} className="accent-[#3b82f6]" />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Crear ads en pausa</p>
            <p className="text-xs font-mono text-[#888]">Activalos manualmente en Ads Manager</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={scheduleEnabled} onChange={(e) => { setScheduleEnabled(e.target.checked); if (e.target.checked) setCreatePaused(false); }} className="accent-[#3b82f6]" />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Programar inicio</p>
            <p className="text-xs font-mono text-[#888]">Ads se crean activos con fecha de inicio programada</p>
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
        <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Ventajas creativas</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={advantagePlus} onChange={(e) => setAdvantagePlus(e.target.checked)} className="accent-[#3b82f6]" />
          <div>
            <p className="text-sm font-mono text-[#f5f5f5]">Creative Enhancements (Meta Defaults)</p>
            <p className="text-xs font-mono text-[#888]">Meta aplica automáticamente mejoras básicas al creativo</p>
          </div>
        </label>
      </section>

      {/* Section 7: Preview */}
      {adItems.length > 0 && selectedAdsetId && (
        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Preview</h2>
          <p className="text-xs font-mono text-[#888]">
            Se crearán <span className="text-[#f5f5f5]">{adItems.length} ads</span> en{" "}
            <span className="text-[#f5f5f5]">{selectedAdset?.name ?? selectedAdsetId}</span>
            {selectedCampaign && <> › <span className="text-[#3b82f6]">{selectedCampaign.name}</span></>}
          </p>
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#141414] border-b border-[#2a2a2a]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#888]">Nombre</th>
                  <th className="text-left px-3 py-2 text-[#888]">Tipo</th>
                  <th className="text-left px-3 py-2 text-[#888]">Headline</th>
                  <th className="text-left px-3 py-2 text-[#888]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {adItems.map((item, i) => {
                  const copy = copyMode === "common" ? commonCopy : (perAdCopy[i] ?? commonCopy);
                  const result = results[i];
                  const file = item.type === "single" ? files[item.fileIdx] : files[item.members[0].fileIdx];
                  const filename = file?.name.replace(/\.[^.]+$/, "") ?? "";
                  const resolvedName = resolvePatternPreview(adNamePattern, selectedCampaign?.name ?? "", selectedAdset?.name ?? "").replace("nombre_archivo", filename);
                  const tipo = item.type === "group" ? `multi-ratio (${item.members.length})` : (file?.type.startsWith("video/") ? "video" : "imagen");
                  return (
                    <tr key={i} className="bg-[#0a0a0a]">
                      <td className="px-3 py-2 text-[#f5f5f5] max-w-[160px] truncate">{resolvedName}</td>
                      <td className="px-3 py-2 text-[#888]">{tipo}</td>
                      <td className="px-3 py-2 text-[#aaa] max-w-[180px] truncate">{copy?.headline || "—"}</td>
                      <td className="px-3 py-2">
                        {result ? (
                          result.error ? <span className="text-[#ef4444]">Error</span> : <span className="text-[#10b981]">Creado</span>
                        ) : (
                          <span className="text-[#888]">
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

      {/* Log panel */}
      {(uploading || results.length > 0) && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#888]">Log</h2>
          <div className="border border-[#2a2a2a] rounded-lg bg-[#0a0a0a] p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
            {uploadStep && (
              <p className="text-[#3b82f6]">{uploadStep}</p>
            )}
            {results.map((r, i) => (
              <p key={i} className={r.error ? "text-[#ef4444]" : "text-[#10b981]"}>
                {r.error ? `✗ ${r.name}: ${r.error}` : `✓ ${r.name} → ${r.adId}`}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
