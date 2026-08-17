import React, { useEffect, useState, useRef, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api, { formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { timeAgo } from "@/lib/helpers";
import { UploadCloud, Pin, Trash2, Globe, Lock, FileText, FolderPlus, Folder, Pencil } from "lucide-react";

export default function FilesPanel() {
  const { activeOrg, perms } = useOrg();
  const { pin, refreshKey } = useWorkspace();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState("all");
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState(null);
  const [visibility, setVisibility] = useState(activeOrg?.default_visibility || "private");
  const [caption, setCaption] = useState("");
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const [{ data: fl }, { data: fd }] = await Promise.all([
      api.get(`/orgs/${activeOrg.id}/files`),
      api.get(`/orgs/${activeOrg.id}/folders`, { params: { type: "files" } }),
    ]);
    setFiles(fl);
    setFolders(fd);
  }, [activeOrg?.id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const createFolder = async () => {
    const name = prompt("Folder name");
    if (!name) return;
    const { data } = await api.post(`/orgs/${activeOrg.id}/folders`, { name, type: "files" });
    setFolders((p) => [...p, data]);
  };

  const choose = (f) => {
    if (!f) return;
    setVisibility(activeOrg?.default_visibility || "private");
    setCaption("");
    setPending(f);
  };

  const doUpload = async () => {
    const fd = new FormData();
    fd.append("file", pending);
    fd.append("visibility", visibility);
    fd.append("caption", caption);
    if (activeFolder !== "all") fd.append("folder_id", activeFolder);
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/files/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFiles((p) => [data, ...p]);
      setPending(null);
      toast.success("File uploaded");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const onDrop = (e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); };

  const toggleVis = async (f) => {
    const v = f.visibility === "shared" ? "private" : "shared";
    try {
      await api.patch(`/orgs/${activeOrg.id}/files/${f.id}/visibility`, { visibility: v });
      setFiles((p) => p.map((x) => (x.id === f.id ? { ...x, visibility: v } : x)));
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const rename = async (f) => {
    const name = prompt("Rename file", f.filename);
    if (!name || name === f.filename) return;
    try {
      await api.patch(`/orgs/${activeOrg.id}/files/${f.id}/rename`, { filename: name });
      setFiles((p) => p.map((x) => (x.id === f.id ? { ...x, filename: name } : x)));
      toast.success("File renamed");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const del = async (f) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      await api.delete(`/orgs/${activeOrg.id}/files/${f.id}`);
      setFiles((p) => p.filter((x) => x.id !== f.id));
      toast.success("File deleted");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const shown = files.filter((f) => activeFolder === "all" || f.folder_id === activeFolder);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-black text-2xl tracking-tighter">My Files</h2>
        <button data-testid="new-file-folder-btn" onClick={createFolder} className="flex items-center gap-1.5 text-sm font-bold text-navy hover:underline"><FolderPlus className="w-4 h-4" /> New folder</button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Upload files, organize into folders, choose Private or Shared, then pin them to your canvas.</p>

      {/* folder tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button data-testid="folder-tab-all" onClick={() => setActiveFolder("all")} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-label ${activeFolder === "all" ? "bg-navy text-white" : "border border-border hover:bg-secondary"}`}>All files</button>
        {folders.map((f) => (
          <button key={f.id} data-testid={`folder-tab-${f.id}`} onClick={() => setActiveFolder(f.id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold ${activeFolder === f.id ? "bg-navy text-white" : "border border-border hover:bg-secondary"}`}>
            <Folder className="w-3.5 h-3.5" /> {f.name}
          </button>
        ))}
      </div>

      <div
        data-testid="file-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${drag ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}
      >
        <UploadCloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drag & drop a file here, or click to browse{activeFolder !== "all" ? ` — into "${folders.find((f) => f.id === activeFolder)?.name}"` : ""}</p>
        <input ref={inputRef} type="file" className="hidden" data-testid="file-input" onChange={(e) => choose(e.target.files[0])} />
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((f) => (
          <div key={f.id} data-testid={`file-card-${f.id}`} className="border border-border bg-card p-3 group">
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-navy shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{f.filename}</p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(f.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3">
              <button data-testid={`file-vis-${f.id}`} onClick={() => toggleVis(f)} className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold ${f.visibility === "shared" ? "bg-primary text-white" : "bg-secondary"}`}>
                {f.visibility === "shared" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />} {f.visibility}
              </button>
              <div className="flex-1" />
              <button data-testid={`rename-file-${f.id}`} onClick={() => rename(f)} className="p-1.5 hover:text-primary" title="Rename"><Pencil className="w-4 h-4" /></button>
              <button data-testid={`pin-file-${f.id}`} onClick={() => pin("file", f.id, { width: 360, height: 320 })} className="p-1.5 hover:text-primary" title="Pin to canvas"><Pin className="w-4 h-4" /></button>
              <button data-testid={`delete-file-${f.id}`} onClick={() => del(f)} className="p-1.5 hover:text-primary"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No files here yet.</p>}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display tracking-tighter truncate">Upload {pending?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs tracking-label uppercase font-bold mb-2">Visibility</p>
              <div className="flex border border-border w-fit">
                <button data-testid="upload-vis-private" onClick={() => setVisibility("private")} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold ${visibility === "private" ? "bg-navy text-white" : "hover:bg-secondary"}`}><Lock className="w-3.5 h-3.5" /> Private</button>
                <button data-testid="upload-vis-shared" disabled={!perms.can_upload_shared_content} onClick={() => setVisibility("shared")} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold disabled:opacity-40 ${visibility === "shared" ? "bg-primary text-white" : "hover:bg-secondary"}`}><Globe className="w-3.5 h-3.5" /> Shared</button>
              </div>
              {!perms.can_upload_shared_content && <p className="text-[11px] text-muted-foreground mt-1">You don't have permission to share content.</p>}
            </div>
            <div>
              <p className="text-xs tracking-label uppercase font-bold mb-2">Caption (optional · use @username or @team)</p>
              <Input data-testid="upload-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Heads up @team, here's the deck" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button data-testid="confirm-upload" onClick={doUpload} className="bg-primary text-primary-foreground rounded-none">Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
