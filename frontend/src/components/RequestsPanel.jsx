import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import api, { formatError } from "@/lib/api";
import { Avatar, timeAgo } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, UserPlus } from "lucide-react";

export default function RequestsPanel() {
  const { activeOrg, loadMembers } = useOrg();
  const [reqs, setReqs] = useState([]);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const { data } = await api.get(`/orgs/${activeOrg.id}/requests`);
      setReqs(data);
    } catch {}
  }, [activeOrg?.id]);
  useEffect(() => { load(); }, [load]);

  const act = async (r, action) => {
    try {
      await api.post(`/orgs/${activeOrg.id}/requests/${r.id}/${action}`);
      setReqs((p) => p.filter((x) => x.id !== r.id));
      if (action === "approve") { loadMembers(activeOrg.id); toast.success(`${r.user?.name} approved`); }
      else toast.success("Request denied");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-black text-2xl tracking-tighter mb-1">Join Requests</h2>
      <p className="text-sm text-muted-foreground mb-5">People who requested to join {activeOrg?.name}.</p>

      {reqs.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center text-muted-foreground">
          <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No pending requests
        </div>
      ) : (
        <div className="border border-border divide-y divide-border bg-card">
          {reqs.map((r) => (
            <div key={r.id} data-testid={`request-row-${r.id}`} className="flex items-center gap-3 px-4 py-3">
              <Avatar user={r.user} size={38} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.user?.name}</p>
                <p className="text-xs text-muted-foreground">{r.user?.email} · {timeAgo(r.created_at)}</p>
              </div>
              <Button data-testid={`approve-${r.id}`} onClick={() => act(r, "approve")} size="sm" className="bg-navy text-white rounded-none"><Check className="w-4 h-4 mr-1" /> Approve</Button>
              <Button data-testid={`deny-${r.id}`} onClick={() => act(r, "deny")} size="sm" variant="outline" className="rounded-none"><X className="w-4 h-4 mr-1" /> Deny</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
