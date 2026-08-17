import React, { useState } from "react";
import { useOrg } from "@/context/OrgContext";
import { useWorkspace } from "@/pages/Workspace";
import api, { formatError } from "@/lib/api";
import { Avatar } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Link2, Shield, FolderOpen, Copy, UserPlus } from "lucide-react";

export default function MembersPanel() {
  const { activeOrg, members, perms } = useOrg();
  const { setView, setSharedOwner } = useWorkspace();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");

  const canInvite = perms.can_invite_members || activeOrg?.is_admin;

  const genLink = async () => {
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/invite-link`, { max_uses: 100 });
      setLink(`${window.location.origin}/invite/${data.token}`);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const sendEmail = async () => {
    try {
      await api.post(`/orgs/${activeOrg.id}/invite-email`, { email });
      toast.success("Member added");
      setEmail("");
      setInviteOpen(false);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const viewShared = (m) => { setSharedOwner(m.user_id); setView("shared"); };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display font-black text-2xl tracking-tighter">Members</h2>
          <p className="text-sm text-muted-foreground">{members.length} people in {activeOrg?.name}</p>
        </div>
        {canInvite && (
          <Button data-testid="invite-btn" onClick={() => { setInviteOpen(true); setLink(""); }} className="bg-primary text-primary-foreground rounded-none">
            <UserPlus className="w-4 h-4 mr-1.5" /> Invite
          </Button>
        )}
      </div>

      <div className="border border-border divide-y divide-border bg-card">
        {members.map((m) => (
          <div key={m.user_id} data-testid={`member-row-${m.user_id}`} className="flex items-center gap-3 px-4 py-3">
            <Avatar user={m.user} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{m.user?.name}</p>
                {m.is_admin && <span className="flex items-center gap-1 text-[10px] tracking-label uppercase font-bold text-primary"><Shield className="w-3 h-3" /> Owner</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {m.user?.email || "email private"}{m.user?.phone_number ? ` · ${m.user.phone_number}` : ""}
              </p>
            </div>
            <button data-testid={`view-shared-${m.user_id}`} onClick={() => viewShared(m)} className="flex items-center gap-1.5 text-xs font-bold text-navy hover:underline">
              <FolderOpen className="w-3.5 h-3.5" /> Shared content
            </button>
          </div>
        ))}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display tracking-tighter">Invite to {activeOrg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-xs tracking-label uppercase font-bold mb-2 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> By email (existing users)</p>
              <div className="flex gap-2">
                <Input data-testid="invite-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@work.com" />
                <Button data-testid="invite-email-send" onClick={sendEmail} className="bg-navy text-white rounded-none shrink-0">Add</Button>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-xs tracking-label uppercase font-bold mb-2 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Public join link</p>
              {link ? (
                <div className="flex gap-2">
                  <Input data-testid="invite-link-value" readOnly value={link} />
                  <Button data-testid="copy-link-btn" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }} className="rounded-none shrink-0"><Copy className="w-4 h-4" /></Button>
                </div>
              ) : (
                <Button data-testid="gen-link-btn" onClick={genLink} variant="outline" className="rounded-none w-full">Generate link</Button>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">People who open this link send a join request for an admin to approve.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
