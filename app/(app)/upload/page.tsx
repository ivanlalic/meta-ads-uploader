import { redirect } from "next/navigation";
import { getActiveAccountId, getAccountDefaults } from "@/app/actions/accounts";
import { UploadClient } from "./upload-client";

export default async function UploadPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) redirect("/connect");

  const defaults = await getAccountDefaults(accountId);

  return <UploadClient defaults={defaults} />;
}
