import React from "react";
import { useWorkspace } from "@/pages/Workspace";
import NoteWindow from "./windows/NoteWindow";
import FileWindow from "./windows/FileWindow";
import ChatWidget from "./windows/ChatWidget";
import ActivityWidget from "./windows/ActivityWidget";
import RecentWidget from "./windows/RecentWidget";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Plus, MessageSquare, Activity, UploadCloud, StickyNote, LayoutGrid } from "lucide-react";

function luminance(hex) {
  if (!hex || hex[0] !== "#") return 1;
  const c = hex.substring(1);
  const rgb = c.length === 3 ? c.split("").map((x) => parseInt(x + x, 16)) : [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16));
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default function Canvas() {
  const { layout, pin, appearance } = useWorkspace();

  const bgStyle = {};
  let cls = "";
  if (appearance.background_type === "image" && appearance.background_value) {
    bgStyle.backgroundImage = `url(${appearance.background_value})`;
    bgStyle.backgroundSize = "cover";
    bgStyle.backgroundPosition = "center";
  } else {
    cls = "canvas-grid"; // keeps the dot grid visible
    if (appearance.background_type === "color" && appearance.background_value) {
      bgStyle.backgroundColor = appearance.background_value; // dots still show over it
    }
  }

  let textColor;
  if (appearance.auto_adapt_text && appearance.background_type === "color" && appearance.background_value) {
    textColor = luminance(appearance.background_value) > 0.5 ? "#0A0A0B" : "#FFFFFF";
  } else if (!appearance.auto_adapt_text) {
    textColor = appearance.text_color;
  }
  if (textColor) bgStyle.color = textColor;

  const renderItem = (item) => {
    switch (item.content_type) {
      case "note": return <NoteWindow key={item.id} item={item} />;
      case "file": return <FileWindow key={item.id} item={item} />;
      case "chat_widget": return <ChatWidget key={item.id} item={item} />;
      case "activity_widget": return <ActivityWidget key={item.id} item={item} />;
      case "recent_widget": return <RecentWidget key={item.id} item={item} />;
      default: return null;
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${cls}`} style={bgStyle} data-testid="dashboard-canvas">
      {/* Add-widget toolbar */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="add-widget-btn" className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold tracking-tight shadow hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add widget
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[10px] tracking-label uppercase text-muted-foreground">Pin to your canvas</DropdownMenuLabel>
            <DropdownMenuItem data-testid="add-chat-widget" onClick={() => pin("chat_widget", "team", { width: 300, height: 360 })}><MessageSquare className="w-4 h-4 mr-2 text-primary" /> Team Chat</DropdownMenuItem>
            <DropdownMenuItem data-testid="add-activity-widget" onClick={() => pin("activity_widget", "activity", { width: 300, height: 320 })}><Activity className="w-4 h-4 mr-2 text-primary" /> Activity Feed</DropdownMenuItem>
            <DropdownMenuItem data-testid="add-recent-files-widget" onClick={() => pin("recent_widget", "files", { width: 300, height: 300 })}><UploadCloud className="w-4 h-4 mr-2 text-navy" /> Recent Team Files</DropdownMenuItem>
            <DropdownMenuItem data-testid="add-recent-notes-widget" onClick={() => pin("recent_widget", "notes", { width: 300, height: 300 })}><StickyNote className="w-4 h-4 mr-2 text-navy" /> Recent Team Notes</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {layout.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-sm px-6">
            <div className="w-14 h-14 border-2 border-dashed border-muted-foreground/40 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-display font-black text-xl tracking-tighter">Your canvas is empty</p>
            <p className="text-sm text-muted-foreground mt-2">Add a widget above, or pin notes & files from the sidebar. This canvas is personal to you.</p>
          </div>
        </div>
      )}

      {layout.map(renderItem)}
    </div>
  );
}
