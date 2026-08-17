import React, { useEffect, useRef, useState } from "react";
import { useOrg } from "@/context/OrgContext";
import api from "@/lib/api";
import WindowFrame from "./WindowFrame";
import { Avatar, renderMentions } from "@/lib/helpers";
import { MessageSquare, Send } from "lucide-react";

export default function ChatWidget({ item }) {
  const { activeOrg, subscribe } = useOrg();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  const load = async () => {
    if (!activeOrg) return;
    const { data } = await api.get(`/orgs/${activeOrg.id}/messages`, { params: { channel: "team" } });
    setMsgs(data);
  };

  useEffect(() => { load(); }, [activeOrg?.id]);
  useEffect(() => subscribe((m) => {
    if (m.kind === "chat" && m.message.channel === "team") setMsgs((p) => (p.some((x) => x.id === m.message.id) ? p : [...p, m.message]));
  }), [activeOrg?.id]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    const v = text.trim();
    setText("");
    const { data } = await api.post(`/orgs/${activeOrg.id}/messages`, { channel: "team", content: v });
    setMsgs((p) => (p.some((x) => x.id === data.id) ? p : [...p, data]));
  };

  return (
    <WindowFrame item={item} title="Team Chat" icon={<MessageSquare className="w-3.5 h-3.5 text-primary" />}>
      <div className="flex flex-col h-full">
        <div ref={scrollRef} className="flex-1 overflow-auto p-2.5 space-y-2.5">
          {msgs.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.is_team_mention ? "bg-primary/5 -mx-2.5 px-2.5 py-1" : ""}`}>
              <Avatar user={m.sender} size={24} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold leading-none">{m.sender?.name}</p>
                <p className="text-xs mt-0.5 break-words">{renderMentions(m.content)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-2 flex gap-1.5">
          <input
            data-testid="chat-widget-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message team… @team"
            className="flex-1 text-xs px-2 py-1.5 bg-secondary/60 border border-border outline-none focus:border-primary"
          />
          <button data-testid="chat-widget-send" onClick={send} className="p-1.5 bg-primary text-white"><Send className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </WindowFrame>
  );
}
