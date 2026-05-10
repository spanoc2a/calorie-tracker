"use client";
import { useState, useEffect } from "react";
import { useLocale } from "../lib/i18n";

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@300;400;500&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d0d0d; color: #e8e0d0; font-family: 'DM Mono', monospace; }
.ob-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px 60px; }
.ob-card { width: 100%; max-width: 440px; }
.ob-logo { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #f0e6c8; text-align: center; margin-bottom: 4px; }
.ob-sub { font-size: 0.58rem; color: #3a3a2a; letter-spacing: 3px; text-align: center; text-transform: uppercase; margin-bottom: 32px; }
.ob-progress { display: flex; gap: 6px; margin-bottom: 28px; }
.ob-dot { flex: 1; height: 3px; border-radius: 2px; background: #2a2a2a; transition: background 0.3s; }
.ob-dot.active { background: #c8b890; }
.ob-dot.done { background: #5a5a4a; }
.ob-title { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: #f0e6c8; margin-bottom: 8px; }
.ob-desc { font-size: 0.65rem; color: #4a4a3a; line-height: 1.8; margin-bottom: 24px; }
.ob-label { font-size: 0.6rem; color: #5a5a4a; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; margin-top: 14px; }
.ob-input { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 11px 14px; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.8rem; outline: none; transition: border-color 0.2s; }
.ob-input:focus { border-color: #4a4a3a; }
.ob-toggle { display: flex; gap: 6px; }
.ob-toggle-btn { flex: 1; padding: 10px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; color: #5a5a4a; font-family: 'DM Mono', monospace; font-size: 0.65rem; cursor: pointer; transition: all 0.2s; }
.ob-toggle-btn.active { background: #1e1a12; border-color: #c8b890; color: #c8b890; }
.ob-btn { width: 100%; padding: 13px; background: #c8b890; border: none; border-radius: 10px; color: #0d0d0d; font-family: 'DM Mono', monospace; font-size: 0.75rem; font-weight: 600; cursor: pointer; letter-spacing: 1px; margin-top: 24px; transition: opacity 0.2s; }
.ob-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ob-btn-ghost { width: 100%; padding: 11px; background: transparent; border: 1px solid #2a2a2a; border-radius: 10px; color: #4a4a3a; font-family: 'DM Mono', monospace; font-size: 0.65rem; cursor: pointer; margin-top: 8px; transition: border-color 0.2s; }
.ob-btn-ghost:hover { border-color: #4a4a3a; }
.ob-mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
.ob-mode-card { padding: 16px 12px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; cursor: pointer; text-align: center; transition: all 0.2s; }
.ob-mode-card.active { background: #1e1a12; border-color: #c8b890; }
.ob-mode-card-icon { font-size: 1.5rem; margin-bottom: 8px; }
.ob-mode-card-label { font-size: 0.65rem; color: #c8b890; white-space: pre-line; line-height: 1.5; }
.ob-mode-card:not(.active) .ob-mode-card-label { color: #4a4a3a; }
.ob-mode-card-desc { font-size: 0.55rem; color: #3a3a2a; margin-top: 4px; line-height: 1.5; }
.ob-code-box { background: #1a1a12; border: 1px solid #4a4a1a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 16px; }
.ob-code-desc { font-size: 0.6rem; color: #4a4a3a; line-height: 1.7; }
.ob-link-box { background: #0d1a0d; border: 1px solid #2a4a2a; border-radius: 10px; padding: 12px 14px; font-size: 0.62rem; color: #7abf8a; word-break: break-all; margin-top: 10px; cursor: pointer; }
.ob-error { font-size: 0.62rem; color: #c87070; margin-top: 10px; text-align: center; }
.ob-check { font-size: 3rem; text-align: center; margin-bottom: 16px; }
`;

export default function Onboarding() {
  const { t } = useLocale();
  const [user, setUser]       = useState(null);
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const [sex,         setSex]         = useState("homme");
  const [birthdate,   setBirthdate]   = useState("");
  const [height,      setHeight]      = useState("");
  const [weight,      setWeight]      = useState("");
  const [mode,        setMode]        = useState("maintien");
  const [goal,        setGoal]        = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(150);
  const [carbsGoal,   setCarbsGoal]   = useState(250);
  const [fatGoal,     setFatGoal]     = useState(70);
  const [healthHistory, setHealthHistory] = useState("");
  const [coachCode,   setCoachCode]   = useState("");
  const [coachMsg,    setCoachMsg]    = useState("");

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(async d => {
      if (!d.user) { window.location.href = '/login'; return; }
      setUser(d.user);
      const s = await fetch('/api/settings').then(r=>r.json()).then(d=>d.settings||{});
      if (s.onboardingDone) { window.location.href = d.user.role === 'coach' ? '/coach' : '/'; return; }
      if (s.sex) setSex(s.sex); if (s.birthdate) setBirthdate(s.birthdate);
      if (s.height) setHeight(String(s.height)); if (s.weight) setWeight(String(s.weight));
      if (s.mode) setMode(s.mode); if (s.goalKcal) setGoal(s.goalKcal);
      if (s.goalProtein) setProteinGoal(s.goalProtein); if (s.goalCarbs) setCarbsGoal(s.goalCarbs);
      if (s.goalFat) setFatGoal(s.goalFat); if (s.healthHistory) setHealthHistory(s.healthHistory);
      if (d.user.role === 'coach') {
        const existing = await fetch('/api/coach/invite').then(r=>r.json()).catch(()=>({}));
        const valid = (existing.invites || []).find(i => !i.expired && !i.usedAt);
        if (valid) { setInviteCode(valid.token); }
        else {
          const res = await fetch('/api/coach/invite', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label: 'Premier patient' }) });
          const inv = await res.json().catch(()=>({}));
          if (inv.token) setInviteCode(inv.token);
        }
      }
      setLoading(false);
    });
  }, []);

  const isCoach = user?.role === 'coach';
  const totalSteps = isCoach ? 3 : 4;

  function calcMacros(m, kcal) {
    const r = m==="perte" ? {p:.35,g:.35,l:.30} : m==="masse" ? {p:.25,g:.50,l:.25} : {p:.25,g:.45,l:.30};
    return { p: Math.round(kcal*r.p/4), g: Math.round(kcal*r.g/4), l: Math.round(kcal*r.l/9) };
  }
  function calcGoal(m, w, h, age) {
    if (!w || !h || !age) return null;
    const bmr = Math.round(10*w + 6.25*h - 5*age + (sex==="homme" ? 5 : -161));
    const maintien = Math.round(bmr * 1.2);
    return m==="perte" ? maintien-400 : m==="masse" ? maintien+300 : maintien;
  }
  function applyMode(m) {
    setMode(m);
    const age = birthdate ? Math.floor((new Date() - new Date(birthdate)) / (365.25*24*3600*1000)) : 0;
    const kcal = calcGoal(m, Number(weight), Number(height), age);
    if (kcal) { setGoal(kcal); const mac = calcMacros(m, kcal); setProteinGoal(mac.p); setCarbsGoal(mac.g); setFatGoal(mac.l); }
  }
  async function finish() {
    setSaving(true);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sex, birthdate, height: Number(height)||null, weight: Number(weight)||null, mode, goalKcal: goal, goalProtein: proteinGoal, goalCarbs: carbsGoal, goalFat: fatGoal, healthHistory, onboardingDone: true }) });
    window.location.href = isCoach ? '/coach' : '/';
  }
  async function linkCoach() {
    if (!coachCode.trim()) { finish(); return; }
    setSaving(true);
    const res = await fetch('/api/coach/link', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code: coachCode.trim() }) });
    const data = await res.json();
    if (data.error) { setCoachMsg(data.error); setSaving(false); } else { await finish(); }
  }
  function copyInvite() {
    const link = `${window.location.origin}/login?coach=${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0d0d0d", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", color:"#3a3a2a", fontSize:"0.65rem", letterSpacing:2 }}>
      {t('onboarding.loading')}
    </div>
  );

  if (isCoach) {
    const steps = [
      <div key="0">
        <div className="ob-check">🎯</div>
        <div className="ob-title">{t('onboarding.coach_welcome')(user.name)}</div>
        <div className="ob-desc">{t('onboarding.coach_welcome_desc')}</div>
        <button className="ob-btn" onClick={()=>setStep(1)}>{t('onboarding.coach_start')}</button>
      </div>,
      <div key="1">
        <button className="ob-btn-ghost" onClick={()=>setStep(0)} style={{ marginTop:0, marginBottom:16 }}>{t('onboarding.back')}</button>
        <div className="ob-title">{t('onboarding.coach_invite_title')}</div>
        <div className="ob-desc">{t('onboarding.coach_invite_desc')}</div>
        <div className="ob-code-box">
          <div style={{ fontSize:"0.55rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>{t('onboarding.coach_invite_lbl')}</div>
          <div className="ob-link-box" onClick={copyInvite}>
            {copied ? t('onboarding.coach_copied') : inviteCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/login?coach=${inviteCode}` : t('onboarding.coach_generating')}
          </div>
          <div className="ob-code-desc">{t('onboarding.coach_invite_info')}</div>
        </div>
        <button className="ob-btn" onClick={()=>setStep(2)}>{t('onboarding.coach_next')}</button>
      </div>,
      <div key="2">
        <button className="ob-btn-ghost" onClick={()=>setStep(1)} style={{ marginTop:0, marginBottom:16 }}>{t('onboarding.back')}</button>
        <div className="ob-check">✅</div>
        <div className="ob-title">{t('onboarding.coach_ready_title')}</div>
        <div className="ob-desc" style={{ marginBottom:8 }}>{t('onboarding.coach_ready_desc')}</div>
        {t('onboarding.coach_ready_items').map((item, i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
            <span style={{ color:"#7abf8a", fontSize:"0.7rem", marginTop:1 }}>✓</span>
            <span style={{ fontSize:"0.65rem", color:"#8a8a7a", lineHeight:1.6 }}>{item}</span>
          </div>
        ))}
        <button className="ob-btn" onClick={finish} disabled={saving}>{saving ? "…" : t('onboarding.coach_dashboard')}</button>
      </div>,
    ];
    return (
      <div className="ob-wrap"><style>{STYLE}</style>
        <div className="ob-card">
          <div className="ob-logo">Nutrainer</div>
          <div className="ob-sub">{t('onboarding.sub_coach')}</div>
          <div className="ob-progress">{Array.from({length:totalSteps},(_,i)=><div key={i} className={`ob-dot${i===step?" active":i<step?" done":""}`}/>)}</div>
          {steps[step]}
        </div>
      </div>
    );
  }

  const age = birthdate ? Math.floor((new Date() - new Date(birthdate)) / (365.25*24*3600*1000)) : 0;
  const bmrVal = (Number(weight)>0 && Number(height)>0 && age>0)
    ? Math.round(10*Number(weight) + 6.25*Number(height) - 5*age + (sex==="homme" ? 5 : -161)) : null;
  const modes = t('onboarding.modes');
  const macros = t('onboarding.macros');

  const patientSteps = [
    <div key="0">
      <div className="ob-check">👋</div>
      <div className="ob-title">{t('onboarding.welcome')(user.name)}</div>
      <div className="ob-desc">{t('onboarding.welcome_desc')}</div>
      <button className="ob-btn" onClick={()=>setStep(1)}>{t('onboarding.welcome_cta')}</button>
    </div>,
    <div key="1">
      <button className="ob-btn-ghost" onClick={()=>setStep(0)} style={{ marginTop:0, marginBottom:16 }}>{t('onboarding.back')}</button>
      <div className="ob-title">{t('onboarding.profile_title')}</div>
      <div className="ob-desc">{t('onboarding.profile_desc')}</div>
      <div className="ob-label">{t('onboarding.label_sex')}</div>
      <div className="ob-toggle">
        {["homme","femme"].map(s=>(
          <button key={s} className={`ob-toggle-btn${sex===s?" active":""}`} onClick={()=>setSex(s)}>
            {s==="homme" ? t('onboarding.male') : t('onboarding.female')}
          </button>
        ))}
      </div>
      <div className="ob-label">{t('onboarding.label_dob')}</div>
      <input className="ob-input" type="date" value={birthdate} onChange={e=>setBirthdate(e.target.value)} />
      <div className="ob-label">{t('onboarding.label_height')}</div>
      <input className="ob-input" type="number" min="100" max="250" placeholder={t('onboarding.ph_height')} value={height} onChange={e=>setHeight(e.target.value)} />
      <div className="ob-label">{t('onboarding.label_weight')}</div>
      <input className="ob-input" type="number" min="30" max="300" step="0.1" placeholder={t('onboarding.ph_weight')} value={weight} onChange={e=>setWeight(e.target.value)} />
      <button className="ob-btn" onClick={()=>{ applyMode(mode); setStep(2); }}>
        {(!birthdate || !height || !weight) ? t('onboarding.next_rec') : t('onboarding.next')}
      </button>
    </div>,
    <div key="2">
      <button className="ob-btn-ghost" onClick={()=>setStep(1)} style={{ marginTop:0, marginBottom:16 }}>{t('onboarding.back')}</button>
      <div className="ob-title">{t('onboarding.goal_title')}</div>
      <div className="ob-desc">{t('onboarding.goal_desc')}</div>
      <div className="ob-mode-grid">
        {modes.map(m=>(
          <div key={m.id} className={`ob-mode-card${mode===m.id?" active":""}`} onClick={()=>applyMode(m.id)} style={m.id==="maintien"?{gridColumn:"1/-1"}:{}}>
            <div className="ob-mode-card-icon">{m.e}</div>
            <div className="ob-mode-card-label">{m.l}</div>
            <div className="ob-mode-card-desc">{m.d}</div>
          </div>
        ))}
      </div>
      {bmrVal && (
        <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"14px 16px", marginTop:12 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.6rem", color:"#c8b890" }}>{goal} <span style={{ fontSize:"0.65rem", color:"#4a4a3a" }}>{t('onboarding.kcal_day')}</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:10 }}>
            {macros.map((m,i)=>(
              <div key={m.l} style={{ background:"#0d0d0d", borderRadius:8, padding:"8px 6px", textAlign:"center" }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1rem", color:m.c }}>{[proteinGoal,carbsGoal,fatGoal][i]}<span style={{ fontSize:"0.55rem", color:"#4a4a3a" }}>g</span></div>
                <div style={{ fontSize:"0.5rem", color:"#3a3a2a", letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button className="ob-btn" onClick={()=>setStep(3)}>{t('onboarding.next')}</button>
      <button className="ob-btn-ghost" onClick={()=>setStep(3)}>{t('onboarding.skip')}</button>
    </div>,
    <div key="3">
      <button className="ob-btn-ghost" onClick={()=>setStep(2)} style={{ marginTop:0, marginBottom:16 }}>{t('onboarding.back')}</button>
      <div className="ob-title">{t('onboarding.last_title')}</div>
      <div className="ob-label">{t('onboarding.health_lbl')}</div>
      <div style={{ fontSize:"0.58rem", color:"#3a3a2a", marginBottom:8, lineHeight:1.7 }}>{t('onboarding.health_desc')}</div>
      <textarea className="ob-input" value={healthHistory} onChange={e=>setHealthHistory(e.target.value)} placeholder={t('onboarding.health_ph')} style={{ resize:"none", minHeight:80 }} />
      <div className="ob-label" style={{ marginTop:20 }}>{t('onboarding.coach_code_lbl')}</div>
      <div style={{ fontSize:"0.58rem", color:"#3a3a2a", marginBottom:8, lineHeight:1.7 }}>{t('onboarding.coach_code_desc')}</div>
      <input className="ob-input" value={coachCode} onChange={e=>setCoachCode(e.target.value.toUpperCase())} placeholder={t('onboarding.coach_code_ph')} maxLength={8} style={{ letterSpacing:3, textAlign:"center" }} />
      {coachMsg && <div className="ob-error">{coachMsg}</div>}
      <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"14px 16px", marginTop:16, marginBottom:4 }}>
        <div style={{ fontSize:"0.55rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>{t('onboarding.config_title')}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:"0.62rem", color:"#8a8a7a" }}>
          <div>{t('onboarding.config_goal')} <span style={{color:"#c8b890"}}>{goal} kcal/j</span></div>
          <div>{t('onboarding.config_protein')} <span style={{color:"#c8b890"}}>{proteinGoal}g</span></div>
          <div>{t('onboarding.config_mode')} <span style={{color:"#c8b890"}}>{mode}</span></div>
          <div>{t('onboarding.config_weight')} <span style={{color:"#c8b890"}}>{weight ? weight+"kg" : "—"}</span></div>
        </div>
      </div>
      <button className="ob-btn" onClick={linkCoach} disabled={saving}>{saving ? "…" : t('onboarding.finish')}</button>
    </div>,
  ];

  return (
    <div className="ob-wrap"><style>{STYLE}</style>
      <div className="ob-card">
        <div className="ob-logo">Nutrainer</div>
        <div className="ob-sub">{t('onboarding.sub_patient')}</div>
        <div className="ob-progress">{Array.from({length:totalSteps},(_,i)=><div key={i} className={`ob-dot${i===step?" active":i<step?" done":""}`}/>)}</div>
        {patientSteps[step]}
      </div>
    </div>
  );
}
