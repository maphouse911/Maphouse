"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type BridgeState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function InstagramOauthBridge() {
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const setupError = params.get("ig_error");
  const [bridgeState, setBridgeState] = useState<BridgeState>(() =>
    setupError ? { status: "error", message: setupError } : { status: "idle" },
  );

  useEffect(() => {
    if (!code || !state) return;

    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/instagram/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });
        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Instagram 授權交換失敗");
        }

        if (cancelled) return;
        setBridgeState({ status: "success", message: payload.message ?? "Instagram 連線成功" });
        window.history.replaceState({}, "", "/?ig=connected");
      } catch (error) {
        if (cancelled) return;
        setBridgeState({
          status: "error",
          message: error instanceof Error ? error.message : "Instagram 授權交換失敗",
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [code, state]);

  const isLoading = Boolean(code && state && bridgeState.status === "idle");
  if (bridgeState.status === "idle" && !isLoading) return null;

  const isSuccess = bridgeState.status === "success";
  const message = isLoading
    ? "正在完成授權，請稍候..."
    : bridgeState.status === "success" || bridgeState.status === "error"
      ? bridgeState.message
      : "";

  return (
    <section
      className={`paper-card border px-5 py-4 ${
        isSuccess
          ? "border-[var(--olive)] bg-[linear-gradient(135deg,rgba(126,149,110,0.22),rgba(231,215,168,0.18))]"
          : "border-[var(--line)] bg-white/80"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Instagram Connect</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      {isSuccess ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          已自動寫入 `.env.local` 並即時套用，回到 Topics 重新整理即可看到 Instagram API 內容。
        </p>
      ) : null}
    </section>
  );
}
