import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId } from "@/app/actions/accounts";
import { metaGet } from "@/lib/meta/client";

type AdSet = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
};

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const result = await metaGet<{ data: AdSet[] }>(
    accountId,
    `/${campaignId}/adsets`,
    { fields: "id,name,status,effective_status", limit: "200" }
  );

  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json(result.data);
}
