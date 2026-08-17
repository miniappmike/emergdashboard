import React, { useEffect, useState } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api from "@/lib/api";
import WindowFrame from "./WindowFrame";
import { Avatar, timeAgo } from "@/lib/helpers";
import { UploadCloud, StickyNote, FileText } from "lucide-react";

export default function RecentWidget({ item }) {
  const kind = item.content_id === "notes" ? "notes" : "files"; // recent_files vs recent_notes
  const { activeOrg } = useOrg();
  const { refreshKey, pin } = useWorkspace();
  const [data, setData] = useState({ files: [], notes: [] });

  useEffect(() => {
    if (!activeOrg) return;
    api.get(`/orgs/${activeOrg.id}/shared`).then(({ data }) => setData(data)).catch(() => {});
  }, [activeOrg?.id, refreshKey]);

  const list = (kind === "notes" ? data.notes : data.files).slice(0, 12);
  const Icon = kind === "notes" ? StickyNote : FileText;

  return (
    <WindowFrame item={item} title={kind === "notes" ? "Recent Team Notes" : "Recent Team Files"} icon={<UploadCloud className="w-3.5 h-3.5 text-navy" />}>
      <div className="divide-y divide-border">
        {list.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nothing shared yet. Hit Refresh after teammates share.</p>}
        {list.map((it) => (
          <button
            key={it.id}
            data-testid={`recent-${kind}-${it.id}`}
            onClick={() => pin(kind === "notes" ? "note" : "file", it.id)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{kind === "notes" ? it.title : it.filename}</p>
              <p className="text-[10px] text-muted-foreground">{it.owner?.name} · {timeAgo(it.created_at || it.updated_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </WindowFrame>
  );
}
