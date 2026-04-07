import { z } from "zod";

// Ejemplo de schema de login, a usar por el Form de Next
export const LoginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña requiere min. 6 caracteres"),
});

export type LoginFormData = z.infer<typeof LoginSchema>;
