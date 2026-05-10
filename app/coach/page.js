"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "../lib/sanitize";

export default function CoachDashboard() {
  const router = useRouter();
  const [user, setUser]         = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [invites, setInvites] = useState([]);
  const [inviteLabel, setInviteLabel] = useState('');
  const [invitePerms, setInvitePerms] = useState({ nutrition: false, muscu: false });
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [reportHtml, setReportHtml] = useState(null);
  const [reportAthlete, setReportAthlete] = useState('');
  const [reportAthleteId, setReportAthleteId] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDays, setReportDays] = useState(30);
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const reportEditRef = useRef(null);
  const [copied, setCopied]     = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editGoals, setEditGoals] = useState({});
  const [editNote, setEditNote]   = useState('');
  const [savingId, setSavingId]   = useState(null);
  const [expandedJournal, setExpandedJournal] = useState(null);
  const [notesOpen, setNotesOpen] = useState(null);
  const [notesText, setNotesText] = useState({});
  const [notesSaving, setNotesSaving] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPermChange, setConfirmPermChange] = useState(null);
  const [togglingPermission, setTogglingPermission] = useState({});
  const [expandedAthletes, setExpandedAthletes] = useState({});
  const [programModal, setProgramModal] = useState(null);
  const [programConfig, setProgramConfig] = useState({ mealsPerDay: 4, preferences: '', avoidFoods: '', coachNotes: '' });
  const [programLoading, setProgramLoading] = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState(null);
  const [sendingProgram, setSendingProgram] = useState(false);
  const [programError, setProgramError] = useState(null);
  const [muscuModal, setMuscuModal] = useState(null);
  const [muscuProgConfig, setMuscuProgConfig] = useState({ daysPerWeek: 3, goal: 'prise de masse', level: 'intermédiaire', equipment: 'salle', preferences: '' });
  const [muscuProgLoading, setMuscuProgLoading] = useState(false);
  const [generatedMuscuProg, setGeneratedMuscuProg] = useState(null);
  const [sendingMuscuProg, setSendingMuscuProg] = useState(false);
  const [muscuProgError, setMuscuProgError] = useState(null);
  const [chatModal, setChatModal] = useState(null); // { id, name }
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState({}); // { athleteId: count }
  const [notifPermission, setNotifPermission] = useState('default');

  async function enableCoachNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: existing }) });
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
      await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: sub }) });
    } catch {}
  }

  function refreshAthletes() {
    fetch('/api/coach/athletes').then(r=>r.json()).then(d=>{ setAthletes(d.athletes||[]); setInviteCode(d.inviteCode||''); setLoading(false); }).catch(()=>setLoading(false));
  }

  useEffect(() => {
    // Enregistrer le SW et souscrire aux push si permission déjà accordée
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async reg => {
        if (!('PushManager' in window)) return;
        if (Notification.permission !== 'granted') return;
        try {
          const existing = await reg.pushManager.getSubscription();
          if (existing) {
            await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: existing }) });
            return;
          }
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
          await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: sub }) });
        } catch {}
      }).catch(() => {});
    }
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{
      if (!d.user || d.user.role !== 'coach') { router.push('/login'); return; }
      setUser(d.user);
      refreshAthletes();
    }).catch(()=>router.push('/login'));
  }, []);

  // Lire la permission notif au montage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Vérifier rapport coach non vu (app était fermée pendant génération)
  useEffect(() => {
    if (!user) return;
    fetch('/api/coach/report').then(r => r.json()).then(d => {
      if (d.report?.html) {
        setReportHtml(d.report.html);
        setReportAthlete(d.report.athleteName || '');
        setReportAthleteId(d.report.athleteId || null);
        setReportSent(false);
      }
    }).catch(() => {});
  }, [user]);

  // Écouter les messages SW (push reçue avec app ouverte)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = async (event) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return;
      const url = event.data?.data?.url || '';
      if (url.startsWith('/coach')) {
        const d = await fetch('/api/coach/report').then(r => r.json()).catch(() => ({}));
        if (d.report?.html) {
          setReportHtml(d.report.html);
          setReportAthlete(d.report.athleteName || '');
          setReportAthleteId(d.report.athleteId || null);
          setReportSent(false);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const interval = setInterval(refreshAthletes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function startEdit(a) {
    setEditingId(a.id);
    setEditGoals({ goalKcal: a.goalKcal, goalProtein: a.goalProtein, goalCarbs: a.goalCarbs || 0, goalFat: a.goalFat || 0 });
    setEditNote('');
  }

  async function saveGoals(athleteId) {
    setSavingId(athleteId);
    await fetch('/api/coach/athlete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, ...editGoals, note: editNote || null }),
    });
    const d = await fetch('/api/coach/athletes').then(r => r.json());
    setAthletes(d.athletes || []);
    setEditingId(null); setSavingId(null);
  }

  async function deleteAthlete(athleteId) {
    await fetch('/api/coach/athletes', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId }) });
    setAthletes(prev => prev.filter(a => a.id !== athleteId));
    setConfirmDelete(null);
  }

  async function togglePermission(athleteId, key, value) {
    const k = `${athleteId}:${key}`;
    setTogglingPermission(prev => ({ ...prev, [k]: true }));
    await fetch('/api/coach/athlete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, [key]: value }),
    });
    setAthletes(prev => prev.map(a => a.id === athleteId ? { ...a, [key]: value } : a));
    setTogglingPermission(prev => { const n = { ...prev }; delete n[k]; return n; });
  }

  function exportPDF(html, name, days) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${name}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1a1a1a;line-height:1.7}h2{margin-top:24px;color:#2a1a00}@media print{body{margin:20px}}</style></head><body><h1>Rapport nutritionnel — ${name}</h1><p style="color:#8a7a5a;font-size:0.85rem">${days}j · ${new Date().toLocaleDateString('fr-FR')}</p>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  function buildEmptyNutritionProgram(mealsPerDay) {
    const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const MT = mealsPerDay === 3 ? ['Petit-déjeuner','Déjeuner','Dîner'] : mealsPerDay === 4 ? ['Petit-déjeuner','Déjeuner','Collation','Dîner'] : ['Petit-déjeuner','Collation matin','Déjeuner','Collation après-midi','Dîner'];
    return { id:Date.now(), generatedAt:new Date().toISOString(), mealsPerDay, preferences:'', avoidFoods:'', weeklyNotes:'', status:'draft', sentAt:null,
      days: DAYS.map(day=>({ day, meals: MT.map(type=>({ type, items:[], totalKcal:0, totalProtein:0, totalCarbs:0, totalFat:0, note:'' })) })) };
  }

  function buildEmptyMuscuProgram({ daysPerWeek=3, goal='prise de masse', level='intermédiaire', equipment='salle', preferences='' }) {
    const DAYS_MAP = { 2:['Lundi','Jeudi'], 3:['Lundi','Mercredi','Vendredi'], 4:['Lundi','Mardi','Jeudi','Vendredi'], 5:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], 6:['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'] };
    const trainingDays = DAYS_MAP[daysPerWeek] || DAYS_MAP[3];
    return { id:Date.now(), generatedAt:new Date().toISOString(), daysPerWeek, goal, level, equipment, preferences, weeklyNotes:'', status:'draft', sentAt:null,
      days: trainingDays.map(day=>({ day, label:'', exercises:[] })) };
  }

  function openProgramModal(a) {
    setProgramModal(a);
    setProgramConfig({ mealsPerDay: 4, preferences: '', avoidFoods: '', coachNotes: '' });
    setGeneratedProgram(null);
    setProgramError(null);
  }

  function openMuscuModal(a) {
    setMuscuModal(a);
    setMuscuProgConfig({ daysPerWeek: 3, goal: 'prise de masse', level: 'intermédiaire', equipment: 'salle', preferences: '' });
    setGeneratedMuscuProg(null);
    setMuscuProgError(null);
  }

  async function generateProgram() {
    setProgramLoading(true); setGeneratedProgram(null); setProgramError(null);
    try {
      const res = await fetch('/api/coach/program', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId: programModal.id, ...programConfig }),
      });
      const data = await res.json();
      if (data.program) {
        setGeneratedProgram(data.program);
      } else {
        setProgramError(data.error || 'Erreur lors de la génération. Réessaie.');
      }
    } catch {
      setProgramError('Erreur réseau. Vérifie ta connexion et réessaie.');
    }
    setProgramLoading(false);
  }

  async function sendProgram() {
    if (!generatedProgram) return;
    setSendingProgram(true);
    await fetch('/api/coach/program', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId: programModal.id, programId: generatedProgram.id }),
    });
    setSendingProgram(false);
    setProgramModal(null); setGeneratedProgram(null);
  }

  async function generateCoachMuscuProgram() {
    setMuscuProgLoading(true); setGeneratedMuscuProg(null); setMuscuProgError(null);
    try {
      const res = await fetch('/api/coach/muscu-program', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId: muscuModal.id, ...muscuProgConfig }),
      });
      const data = await res.json();
      if (data.program) setGeneratedMuscuProg(data.program);
      else setMuscuProgError(data.error || 'Erreur lors de la génération. Réessaie.');
    } catch { setMuscuProgError('Erreur réseau. Réessaie.'); }
    setMuscuProgLoading(false);
  }

  async function sendMuscuProgram() {
    if (!generatedMuscuProg) return;
    setSendingMuscuProg(true);
    await fetch('/api/coach/muscu-program', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId: muscuModal.id, programId: generatedMuscuProg.id }),
    });
    setSendingMuscuProg(false);
    setMuscuModal(null); setGeneratedMuscuProg(null);
  }

  async function openChat(a) {
    setChatModal(a);
    setChatMessages([]);
    const d = await fetch(`/api/chat?athleteId=${a.id}`).then(r=>r.json());
    setChatMessages(d.messages||[]);
    setChatUnread(prev => ({ ...prev, [a.id]: 0 }));
  }

  useEffect(() => {
    if (!athletes.length) return;
    const poll = async () => {
      for (const a of athletes) {
        if (chatModal?.id === a.id) continue;
        const d = await fetch(`/api/chat?athleteId=${a.id}`).then(r=>r.json()).catch(()=>({ unreadCount:0 }));
        if ((d.unreadCount||0) > 0) setChatUnread(prev => ({ ...prev, [a.id]: d.unreadCount }));
      }
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [athletes, chatModal]);

  useEffect(() => {
    if (!chatModal) return;
    const poll = () => fetch(`/api/chat?athleteId=${chatModal.id}`).then(r=>r.json()).then(d=>setChatMessages(d.messages||[])).catch(()=>{});
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [chatModal]);

  async function sendChatMessage() {
    if (!chatInput.trim() || chatSending || !chatModal) return;
    setChatSending(true);
    const text = chatInput.trim();
    setChatInput('');
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text, athleteId: chatModal.id }) });
    const data = await res.json();
    if (data.message) setChatMessages(prev => [...prev, data.message]);
    setChatSending(false);
  }

  async function generateReport(athleteId, name) {
    setReportAthlete(name); setReportAthleteId(athleteId); setReportLoading(true); setReportHtml(null); setReportSent(false);
    const res = await fetch('/api/coach/report', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId, days: reportDays }) });
    const data = await res.json();
    setReportHtml(data.html || '<p>Erreur</p>');
    setReportLoading(false);
    fetch('/api/report-request', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId }) });
    setAthletes(prev => prev.map(a => a.id === athleteId ? { ...a, reportRequest: null } : a));
  }

  async function sendReportToPatient() {
    if (!reportAthleteId || reportSending) return;
    const html = reportEditRef.current ? reportEditRef.current.innerHTML : reportHtml;
    setReportSending(true);
    await fetch('/api/coach/report', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId: reportAthleteId, html }),
    });
    setReportSending(false);
    setReportSent(true);
  }

  async function generateInvite() {
    if (!invitePerms.nutrition && !invitePerms.muscu) return;
    setGeneratingInvite(true);
    const res = await fetch('/api/coach/invite', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label: inviteLabel, selfNutritionAllowed: invitePerms.nutrition, selfMuscuAllowed: invitePerms.muscu }) });
    const data = await res.json();
    if (data.invite) {
      setInvites(prev => [{ ...data.invite, expired: false }, ...prev]);
      setInviteLabel('');
      const link = `${window.location.origin}/login?coach=${data.token}`;
      navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(()=>setCopied(false), 3000);
    }
    setGeneratingInvite(false);
  }

  async function revokeInvite(token) {
    await fetch('/api/coach/invite', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
    setInvites(prev => prev.filter(i => i.token !== token));
  }

  function copyInviteLink(token) {
    const link = `${window.location.origin}/login?coach=${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token); setTimeout(()=>setCopied(false), 2000);
  }

  function loadInvites() {
    fetch('/api/coach/invite').then(r=>r.json()).then(d => setInvites(d.invites || []));
  }

  function copyCode() {
    const link = `${window.location.origin}/login?coach=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }

  if (!user) return (
    <div style={{ minHeight:"100vh", background:"#0d0d0d", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", color:"#4a4a3a", fontSize:"0.7rem", letterSpacing:2 }}>
      CHARGEMENT…
    </div>
  );

  const FONT = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@300;400;500&display=swap');`;

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d0d", fontFamily:"'DM Mono',monospace", padding:"0 0 40px" }}>
      <style>{FONT}</style>

      {/* Header */}
      <div style={{ background:"#1a1a1a", borderBottom:"1px solid #2a2a2a", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", color:"#f0e6c8" }}>Espace Coach</div>
          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginTop:2 }}>{user.name}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={refreshAthletes} style={{ background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 10px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer" }}>↻</button>
          <button onClick={async()=>{ await fetch('/api/auth/logout',{method:'POST'}); router.push('/login'); }} style={{ background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 12px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>Déconnexion</button>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:"0 auto", padding:"20px 16px" }}>

        {/* Bannière notifications */}
        {notifPermission === 'default' && (
          <div style={{ background:"#1a1a12", border:"1px solid #3a3520", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div>
              <div style={{ fontSize:"0.65rem", color:"#c8b890" }}>🔔 Activer les notifications</div>
              <div style={{ fontSize:"0.54rem", color:"#5a5a3a", marginTop:3 }}>Messages patients, demandes de bilan, programmes</div>
            </div>
            <button onClick={enableCoachNotifications}
              style={{ background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, padding:"7px 14px", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", fontWeight:500, cursor:"pointer", whiteSpace:"nowrap" }}>
              Activer
            </button>
          </div>
        )}
        {notifPermission === 'granted' && (
          <div style={{ fontSize:"0.52rem", color:"#3a7a3a", textAlign:"center", marginBottom:12, letterSpacing:1 }}>🔔 Notifications actives</div>
        )}

        {/* Liens d'invitation dynamiques */}
        <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>Inviter un patient</div>
          <div style={{ fontSize:"0.52rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Accès de l'élève</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
            {[
              { v:'nutrition', icon:'🥗', label:'Nutrition' },
              { v:'muscu',     icon:'💪', label:'Muscu' },
            ].map(({v, icon, label})=>{
              const on = invitePerms[v];
              return (
                <div key={v} onClick={()=>setInvitePerms(p=>({...p,[v]:!p[v]}))}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"10px 12px", background:on?"#141a14":"#0d0d0d", border:`1px solid ${on?"#2a4a2a":"#1e1e1e"}`, borderRadius:9, cursor:"pointer", transition:"all 0.2s" }}>
                  <div style={{ fontSize:"0.68rem", color: on?"#c8b890":"#5a5a4a" }}>{icon} {label}</div>
                  <div style={{ flexShrink:0, width:36, height:20, background: on?"#2a4a2a":"#1a1a1a", border:`1px solid ${on?"#4a8a4a":"#2a2a2a"}`, borderRadius:10, position:"relative", transition:"all 0.2s" }}>
                    <div style={{ position:"absolute", top:2, left: on?16:2, width:14, height:14, background: on?"#7abf8a":"#3a3a3a", borderRadius:"50%", transition:"all 0.2s" }}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input value={inviteLabel} onChange={e=>setInviteLabel(e.target.value)} placeholder="Nom du patient (optionnel)"
              style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", outline:"none" }}/>
            <button onClick={generateInvite} disabled={generatingInvite}
              style={{ padding:"9px 14px", background:"#1e1a12", border:"1px solid #c8b890", borderRadius:8, color: copied===true?"#7abf8a":"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.2s" }}>
              {generatingInvite ? "…" : copied===true ? "✓ Copié" : "🔗 Générer"}
            </button>
          </div>
          <div style={{ fontSize:"0.55rem", color:"#3a3a2a", lineHeight:1.6, marginBottom:invites.length>0||invitesOpen?10:0 }}>
            Chaque lien est à usage unique · expire dans 7 jours · copié automatiquement
          </div>

          {/* Liste des invitations */}
          <button onClick={()=>{ if(!invitesOpen){ loadInvites(); } setInvitesOpen(o=>!o); }}
            style={{ background:"none", border:"none", color:"#4a4a3a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", padding:0, letterSpacing:1 }}>
            {invitesOpen ? "▲ Masquer l'historique" : "▼ Voir l'historique des liens"}
          </button>
          {invitesOpen && (
            <div style={{ marginTop:10 }}>
              {invites.length === 0 && <div style={{ fontSize:"0.62rem", color:"#3a3a2a" }}>Aucun lien généré.</div>}
              {invites.map(inv => {
                const used = !!inv.usedAt;
                const expired = inv.expired || new Date(inv.expiresAt) < new Date();
                const statusColor = used ? "#5a7a5a" : expired ? "#5a3a2a" : "#c8b890";
                const statusLabel = used ? "Utilisé" : expired ? "Expiré" : "Actif";
                return (
                  <div key={inv.token} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid #1e1e1e" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"0.65rem", color:"#8a8070", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {inv.label || 'Sans nom'} · <span style={{ color: statusColor }}>{statusLabel}</span>
                        {inv.selfNutritionAllowed && !inv.selfMuscuAllowed && <span style={{ marginLeft:8, color:"#5a8a5a" }}>🥗</span>}
                        {inv.selfMuscuAllowed && !inv.selfNutritionAllowed && <span style={{ marginLeft:8, color:"#5a5a8a" }}>💪</span>}
                      </div>
                      <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:1 }}>
                        {new Date(inv.createdAt).toLocaleDateString('fr-FR')} → exp. {new Date(inv.expiresAt).toLocaleDateString('fr-FR')}
                        {used && inv.usedAt && ` · utilisé le ${new Date(inv.usedAt).toLocaleDateString('fr-FR')}`}
                      </div>
                    </div>
                    {!used && !expired && (
                      <button onClick={()=>copyInviteLink(inv.token)}
                        style={{ background:"#1e1a12", border:"1px solid #3a3520", borderRadius:6, padding:"4px 8px", color: copied===inv.token?"#7abf8a":"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.58rem", cursor:"pointer" }}>
                        {copied===inv.token ? "✓" : "📋"}
                      </button>
                    )}
                    {!used && (
                      <button onClick={()=>revokeInvite(inv.token)}
                        style={{ background:"none", border:"none", color:"#3a2a2a", fontSize:"0.8rem", cursor:"pointer", padding:"2px 4px" }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Période rapport */}
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", alignSelf:"center", marginRight:4 }}>Rapport</div>
          {[7,30,90].map(d=>(
            <button key={d} onClick={()=>setReportDays(d)}
              style={{ flex:1, padding:"6px", background:reportDays===d?"#1e1a12":"#0d0d0d", border:`1px solid ${reportDays===d?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", color:reportDays===d?"#c8b890":"#5a5a4a", cursor:"pointer", transition:"all 0.2s" }}>
              {d}j
            </button>
          ))}
        </div>

        {/* ─── À surveiller ─── */}
        {!loading && athletes.length > 0 && (() => {
          const flags = athletes.flatMap(a => {
            const items = [];
            if (a.activeDays7j === 0) items.push({ name: a.name, id: a.id, msg: 'Aucune saisie depuis 7 jours', level: 'bad' });
            else if (a.activeDays7j <= 2) items.push({ name: a.name, id: a.id, msg: `Seulement ${a.activeDays7j}/7 jours loggés`, level: 'warn' });
            if (a.alert) items.push({ name: a.name, id: a.id, msg: a.alert, level: 'warn' });
            if (a.blood?.abnormal?.length > 0) items.push({ name: a.name, id: a.id, msg: `${a.blood.abnormal.length} marqueur${a.blood.abnormal.length>1?'s':''} anormal${a.blood.abnormal.length>1?'s':''}`, level: 'warn' });
            if (a.reportRequest) items.push({ name: a.name, id: a.id, msg: 'Demande de rapport en attente', level: 'info' });
            if (a.pendingBlood) items.push({ name: a.name, id: a.id, msg: 'Bilan sanguin à analyser', level: 'info' });
            return items;
          });
          if (flags.length === 0) return null;
          return (
            <div style={{ background:"#1a1a1a", border:"1px solid #3a2a1a", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
              <div style={{ fontSize:"0.55rem", color:"#c8a060", letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>⚠ À surveiller — {flags.length} alerte{flags.length>1?'s':''}</div>
              {flags.map((f, i) => (
                <div key={i} onClick={()=>setExpandedAthletes(prev=>({ ...prev, [f.id]: true }))}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom: i<flags.length-1?"1px solid #242424":"none", cursor:"pointer" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background: f.level==='bad'?"#c87070":f.level==='warn'?"#c8a060":"#5a8acf", flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontSize:"0.65rem", color:"#e8e0d0" }}>{f.name}</span>
                    <span style={{ fontSize:"0.6rem", color:"#5a5a4a", marginLeft:8 }}>{f.msg}</span>
                  </div>
                  <span style={{ fontSize:"0.55rem", color:"#3a3a2a" }}>→</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Liste athlètes */}
        {loading ? (
          <div style={{ textAlign:"center", color:"#4a4a3a", fontSize:"0.65rem", padding:40 }}>Chargement…</div>
        ) : athletes.length === 0 ? (
          <div style={{ textAlign:"center", color:"#3a3a2a", fontSize:"0.65rem", padding:40, lineHeight:2 }}>
            Aucun patient lié.<br/>Partage ton code d'invitation.
          </div>
        ) : athletes.map(a => {
          const kcalPct = a.goalKcal > 0 ? Math.min(100, Math.round(a.todayKcal / a.goalKcal * 100)) : 0;
          const avg7Pct = a.goalKcal > 0 ? Math.round(a.avgKcal7j / a.goalKcal * 100) : 0;
          const protPct = a.goalProtein > 0 ? Math.min(100, Math.round(a.avgProtein7j / a.goalProtein * 100)) : 0;
          const isOpen = !!expandedAthletes[a.id];
          return (
            <div key={a.id} style={{ background:"#1a1a1a", border:`1px solid ${a.alert?"#6a3a2a":"#2a2a2a"}`, borderRadius:14, marginBottom:12 }}>

              {/* ── En-tête cliquable ── */}
              <div onClick={() => setExpandedAthletes(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                style={{ padding:"16px 18px", cursor:"pointer", userSelect:"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:10 }}>
                  {/* Gauche : nom + email */}
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:"0.85rem", color:"#e8e0d0", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
                    <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.email}</div>
                    {a.alert && (
                      <div style={{ display:"inline-block", fontSize:"0.5rem", color:"#c87070", background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:5, padding:"2px 6px", marginTop:4 }}>
                        ⚠ {a.alert}
                      </div>
                    )}
                  </div>
                  {/* Droite : 3 stats compactes + chevron */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"center", minWidth:28 }}>
                      <div style={{ fontSize:"0.68rem", color: kcalPct>90?"#7abf8a":kcalPct>60?"#c8a060":"#c87070", fontWeight:500, lineHeight:1 }}>{kcalPct}%</div>
                      <div style={{ fontSize:"0.44rem", color:"#3a3a2a", letterSpacing:0.5, marginTop:2 }}>AUJD</div>
                    </div>
                    <div style={{ textAlign:"center", minWidth:28 }}>
                      <div style={{ fontSize:"0.68rem", color: avg7Pct>85&&avg7Pct<115?"#7abf8a":"#c8a060", fontWeight:500, lineHeight:1 }}>{avg7Pct}%</div>
                      <div style={{ fontSize:"0.44rem", color:"#3a3a2a", letterSpacing:0.5, marginTop:2 }}>7J</div>
                    </div>
                    <div style={{ textAlign:"center", minWidth:24 }}>
                      <div style={{ fontSize:"0.68rem", color: a.activeDays7j>=5?"#7abf8a":a.activeDays7j>=3?"#c8a060":"#c87070", fontWeight:500, lineHeight:1 }}>{a.activeDays7j}/7</div>
                      <div style={{ fontSize:"0.44rem", color:"#3a3a2a", letterSpacing:0.5, marginTop:2 }}>ACT</div>
                    </div>
                    {chatUnread[a.id] > 0 && (
                      <div style={{ background:"#c87070", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:"0.48rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", flexShrink:0 }}>{chatUnread[a.id]}</div>
                    )}
                    <div style={{ fontSize:"0.65rem", color:"#4a4a3a", transition:"transform 0.25s", transform: isOpen?"rotate(180deg)":"rotate(0deg)", flexShrink:0 }}>▼</div>
                  </div>
                </div>
                {/* Barre progression aujourd'hui */}
                <div style={{ height:3, background:"#222", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${kcalPct}%`, background: kcalPct>100?"#c87070":kcalPct>70?"#7abf8a":"#c8a060", borderRadius:2, transition:"width 0.3s" }}/>
                </div>
              </div>

              {/* ── Corps dépliable ── */}
              {isOpen && (
                <div style={{ padding:"0 16px 20px", borderTop:"1px solid #242424" }}>

                  {/* Stats 7j */}
                  <div style={{ display:"flex", gap:8, marginTop:16, marginBottom:16 }}>
                    <div style={{ flex:1, minWidth:0, background:"#111", borderRadius:10, padding:"12px 10px" }}>
                      <div style={{ fontSize:"0.48rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Moy kcal 7j</div>
                      <div style={{ fontSize:"0.95rem", color: avg7Pct>85&&avg7Pct<115?"#7abf8a":"#c8a060", fontWeight:500 }}>{a.avgKcal7j}</div>
                      <div style={{ fontSize:"0.48rem", color:"#3a3a2a", marginTop:2 }}>obj. {a.goalKcal}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0, background:"#111", borderRadius:10, padding:"12px 10px" }}>
                      <div style={{ fontSize:"0.48rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Protéines moy</div>
                      <div style={{ fontSize:"0.95rem", color: protPct>85?"#7abf8a":"#c87070", fontWeight:500 }}>{a.avgProtein7j}g</div>
                      <div style={{ fontSize:"0.48rem", color:"#3a3a2a", marginTop:2 }}>obj. {a.goalProtein}g</div>
                    </div>
                    <div style={{ flex:1, minWidth:0, background:"#111", borderRadius:10, padding:"12px 10px" }}>
                      <div style={{ fontSize:"0.48rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Jours actifs</div>
                      <div style={{ fontSize:"0.95rem", color:"#c8b890", fontWeight:500 }}>{a.activeDays7j}<span style={{ fontSize:"0.6rem", color:"#3a3a2a" }}>/7</span></div>
                      <div style={{ fontSize:"0.48rem", color:"#3a3a2a", marginTop:2 }}>7 derniers jours</div>
                    </div>
                  </div>

                  {/* Poids */}
                  {a.lastWeight && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, background:"#111", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
                      <span style={{ fontSize:"0.65rem", color:"#4a4a3a" }}>⚖</span>
                      <span style={{ fontSize:"0.8rem", color:"#e8e0d0" }}>{a.lastWeight} kg</span>
                      {a.weightTrend !== null && (
                        <span style={{ fontSize:"0.65rem", color: a.weightTrend < 0?"#7abf8a": a.weightTrend > 0?"#c87070":"#4a4a3a", background: a.weightTrend < 0?"#0d1a0d":a.weightTrend > 0?"#1a0d0d":"#111", border:`1px solid ${a.weightTrend < 0?"#2a5a2a":a.weightTrend > 0?"#5a2a2a":"#2a2a2a"}`, borderRadius:6, padding:"2px 8px" }}>
                          {a.weightTrend > 0 ? '+' : ''}{a.weightTrend} kg
                        </span>
                      )}
                    </div>
                  )}

                  {/* Strava */}
                  {a.strava && (a.strava.count7j > 0 || a.strava.lastActivity) && (
                    <div style={{ background:"#111", border:"1px solid #242424", borderRadius:10, padding:"14px", marginBottom:14 }}>
                      <div style={{ fontSize:"0.52rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>Activité Strava</div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        {a.strava.lastActivity ? (
                          <div>
                            <div style={{ fontSize:"0.72rem", color:"#c8b890" }}>{a.strava.lastActivity.typeLabel}</div>
                            <div style={{ fontSize:"0.58rem", color:"#4a4a3a", marginTop:4 }}>
                              {a.strava.lastActivity.date}
                              {a.strava.lastActivity.duration && ` · ${Math.round(a.strava.lastActivity.duration / 60)} min`}
                              {a.strava.lastActivity.calories > 0 && ` · ${a.strava.lastActivity.calories} kcal`}
                            </div>
                          </div>
                        ) : <div/>}
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:"1rem", color: a.strava.count7j >= 3?"#7abf8a":"#c8a060", fontWeight:500 }}>{a.strava.count7j}</div>
                          <div style={{ fontSize:"0.5rem", color:"#3a3a2a" }}>séances 7j</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bilan sanguin */}
                  {a.blood && (
                    <div style={{ background:"#111", border:`1px solid ${a.blood.pendingCoachValidation ? "#a89050" : "#242424"}`, borderRadius:10, padding:"14px", marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <div style={{ fontSize:"0.52rem", color: a.blood.pendingCoachValidation ? "#a89050" : "#4a4a3a", letterSpacing:1, textTransform:"uppercase" }}>
                          🩸 {a.blood.pendingCoachValidation ? "Bilan à valider" : "Bilan sanguin"}
                        </div>
                        <div style={{ fontSize:"0.55rem", color:"#3a3a2a" }}>{a.blood.date || '—'}</div>
                      </div>
                      <div style={{ fontSize:"0.68rem", color:"#c8b890", marginBottom:6, lineHeight:1.6 }}>{a.blood.reportType}</div>
                      {a.blood.summary && (
                        <div style={{ fontSize:"0.62rem", color:"#5a5a4a", lineHeight:1.6, marginBottom: a.blood.abnormal?.length > 0 ? 10 : 0 }}>{a.blood.summary}</div>
                      )}
                      {a.blood.abnormal?.length > 0 && (
                        <div>
                          <div style={{ fontSize:"0.5rem", color:"#3a3a2a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Marqueurs anormaux</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                            {a.blood.abnormal.map((m, i) => (
                              <div key={i} style={{ background: m.status==='bad'?"#1a0d0d":"#1a1500", border:`1px solid ${m.status==='bad'?"#5a2a2a":"#5a4a1a"}`, borderRadius:7, padding:"5px 9px", fontSize:"0.58rem", color: m.status==='bad'?"#c87070":"#c8a060" }}>
                                {m.name} {m.value}{m.unit}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(!a.blood.abnormal || a.blood.abnormal.length === 0) && (
                        <div style={{ fontSize:"0.58rem", color:"#3a7a3a" }}>✓ Tous les marqueurs sont normaux</div>
                      )}
                      {a.blood.pendingCoachValidation && (
                        <button
                          onClick={async () => {
                            await fetch('/api/coach/bloodtest', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: a.id, bloodTestId: a.blood.id }) });
                            setAthletes(prev => prev.map(x => x.id === a.id ? { ...x, blood: { ...x.blood, pendingCoachValidation: false } } : x));
                          }}
                          style={{ marginTop:12, width:"100%", padding:"8px", background:"#a89050", border:"none", borderRadius:8, color:"#0d0d0d", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", fontWeight:700, cursor:"pointer" }}>
                          ✓ Valider et envoyer à {a.name.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Édition objectifs */}
                  {editingId === a.id ? (
                    <div style={{ background:"#111", border:"1px solid #242424", borderRadius:10, padding:"16px", marginBottom:14 }}>
                      <div style={{ fontSize:"0.52rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Modifier les objectifs</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                        {[
                          { k:'goalKcal', l:'Kcal/j' },
                          { k:'goalProtein', l:'Protéines (g)' },
                          { k:'goalCarbs', l:'Glucides (g)' },
                          { k:'goalFat', l:'Lipides (g)' },
                        ].map(f => (
                          <div key={f.k}>
                            <div style={{ fontSize:"0.52rem", color:"#4a4a3a", letterSpacing:1, marginBottom:5 }}>{f.l}</div>
                            <input type="number" value={editGoals[f.k] || ''} onChange={e => setEditGoals(prev => ({ ...prev, [f.k]: e.target.value }))}
                              placeholder={f.k === 'goalKcal' ? a.goalKcal : f.k === 'goalProtein' ? a.goalProtein : '—'}
                              style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:7, padding:"8px 10px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", outline:"none" }}/>
                          </div>
                        ))}
                      </div>
                      <textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note pour le patient (optionnel)…" rows={2}
                        style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:7, padding:"8px 10px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", outline:"none", resize:"none", marginBottom:10 }}/>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => setEditingId(null)} style={{ flex:1, padding:"9px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>Annuler</button>
                        <button onClick={() => saveGoals(a.id)} disabled={savingId===a.id} style={{ flex:2, padding:"9px", background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", fontWeight:500, cursor:"pointer", opacity:savingId===a.id?0.6:1 }}>
                          {savingId===a.id ? "Enregistrement…" : "✓ Appliquer"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(a)} style={{ width:"100%", padding:"10px", background:"#111", border:"1px solid #242424", borderRadius:10, color:"#5a8acf", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer", marginBottom:10, transition:"all 0.2s" }}>
                      ✏️ Modifier les objectifs
                    </button>
                  )}

                  {/* Permissions autonomie — au moins 1 requis */}
                  <div style={{ background:"#111", border:"1px solid #242424", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                    <div style={{ fontSize:"0.48rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Accès de l'élève</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {[
                        { key:'selfNutritionAllowed', icon:'🥗', label:'Nutrition' },
                        { key:'selfMuscuAllowed',     icon:'💪', label:'Muscu' },
                      ].map(({key,icon,label})=>{
                        const on = a[key] !== false;
                        const busy = !!togglingPermission[`${a.id}:${key}`];
                        return (
                          <div key={key} onClick={()=>{ if(busy) return; setConfirmPermChange({ athleteId: a.id, athleteName: a.name, key, newValue: !on, label, icon }); }}
                            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"9px 11px", background:on?"#141a14":"#0d0d0d", border:`1px solid ${on?"#2a4a2a":"#1e1e1e"}`, borderRadius:8, cursor:busy?"default":"pointer", opacity:busy?0.5:1, transition:"all 0.2s" }}>
                            <div style={{ fontSize:"0.65rem", color:on?"#c8b890":"#5a5a4a" }}>{icon} {label}</div>
                            <div style={{ flexShrink:0, width:34, height:19, background:on?"#2a4a2a":"#1a1a1a", border:`1px solid ${on?"#4a8a4a":"#2a2a2a"}`, borderRadius:10, position:"relative", transition:"all 0.2s" }}>
                              <div style={{ position:"absolute", top:2, left:on?15:2, width:13, height:13, background:on?"#7abf8a":"#3a3a3a", borderRadius:"50%", transition:"all 0.2s" }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Journal du jour */}
                  {a.todayJournal?.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <button onClick={() => setExpandedJournal(expandedJournal===a.id ? null : a.id)}
                        style={{ width:"100%", padding:"10px 14px", background:"#111", border:"1px solid #242424", borderRadius: expandedJournal===a.id?"10px 10px 0 0":"10px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between" }}>
                        <span>📋 Journal aujourd'hui</span>
                        <span style={{ color:"#3a3a2a" }}>{a.todayJournal.length} aliments {expandedJournal===a.id?"▲":"▼"}</span>
                      </button>
                      {expandedJournal===a.id && (
                        <div style={{ background:"#111", border:"1px solid #242424", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"10px 14px" }}>
                          {a.todayJournal.map((e,i) => (
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom: i<a.todayJournal.length-1?"1px solid #1e1e1e":"none" }}>
                              <div>
                                <span style={{ fontSize:"0.65rem", color:"#c8b890" }}>{e.name}</span>
                                {e.meal && <span style={{ fontSize:"0.54rem", color:"#3a3a2a", marginLeft:8 }}>{e.meal}</span>}
                              </div>
                              <span style={{ fontSize:"0.6rem", color:"#5a5a4a", flexShrink:0, marginLeft:8 }}>{e.kcal} kcal · {e.protein}g prot</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <button onClick={()=>generateReport(a.id, a.name)} disabled={reportLoading}
                      style={{ flex:2, position:"relative", padding:"10px 8px", background: a.reportRequest ? "#1a1200" : "#111", border:`1px solid ${a.reportRequest ? "#c8b890" : "#242424"}`, borderRadius:10, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:reportLoading?"not-allowed":"pointer", opacity:reportLoading?0.5:1, textAlign:"center" }}>
                      {reportLoading && reportAthlete===a.name ? "…" : `📄 Rapport ${reportDays}j`}
                      {a.reportRequest && <span style={{ position:"absolute", top:-5, right:-5, background:"#c8b890", color:"#0d0d0d", borderRadius:"50%", width:14, height:14, fontSize:"0.5rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", zIndex:1 }}>!</span>}
                    </button>
                    <button onClick={() => openProgramModal(a)}
                      style={{ flex:1, padding:"10px 6px", background:"#111", border:"1px solid #2a3a2a", borderRadius:10, color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer", textAlign:"center" }}>
                      🥗 Nutri
                    </button>
                    <button onClick={() => openMuscuModal(a)}
                      style={{ flex:1, padding:"10px 6px", background:"#111", border:"1px solid #2a2a3a", borderRadius:10, color:"#8a7abf", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer", textAlign:"center" }}>
                      💪 Muscu
                    </button>
                  </div>
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    <button onClick={async () => { await fetch('/api/auth/view-as', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId: a.id }) }); window.location.href = '/?tab=sante'; }}
                      style={{ flex:1, position:"relative", padding:"9px 6px", background: a.pendingBlood ? "#0d1a0d" : "#111", border:`1px solid ${a.pendingBlood ? "#3a7a3a" : "#242424"}`, borderRadius:10, color: a.pendingBlood ? "#7abf8a" : "#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", textAlign:"center" }}>
                      🩺 Santé
                      {a.pendingBlood && <span style={{ position:"absolute", top:-5, right:-5, background:"#7abf8a", color:"#0d0d0d", borderRadius:"50%", width:14, height:14, fontSize:"0.5rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", zIndex:1 }}>!</span>}
                    </button>
                    <button onClick={() => openChat(a)} style={{ flex:1, position:"relative", padding:"9px 6px", background:"#111", border:"1px solid #242424", borderRadius:10, color:"#7a8abf", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", textAlign:"center" }}>
                      💬 Message
                      {chatUnread[a.id] > 0 && <span style={{ position:"absolute", top:-5, right:-5, background:"#c87070", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:"0.5rem", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>{chatUnread[a.id]}</span>}
                    </button>
                    <button onClick={async () => { await fetch('/api/auth/view-as', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId: a.id }) }); window.location.href = '/'; }}
                      style={{ flex:1, padding:"9px 6px", background:"#111", border:"1px solid #3a2a1a", borderRadius:10, color:"#c8a870", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", textAlign:"center" }}>
                      👁 Journal
                    </button>
                  </div>

                  {/* Notes privées */}
                  <div style={{ marginBottom:10 }}>
                    <button onClick={async()=>{
                      if (notesOpen===a.id) { setNotesOpen(null); return; }
                      if (!notesText[a.id]) {
                        const d = await fetch(`/api/coach/notes?athleteId=${a.id}`).then(r=>r.json());
                        setNotesText(t=>({...t,[a.id]:d.notes||''}));
                      }
                      setNotesOpen(a.id);
                    }} style={{ width:"100%", padding:"10px 14px", background:"#111", border:"1px solid #242424", borderRadius: notesOpen===a.id?"10px 10px 0 0":"10px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between" }}>
                      <span>📝 Notes privées</span>
                      <span>{notesOpen===a.id?"▲":"▼"}</span>
                    </button>
                    {notesOpen===a.id && (
                      <div style={{ background:"#111", border:"1px solid #242424", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"12px 14px" }}>
                        <textarea value={notesText[a.id]||''} onChange={e=>setNotesText(t=>({...t,[a.id]:e.target.value}))}
                          placeholder="Notes personnelles sur ce patient — non visibles par le patient…"
                          style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:"#8a8070", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", resize:"none", minHeight:90, lineHeight:1.7 }}/>
                        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                          <button onClick={async()=>{
                            setNotesSaving(a.id);
                            await fetch('/api/coach/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({athleteId:a.id,notes:notesText[a.id]||''})});
                            setNotesSaving(null);
                          }} disabled={notesSaving===a.id}
                            style={{ background:"#1e1a12", border:"1px solid #3a3520", borderRadius:7, padding:"6px 16px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>
                            {notesSaving===a.id ? '…' : 'Sauvegarder'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setConfirmDelete(a)}
                    style={{ width:"100%", padding:"9px", background:"#1a0d0d", border:"1px solid #3a2020", borderRadius:10, color:"#8a4040", fontFamily:"'DM Mono',monospace", fontSize:"0.58rem", cursor:"pointer" }}>
                    Retirer ce patient
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal chat */}
      {chatModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:150, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>setChatModal(null)}>
          <div style={{ width:"100%", maxWidth:520, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"16px 16px 0 0", padding:"16px 16px 0", maxHeight:"70vh", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexShrink:0 }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:"#c8b890", letterSpacing:1 }}>💬 {chatModal.name}</div>
              <button onClick={()=>setChatModal(null)} style={{ background:"none", border:"none", color:"#5a5a4a", fontSize:"1rem", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", paddingBottom:8, display:"flex", flexDirection:"column", gap:8 }}>
              {chatMessages.length === 0 && <div style={{ textAlign:"center", color:"#3a3a2a", fontSize:"0.62rem", padding:"20px 0" }}>Aucun message avec ce patient.</div>}
              {chatMessages.map((m, i) => (
                <div key={m.id||i} style={{ display:"flex", flexDirection:"column", alignItems: m.role==='coach'?"flex-end":"flex-start" }}>
                  <div style={{ maxWidth:"78%", background: m.role==='coach'?"#1e1a12":"#1e1e2a", border:`1px solid ${m.role==='coach'?"#3a3218":"#2a2a4a"}`, borderRadius: m.role==='coach'?"12px 12px 2px 12px":"12px 12px 12px 2px", padding:"8px 12px" }}>
                    <div style={{ fontSize:"0.68rem", color: m.role==='coach'?"#c8b890":"#8a9abf", lineHeight:1.5 }}>{m.text}</div>
                  </div>
                  <div style={{ fontSize:"0.5rem", color:"#3a3a2a", marginTop:2, marginLeft:4, marginRight:4 }}>{new Date(m.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, padding:"12px 0", flexShrink:0, borderTop:"1px solid #2a2a2a" }}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChatMessage()} placeholder={`Message à ${chatModal.name}…`} style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", outline:"none" }}/>
              <button onClick={sendChatMessage} disabled={!chatInput.trim()||chatSending} style={{ padding:"9px 14px", background:"#1e1a12", border:"1px solid #c8b890", borderRadius:10, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", opacity:!chatInput.trim()||chatSending?0.5:1 }}>→</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression athlète */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#1a1a1a", border:"1px solid #3a2a2a", borderRadius:14, padding:"24px 20px", maxWidth:340, width:"100%" }}>
            <div style={{ fontSize:"0.8rem", color:"#e8e0d0", marginBottom:8 }}>Retirer {confirmDelete.name} ?</div>
            <div style={{ fontSize:"0.62rem", color:"#5a5a4a", marginBottom:20, lineHeight:1.6 }}>Ce patient ne sera plus lié à ton compte. Ses données restent intactes.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:"9px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>Annuler</button>
              <button onClick={() => deleteAthlete(confirmDelete.id)} style={{ flex:1, padding:"9px", background:"#2a0d0d", border:"1px solid #5a2a2a", borderRadius:8, color:"#c87070", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>Retirer</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation changement permission */}
      {confirmPermChange && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:14, padding:"24px 20px", maxWidth:340, width:"100%" }}>
            <div style={{ fontSize:"0.8rem", color:"#e8e0d0", marginBottom:8 }}>
              {confirmPermChange.newValue ? `Donner accès ${confirmPermChange.icon} ${confirmPermChange.label} ?` : `Retirer l'accès ${confirmPermChange.icon} ${confirmPermChange.label} ?`}
            </div>
            <div style={{ fontSize:"0.62rem", color:"#5a5a4a", marginBottom:20, lineHeight:1.6 }}>
              {confirmPermChange.newValue
                ? `${confirmPermChange.athleteName} pourra générer ses propres programmes de ${confirmPermChange.label.toLowerCase()}.`
                : `${confirmPermChange.athleteName} ne pourra plus générer de programmes de ${confirmPermChange.label.toLowerCase()}.`}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmPermChange(null)} style={{ flex:1, padding:"9px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>Annuler</button>
              <button onClick={async () => { const c = confirmPermChange; setConfirmPermChange(null); await togglePermission(c.athleteId, c.key, c.newValue); }}
                style={{ flex:1, padding:"9px", background: confirmPermChange.newValue?"#0d1a0d":"#1a0d0d", border:`1px solid ${confirmPermChange.newValue?"#2a5a2a":"#5a2a2a"}`, borderRadius:8, color: confirmPermChange.newValue?"#7abf8a":"#c87070", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal programme */}
      {programModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:100, overflowY:"auto", padding:16 }} onClick={()=>{ if(!programLoading){ setProgramModal(null); setGeneratedProgram(null); } }}>
          <div style={{ maxWidth:600, margin:"0 auto", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:16, padding:"24px 20px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8" }}>Programme — {programModal.name}</div>
                <div style={{ fontSize:"0.58rem", color:"#4a4a3a", marginTop:2 }}>Généré par IA · personnalisé selon profil + bilan sanguin</div>
              </div>
              {!programLoading && <button onClick={()=>{ setProgramModal(null); setGeneratedProgram(null); }} style={{ background:"transparent", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#5a5a4a" }}>✕</button>}
            </div>

            {!generatedProgram ? (
              <div>
                {/* Config */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Repas par jour</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {[3,4,5].map(n => (
                      <button key={n} onClick={() => setProgramConfig(p => ({ ...p, mealsPerDay: n }))}
                        style={{ flex:1, padding:"8px", background:programConfig.mealsPerDay===n?"#1e2a1e":"#0d0d0d", border:`1px solid ${programConfig.mealsPerDay===n?"#4a8a4a":"#2a2a2a"}`, borderRadius:8, color:programConfig.mealsPerDay===n?"#7abf8a":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                        {n} repas
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { k:'preferences', l:'Préférences alimentaires', ph:'Ex: végétarien, aime les légumineuses…' },
                  { k:'avoidFoods', l:'Aliments à éviter', ph:'Ex: gluten, lactose, fruits de mer…' },
                  { k:'coachNotes', l:'Notes pour l\'IA', ph:'Ex: semaine de compétition, blessure genou…' },
                ].map(f => (
                  <div key={f.k} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{f.l}</div>
                    <input value={programConfig[f.k]} onChange={e => setProgramConfig(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph}
                      style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", outline:"none" }}/>
                  </div>
                ))}
                {programError && (
                  <div style={{ background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:8, padding:"10px 12px", marginBottom:10, fontSize:"0.62rem", color:"#c87070", lineHeight:1.5 }}>
                    ⚠ {programError}
                  </div>
                )}
                <button onClick={generateProgram} disabled={programLoading}
                  style={{ width:"100%", padding:"12px", background:programLoading?"#1a2a1a":"#2a4a2a", border:"1px solid #4a8a4a", borderRadius:10, color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", fontWeight:500, cursor:programLoading?"not-allowed":"pointer", letterSpacing:1, marginTop:4 }}>
                  {programLoading ? "Génération en cours… (30-60s)" : "✨ Générer le programme"}
                </button>
                {!programLoading && <button onClick={async()=>{
                  const empty = buildEmptyNutritionProgram(programConfig.mealsPerDay);
                  const res = await fetch('/api/coach/program',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId:programModal.id, program:empty }) });
                  const data = await res.json();
                  if (data.program) setGeneratedProgram(data.program);
                }} style={{ width:"100%", padding:"11px", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", letterSpacing:1, marginTop:8 }}>
                  📝 Remplir moi-même
                </button>}
              </div>
            ) : (
              <div>
                {/* Programme généré */}
                {generatedProgram.weeklyNotes && (
                  <div style={{ background:"#0d1a0d", border:"1px solid #2a4a2a", borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
                    <div style={{ fontSize:"0.55rem", color:"#3a7a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Conseils de la semaine</div>
                    <div style={{ fontSize:"0.65rem", color:"#7abf8a", lineHeight:1.6 }}>{generatedProgram.weeklyNotes}</div>
                  </div>
                )}
                {(generatedProgram.days || []).map((day, di) => (
                  <div key={di} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:"0.65rem", color:"#c8b890", fontWeight:500, marginBottom:6, letterSpacing:1 }}>{day.day}</div>
                    {(day.meals || []).map((meal, mi) => (
                      <div key={mi} style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                          <div style={{ fontSize:"0.6rem", color:"#5a8acf" }}>{meal.type}</div>
                          <div style={{ fontSize:"0.55rem", color:"#4a4a3a" }}>{meal.totalKcal} kcal · {meal.totalProtein}g prot</div>
                        </div>
                        {(meal.items || []).map((item, ii) => (
                          <div key={ii} style={{ fontSize:"0.6rem", color:"#c8b890", lineHeight:1.8 }}>
                            {item.name} <span style={{ color:"#4a4a3a" }}>{item.quantity}</span>
                          </div>
                        ))}
                        {meal.note && <div style={{ fontSize:"0.55rem", color:"#4a4a3a", marginTop:4, fontStyle:"italic" }}>{meal.note}</div>}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:16, position:"sticky", bottom:0, background:"#1a1a1a", padding:"12px 0" }}>
                  <button onClick={() => setGeneratedProgram(null)} style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:9, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                    ↩ Regénérer
                  </button>
                  <button onClick={sendProgram} disabled={sendingProgram}
                    style={{ flex:2, padding:"10px", background:"#2a4a2a", border:"1px solid #4a8a4a", borderRadius:9, color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", fontWeight:500, cursor:sendingProgram?"not-allowed":"pointer", opacity:sendingProgram?0.6:1 }}>
                    {sendingProgram ? "Envoi…" : `✓ Envoyer à ${programModal.name}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal muscu */}
      {muscuModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:100, overflowY:"auto", padding:16 }} onClick={()=>{ if(!muscuProgLoading){ setMuscuModal(null); setGeneratedMuscuProg(null); } }}>
          <div style={{ maxWidth:600, margin:"0 auto", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:16, padding:"24px 20px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8" }}>💪 Muscu — {muscuModal.name}</div>
                <div style={{ fontSize:"0.58rem", color:"#4a4a3a", marginTop:2 }}>Programme d'entraînement personnalisé</div>
              </div>
              {!muscuProgLoading && <button onClick={()=>{ setMuscuModal(null); setGeneratedMuscuProg(null); }} style={{ background:"transparent", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#5a5a4a" }}>✕</button>}
            </div>

            {!generatedMuscuProg ? (
              <div>
                {/* Séances / semaine */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Séances / semaine</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {[2,3,4,5,6].map(n => (
                      <button key={n} onClick={() => setMuscuProgConfig(p => ({ ...p, daysPerWeek: n }))}
                        style={{ flex:1, padding:"8px 4px", background:muscuProgConfig.daysPerWeek===n?"#1e1a12":"#0d0d0d", border:`1px solid ${muscuProgConfig.daysPerWeek===n?"#c8b890":"#2a2a2a"}`, borderRadius:8, color:muscuProgConfig.daysPerWeek===n?"#c8b890":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.75rem", cursor:"pointer" }}>{n}j</button>
                    ))}
                  </div>
                </div>
                {/* Objectif */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Objectif</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {['prise de masse','sèche','force','remise en forme'].map(g => (
                      <button key={g} onClick={() => setMuscuProgConfig(p => ({ ...p, goal: g }))}
                        style={{ padding:"7px 12px", background:muscuProgConfig.goal===g?"#1e1a12":"#0d0d0d", border:`1px solid ${muscuProgConfig.goal===g?"#c8b890":"#2a2a2a"}`, borderRadius:20, color:muscuProgConfig.goal===g?"#c8b890":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>{g}</button>
                    ))}
                  </div>
                </div>
                {/* Niveau */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Niveau</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {['débutant','intermédiaire','avancé'].map(l => (
                      <button key={l} onClick={() => setMuscuProgConfig(p => ({ ...p, level: l }))}
                        style={{ flex:1, padding:"7px 4px", background:muscuProgConfig.level===l?"#1e1a12":"#0d0d0d", border:`1px solid ${muscuProgConfig.level===l?"#c8b890":"#2a2a2a"}`, borderRadius:8, color:muscuProgConfig.level===l?"#c8b890":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>
                </div>
                {/* Matériel */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Matériel</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {['salle','maison','haltères','barre seule','sans matériel'].map(eq => (
                      <button key={eq} onClick={() => setMuscuProgConfig(p => ({ ...p, equipment: eq }))}
                        style={{ padding:"7px 12px", background:muscuProgConfig.equipment===eq?"#1e1a12":"#0d0d0d", border:`1px solid ${muscuProgConfig.equipment===eq?"#c8b890":"#2a2a2a"}`, borderRadius:20, color:muscuProgConfig.equipment===eq?"#c8b890":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>{eq}</button>
                    ))}
                  </div>
                </div>
                {/* Préférences */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Contraintes / préférences</div>
                  <input value={muscuProgConfig.preferences} onChange={e => setMuscuProgConfig(p => ({ ...p, preferences: e.target.value }))} placeholder="Ex: mal de dos, pas de squat, focus bras…"
                    style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", outline:"none" }}/>
                </div>
                {muscuProgError && <div style={{ background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:8, padding:"10px 12px", marginBottom:10, fontSize:"0.62rem", color:"#c87070" }}>⚠ {muscuProgError}</div>}
                <button onClick={generateCoachMuscuProgram} disabled={muscuProgLoading}
                  style={{ width:"100%", padding:"12px", background:muscuProgLoading?"#1a1a2a":"#1e1a2e", border:"1px solid #4a4a8a", borderRadius:10, color:"#8a7abf", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", fontWeight:500, cursor:muscuProgLoading?"not-allowed":"pointer", letterSpacing:1, marginTop:4 }}>
                  {muscuProgLoading ? "Génération en cours… (20-40s)" : "✨ Générer le programme"}
                </button>
                {!muscuProgLoading && <button onClick={async()=>{
                  const empty = buildEmptyMuscuProgram(muscuProgConfig);
                  const res = await fetch('/api/coach/muscu-program',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId:muscuModal.id, program:empty }) });
                  const data = await res.json();
                  if (data.program) setGeneratedMuscuProg(data.program);
                }} style={{ width:"100%", padding:"11px", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", letterSpacing:1, marginTop:8 }}>
                  📝 Remplir moi-même
                </button>}
              </div>
            ) : (
              <div>
                {generatedMuscuProg.weeklyNotes && (
                  <div style={{ background:"#0d0d1a", border:"1px solid #2a2a4a", borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
                    <div style={{ fontSize:"0.55rem", color:"#5a5a8a", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Conseils</div>
                    <div style={{ fontSize:"0.65rem", color:"#8a7abf", lineHeight:1.6 }}>{generatedMuscuProg.weeklyNotes}</div>
                  </div>
                )}
                {(generatedMuscuProg.days || []).map((day, di) => (
                  <div key={di} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:"0.65rem", color:"#c8b890", fontWeight:500, marginBottom:4, letterSpacing:1 }}>{day.day} {day.label && <span style={{ color:"#5a5a4a", fontSize:"0.58rem" }}>— {day.label}</span>}</div>
                    {day.exercises?.length === 0 ? (
                      <div style={{ fontSize:"0.6rem", color:"#3a3a2a", padding:"8px 12px", background:"#0d0d0d", borderRadius:8 }}>Aucun exercice</div>
                    ) : (day.exercises||[]).map((ex, ei) => (
                      <div key={ei} style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 12px", marginBottom:5 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div style={{ fontSize:"0.65rem", color:"#c8b890" }}>{ex.name}</div>
                          <div style={{ fontSize:"0.55rem", color:"#4a4a3a" }}>{ex.sets}×{ex.reps} · {ex.rest}</div>
                        </div>
                        {ex.note && <div style={{ fontSize:"0.55rem", color:"#4a4a3a", marginTop:3, fontStyle:"italic" }}>{ex.note}</div>}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:16, position:"sticky", bottom:0, background:"#1a1a1a", padding:"12px 0" }}>
                  <button onClick={() => setGeneratedMuscuProg(null)} style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:9, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                    ↩ Regénérer
                  </button>
                  <button onClick={sendMuscuProgram} disabled={sendingMuscuProg}
                    style={{ flex:2, padding:"10px", background:"#1e1a2e", border:"1px solid #4a4a8a", borderRadius:9, color:"#8a7abf", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", fontWeight:500, cursor:sendingMuscuProg?"not-allowed":"pointer", opacity:sendingMuscuProg?0.6:1 }}>
                    {sendingMuscuProg ? "Envoi…" : `✓ Envoyer à ${muscuModal.name}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal rapport */}
      {reportHtml && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, overflowY:"auto", padding:16 }} onClick={()=>{ setReportHtml(null); setReportSent(false); }}>
          <div style={{ maxWidth:640, margin:"0 auto", background:"#faf6ee", borderRadius:16, padding:"28px 24px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:"1.1rem", color:"#2a1a00" }}>Rapport — {reportAthlete}</div>
                <div style={{ fontSize:"0.65rem", color:"#8a7a5a", marginTop:2 }}>{reportDays}j · {new Date().toLocaleDateString("fr-FR")} · <span style={{ color:"#a08060" }}>Cliquez dans le texte pour modifier</span></div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => exportPDF(reportEditRef.current?.innerHTML || reportHtml, reportAthlete, reportDays)} style={{ background:"transparent", border:"1px solid #c8b890", borderRadius:8, padding:"5px 10px", fontSize:"0.6rem", color:"#c8b890", cursor:"pointer", fontFamily:"Georgia,serif" }}>⬇ PDF</button>
                <button onClick={()=>{ setReportHtml(null); setReportSent(false); }} style={{ background:"transparent", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#8a7a5a" }}>✕</button>
              </div>
            </div>
            <div
              ref={reportEditRef}
              contentEditable
              suppressContentEditableWarning
              style={{ fontFamily:"Georgia,serif", fontSize:"0.88rem", color:"#1a1a1a", lineHeight:1.7, outline:"none", minHeight:100, borderRadius:8, padding:"4px 0" }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportHtml) }}
            />
            <div style={{ marginTop:20, display:"flex", gap:8 }}>
              {reportSent ? (
                <div style={{ flex:1, padding:"12px", background:"#e8f5e8", border:"1px solid #7abf8a", borderRadius:10, color:"#3a7a3a", fontFamily:"Georgia,serif", fontSize:"0.72rem", textAlign:"center" }}>
                  ✓ Rapport envoyé à {reportAthlete}
                </div>
              ) : (
                <button onClick={sendReportToPatient} disabled={reportSending || !reportAthleteId}
                  style={{ flex:1, padding:"12px", background:reportSending?"#e8e0d0":"#2a1a00", border:"none", borderRadius:10, color:reportSending?"#8a7a5a":"#f0e6c8", fontFamily:"Georgia,serif", fontSize:"0.72rem", fontWeight:500, cursor:reportSending||!reportAthleteId?"not-allowed":"pointer", opacity:!reportAthleteId?0.5:1 }}>
                  {reportSending ? "Envoi en cours…" : `Valider et envoyer à ${reportAthlete}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
