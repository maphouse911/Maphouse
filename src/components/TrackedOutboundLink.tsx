"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  eventName?: string;
  payload?: Record<string, string | number | boolean>;
};

export default function TrackedOutboundLink({
  href,
  className,
  children,
  eventName = "outbound_click",
  payload = {},
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => {
        void trackEvent(eventName, { href, ...payload });
      }}
    >
      {children}
    </a>
  );
}
