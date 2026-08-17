import React, { useEffect, useState } from "react";
import { useOrg } from "@/context/OrgContext";
import api from "@/lib/api";
import WindowFrame from "./WindowFrame";
import { Avatar, timeAgo } from "@/lib/helpers";
import { Activity } from "lucide-react";

export default function ActivityWidget({ item }) {
  const { activeOrg, subscribe } = useOrg();
  const [logs, setLogs] = useState([]);
  const load = async () => {
    if (!activeOrg) return;
    const { data } = await api.get(`/orgs/${activeOrg.id}/activity`);
    setLogs(data);
  };
  useEffect(() => { load(); }, [activeOrg?.id]);
  useEffect(() => subscribe((m) => { if (m.kind === "activity") load(); }), [activeOrg?.id]);

  return (
    <WindowFrame item={item} title="Activity Feed" icon={<Activity className="w-3.5 h-3.5 text-primary" />}>
      <div className="divide-y divide-border">
        {logs.length === 0 && <p className="p-3 text-xs text-muted-foreground">No activity yet</p>}
        {logs.map((l) => (
          <div key={l.id} className="px-3 py-2 flex items-start gap-2">
            <Avatar user={l.actor} size={22} />
            <p className="text-xs leading-snug">
              <span className="font-semibold">{l.actor?.name}</span> <span className="text-muted-foreground">{l.action}</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">{timeAgo(l.created_at)}</span>
            </p>
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}
