"use client";

import React, { useState } from "react";
import { UserCog, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function ImpersonationBanner() {
  const { user, stopImpersonation } = useAuth();
  const [isReturning, setIsReturning] = useState(false);

  if (!user?.impersonator) return null;

  const handleReturn = async () => {
    if (isReturning) return;
    setIsReturning(true);
    try {
      await stopImpersonation();
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="mx-4 sm:mx-8 lg:mx-14 mt-2 rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-3">
      <UserCog className="w-5 h-5 text-indigo-500 shrink-0" />
      <p className="text-sm font-semibold text-indigo-700 flex-1">
        Estás viendo la cuenta como <span className="font-black">{user.name}</span>.
      </p>
      <button
        onClick={handleReturn}
        disabled={isReturning}
        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
      >
        {isReturning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Volver a Super Admin
      </button>
    </div>
  );
}
