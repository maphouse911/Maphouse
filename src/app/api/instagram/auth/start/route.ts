import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v24.0";
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_OAUTH_REDIRECT_URI ?? "http://localhost:3000/";
const OAUTH_STATE_COOKIE = "maphouse_ig_oauth_state";

const scopes = [
  "public_profile",
  "instagram_graph_user_profile",
  "instagram_graph_user_media",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export async function GET(request: Request) {
  if (!APP_ID || !APP_SECRET) {
    const url = new URL("/", request.url);
    url.searchParams.set("ig_error", "缺少 META_APP_ID / META_APP_SECRET");
    return NextResponse.redirect(url);
  }

  const state = randomUUID().replaceAll("-", "");
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes,
    state,
  });

  const oauthUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(OAUTH_STATE_COOKIE);
  return NextResponse.json({ ok: true });
}
