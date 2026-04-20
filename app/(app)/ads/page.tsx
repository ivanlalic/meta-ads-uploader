import { redirect } from "next/navigation";
import { getActiveAccountId } from "@/app/actions/accounts";
import { AdsClient } from "./ads-client";

export default async function AdsPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) redirect("/connect");

  return <AdsClient />;
}
