import { NextResponse } from "next/server";

type AnalyticsRequest = {
  event?: string;
  path?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyticsRequest;
    const event = body.event ?? "unknown_event";
    const path = body.path ?? "unknown_path";
    const timestamp = body.timestamp ?? new Date().toISOString();
    const payload = body.payload ?? {};

    console.info(`[analytics] ${timestamp} ${event} @ ${path}`, payload);
  } catch (error) {
    console.warn("[analytics] invalid analytics payload", error);
  }

  return NextResponse.json({ ok: true });
}
