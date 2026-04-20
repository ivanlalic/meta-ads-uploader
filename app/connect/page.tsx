import { getAllAccounts } from "@/app/actions/accounts";
import { ConnectClient } from "./connect-client";

export default async function ConnectPage() {
  const accounts = await getAllAccounts();
  return <ConnectClient accounts={accounts} />;
}
