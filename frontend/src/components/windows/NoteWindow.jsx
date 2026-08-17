import React, { useEffect, useState } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api from "@/lib/api";
import WindowFrame from "./WindowFrame";
import { StickyNote, Pencil, Globe, Lock } from "lucide-react";

export default function NoteWindow({ item }) {
  const { activeOrg } = useOrg();
  const { setView, refreshKey } = useWorkspace();
  const [note, setNote] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!activeOrg || !item.content_id) return;
    api.get(`/orgs/${activeOrg.id}/notes/${item.content_id}`).then(({ data }) => setNote(data)).catch(() => setErr(true));
  }, [activeOrg?.id, item.content_id, refreshKey]);

  const title = note?.title || "Note";
  return (
    <WindowFrame item={item} title={title} icon={<StickyNote className="w-3.5 h-3.5 text-primary" />}>
      {err ? (
        <div className="p-4 text-sm text-muted-foreground">This note is no longer available.</div>
      ) : !note ? (
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {note.visibility === "shared" ? <Globe className="w-3 h-3 text-navy" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
            <span className="text-[10px] tracking-label uppercase text-muted-foreground font-bold">{note.visibility}</span>
          </div>
          <div className="note-content text-sm" dangerouslySetInnerHTML={{ __html: note.content || "<p class='text-muted-foreground'>Empty note</p>" }} />
          {note.drawing_data && (
            <img alt="drawing" src={note.drawing_data} className="mt-3 border border-border max-w-full" />
          )}
          <button data-testid="note-window-edit" onClick={() => setView("notes")} className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
            <Pencil className="w-3 h-3" /> Open in editor
          </button>
        </div>
      )}
    </WindowFrame>
  );
}
