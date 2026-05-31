import React from "react";

export default function ModuleContainer({
  children,
  roundedClass,
}: {
  children: React.ReactNode;
  roundedClass?: string;
}) {
  return (
    <div className={`flex flex-col h-full bg-surface ${roundedClass ?? "rounded-[2rem]"} shadow-sm border border-border-theme/40 overflow-hidden transition-colors`}>
      {children}
    </div>
  );
}
