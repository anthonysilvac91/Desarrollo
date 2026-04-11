"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import FilterPopover from "./FilterPopover";

interface FiltersBarProps {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  // Filter Props
  clients: string[];
  categories: string[];
  selectedClients: string[];
  selectedCategories: string[];
  onToggleClient: (client: string) => void;
  onToggleCategory: (category: string) => void;
  onClearAll: () => void;
  // Others
  actions?: React.ReactNode;
}

export default function FiltersBar({
  searchPlaceholder,
  onSearchChange,
  clients,
  categories,
  selectedClients,
  selectedCategories,
  onToggleClient,
  onToggleCategory,
  onClearAll,
  actions,
}: FiltersBarProps) {
  const { t } = useLanguage();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFilterCount = selectedClients.length + selectedCategories.length;

  return (
    <div className="px-0 py-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 shrink-0 transition-colors">
      
      {/* Search Input */}
      <div className="relative w-full sm:w-[500px]">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-subtitle opacity-30" aria-hidden="true" />
        </div>
        <input
          type="text"
          className="block w-full pl-14 pr-4 py-3.5 border border-border-theme/60 rounded-2xl leading-5 bg-white text-title placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand sm:text-sm transition-all shadow-sm font-medium"
          placeholder={searchPlaceholder || t.assets.search_placeholder}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      {/* Right side group: Actions. Filter button hidden as per user request */}
      <div className="flex items-center space-x-5 w-full sm:w-auto justify-end relative">
        
        {/* Filter Button - Hidden but kept in code for future use
        <div className="relative">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center space-x-2 border px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm whitespace-nowrap relative ${
              isFilterOpen || activeFilterCount > 0 
                ? "bg-brand/5 border-brand text-brand" 
                : "bg-white border-border-theme text-subtitle hover:bg-gray-100"
            }`}
          >
            <SlidersHorizontal className={`w-4 h-4 ${activeFilterCount > 0 ? "opacity-100" : "opacity-50"}`} />
            <span>{t.assets.filter}</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[8px] font-black text-white shadow-sm ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFilterOpen ? "rotate-180" : "opacity-30"}`} />
          </button>

          <FilterPopover 
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            clients={clients}
            categories={categories}
            selectedClients={selectedClients}
            selectedCategories={selectedCategories}
            onToggleClient={onToggleClient}
            onToggleCategory={onToggleCategory}
            onClearAll={onClearAll}
          />
        </div>
        */}

        {/* Custom Actions (e.g. Add New) */}
        {actions && (
          <div className="flex items-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
