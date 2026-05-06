"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

const REF_SOURCE_KEY = "maphouse_ref_source_logged";

export default function TrafficSourceTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(REF_SOURCE_KEY)) return;
      sessionStorage.setItem(REF_SOURCE_KEY, "1");

      const ref = document.referrer || "";
      const source = ref.includes("instagram.com")
        ? "instagram"
        : ref.includes("threads.net")
          ? "threads"
          : ref.includes("linkedin.com")
            ? "linkedin"
            : ref
              ? "other"
              : "direct";

      void trackEvent("session_source", { source });
    } catch {
      // no-op
    }
  }, []);

  return null;
}
