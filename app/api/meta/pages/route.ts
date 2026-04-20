import { NextResponse } from "next/server";
import { getActiveAccountId } from "@/app/actions/accounts";
import { metaGet } from "@/lib/meta/client";

type Page = {
  id: string;
  name: string;
  instagram_business_account?: { id: string };
};

export async function GET() {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" }, { status: 401 });

  const result = await metaGet<{ data: Page[] }>(accountId, "/me/accounts", {
    fields: "id,name,instagram_business_account",
  });

  if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json(result.data);
}
