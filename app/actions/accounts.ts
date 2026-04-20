"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { accounts, account_defaults } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

const ACTIVE_ACCOUNT_COOKIE = "active_account_id";

export async function getActiveAccountId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value ?? null;
}

export async function setActiveAccount(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidatePath("/", "layout");
}

export async function getAllAccounts() {
  return db.select().from(accounts).orderBy(accounts.created_at);
}

export async function getAccountById(id: string) {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createAccount(data: {
  name: string;
  meta_user_id: string;
  meta_user_name: string;
  access_token: string;
  token_expires_at: Date;
  ad_account_id: string;
  ad_account_name: string;
  currency: string;
}) {
  const encryptedToken = await encrypt(data.access_token);
  const rows = await db
    .insert(accounts)
    .values({
      ...data,
      access_token: encryptedToken,
      status: "active",
    })
    .returning();
  return rows[0];
}

export async function updateAccountToken(
  accountId: string,
  data: {
    access_token: string;
    token_expires_at: Date;
    meta_user_id?: string;
    meta_user_name?: string;
    status?: string;
  }
) {
  const encryptedToken = await encrypt(data.access_token);
  const rows = await db
    .update(accounts)
    .set({
      access_token: encryptedToken,
      token_expires_at: data.token_expires_at,
      meta_user_id: data.meta_user_id,
      meta_user_name: data.meta_user_name,
      status: "active",
      updated_at: new Date(),
    })
    .where(eq(accounts.id, accountId))
    .returning();
  return rows[0];
}

export async function markAccountDisconnected(accountId: string) {
  await db
    .update(accounts)
    .set({ status: "disconnected", updated_at: new Date() })
    .where(eq(accounts.id, accountId));
  revalidatePath("/", "layout");
}

export async function getAccountDefaults(accountId: string) {
  const rows = await db
    .select()
    .from(account_defaults)
    .where(eq(account_defaults.account_id, accountId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertAccountDefaults(
  accountId: string,
  data: Partial<typeof account_defaults.$inferInsert>
) {
  const existing = await getAccountDefaults(accountId);
  if (existing) {
    const rows = await db
      .update(account_defaults)
      .set({ ...data, updated_at: new Date() })
      .where(eq(account_defaults.account_id, accountId))
      .returning();
    return rows[0];
  } else {
    const rows = await db
      .insert(account_defaults)
      .values({ account_id: accountId, ...data })
      .returning();
    return rows[0];
  }
}
