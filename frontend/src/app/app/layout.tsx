"use client";

import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";

export default function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

  return (
    // We enforce a mobile-like container centered on desktop for testing, 
    // and full width on actual mobile devices. Max-w-md provides a nice app feel.
    <div className="font-sans min-h-screen bg-app-bg transition-colors flex justify-center w-full">
      <div className="w-full max-w-md bg-app-bg min-h-screen flex flex-col relative shadow-2xl overflow-x-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
             <Loader2 className="w-10 h-10 text-brand animate-spin" />
             <p className="font-black text-subtitle/40 tracking-[0.2em] text-[10px] uppercase">
                Sincronizando...
             </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
