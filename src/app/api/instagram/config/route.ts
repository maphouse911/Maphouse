import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type ConfigBody = {
  appSecret?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return jsonError("此設定端點僅供本機開發使用。", 403);
  }

  const body = (await request.json()) as ConfigBody;
  const appSecret = body.appSecret?.trim();
  if (!appSecret) return jsonError("請先輸入 App Secret。");
  if (/^https?:\/\//i.test(appSecret) || appSecret.includes("localhost")) {
    return jsonError("這看起來像網址，不是 App Secret。請貼 Meta App 的真正 Secret。");
  }
  if (appSecret.length < 16) {
    return jsonError("App Secret 格式看起來不完整，請重新貼上。");
  }

  await upsertEnvLocal({ META_APP_SECRET: appSecret });
  process.env.META_APP_SECRET = appSecret;

  return NextResponse.json({
    ok: true,
    message: "App Secret 已儲存，可以直接按「連接 Instagram（自動設定）」",
  });
}
