import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña requiere min. 6 caracteres"),
});
export type LoginFormData = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Correo inválido"),
});
export type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(6, "La contraseña requiere min. 6 caracteres"),
  confirm: z.string().min(6, "La contraseña requiere min. 6 caracteres"),
}).refine((d) => d.password === d.confirm, {
  message: "Las contraseñas no coinciden",
  path: ["confirm"],
});
export type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;

export const RegisterSchema = z.object({
  name: z.string().min(2, "El nombre requiere min. 2 caracteres"),
  password: z.string().min(6, "La contraseña requiere min. 6 caracteres"),
});
export type RegisterFormData = z.infer<typeof RegisterSchema>;
