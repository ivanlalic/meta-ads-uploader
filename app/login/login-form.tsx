"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al registrarse");
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Email o contraseña incorrectos");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "register" && (
        <div className="space-y-1">
          <label className="text-xs font-mono text-[#555] uppercase tracking-widest">
            Nombre
          </label>
          <Input
            placeholder="ej: Juan Pérez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#141414] border-[#2a2a2a] font-mono text-sm"
            required
          />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs font-mono text-[#555] uppercase tracking-widest">
          Email
        </label>
        <Input
          type="email"
          placeholder="ej: juan@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-[#141414] border-[#2a2a2a] font-mono text-sm"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-mono text-[#555] uppercase tracking-widest">
          Contraseña
        </label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-[#141414] border-[#2a2a2a] font-mono text-sm"
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full font-mono text-sm bg-[#3b82f6] hover:bg-[#60a5fa] text-white"
        disabled={loading}
      >
        {loading
          ? "Cargando..."
          : mode === "login"
          ? "Iniciar sesión"
          : "Crear cuenta"}
      </Button>

      <p className="text-center text-xs font-mono text-[#555]">
        {mode === "login" ? (
          <>
            ¿No tenés cuenta?{" "}
            <button
              type="button"
              className="text-[#3b82f6] hover:underline"
              onClick={() => setMode("register")}
            >
              Crear una
            </button>
          </>
        ) : (
          <>
            ¿Ya tenés cuenta?{" "}
            <button
              type="button"
              className="text-[#3b82f6] hover:underline"
              onClick={() => setMode("login")}
            >
              Iniciar sesión
            </button>
          </>
        )}
      </p>
    </form>
  );
}
