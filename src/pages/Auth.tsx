import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "signin" | "signup";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [staySignedIn, setStaySignedIn] = useState<boolean>(
    () => localStorage.getItem("nouri.staySignedIn") !== "false"
  );
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setBusy(true);
    // Persist the preference BEFORE the auth call so the next reload picks
    // the correct storage (localStorage vs sessionStorage).
    const prevPref = localStorage.getItem("nouri.staySignedIn") !== "false";
    localStorage.setItem("nouri.staySignedIn", staySignedIn ? "true" : "false");
    const prefChanged = prevPref !== staySignedIn;
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Nouri");
        if (prefChanged) {
          window.location.replace("/");
        } else {
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        if (prefChanged) {
          window.location.replace("/");
        } else {
          navigate("/");
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Something went wrong";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error("This email is already registered. Sign in instead.");
        setMode("signin");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-5 py-4 border-b border-border">
        <div className="max-w-md mx-auto flex items-center gap-2">
          
          <span className="font-serif text-lg font-medium">Nouri</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md nouri-card p-6 space-y-5">
          <div>
            <h1 className="font-serif text-2xl font-medium">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signup"
                ? "Your meals and goals stay synced across all your devices."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>

            <label className="flex items-center gap-2 mt-1 cursor-pointer select-none text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={staySignedIn}
                onChange={(e) => setStaySignedIn(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>Stay signed in on this device</span>
            </label>

            <Button type="submit" disabled={busy} className="w-full h-12 text-base mt-2">
              {busy ? (
                <Loader2 className="animate-spin" size={18} />
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to Nouri?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary font-medium hover:underline"
                >
                  Create an account
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
