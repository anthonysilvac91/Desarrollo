import React from "react";

export default function ModuleContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-surface rounded-[2rem] shadow-sm border border-border-theme/40 overflow-hidden transition-colors">
      {children}
    </div>
  );
}
