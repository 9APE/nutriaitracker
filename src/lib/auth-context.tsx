import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setActiveUserScope } from "@/lib/user-scoped-storage";
import {
  GUEST_USER,
  GUEST_USER_ID,
  cleanUpAbandonedGuestSession,
  endGuestSession,
  isGuestSessionActive,
  startGuestSession,
} from "@/lib/guest-mode";

// Put the device's real data back if a previous guest tab was closed without exiting.
cleanUpAbandonedGuestSession();

const GUEST_AI_MESSAGE = "AI features aren't available in the temporary preview. Create a free account to use them.";
type InvokeFn = typeof supabase.functions.invoke;
let realInvoke: InvokeFn | null = null;

/** Guests have no session, so AI calls would only 401. Fail fast with a clear message instead. */
function setAiBlocked(blocked: boolean) {
  if (blocked && !realInvoke) {
    realInvoke = supabase.functions.invoke.bind(supabase.functions);
    (supabase.functions as any).invoke = async () => ({ data: null, error: new Error(GUEST_AI_MESSAGE) });
  } else if (!blocked && realInvoke) {
    (supabase.functions as any).invoke = realInvoke;
    realInvoke = null;
  }
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True while in the temporary, local-only "Try for Free" preview. */
  isGuest: boolean;
  startGuest: () => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isGuest: false,
  startGuest: () => false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState<boolean>(() => isGuestSessionActive());

  useEffect(() => {
    // Set up listener FIRST, then read existing session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess) setGuest(false); // a real sign-in always wins over the preview
      setSession(sess);
      setUser(sess?.user ?? null);
      setActiveUserScope(sess?.user?.id ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setActiveUserScope(session?.user?.id ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isGuest = guest && !session;
  useEffect(() => {
    setAiBlocked(isGuest);
    if (isGuest) setActiveUserScope(GUEST_USER_ID);
  }, [isGuest]);

  const startGuest = () => {
    if (!startGuestSession()) return false;
    setGuest(true);
    return true;
  };

  const signOut = async () => {
    if (isGuest) {
      endGuestSession();
      setGuest(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const value: AuthCtx = {
    user: isGuest ? GUEST_USER : user,
    session,
    loading,
    isGuest,
    startGuest,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
