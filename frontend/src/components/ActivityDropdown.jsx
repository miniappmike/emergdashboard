import React, { useEffect, useState } from "react";
import { useOrg } from "@/context/OrgContext";
import api from "@/lib/api";
import { Avatar, timeAgo } from "@/lib/helpers";
import { Activity } from "lucide-react";

export default function ActivityDropdown() {
  const { activeOrg, subscribe } = useOrg();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/orgs/${activeOrg.id}/activity`);
      setLogs(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.id]);
  useEffect(() => subscribe((msg) => { if (msg.kind === "activity") load(); }), [activeOrg?.id]);

  return (
    <div data-testid="activity-dropdown" className="max-h-[70vh] overflow-auto">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-display font-bold tracking-tight">Recent activity</span>
      </div>
      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No activity yet</div>
      ) : (
        <div className="divide-y divide-border">
          {logs.map((l) => (
            <div key={l.id} className="px-4 py-2.5 flex items-start gap-2.5">
              <Avatar user={l.actor} size={28} />
              <div className="min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{l.actor?.name || "Someone"}</span>{" "}
                  <span className="text-muted-foreground">{l.action}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(l.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
