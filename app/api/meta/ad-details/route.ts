import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId } from "@/app/actions/accounts";
import { metaGet } from "@/lib/meta/client";

type CreativeData = {
  headline: string;
  primaryText: string;
  linkDescription: string;
  url: string;
  cta: string;
  copies: CopyItem[];
};

type CopyItem = {
  headline: string;
  primaryText: string;
  linkDescription: string;
};

type RawCreative = {
  object_story_spec?: {
    page_id: string;
    link_data?: {
      name?: string;
      message?: string;
      link?: string;
      description?: string;
      call_to_action?: { type: string };
      image_hash?: string;
    };
    video_data?: {
      title?: string;
      message?: string;
      link_description?: string;
      call_to_action?: { type: string; value?: { link?: string } };
      video_id?: string;
    };
  };
  asset_feed_spec?: {
    titles?: { text: string }[];
    bodies?: { text: string }[];
    descriptions?: { text: string }[];
    link_urls?: { website_url: string }[];
    call_to_action_types?: string[];
  };
};

function parseCopy(spec: RawCreative["object_story_spec"] | null, assetFeed: RawCreative["asset_feed_spec"] | null): CreativeData | null {
  if (!spec && !assetFeed) return null;

  // Merge data from both sources:
  //   - asset_feed_spec has titles[], bodies[], descriptions[], call_to_action_types[]
  //   - link_data has link, name, message, description, call_to_action
  //   - video_data has title, message, link_description, call_to_action
  //   - Most Advantage+ ads put text in asset_feed_spec, URL in link_data/video_data

  const headline = assetFeed?.titles?.[0]?.text
    ?? spec?.link_data?.name
    ?? spec?.video_data?.title
    ?? "";

  const primaryText = assetFeed?.bodies?.[0]?.text
    ?? spec?.link_data?.message
    ?? spec?.video_data?.message
    ?? "";

  const linkDescription = assetFeed?.descriptions?.[0]?.text
    ?? spec?.link_data?.description
    ?? spec?.video_data?.link_description
    ?? "";

  const url = spec?.link_data?.link
    ?? spec?.video_data?.call_to_action?.value?.link
    ?? assetFeed?.link_urls?.[0]?.website_url
    ?? "";

  const cta = spec?.link_data?.call_to_action?.type
    ?? spec?.video_data?.call_to_action?.type
    ?? assetFeed?.call_to_action_types?.[0]
    ?? "SHOP_NOW";

  // Build all copy variants from asset_feed_spec arrays
  const copies: CopyItem[] = [];
  if (assetFeed) {
    const maxLen = Math.max(
      assetFeed.titles?.length ?? 0,
      assetFeed.bodies?.length ?? 0,
      assetFeed.descriptions?.length ?? 0,
    );
    for (let i = 0; i < maxLen; i++) {
      copies.push({
        headline: assetFeed.titles?.[i]?.text ?? "",
        primaryText: assetFeed.bodies?.[i]?.text ?? "",
        linkDescription: assetFeed.descriptions?.[i]?.text ?? "",
      });
    }
  }
  // If no asset_feed_spec copies, add the merged single copy
  if (copies.length === 0) {
    copies.push({ headline, primaryText, linkDescription });
  }

  return { headline, primaryText, linkDescription, url, cta, copies };
}

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get("adId");
  if (!adId) return NextResponse.json({ error: "adId required" }, { status: 400 });

  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const result = await metaGet<{
    id: string;
    name: string;
    adset_id: string;
    creative?: RawCreative;
  }>(
    accountId,
    `/${adId}`,
    {
      fields: "id,name,adset_id,creative{object_story_spec,asset_feed_spec}",
    }
  );

  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 400 });

  const ad = result.data;
  const copy = parseCopy(
    ad.creative?.object_story_spec ?? null,
    ad.creative?.asset_feed_spec ?? null
  );

  return NextResponse.json({ id: ad.id, name: ad.name, adset_id: ad.adset_id, copy });
}
