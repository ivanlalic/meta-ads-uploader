"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Upload,
  Megaphone,
  History,
  Settings,
  Zap,
  Sun,
  Moon,
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
    <aside className="w-[220px] shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border sticky top-0">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-semibold tracking-tight text-sidebar-foreground">
              ads.uploader
            </span>
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="p-3 border-b border-sidebar-border">
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
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="font-mono text-xs">{label}</span>
          </Link>
        ))}
      </nav>

      {tokenStatus && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                tokenStatus === "green" && "bg-success",
                tokenStatus === "yellow" && "bg-warning",
                tokenStatus === "red" && "bg-destructive animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground font-mono">
              {tokenDaysLeft}d token
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
