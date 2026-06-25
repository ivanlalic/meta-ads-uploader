"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Plus, CheckCircle, AlertCircle, List } from "lucide-react";
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
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group">
        <div className="flex items-center gap-2 min-w-0">
          {active ? (
            <>
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  active.status === "active" ? "bg-success" : "bg-destructive"
                )}
              />
              <span className="text-xs font-mono text-sidebar-foreground truncate">
                {active.name}
              </span>
            </>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">Sin cuenta</span>
          )}
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52 bg-popover border-border"
      >
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.id}
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleSwitch(account.id)}
          >
            {account.status === "active" ? (
              <CheckCircle className="w-3 h-3 text-success shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
            )}
            <span className="text-xs font-mono truncate text-popover-foreground">{account.name}</span>
            {account.id === activeAccountId && (
              <span className="ml-auto text-[10px] text-muted-foreground">activa</span>
            )}
          </DropdownMenuItem>
        ))}
        {accounts.length > 0 && <DropdownMenuSeparator className="bg-border" />}
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/settings")}
        >
          <List className="w-3 h-3 text-[#888] shrink-0" />
          <span className="text-xs font-mono text-[#888]">
            Ver cuentas disponibles
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/connect")}
        >
          <Plus className="w-3 h-3 text-primary shrink-0" />
          <span className="text-xs font-mono text-primary">
            Conectar cuenta nueva
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
