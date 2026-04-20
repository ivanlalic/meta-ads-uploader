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

  // Test adcreative POST with minimal params
  const pageId = debug?.data?.granular_scopes?.find((s: { scope: string }) => s.scope === "pages_manage_ads")?.target_ids?.[0];
  let creativeTest = null;
  if (account && pageId) {
    const body = new URLSearchParams();
    body.set("object_story_spec", JSON.stringify({
      page_id: pageId,
      link_data: {
        image_hash: "test_hash_will_fail_but_shows_real_error",
        link: "https://example.com",
        message: "test",
        name: "test",
        call_to_action: { type: "SHOP_NOW" },
      },
    }));
    body.set("access_token", token);
    const testRes = await fetch(`https://graph.facebook.com/v21.0/${account.ad_account_id}/adcreatives`, { method: "POST", body });
    creativeTest = await testRes.json();
  }

  return NextResponse.json({
    account: { id: account?.id, name: account?.name, ad_account_id: account?.ad_account_id },
    token_preview: token.slice(0, 20) + "...",
    page_id_from_token: pageId,
    debug: debug?.data,
    permissions: perms?.data,
    creative_test_raw: creativeTest,
  });
}
