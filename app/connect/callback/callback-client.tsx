"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Account } from "@/lib/db/schema";

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
}

interface CallbackClientProps {
  longToken: string;
  expiresAt: string;
  metaUser: { id: string; name: string };
  adAccounts: AdAccount[];
  reconnectAccount: Account | null;
}

export function CallbackClient({
  longToken,
  expiresAt,
  metaUser,
  adAccounts,
  reconnectAccount,
}: CallbackClientProps) {
  const router = useRouter();
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>(
    reconnectAccount?.ad_account_id ?? adAccounts[0]?.id ?? ""
  );
  const [saving, setSaving] = useState(false);

  const activeAdAccounts = adAccounts.filter(
    (a) => a.account_status === 1
  );

  async function handleSave() {
    if (!selectedAdAccountId) {
      toast.error("Seleccioná una ad account");
      return;
    }

    setSaving(true);
    const selectedAccount = adAccounts.find((a) => a.id === selectedAdAccountId);

    try {
      const res = await fetch("/api/accounts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longToken,
          expiresAt,
          metaUserId: metaUser.id,
          metaUserName: metaUser.name,
          adAccountId: selectedAdAccountId,
          adAccountName: selectedAccount?.name ?? "",
          currency: selectedAccount?.currency ?? "USD",
          friendlyName: "",
          reconnectId: reconnectAccount?.id ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");

      toast.success(
        reconnectAccount
          ? "Cuenta reconectada"
          : `Cuenta conectada`
      );
      router.push(`/settings?account=${data.accountId}`);
    } catch (e) {
      toast.error(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="font-mono text-lg font-semibold">ads.uploader</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <p className="text-success text-sm font-mono">
              Autenticado como {metaUser.name}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {reconnectAccount && (
            <div className="bg-primary/10 border border-[#3b82f6]/20 rounded-md px-4 py-3">
              <p className="text-xs font-mono text-primary">
                Reconectando cuenta:{" "}
                <strong>{reconnectAccount.ad_account_name}</strong>
              </p>
              <p className="text-xs font-mono text-[#888] mt-1">
                La configuración y el historial se preservarán.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-mono text-[#888] uppercase tracking-widest">
              Elegí la Ad Account
            </label>
            {activeAdAccounts.length === 0 ? (
              <p className="text-xs font-mono text-destructive">
                No hay ad accounts activas en esta cuenta.
              </p>
            ) : (
              <div className="border border-border rounded-md divide-y divide-[#2a2a2a]">
                {activeAdAccounts.map((account) => (
                  <button
                    key={account.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      selectedAdAccountId === account.id
                        ? "bg-primary/10"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSelectedAdAccountId(account.id)}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
                        selectedAdAccountId === account.id
                          ? "border-[#3b82f6] bg-primary"
                          : "border-[#555]"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-foreground truncate">
                        {account.name}
                      </p>
                      <p className="text-xs font-mono text-[#888]">
                        {account.id} · {account.currency}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button
          className="w-full font-mono text-sm bg-primary hover:bg-primary/80 text-white"
          onClick={handleSave}
          disabled={saving || activeAdAccounts.length === 0}
        >
          {saving ? "Guardando..." : reconnectAccount ? "Reconectar" : "Conectar cuenta"}
        </Button>
      </div>
    </div>
  );
}
