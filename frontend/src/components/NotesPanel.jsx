import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api, { formatError } from "@/lib/api";
import NoteEditor from "./NoteEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Search, Trash2, Pin, Globe, Lock, FolderPlus, ArrowUpDown, StickyNote } from "lucide-react";
import { timeAgo } from "@/lib/helpers";

export default function NotesPanel() {
  const { activeOrg } = useOrg();
  const { pin } = useWorkspace();
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState("updated");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const [{ data: ns }, { data: fs }] = await Promise.all([
      api.get(`/orgs/${activeOrg.id}/notes`, { params: { sort } }),
      api.get(`/orgs/${activeOrg.id}/folders`, { params: { type: "notes" } }),
    ]);
    setNotes(ns);
    setFolders(fs);
    if (!selected && ns.length) setSelected(ns[0]);
  }, [activeOrg?.id, sort]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const createNote = async () => {
    const { data } = await api.post(`/orgs/${activeOrg.id}/notes`, { title: "Untitled", content: "" });
    setNotes((p) => [data, ...p]);
    setSelected(data);
  };

  const createFolder = async () => {
    const name = prompt("Folder name");
    if (!name) return;
    const { data } = await api.post(`/orgs/${activeOrg.id}/folders`, { name, type: "notes" });
    setFolders((p) => [...p, data]);
  };

  const del = async (n, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this note?")) return;
    try {
      await api.delete(`/orgs/${activeOrg.id}/notes/${n.id}`);
      setNotes((p) => p.filter((x) => x.id !== n.id));
      if (selected?.id === n.id) setSelected(null);
      toast.success("Note deleted");
    } catch (err) { toast.error(formatError(err.response?.data?.detail)); }
  };

  const filtered = notes.filter((n) => n.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full">
      {/* list */}
      <div className="w-[320px] shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-black text-xl tracking-tighter">Notes</h2>
            <div className="flex gap-1">
              <button data-testid="new-folder-btn" onClick={createFolder} className="p-2 hover:bg-secondary" title="New folder"><FolderPlus className="w-4 h-4" /></button>
              <button data-testid="new-note-btn" onClick={createNote} className="p-2 bg-primary text-white" title="New note"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="notes-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles…" className="pl-8 h-8 rounded-none text-sm" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="notes-sort" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowUpDown className="w-3 h-3" /> {sort === "updated" ? "Recently updated" : sort === "created" ? "Date created" : "Alphabetical"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSort("updated")}>Recently updated</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("created")}>Date created</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("alpha")}>Alphabetical</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notes yet. Create one.</p>}
          {filtered.map((n) => (
            <div
              key={n.id}
              data-testid={`note-list-item-${n.id}`}
              onClick={() => setSelected(n)}
              className={`group px-4 py-3 border-b border-border cursor-pointer transition-colors ${selected?.id === n.id ? "bg-secondary" : "hover:bg-secondary/50"}`}
            >
              <div className="flex items-center gap-2">
                {n.visibility === "shared" ? <Globe className="w-3 h-3 text-primary shrink-0" /> : <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                <p className="font-semibold text-sm truncate flex-1">{n.title || "Untitled"}</p>
                <button data-testid={`pin-note-${n.id}`} onClick={(e) => { e.stopPropagation(); pin("note", n.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary" title="Pin to canvas"><Pin className="w-3.5 h-3.5" /></button>
                <button data-testid={`delete-note-${n.id}`} onClick={(e) => del(n, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.updated_at)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* editor */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            folders={folders}
            onSaved={(u) => setNotes((p) => p.map((x) => (x.id === u.id ? { ...x, ...u } : x)))}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Select or create a note</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
