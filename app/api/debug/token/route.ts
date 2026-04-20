import { NextResponse } from "next/server";
import { getActiveAccountId, getAccountById } from "@/app/actions/accounts";
import { getTokenForAccount } from "@/lib/meta/client";

export async function GET() {
  const accountId = await getActiveAccountId();
  if (!accountId) return NextResponse.json({ error: "No active account" });

  const account = await getAccountById(accountId);
  const token = await getTokenForAccount(accountId);
  if (!token) return NextResponse.json({ error: "No token" });

  const [debugRes, permRes] = await Promise.all([
    fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`),
    fetch(`https://graph.facebook.com/me/permissions?access_token=${token}`),
  ]);

  const [debug, perms] = await Promise.all([debugRes.json(), permRes.json()]);

  return NextResponse.json({
    account: { id: account?.id, name: account?.name, ad_account_id: account?.ad_account_id },
    token_preview: token.slice(0, 20) + "...",
    debug: debug?.data,
    permissions: perms?.data,
  });
}
