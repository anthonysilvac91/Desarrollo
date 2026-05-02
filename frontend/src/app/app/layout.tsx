"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

function getFallbackPath(role?: string) {
  if (role === "SUPER_ADMIN") return "/master";
  if (role === "ADMIN") return "/dashboard";
  return "/assets";
}

function LoadingScreen() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full bg-app-bg flex items-center justify-center">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-brand animate-spin" />
        <p className="font-black text-subtitle/40 tracking-[0.2em] text-[10px] uppercase">
          {t.feedback.syncing}
        </p>
      </div>
    </div>
  );
}

export default function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const syncDevice = () => setIsMobile(window.innerWidth < 768);
    syncDevice();
    window.addEventListener("resize", syncDevice);
    return () => window.removeEventListener("resize", syncDevice);
  }, []);

  useEffect(() => {
    if (loading || isMobile === null) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "WORKER") {
      router.replace(getFallbackPath(user.role));
      return;
    }

    if (!isMobile) {
      router.replace("/assets");
    }
  }, [isMobile, loading, router, user]);

  const canRenderApp = !loading && isMobile === true && user?.role === "WORKER";

  if (!canRenderApp) {
    return <LoadingScreen />;
  }

  return (
    <div className="font-sans min-h-screen bg-app-bg transition-colors flex justify-center w-full">
      <div className="w-full max-w-md bg-app-bg min-h-screen flex flex-col relative shadow-2xl overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
