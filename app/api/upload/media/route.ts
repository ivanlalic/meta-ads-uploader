import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { getTokenForAccount } from "@/lib/meta/client";

const BASE_URL = "https://graph.facebook.com/v25.0";
const GRAPH_VIDEO_URL = "https://graph-video.facebook.com/v25.0";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const VIDEO_CHUNK_SIZE = 8 * 1024 * 1024;
const VIDEO_READY_TIMEOUT_MS = 10 * 60 * 1000;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadImage(
  adAccountId: string,
  token: string,
  file: File
): Promise<{ hash: string }> {
  const bytes = await file.arrayBuffer();
  const b64 = Buffer.from(bytes).toString("base64");
  const body = new URLSearchParams();
  body.set("bytes", b64);
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/adimages`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
  const images = json.images as Record<string, { hash: string }>;
  const first = Object.values(images)[0];
  if (!first?.hash) throw new Error("Image upload returned no hash");
  return { hash: first.hash };
}

async function videoStart(
  adAccountId: string,
  token: string,
  fileSize: number
): Promise<{ upload_session_id: string; video_id: string; start_offset: number; end_offset: number }> {
  const body = new URLSearchParams();
  body.set("access_token", token);
  body.set("upload_phase", "start");
  body.set("file_size", String(fileSize));
  const res = await fetch(`${GRAPH_VIDEO_URL}/${adAccountId}/advideos`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
  if (!json.upload_session_id || !json.video_id) {
    throw new Error("Video upload start returned no session");
  }
  return {
    upload_session_id: json.upload_session_id,
    video_id: json.video_id,
    start_offset: Number(json.start_offset ?? 0),
    end_offset: Number(json.end_offset ?? fileSize),
  };
}

async function videoTransfer(
  adAccountId: string,
  token: string,
  uploadSessionId: string,
  chunk: Uint8Array,
  startOffset: number
): Promise<number> {
  const form = new FormData();
  form.append("access_token", token);
  form.append("upload_phase", "transfer");
  form.append("upload_session_id", uploadSessionId);
  form.append("start_offset", String(startOffset));
  form.append("video_file_chunk", new Blob([chunk as unknown as BlobPart]), "chunk.bin");
  const res = await fetch(`${GRAPH_VIDEO_URL}/${adAccountId}/advideos`, { method: "POST", body: form });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
  return Number(json.start_offset ?? json.end_offset ?? chunk.length + startOffset);
}

async function videoFinish(
  adAccountId: string,
  token: string,
  uploadSessionId: string,
  title: string
): Promise<void> {
  const body = new URLSearchParams();
  body.set("access_token", token);
  body.set("upload_phase", "finish");
  body.set("upload_session_id", uploadSessionId);
  body.set("title", title.slice(0, 255));
  const res = await fetch(`${GRAPH_VIDEO_URL}/${adAccountId}/advideos`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
}

async function waitForVideoReady(videoId: string, token: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < VIDEO_READY_TIMEOUT_MS) {
    const res = await fetch(`${BASE_URL}/${videoId}?fields=status&access_token=${token}`);
    const json = await res.json();
    const status = json.status ?? {};
    if (status.video_status === "ready") return;
    if (
      status.video_status === "error" ||
      status.processing_phase?.status === "failed" ||
      status.uploading_phase?.status === "failed"
    ) {
      throw new Error("Video processing failed");
    }
    await sleep(5000);
  }
  throw new Error("Video processing timed out");
}

async function fetchThumbnailHash(
  adAccountId: string,
  token: string,
  videoId: string
): Promise<string | undefined> {
  let thumbnails: { uri: string }[] = [];

  const preferredRes = await fetch(
    `${BASE_URL}/${videoId}/thumbnails?fields=uri&is_preferred=true&access_token=${token}`
  );
  const preferredJson = await preferredRes.json();
  if (!preferredJson.error && preferredJson.data?.length) {
    thumbnails = preferredJson.data;
  } else {
    const allRes = await fetch(`${BASE_URL}/${videoId}/thumbnails?fields=uri&access_token=${token}`);
    const allJson = await allRes.json();
    thumbnails = allJson.data ?? [];
  }

  for (const thumb of thumbnails) {
    if (!thumb.uri) continue;
    try {
      const dl = await fetch(thumb.uri);
      if (!dl.ok) continue;
      const b64 = Buffer.from(await dl.arrayBuffer()).toString("base64");
      const imgBody = new URLSearchParams();
      imgBody.set("bytes", b64);
      imgBody.set("access_token", token);
      const imgRes = await fetch(`${BASE_URL}/${adAccountId}/adimages`, { method: "POST", body: imgBody });
      const imgJson = await imgRes.json();
      if (!imgJson.error) {
        const images = imgJson.images as Record<string, { hash: string }>;
        const hash = Object.values(images)[0]?.hash;
        if (hash) return hash;
      }
    } catch {
      // try next thumbnail
    }
  }
  return undefined;
}

async function uploadVideo(
  adAccountId: string,
  token: string,
  file: File
): Promise<{ video_id: string; image_hash?: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileSize = bytes.length;

  const session = await videoStart(adAccountId, token, fileSize);

  let offset = session.start_offset;
  while (offset < fileSize) {
    const end = Math.min(offset + VIDEO_CHUNK_SIZE, fileSize);
    const chunk = bytes.slice(offset, end);
    const nextOffset = await videoTransfer(adAccountId, token, session.upload_session_id, chunk, offset);
    if (nextOffset <= offset) break;
    offset = nextOffset;
  }

  await videoFinish(
    adAccountId,
    token,
    session.upload_session_id,
    file.name.replace(/\.[^.]+$/, "")
  );

  await waitForVideoReady(session.video_id, token);

  const image_hash = await fetchThumbnailHash(adAccountId, token, session.video_id);

  return { video_id: session.video_id, image_hash };
}

export async function POST(req: NextRequest) {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const account = await getAccountById(accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const token = await getTokenForAccount(accountId);
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const adAccountId = account.ad_account_id;
  const isVideo = file.type.startsWith("video/");

  try {
    if (isVideo) {
      const { video_id, image_hash } = await uploadVideo(adAccountId, token, file);
      return NextResponse.json({ type: "video", video_id, image_hash, filename: file.name });
    } else {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Formato de imagen no soportado: ${file.type || "desconocido"}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "La imagen supera el máximo de 30MB" }, { status: 400 });
      }
      const { hash } = await uploadImage(adAccountId, token, file);
      return NextResponse.json({ type: "image", hash, filename: file.name });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
