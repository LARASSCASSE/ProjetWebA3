import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // indispensable pour envoyer/recevoir le cookie refresh
});

export const getAccessToken = () =>
  typeof window === "undefined" ? null : localStorage.getItem("accessToken");
export const setAccessToken = (t: string) => localStorage.setItem("accessToken", t);
export const clearAccessToken = () => localStorage.removeItem("accessToken");

// attache l'access token à chaque requête
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// sur 401 : tente un refresh, puis rejoue la requête d'origine
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url || "";
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !url.includes("/api/auth/refresh") &&
      !url.includes("/api/auth/login")
    ) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        clearAccessToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);
