import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api from "@/lib/api";
import { Avatar, timeAgo } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { AtSign, Users, Shield, UserPlus, CheckCheck, Trash2 } from "lucide-react";

const TYPE_META = {
  mention: { icon: AtSign, label: "Mention" },
  team_mention: { icon: Users, label: "Team mention" },
  permission_change: { icon: Shield, label: "Permissions" },
  join_request: { icon: UserPlus, label: "Join request" },
};

export default function NotificationsPanel() {
  const { setUnread, subscribe, orgs, switchOrg } = useOrg();
  const { openChat, setView } = useWorkspace();
  const [notifs, setNotifs] = useState([]);
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const load = useCallback(async () => {
    const { data } = await api.get("/notifications");
    setNotifs(data);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe((m) => { if (m.kind === "notification") load(); }), []);

  const markAll = async () => {
    await api.post("/notifications/mark-read", {});
    setNotifs((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };
  const clearRead = async () => {
    await api.post("/notifications/clear-read");
    setNotifs((p) => p.filter((n) => !n.read));
  };
  const markOne = async (n) => {
    if (!n.read) { await api.post("/notifications/mark-read", { ids: [n.id] }); setNotifs((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x))); setUnread((c) => Math.max(0, c - 1)); }
  };
  const jump = async (n) => {
    await markOne(n);
    const org = orgs.find((o) => o.id === n.org_id);
    if (org) await switchOrg(org);
    if (n.source_type === "chat_message") openChat("team");
    else setView("shared");
  };

  const filtered = notifs.filter((n) =>
    (filterTeam === "all" || n.org_id === filterTeam) &&
    (filterType === "all" || (filterType === "mentions" ? ["mention", "team_mention"].includes(n.type) : ["permission_change", "join_request"].includes(n.type)))
  );

  return (
    <div className="h-full overflow-auto p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-black text-2xl tracking-tighter">Notifications</h2>
        <div className="flex gap-2">
          <Button data-testid="mark-all-read" onClick={markAll} size="sm" variant="outline" className="rounded-none"><CheckCheck className="w-4 h-4 mr-1" /> Mark all read</Button>
          <Button data-testid="clear-read" onClick={clearRead} size="sm" variant="outline" className="rounded-none"><Trash2 className="w-4 h-4 mr-1" /> Clear read</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Mentions and system notices from every team you belong to.</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <select data-testid="notif-team-filter" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="text-xs border border-border bg-card px-2 py-1.5">
          <option value="all">All teams</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {["all", "mentions", "system"].map((t) => (
          <button key={t} data-testid={`notif-type-${t}`} onClick={() => setFilterType(t)} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-label ${filterType === t ? "bg-navy text-white" : "border border-border hover:bg-secondary"}`}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center text-muted-foreground">You're all caught up.</div>
      ) : (
        <div className="border border-border divide-y divide-border bg-card">
          {filtered.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.mention;
            const Icon = meta.icon;
            return (
              <button key={n.id} data-testid={`notif-${n.id}`} onClick={() => jump(n)} className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}>
                {!n.read && <span className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />}
                <Avatar user={n.actor} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{n.actor?.name || "Someone"}</span>{" "}
                    <span className="text-muted-foreground">
                      {n.type === "mention" && "mentioned you"}
                      {n.type === "team_mention" && "notified the team"}
                      {n.type === "permission_change" && "updated your permissions"}
                      {n.type === "join_request" && "requested to join"}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Icon className="w-3 h-3" /> {meta.label}</span>
                    <span>·</span>
                    <span className="font-medium text-navy">{n.org_name}</span>
                    <span>·</span>
                    <span>{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
