import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getMetaUserInfo,
  getAdAccounts,
} from "@/lib/meta/client";
import { CallbackClient } from "./callback-client";
import { getAccountById } from "@/app/actions/accounts";

export default async function CallbackPage() {
  const cookieStore = await cookies();
  const longToken = cookieStore.get("fb_connect_token")?.value;

  if (!longToken) redirect("/connect");

  const reconnectId = cookieStore.get("fb_reconnect_id")?.value ?? null;
  const expiresAtStr = cookieStore.get("fb_connect_expires")?.value;
  const expiresAt = expiresAtStr ? new Date(Number(expiresAtStr)).toISOString() : new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

  const [userResult, adAccountsResult] = await Promise.all([
    getMetaUserInfo(longToken),
    getAdAccounts(longToken),
  ]);

  if (!userResult.ok || !adAccountsResult.ok) {
    redirect("/connect?error=fetch_failed");
  }

  const reconnectAccount = reconnectId ? await getAccountById(reconnectId) : null;

  return (
    <CallbackClient
      longToken={longToken}
      expiresAt={expiresAt}
      metaUser={userResult.data}
      adAccounts={adAccountsResult.data.data}
      reconnectAccount={reconnectAccount}
    />
  );
}
