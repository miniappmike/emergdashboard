import React, { useEffect, useState, useRef, useCallback } from "react";
import { useOrg } from "@/context/OrgContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/pages/Workspace";
import api, { formatError } from "@/lib/api";
import { Avatar, renderMentions, timeAgo } from "@/lib/helpers";
import { toast } from "sonner";
import { Hash, Send, Users, AtSign, Plus } from "lucide-react";

function dmChannel(a, b) { return "dm:" + [a, b].sort().join(":"); }

export default function ChatPanel() {
  const { activeOrg, members, subscribe } = useOrg();
  const { user } = useAuth();
  const { chatTarget } = useWorkspace();
  const [channel, setChannel] = useState(chatTarget?.channel || "team");
  const [channels, setChannels] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (chatTarget?.channel) setChannel(chatTarget.channel); }, [chatTarget]);

  const loadChannels = useCallback(async () => {
    if (!activeOrg) return;
    const { data } = await api.get(`/orgs/${activeOrg.id}/channels`);
    setChannels(data);
  }, [activeOrg?.id]);
  useEffect(() => { loadChannels(); }, [loadChannels]);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const { data } = await api.get(`/orgs/${activeOrg.id}/messages`, { params: { channel } });
    setMsgs(data);
  }, [activeOrg?.id, channel]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => subscribe((m) => {
    if (m.kind === "chat" && m.message.channel === channel) {
      setMsgs((p) => (p.some((x) => x.id === m.message.id) ? p : [...p, m.message]));
    }
  }), [channel, activeOrg?.id]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    const v = text.trim();
    setText("");
    setMentionOpen(false);
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/messages`, { channel, content: v });
      setMsgs((p) => (p.some((x) => x.id === data.id) ? p : [...p, data]));
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const createChannel = async () => {
    const name = prompt("New channel name (e.g. design, random)");
    if (!name) return;
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/channels`, { name });
      setChannels((p) => [...p, data]);
      setChannel(`channel:${data.id}`);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    setMentionOpen(!!v.match(/@(\w*)$/));
  };
  const pickMention = (uname) => {
    setText((t) => t.replace(/@(\w*)$/, `@${uname} `));
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const others = members.filter((m) => m.user_id !== user.id);
  let channelName = "Team-wide", ChIcon = Hash;
  if (channel.startsWith("dm:")) { channelName = members.find((m) => channel.includes(m.user_id) && m.user_id !== user.id)?.user?.name || "Direct message"; ChIcon = AtSign; }
  else if (channel.startsWith("channel:")) { channelName = "#" + (channels.find((c) => `channel:${c.id}` === channel)?.name || "channel"); ChIcon = Hash; }

  return (
    <div className="flex h-full">
      <div className="w-[240px] shrink-0 border-r border-border bg-card overflow-auto">
        <div className="p-3 border-b border-border"><h2 className="font-display font-black text-lg tracking-tighter">Chat</h2></div>
        <button data-testid="channel-team" onClick={() => setChannel("team")} className={`w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm ${channel === "team" ? "bg-navy text-white" : "hover:bg-secondary"}`}>
          <Hash className="w-4 h-4" /> <span className="font-semibold">Team-wide</span>
        </button>

        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <p className="text-[10px] tracking-label uppercase font-bold text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Channels</p>
          <button data-testid="create-channel-btn" onClick={createChannel} className="p-1 hover:bg-secondary" title="New channel"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        {channels.map((c) => {
          const ch = `channel:${c.id}`;
          return (
            <button key={c.id} data-testid={`channel-${c.id}`} onClick={() => setChannel(ch)} className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm ${channel === ch ? "bg-navy text-white" : "hover:bg-secondary"}`}>
              <Hash className="w-4 h-4" /> <span className="truncate">{c.name}</span>
            </button>
          );
        })}

        <p className="px-4 pt-4 pb-1 text-[10px] tracking-label uppercase font-bold text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Direct messages</p>
        {others.map((m) => {
          const ch = dmChannel(user.id, m.user_id);
          return (
            <button key={m.user_id} data-testid={`channel-dm-${m.user_id}`} onClick={() => setChannel(ch)} className={`w-full text-left flex items-center gap-2 px-4 py-2 text-sm ${channel === ch ? "bg-navy text-white" : "hover:bg-secondary"}`}>
              <Avatar user={m.user} size={24} /> <span className="truncate">{m.user?.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 shrink-0 border-b border-border flex items-center gap-2 px-4">
          <ChIcon className="w-4 h-4 text-primary" />
          <span className="font-bold tracking-tight">{channelName}</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3" data-testid="chat-messages">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">No messages yet. Say hello 👋</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`flex gap-2.5 ${m.is_team_mention ? "bg-primary/5 -mx-4 px-4 py-1.5" : ""} ${m.mentions?.includes(user.id) && !m.is_team_mention ? "bg-navy/5 -mx-4 px-4 py-1.5" : ""}`}>
              <Avatar user={m.sender} size={32} />
              <div className="min-w-0">
                <p className="text-xs"><span className="font-bold">{m.sender?.name}</span> <span className="text-muted-foreground ml-1">{timeAgo(m.created_at)}</span></p>
                <p className="text-sm mt-0.5 break-words">{renderMentions(m.content)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3 relative">
          {mentionOpen && (
            <div className="absolute bottom-full left-3 mb-1 w-56 bg-popover border border-border shadow-lg max-h-52 overflow-auto z-10" data-testid="mention-picker">
              <button data-testid="mention-team" onClick={() => pickMention("team")} className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-secondary text-sm font-semibold text-primary">
                <Users className="w-4 h-4" /> @team <span className="text-muted-foreground font-normal">notify everyone</span>
              </button>
              {members.map((m) => m.user?.username && (
                <button key={m.user_id} onClick={() => pickMention(m.user.username)} className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-secondary text-sm">
                  <Avatar user={m.user} size={22} /> {m.user?.name} <span className="text-muted-foreground">@{m.user.username}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              data-testid="chat-input"
              value={text}
              onChange={onChange}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message… use @ to mention"
              className="flex-1 px-3 py-2.5 bg-secondary/60 border border-border outline-none focus:border-primary text-sm"
            />
            <button data-testid="chat-send" onClick={send} className="px-4 bg-primary text-white"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
