"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { USER_PRESENCE_HEARTBEAT_MS } from "@/lib/user-presence";

export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/login" || pathname.startsWith("/login/")) {
      return;
    }

    let cancelled = false;

    async function ping() {
      try {
        await fetch("/api/presence", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathname }),
        });
      } catch {
        // ignore network errors; next interval retries
      }
    }

    void ping();
    const intervalId = setInterval(() => {
      if (!cancelled) void ping();
    }, USER_PRESENCE_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [pathname]);

  return null;
}
