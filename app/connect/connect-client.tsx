"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Zap, Plus, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/db/schema";

interface ConnectClientProps {
  accounts: Account[];
}

export function ConnectClient({ accounts }: ConnectClientProps) {
  const [reconnectId, setReconnectId] = useState<string | null>(null);

  function handleConnect() {
    const callbackUrl = reconnectId
      ? `/connect/callback?reconnect=${reconnectId}`
      : "/connect/callback";
    signIn("facebook", { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-6 h-6 text-[#3b82f6]" />
            <span className="font-mono text-lg font-semibold">ads.uploader</span>
          </div>
          <p className="text-[#555] text-sm font-mono">
            Conectá una cuenta de agencia Meta
          </p>
        </div>

        {accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono text-[#555] uppercase tracking-widest">
              Cuentas conectadas
            </p>
            <div className="border border-[#2a2a2a] rounded-md divide-y divide-[#2a2a2a]">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {account.status === "active" ? (
                      <CheckCircle className="w-4 h-4 text-[#10b981] shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-mono text-[#f5f5f5]">
                        {account.name}
                      </p>
                      <p className="text-xs font-mono text-[#555]">
                        {account.ad_account_id}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs font-mono text-[#3b82f6] hover:text-[#60a5fa] h-7 px-2"
                    onClick={() => {
                      setReconnectId(account.id);
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reconectar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {reconnectId && (
          <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-md px-4 py-3">
            <p className="text-xs font-mono text-[#f59e0b]">
              Reconectando:{" "}
              <strong>
                {accounts.find((a) => a.id === reconnectId)?.name}
              </strong>
              . El token y la configuración se preservarán.
            </p>
            <button
              className="text-xs font-mono text-[#555] hover:text-[#888] mt-1 underline"
              onClick={() => setReconnectId(null)}
            >
              Cancelar
            </button>
          </div>
        )}

        <Button
          className="w-full font-mono text-sm bg-[#3b82f6] hover:bg-[#60a5fa] text-white"
          onClick={handleConnect}
        >
          {reconnectId ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reconectar con Meta
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Conectar nueva cuenta
            </>
          )}
        </Button>

        {accounts.length > 0 && (
          <div className="text-center">
            <a
              href="/dashboard"
              className="text-xs font-mono text-[#555] hover:text-[#888] underline"
            >
              ← Volver al dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
