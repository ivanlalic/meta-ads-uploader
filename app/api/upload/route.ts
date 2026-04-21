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

type GroupMember = { fileIdx: number; placement: "feed" | "stories" };

async function createPlacementCreative(
  adAccountId: string,
  token: string,
  pageId: string,
  copy: AdCopy,
  members: GroupMember[],
  mediaRefs: MediaRef[],
  advantagePlus: boolean
): Promise<string> {
  const feedMember = members.find((m) => m.placement === "feed") ?? members[0];
  const storiesMember = members.find((m) => m.placement === "stories");
  const feedMedia = mediaRefs[feedMember.fileIdx];
  const storiesMedia = storiesMember ? mediaRefs[storiesMember.fileIdx] : null;

  // No stories asset — fall back to single creative
  if (!storiesMedia) {
    return createSingleCreative(adAccountId, token, pageId, copy, feedMedia, advantagePlus);
  }

  const FEED_LABEL = "asset_feed";
  const STORIES_LABEL = "asset_stories";

  const images: Record<string, unknown>[] = [];
  const videos: Record<string, unknown>[] = [];

  if (feedMedia.type === "image") {
    images.push({ hash: feedMedia.hash, adlabels: [{ name: FEED_LABEL }] });
  } else {
    videos.push({ video_id: feedMedia.video_id, adlabels: [{ name: FEED_LABEL }] });
  }

  if (storiesMedia.type === "image") {
    images.push({ hash: storiesMedia.hash, adlabels: [{ name: STORIES_LABEL }] });
  } else {
    videos.push({ video_id: storiesMedia.video_id, adlabels: [{ name: STORIES_LABEL }] });
  }

  const storiesAssetKey = storiesMedia.type === "image" ? "image_label" : "video_label";
  const feedAssetKey = feedMedia.type === "image" ? "image_label" : "video_label";

  const assetFeedSpec: Record<string, unknown> = {
    bodies: [{ text: copy.primaryText || " " }],
    titles: [{ text: copy.headline }],
    link_urls: [{ website_url: copy.url }],
    call_to_action_types: [copy.cta],
    asset_customization_rules: [
      {
        customization_spec: {
          publisher_platforms: ["instagram", "facebook"],
          instagram_positions: ["story", "reels"],
          facebook_positions: ["story"],
        },
        [storiesAssetKey]: { name: STORIES_LABEL },
      },
      {
        customization_spec: {},
        [feedAssetKey]: { name: FEED_LABEL },
      },
    ],
  };

  if (copy.linkDescription) assetFeedSpec.descriptions = [{ text: copy.linkDescription }];
  if (images.length > 0) assetFeedSpec.images = images;
  if (videos.length > 0) assetFeedSpec.videos = videos;

  const body = new URLSearchParams();
  body.set("object_story_spec", JSON.stringify({ page_id: pageId }));
  body.set("asset_feed_spec", JSON.stringify(assetFeedSpec));

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
    groups: { fileIdx: number; placement: "feed" | "stories" }[][];
    media: MediaRef[];
  };

  if (!config.media || config.media.length === 0) {
    return NextResponse.json({ error: "No media" }, { status: 400 });
  }

  const adAccountId = account.ad_account_id;
  const results: { name: string; adId: string | null; error: string | null }[] = [];

  const groupedIndices = new Set(config.groups.flat().map((m) => m.fileIdx));

  type AdItem =
    | { type: "single"; mediaIdx: number; copyIdx: number }
    | { type: "group"; members: { fileIdx: number; placement: "feed" | "stories" }[]; copyIdx: number };

  const adItems: AdItem[] = [];
  let copyIdx = 0;

  for (let i = 0; i < config.media.length; i++) {
    if (!groupedIndices.has(i)) {
      adItems.push({ type: "single", mediaIdx: i, copyIdx: copyIdx++ });
    }
  }
  for (const group of config.groups) {
    adItems.push({ type: "group", members: group, copyIdx: copyIdx++ });
  }

  for (const item of adItems) {
    const copy = config.copies[item.copyIdx] ?? config.copies[0];
    let adName: string;

    if (item.type === "single") {
      const mediaRef = config.media[item.mediaIdx];
      const filename = mediaRef.filename.replace(/\.[^.]+$/, "");
      adName = resolvePattern(config.adNamePattern || "{filename}", filename, item.copyIdx, config.campaignName, config.adsetName);

      try {
        let creativeId: string;
        try {
          creativeId = await createSingleCreative(adAccountId, token, config.pageId, copy, mediaRef, config.advantagePlus);
        } catch (e) {
          throw new Error(`creative: ${e instanceof Error ? e.message : String(e)} | page_id=${config.pageId} | adaccount=${adAccountId}`);
        }
        let adId: string;
        try {
          adId = await createAd(adAccountId, token, config.adsetId, creativeId, adName, config.status, config.startTime);
        } catch (e) {
          throw new Error(`ad: ${e instanceof Error ? e.message : String(e)} | adset=${config.adsetId} | creative=${creativeId} | adaccount=${adAccountId}`);
        }

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
      const feedMember = item.members.find((m) => m.placement === "feed") ?? item.members[0];
      const firstName = config.media[feedMember.fileIdx].filename.replace(/\.[^.]+$/, "");
      adName = resolvePattern(config.adNamePattern || "{filename}", firstName, item.copyIdx, config.campaignName, config.adsetName);

      try {
        let creativeId: string;
        try {
          creativeId = await createPlacementCreative(adAccountId, token, config.pageId, copy, item.members, config.media, config.advantagePlus);
        } catch (e) {
          throw new Error(`group-creative: ${e instanceof Error ? e.message : String(e)} | page_id=${config.pageId} | adaccount=${adAccountId}`);
        }
        let adId: string;
        try {
          adId = await createAd(adAccountId, token, config.adsetId, creativeId, adName, config.status, config.startTime);
        } catch (e) {
          throw new Error(`group-ad: ${e instanceof Error ? e.message : String(e)} | adset=${config.adsetId} | creative=${creativeId} | adaccount=${adAccountId}`);
        }

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
