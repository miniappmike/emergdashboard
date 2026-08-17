import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api, { formatError } from "@/lib/api";
import { Avatar } from "@/lib/helpers";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Palette, Shield, User, Building2 } from "lucide-react";

const PERM_LABELS = {
  can_view_shared_content: "View shared content",
  can_upload_shared_content: "Upload shared content",
  can_manage_join_requests: "Manage join requests",
  can_delete_shared_content: "Delete shared content",
  can_invite_members: "Invite members",
  can_manage_permissions: "Manage permissions",
};

export default function SettingsPanel() {
  const { activeOrg, perms } = useOrg();
  const canManagePerms = perms.can_manage_permissions || activeOrg?.is_admin;

  return (
    <div className="h-full overflow-auto p-6 max-w-4xl">
      <h2 className="font-display font-black text-2xl tracking-tighter mb-5">Settings</h2>
      <Tabs defaultValue="profile">
        <TabsList className="rounded-none bg-secondary">
          <TabsTrigger data-testid="tab-profile" value="profile" className="rounded-none"><User className="w-4 h-4 mr-1.5" /> Profile</TabsTrigger>
          <TabsTrigger data-testid="tab-appearance" value="appearance" className="rounded-none"><Palette className="w-4 h-4 mr-1.5" /> Appearance</TabsTrigger>
          {canManagePerms && <TabsTrigger data-testid="tab-permissions" value="permissions" className="rounded-none"><Shield className="w-4 h-4 mr-1.5" /> Permissions</TabsTrigger>}
          {activeOrg?.is_admin && <TabsTrigger data-testid="tab-org" value="org" className="rounded-none"><Building2 className="w-4 h-4 mr-1.5" /> Team</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        {canManagePerms && <TabsContent value="permissions"><PermissionsTab /></TabsContent>}
        {activeOrg?.is_admin && <TabsContent value="org"><OrgTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [f, setF] = useState({ name: "", username: "", phone_number: "", email_visibility: "private", phone_visibility: "private" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });

  useEffect(() => {
    if (user) setF({ name: user.name || "", username: user.username || "", phone_number: user.phone_number || "", email_visibility: user.email_visibility || "private", phone_visibility: user.phone_visibility || "private" });
  }, [user]);

  const save = async () => {
    try { await api.put("/profile", f); await refreshUser(); toast.success("Profile updated"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const changePw = async () => {
    try { await api.put("/profile/password", pw); setPw({ current_password: "", new_password: "" }); toast.success("Password changed"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const uploadAvatar = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try { await api.post("/profile/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } }); await refreshUser(); toast.success("Avatar updated"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div className="pt-6 space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={64} />
        <label className="cursor-pointer">
          <span className="flex items-center gap-1.5 text-sm font-bold text-navy hover:underline"><Upload className="w-4 h-4" /> Change photo</span>
          <input data-testid="avatar-input" type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files[0])} />
        </label>
      </div>
      <Field label="Full name"><Input data-testid="profile-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Username (login with this or email)"><Input data-testid="profile-username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="olivia" /></Field>
      <Field label="Email"><Input value={user?.email || ""} disabled /></Field>
      <div className="flex items-center justify-between border border-border p-3">
        <div><p className="text-sm font-semibold">Share email with team</p><p className="text-xs text-muted-foreground">Teammates can see your email</p></div>
        <Switch data-testid="email-visibility-switch" checked={f.email_visibility === "shared_with_team"} onCheckedChange={(v) => setF({ ...f, email_visibility: v ? "shared_with_team" : "private" })} />
      </div>
      <Field label="Phone number"><Input data-testid="profile-phone" value={f.phone_number} onChange={(e) => setF({ ...f, phone_number: e.target.value })} placeholder="+1 555 0100" /></Field>
      <div className="flex items-center justify-between border border-border p-3">
        <div><p className="text-sm font-semibold">Share phone with team</p><p className="text-xs text-muted-foreground">Teammates can see your phone number</p></div>
        <Switch data-testid="phone-visibility-switch" checked={f.phone_visibility === "shared_with_team"} onCheckedChange={(v) => setF({ ...f, phone_visibility: v ? "shared_with_team" : "private" })} />
      </div>
      <Button data-testid="save-profile" onClick={save} className="bg-primary text-primary-foreground rounded-none">Save profile</Button>

      <div className="border-t border-border pt-6">
        <p className="font-display font-bold text-lg tracking-tight mb-3">Change password</p>
        <div className="space-y-3">
          <Field label="Current password"><Input data-testid="current-password" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
          <Field label="New password"><Input data-testid="new-password" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
          <Button data-testid="change-password-btn" onClick={changePw} variant="outline" className="rounded-none">Update password</Button>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { appearance, saveAppearance } = useWorkspace();
  return (
    <div className="pt-6 space-y-5 max-w-lg">
      <p className="text-sm text-muted-foreground">These settings only change how <span className="font-bold text-foreground">your own</span> canvas looks in this team.</p>
      <Field label="Background type">
        <div className="flex border border-border w-fit">
          <button data-testid="bg-type-color" onClick={() => saveAppearance({ background_type: "color" })} className={`px-3 py-2 text-sm font-bold ${appearance.background_type === "color" ? "bg-navy text-white" : "hover:bg-secondary"}`}>Solid color</button>
          <button data-testid="bg-type-image" onClick={() => saveAppearance({ background_type: "image" })} className={`px-3 py-2 text-sm font-bold ${appearance.background_type === "image" ? "bg-navy text-white" : "hover:bg-secondary"}`}>Image URL</button>
        </div>
      </Field>
      {appearance.background_type === "color" ? (
        <Field label="Background color">
          <input data-testid="bg-color-picker" type="color" value={appearance.background_value || "#ffffff"} onChange={(e) => saveAppearance({ background_value: e.target.value })} className="w-16 h-10 border border-border cursor-pointer" />
        </Field>
      ) : (
        <Field label="Background image URL"><Input data-testid="bg-image-url" value={appearance.background_value || ""} onChange={(e) => saveAppearance({ background_value: e.target.value })} placeholder="https://…" /></Field>
      )}
      <Field label="Window outline color">
        <input data-testid="outline-color-picker" type="color" value={appearance.window_outline_color || "#E63946"} onChange={(e) => saveAppearance({ window_outline_color: e.target.value })} className="w-16 h-10 border border-border cursor-pointer" />
      </Field>
      <Field label={`Window outline width (${appearance.window_outline_width}px)`}>
        <input data-testid="outline-width-slider" type="range" min="0" max="6" value={appearance.window_outline_width} onChange={(e) => saveAppearance({ window_outline_width: +e.target.value })} className="w-full" />
      </Field>
      <Field label="Text size">
        <div className="flex border border-border w-fit">
          {["small", "medium", "large"].map((s) => (
            <button key={s} data-testid={`text-size-${s}`} onClick={() => saveAppearance({ text_size: s })} className={`px-3 py-2 text-sm font-bold capitalize ${appearance.text_size === s ? "bg-navy text-white" : "hover:bg-secondary"}`}>{s}</button>
          ))}
        </div>
      </Field>
      <div className="flex items-center justify-between border border-border p-3">
        <div><p className="text-sm font-semibold">Auto-adapt text color</p><p className="text-xs text-muted-foreground">Pick readable light/dark text from background luminance</p></div>
        <Switch data-testid="auto-adapt-switch" checked={appearance.auto_adapt_text} onCheckedChange={(v) => saveAppearance({ auto_adapt_text: v })} />
      </div>
      {!appearance.auto_adapt_text && (
        <Field label="Text color">
          <input data-testid="text-color-picker" type="color" value={appearance.text_color || "#0A0A0B"} onChange={(e) => saveAppearance({ text_color: e.target.value })} className="w-16 h-10 border border-border cursor-pointer" />
        </Field>
      )}
    </div>
  );
}

function PermissionsTab() {
  const { activeOrg, members, loadMembers } = useOrg();
  const toggle = async (m, key, val) => {
    try {
      const { data } = await api.patch(`/orgs/${activeOrg.id}/members/${m.member_id}/permissions`, { permissions: { [key]: val } });
      loadMembers(activeOrg.id);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="pt-6">
      <p className="text-sm text-muted-foreground mb-4">Compose each member's trust individually. View & upload ship on; the rest ship off. The owner always has full access.</p>
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-white text-left">
              <th className="px-3 py-2.5 font-bold">Member</th>
              {Object.values(PERM_LABELS).map((l) => <th key={l} className="px-3 py-2.5 font-bold text-[10px] tracking-label uppercase whitespace-nowrap">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} data-testid={`perm-row-${m.user_id}`} className="border-t border-border even:bg-secondary/30">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2"><Avatar user={m.user} size={26} /><span className="font-semibold whitespace-nowrap">{m.user?.name}</span>{m.is_admin && <span className="text-[10px] text-primary font-bold uppercase">Owner</span>}</div>
                </td>
                {Object.keys(PERM_LABELS).map((key) => (
                  <td key={key} className="px-3 py-2.5 text-center">
                    <Switch
                      data-testid={`perm-${m.user_id}-${key}`}
                      disabled={m.is_admin}
                      checked={!!m.permissions[key]}
                      onCheckedChange={(v) => toggle(m, key, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrgTab() {
  const { activeOrg, loadOrgs, setActiveOrg } = useOrg();
  const [vis, setVis] = useState(activeOrg?.default_visibility || "private");
  const save = async (v) => {
    setVis(v);
    await api.patch(`/orgs/${activeOrg.id}/default-visibility`, { visibility: v });
    const orgs = await loadOrgs();
    const updated = orgs.find((o) => o.id === activeOrg.id);
    if (updated) setActiveOrg(updated);
    toast.success("Default visibility updated");
  };
  const uploadLogo = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      await api.post(`/orgs/${activeOrg.id}/logo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const orgs = await loadOrgs();
      const updated = orgs.find((o) => o.id === activeOrg.id);
      if (updated) setActiveOrg(updated);
      toast.success("Team logo updated");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="pt-6 max-w-lg space-y-6">
      <Field label="Team logo (replaces the header icon)">
        <div className="flex items-center gap-4">
          {activeOrg?.logo_url ? (
            <img src={`${process.env.REACT_APP_BACKEND_URL}${activeOrg.logo_url}`} alt="logo" className="w-14 h-14 object-cover border border-border" />
          ) : (
            <div className="w-14 h-14 bg-primary flex items-center justify-center"><Building2 className="w-6 h-6 text-white" /></div>
          )}
          <label className="cursor-pointer">
            <span className="flex items-center gap-1.5 text-sm font-bold text-navy hover:underline"><Upload className="w-4 h-4" /> Upload logo</span>
            <input data-testid="org-logo-input" type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files[0])} />
          </label>
        </div>
      </Field>
      <Field label="Default visibility for new uploads">
        <div className="flex border border-border w-fit">
          <button data-testid="org-default-private" onClick={() => save("private")} className={`px-4 py-2 text-sm font-bold ${vis === "private" ? "bg-navy text-white" : "hover:bg-secondary"}`}>Private</button>
          <button data-testid="org-default-shared" onClick={() => save("shared")} className={`px-4 py-2 text-sm font-bold ${vis === "shared" ? "bg-primary text-white" : "hover:bg-secondary"}`}>Shared</button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Members can still override this per file or note.</p>
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs tracking-label uppercase font-bold text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
