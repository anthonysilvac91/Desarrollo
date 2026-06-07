import Cookies from "js-cookie";

export const setAuthToken = (token: string) => {
  Cookies.set("access_token", token, { expires: 7, secure: process.env.NODE_ENV === "production", sameSite: "Lax" });
};

export const removeAuthToken = () => {
  Cookies.remove("access_token");
};

export const getAuthToken = () => {
  return Cookies.get("access_token");
};
