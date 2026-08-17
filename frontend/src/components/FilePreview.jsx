import React, { useEffect, useState } from "react";
import api, { fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, FileText, File as FileIcon } from "lucide-react";
import * as XLSX from "xlsx";

function fmtSize(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function FilePreview({ file }) {
  const [text, setText] = useState(null);
  const [rows, setRows] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const type = file.type || "";
  const ext = (file.ext || file.filename?.split(".").pop() || "").toLowerCase();

  const isImage = type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdf = type === "application/pdf" || ext === "pdf";
  const isAudio = type.startsWith("audio/") || ["mp3", "wav", "ogg", "aac", "flac"].includes(ext);
  const isText = type.startsWith("text/") || ["txt", "md", "json", "csv", "log"].includes(ext);
  const isSheet = ["csv", "xlsx", "xls"].includes(ext);

  useEffect(() => {
    let revoked = null;
    async function load() {
      try {
        if (isSheet) {
          const { data } = await api.get(`/files/${file.id}/download`, { responseType: "arraybuffer" });
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          setRows(XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(0, 200));
        } else if (isText) {
          const { data } = await api.get(`/files/${file.id}/download`, { responseType: "text" });
          setText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
        } else if (isPdf) {
          const { data } = await api.get(`/files/${file.id}/download`, { responseType: "blob" });
          const url = URL.createObjectURL(data);
          revoked = url;
          setBlobUrl(url);
        }
      } catch {}
    }
    load();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [file.id]);

  if (isImage) {
    return <div className="w-full h-full flex items-center justify-center bg-secondary/40 p-2"><img src={fileUrl(file.id)} alt={file.filename} className="max-w-full max-h-full object-contain" /></div>;
  }
  if (isPdf) {
    return blobUrl ? <iframe title={file.filename} src={blobUrl} className="w-full h-full border-0" /> : <Center>Loading PDF…</Center>;
  }
  if (isAudio) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
        <FileText className="w-10 h-10 text-primary" />
        <p className="text-sm font-medium text-center truncate max-w-full">{file.filename}</p>
        <audio controls src={fileUrl(file.id)} className="w-full" />
      </div>
    );
  }
  if (isSheet && rows) {
    return (
      <div className="w-full h-full overflow-auto">
        <table className="text-xs border-collapse w-full">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === 0 ? "bg-navy text-white font-bold" : "even:bg-secondary/40"}>
                {(r.length ? r : [""]).map((c, j) => (
                  <td key={j} className="border border-border px-2 py-1 whitespace-nowrap">{String(c ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (isText && text != null) {
    return <pre className="w-full h-full overflow-auto p-3 text-xs whitespace-pre-wrap font-mono">{text}</pre>;
  }

  // fallback
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <FileIcon className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-semibold truncate max-w-[200px]">{file.filename}</p>
        <p className="text-xs text-muted-foreground">{ext.toUpperCase()} · {fmtSize(file.size)}</p>
      </div>
      <a href={fileUrl(file.id)} target="_blank" rel="noreferrer" download>
        <Button size="sm" className="rounded-none bg-navy text-white"><Download className="w-3.5 h-3.5 mr-1.5" /> Download to view</Button>
      </a>
    </div>
  );
}

function Center({ children }) {
  return <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
