"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

const PALETTE_COLORS: Record<string, string> = {
  recall: "#3b82f6",  // blue-500
  ocean: "#06b6d4",   // cyan-500
  teal: "#14b8a6",    // teal-500
  forest: "#10b981",  // emerald-500
  amber: "#f59e0b",   // amber-500
  orange: "#f97316",  // orange-500
  rose: "#f43f5e",    // rose-500
  pink: "#ec4899",    // pink-500
  indigo: "#6366f1",  // indigo-500
  violet: "#8b5cf6",  // violet-500
  slate: "#64748b",   // slate-500
};

export function DynamicBranding() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.organization?.brand_color) {
      const color = PALETTE_COLORS[user.organization.brand_color] || user.organization.brand_color;
      if (color) {
        document.documentElement.style.setProperty("--theme-primary", color);
      }
    } else {
      // Default color if none set
      document.documentElement.style.setProperty("--theme-primary", "#0058BC");
    }
  }, [user]);

  return null;
}
