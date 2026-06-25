import { Zap } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="font-mono text-lg font-semibold">ads.uploader</span>
          </div>
          <p className="font-mono text-sm text-foreground">Iniciar sesión</p>
          <p className="text-xs font-mono text-[#888]">
            Ingresá con tu email y contraseña
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
