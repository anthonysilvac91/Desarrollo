"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus } from "lucide-react";

interface Option {
  id: string;
  name: string;
}

interface ComboboxProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  onCreate?: (name: string) => void;
}

export default function Combobox({ options, value, onChange, placeholder, label, onCreate }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar el query con el nombre de la opción seleccionada (cuando cambia el value desde fuera)
  useEffect(() => {
    const selectedOption = options.find(opt => opt.id === value);
    if (selectedOption) {
      setQuery(selectedOption.name);
    } else if (!value) {
      setQuery("");
    }
  }, [value, options]);

  // Filter options based on query
  // Si el query coincide exactamente con la opción seleccionada, mostramos todas al abrir
  const isSelected = options.some(opt => opt.id === value && opt.name === query);
  const filteredOptions = (query === "" || isSelected)
    ? options 
    : options.filter((opt) => opt.name.toLowerCase().includes(query.toLowerCase()));

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Reset translation: if they clicked outside without selecting, snap back to current value
        const currentOpt = options.find(o => o.id === value);
        if (currentOpt) setQuery(currentOpt.name);
        else if (!value) setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const handleSelect = (option: Option) => {
    setQuery(option.name);
    onChange(option.id);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val === "") onChange(""); // Clear selection if input is cleared
    setIsOpen(true);
  };

  return (
    <div className="flex flex-col space-y-2 relative" ref={containerRef}>
      <label className="text-[13px] font-bold text-subtitle uppercase tracking-widest pl-1">
        {label}
      </label>
      
      <div className="relative group">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-5 pr-12 py-4 bg-gray-50/50 border border-border-theme/60 rounded-2xl text-title font-medium placeholder:text-subtitle/30 focus:outline-none focus:ring-2 focus:ring-brand/10 focus:border-brand transition-all shadow-sm"
          placeholder={placeholder}
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-subtitle/30 transition-colors group-hover:text-subtitle/50">
          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl border border-border-theme/60 shadow-xl z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto custom-scroll">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt)}
                  className="w-full text-left px-5 py-3.5 text-sm font-semibold text-title hover:bg-gray-50 transition-colors"
                >
                  {opt.name}
                </button>
              ))
            ) : null}

            {/* Create option */}
            {onCreate && query !== "" && !isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreate(query);
                  setIsOpen(false);
                }}
                className="w-full text-left px-5 py-3.5 text-sm font-black text-brand bg-brand/5 hover:bg-brand/10 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Crear &quot;{query}&quot;</span>
              </button>
            )}

            {filteredOptions.length === 0 && !onCreate && query !== "" && (
              <div className="px-5 py-3.5 text-sm text-subtitle/40 italic">
                Sin resultados para &quot;{query}&quot;
              </div>
            )}

            {query === "" && options.length === 0 && (
              <div className="px-5 py-3.5 text-sm text-subtitle/40">Comienza a escribir...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
