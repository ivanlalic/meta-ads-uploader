import { getAllAccounts } from "@/app/actions/accounts";
import { auth } from "@/auth";
import { ConnectClient } from "./connect-client";
import { LoginPrompt } from "./login-prompt";

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) return <LoginPrompt />;

  const accounts = await getAllAccounts().catch(() => []);
  return <ConnectClient accounts={accounts} />;
}
