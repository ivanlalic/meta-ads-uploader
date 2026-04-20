import { redirect } from "next/navigation";
import { getActiveAccountId, getAccountById, getAccountDefaults } from "@/app/actions/accounts";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) redirect("/connect");

  const [account, defaults] = await Promise.all([
    getAccountById(accountId),
    getAccountDefaults(accountId),
  ]);

  if (!account) redirect("/connect");

  return <SettingsClient account={account} defaults={defaults} />;
}
