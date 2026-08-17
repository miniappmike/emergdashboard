import React, { useRef, useState, useEffect, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import api from "@/lib/api";
import { toast } from "sonner";
import Whiteboard from "./Whiteboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Heading2, List, Link2, Undo2, Pencil, Globe, Lock, Check, Loader2, Image as ImageIcon } from "lucide-react";

export default function NoteEditor({ note, folders, onSaved }) {
  const { activeOrg } = useOrg();
  const editorRef = useRef(null);
  const wbRef = useRef(null);
  const [title, setTitle] = useState(note.title);
  const [visibility, setVisibility] = useState(note.visibility);
  const [folderId, setFolderId] = useState(note.folder_id || "");
  const [showWb, setShowWb] = useState(!!note.drawing_data);
  const [status, setStatus] = useState("saved"); // saved | saving
  const saveTimer = useRef(null);
  const dirty = useRef(false);

  useEffect(() => {
    setTitle(note.title);
    setVisibility(note.visibility);
    setFolderId(note.folder_id || "");
    setShowWb(!!note.drawing_data);
    if (editorRef.current) editorRef.current.innerHTML = note.content || "";
  }, [note.id]); // eslint-disable-line

  const doSave = useCallback(async (overrides = {}) => {
    setStatus("saving");
    const payload = {
      title: title || "Untitled",
      content: editorRef.current?.innerHTML || "",
      drawing_data: showWb && wbRef.current ? wbRef.current.dataUrl() : (showWb ? note.drawing_data : null),
      visibility,
      folder_id: folderId || null,
      caption: note.caption || "",
      ...overrides,
    };
    try {
      await api.put(`/orgs/${activeOrg.id}/notes/${note.id}`, payload);
      setStatus("saved");
      dirty.current = false;
      onSaved?.({ ...note, ...payload });
    } catch { setStatus("saved"); }
  }, [title, visibility, folderId, showWb, note, activeOrg]);

  const queueSave = useCallback(() => {
    dirty.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1200);
  }, [doSave]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const cmd = (c, val = null) => { document.execCommand(c, false, val); editorRef.current?.focus(); queueSave(); };
  const addLink = () => { const url = prompt("Link URL"); if (url) cmd("createLink", url); };

  const imgInputRef = useRef(null);

  const insertImage = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/note-image`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const full = `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, `<img src="${full}" style="max-width:100%" />`);
      queueSave();
    } catch { toast.error("Image upload failed"); }
  };

  const onPaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith("image/")) {
        e.preventDefault();
        insertImage(it.getAsFile());
        return;
      }
    }
  };

  const changeVisibility = async (v) => { setVisibility(v); await doSave({ visibility: v }); };

  return (
    <div className="flex flex-col h-full" data-testid="note-editor">
      {/* top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[70px]">
          {status === "saving" ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : <><Check className="w-3 h-3 text-navy" /> Saved</>}
        </div>
        <div className="flex-1" />
        <select
          data-testid="note-folder-select"
          value={folderId}
          onChange={(e) => { setFolderId(e.target.value); doSave({ folder_id: e.target.value || null }); }}
          className="text-xs border border-border bg-card px-2 py-1.5 outline-none"
        >
          <option value="">No folder</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="flex border border-border">
          <button data-testid="note-vis-private" onClick={() => changeVisibility("private")} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold ${visibility === "private" ? "bg-navy text-white" : "hover:bg-secondary"}`}>
            <Lock className="w-3 h-3" /> Private
          </button>
          <button data-testid="note-vis-shared" onClick={() => changeVisibility("shared")} className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold ${visibility === "shared" ? "bg-primary text-white" : "hover:bg-secondary"}`}>
            <Globe className="w-3 h-3" /> Shared
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <input
          data-testid="note-title-input"
          value={title}
          onChange={(e) => { setTitle(e.target.value); queueSave(); }}
          placeholder="Untitled"
          className="w-full font-display font-black text-3xl tracking-tighter bg-transparent outline-none mb-4"
        />

        {/* formatting toolbar */}
        <div className="flex items-center gap-1 mb-3 border border-border w-fit">
          <TB testid="fmt-bold" onClick={() => cmd("bold")}><Bold className="w-4 h-4" /></TB>
          <TB testid="fmt-italic" onClick={() => cmd("italic")}><Italic className="w-4 h-4" /></TB>
          <TB testid="fmt-h2" onClick={() => cmd("formatBlock", "<h2>")}><Heading2 className="w-4 h-4" /></TB>
          <TB testid="fmt-list" onClick={() => cmd("insertUnorderedList")}><List className="w-4 h-4" /></TB>
          <TB testid="fmt-link" onClick={addLink}><Link2 className="w-4 h-4" /></TB>
          <TB testid="fmt-image" onClick={() => imgInputRef.current?.click()}><ImageIcon className="w-4 h-4" /></TB>
          <TB testid="fmt-undo" onClick={() => cmd("undo")}><Undo2 className="w-4 h-4" /></TB>
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" data-testid="note-image-input" onChange={(e) => insertImage(e.target.files[0])} />

        <div
          ref={editorRef}
          data-testid="note-content-editable"
          contentEditable
          suppressContentEditableWarning
          onInput={queueSave}
          onPaste={onPaste}
          className="note-content min-h-[160px] outline-none text-base leading-relaxed border border-transparent focus:border-border p-2"
        />

        <button data-testid="toggle-whiteboard" onClick={() => setShowWb((v) => !v)} className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Pencil className="w-3.5 h-3.5" /> {showWb ? "Hide whiteboard" : "Add whiteboard"}
        </button>

        {showWb && (
          <div className="mt-3">
            <Whiteboard ref={wbRef} initial={note.drawing_data} onChange={queueSave} />
          </div>
        )}
      </div>
    </div>
  );
}

function TB({ children, onClick, testid }) {
  return <button data-testid={testid} onClick={onClick} className="p-2 hover:bg-secondary transition-colors border-r border-border last:border-r-0">{children}</button>;
}
