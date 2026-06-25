import { redirect } from "next/navigation";
import { getAllAccounts } from "@/app/actions/accounts";
import { auth } from "@/auth";
import { ConnectClient } from "./connect-client";

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const accounts = await getAllAccounts().catch(() => []);
  return <ConnectClient accounts={accounts} />;
}
