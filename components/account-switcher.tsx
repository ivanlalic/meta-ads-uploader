"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Plus, CheckCircle, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/db/schema";
import { setActiveAccount } from "@/app/actions/accounts";

interface AccountSwitcherProps {
  accounts: Account[];
  activeAccountId: string | null;
}

export function AccountSwitcher({ accounts, activeAccountId }: AccountSwitcherProps) {
  const router = useRouter();
  const active = accounts.find((a) => a.id === activeAccountId);

  async function handleSwitch(id: string) {
    await setActiveAccount(id);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#1c1c1c] transition-colors group">
        <div className="flex items-center gap-2 min-w-0">
          {active ? (
            <>
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  active.status === "active" ? "bg-[#10b981]" : "bg-[#ef4444]"
                )}
              />
              <span className="text-xs font-mono text-[#f5f5f5] truncate">
                {active.name}
              </span>
            </>
          ) : (
            <span className="text-xs font-mono text-[#555]">Sin cuenta</span>
          )}
        </div>
        <ChevronDown className="w-3 h-3 text-[#555] shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52 bg-[#1c1c1c] border-[#2a2a2a]"
      >
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.id}
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleSwitch(account.id)}
          >
            {account.status === "active" ? (
              <CheckCircle className="w-3 h-3 text-[#10b981] shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 text-[#ef4444] shrink-0" />
            )}
            <span className="text-xs font-mono truncate">{account.name}</span>
            {account.id === activeAccountId && (
              <span className="ml-auto text-[10px] text-[#555]">activa</span>
            )}
          </DropdownMenuItem>
        ))}
        {accounts.length > 0 && <DropdownMenuSeparator className="bg-[#2a2a2a]" />}
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/connect")}
        >
          <Plus className="w-3 h-3 text-[#3b82f6] shrink-0" />
          <span className="text-xs font-mono text-[#3b82f6]">
            Conectar cuenta
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
