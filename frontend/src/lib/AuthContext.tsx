"use client";

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { User } from "@/types/auth";
import { isSafeInternalPath } from "@/lib/safe-path";
import { isAlwaysPublicPath } from "@/lib/publicRoutes";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  canAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/organizations": ["SUPER_ADMIN"],
  "/email-templates": ["SUPER_ADMIN"],
  "/dashboard": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/users": ["SUPER_ADMIN", "ADMIN"],
  "/owners": ["SUPER_ADMIN", "ADMIN"],
  "/settings": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/assets": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/service": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/trash": ["SUPER_ADMIN", "ADMIN"],
};

// Guest-only routes: shown when logged out, but redirect away to the
// dashboard if the viewer is already authenticated (no reason to see the
// login form again). This is distinct from isAlwaysPublicPath (e.g.
// /share/...), which must render the same way for everyone regardless of
// auth state — a logged-in admin previewing their own share link should
// see the shared content, not get bounced to /dashboard.
const isGuestOnlyRoute = (path: string): boolean =>
  path === "/login" ||
  path === "/" ||
  path === "/forgot-password" ||
  path === "/reset-password" ||
  path === "/register" ||
  path === "/signup";

const getServerMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data
  ) {
    return String(error.response.data.message);
  }

  return error instanceof Error ? error.message : "Unknown error";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const clearClientAuthState = useCallback(() => {
    setUser(null);
    // On an always-public page (e.g. a share link), there was never a
    // logged-in session to begin with — the ambient /auth/me check 401ing
    // is the expected, benign state, not a session expiry. Wiping the
    // whole query cache here would also blow away that page's own
    // in-flight/successful query, permanently stalling it.
    if (!isAlwaysPublicPath(pathname)) {
      queryClient.clear();
    }
  }, [queryClient, pathname]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error: unknown) {
      console.warn(
        "Auth initialization error. User logged out. Details:",
        getServerMessage(error),
      );
      clearClientAuthState();
    } finally {
      setLoading(false);
    }
  }, [clearClientAuthState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshUser();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearClientAuthState();
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [clearClientAuthState]);

  const login = useCallback(async () => {
    queryClient.clear();
    setLoading(true);
    await refreshUser();
  }, [queryClient, refreshUser]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // The server may already consider the session expired; local state still clears.
    }
    clearClientAuthState();
    router.push("/login");
  }, [clearClientAuthState, router]);

  const canAccess = useCallback(
    (path: string): boolean => {
      if (!user) return false;

      const protectedPath = Object.keys(ROUTE_PERMISSIONS).find((route) =>
        path.startsWith(route),
      );
      if (!protectedPath) return true;

      return ROUTE_PERMISSIONS[protectedPath].includes(user.role);
    },
    [user],
  );

  useEffect(() => {
    if (loading) return;

    // Always-public pages (e.g. a service share link) render the same for
    // everyone — never redirect based on auth state, logged in or not.
    if (isAlwaysPublicPath(pathname)) return;

    const isPublicPath = isGuestOnlyRoute(pathname);

    if (!user && !isPublicPath) {
      router.push("/login");
      return;
    }

    if (!user) return;

    if (isPublicPath) {
      const pendingRedirect = sessionStorage.getItem("pendingRedirect");
      if (pendingRedirect && isSafeInternalPath(pendingRedirect)) {
        sessionStorage.removeItem("pendingRedirect");
        router.push(pendingRedirect);
        return;
      }
      if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
        router.push("/dashboard");
      } else {
        router.push("/assets");
      }
      return;
    }

    if (!canAccess(pathname)) {
      const fallback =
        user.role === "SUPER_ADMIN" || user.role === "ADMIN"
          ? "/dashboard"
          : "/assets";
      router.replace(fallback);
    }
  }, [user, loading, pathname, router, canAccess]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUser, canAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
