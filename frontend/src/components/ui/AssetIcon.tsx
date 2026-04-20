"use client";

import React from "react";
import { 
  Ship, 
  Car, 
  Home, 
  Square, 
  Plane, 
  Truck, 
  Factory, 
  Wrench, 
  HardHat, 
  Cpu, 
  Stethoscope, 
  Leaf, 
  Briefcase, 
  Trophy,
  Camera,
  LucideIcon
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  ship: Ship,
  car: Car,
  house: Home,
  building: Square,
  plane: Plane,
  truck: Truck,
  industry: Factory,
  tools: Wrench,
  construction: HardHat,
  tech: Cpu,
  health: Stethoscope,
  nature: Leaf,
  corporate: Briefcase,
  leisure: Trophy,
  camera: Camera,
};

interface AssetIconProps {
  iconId?: string | null;
  className?: string;
}

export default function AssetIcon({ iconId, className }: AssetIconProps) {
  const Icon = (iconId && ICON_MAP[iconId]) || Ship;
  return <Icon className={className} />;
}
