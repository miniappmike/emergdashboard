import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL.replace(/^http/, "ws") + "/api/ws";

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("td_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function fileUrl(fileId) {
  const token = localStorage.getItem("td_token");
  return `${API}/files/${fileId}/download?auth=${token}`;
}

export default api;
