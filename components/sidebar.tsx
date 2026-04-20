"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Megaphone,
  History,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./account-switcher";
import type { Account } from "@/lib/db/schema";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  accounts: Account[];
  activeAccountId: string | null;
}

export function Sidebar({ accounts, activeAccountId }: SidebarProps) {
  const pathname = usePathname();

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const tokenDaysLeft = activeAccount?.token_expires_at
    ? Math.ceil(
        (new Date(activeAccount.token_expires_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const tokenStatus =
    tokenDaysLeft === null
      ? null
      : tokenDaysLeft > 14
      ? "green"
      : tokenDaysLeft > 3
      ? "yellow"
      : "red";

  return (
    <aside className="w-[220px] shrink-0 flex flex-col h-screen bg-[#141414] border-r border-[#2a2a2a] sticky top-0">
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#3b82f6]" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            ads.uploader
          </span>
        </div>
      </div>

      <div className="p-3 border-b border-[#2a2a2a]">
        <AccountSwitcher accounts={accounts} activeAccountId={activeAccountId} />
      </div>

      <nav className="flex-1 p-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-[#1c1c1c] text-[#f5f5f5]"
                : "text-[#888] hover:text-[#f5f5f5] hover:bg-[#1c1c1c]"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="font-mono text-xs">{label}</span>
          </Link>
        ))}
      </nav>

      {tokenStatus && (
        <div className="p-3 border-t border-[#2a2a2a]">
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                tokenStatus === "green" && "bg-[#10b981]",
                tokenStatus === "yellow" && "bg-[#f59e0b]",
                tokenStatus === "red" && "bg-[#ef4444] animate-pulse"
              )}
            />
            <span className="text-xs text-[#555] font-mono">
              {tokenDaysLeft}d token
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
