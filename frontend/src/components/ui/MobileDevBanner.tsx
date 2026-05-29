import { Wrench } from "lucide-react";

export default function MobileDevBanner() {
  return (
    <div className="lg:hidden flex flex-col items-center justify-center gap-4 py-32 text-center">
      <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
        <Wrench className="w-6 h-6 text-brand" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-black text-title">Vista en desarrollo</p>
        <p className="text-sm font-medium text-subtitle/50">Próximamente adaptada para móvil</p>
      </div>
    </div>
  );
}
