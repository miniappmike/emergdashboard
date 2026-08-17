import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api, { WS_URL } from "../lib/api";
import { useAuth } from "./AuthContext";

const OrgContext = createContext(null);
export const useOrg = () => useContext(OrgContext);

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [unread, setUnread] = useState(0);
  const [socketEvents, setSocketEvents] = useState(null); // last event
  const wsRef = useRef(null);
  const listeners = useRef([]);

  const perms = activeOrg?.permissions || {};

  const loadOrgs = useCallback(async () => {
    const { data } = await api.get("/orgs");
    setOrgs(data);
    return data;
  }, []);

  const loadMembers = useCallback(async (orgId) => {
    if (!orgId) return;
    const { data } = await api.get(`/orgs/${orgId}/members`);
    setMembers(data);
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications/unread-count");
      setUnread(data.count);
    } catch {}
  }, []);

  const switchOrg = useCallback(async (org) => {
    setActiveOrg(org);
    await api.post(`/orgs/${org.id}/switch`);
    loadMembers(org.id);
  }, [loadMembers]);

  // init
  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await loadOrgs();
      const last = user.last_active_org_id;
      const chosen = data.find((o) => o.id === last) || data[0] || null;
      if (chosen) {
        setActiveOrg(chosen);
        loadMembers(chosen.id);
      }
      loadUnread();
    })();
  }, [user, loadOrgs, loadMembers, loadUnread]);

  // websocket
  const subscribe = useCallback((fn) => {
    listeners.current.push(fn);
    return () => {
      listeners.current = listeners.current.filter((l) => l !== fn);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("td_token");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.kind === "notification") {
          setUnread((c) => c + 1);
        }
        setSocketEvents(msg);
        listeners.current.forEach((l) => l(msg));
      } catch {}
    };
    return () => ws.close();
  }, [user]);

  return (
    <OrgContext.Provider
      value={{
        orgs, activeOrg, members, perms, unread, socketEvents,
        setActiveOrg, switchOrg, loadOrgs, loadMembers, loadUnread, setUnread, subscribe,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}
