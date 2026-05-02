"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

function isIOSDevice() {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  const isiPhoneOrIPad = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isModernIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return (isiPhoneOrIPad || isModernIPad) && !navigatorWithStandalone.standalone;
}

export function usePWA() {
  const [isMobile, setIsMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(isIOSDevice);
  const [isStandalone, setIsStandalone] = useState(isStandaloneMode);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
      setIsStandalone(isStandaloneMode());
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
        })
        .catch((error) => {
          console.error("SW registration failed:", error);
        });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt || isStandalone) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }

    return outcome === "accepted";
  };

  return {
    isMobile,
    isIOS,
    isStandalone,
    canInstallNative: Boolean(deferredPrompt) && !isStandalone,
    shouldShowIOSInstructions: isMobile && isIOS && !isStandalone,
    shouldShowInstallButton: isMobile && Boolean(deferredPrompt) && !isStandalone,
    triggerInstall,
  };
}
