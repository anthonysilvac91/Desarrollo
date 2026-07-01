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
  "/dashboard": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/users": ["SUPER_ADMIN", "ADMIN"],
  "/owners": ["SUPER_ADMIN", "ADMIN"],
  "/settings": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/assets": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
  "/service": ["SUPER_ADMIN", "ADMIN", "WORKER"],
  "/trash": ["SUPER_ADMIN", "ADMIN"],
};

const isPublicRoute = (path: string): boolean =>
  path === "/login" ||
  path === "/" ||
  path === "/forgot-password" ||
  path === "/reset-password" ||
  path === "/register" ||
  path === "/signup" ||
  path.startsWith("/share/");

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
    queryClient.clear();
  }, [queryClient]);

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

    const isPublicPath = isPublicRoute(pathname);

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
