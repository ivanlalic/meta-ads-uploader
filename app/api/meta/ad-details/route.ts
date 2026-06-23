import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId } from "@/app/actions/accounts";
import { metaGet, getTokenForAccount } from "@/lib/meta/client";

type CreativeData = {
  headline: string;
  primaryText: string;
  linkDescription: string;
  url: string;
  cta: string;
};

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get("adId");
  if (!adId) return NextResponse.json({ error: "adId required" }, { status: 400 });

  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const result = await metaGet<{
    id: string;
    name: string;
    adset_id: string;
    creative?: {
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
    };
  }>(
    accountId,
    `/${adId}`,
    {
      fields: "id,name,adset_id,creative{object_story_spec}",
    }
  );

  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 400 });

  const ad = result.data;
  const spec = ad.creative?.object_story_spec;

  let copy: CreativeData | null = null;

  if (spec?.link_data) {
    copy = {
      headline: spec.link_data.name ?? "",
      primaryText: spec.link_data.message ?? "",
      linkDescription: spec.link_data.description ?? "",
      url: spec.link_data.link ?? "",
      cta: spec.link_data.call_to_action?.type ?? "SHOP_NOW",
    };
  } else if (spec?.video_data) {
    copy = {
      headline: spec.video_data.title ?? "",
      primaryText: spec.video_data.message ?? "",
      linkDescription: spec.video_data.link_description ?? "",
      url: spec.video_data.call_to_action?.value?.link ?? "",
      cta: spec.video_data.call_to_action?.type ?? "SHOP_NOW",
    };
  }

  return NextResponse.json({ id: ad.id, name: ad.name, adset_id: ad.adset_id, copy });
}
