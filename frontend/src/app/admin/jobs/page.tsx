"use client";

import { useQuery } from "@tanstack/react-query";
import { jobsService } from "@/services/jobs.service";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function JobsPage() {
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsService.findAll,
  });

  if (isLoading) return <div>Cargando trabajos...</div>;
  if (error) return <div>Error al cargar los trabajos.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Trabajos (Jobs)</h1>
        <Button>Nuevo Trabajo</Button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID / Título
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Público
              </th>
              <th className="px-6 py-3 rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-sm">
            {jobs?.map((job: any) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{job.title}</div>
                  <div className="text-gray-500 text-xs">{job.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {job.is_public ? "Sí" : "No"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                  <Link href={`/admin/jobs/${job.id}`} className="text-blue-600 hover:text-blue-900">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {(!jobs || jobs.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No hay trabajos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
