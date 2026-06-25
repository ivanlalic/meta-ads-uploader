import { NextRequest, NextResponse } from "next/server";
import { getTokenForAccount, getAdAccounts } from "@/lib/meta/client";
import { getAllAccounts as getDbAccounts } from "@/app/actions/accounts";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json({ error: "accountId required" }, { status: 400 });
    }

    const token = await getTokenForAccount(accountId);
    if (!token) {
      return NextResponse.json({ error: "Token no encontrado" }, { status: 404 });
    }

    const result = await getAdAccounts(token);
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    const dbAccounts = await getDbAccounts().catch(() => []);
    const connectedIds = new Set(dbAccounts.map((a) => a.ad_account_id));

    const available = result.data.data
      .filter((a) => a.account_status === 1)
      .map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        connected: connectedIds.has(a.id),
      }));

    return NextResponse.json({ data: available });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
