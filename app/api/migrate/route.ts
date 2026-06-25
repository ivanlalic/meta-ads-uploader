import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { isNull, and, eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@adsuploader.app";

export async function GET() {
  const unlinked = await db
    .select()
    .from(accounts)
    .where(and(isNull(accounts.user_id)));

  if (unlinked.length === 0) {
    return NextResponse.json({ message: "No accounts to migrate" });
  }

  const groups = new Map<string, typeof unlinked>();
  for (const acc of unlinked) {
    const key = acc.meta_user_id || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(acc);
  }

  let created = 0;
  for (const [, group] of groups) {
    const first = group[0];
    const email = first.meta_user_id
      ? `fb_${first.meta_user_id}@facebook.com`
      : null;
    const existing = email
      ? await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
      : [];
    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      const inserted = await db
        .insert(users)
        .values({
          name: first.meta_user_name || first.name,
          email,
          role: "user",
        })
        .returning();
      userId = inserted[0].id;
      created++;
    }
    for (const acc of group) {
      await db
        .update(accounts)
        .set({ user_id: userId })
        .where(eq(accounts.id, acc.id));
    }
  }

  return NextResponse.json({
    message: `Migrated ${unlinked.length} accounts to ${groups.size} users (${created} new)`,
  });
}
