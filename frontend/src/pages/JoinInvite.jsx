import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import api, { formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LayoutGrid } from "lucide-react";

export default function JoinInvite() {
  const { token } = useParams();
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get(`/invite/${token}`).then(({ data }) => setInfo(data)).catch(() => setInfo(false));
  }, [token]);

  if (ready && !user) return <Navigate to="/login" replace />;

  const join = async () => {
    setJoining(true);
    try {
      const { data } = await api.post(`/invite/${token}/join`);
      if (data.pending) toast.success("Join request sent — an admin will review it.");
      else toast.success("You've joined the team!");
      nav("/");
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md border border-border bg-card p-10 text-center">
        <div className="w-12 h-12 bg-primary flex items-center justify-center mx-auto mb-6"><LayoutGrid className="w-6 h-6 text-white" /></div>
        {info === false ? (
          <p className="text-muted-foreground">This invite link is invalid or expired.</p>
        ) : info ? (
          <>
            <p className="text-xs tracking-label uppercase font-bold text-muted-foreground">You're invited to</p>
            <h1 className="font-display font-black text-3xl tracking-tighter mt-2 mb-8">{info.org_name}</h1>
            <Button data-testid="accept-invite-btn" onClick={join} disabled={joining} className="w-full bg-primary text-primary-foreground rounded-none h-11 font-bold">
              {joining ? "Joining…" : "Join team"}
            </Button>
            <button onClick={() => nav("/")} className="text-sm text-muted-foreground mt-4 hover:underline">Back to workspace</button>
          </>
        ) : (
          <p className="text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}
