import { auth } from "@/auth";

export async function getSession() {
  return auth();
}

export async function requireSession() {
  const session = await auth();
  if (!session) throw new Error("Unauthenticated");
  return session;
}
