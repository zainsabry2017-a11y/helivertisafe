import React, { useMemo, useState } from "react";

type Props = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
  onGoToSignup: () => void;
};

export function LoginPage({ onSignIn, onSignInWithGoogle, onGoToSignup }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length >= 6, [email, password]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #030810 0%, #050a12 30%, #0a1628 100%)",
        color: "#e1e7ef",
        display: "grid",
        placeItems: "center",
        padding: 18,
        fontFamily: "var(--font-sans), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(460px, 92vw)",
          background: "rgba(11,17,32,0.9)",
          border: "1px solid rgba(148,163,184,0.22)",
          borderRadius: 14,
          padding: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>Sign in</div>
          <div style={{ fontSize: 13, color: "rgba(225,231,239,0.72)", marginTop: 2 }}>
            Use your email/password or Google.
          </div>
        </div>

        {err ? (
          <div
            role="alert"
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#fecaca",
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {err}
          </div>
        ) : null}

        <label
          style={{
            display: "block",
            fontSize: 12,
            letterSpacing: 1.2,
            fontWeight: 800,
            color: "rgba(225,231,239,0.75)",
            marginTop: 8,
          }}
        >
          EMAIL
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          style={{
            width: "100%",
            marginTop: 6,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(5,10,18,0.55)",
            color: "#e1e7ef",
            outline: "none",
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: 12,
            letterSpacing: 1.2,
            fontWeight: 800,
            color: "rgba(225,231,239,0.75)",
            marginTop: 12,
          }}
        >
          PASSWORD
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{
            width: "100%",
            marginTop: 6,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(5,10,18,0.55)",
            color: "#e1e7ef",
            outline: "none",
          }}
        />

        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={async () => {
            setErr("");
            setBusy(true);
            try {
              await onSignIn(email.trim(), password);
            } catch (e: any) {
              setErr(e?.message || "Sign-in failed.");
            } finally {
              setBusy(false);
            }
          }}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "12px 12px",
            borderRadius: 12,
            border: "none",
            cursor: !canSubmit || busy ? "default" : "pointer",
            opacity: !canSubmit || busy ? 0.6 : 1,
            color: "#001018",
            fontWeight: 900,
            letterSpacing: 0.3,
            background: "linear-gradient(135deg, #06b6d4, #2563eb)",
            boxShadow: "0 12px 30px rgba(6,182,212,0.18)",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setErr("");
            try {
              await onSignInWithGoogle();
            } catch (e: any) {
              setErr(e?.message || "Google sign-in failed.");
            }
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(6,182,212,0.35)",
            cursor: busy ? "default" : "pointer",
            color: "#e1e7ef",
            fontWeight: 800,
            background: "rgba(6,182,212,0.08)",
          }}
        >
          Continue with Google
        </button>

        <div style={{ marginTop: 12, fontSize: 13, color: "rgba(225,231,239,0.72)" }}>
          Don’t have an account?{" "}
          <button
            type="button"
            onClick={onGoToSignup}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#06b6d4",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}

