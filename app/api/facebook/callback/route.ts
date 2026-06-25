import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const TOKEN_URL = "https://graph.facebook.com/v25.0/oauth/access_token";

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const url = new URL(TOKEN_URL);
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json as { access_token: string; expires_in: number };
}

async function exchangeLongLivedToken(shortToken: string) {
  const url = new URL(TOKEN_URL);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", shortToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json as { access_token: string; expires_in: number };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/connect?error=facebook_denied`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/connect?error=invalid_params`, req.url)
      );
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get("fb_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL(`/connect?error=state_mismatch`, req.url)
      );
    }

    cookieStore.delete("fb_oauth_state");

    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/facebook/callback`;

    const shortTokenResult = await exchangeCodeForToken(code, redirectUri);
    const longTokenResult = await exchangeLongLivedToken(shortTokenResult.access_token);

    cookieStore.set("fb_connect_token", longTokenResult.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
      path: "/",
    });

    cookieStore.set(
      "fb_connect_expires",
      String(Date.now() + longTokenResult.expires_in * 1000),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 5,
        path: "/",
      }
    );

    return NextResponse.redirect(new URL(`/connect/callback`, req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/connect?error=${encodeURIComponent(message)}`, req.url)
    );
  }
}
