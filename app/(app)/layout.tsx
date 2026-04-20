import { Sidebar } from "@/components/sidebar";
import { getAllAccounts, getActiveAccountId } from "@/app/actions/accounts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [allAccounts, activeAccountId] = await Promise.all([
    getAllAccounts(),
    getActiveAccountId(),
  ]);

  const resolvedActiveId =
    activeAccountId ?? allAccounts[0]?.id ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar accounts={allAccounts} activeAccountId={resolvedActiveId} />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
