"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, AlertCircle, X, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-center space-x-4 px-5 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-right duration-300
              ${toast.type === "success" ? "bg-white border-brand/20" : ""}
              ${toast.type === "error" ? "bg-white border-error/20" : ""}
              ${toast.type === "info" ? "bg-white border-border-theme/40" : ""}
            `}
          >
            <div className={`p-2 rounded-xl scale-90 ${
              toast.type === "success" ? "bg-brand/10 text-brand" : 
              toast.type === "error" ? "bg-error/10 text-error" : 
              "bg-app-bg text-subtitle"
            }`}>
              {toast.type === "success" && <CheckCircle className="w-5 h-5" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5" />}
              {toast.type === "info" && <Info className="w-5 h-5" />}
            </div>
            
            <p className="text-[14px] font-bold text-title tracking-tight pr-4">
              {toast.message}
            </p>

            <button 
              onClick={() => removeToast(toast.id)}
              className="p-1.5 hover:bg-app-bg rounded-lg transition-colors text-subtitle/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
