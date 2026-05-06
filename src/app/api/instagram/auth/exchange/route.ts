import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v24.0";
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_OAUTH_REDIRECT_URI ?? "http://localhost:3000/";
const OAUTH_STATE_COOKIE = "maphouse_ig_oauth_state";

type ExchangeBody = {
  code?: string;
  state?: string;
};

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type PagesResponse = {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
      id: string;
      username?: string;
    };
  }>;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const graphMessage =
      typeof parsed.error === "object" &&
      parsed.error !== null &&
      "message" in parsed.error &&
      typeof parsed.error.message === "string"
        ? parsed.error.message
        : text;
    throw new Error(graphMessage || `HTTP ${response.status}`);
  }

  return parsed as T;
}

async function upsertEnvLocal(updates: Record<string, string>) {
  const envPath = path.join(process.cwd(), ".env.local");
  let existing = "";
  try {
    existing = await readFile(envPath, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw error;
  }

  const map = new Map<string, string>();
  for (const rawLine of existing.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key) map.set(key, value);
  }

  for (const [key, value] of Object.entries(updates)) {
    map.set(key, value);
  }

  const lines = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  await writeFile(envPath, `${lines.join("\n")}\n`, "utf8");
}

async function resolveInstagramBusinessAccount(userToken: string) {
  const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  pagesUrl.searchParams.set("access_token", userToken);
  const pages = await fetchJson<PagesResponse>(pagesUrl.toString());

  const matched = pages.data?.find((page) => page.instagram_business_account?.id);
  if (!matched?.instagram_business_account?.id) {
    throw new Error("找不到已綁定 Instagram 專業帳號的 Facebook 粉專。");
  }

  return matched.instagram_business_account;
}

export async function POST(request: Request) {
  if (!APP_ID || !APP_SECRET) {
    return jsonError("缺少 META_APP_ID / META_APP_SECRET，請先設定 .env.local。");
  }

  const body = (await request.json()) as ExchangeBody;
  const code = body.code?.trim();
  const state = body.state?.trim();
  if (!code || !state) return jsonError("缺少 code 或 state。");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return jsonError("OAuth state 不一致，請重新點一次連接 Instagram。", 401);
  }

  try {
    const codeExchangeUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    codeExchangeUrl.searchParams.set("client_id", APP_ID);
    codeExchangeUrl.searchParams.set("client_secret", APP_SECRET);
    codeExchangeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    codeExchangeUrl.searchParams.set("code", code);
    const shortLived = await fetchJson<TokenResponse>(codeExchangeUrl.toString());

    const longExchangeUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    longExchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
    longExchangeUrl.searchParams.set("client_id", APP_ID);
    longExchangeUrl.searchParams.set("client_secret", APP_SECRET);
    longExchangeUrl.searchParams.set("fb_exchange_token", shortLived.access_token);
    const longLived = await fetchJson<TokenResponse>(longExchangeUrl.toString());

    const igAccount = await resolveInstagramBusinessAccount(longLived.access_token);

    await upsertEnvLocal({
      INSTAGRAM_GRAPH_VERSION: GRAPH_VERSION,
      INSTAGRAM_IG_USER_ID: igAccount.id,
      INSTAGRAM_ACCESS_TOKEN: longLived.access_token,
    });
    process.env.INSTAGRAM_GRAPH_VERSION = GRAPH_VERSION;
    process.env.INSTAGRAM_IG_USER_ID = igAccount.id;
    process.env.INSTAGRAM_ACCESS_TOKEN = longLived.access_token;

    const response = NextResponse.json({
      ok: true,
      message: "Instagram 連線成功，已寫入 .env.local",
      igUserId: igAccount.id,
      username: igAccount.username ?? null,
      expiresIn: longLived.expires_in ?? null,
    });
    response.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "交換 access token 失敗。", 500);
  }
}
