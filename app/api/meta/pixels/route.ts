import { NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { metaGet } from "@/lib/meta/client";

type Pixel = { id: string; name: string };

export async function GET() {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const account = await getAccountById(accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const result = await metaGet<{ data: Pixel[] }>(
    accountId,
    `/${account.ad_account_id}/adspixels`,
    { fields: "id,name" }
  );

  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json(result.data);
}
