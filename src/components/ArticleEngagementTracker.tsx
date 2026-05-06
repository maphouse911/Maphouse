"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = {
  postId: string;
  title: string;
  category: string;
};

export default function ArticleEngagementTracker({ postId, title, category }: Props) {
  const completedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    trackEvent("article_view", { postId, title, category });

    const onScroll = () => {
      if (completedRef.current) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const ratio = window.scrollY / maxScroll;
      if (ratio >= 0.78) {
        completedRef.current = true;
        trackEvent("article_read_complete", { postId, title, category });
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const start = startedAtRef.current ?? startedAt;
      const dwellSeconds = Math.max(1, Math.round((Date.now() - start) / 1000));
      trackEvent("article_dwell", { postId, dwellSeconds, category });
    };
  }, [category, postId, title]);

  return null;
}
