import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { metaGet, getTokenForAccount } from "@/lib/meta/client";

const BASE_URL = "https://graph.facebook.com/v21.0";

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

export async function POST(req: NextRequest) {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const account = await getAccountById(accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const token = await getTokenForAccount(accountId);
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 401 });

  const { name, campaignId, sourceAdsetId } = await req.json();
  if (!name || !campaignId || !sourceAdsetId) {
    return NextResponse.json({ error: "name, campaignId, sourceAdsetId required" }, { status: 400 });
  }

  // Fetch source adset settings
  const sourceRes = await fetch(
    `${BASE_URL}/${sourceAdsetId}?fields=targeting,optimization_goal,billing_event,daily_budget,lifetime_budget,bid_strategy,bid_amount,destination_type&access_token=${token}`
  );
  const source = await sourceRes.json();
  if (source.error) return NextResponse.json({ error: source.error.message }, { status: 400 });

  const body = new URLSearchParams();
  body.set("name", name);
  body.set("campaign_id", campaignId);
  body.set("status", "PAUSED");
  body.set("targeting", JSON.stringify(source.targeting));
  body.set("optimization_goal", source.optimization_goal);
  body.set("billing_event", source.billing_event);
  if (source.daily_budget) body.set("daily_budget", source.daily_budget);
  if (source.lifetime_budget) body.set("lifetime_budget", source.lifetime_budget);
  if (source.bid_strategy) body.set("bid_strategy", source.bid_strategy);
  if (source.bid_amount) body.set("bid_amount", source.bid_amount);
  if (source.destination_type) body.set("destination_type", source.destination_type);
  body.set("access_token", token);

  const res = await fetch(`${BASE_URL}/${account.ad_account_id}/adsets`, {
    method: "POST",
    body,
  });
  const json = await res.json();
  if (json.error) return NextResponse.json({ error: json.error.message }, { status: 400 });

  return NextResponse.json({ id: json.id, name, status: "PAUSED", effective_status: "PAUSED" });
}
