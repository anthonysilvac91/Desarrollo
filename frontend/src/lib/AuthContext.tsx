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
    "/dashboard": ["SUPER_ADMIN", "ADMIN", "WORKER", "CLIENT", "EXTERNAL"],
    "/users": ["SUPER_ADMIN", "ADMIN"],
    "/owners": ["SUPER_ADMIN", "ADMIN"],
    "/customers": ["SUPER_ADMIN", "ADMIN"],
    "/settings": ["ADMIN"],
    "/assets": ["SUPER_ADMIN", "ADMIN", "WORKER", "CLIENT", "EXTERNAL"],
    "/service": ["SUPER_ADMIN", "ADMIN", "WORKER"],
    "/app": ["ADMIN", "WORKER"]
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;
    
    // Si la ruta no está en el mapa, es pública o no restringida por rol (ej. /login)
    const protectedPath = Object.keys(ROUTE_PERMISSIONS).find(p => path.startsWith(p));
    if (!protectedPath) return true;

    return ROUTE_PERMISSIONS[protectedPath].includes(user.role);
  };

  // Proteger rutas (Auth + Roles + Dispositivos)
  useEffect(() => {
    if (!loading) {
      const isPublicPath = pathname === "/login" || pathname === "/register" || pathname === "/";
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      
      if (!user && !isPublicPath) {
        router.push("/login");
        return;
      }

      if (user) {
        const isWorker = user.role === "WORKER";
        const isMobileAppRole = user.role === "ADMIN" || user.role === "WORKER";

        // A. Redirecciones basadas en rol para /app (aislamiento)
        if (isMobileAppRole) {
          if (!isMobile && pathname.startsWith("/app")) {
            // Worker en PC -> Web normal
            router.replace(user.role === "ADMIN" ? "/dashboard" : "/assets");
            return;
          } else if (isWorker && isMobile && !pathname.startsWith("/app") && !isPublicPath) {
            // Worker en Teléfono -> Obligar /app
            router.replace("/app");
            return;
          }
        } else {
          // Otros roles -> Prohibido entrar a /app
          if (pathname.startsWith("/app")) {
            if (user.role === "SUPER_ADMIN") router.replace("/master");
            else if (user.role === "ADMIN") router.replace("/dashboard");
            else router.replace("/assets");
            return;
          }
        }

        // B. Redirección desde login o home
        if (isPublicPath) {
          if (user.role === "SUPER_ADMIN") router.push("/master");
          else if (user.role === "ADMIN") router.push(isMobile ? "/app" : "/dashboard");
          else if (user.role === "WORKER") router.push(isMobile ? "/app" : "/assets");
          else router.push("/assets"); // CLIENT / EXTERNAL
          return;
        }

        // C. Validación de permisos genérica
        if (!canAccess(pathname)) {
          const fallback =
            user.role === "ADMIN"
              ? (isMobile ? "/app" : "/dashboard")
              : user.role === "WORKER"
                ? (isMobile ? "/app" : "/assets")
                : "/assets";
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
