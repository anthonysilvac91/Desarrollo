"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export default function AssetsPage() {
  const { data: assets, isLoading, error } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await api.get("/assets");
      return res.data;
    },
  });

  if (isLoading) return <div>Cargando activos...</div>;
  if (error) return <div>Error al cargar los activos.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Activos (Assets)</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {assets?.map((asset: any) => (
          <div key={asset.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
            <div className="bg-gray-100 w-full aspect-square rounded-md flex items-center justify-center text-gray-400 text-xs overflow-hidden">
              {asset.file_type?.startsWith('image') ? (
                <img src={asset.file_url} alt={asset.filename} className="w-full h-full object-cover" />
              ) : (
                <span>{asset.filename}</span>
              )}
            </div>
            <div className="text-xs truncate font-medium text-gray-700" title={asset.filename}>
              {asset.filename}
            </div>
          </div>
        ))}
        {(!assets || assets.length === 0) && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            No hay activos disponibles.
          </div>
        )}
      </div>
    </div>
  );
}
