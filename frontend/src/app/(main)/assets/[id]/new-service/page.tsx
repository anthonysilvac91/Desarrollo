"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { assetsService } from "@/services/assets.service";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import NewServiceForm from "@/components/assets/NewServiceForm";

export default function NewAssetServicePage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const { user } = useAuth();
  const assetId = params.id as string;

  const canCreateService =
    user?.role === "ADMIN" || user?.role === "WORKER" || user?.role === "SUPER_ADMIN";

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsService.findOne(assetId),
    enabled: !!assetId,
  });

  if (!canCreateService) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <p className="font-black text-title text-lg">Sin permiso</p>
        <p className="text-subtitle/60 font-medium text-sm">No puedes crear servicios.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="font-black text-subtitle/40 tracking-widest text-xs uppercase">{t.feedback.syncing}</p>
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
        <div className="p-4 bg-error/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <p className="font-black text-title text-lg">{t.mobile.new_service.error_asset}</p>
        <button onClick={() => router.back()} className="text-brand text-sm font-black uppercase tracking-widest">
          Volver
        </button>
      </div>
    );
  }

  return (
    <NewServiceForm
      asset={asset}
      onSuccess={() => router.replace(`/assets/${assetId}`)}
      onCancel={() => router.back()}
    />
  );
}
