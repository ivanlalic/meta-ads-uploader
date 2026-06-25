import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { getTokenForAccount } from "@/lib/meta/client";

const BASE_URL = "https://graph.facebook.com/v25.0";

async function uploadImage(adAccountId: string, token: string, file: File): Promise<{ hash: string }> {
  const bytes = await file.arrayBuffer();
  const b64 = Buffer.from(bytes).toString("base64");
  const body = new URLSearchParams();
  body.set("bytes", b64);
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/adimages`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
  const images = json.images as Record<string, { hash: string }>;
  return Object.values(images)[0];
}

async function uploadVideo(adAccountId: string, token: string, file: File): Promise<{ video_id: string; image_hash?: string }> {
  const formData = new FormData();
  formData.append("source", file);
  formData.append("title", file.name.replace(/\.[^.]+$/, ""));
  formData.append("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/advideos`, { method: "POST", body: formData });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}`);
  const videoId: string = json.id;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const sr = await fetch(`${BASE_URL}/${videoId}?fields=status&access_token=${token}`);
    const sj = await sr.json();
    if (sj.status?.video_status === "ready") break;
    if (sj.status?.video_status === "error") throw new Error("Video processing failed");
  }

  // Fetch auto-generated thumbnail and upload as ad image
  let image_hash: string | undefined;
  try {
    const thumbRes = await fetch(`${BASE_URL}/${videoId}/thumbnails?fields=uri&access_token=${token}`);
    const thumbJson = await thumbRes.json();
    const thumbnails = thumbJson.data as { uri: string }[] | undefined;
    if (thumbnails && thumbnails.length > 0) {
      const dl = await fetch(thumbnails[0].uri);
      const b64 = Buffer.from(await dl.arrayBuffer()).toString("base64");
      const imgBody = new URLSearchParams();
      imgBody.set("bytes", b64);
      imgBody.set("access_token", token);
      const imgRes = await fetch(`${BASE_URL}/${adAccountId}/adimages`, { method: "POST", body: imgBody });
      const imgJson = await imgRes.json();
      if (!imgJson.error) {
        const images = imgJson.images as Record<string, { hash: string }>;
        image_hash = Object.values(images)[0].hash;
      }
    }
  } catch {
    // thumbnail fetch/upload failed — proceed without it
  }

  return { video_id: videoId, image_hash };
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
      const { hash } = await uploadImage(adAccountId, token, file);
      return NextResponse.json({ type: "image", hash, filename: file.name });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
