import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "https://graph.facebook.com/v25.0";

export type MetaError = {
  code: number;
  message: string;
  type?: string;
  fbtrace_id?: string;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: MetaError };

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80003, 80004, 80014]);
const MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function rateLimitBackoffMs(error: MetaError, attempt: number): number {
  const regain =
    (error as unknown as { error_data?: { estimated_time_to_regain_access?: number } })
      .error_data?.estimated_time_to_regain_access;
  if (typeof regain === "number" && regain > 0) {
    return Math.min(regain * 1000, 120000);
  }
  return Math.min(2000 * Math.pow(2, attempt), 30000);
}

async function fetchMeta<T>(
  path: string,
  token: string,
  options?: RequestInit & { params?: Record<string, string> }
): Promise<Result<T>> {
  const { params, ...fetchOptions } = options ?? {};
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers = new Headers(fetchOptions.headers);
  headers.set("Authorization", `Bearer ${token}`);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url.toString(), { ...fetchOptions, headers });
    } catch (e) {
      return { ok: false, error: { code: 0, message: String(e) } };
    }

    const json = await res.json();

    if (!json.error) {
      return { ok: true, data: json as T };
    }

    const error = json.error as MetaError;
    if (RATE_LIMIT_CODES.has(error.code) && attempt < MAX_RETRIES) {
      await sleep(rateLimitBackoffMs(error, attempt));
      continue;
    }

    return { ok: false, error };
  }
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
  return RATE_LIMIT_CODES.has(error.code);
}

export async function resolveInstagramActorId(
  token: string,
  pageId: string
): Promise<string | null> {
  try {
    const connUrl = new URL(`${BASE_URL}/${pageId}`);
    connUrl.searchParams.set("fields", "instagram_business_account");
    connUrl.searchParams.set("access_token", token);
    const connRes = await fetch(connUrl.toString());
    const connJson = await connRes.json();
    if (connJson.instagram_business_account?.id) {
      return connJson.instagram_business_account.id as string;
    }

    const pbUrl = new URL(`${BASE_URL}/${pageId}/page_backed_instagram_accounts`);
    pbUrl.searchParams.set("access_token", token);
    const pbRes = await fetch(pbUrl.toString());
    const pbJson = await pbRes.json();
    const existingId = pbJson?.id ?? pbJson?.data?.[0]?.id;
    if (existingId) return existingId as string;

    const createBody = new URLSearchParams();
    createBody.set("access_token", token);
    const createRes = await fetch(pbUrl.toString(), { method: "POST", body: createBody });
    const createJson = await createRes.json();
    if (createJson?.id) return createJson.id as string;
  } catch {
    // fall through
  }
  return null;
}
