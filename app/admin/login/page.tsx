"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) { toast.error("Completá ambos campos"); return; }
    setLoading(true);
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      toast.error("Credenciales incorrectas");
    } else {
      router.push("/admin");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-6 h-6 text-[#f59e0b]" />
            <span className="font-mono text-lg font-semibold">Admin</span>
          </div>
          <p className="text-[#555] text-xs font-mono">acceso restringido</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-[#555] uppercase tracking-widest">Usuario</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" className="bg-[#141414] border-[#2a2a2a] font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-[#555] uppercase tracking-widest">Contraseña</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-[#141414] border-[#2a2a2a] font-mono text-sm" />
          </div>
          <Button type="submit" disabled={loading} className="w-full font-mono text-sm bg-[#f59e0b] hover:bg-[#fbbf24] text-black">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
        <div className="text-center">
          <a href="/login" className="text-xs font-mono text-[#555] hover:text-[#888] underline">
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
