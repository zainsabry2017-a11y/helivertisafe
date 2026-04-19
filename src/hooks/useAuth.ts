import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthSession,
  SupabaseUser,
  buildOAuthUrl,
  exchangeCodeForSession,
  getUser,
  isSessionExpired,
  refreshSession,
  signInWithPassword,
  signOut as apiSignOut,
  signUpWithPassword,
} from "../lib/supabase";

const LS_KEY = "hvs-auth-session";
const PKCE_KEY = "hvs-auth-pkce-verifier";

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function saveSession(s: AuthSession | null) {
  try {
    if (!s) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function cleanUrlCodeParam() {
  const u = new URL(window.location.href);
  if (u.searchParams.has("code") || u.searchParams.has("error") || u.searchParams.has("error_description")) {
    u.searchParams.delete("code");
    u.searchParams.delete("error");
    u.searchParams.delete("error_description");
    window.history.replaceState({}, document.title, u.toString());
  }
}

export type UseAuthApi = {
  user: SupabaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: { name: string; company: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

export function useAuth(): UseAuthApi {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [user, setUser] = useState<SupabaseUser | null>(() => (loadSession()?.user ? loadSession()!.user : null));

  const setSessionBoth = useCallback((s: AuthSession | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    saveSession(s);
  }, []);

  // Handle OAuth redirect (Google) via PKCE code exchange
  useEffect(() => {
    const u = new URL(window.location.href);
    const code = u.searchParams.get("code");
    const err = u.searchParams.get("error_description") || u.searchParams.get("error");
    if (err) {
      cleanUrlCodeParam();
      // eslint-disable-next-line no-alert
      alert(err);
      return;
    }
    if (!code) return;

    (async () => {
      setLoading(true);
      try {
        const verifier = sessionStorage.getItem(PKCE_KEY);
        if (!verifier) throw new Error("Missing PKCE verifier. Please try Google sign-in again.");
        const s = await exchangeCodeForSession(code, verifier);
        sessionStorage.removeItem(PKCE_KEY);
        setSessionBoth(s);
      } catch (e: any) {
        console.error(e);
        // eslint-disable-next-line no-alert
        alert(e?.message || "Google sign-in failed.");
      } finally {
        cleanUrlCodeParam();
        setLoading(false);
      }
    })();
  }, [setSessionBoth]);

  // Restore / refresh session on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = loadSession();
        if (!s) {
          setSessionBoth(null);
          return;
        }
        if (s.access_token && !isSessionExpired(s)) {
          // verify user is still valid
          const u = await getUser(s.access_token);
          setSessionBoth({ ...s, user: u });
          return;
        }
        if (s.refresh_token) {
          const fresh = await refreshSession(s.refresh_token);
          setSessionBoth(fresh);
          return;
        }
        setSessionBoth(null);
      } catch (e) {
        console.error(e);
        setSessionBoth(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [setSessionBoth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = await signInWithPassword(email, password);
      setSessionBoth(s);
    },
    [setSessionBoth]
  );

  const signUp = useCallback(
    async (params: { name: string; company: string; email: string; password: string }) => {
      const s = await signUpWithPassword({
        email: params.email,
        password: params.password,
        data: { name: params.name, company: params.company },
        // Ensures confirmation emails return to the currently deployed domain
        // even if Supabase "Site URL" isn't perfectly aligned across environments.
        emailRedirectTo: window.location.origin + window.location.pathname,
      });
      // If email confirmation is on, Supabase may not return access_token.
      if (s.access_token) setSessionBoth(s);
      else {
        // eslint-disable-next-line no-alert
        alert("Account created. Check your email to confirm, then sign in.");
        setSessionBoth(null);
      }
    },
    [setSessionBoth]
  );

  const signOut = useCallback(async () => {
    try {
      const s = loadSession();
      if (s?.access_token) {
        try {
          await apiSignOut(s.access_token);
        } catch (e) {
          // ignore remote signout failures
          console.warn(e);
        }
      }
      setSessionBoth(null);
    } finally {}
  }, [setSessionBoth]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = window.location.origin + window.location.pathname;
    const { url, codeVerifier } = await buildOAuthUrl("google", redirectTo);
    sessionStorage.setItem(PKCE_KEY, codeVerifier);
    window.location.assign(url);
  }, []);

  return useMemo(
    () => ({ user, loading, signIn, signUp, signOut, signInWithGoogle }),
    [user, loading, signIn, signUp, signOut, signInWithGoogle]
  );
}

