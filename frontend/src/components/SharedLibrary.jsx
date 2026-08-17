import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api from "@/lib/api";
import { Avatar, timeAgo } from "@/lib/helpers";
import { Pin, Globe, FileText, StickyNote, Filter, X } from "lucide-react";

export default function SharedLibrary() {
  const { activeOrg, members, perms } = useOrg();
  const { pin, refreshKey, sharedOwner, setSharedOwner } = useWorkspace();
  const [data, setData] = useState({ files: [], notes: [], no_permission: false });
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const params = {};
    if (sharedOwner) params.owner_id = sharedOwner;
    const { data } = await api.get(`/orgs/${activeOrg.id}/shared`, { params });
    setData(data);
  }, [activeOrg?.id, sharedOwner, refreshKey]);
  useEffect(() => { load(); }, [load]);

  if (data.no_permission || (perms && perms.can_view_shared_content === false && !activeOrg?.is_admin)) {
    return <div className="h-full flex items-center justify-center text-muted-foreground p-6 text-center">You don't have permission to view shared content in this team.</div>;
  }

  const ownerName = sharedOwner ? members.find((m) => m.user_id === sharedOwner)?.user?.name : null;
  const showFiles = typeFilter !== "notes";
  const showNotes = typeFilter !== "files";

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-black text-2xl tracking-tighter">Shared Library</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Everything your team has marked Shared. Click any item to pin it to your own canvas.</p>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {["all", "files", "notes"].map((t) => (
          <button key={t} data-testid={`shared-filter-${t}`} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-label ${typeFilter === t ? "bg-navy text-white" : "border border-border hover:bg-secondary"}`}>{t}</button>
        ))}
        <select data-testid="shared-owner-filter" value={sharedOwner || ""} onChange={(e) => setSharedOwner(e.target.value || null)} className="text-xs border border-border bg-card px-2 py-1.5 ml-2">
          <option value="">All owners</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user?.name}</option>)}
        </select>
        {sharedOwner && <button data-testid="clear-owner-filter" onClick={() => setSharedOwner(null)} className="flex items-center gap-1 text-xs text-primary"><X className="w-3 h-3" /> {ownerName}</button>}
      </div>

      {showFiles && data.files.length > 0 && (
        <Section title="Files">
          {data.files.map((f) => (
            <ItemCard key={f.id} testid={`shared-file-${f.id}`} icon={<FileText className="w-4 h-4 text-navy" />} title={f.filename} owner={f.owner} time={f.created_at} onPin={() => pin("file", f.id, { width: 360, height: 320 })} />
          ))}
        </Section>
      )}
      {showNotes && data.notes.length > 0 && (
        <Section title="Notes">
          {data.notes.map((n) => (
            <ItemCard key={n.id} testid={`shared-note-${n.id}`} icon={<StickyNote className="w-4 h-4 text-primary" />} title={n.title} owner={n.owner} time={n.updated_at} onPin={() => pin("note", n.id)} />
          ))}
        </Section>
      )}
      {(!showFiles || data.files.length === 0) && (!showNotes || data.notes.length === 0) && (
        <p className="text-sm text-muted-foreground">No shared content matches these filters.</p>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] tracking-label uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><Globe className="w-3 h-3" /> {title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function ItemCard({ icon, title, owner, time, onPin, testid }) {
  return (
    <button data-testid={testid} onClick={onPin} className="text-left border border-border bg-card p-3 hover:border-primary transition-colors group">
      <div className="flex items-start gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Avatar user={owner} size={18} />
            <span className="text-[11px] text-muted-foreground truncate">{owner?.name} · {timeAgo(time)}</span>
          </div>
        </div>
        <Pin className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary shrink-0" />
      </div>
    </button>
  );
}
