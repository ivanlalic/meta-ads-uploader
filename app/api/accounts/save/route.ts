import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import {
  createAccount,
  updateAccountToken,
  setActiveAccount,
} from "@/app/actions/accounts";
import { getAdAccounts } from "@/lib/meta/client";
import { encrypt } from "@/lib/crypto";

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
  try {
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
      if (!account) return NextResponse.json({ error: "Cuenta no encontrada o sin permisos" }, { status: 404 });
      await setActiveAccount(account.id);
      return NextResponse.json({ accountId: account.id });
    }

    const account = await createAccount({
      name: friendlyName || adAccountName,
      meta_user_id: metaUserId,
      meta_user_name: metaUserName,
      access_token: longToken,
      token_expires_at: tokenExpiresAt,
      ad_account_id: adAccountId,
      ad_account_name: adAccountName,
      currency,
    });

    await setActiveAccount(account.id);

    // auto-import all other available ad accounts with the same token
    try {
      const allResult = await getAdAccounts(longToken);
      if (allResult.ok && account.user_id) {
        const encryptedToken = await encrypt(longToken);
        for (const acc of allResult.data.data) {
          if (acc.account_status !== 1) continue;
          if (acc.id === adAccountId) continue;
          const existing = await db
            .select({ id: accounts.id })
            .from(accounts)
            .where(and(
              eq(accounts.user_id, account.user_id),
              eq(accounts.ad_account_id, acc.id)
            ))
            .limit(1);
          if (existing.length > 0) continue;
          await db.insert(accounts).values({
            name: acc.name,
            meta_user_id: metaUserId,
            meta_user_name: metaUserName,
            access_token: encryptedToken,
            token_expires_at: tokenExpiresAt,
            ad_account_id: acc.id,
            ad_account_name: acc.name,
            currency: acc.currency,
            user_id: account.user_id,
            status: "active",
          });
        }
      }
    } catch {
      // non-critical: don't block the response
    }

    return NextResponse.json({ accountId: account.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
