"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoginSchema, type LoginFormData } from "@/types/schemas";
import { authService } from "@/services/auth.service";
import { setAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      setAuthToken(data.access_token);
      router.push("/admin");
    },
    onError: (error: any) => {
      setErrorMsg(error.response?.data?.message || "Ocurrió un error al iniciar sesión");
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setErrorMsg("");
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido a Recall</h1>
          <p className="text-sm text-gray-500 mt-2">Ingresa tus credenciales para continuar</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <Input
              type="email"
              placeholder="admin@recall.com"
              {...register("email")}
              error={errors.email?.message}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              error={errors.password?.message}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Iniciando..." : "Ingresar al sistema"}
          </Button>
        </form>
      </div>
    </div>
  );
}
