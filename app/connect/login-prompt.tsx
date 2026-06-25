"use client";

import { signIn } from "next-auth/react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginPrompt() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-[#3b82f6]" />
          <span className="font-mono text-lg font-semibold">ads.uploader</span>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-sm text-[#f5f5f5]">Conectá tu cuenta de Meta</p>
          <p className="text-xs font-mono text-[#555]">Necesitás iniciar sesión para gestionar tus cuentas publicitarias</p>
        </div>
        <Button
          className="w-full font-mono text-sm bg-[#3b82f6] hover:bg-[#60a5fa] text-white"
          onClick={() => signIn("facebook", { callbackUrl: "/connect/callback" })}
        >
          Continuar con Facebook
        </Button>
      </div>
    </div>
  );
}
