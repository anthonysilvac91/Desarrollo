import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");

if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required in production");
}

const normalizeMediaUrls = (value: unknown): unknown => {
  if (typeof value === "string") {
    if (value.startsWith("/uploads/")) {
      return `${apiBaseUrl}${value}`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeMediaUrls(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeMediaUrls(nestedValue)])
    );
  }

  return value;
};

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  // Alineado con AuthContext que usa localStorage
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Soporte automático para Multipart (FormData)
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers["Content-Type"];
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    response.data = normalizeMediaUrls(response.data);
    return response;
  },
  (error) => {
    // Si el error es 401 Unauthorized
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        
        // Redirigimos a login si no estamos ya ahí
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
