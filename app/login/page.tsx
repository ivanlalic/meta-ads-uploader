import { Zap } from "lucide-react";
import { LoginButton } from "./login-button";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-[#3b82f6]" />
          <span className="font-mono text-lg font-semibold">ads.uploader</span>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-sm text-[#f5f5f5]">Iniciar sesión</p>
          <p className="text-xs font-mono text-[#555]">
            Conectá tu cuenta de Meta para empezar
          </p>
        </div>
        <LoginButton />
      </div>
    </div>
  );
}
