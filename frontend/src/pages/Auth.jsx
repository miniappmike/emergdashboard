import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LayoutGrid, Moon, Sun, StickyNote, MessageSquare, Users } from "lucide-react";

export default function Auth() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", identifier: "", email: "", username: "", password: "" });

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.identifier, form.password);
      } else {
        await register({ name: form.name, email: form.email, username: form.username || null, password: form.password });
      }
      toast.success("Welcome!");
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-navy text-white p-14 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary flex items-center justify-center">
              <LayoutGrid className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <span className="font-display font-black text-2xl tracking-tighter">WORKBENCH</span>
          </div>
          <h1 className="font-display font-black text-5xl tracking-tighter mt-24 leading-[1.05]">
            Your team's<br />visual<br /><span className="text-primary">workspace.</span>
          </h1>
          <p className="text-white/70 mt-6 max-w-sm leading-relaxed">
            A free-form canvas for notes, files and chat. Pin what matters, share what counts, keep the rest private.
          </p>
        </div>
        <div className="relative z-10 flex gap-8 text-white/60 text-sm">
          <div className="flex items-center gap-2"><StickyNote className="w-4 h-4" /> Notes</div>
          <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Chat</div>
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Teams</div>
        </div>
        <div className="absolute -right-24 -bottom-24 w-96 h-96 border-2 border-primary/30 rotate-12" />
        <div className="absolute right-16 top-1/3 w-40 h-40 border-2 border-white/10 -rotate-6" />
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <button
          data-testid="theme-toggle-auth"
          onClick={toggle}
          className="absolute top-6 right-6 p-2 border border-border hover:border-primary transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <form onSubmit={submit} className="w-full max-w-sm" data-testid="auth-form">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary flex items-center justify-center"><LayoutGrid className="w-5 h-5 text-white" /></div>
            <span className="font-display font-black text-xl tracking-tighter">WORKBENCH</span>
          </div>
          <p className="text-xs tracking-label uppercase font-bold text-muted-foreground">{mode === "login" ? "Welcome back" : "Get started"}</p>
          <h2 className="font-display font-black text-3xl tracking-tighter mt-1 mb-8">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>

          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <Label className="text-xs tracking-label uppercase font-bold">Full name</Label>
                <Input data-testid="reg-name" value={form.name} onChange={upd("name")} required className="mt-1.5" placeholder="Olivia Brooks" />
              </div>
            )}
            {mode === "login" ? (
              <div>
                <Label className="text-xs tracking-label uppercase font-bold">Email or username</Label>
                <Input data-testid="login-identifier" value={form.identifier} onChange={upd("identifier")} required className="mt-1.5" placeholder="admin@example.com" />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs tracking-label uppercase font-bold">Email</Label>
                  <Input data-testid="reg-email" type="email" value={form.email} onChange={upd("email")} required className="mt-1.5" placeholder="you@work.com" />
                </div>
                <div>
                  <Label className="text-xs tracking-label uppercase font-bold">Username (optional)</Label>
                  <Input data-testid="reg-username" value={form.username} onChange={upd("username")} className="mt-1.5" placeholder="olivia" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs tracking-label uppercase font-bold">Password</Label>
              <Input data-testid="auth-password" type="password" value={form.password} onChange={upd("password")} required className="mt-1.5" placeholder="••••••••" />
            </div>
          </div>

          <Button data-testid="auth-submit" type="submit" disabled={loading} className="w-full mt-7 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-none h-11">
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              data-testid="auth-toggle-mode"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary font-bold hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>

          {mode === "login" && (
            <div className="mt-8 p-3 border border-border bg-secondary/50 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Demo:</span> admin@example.com / admin123 &nbsp;·&nbsp; olivia / demo123
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
