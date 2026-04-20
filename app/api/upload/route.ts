import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { getTokenForAccount } from "@/lib/meta/client";
import { db } from "@/lib/db";
import { upload_history } from "@/lib/db/schema";

const BASE_URL = "https://graph.facebook.com/v21.0";

type AdCopy = {
  headline: string;
  primaryText: string;
  linkDescription: string;
  url: string;
  cta: string;
};

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

  const res = await fetch(`${BASE_URL}/${adAccountId}/adimages`, {
    method: "POST",
    body,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const images = json.images as Record<string, { hash: string }>;
  return Object.values(images)[0];
}

async function uploadVideo(
  adAccountId: string,
  token: string,
  file: File
): Promise<{ video_id: string }> {
  const formData = new FormData();
  formData.append("source", file);
  formData.append("title", file.name.replace(/\.[^.]+$/, ""));
  formData.append("access_token", token);

  const res = await fetch(`${BASE_URL}/${adAccountId}/advideos`, {
    method: "POST",
    body: formData,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);

  const videoId: string = json.id;
  // Poll until video is ready
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(
      `${BASE_URL}/${videoId}?fields=status&access_token=${token}`
    );
    const statusJson = await statusRes.json();
    if (statusJson.status?.video_status === "ready") break;
    if (statusJson.status?.video_status === "error") {
      throw new Error("Video processing failed");
    }
  }

  return { video_id: videoId };
}

async function createAdCreative(
  adAccountId: string,
  token: string,
  pageId: string,
  copy: AdCopy,
  media: { type: "image"; hash: string } | { type: "video"; video_id: string }
): Promise<string> {
  let objectStorySpec: Record<string, unknown>;

  if (media.type === "image") {
    objectStorySpec = {
      page_id: pageId,
      link_data: {
        image_hash: media.hash,
        link: copy.url,
        message: copy.primaryText,
        name: copy.headline,
        description: copy.linkDescription || undefined,
        call_to_action: { type: copy.cta },
      },
    };
  } else {
    objectStorySpec = {
      page_id: pageId,
      video_data: {
        video_id: media.video_id,
        title: copy.headline,
        message: copy.primaryText,
        link_description: copy.linkDescription || undefined,
        call_to_action: {
          type: copy.cta,
          value: { link: copy.url },
        },
      },
    };
  }

  const body = new URLSearchParams();
  body.set("object_story_spec", JSON.stringify(objectStorySpec));
  body.set("access_token", token);

  const res = await fetch(`${BASE_URL}/${adAccountId}/adcreatives`, {
    method: "POST",
    body,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.id as string;
}

async function createAd(
  adAccountId: string,
  token: string,
  adsetId: string,
  creativeId: string,
  name: string,
  status: "ACTIVE" | "PAUSED"
): Promise<string> {
  const body = new URLSearchParams();
  body.set("name", name);
  body.set("adset_id", adsetId);
  body.set("creative", JSON.stringify({ creative_id: creativeId }));
  body.set("status", status);
  body.set("access_token", token);

  const res = await fetch(`${BASE_URL}/${adAccountId}/ads`, {
    method: "POST",
    body,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.id as string;
}

export async function POST(req: NextRequest) {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const account = await getAccountById(accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const token = await getTokenForAccount(accountId);
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 401 });

  const formData = await req.formData();
  const configRaw = formData.get("config") as string;
  if (!configRaw) return NextResponse.json({ error: "Missing config" }, { status: 400 });

  const config = JSON.parse(configRaw) as {
    adsetId: string;
    campaignId: string;
    campaignName: string;
    adsetName: string;
    pageId: string;
    status: "ACTIVE" | "PAUSED";
    copies: AdCopy[];
  };

  const files = formData.getAll("files") as File[];
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 });

  const adAccountId = account.ad_account_id;
  const results: { name: string; adId: string | null; error: string | null }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const copy = config.copies[i] ?? config.copies[0];
    const adName = file.name.replace(/\.[^.]+$/, "");

    try {
      const isVideo = file.type.startsWith("video/");
      let media: { type: "image"; hash: string } | { type: "video"; video_id: string };

      if (isVideo) {
        const { video_id } = await uploadVideo(adAccountId, token, file);
        media = { type: "video", video_id };
      } else {
        const { hash } = await uploadImage(adAccountId, token, file);
        media = { type: "image", hash };
      }

      const creativeId = await createAdCreative(adAccountId, token, config.pageId, copy, media);
      const adId = await createAd(adAccountId, token, config.adsetId, creativeId, adName, config.status);

      await db.insert(upload_history).values({
        account_id: accountId,
        action: "create_ad",
        campaign_id: config.campaignId,
        campaign_name: config.campaignName,
        adset_id: config.adsetId,
        adset_name: config.adsetName,
        ad_name: adName,
        creative_type: isVideo ? "video" : "image",
        initial_status: config.status,
        result: "success",
      });

      results.push({ name: adName, adId, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      await db.insert(upload_history).values({
        account_id: accountId,
        action: "create_ad",
        campaign_id: config.campaignId,
        campaign_name: config.campaignName,
        adset_id: config.adsetId,
        adset_name: config.adsetName,
        ad_name: adName,
        creative_type: file.type.startsWith("video/") ? "video" : "image",
        initial_status: config.status,
        result: "error",
        error_message: message,
      });

      results.push({ name: adName, adId: null, error: message });
    }
  }

  return NextResponse.json({ results });
}
