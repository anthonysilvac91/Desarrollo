import React from "react";

interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function ModuleHeader({
  title,
  subtitle,
  actions,
}: ModuleHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-4 shrink-0 px-0">
      <div>
        <h1 className="text-5xl font-black text-title tracking-tight sm:text-6xl">{title}</h1>
        {subtitle && (
          <p className="text-lg text-subtitle/50 mt-3 font-medium tracking-tight">{subtitle}</p>
        )}
      </div>
      
      {/* Container for right-side actions if provided directly */}
      {actions && (
        <div className="flex items-center space-x-3 mb-2">
          {actions}
        </div>
      )}
    </div>
  );
}
