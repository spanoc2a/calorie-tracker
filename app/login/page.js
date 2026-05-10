"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../lib/i18n";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("athlete");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [coachCode, setCoachCode] = useState(null);
  const [coachName, setCoachName] = useState(null);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const resetParam = searchParams.get('reset');
    if (resetParam) { setResetToken(resetParam); setForgotMode('reset'); return; }
    const code = searchParams.get('coach');
    if (!code) { setMode("login"); return; }
    setCoachCode(code); setMode("signup"); setRole("athlete");
    fetch(`/api/coach/lookup?code=${code}`).then(r => r.json()).then(d => { if (d.coachName) setCoachName(d.coachName); }).catch(() => {});
  }, []);

  async function submitForgot(e) {
    e.preventDefault(); setLoading(true);
    await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
    setForgotSent(true); setLoading(false);
  }

  async function submitReset(e) {
    e.preventDefault(); setError(''); setLoading(true);
    if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); setLoading(false); return; }
    const res = await fetch('/api/auth/reset-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, password: newPassword }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || t('auth.err_expired')); setLoading(false); return; }
    setResetDone(true); setLoading(false);
  }

  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (mode === "signup" && !cguAccepted) { setError(t('auth.err_cgu')); setLoading(false); return; }
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = mode === "login" ? { email, password } : { email, password, name, role, cguAcceptedAt: new Date().toISOString() };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.err_default')); setLoading(false); return; }
      if (coachCode && data.user?.role !== 'coach') {
        const linkRes = await fetch('/api/coach/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: coachCode }) });
        if (!linkRes.ok) { const d2 = await linkRes.json().catch(() => ({})); setError(d2.error || t('auth.err_link')); setLoading(false); return; }
      }
      setLoading(false);
      const isRootDomain = typeof window !== 'undefined' && (window.location.hostname === 'nutrainer.io' || window.location.hostname === 'www.nutrainer.io');
      if (mode === 'signup') {
        localStorage.setItem('nutrainer_show_install', '1');
        if (isRootDomain) { window.location.href = 'https://app.nutrainer.io/onboarding'; return; }
        router.push('/onboarding'); router.refresh(); return;
      }
      if (isRootDomain) { window.location.href = data.user?.role === 'coach' ? 'https://app.nutrainer.io/coach' : 'https://app.nutrainer.io/'; return; }
      router.push(data.user?.role === 'coach' ? '/coach' : '/'); router.refresh();
    } catch { setError(t('auth.err_network')); setLoading(false); }
  }

  const S = { wrap: { minHeight:"100vh", background:"#0d0d0d", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", padding:16 }, card: { width:"100%", maxWidth:400 }, box: { background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:16, padding:24 }, input: { width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.8rem", outline:"none" }, btn: { width:"100%", padding:"12px", background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", cursor:"pointer" }, lbl: { fontSize:"0.6rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:6 } };

  if (forgotMode === 'reset') return (
    <div style={S.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@300;400;500&display=swap');`}</style>
      <div style={S.card}>
        <div style={{ textAlign:"center", marginBottom:32 }}><div style={{ fontFamily:"'Playfair Display',serif", fontSize:"2rem", color:"#f0e6c8" }}>Nutrainer</div></div>
        <div style={S.box}>
          {resetDone ? (
            <><div style={{ fontSize:"0.72rem", color:"#7abf8a", marginBottom:16 }}>{t('auth.reset_done')}</div>
            <button onClick={()=>{ setForgotMode(false); setResetDone(false); }} style={S.btn}>{t('auth.btn_login')}</button></>
          ) : (
            <form onSubmit={submitReset}>
              <div style={{ fontSize:"0.65rem", color:"#c8b890", letterSpacing:1, textTransform:"uppercase", marginBottom:20, textAlign:"center" }}>{t('auth.new_pwd_title')}</div>
              <div style={{ marginBottom:12 }}>
                <div style={S.lbl}>{t('auth.new_pwd_label')}</div>
                <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={6} placeholder="••••••••" style={S.input}/>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={S.lbl}>Confirmer le mot de passe</div>
                <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={6} placeholder="••••••••" style={{ ...S.input, borderColor: confirmPassword && confirmPassword !== newPassword ? '#c87070' : confirmPassword && confirmPassword === newPassword ? '#4a7a5a' : '#2a2a2a' }}/>
                {confirmPassword && confirmPassword !== newPassword && <div style={{ fontSize:"0.58rem", color:"#c87070", marginTop:4 }}>Les mots de passe ne correspondent pas</div>}
                {confirmPassword && confirmPassword === newPassword && <div style={{ fontSize:"0.58rem", color:"#7abf8a", marginTop:4 }}>Les mots de passe correspondent ✓</div>}
              </div>
              {error && <div style={{ fontSize:"0.65rem", color:"#c87070", marginBottom:12, padding:"8px 12px", background:"#1a0d0d", borderRadius:6 }}>{error}</div>}
              <button type="submit" disabled={loading || newPassword !== confirmPassword} style={{ ...S.btn, opacity:(loading || newPassword !== confirmPassword)?0.5:1, cursor:(loading || newPassword !== confirmPassword)?"not-allowed":"pointer" }}>{loading ? "..." : t('auth.save')}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@300;400;500&display=swap');`}</style>
      <div style={S.card}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"2rem", color:"#f0e6c8" }}>Nutrainer</div>
          <div style={{ fontSize:"0.6rem", color:"#4a4a3a", letterSpacing:3, textTransform:"uppercase", marginTop:6 }}>{t('auth.tagline')}</div>
        </div>

        {coachCode && (
          <div style={{ background:"#1a1a0d", border:"1px solid #4a4a1a", borderRadius:12, padding:"12px 16px", marginBottom:16, textAlign:"center" }}>
            <div style={{ fontSize:"0.6rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{t('auth.invitation')}</div>
            <div style={{ fontSize:"0.8rem", color:"#c8b890" }}>{t('auth.invited_coach')(coachName)}</div>
            <div style={{ fontSize:"0.58rem", color:"#3a3a2a", marginTop:4 }}>{t('auth.invited_sub')}</div>
          </div>
        )}

        <div style={S.box}>
          {!coachCode && (
            <div style={{ display:"flex", gap:6, marginBottom:24 }}>
              {["login","signup"].map(m => (
                <button key={m} onClick={()=>{ setMode(m); setError(""); }}
                  style={{ flex:1, padding:"8px", background:mode===m?"#c8b890":"transparent", border:`1px solid ${mode===m?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:mode===m?"#0d0d0d":"#5a5a4a", cursor:"pointer", letterSpacing:1 }}>
                  {m === "login" ? t('auth.tab_login') : t('auth.tab_signup')}
                </button>
              ))}
            </div>
          )}
          {coachCode && <div style={{ fontSize:"0.65rem", color:"#c8b890", letterSpacing:1, textTransform:"uppercase", marginBottom:20, textAlign:"center" }}>{t('auth.create_title')}</div>}

          {forgotMode === 'request' ? (
            <form onSubmit={submitForgot}>
              <div style={{ fontSize:"0.65rem", color:"#c8b890", letterSpacing:1, textTransform:"uppercase", marginBottom:20, textAlign:"center" }}>{t('auth.reset_title')}</div>
              {forgotSent ? (
                <><div style={{ fontSize:"0.72rem", color:"#7abf8a", marginBottom:16 }}>{t('auth.reset_sent')}</div>
                <button type="button" onClick={()=>{ setForgotMode(false); setForgotSent(false); }} style={{ ...S.btn, background:"transparent", color:"#c8b890", border:"1px solid #2a2a2a" }}>{t('auth.back')}</button></>
              ) : (
                <>
                  <div style={{ marginBottom:16 }}>
                    <div style={S.lbl}>{t('auth.label_email')}</div>
                    <input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} required placeholder={t('auth.ph_email')} style={S.input}/>
                  </div>
                  <button type="submit" disabled={loading} style={{ ...S.btn, opacity:loading?0.7:1, marginBottom:8 }}>{loading ? "..." : t('auth.reset_send')}</button>
                  <button type="button" onClick={()=>setForgotMode(false)} style={{ width:"100%", padding:"10px", background:"transparent", color:"#4a4a3a", border:"none", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>{t('auth.back')}</button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={submit}>
              {mode === "signup" && (
                <div style={{ marginBottom:12 }}>
                  <div style={S.lbl}>{t('auth.label_name')}</div>
                  <input value={name} onChange={e=>setName(e.target.value)} required placeholder={t('auth.ph_name')} style={S.input}/>
                </div>
              )}
              <div style={{ marginBottom:12 }}>
                <div style={S.lbl}>{t('auth.label_email')}</div>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder={t('auth.ph_email')} style={S.input}/>
              </div>
              <div style={{ marginBottom: mode === "signup" ? 12 : 20 }}>
                <div style={S.lbl}>{t('auth.label_password')}</div>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" style={S.input}/>
              </div>
              {mode === "signup" && !coachCode && (
                <div style={{ marginBottom:20 }}>
                  <div style={S.lbl}>{t('auth.label_iam')}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {[{v:"athlete",l:t('auth.role_athlete')},{v:"coach",l:t('auth.role_coach')}].map(r => (
                      <button type="button" key={r.v} onClick={()=>setRole(r.v)}
                        style={{ flex:1, padding:"8px", background:role===r.v?"#1e1a12":"transparent", border:`1px solid ${role===r.v?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:role===r.v?"#c8b890":"#5a5a4a", cursor:"pointer" }}>
                        {r.l}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", marginTop:8, textAlign:"center", lineHeight:1.5 }}>
                    {role === "athlete" ? t('auth.role_athlete_desc') : t('auth.role_coach_desc')}
                  </div>
                </div>
              )}
              {mode === "signup" && (
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:16, padding:"12px 14px", background:"#111", border:`1px solid ${cguAccepted?"#3a5a3a":"#2a2a2a"}`, borderRadius:8, cursor:"pointer" }} onClick={()=>setCguAccepted(v=>!v)}>
                  <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${cguAccepted?"#7abf8a":"#3a3a2a"}`, background:cguAccepted?"#1a3a1a":"transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {cguAccepted && <span style={{ color:"#7abf8a", fontSize:"0.7rem", lineHeight:1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:"0.6rem", color:"#6a6a5a", lineHeight:1.6 }}>
                    {t('auth.cgu_text')}{" "}
                    <a href="/cgu" target="_blank" onClick={e=>e.stopPropagation()} style={{ color:"#c8b890", textDecoration:"none" }}>{t('auth.cgu_link')}</a>
                    {" "}{t('auth.cgu_and')}{" "}
                    <a href="/privacy" target="_blank" onClick={e=>e.stopPropagation()} style={{ color:"#c8b890", textDecoration:"none" }}>{t('auth.privacy_link')}</a>
                    {t('auth.cgu_anon')}
                  </span>
                </div>
              )}
              {error && <div style={{ fontSize:"0.65rem", color:"#c87070", marginBottom:12, padding:"8px 12px", background:"#1a0d0d", borderRadius:6 }}>{error}</div>}
              <button type="submit" disabled={loading || (mode === "signup" && !cguAccepted)}
                style={{ ...S.btn, fontWeight:500, letterSpacing:1, opacity:loading?0.7:1, cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "..." : mode === "login" ? t('auth.btn_login') : t('auth.btn_signup')}
              </button>
              {mode === "login" && !coachCode && (
                <div style={{ textAlign:"center", marginTop:14 }}>
                  <button type="button" onClick={()=>{ setForgotMode('request'); setError(''); }} style={{ background:"none", border:"none", color:"#4a4a3a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", letterSpacing:1 }}>{t('auth.forgot')}</button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}
