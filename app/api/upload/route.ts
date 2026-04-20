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

type MediaRef =
  | { type: "image"; hash: string; filename: string }
  | { type: "video"; video_id: string; filename: string };

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

async function createSingleCreative(
  adAccountId: string,
  token: string,
  pageId: string,
  copy: AdCopy,
  media: MediaRef,
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
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}${json.error.error_subcode ? ` (${json.error.error_subcode})` : ""}`);
  return json.id as string;
}

async function createGroupCreative(
  adAccountId: string,
  token: string,
  pageId: string,
  copy: AdCopy,
  mediaRefs: MediaRef[],
  advantagePlus: boolean
): Promise<string> {
  const hashes = mediaRefs.filter((m) => m.type === "image").map((m) => (m as { type: "image"; hash: string }).hash);
  const videoIds = mediaRefs.filter((m) => m.type === "video").map((m) => (m as { type: "video"; video_id: string }).video_id);

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
  body.set("page_id", pageId);
  if (advantagePlus) {
    body.set("degrees_of_freedom_spec", JSON.stringify({
      creative_features_spec: { standard_enhancements: { enroll_status: "OPT_IN" } },
    }));
  }
  body.set("access_token", token);
  const res = await fetch(`${BASE_URL}/${adAccountId}/adcreatives`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}${json.error.error_subcode ? ` (${json.error.error_subcode})` : ""}`);
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
  if (json.error) throw new Error(`[${json.error.code}] ${json.error.message}${json.error.error_subcode ? ` (${json.error.error_subcode})` : ""}`);
  return json.id as string;
}

export async function POST(req: NextRequest) {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const account = await getAccountById(accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const token = await getTokenForAccount(accountId);
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 401 });

  const config = await req.json() as {
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
    media: MediaRef[];
  };

  if (!config.media || config.media.length === 0) {
    return NextResponse.json({ error: "No media" }, { status: 400 });
  }

  const adAccountId = account.ad_account_id;
  const results: { name: string; adId: string | null; error: string | null }[] = [];

  const groupedIndices = new Set(config.groups.flat());

  type AdItem =
    | { type: "single"; mediaIdx: number; copyIdx: number }
    | { type: "group"; mediaIndices: number[]; copyIdx: number };

  const adItems: AdItem[] = [];
  let copyIdx = 0;

  for (let i = 0; i < config.media.length; i++) {
    if (!groupedIndices.has(i)) {
      adItems.push({ type: "single", mediaIdx: i, copyIdx: copyIdx++ });
    }
  }
  for (const group of config.groups) {
    adItems.push({ type: "group", mediaIndices: group, copyIdx: copyIdx++ });
  }

  for (const item of adItems) {
    const copy = config.copies[item.copyIdx] ?? config.copies[0];
    let adName: string;

    if (item.type === "single") {
      const mediaRef = config.media[item.mediaIdx];
      const filename = mediaRef.filename.replace(/\.[^.]+$/, "");
      adName = resolvePattern(config.adNamePattern || "{filename}", filename, item.copyIdx, config.campaignName, config.adsetName);

      try {
        const creativeId = await createSingleCreative(adAccountId, token, config.pageId, copy, mediaRef, config.advantagePlus);
        const adId = await createAd(adAccountId, token, config.adsetId, creativeId, adName, config.status, config.startTime);

        await db.insert(upload_history).values({
          account_id: accountId,
          action: "create_ad",
          campaign_id: config.campaignId,
          campaign_name: config.campaignName,
          adset_id: config.adsetId,
          adset_name: config.adsetName,
          ad_name: adName,
          creative_type: mediaRef.type === "video" ? "video" : "image",
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
          creative_type: config.media[item.mediaIdx].type === "video" ? "video" : "image",
          initial_status: config.status,
          result: "error",
          error_message: message,
        });
        results.push({ name: adName, adId: null, error: message });
      }
    } else {
      const groupRefs = item.mediaIndices.map((i) => config.media[i]);
      const firstName = groupRefs[0].filename.replace(/\.[^.]+$/, "");
      adName = resolvePattern(config.adNamePattern || "{filename}", firstName, item.copyIdx, config.campaignName, config.adsetName);

      try {
        const creativeId = await createGroupCreative(adAccountId, token, config.pageId, copy, groupRefs, config.advantagePlus);
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
