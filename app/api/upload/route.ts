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

function resolvePattern(
  pattern: string,
  filename: string,
  index: number,
  campaignName: string,
  adsetName: string
): string {
  const date = new Date().toISOString().split("T")[0];
  return pattern
    .replace(/\{filename\}/g, filename)
    .replace(/\{date\}/g, date)
    .replace(/\{index\}/g, String(index + 1))
    .replace(/\{campaign\}/g, campaignName)
    .replace(/\{adset\}/g, adsetName);
}

async function uploadImage(adAccountId: string, token: string, file: File): Promise<{ hash: string }> {
  const bytes = await file.arrayBuffer();
  const b64 = Buffer.from(bytes).toString("base64");
  const body = new URLSearchParams();
  body.set("bytes", b64);
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/adimages`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const images = json.images as Record<string, { hash: string }>;
  return Object.values(images)[0];
}

async function uploadVideo(adAccountId: string, token: string, file: File): Promise<{ video_id: string }> {
  const formData = new FormData();
  formData.append("source", file);
  formData.append("title", file.name.replace(/\.[^.]+$/, ""));
  formData.append("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/advideos`, { method: "POST", body: formData });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const videoId: string = json.id;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const sr = await fetch(`${BASE_URL}/${videoId}?fields=status&access_token=${token}`);
    const sj = await sr.json();
    if (sj.status?.video_status === "ready") break;
    if (sj.status?.video_status === "error") throw new Error("Video processing failed");
  }
  return { video_id: videoId };
}

async function createSingleCreative(
  adAccountId: string,
  token: string,
  pageId: string,
  copy: AdCopy,
  media: { type: "image"; hash: string } | { type: "video"; video_id: string },
  advantagePlus: boolean
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
        call_to_action: { type: copy.cta, value: { link: copy.url } },
      },
    };
  }
  const body = new URLSearchParams();
  body.set("object_story_spec", JSON.stringify(objectStorySpec));
  if (advantagePlus) {
    body.set("degrees_of_freedom_spec", JSON.stringify({
      creative_features_spec: { standard_enhancements: { enroll_status: "OPT_IN" } },
    }));
  }
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/adcreatives`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.id as string;
}

async function createGroupCreative(
  adAccountId: string,
  token: string,
  pageId: string,
  copy: AdCopy,
  hashes: string[],
  videoIds: string[],
  advantagePlus: boolean
): Promise<string> {
  const assetFeedSpec: Record<string, unknown> = {
    bodies: [{ text: copy.primaryText || " " }],
    titles: [{ text: copy.headline }],
    link_urls: [{ website_url: copy.url }],
    call_to_action_types: [copy.cta],
  };
  if (copy.linkDescription) assetFeedSpec.descriptions = [{ text: copy.linkDescription }];
  if (hashes.length > 0) assetFeedSpec.images = hashes.map((h) => ({ hash: h }));
  if (videoIds.length > 0) assetFeedSpec.videos = videoIds.map((id) => ({ video_id: id }));

  const body = new URLSearchParams();
  body.set("asset_feed_spec", JSON.stringify(assetFeedSpec));
  body.set("object_type", "SHARE");
  if (advantagePlus) {
    body.set("degrees_of_freedom_spec", JSON.stringify({
      creative_features_spec: { standard_enhancements: { enroll_status: "OPT_IN" } },
    }));
  }
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/adcreatives`, { method: "POST", body });
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
  status: "ACTIVE" | "PAUSED",
  startTime?: string
): Promise<string> {
  const body = new URLSearchParams();
  body.set("name", name);
  body.set("adset_id", adsetId);
  body.set("creative", JSON.stringify({ creative_id: creativeId }));
  body.set("status", status);
  if (startTime) body.set("start_time", startTime);
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/ads`, { method: "POST", body });
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
    adNamePattern: string;
    startTime?: string;
    advantagePlus: boolean;
    groups: number[][];
  };

  const files = formData.getAll("files") as File[];
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 });

  const adAccountId = account.ad_account_id;
  const results: { name: string; adId: string | null; error: string | null }[] = [];

  const groupedIndices = new Set(config.groups.flat());

  // Build ordered list of ad items: singles first (in file order), then groups
  type AdItem =
    | { type: "single"; fileIdx: number; copyIdx: number }
    | { type: "group"; fileIndices: number[]; copyIdx: number };

  const adItems: AdItem[] = [];
  let copyIdx = 0;

  for (let i = 0; i < files.length; i++) {
    if (!groupedIndices.has(i)) {
      adItems.push({ type: "single", fileIdx: i, copyIdx: copyIdx++ });
    }
  }
  for (const group of config.groups) {
    adItems.push({ type: "group", fileIndices: group, copyIdx: copyIdx++ });
  }

  for (const item of adItems) {
    const copy = config.copies[item.copyIdx] ?? config.copies[0];
    let adName: string;

    if (item.type === "single") {
      const file = files[item.fileIdx];
      const filename = file.name.replace(/\.[^.]+$/, "");
      adName = resolvePattern(config.adNamePattern || "{filename}", filename, item.copyIdx, config.campaignName, config.adsetName);

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
        const creativeId = await createSingleCreative(adAccountId, token, config.pageId, copy, media, config.advantagePlus);
        const adId = await createAd(adAccountId, token, config.adsetId, creativeId, adName, config.status, config.startTime);

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
          creative_type: files[item.fileIdx].type.startsWith("video/") ? "video" : "image",
          initial_status: config.status,
          result: "error",
          error_message: message,
        });
        results.push({ name: adName, adId: null, error: message });
      }
    } else {
      // Group: multiple files → one asset_feed_spec creative
      const groupFiles = item.fileIndices.map((i) => files[i]);
      const firstName = groupFiles[0].name.replace(/\.[^.]+$/, "");
      adName = resolvePattern(config.adNamePattern || "{filename}", firstName, item.copyIdx, config.campaignName, config.adsetName);

      try {
        const hashes: string[] = [];
        const videoIds: string[] = [];

        for (const file of groupFiles) {
          if (file.type.startsWith("video/")) {
            const { video_id } = await uploadVideo(adAccountId, token, file);
            videoIds.push(video_id);
          } else {
            const { hash } = await uploadImage(adAccountId, token, file);
            hashes.push(hash);
          }
        }

        const creativeId = await createGroupCreative(adAccountId, token, config.pageId, copy, hashes, videoIds, config.advantagePlus);
        const adId = await createAd(adAccountId, token, config.adsetId, creativeId, adName, config.status, config.startTime);

        await db.insert(upload_history).values({
          account_id: accountId,
          action: "create_ad",
          campaign_id: config.campaignId,
          campaign_name: config.campaignName,
          adset_id: config.adsetId,
          adset_name: config.adsetName,
          ad_name: adName,
          creative_type: "multi-ratio",
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
          creative_type: "multi-ratio",
          initial_status: config.status,
          result: "error",
          error_message: message,
        });
        results.push({ name: adName, adId: null, error: message });
      }
    }
  }

  return NextResponse.json({ results });
}
