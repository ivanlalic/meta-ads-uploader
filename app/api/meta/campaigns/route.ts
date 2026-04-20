import { NextRequest, NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { metaGet, getTokenForAccount } from "@/lib/meta/client";

const BASE_URL = "https://graph.facebook.com/v21.0";

type Campaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
};

export async function GET() {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const account = await getAccountById(accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const result = await metaGet<{ data: Campaign[] }>(
    accountId,
    `/${account.ad_account_id}/campaigns`,
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

  const { name, objective } = await req.json();
  if (!name || !objective) return NextResponse.json({ error: "name and objective required" }, { status: 400 });

  const body = new URLSearchParams();
  body.set("name", name);
  body.set("objective", objective);
  body.set("status", "PAUSED");
  body.set("special_ad_categories", "[]");
  body.set("access_token", token);

  const res = await fetch(`${BASE_URL}/${account.ad_account_id}/campaigns`, {
    method: "POST",
    body,
  });
  const json = await res.json();
  if (json.error) return NextResponse.json({ error: json.error.message }, { status: 400 });

  return NextResponse.json({ id: json.id, name, objective, status: "PAUSED", effective_status: "PAUSED" });
}
