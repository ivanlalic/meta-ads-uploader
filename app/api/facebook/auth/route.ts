import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const FB_AUTH_URL = "https://www.facebook.com/v25.0/dialog/oauth";
const SCOPE = "ads_management,ads_read,pages_read_engagement,pages_manage_ads,business_management";

export async function GET(req: NextRequest) {
  const state = crypto.randomUUID();
  const { searchParams: reqParams } = new URL(req.url);
  const reconnectId = reqParams.get("reconnect");

  const cookieStore = await cookies();
  cookieStore.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 5,
    path: "/",
  });

  if (reconnectId) {
    cookieStore.set("fb_reconnect_id", reconnectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
      path: "/",
    });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/facebook/callback`;

  const url = new URL(FB_AUTH_URL);
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url.toString());
}

