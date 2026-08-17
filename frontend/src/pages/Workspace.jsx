import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";
import { useOrg } from "@/context/OrgContext";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Canvas from "@/components/Canvas";
import NotesPanel from "@/components/NotesPanel";
import FilesPanel from "@/components/FilesPanel";
import SharedLibrary from "@/components/SharedLibrary";
import ChatPanel from "@/components/ChatPanel";
import MembersPanel from "@/components/MembersPanel";
import RequestsPanel from "@/components/RequestsPanel";
import NotificationsPanel from "@/components/NotificationsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import { toast } from "sonner";

const WsCtx = createContext(null);
export const useWorkspace = () => useContext(WsCtx);

const DEFAULT_APPEARANCE = {
  background_type: "color", background_value: "", window_outline_color: "#E63946",
  window_outline_width: 1, text_size: "medium", text_color: "#0A0A0B", auto_adapt_text: true,
};

export default function Workspace() {
  const { activeOrg } = useOrg();
  const [view, setView] = useState("home");
  const [refreshKey, setRefreshKey] = useState(0);
  const [layout, setLayout] = useState([]);
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [chatTarget, setChatTarget] = useState(null); // {channel}
  const [sharedOwner, setSharedOwner] = useState(null);
  const saveTimer = useRef(null);

  const orgId = activeOrg?.id;

  // Load layout + appearance on org change
  useEffect(() => {
    if (!orgId) return;
    setView("home");
    api.get(`/orgs/${orgId}/layout`).then(({ data }) => setLayout(data)).catch(() => setLayout([]));
    api.get(`/orgs/${orgId}/appearance`).then(({ data }) => setAppearance({ ...DEFAULT_APPEARANCE, ...data })).catch(() => {});
  }, [orgId]);

  const persistLayout = useCallback((items) => {
    if (!orgId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/orgs/${orgId}/layout`, { items }).catch(() => {});
    }, 700);
  }, [orgId]);

  const setLayoutAndSave = useCallback((updater) => {
    setLayout((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const pin = useCallback((content_type, content_id, size = {}) => {
    setLayoutAndSave((prev) => {
      if (content_id && prev.some((i) => i.content_id === content_id)) {
        toast.info("Already pinned to your canvas");
        return prev;
      }
      const maxZ = prev.reduce((m, i) => Math.max(m, i.z_index || 1), 1);
      const item = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        content_type, content_id: content_id || null,
        x: 60 + prev.length * 28, y: 60 + prev.length * 24,
        width: size.width || 320, height: size.height || 260, z_index: maxZ + 1,
      };
      return [...prev, item];
    });
    setView("home");
    toast.success("Pinned to your canvas");
  }, [setLayoutAndSave]);

  const unpin = useCallback((itemId) => {
    setLayoutAndSave((prev) => prev.filter((i) => i.id !== itemId));
  }, [setLayoutAndSave]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    if (orgId) api.get(`/orgs/${orgId}/layout`).then(({ data }) => setLayout(data)).catch(() => {});
    toast.success("Pulled in the latest shared content");
  }, [orgId]);

  const saveAppearance = useCallback(async (patch) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    if (orgId) await api.put(`/orgs/${orgId}/appearance`, patch).catch(() => {});
  }, [appearance, orgId]);

  const openChat = useCallback((channel) => {
    setChatTarget({ channel });
    setView("chat");
  }, []);

  const ctx = {
    view, setView, refreshKey, refresh, layout, setLayoutAndSave, pin, unpin,
    appearance, saveAppearance, chatTarget, openChat, sharedOwner, setSharedOwner,
  };

  if (!activeOrg) {
    return (
      <div className="h-screen w-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground bg-background">
          <div className="text-center max-w-sm">
            <p className="font-display font-black text-2xl tracking-tighter text-foreground mb-2">No team yet</p>
            <p>Create an organization from the switcher above to get started.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WsCtx.Provider value={ctx}>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
        <Header />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden relative">
            {view === "home" && <Canvas />}
            {view === "notes" && <NotesPanel />}
            {view === "files" && <FilesPanel />}
            {view === "shared" && <SharedLibrary />}
            {view === "chat" && <ChatPanel />}
            {view === "members" && <MembersPanel />}
            {view === "requests" && <RequestsPanel />}
            {view === "notifications" && <NotificationsPanel />}
            {view === "settings" && <SettingsPanel />}
          </main>
        </div>
      </div>
    </WsCtx.Provider>
  );
}
