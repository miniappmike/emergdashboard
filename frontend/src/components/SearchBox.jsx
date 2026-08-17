import React, { useState } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Search, StickyNote, FileText, MessageSquare } from "lucide-react";

export default function SearchBox() {
  const { activeOrg } = useOrg();
  const ws = useWorkspace();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);

  const run = async (val) => {
    setQ(val);
    if (!val.trim() || !activeOrg) {
      setRes(null);
      setOpen(false);
      return;
    }
    setOpen(true);
    try {
      const { data } = await api.get(`/orgs/${activeOrg.id}/search`, { params: { q: val.trim() } });
      setRes(data);
    } catch {}
  };

  const openNote = () => { ws.setView("notes"); setOpen(false); };
  const openChat = (m) => { ws.openChat(m.channel); setOpen(false); };

  const total = res ? res.notes.length + res.files.length + res.chats.length : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="global-search-input"
            value={q}
            onChange={(e) => run(e.target.value)}
            placeholder="Search notes, files, chat…"
            className="pl-9 h-9 rounded-none bg-secondary/60 border-border focus-visible:ring-primary"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="center" className="w-[min(28rem,90vw)] p-0 max-h-[70vh] overflow-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        {!res || total === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground" data-testid="search-empty">No results</div>
        ) : (
          <div className="divide-y divide-border">
            {res.notes.length > 0 && (
              <Group icon={<StickyNote className="w-3.5 h-3.5" />} label="Notes">
                {res.notes.map((n) => (
                  <Row key={n.id} testid={`search-note-${n.id}`} onClick={openNote} title={n.title} sub="Note" />
                ))}
              </Group>
            )}
            {res.files.length > 0 && (
              <Group icon={<FileText className="w-3.5 h-3.5" />} label="Files">
                {res.files.map((f) => (
                  <Row key={f.id} testid={`search-file-${f.id}`} onClick={() => { ws.pin("file", f.id); setOpen(false); }} title={f.filename} sub="File · click to pin" />
                ))}
              </Group>
            )}
            {res.chats.length > 0 && (
              <Group icon={<MessageSquare className="w-3.5 h-3.5" />} label="Chat">
                {res.chats.map((c) => (
                  <Row key={c.id} testid={`search-chat-${c.id}`} onClick={() => openChat(c)} title={c.content} sub={c.sender?.name || ""} />
                ))}
              </Group>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Group({ icon, label, children }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] tracking-label uppercase font-bold text-muted-foreground">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}
function Row({ title, sub, onClick, testid }) {
  return (
    <button data-testid={testid} onClick={onClick} className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors block">
      <p className="text-sm font-medium truncate">{title}</p>
      <p className="text-xs text-muted-foreground truncate">{sub}</p>
    </button>
  );
}
