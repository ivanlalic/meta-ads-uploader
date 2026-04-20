import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  exchangeLongLivedToken,
  getMetaUserInfo,
  getAdAccounts,
} from "@/lib/meta/client";
import { CallbackClient } from "./callback-client";
import { getAccountById } from "@/app/actions/accounts";

interface PageProps {
  searchParams: Promise<{ reconnect?: string }>;
}

export default async function CallbackPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.accessToken) redirect("/connect");

  const params = await searchParams;
  const reconnectId = params.reconnect ?? null;

  const longLivedResult = await exchangeLongLivedToken(session.accessToken);
  if (!longLivedResult.ok) {
    redirect(`/connect?error=${encodeURIComponent(longLivedResult.error.message)}`);
  }

  const { access_token: longToken, expires_in } = longLivedResult.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

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
      expiresAt={expiresAt.toISOString()}
      metaUser={userResult.data}
      adAccounts={adAccountsResult.data.data}
      reconnectAccount={reconnectAccount}
    />
  );
}
