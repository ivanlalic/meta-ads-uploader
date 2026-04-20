import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createAccount,
  updateAccountToken,
  setActiveAccount,
} from "@/app/actions/accounts";

const schema = z.object({
  longToken: z.string(),
  expiresAt: z.string(),
  metaUserId: z.string(),
  metaUserName: z.string(),
  adAccountId: z.string(),
  adAccountName: z.string(),
  currency: z.string(),
  friendlyName: z.string(),
  reconnectId: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    longToken,
    expiresAt,
    metaUserId,
    metaUserName,
    adAccountId,
    adAccountName,
    currency,
    friendlyName,
    reconnectId,
  } = parsed.data;

  const tokenExpiresAt = new Date(expiresAt);

  if (reconnectId) {
    const account = await updateAccountToken(reconnectId, {
      access_token: longToken,
      token_expires_at: tokenExpiresAt,
      meta_user_id: metaUserId,
      meta_user_name: metaUserName,
      status: "active",
    });
    await setActiveAccount(account.id);
    return NextResponse.json({ accountId: account.id });
  }

  const account = await createAccount({
    name: friendlyName,
    meta_user_id: metaUserId,
    meta_user_name: metaUserName,
    access_token: longToken,
    token_expires_at: tokenExpiresAt,
    ad_account_id: adAccountId,
    ad_account_name: adAccountName,
    currency,
  });

  await setActiveAccount(account.id);
  return NextResponse.json({ accountId: account.id });
}
