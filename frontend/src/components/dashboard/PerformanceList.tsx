"use client";

import React from "react";

interface PerformanceItem {
  id: string | number;
  name: string;
  metric: string | number;
  image?: string;
  icon?: React.ElementType;
}

interface PerformanceListProps {
  title: string;
  items: PerformanceItem[];
  metricLabel: string;
}

export default function PerformanceList({
  title,
  items,
  metricLabel
}: PerformanceListProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-[11px] font-black text-subtitle opacity-40 uppercase tracking-[0.2em] ml-1">{title}</h3>
      
      <div className="flex flex-col">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === items.length - 1;
          
          return (
            <div 
              key={item.id}
              className={`flex items-center justify-between py-4 transition-all group ${
                !isLast ? "border-b border-border-theme/20" : ""
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className="w-11 h-11 rounded-full bg-app-bg flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-1 ring-border-theme/10 group-hover:scale-105 transition-transform shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : Icon ? (
                    <Icon className="w-5 h-5 text-brand opacity-30 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <span className="text-sm font-black text-brand/20">{(index + 1)}</span>
                  )}
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-title tracking-tight group-hover:text-brand transition-colors line-clamp-1">{item.name}</span>
                </div>
              </div>

              <div className="flex items-center">
                <span className="h-8 flex items-center justify-center text-[12px] font-bold text-title bg-app-bg group-hover:bg-brand/5 group-hover:text-brand rounded-lg border border-border-theme/40 px-3 transition-all min-w-[90px]">
                  {item.metric} <span className="ml-1.5 text-[10px] opacity-30 font-black uppercase tracking-widest">{metricLabel}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
