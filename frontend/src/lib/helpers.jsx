import React from "react";
import { API } from "./api";

export function initials(name = "") {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function avatarSrc(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = API.replace(/\/api$/, "");
  if (url.startsWith("/api/public-image/")) return `${base}${url}`;
  const token = localStorage.getItem("td_token");
  const sep = url.includes("?") ? "&" : "?";
  return `${base}${url}${sep}auth=${token}`;
}

export function Avatar({ user, size = 32, className = "" }) {
  const src = avatarSrc(user?.avatar_url);
  const s = { width: size, height: size };
  return (
    <div
      className={`shrink-0 flex items-center justify-center bg-navy text-white font-bold overflow-hidden rounded-full ${className}`}
      style={{ ...s, fontSize: size * 0.4 }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials(user?.name)}
    </div>
  );
}

export function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function renderMentions(text) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="mention">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
