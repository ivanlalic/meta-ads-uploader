"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginButton() {
  return (
    <Button
      className="w-full font-mono text-sm bg-[#3b82f6] hover:bg-[#60a5fa] text-white"
      onClick={() => signIn("facebook", { callbackUrl: "/connect/callback" })}
    >
      Continuar con Facebook
    </Button>
  );
}
