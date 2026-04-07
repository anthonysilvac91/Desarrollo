import Cookies from "js-cookie";

export const setAuthToken = (token: string) => {
  // Ajusta según la duración de tu token si lo necesitas (ej. expires: 1)
  Cookies.set("access_token", token, { secure: process.env.NODE_ENV === "production" });
};

export const removeAuthToken = () => {
  Cookies.remove("access_token");
};

export const getAuthToken = () => {
  return Cookies.get("access_token");
};
