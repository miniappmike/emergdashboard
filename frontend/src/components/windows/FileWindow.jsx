import React, { useEffect, useState } from "react";
import { useOrg } from "@/context/OrgContext";
import api from "@/lib/api";
import WindowFrame from "./WindowFrame";
import FilePreview from "@/components/FilePreview";
import { FileText } from "lucide-react";

export default function FileWindow({ item }) {
  const { activeOrg } = useOrg();
  const [file, setFile] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!activeOrg || !item.content_id) return;
    api.get(`/orgs/${activeOrg.id}/files/${item.content_id}/meta`).then(({ data }) => setFile(data)).catch(() => setErr(true));
  }, [activeOrg?.id, item.content_id]);

  return (
    <WindowFrame item={item} title={file?.filename || "File"} icon={<FileText className="w-3.5 h-3.5 text-navy" />}>
      {err ? (
        <div className="p-4 text-sm text-muted-foreground">This file is no longer available.</div>
      ) : !file ? (
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <FilePreview file={file} />
      )}
    </WindowFrame>
  );
}
