import axios from "axios";
import { isAlwaysPublicPath } from "./publicRoutes";

// In production, route all API calls through the Next.js rewrite (/api-proxy)
// so the cookie is set by the same origin as the frontend. This is required for
// iOS Safari which blocks cross-origin cookies via ITP.
const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");

if (!rawApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required in production");
}

const apiBaseUrl =
  typeof window !== "undefined" && process.env.NODE_ENV === "production"
    ? "/api-proxy"
    : rawApiUrl;

const normalizeMediaUrls = (value: unknown): unknown => {
  if (typeof value === "string") {
    if (value.startsWith("/uploads/")) {
      return `${rawApiUrl}${value}`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeMediaUrls(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeMediaUrls(nestedValue),
      ]),
    );
  }

  return value;
};

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const isPublicRequest = (url?: string): boolean => {
  if (!url) return false;

  try {
    const parsed = new URL(url, rawApiUrl);
    return parsed.pathname.startsWith("/public/");
  } catch {
    return url.startsWith("/public/");
  }
};

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    response.data = normalizeMediaUrls(response.data);
    return response;
  },
  (error) => {
    if (error.response?.data?.error === "PLAN_LIMIT_EXCEEDED") {
      const { resource, limit, upgrade_to } = error.response.data;
      const names: Record<string, string> = {
        assets: "activos",
        users: "usuarios",
        storage: "almacenamiento",
        video: "video",
      };
      const msg = `Limite de ${names[resource] ?? resource} alcanzado (${limit}). Actualiza al plan ${upgrade_to} para continuar.`;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("api-toast", {
            detail: { message: msg, type: "error" },
          }),
        );
      }
      return Promise.reject(error);
    }

    if (error.response?.data?.error === "DEMO_EXPIRED") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("api-toast", {
            detail: {
              message:
                "Tu periodo de prueba ha expirado. Contacta con tu administrador.",
              type: "error",
            },
          }),
        );
      }
      return Promise.reject(error);
    }

    if (
      error.response &&
      error.response.status === 401 &&
      !isPublicRequest(error.config?.url) &&
      typeof window !== "undefined" &&
      // An ambient background check (e.g. AuthContext's /auth/me on mount)
      // 401s on a page that's public regardless of auth state (a share
      // link) — that's the expected, benign "not logged in" state there,
      // not a session-expiry event. Skip the whole reaction: no redirect,
      // and no auth:unauthorized broadcast either, since AuthContext's
      // handler calls queryClient.clear() — which would wipe out (and
      // permanently stall) that page's own in-flight/successful query.
      !isAlwaysPublicPath(window.location.pathname)
    ) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
