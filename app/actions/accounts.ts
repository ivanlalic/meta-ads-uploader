"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { accounts, account_defaults, upload_history } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const ACTIVE_ACCOUNT_COOKIE = "active_account_id";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

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

async function dedupeAccounts(userId: string) {
  const all = await db
    .select()
    .from(accounts)
    .where(eq(accounts.user_id, userId));

  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const list = groups.get(row.ad_account_id) ?? [];
    list.push(row);
    groups.set(row.ad_account_id, list);
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  let nextActiveId = activeId ?? null;

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      const ta = a.updated_at?.getTime() ?? a.created_at?.getTime() ?? 0;
      const tb = b.updated_at?.getTime() ?? b.created_at?.getTime() ?? 0;
      return tb - ta;
    });
    const keeper = group[0];
    const extraIds = group.slice(1).map((r) => r.id);

    await db
      .update(upload_history)
      .set({ account_id: keeper.id })
      .where(inArray(upload_history.account_id, extraIds));

    for (const extra of group.slice(1)) {
      const extraDefaults = await db
        .select()
        .from(account_defaults)
        .where(eq(account_defaults.account_id, extra.id))
        .limit(1);
      if (extraDefaults.length === 0) continue;
      const keeperDefaults = await db
        .select()
        .from(account_defaults)
        .where(eq(account_defaults.account_id, keeper.id))
        .limit(1);
      if (keeperDefaults.length === 0) {
        await db
          .update(account_defaults)
          .set({ account_id: keeper.id, updated_at: new Date() })
          .where(eq(account_defaults.id, extraDefaults[0].id));
      } else {
        await db
          .delete(account_defaults)
          .where(eq(account_defaults.id, extraDefaults[0].id));
      }
    }

    if (nextActiveId && extraIds.includes(nextActiveId)) {
      nextActiveId = keeper.id;
    }

    await db.delete(accounts).where(inArray(accounts.id, extraIds));
  }

  if (nextActiveId && nextActiveId !== activeId) {
    cookieStore.set(ACTIVE_ACCOUNT_COOKIE, nextActiveId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
}

export async function getAllAccounts() {
  const userId = await requireUserId();
  await dedupeAccounts(userId);
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.user_id, userId))
    .orderBy(accounts.created_at);
}

export async function getAccountById(id: string) {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.user_id, userId)))
    .limit(1);
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
  const userId = await requireUserId();
  const encryptedToken = await encrypt(data.access_token);

  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.user_id, userId), eq(accounts.ad_account_id, data.ad_account_id)))
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(accounts)
      .set({
        name: data.name || existing[0].name,
        meta_user_id: data.meta_user_id,
        meta_user_name: data.meta_user_name,
        access_token: encryptedToken,
        token_expires_at: data.token_expires_at,
        ad_account_name: data.ad_account_name,
        currency: data.currency,
        status: "active",
        updated_at: new Date(),
      })
      .where(eq(accounts.id, existing[0].id))
      .returning();
    return rows[0];
  }

  const rows = await db
    .insert(accounts)
    .values({
      ...data,
      user_id: userId,
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
  const userId = await requireUserId();
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
    .where(and(eq(accounts.id, accountId), eq(accounts.user_id, userId)))
    .returning();
  return rows[0];
}

export async function markAccountDisconnected(accountId: string) {
  const userId = await requireUserId();
  await db
    .update(accounts)
    .set({ status: "disconnected", updated_at: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.user_id, userId)));
  revalidatePath("/", "layout");
}

export async function getAccountDefaults(accountId: string) {
  const userId = await requireUserId();
  const acc = await getAccountById(accountId);
  if (!acc) return null;
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
  const acc = await getAccountById(accountId);
  if (!acc) throw new Error("Account not found");
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
