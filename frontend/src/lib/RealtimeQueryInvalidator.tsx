"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";

type RealtimeEvent = {
  module: "assets" | "services" | "users";
  action: "created" | "updated" | "deleted";
  entityId: string;
  organizationId: string | null;
  actorUserId?: string | null;
  emittedAt: string;
};

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");

// In production, route through the Next.js rewrite (/api-proxy) like every
// other API call (see lib/api.ts) so the session cookie is sent same-origin.
// A direct cross-origin fetch to the backend's own domain drops the cookie
// (browsers block it, and iOS Safari's ITP is especially strict about it),
// so this endpoint would 401 forever and retry every 3s without ever
// connecting.
const apiBaseUrl =
  typeof window !== "undefined" && process.env.NODE_ENV === "production"
    ? "/api-proxy"
    : rawApiUrl;

const invalidatePrefixes = (
  queryClient: ReturnType<typeof useQueryClient>,
  prefixes: string[],
) => {
  prefixes.forEach((prefix) => {
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === prefix,
    });
  });
};

const parseSseChunk = (
  buffer: string,
  onEvent: (event: RealtimeEvent) => void,
) => {
  const messages = buffer.split("\n\n");
  const remainder = messages.pop() ?? "";

  messages.forEach((message) => {
    const dataLines = message
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim());

    if (dataLines.length === 0) {
      return;
    }

    onEvent(JSON.parse(dataLines.join("\n")) as RealtimeEvent);
  });

  return remainder;
};

export function RealtimeQueryInvalidator() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (loading || !user || !apiBaseUrl) {
      return;
    }

    let isActive = true;
    let reconnectTimer: number | undefined;
    const abortController = new AbortController();

    const handleEvent = (event: RealtimeEvent) => {
      if (event.module === "assets") {
        if (pathname.startsWith("/assets")) {
          invalidatePrefixes(queryClient, [
            "asset",
            "assets",
            "assets-mobile",
            "assets-stats",
            "assets-owners-list",
          ]);
        }
        if (pathname.startsWith("/dashboard")) {
          invalidatePrefixes(queryClient, ["dashboard-stats"]);
        }
      }

      if (event.module === "services") {
        if (pathname.startsWith("/service")) {
          invalidatePrefixes(queryClient, [
            "services",
            "services-mobile",
            "services-stats",
            "services-workers-list",
          ]);
        }
        if (pathname.startsWith("/assets")) {
          invalidatePrefixes(queryClient, [
            "assets",
            "assets-mobile",
            "assets-stats",
          ]);
        }
        if (pathname.startsWith("/dashboard")) {
          invalidatePrefixes(queryClient, ["dashboard-stats"]);
        }
      }

      if (event.module === "users" && pathname.startsWith("/users")) {
        invalidatePrefixes(queryClient, ["users", "users-stats"]);
      }
    };

    const connect = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/realtime/events`, {
          credentials: "include",
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(
            `Realtime stream failed with status ${response.status}`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (isActive) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer = parseSseChunk(
            buffer + decoder.decode(value, { stream: true }),
            handleEvent,
          );
        }
      } catch {
        if (!isActive || abortController.signal.aborted) {
          return;
        }
      }

      if (isActive) {
        reconnectTimer = window.setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      isActive = false;
      abortController.abort();
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [loading, pathname, queryClient, user]);

  return null;
}
