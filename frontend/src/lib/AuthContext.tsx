"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@/types/auth";
import { authService } from "@/services/auth.service";
import { useRouter, usePathname } from "next/navigation";

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

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error: any) {
      const serverMessage = error.response?.data?.message || error.message || "Unknown error";
      console.warn("Auth initialization error. User logged out. Details:", serverMessage);
      setUser(null);
      localStorage.removeItem("access_token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (token: string) => {
    localStorage.setItem("access_token", token);
    refreshUser();
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    router.push("/login");
  };

  /**
   * Mapa de permisos por rol para el MVP
   */
  const ROUTE_PERMISSIONS: Record<string, string[]> = {
    "/dashboard": ["SUPER_ADMIN", "ADMIN", "WORKER", "CLIENT"],
    "/users": ["SUPER_ADMIN", "ADMIN"],
    "/settings": ["ADMIN"],
    "/assets": ["SUPER_ADMIN", "ADMIN", "WORKER", "CLIENT"],
    "/service": ["SUPER_ADMIN", "ADMIN", "WORKER"],
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
      const isPublicPath = pathname === "/login" || pathname === "/register" || pathname === "/";
      
      if (!user && !isPublicPath) {
        router.push("/login");
        return;
      }

      if (user && !isPublicPath) {
        if (!canAccess(pathname)) {
          console.warn(`Access denied to ${pathname} for role ${user.role}`);
          // Redirección por defecto según rol
          const canDashboard = canAccess("/dashboard");
          const defaultPath = canDashboard ? "/dashboard" : "/assets";
          router.push(defaultPath);
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
