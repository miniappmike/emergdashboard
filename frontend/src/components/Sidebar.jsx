import React from "react";
import { useWorkspace } from "@/pages/Workspace";
import { useOrg } from "@/context/OrgContext";
import { LayoutGrid, StickyNote, Files, FolderOpen, MessageSquare, Users, UserPlus, Bell, Settings } from "lucide-react";

const ITEMS = [
  { key: "home", label: "Canvas", icon: LayoutGrid },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "files", label: "My Files", icon: Files },
  { key: "shared", label: "Shared Library", icon: FolderOpen },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "members", label: "Members", icon: Users },
];

export default function Sidebar() {
  const { view, setView } = useWorkspace();
  const { perms, activeOrg, unread } = useOrg();

  const items = [...ITEMS];
  if (perms.can_manage_join_requests || activeOrg?.is_admin) {
    items.push({ key: "requests", label: "Requests", icon: UserPlus });
  }
  items.push({ key: "notifications", label: "Notifications", icon: Bell, badge: unread });
  items.push({ key: "settings", label: "Settings", icon: Settings });

  return (
    <aside className="w-[224px] shrink-0 border-r border-border bg-card flex flex-col py-3 overflow-y-auto">
      <nav className="flex flex-col gap-0.5 px-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.key;
          return (
            <button
              key={it.key}
              data-testid={`nav-${it.key}`}
              onClick={() => setView(it.key)}
              className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors relative ${
                active ? "bg-navy text-white" : "text-foreground/80 hover:bg-secondary"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-white" : "text-muted-foreground group-hover:text-foreground"}`} strokeWidth={2} />
              <span className="flex-1 text-left">{it.label}</span>
              {it.badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              )}
              {active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-5 pt-4">
        <p className="text-[10px] tracking-label uppercase text-muted-foreground leading-relaxed">
          Canvas is personal. Hit <span className="text-primary font-bold">Refresh</span> to pull in teammates' shared content.
        </p>
      </div>
    </aside>
  );
}
