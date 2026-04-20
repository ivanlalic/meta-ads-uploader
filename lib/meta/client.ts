import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "https://graph.facebook.com/v21.0";

export type MetaError = {
  code: number;
  message: string;
  type?: string;
  fbtrace_id?: string;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: MetaError };

async function fetchMeta<T>(
  path: string,
  token: string,
  options?: RequestInit & { params?: Record<string, string> }
): Promise<Result<T>> {
  const { params, ...fetchOptions } = options ?? {};
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("access_token", token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), fetchOptions);
  } catch (e) {
    return {
      ok: false,
      error: { code: 0, message: String(e) },
    };
  }

  const json = await res.json();

  if (json.error) {
    return { ok: false, error: json.error as MetaError };
  }

  return { ok: true, data: json as T };
}

export async function getTokenForAccount(accountId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!rows[0]) return null;
  return decrypt(rows[0].access_token);
}

export async function metaGet<T>(
  accountId: string,
  path: string,
  params?: Record<string, string>
): Promise<Result<T>> {
  const token = await getTokenForAccount(accountId);
  if (!token) {
    return { ok: false, error: { code: 0, message: "Account not found" } };
  }
  return fetchMeta<T>(path, token, { params });
}

export async function metaPost<T>(
  accountId: string,
  path: string,
  body: Record<string, unknown>
): Promise<Result<T>> {
  const token = await getTokenForAccount(accountId);
  if (!token) {
    return { ok: false, error: { code: 0, message: "Account not found" } };
  }
  return fetchMeta<T>(path, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function metaPatch<T>(
  accountId: string,
  path: string,
  body: Record<string, unknown>
): Promise<Result<T>> {
  const token = await getTokenForAccount(accountId);
  if (!token) {
    return { ok: false, error: { code: 0, message: "Account not found" } };
  }
  return fetchMeta<T>(path, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function exchangeLongLivedToken(shortToken: string): Promise<Result<{ access_token: string; expires_in: number }>> {
  const url = new URL(`${BASE_URL}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", shortToken);

  const res = await fetch(url.toString());
  const json = await res.json();

  if (json.error) return { ok: false, error: json.error };
  return { ok: true, data: json };
}

export async function getMetaUserInfo(token: string): Promise<Result<{ id: string; name: string }>> {
  const url = new URL(`${BASE_URL}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) return { ok: false, error: json.error };
  return { ok: true, data: json };
}

export async function getAdAccounts(token: string): Promise<Result<{
  data: { id: string; name: string; currency: string; account_status: number }[];
}>> {
  const url = new URL(`${BASE_URL}/me/adaccounts`);
  url.searchParams.set("fields", "id,name,currency,account_status");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) return { ok: false, error: json.error };
  return { ok: true, data: json };
}

export function isTokenExpiredError(error: MetaError): boolean {
  return error.code === 190;
}

export function isRateLimitError(error: MetaError): boolean {
  return error.code === 17 || error.code === 4;
}
