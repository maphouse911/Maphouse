"use client";

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

const ANALYTICS_ENDPOINT = "/api/analytics/track";

export async function trackEvent(event: string, payload: AnalyticsPayload = {}) {
  try {
    const body = JSON.stringify({
      event,
      payload,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
      return;
    }

    await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body,
    });
  } catch {
    // Tracking should never block user flow.
  }
}
