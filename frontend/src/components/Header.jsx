import React, { useState, useEffect } from "react";
import { useOrg } from "@/context/OrgContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useWorkspace } from "@/pages/Workspace";
import api, { formatError } from "@/lib/api";
import { Avatar } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import ActivityDropdown from "@/components/ActivityDropdown";
import SearchBox from "@/components/SearchBox";
import { ChevronDown, RefreshCw, Moon, Sun, Bell, Plus, Check, LayoutGrid, LogOut, Settings as SettingsIcon } from "lucide-react";

export default function Header() {
  const { orgs, activeOrg, switchOrg, loadOrgs, unread, setActiveOrg } = useOrg();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const ws = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");

  const createOrg = async () => {
    if (!orgName.trim()) return;
    try {
      const { data } = await api.post("/orgs", { name: orgName.trim() });
      await loadOrgs();
      setActiveOrg(data);
      setCreating(false);
      setOrgName("");
      toast.success(`Created ${data.name}`);
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    }
  };

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card flex items-center px-4 gap-3 z-40">
      {/* Brand + Org switcher */}
      <div className="flex items-center gap-3">
        {activeOrg?.logo_url ? (
          <img data-testid="org-logo" src={`${(process.env.REACT_APP_BACKEND_URL)}${activeOrg.logo_url}`} alt="logo" className="w-9 h-9 object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 bg-primary flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="org-switcher-dropdown" className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary transition-colors max-w-[220px]">
              <div className="text-left truncate">
                <p className="font-display font-black tracking-tighter leading-none truncate">{activeOrg?.name || "Select team"}</p>
                <p className="text-[10px] tracking-label uppercase text-muted-foreground mt-0.5">{activeOrg?.is_admin ? "Owner" : "Member"}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[10px] tracking-label uppercase text-muted-foreground">Your teams</DropdownMenuLabel>
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} data-testid={`org-option-${o.id}`} onClick={() => switchOrg(o)} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{o.member_count} members</p>
                </div>
                {activeOrg?.id === o.id && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="create-org-menuitem" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create a team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="flex-1 flex justify-center px-4">
        <SearchBox />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Button data-testid="refresh-btn" variant="ghost" size="icon" onClick={ws?.refresh} title="Refresh shared content" className="rounded-none hover:bg-secondary">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button data-testid="theme-toggle" variant="ghost" size="icon" onClick={toggle} className="rounded-none hover:bg-secondary">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <button data-testid="activity-bell" className="relative p-2 hover:bg-secondary transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <ActivityDropdown />
          </PopoverContent>
        </Popover>

        <button
          data-testid="notifications-nav-btn"
          onClick={() => ws?.setView("notifications")}
          className="relative p-2 hover:bg-secondary transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" style={{ display: "none" }} />
          <span className="text-xs font-bold tracking-label uppercase px-1">Inbox</span>
          {unread > 0 && (
            <span data-testid="unread-badge" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="profile-menu-btn" className="ml-1 hover:opacity-80 transition-opacity">
              <Avatar user={user} size={34} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="profile-settings-item" onClick={() => ws?.setView("settings")}>
              <SettingsIcon className="w-4 h-4 mr-2" /> Settings & profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="logout-item" onClick={logout} className="text-primary">
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display tracking-tighter">Create a team</DialogTitle></DialogHeader>
          <Input data-testid="new-org-name" placeholder="Team name" value={orgName} onChange={(e) => setOrgName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createOrg()} />
          <DialogFooter>
            <Button data-testid="confirm-create-org" onClick={createOrg} className="bg-primary text-primary-foreground rounded-none">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
