"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@/types/auth";
import { authService } from "@/services/auth.service";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import Cookies from "js-cookie";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  canAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setUser(null);
        Cookies.remove("access_token");
        queryClient.clear();
        setLoading(false);
        return;
      }
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error: unknown) {
      const serverMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data
          ? error.response.data.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
      console.warn("Auth initialization error. User logged out. Details:", serverMessage);
      setUser(null);
      localStorage.removeItem("access_token");
      Cookies.remove("access_token");
      queryClient.clear();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (token: string) => {
    queryClient.clear();
    localStorage.setItem("access_token", token);
    Cookies.set("access_token", token, { expires: 7 }); // Sincronizado para middleware
    refreshUser();
  };

  const logout = () => {
    authService.logout().catch(() => undefined);
    localStorage.removeItem("access_token");
    Cookies.remove("access_token");
    queryClient.clear();
    setUser(null);
    router.push("/login");
  };

  /**
   * Mapa de permisos por rol para el MVP
   */
  const ROUTE_PERMISSIONS: Record<string, string[]> = {
    "/organizations": ["SUPER_ADMIN"],
    "/dashboard": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
    "/users": ["SUPER_ADMIN", "ADMIN"],
    "/owners": ["SUPER_ADMIN", "ADMIN"],
    "/settings": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
    "/assets": ["SUPER_ADMIN", "ADMIN", "WORKER", "EXTERNAL"],
    "/service": ["SUPER_ADMIN", "ADMIN", "WORKER"]
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;
    
    // Si la ruta no está en el mapa, es pública o no restringida por rol (ej. /login)
    const protectedPath = Object.keys(ROUTE_PERMISSIONS).find(p => path.startsWith(p));
    if (!protectedPath) return true;

    return ROUTE_PERMISSIONS[protectedPath].includes(user.role);
  };

  // Proteger rutas (Auth + Roles)
  useEffect(() => {
    if (!loading) {
      const isPublicPath =
        pathname === "/login" ||
        pathname === "/" ||
        pathname === "/forgot-password" ||
        pathname === "/reset-password" ||
        pathname === "/register";

      if (!user && !isPublicPath) {
        router.push("/login");
        return;
      }

      if (user) {
        if (isPublicPath) {
          if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") router.push("/dashboard");
          else router.push("/assets");
          return;
        }

        if (!canAccess(pathname)) {
          const fallback =
            user.role === "SUPER_ADMIN" || user.role === "ADMIN" ? "/dashboard" : "/assets";
          router.replace(fallback);
        }
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, canAccess }}>
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
