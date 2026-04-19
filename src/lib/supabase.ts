export type SupabaseUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number; // epoch seconds
  user: SupabaseUser;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function mustEnv(v: string | undefined, name: string) {
  if (!v || !String(v).trim()) throw new Error(`Missing ${name} (set in .env as ${name}=...)`);
  return v;
}

function baseUrl() {
  const url = mustEnv(SUPABASE_URL, "VITE_SUPABASE_URL").replace(/\/+$/, "");
  return url;
}

function anonKey() {
  return mustEnv(SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY");
}

function authUrl(path: string) {
  return `${baseUrl()}/auth/v1${path}`;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function api<T>(url: string, opts: RequestInit & { accessToken?: string } = {}): Promise<T> {
  const headers = new Headers(opts.headers || {});
  headers.set("apikey", anonKey());
  headers.set("Content-Type", "application/json");
  if (opts.accessToken) headers.set("Authorization", `Bearer ${opts.accessToken}`);
  else headers.set("Authorization", `Bearer ${anonKey()}`);

  let res: Response;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (e: any) {
    // Typically: CORS / offline / blocked mixed content / DNS.
    throw new Error(e?.message || "Network error (failed to fetch). Check connectivity / CORS / HTTPS.");
  }
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const msg =
      (data && (data.msg || data.message || data.error_description || data.error)) ||
      (text && text.length < 180 ? text : `Request failed (${res.status})`);
    throw new Error(msg);
  }
  // Some Supabase endpoints may return an empty body on success.
  return (data ?? ({} as any)) as T;
}

export function nowEpochSec() {
  return Math.floor(Date.now() / 1000);
}

export function isSessionExpired(s: AuthSession) {
  // refresh 30s early
  return !s?.expires_at || s.expires_at <= nowEpochSec() + 30;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  return await api<AuthSession>(authUrl("/token?grant_type=password"), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signUpWithPassword(params: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
  emailRedirectTo?: string;
}): Promise<AuthSession> {
  // Supabase returns a session if email confirmations are disabled; otherwise may return user only.
  const out = await api<any>(authUrl("/signup"), {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      data: params.data || {},
      ...(params.emailRedirectTo ? { email_redirect_to: params.emailRedirectTo } : {}),
    }),
  });
  if (out?.access_token && out?.user) return out as AuthSession;
  // If confirmation is required, return a lightweight “session-like” object with user.
  return {
    access_token: "",
    refresh_token: "",
    token_type: "bearer",
    expires_in: 0,
    expires_at: 0,
    user: out.user as SupabaseUser,
  };
}

export async function getUser(accessToken: string): Promise<SupabaseUser> {
  return await api<SupabaseUser>(authUrl("/user"), { method: "GET", accessToken });
}

export async function signOut(accessToken: string): Promise<void> {
  await api(authUrl("/logout"), { method: "POST", accessToken, body: JSON.stringify({ scope: "global" }) });
}

export async function refreshSession(refresh_token: string): Promise<AuthSession> {
  return await api<AuthSession>(authUrl("/token?grant_type=refresh_token"), {
    method: "POST",
    body: JSON.stringify({ refresh_token }),
  });
}

// --- PKCE (Google sign-in) ---

function b64url(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(len = 56) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return b64url(arr);
}

async function sha256(verifier: string) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return new Uint8Array(hash);
}

export async function buildOAuthUrl(provider: "google", redirectTo: string) {
  const verifier = randomString(64);
  const challenge = b64url(await sha256(verifier));
  return {
    url:
      authUrl(`/authorize?provider=${encodeURIComponent(provider)}`) +
      `&redirect_to=${encodeURIComponent(redirectTo)}` +
      `&code_challenge=${encodeURIComponent(challenge)}` +
      `&code_challenge_method=S256`,
    codeVerifier: verifier,
  };
}

export async function exchangeCodeForSession(code: string, codeVerifier: string): Promise<AuthSession> {
  return await api<AuthSession>(authUrl("/token?grant_type=pkce"), {
    method: "POST",
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
  });
}

