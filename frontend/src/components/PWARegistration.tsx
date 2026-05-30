"use client";

import { useEffect } from "react";

export default function PWARegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });

        await registration.update();
      } catch (error) {
        console.error("SW registration failed:", error);
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
