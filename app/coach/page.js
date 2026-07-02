"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "../lib/sanitize";

// Petite stat de récupération (santé objet connecté) affichée dans la carte athlète.
function RecStat({ label, value }) {
  return (
    <div style={{ minWidth: 72 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: "20px", fontWeight: 600, color: "var(--cream)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "11px", color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: 1, marginTop: 8 }}>{label}</div>
    </div>
  );
}

// Champ texte éditable inline (contentEditable) — le coach corrige la sortie IA
// directement dans l'aperçu du programme. Non contrôlé pour éviter le saut de
// curseur ; remonte la valeur au blur.
function Ed({ value, onChange, style, block }) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={e => { const v = e.currentTarget.textContent; if (v !== (value ?? '')) onChange(v); }}
      style={{
        outline: "none", borderBottom: "1px dashed #3a3a2a", cursor: "text",
        minWidth: 16, display: block ? "block" : "inline-block", ...style,
      }}
    >{value}</span>
  );
}

// Sparkline SVG maison (aucune lib). Trace une polyline des `values`,
// une ligne pointillée `goal` optionnelle, et marque le dernier point.
function Sparkline({ values, goal, color = "#c8b890", height = 64 }) {
  const data = (values || []).filter(v => typeof v === 'number' && !isNaN(v));
  if (data.length < 2) return null;
  const W = 320, H = height, padX = 6, padY = 12;
  // Échelle sur les DONNÉES (avec marge) — l'objectif n'écrase pas la variation réelle.
  let min = Math.min(...data), max = Math.max(...data);
  if (max === min) { max += 1; min -= 1; }
  const span = max - min;
  min -= span * 0.18; max += span * 0.18;
  const x = i => padX + (i / (data.length - 1)) * (W - padX * 2);
  const y = v => H - padY - ((v - min) / (max - min)) * (H - padY * 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(data.length - 1), lastY = y(data[data.length - 1]);
  // Objectif toujours visible : clampé dans le cadre (sinon une légende référencerait une ligne hors-champ).
  const goalY = goal != null ? Math.max(padY, Math.min(H - padY, y(goal))) : null;
  const gid = `spk-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.13" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {goalY != null && (
        <line x1={padX} y1={goalY} x2={W - padX} y2={goalY} stroke="#6a6452" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      )}
      <polygon points={`${padX},${H - padY} ${pts} ${(W - padX)},${H - padY}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.6" fill={color} fillOpacity="0.5" vectorEffect="non-scaling-stroke" />)}
      <circle cx={lastX} cy={lastY} r="3" fill={color} stroke="#0d0d0d" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// « Synchronisé il y a X » — formatte un ISO en durée relative compacte.
function timeAgo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const diff = Date.now() - t;
  const stale = diff > 3 * 24 * 3600 * 1000;
  const min = Math.floor(diff / 60000);
  let label;
  if (min < 1) label = "à l'instant";
  else if (min < 60) label = `il y a ${min} min`;
  else if (min < 1440) label = `il y a ${Math.floor(min / 60)} h`;
  else label = `il y a ${Math.floor(min / 1440)} j`;
  return { label, stale };
}

export default function CoachDashboard() {
  const router = useRouter();
  const [user, setUser]         = useState(null);
  const [invites, setInvites] = useState([]);
  const [lastInvite, setLastInvite] = useState(null);
  const [inviteLabel, setInviteLabel] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [emailInvite, setEmailInvite] = useState('');
  const [emailInviteMsg, setEmailInviteMsg] = useState(null);
  const [sendingEmailInvite, setSendingEmailInvite] = useState(false);
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
  const [selectedId, setSelectedId] = useState(null); // athlète affiché dans le panneau détail (layout 2 panneaux)
  const [programModal, setProgramModal] = useState(null);
  const [programConfig, setProgramConfig] = useState({ mainMeals: 3, snacks: 1, preferences: '', avoidFoods: '', coachNotes: '' });
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
  const [bloodEdits, setBloodEdits] = useState({}); // { [athleteId]: { summary, weeklyFocus } } — corrections coach avant validation
  const [validatingBlood, setValidatingBlood] = useState(null);
  const [muscuLogs, setMuscuLogs] = useState({}); // { [athleteId]: sessions[] }
  const [chatModal, setChatModal] = useState(null); // { id, name }
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState({}); // { athleteId: count }
  const [view, setView] = useState('athletes'); // 'athletes' | 'messages' — bascule du dashboard
  const [notifPermission, setNotifPermission] = useState('default');

  // Menu « Mon compte » coach (logo marque blanche, profil, gestion compte)
  const [profile, setProfile] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  function resizeImageToDataUrl(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width >= height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
          else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function loadProfile() {
    try { const r = await fetch('/api/coach/profile'); const d = await r.json(); if (d.profile) setProfile(d.profile); } catch {}
  }
  async function saveProfileFields() {
    if (!profile) return;
    setProfileSaving(true); setProfileMsg(null);
    try {
      const r = await fetch('/api/coach/profile', { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ displayName: profile.displayName, bio: profile.bio, specialty: profile.specialty }) });
      setProfileMsg(r.ok ? 'Enregistré ✓' : 'Erreur');
    } catch { setProfileMsg('Erreur'); }
    setProfileSaving(false);
  }
  async function uploadLogo(file) {
    if (!file) return;
    setProfileMsg(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 320);
      const r = await fetch('/api/coach/profile', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ logo: dataUrl }) });
      const d = await r.json();
      if (r.ok) { setProfile(p => ({ ...p, logo: dataUrl })); setProfileMsg('Logo enregistré ✓'); }
      else setProfileMsg(d.error || 'Erreur logo');
    } catch { setProfileMsg('Erreur logo'); }
  }
  async function removeLogo() {
    try {
      const r = await fetch('/api/coach/profile', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ logo: null }) });
      if (r.ok) setProfile(p => ({ ...p, logo: null }));
    } catch {}
  }
  async function deleteAccount() {
    if (!window.confirm('Supprimer définitivement ton compte coach ? Tes élèves seront déliés (ils gardent leurs données). Action irréversible.')) return;
    try {
      const r = await fetch('/api/coach/profile', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ confirm:'SUPPRIMER' }) });
      if (r.ok) { await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{}); router.push('/login'); }
      else window.alert('Erreur lors de la suppression.');
    } catch { window.alert('Erreur réseau — suppression non effectuée.'); }
  }

  // Feature 1 — Bibliothèque de programmes
  const [templates, setTemplates] = useState([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateNameMuscu, setTemplateNameMuscu] = useState('');
  const [templateDescMuscu, setTemplateDescMuscu] = useState('');
  const [savingTemplateMuscu, setSavingTemplateMuscu] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [libFilter, setLibFilter] = useState('all'); // all | nutrition | muscu
  const [libApplying, setLibApplying] = useState(null); // tpl.id en cours d'application

  // Programmes actuels par athlète : { [id]: { nutrition, muscu } }
  const [currentPrograms, setCurrentPrograms] = useState({});

  // Sidebar : recherche + tri de la liste d'athlètes
  const [athleteSearch, setAthleteSearch] = useState('');
  const [athleteSort, setAthleteSort] = useState('alert'); // alert | inactive | az

  // Feature 2 — Mensurations
  const [measurements, setMeasurements] = useState({});
  const [measurementsOpen, setMeasurementsOpen] = useState({});
  const [muscuLogsOpen, setMuscuLogsOpen] = useState({});

  // Feature 3 — Check-ins
  const [checkins, setCheckins] = useState({});
  const [checkinsOpen, setCheckinsOpen] = useState({});

  // Suivi photo / vidéo (galerie coach)
  const [coachMedia, setCoachMedia] = useState({}); // { [athleteId]: items[] }
  const [coachMediaOpen, setCoachMediaOpen] = useState({});
  const [mediaComment, setMediaComment] = useState({}); // { [mediaId]: text }
  const [mediaFilter, setMediaFilter] = useState('all'); // all | photo | video
  const [compareMode, setCompareMode] = useState(false);
  const [compareSel, setCompareSel] = useState([]); // mediaIds sélectionnés (max 2)
  const [compareView, setCompareView] = useState(null); // [m1, m2] affichés côte à côte
  async function toggleReference(athleteId, mediaId) {
    try { const r = await fetch('/api/coach/media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({athleteId,mediaId,action:'reference'})}); if (r.ok) loadMedia(athleteId); } catch {}
  }
  async function loadMedia(athleteId) {
    try {
      const r = await fetch(`/api/coach/media?athleteId=${athleteId}`); const d = await r.json();
      const items = d.items || [];
      setCoachMedia(prev=>({...prev,[athleteId]: items}));
      // ouvre la section automatiquement s'il y a du nouveau (non visionné)
      if (items.some(m=>!m.viewedAt && !m.expired)) setCoachMediaOpen(prev=>({...prev,[athleteId]:true}));
    } catch {}
  }
  async function markMediaViewed(athleteId, mediaId) {
    try {
      const r = await fetch('/api/coach/media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({athleteId,mediaId,action:'view'})});
      if (!r.ok) return;
      loadMedia(athleteId);   // recharge la galerie → pastille section à jour (viewedAt)
      refreshAthletes();      // recharge les compteurs mediaUnseen → badge élève + onglet à jour
    } catch {}
  }
  async function downloadMedia(url, type, id) {
    // Télécharge réellement le fichier (l'URL Supabase est cross-origin → on passe par un blob).
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `suivi-${id}.${type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objUrl);
    } catch { window.alert('Téléchargement impossible.'); }
  }
  async function sendMediaComment(athleteId, mediaId) {
    const comment = (mediaComment[mediaId]||'').trim();
    if (!comment) return;
    try {
      const r = await fetch('/api/coach/media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({athleteId,mediaId,comment})});
      if (!r.ok) { window.alert('Commentaire non envoyé, réessaie.'); return; }
      setMediaComment(prev=>({...prev,[mediaId]:''}));
      loadMedia(athleteId);
    } catch { window.alert('Commentaire non envoyé, réessaie.'); }
  }

  // Feature 4 — Bilan initial
  const [intakes, setIntakes] = useState({});

  // Feature 5 — Commentaires journal
  const [journalComments, setJournalComments] = useState({});
  const [journalCommentInput, setJournalCommentInput] = useState({});

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
    fetch('/api/coach/athletes').then(r=>r.json()).then(d=>{ setAthletes(d.athletes||[]); setLoading(false); }).catch(()=>setLoading(false));
    // Charger l'historique des invitations (codes usage unique). Le code généré ne
    // s'affiche en grand qu'au moment de sa génération ; après refresh il n'est plus
    // que dans l'historique (« Voir l'historique »).
    fetch('/api/coach/invite').then(r=>r.json()).then(d => {
      setInvites(d.invites || []);
    }).catch(()=>{});
    // Charger les modèles de programmes
    fetch('/api/coach/templates').then(r=>r.json()).then(d=>setTemplates(d.templates||[])).catch(()=>{});
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

  function exportPDF(html, name, days) {
    const w = window.open('', '_blank');
    if (!w) { alert('Les popups sont bloquées. Autorise-les pour exporter.'); return; }
    // Échappe le nom (contrôlé par l'élève) injecté dans le HTML du PDF — anti-XSS.
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    const safeName = esc(name);
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${safeName}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1a1a1a;line-height:1.7}h2{margin-top:24px;color:#2a1a00}@media print{body{margin:20px}}</style></head><body><h1>Rapport nutritionnel — ${safeName}</h1><p style="color:#8a7a5a;font-size:0.85rem">${days}j · ${new Date().toLocaleDateString('fr-FR')}</p>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  function buildEmptyNutritionProgram({ mainMeals = 3, snacks = 1 } = {}) {
    const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const MAIN = mainMeals === 2 ? ['Petit-déjeuner','Dîner'] : mainMeals === 3 ? ['Petit-déjeuner','Déjeuner','Dîner'] : mainMeals === 4 ? ['Petit-déjeuner','Déjeuner','Goûter','Dîner'] : ['Petit-déjeuner','Brunch','Déjeuner','Goûter','Dîner'];
    const MT = [];
    MT.push(MAIN[0]);
    if (snacks >= 1) MT.push('Collation matin');
    if (MAIN[1]) MT.push(MAIN[1]);
    if (snacks >= 2) MT.push('Collation après-midi');
    if (MAIN[2]) MT.push(MAIN[2]);
    if (snacks >= 3) MT.push('Collation soirée');
    if (MAIN[3]) MT.push(MAIN[3]);
    if (MAIN[4]) MT.push(MAIN[4]);
    return { id:Date.now(), generatedAt:new Date().toISOString(), mainMeals, snacks, mealsPerDay:MT.length, preferences:'', avoidFoods:'', weeklyNotes:'', status:'draft', sentAt:null,
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
    setProgramConfig({ mainMeals: 3, snacks: 1, preferences: '', avoidFoods: '', coachNotes: '' });
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
    // Envoie le programme ÉVENTUELLEMENT édité par le coach (PATCH persiste `program`).
    await fetch('/api/coach/program', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId: programModal.id, programId: generatedProgram.id, program: generatedProgram }),
    });
    setSendingProgram(false);
    setProgramModal(null); setGeneratedProgram(null);
  }

  // ── Édition inline du programme nutrition ──────────────────────────────────
  function editNutDay(di, fn) {
    setGeneratedProgram(p => ({ ...p, days: p.days.map((d, i) => i === di ? fn(d) : d) }));
  }
  function editNutMeal(di, mi, field, value) {
    editNutDay(di, d => ({ ...d, meals: d.meals.map((m, j) => j === mi ? { ...m, [field]: value } : m) }));
  }
  function editNutItem(di, mi, ii, field, value) {
    editNutDay(di, d => ({ ...d, meals: d.meals.map((m, j) => j !== mi ? m : { ...m, items: m.items.map((it, k) => k === ii ? { ...it, [field]: value } : it) }) }));
  }
  function deleteNutItem(di, mi, ii) {
    editNutDay(di, d => ({ ...d, meals: d.meals.map((m, j) => j !== mi ? m : { ...m, items: m.items.filter((_, k) => k !== ii) }) }));
  }
  function addNutItem(di, mi) {
    editNutDay(di, d => ({ ...d, meals: d.meals.map((m, j) => j !== mi ? m : { ...m, items: [...(m.items || []), { name: 'Nouvel aliment', quantity: '' }] }) }));
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
      body: JSON.stringify({ athleteId: muscuModal.id, programId: generatedMuscuProg.id, program: generatedMuscuProg }),
    });
    setSendingMuscuProg(false);
    setMuscuModal(null); setGeneratedMuscuProg(null);
  }

  // ── Édition inline du programme muscu ──────────────────────────────────────
  function editMuscuDay(di, fn) {
    setGeneratedMuscuProg(p => ({ ...p, days: p.days.map((d, i) => i === di ? fn(d) : d) }));
  }
  function editMuscuEx(di, ei, field, value) {
    editMuscuDay(di, d => ({ ...d, exercises: d.exercises.map((x, k) => k === ei ? { ...x, [field]: value } : x) }));
  }
  function deleteMuscuEx(di, ei) {
    editMuscuDay(di, d => ({ ...d, exercises: (d.exercises || []).filter((_, k) => k !== ei) }));
  }
  function addMuscuEx(di) {
    editMuscuDay(di, d => ({ ...d, exercises: [...(d.exercises || []), { name: 'Nouvel exercice', sets: 3, reps: '10', rest: '90s' }] }));
  }

  async function openChat(a) {
    setView('messages'); // tout le chat passe par la vue Messages (plus de modale)
    setChatModal(a);     // = conversation active dans le panneau droit
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
        const d = await fetch(`/api/chat?athleteId=${a.id}&peek=1`).then(r=>r.json()).catch(()=>({ unreadCount:0 }));
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

  async function sendChatPhoto(file) {
    if (!file || !chatModal) return;
    setChatSending(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = /^(jpg|jpeg|png|webp)$/.test(ext) ? ext : 'jpg';
      const signRes = await fetch('/api/media/sign-upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'photo', ext: safeExt }) });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error);
      const put = await fetch(sign.uploadUrl, { method:'PUT', headers:{ 'content-type': file.type || 'image/jpeg', 'x-upsert':'true' }, body: file });
      if (!put.ok) throw new Error('upload');
      await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: chatModal.id, imagePath: sign.storedPath }) });
      const r2 = await fetch(`/api/chat?athleteId=${chatModal.id}`); const d2 = await r2.json(); setChatMessages(d2.messages || []);
    } catch { window.alert('Envoi de la photo impossible.'); }
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

  async function sendEmailInvite() {
    const email = emailInvite.trim().toLowerCase();
    if (!email) return;
    setSendingEmailInvite(true); setEmailInviteMsg(null);
    try {
      const r = await fetch('/api/coach/invite-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
      const d = await r.json();
      if (r.ok) { setEmailInviteMsg({ ok:true, text:`Invitation envoyée à ${email}. Dès qu'il crée son compte avec cet email, il est rattaché automatiquement.` }); setEmailInvite(''); }
      else setEmailInviteMsg({ ok:false, text: d.message || d.error || 'Erreur' });
    } catch { setEmailInviteMsg({ ok:false, text:'Erreur réseau' }); }
    setSendingEmailInvite(false);
  }
  async function generateInvite() {
    setGeneratingInvite(true);
    const res = await fetch('/api/coach/invite', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label: inviteLabel }) });
    const data = await res.json();
    if (data.invite) {
      setInvites(prev => [{ ...data.invite, expired: false }, ...prev]);
      setInviteLabel('');
      setLastInvite({ token: data.token, link: `${window.location.origin}/login?coach=${data.token}` });
    }
    setGeneratingInvite(false);
  }

  async function revokeInvite(token) {
    await fetch('/api/coach/invite', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
    setInvites(prev => prev.filter(i => i.token !== token));
    if (lastInvite?.token === token) setLastInvite(null);
  }

  function copyInviteLink(token) {
    const link = `${window.location.origin}/login?coach=${token}`;
    navigator.clipboard.writeText(link);
    setCopied(`link-${token}`); setTimeout(()=>setCopied(false), 2000);
  }


  async function deleteTemplate(id) {
    await fetch('/api/coach/templates', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function applyNutritionTemplate(tpl) {
    if (!programModal?.id) return;
    const res = await fetch('/api/coach/program', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: programModal.id, program: tpl.program }) });
    const data = await res.json();
    if (data.program) setGeneratedProgram(data.program);
  }

  async function applyMuscuTemplate(tpl) {
    if (!muscuModal?.id) return;
    const res = await fetch('/api/coach/muscu-program', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: muscuModal.id, program: tpl.program }) });
    const data = await res.json();
    if (data.program) setGeneratedMuscuProg(data.program);
  }

  // Bibliothèque → assigne un modèle à l'athlète sélectionné en 2 clics.
  // N'utilise PAS programModal/muscuModal (état async) mais selectedId directement,
  // puis ouvre la modale correspondante avec le brouillon chargé, prêt à éditer/envoyer.
  async function applyTemplateFromLibrary(tpl) {
    if (!selectedId) return;
    const athlete = athletes.find(x => x.id === selectedId);
    if (!athlete) return;
    setLibApplying(tpl.id);
    try {
      if (tpl.type === 'nutrition') {
        const res = await fetch('/api/coach/program', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: selectedId, program: tpl.program }) });
        const data = await res.json();
        if (data.program) {
          setProgramError(null);
          setGeneratedProgram(data.program);
          setProgramModal(athlete);
        }
      } else {
        const res = await fetch('/api/coach/muscu-program', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: selectedId, program: tpl.program }) });
        const data = await res.json();
        if (data.program) {
          setMuscuProgError(null);
          setGeneratedMuscuProg(data.program);
          setMuscuModal(athlete);
        }
      }
    } catch {}
    setLibApplying(null);
  }

  async function saveNutritionTemplate() {
    if (!templateName.trim() || !generatedProgram) return;
    setSavingTemplate(true);
    await fetch('/api/coach/templates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: templateName.trim(), description: templateDesc.trim(), type: 'nutrition', program: generatedProgram }) });
    const d = await fetch('/api/coach/templates').then(r=>r.json());
    setTemplates(d.templates||[]);
    setTemplateName(''); setTemplateDesc('');
    setSavingTemplate(false);
  }

  async function saveMuscuTemplate() {
    if (!templateNameMuscu.trim() || !generatedMuscuProg) return;
    setSavingTemplateMuscu(true);
    await fetch('/api/coach/templates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: templateNameMuscu.trim(), description: templateDescMuscu.trim(), type: 'muscu', program: generatedMuscuProg }) });
    const d = await fetch('/api/coach/templates').then(r=>r.json());
    setTemplates(d.templates||[]);
    setTemplateNameMuscu(''); setTemplateDescMuscu('');
    setSavingTemplateMuscu(false);
  }

  async function loadMeasurements(athleteId) {
    if (measurements[athleteId]) return;
    const d = await fetch(`/api/coach/measurements?athleteId=${athleteId}`).then(r=>r.json()).catch(()=>({}));
    setMeasurements(prev => ({ ...prev, [athleteId]: d.measurements || [] }));
  }

  async function loadCheckins(athleteId) {
    if (checkins[athleteId]) return;
    const d = await fetch(`/api/coach/checkin?athleteId=${athleteId}`).then(r=>r.json()).catch(()=>({}));
    setCheckins(prev => ({ ...prev, [athleteId]: d.checkins || [] }));
  }

  async function loadMuscuLogs(athleteId) {
    if (muscuLogs[athleteId]) return;
    const d = await fetch(`/api/coach/muscu-logs?athleteId=${athleteId}`).then(r=>r.json()).catch(()=>({}));
    setMuscuLogs(prev => ({ ...prev, [athleteId]: d.sessions || [] }));
  }

  // Sélectionne un athlète pour le panneau détail + précharge ses données.
  function selectAthlete(id) {
    setSelectedId(id);
    loadMeasurements(id);
    loadCheckins(id);
    loadIntake(id);
    loadJournalComment(id);
    loadMuscuLogs(id);
    loadCurrentPrograms(id);
    loadMedia(id);
  }

  // Programme actuel (nutrition + muscu) : dernier envoyé, sinon le plus récent.
  async function loadCurrentPrograms(athleteId) {
    if (currentPrograms[athleteId]) return;
    const pick = list => {
      const arr = (list || []).slice().sort((a, b) =>
        new Date(b.sentAt || b.generatedAt || 0) - new Date(a.sentAt || a.generatedAt || 0));
      return arr.find(p => p.status === 'sent' || p.sentAt) || arr[0] || null;
    };
    const [nut, mus] = await Promise.all([
      fetch(`/api/coach/program?athleteId=${athleteId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/coach/muscu-program?athleteId=${athleteId}`).then(r => r.json()).catch(() => ({})),
    ]);
    setCurrentPrograms(prev => ({ ...prev, [athleteId]: { nutrition: pick(nut.programs), muscu: pick(mus.programs) } }));
  }

  // « Modifier / renvoyer » — recharge un programme existant dans l'éditeur.
  function editCurrentProgram(type) {
    const athlete = athletes.find(x => x.id === selectedId);
    if (!athlete) return;
    const cur = currentPrograms[selectedId];
    if (!cur) return;
    if (type === 'nutrition' && cur.nutrition) {
      setProgramError(null);
      setGeneratedProgram(cur.nutrition);
      setProgramModal(athlete);
    } else if (type === 'muscu' && cur.muscu) {
      setMuscuProgError(null);
      setGeneratedMuscuProg(cur.muscu);
      setMuscuModal(athlete);
    }
  }

  async function loadIntake(athleteId) {
    if (intakes[athleteId] !== undefined) return;
    const d = await fetch(`/api/coach/intake?athleteId=${athleteId}`).then(r=>r.json()).catch(()=>({}));
    setIntakes(prev => ({ ...prev, [athleteId]: d.intake || null }));
  }

  async function loadJournalComment(athleteId) {
    const today = new Date().toLocaleDateString('fr-CA');
    const key = `${athleteId}:${today}`;
    if (journalComments[key] !== undefined) return;
    const d = await fetch(`/api/coach/journal-comment?athleteId=${athleteId}&date=${today}`).then(r=>r.json()).catch(()=>({}));
    setJournalComments(prev => ({ ...prev, [key]: d.comment || '' }));
    setJournalCommentInput(prev => ({ ...prev, [key]: d.comment || '' }));
  }

  async function saveJournalComment(athleteId) {
    const today = new Date().toLocaleDateString('fr-CA');
    const key = `${athleteId}:${today}`;
    const comment = journalCommentInput[key] || '';
    await fetch('/api/coach/journal-comment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId, date: today, comment }) });
    setJournalComments(prev => ({ ...prev, [key]: comment }));
  }

  async function deleteJournalComment(athleteId) {
    const today = new Date().toLocaleDateString('fr-CA');
    const key = `${athleteId}:${today}`;
    await fetch('/api/coach/journal-comment', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId, date: today }) });
    setJournalComments(prev => ({ ...prev, [key]: '' }));
    setJournalCommentInput(prev => ({ ...prev, [key]: '' }));
  }

  if (!user) return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(120% 80% at 50% -10%, #111010, #0a0a0a 60%, #0c0c0c)", display:"flex", alignItems:"center", justifyContent:"center", color:"#8a8068", fontSize:"14px", letterSpacing:3 }}>
      CHARGEMENT…
    </div>
  );

  const FONT = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');`;

  return (
    <div className="cx-app" style={{ minHeight:"100vh", fontFamily:"var(--sans)", padding:"0 0 56px" }}>
      <style>{FONT}</style>
      <style>{`
        :root{
          --bg:#0b0b0a; --panel:#141312; --panel-2:#161513; --sunk:#100f0e; --sunk-2:#0c0b0a;
          --line:#272420; --line-soft:#211f1c; --line-gold:#3a3322;
          --gold:#c8b890; --cream:#f0e6c8; --gold-dim:#9a8f76;
          --green:#86c896; --amber:#d2ab6e; --red:#d28484; --blue:#7aa3da; --violet:#a596d0;
          --txt:#ece6da; --txt-2:#b4ad9e; --txt-3:#8a8474; --txt-4:#615c50;
          --sans:'DM Sans',-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
          --serif:'Playfair Display',serif;
          --r-lg:18px; --r-md:14px; --r-sm:11px;
          --sh-soft:0 1px 2px rgba(0,0,0,.35), 0 10px 30px -18px rgba(0,0,0,.6);
          --sh-card:0 1px 2px rgba(0,0,0,.4), 0 16px 40px -20px rgba(0,0,0,.7);
          --sh-pop:0 24px 70px -20px rgba(0,0,0,.8);
        }
        *{box-sizing:border-box}
        .cx-app{background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased;letter-spacing:.1px}

        /* type helpers (px so scale is real & enforced) */
        .t-eyebrow{font-size:11px;font-weight:500;letter-spacing:1.6px;text-transform:uppercase;color:var(--gold-dim);display:flex;align-items:center;gap:8px}
        .t-eyebrow.gold{color:var(--gold)}
        .t-eyebrow.amber{color:var(--amber)}
        .t-label{font-size:11.5px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:var(--txt-3)}

        /* ── Header ── */
        .cx-head{position:sticky;top:0;z-index:60;background:rgba(13,12,11,.86);backdrop-filter:blur(16px);
          border-bottom:1px solid var(--line);padding:18px 28px;display:flex;justify-content:space-between;align-items:center}
        .cx-head-logo{font-family:var(--serif);font-size:24px;font-weight:600;color:var(--cream);letter-spacing:.3px;line-height:1}
        .cx-head-sub{font-size:11px;color:var(--gold-dim);letter-spacing:2px;text-transform:uppercase;margin-top:6px}
        .cx-icon-btn{background:transparent;border:1px solid var(--line);border-radius:var(--r-sm);padding:9px 16px;
          color:var(--txt-2);font-family:var(--sans);font-size:13px;cursor:pointer;transition:.18s}
        .cx-icon-btn:hover{border-color:var(--line-gold);color:var(--gold)}

        /* ── Bascule de vue (tabs header) ── */
        .cx-tabs{display:flex;gap:4px;background:var(--sunk);border:1px solid var(--line);border-radius:var(--r-sm);padding:4px}
        .cx-tab{display:flex;align-items:center;background:transparent;border:none;border-radius:8px;padding:8px 16px;
          color:var(--txt-3);font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;transition:.16s;white-space:nowrap}
        .cx-tab:hover{color:var(--cream)}
        .cx-tab.sel{background:var(--gold);color:#1a1610;font-weight:600}

        /* ── Vue Messages (2 panneaux) ── */
        .cx-msg-shell{display:flex;gap:0;max-width:1380px;margin:0 auto;padding:32px 28px;align-items:stretch}
        .cx-msg-list{width:360px;flex-shrink:0;background:var(--panel);border:1px solid var(--line-soft);
          border-radius:var(--r-lg) 0 0 var(--r-lg);overflow:hidden;display:flex;flex-direction:column;
          max-height:calc(100vh - 140px)}
        .cx-msg-list-scroll{overflow-y:auto;flex:1}
        .cx-conv-row{display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;
          border-bottom:1px solid var(--line-soft);background:transparent;transition:background .14s;position:relative}
        .cx-conv-row:hover{background:#1a1815}
        .cx-conv-row.active{background:#1b1813}
        .cx-conv-row.active::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--gold)}
        .cx-conv-pane{flex:1;min-width:0;background:var(--panel);border:1px solid var(--line-soft);border-left:none;
          border-radius:0 var(--r-lg) var(--r-lg) 0;display:flex;flex-direction:column;max-height:calc(100vh - 140px)}
        .cx-conv-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
          color:var(--txt-3);font-size:14px;text-align:center;gap:12px;padding:40px}

        /* ── Layout ── */
        .cx-shell{display:flex;gap:28px;max-width:1380px;margin:0 auto;padding:32px 28px;align-items:flex-start}
        .cx-side{width:340px;flex-shrink:0;position:sticky;top:92px;max-height:calc(100vh - 112px);overflow-y:auto;padding-right:6px}
        .cx-main{flex:1;min-width:0}
        .cx-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;
          color:var(--txt-3);font-size:14px;text-align:center;line-height:1.7;gap:12px;
          background:var(--panel);border:1px solid var(--line-soft);border-radius:var(--r-lg)}

        /* ── Cards / sections ── */
        .cx-card{background:var(--panel);border:1px solid var(--line-soft);border-radius:var(--r-lg);box-shadow:var(--sh-soft)}
        .cx-pad{padding:20px}

        /* group separator inside the detail fiche */
        .cx-group-hd{display:flex;align-items:center;gap:14px;margin:30px 0 18px}
        .cx-group-hd .lbl{font-family:var(--serif);font-size:15px;font-weight:600;letter-spacing:.3px;color:var(--gold);white-space:nowrap}
        .cx-group-hd .ln{flex:1;height:1px;background:var(--line)}

        /* ── Sidebar athlete rows ── */
        .cx-row{display:flex;align-items:center;gap:14px;padding:14px 14px;border:1px solid transparent;
          border-radius:var(--r-sm);margin-bottom:6px;cursor:pointer;background:transparent;
          transition:background .16s,border-color .16s;position:relative}
        .cx-row:hover{background:#1a1815}
        .cx-row.sel{border-color:var(--line-gold);background:#1b1813}
        .cx-row.sel::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--gold)}
        .cx-av{width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
          font-family:var(--serif);font-size:16px;font-weight:600;color:var(--gold);
          background:#201d17;border:1px solid var(--line-gold)}
        .cx-row.sel .cx-av{color:var(--cream);background:#272219}

        /* ── Buttons ── */
        .cx-btn{font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;transition:.18s;border-radius:var(--r-sm)}
        .cx-btn-gold{background:var(--gold);color:#1a1610;border:none;font-weight:600}
        .cx-btn-gold:hover{background:var(--cream)}
        .cx-btn-ghost{background:transparent;border:1px solid var(--line);color:var(--txt-2)}
        .cx-btn-ghost:hover{border-color:var(--line-gold);color:var(--gold)}
        .cx-tile{background:transparent;border:1px solid var(--line);border-radius:var(--r-sm);
          font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;transition:.18s;text-align:center;color:var(--txt-2)}
        .cx-tile:hover{border-color:var(--line-gold);background:#1a1815}

        /* selectable chips (meals, goal, level, days, type filter…) */
        .cx-chip{background:transparent;border:1px solid var(--line);border-radius:var(--r-sm);
          font-family:var(--sans);font-size:13px;font-weight:500;color:var(--txt-3);cursor:pointer;transition:.16s;padding:9px 14px}
        .cx-chip:hover{border-color:var(--line-gold);color:var(--txt)}
        .cx-chip.sel{border-color:var(--gold);color:var(--gold);background:#1c1812}

        /* badges (unread count / "!" attention) */
        .cx-badge{display:flex;align-items:center;justify-content:center;border-radius:50%;
          font-size:11px;font-weight:700;flex-shrink:0}
        .cx-badge.gold{background:var(--gold);color:#15130d}
        .cx-badge.red{background:var(--red);color:#1a0e0e}

        /* sunk inner blocks + collapsibles */
        .cx-inner{background:var(--sunk);border:1px solid var(--line-soft);border-radius:var(--r-sm);transition:.16s}
        .cx-inner-pad{padding:16px 18px}
        .cx-collapse{width:100%;padding:16px 18px;background:transparent;border:1px solid var(--line-soft);
          color:var(--txt-2);font-family:var(--sans);font-size:13.5px;font-weight:500;cursor:pointer;text-align:left;
          display:flex;justify-content:space-between;align-items:center;transition:.16s}
        .cx-collapse:hover{border-color:var(--line-gold);color:var(--cream)}
        .cx-collapse .chev{color:var(--txt-3);font-size:12px}

        /* KPI stat tiles */
        .cx-kpi{flex:1;min-width:0;background:var(--sunk);border:1px solid var(--line-soft);border-radius:var(--r-sm);padding:18px 18px}
        .cx-kpi .k-lbl{font-size:11px;color:var(--txt-3);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:12px}
        .cx-kpi .k-val{font-family:var(--serif);font-size:30px;line-height:1;font-weight:600}
        .cx-kpi .k-sub{font-size:12px;color:var(--txt-3);margin-top:10px}

        /* progress bar */
        .cx-bar{height:6px;background:#211e1a;border-radius:4px;overflow:hidden}
        .cx-bar>i{display:block;height:100%;border-radius:4px;transition:width .4s ease}

        /* inputs */
        .cx-in{background:var(--sunk);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px;
          color:var(--txt);font-family:var(--sans);font-size:14px;outline:none;transition:.16s}
        .cx-in:focus{border-color:var(--gold)}
        .cx-in::placeholder{color:var(--txt-4)}

        /* modal shell + scrollbars */
        .cx-modal{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-pop)}
        .cx-side::-webkit-scrollbar,.cx-scroll::-webkit-scrollbar{width:8px}
        .cx-side::-webkit-scrollbar-thumb,.cx-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px;border:2px solid transparent;background-clip:padding-box}
        .cx-side::-webkit-scrollbar-thumb:hover,.cx-scroll::-webkit-scrollbar-thumb:hover{background:var(--line-gold);background-clip:padding-box}

        @keyframes cxIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .cx-fiche{animation:cxIn .28s ease both}

        @media(max-width:880px){
          .cx-shell{flex-direction:column;padding:20px 16px;gap:18px}
          .cx-side{width:100%;position:static;max-height:none}
          .cx-head{padding:16px 18px}
          .cx-fiche-head{flex-direction:column;align-items:flex-start;gap:18px}
          .cx-fiche-stats{align-self:stretch;justify-content:space-between;gap:14px}
          .cx-actions{flex-wrap:wrap}
          .cx-actions>button{flex:1 1 calc(50% - 5px);min-width:0}
          .cx-msg-shell{flex-direction:column;padding:16px;gap:14px}
          .cx-msg-list{width:100%;border-radius:var(--r-lg);max-height:46vh}
          .cx-conv-pane{border-left:1px solid var(--line-soft);border-radius:var(--r-lg);max-height:60vh}
        }
      `}</style>

      {/* Header */}
      <div className="cx-head">
        <div style={{ display:"flex", alignItems:"center", gap:13 }}>
          <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--serif)", fontSize:"22px", fontWeight:600, color:"var(--gold)",
            background:"#1a1712", border:"1px solid var(--line-gold)" }}>N</div>
          <div>
            <div className="cx-head-logo">Espace Coach</div>
            <div className="cx-head-sub">{user.name}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {/* Bascule de vue : Athlètes / Messages */}
          <div className="cx-tabs">
            <button onClick={()=>setView('athletes')} className={`cx-tab${view==='athletes'?' sel':''}`}>
              Athlètes
              {(() => { const m = athletes.reduce((s,a)=>s+(a.mediaUnseen||0),0); return m>0 ? (
                <span className="cx-badge" title="Nouveaux suivis photo/vidéo" style={{ minWidth:18, height:18, padding:"0 5px", marginLeft:8, background:"#3a2f1a", color:"var(--gold)", border:"1px solid var(--line-gold)" }}>📸 {m}</span>
              ) : null; })()}
            </button>
            <button onClick={()=>setView('messages')} className={`cx-tab${view==='messages'?' sel':''}`}>
              Messages
              {(() => { const total = Object.values(chatUnread).reduce((s,n)=>s+(n||0),0); return total>0 ? (
                <span className="cx-badge red" style={{ minWidth:18, height:18, padding:"0 5px", marginLeft:8 }}>{total}</span>
              ) : null; })()}
            </button>
            <button onClick={()=>{ setView('profil'); loadProfile(); }} className={`cx-tab${view==='profil'?' sel':''}`}>Mon compte</button>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={refreshAthletes} className="cx-icon-btn" title="Rafraîchir">↻</button>
            <button onClick={async()=>{ await fetch('/api/auth/logout',{method:'POST'}); router.push('/login'); }} className="cx-icon-btn">Déconnexion</button>
          </div>
        </div>
      </div>

      {view === 'athletes' && (
      <div className="cx-shell">
        <aside className="cx-side">

        {/* Bannière notifications */}
        {notifPermission === 'default' && (
          <div className="cx-card" style={{ borderColor:"var(--line-gold)", padding:"18px 20px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", gap:14 }}>
            <div>
              <div style={{ fontSize:"14px", fontWeight:500, color:"var(--cream)" }}>Activer les notifications</div>
              <div style={{ fontSize:"12.5px", color:"var(--txt-3)", marginTop:5, lineHeight:1.5 }}>Messages, bilans, programmes</div>
            </div>
            <button onClick={enableCoachNotifications} className="cx-btn cx-btn-gold"
              style={{ padding:"10px 18px", fontSize:"13px", whiteSpace:"nowrap" }}>
              Activer
            </button>
          </div>
        )}
        {notifPermission === 'granted' && (
          <div style={{ fontSize:"11px", color:"var(--green)", textAlign:"center", marginBottom:14, letterSpacing:1.5, textTransform:"uppercase" }}>● Notifications actives</div>
        )}

        {/* Inviter un élève */}
        <div className="cx-card cx-pad" style={{ marginBottom:18 }}>
          <div className="t-eyebrow" style={{ marginBottom:13 }}>✦ Inviter un élève</div>

          {/* Recommandé : par email → l'élève est rattaché automatiquement à l'inscription (jamais de version solo). */}
          <div style={{ fontSize:"12px", color:"var(--txt-3)", marginBottom:8 }}>Par email <span style={{ color:"var(--txt-4)" }}>· recommandé, rattachement auto</span></div>
          <div style={{ display:"flex", gap:8, marginBottom: emailInviteMsg?8:14 }}>
            <input value={emailInvite} onChange={e=>setEmailInvite(e.target.value)} placeholder="email de l'élève" type="email" className="cx-in" style={{ flex:1 }}/>
            <button onClick={sendEmailInvite} disabled={sendingEmailInvite} className="cx-btn"
              style={{ padding:"9px 15px", background:"#1f1b13", border:"1px solid var(--line-gold)", color:"var(--gold)", fontSize:"13.5px", whiteSpace:"nowrap" }}>
              {sendingEmailInvite ? "…" : "Inviter"}
            </button>
          </div>
          {emailInviteMsg && <div style={{ fontSize:"12px", color: emailInviteMsg.ok?"var(--gold)":"#e07a7a", marginBottom:14, lineHeight:1.5 }}>{emailInviteMsg.text}</div>}

          <div style={{ fontSize:"12px", color:"var(--txt-3)", marginBottom:8 }}>Ou par code / lien</div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input value={inviteLabel} onChange={e=>setInviteLabel(e.target.value)} placeholder="Nom de l'élève (optionnel)" className="cx-in"
              style={{ flex:1 }}/>
            <button onClick={generateInvite} disabled={generatingInvite} className="cx-btn"
              style={{ padding:"9px 15px", background:"#1f1b13", border:"1px solid var(--line-gold)", color:"var(--gold)", fontSize:"13.5px", whiteSpace:"nowrap" }}>
              {generatingInvite ? "…" : "Générer"}
            </button>
          </div>

          {/* Résultat de la dernière invitation générée */}
          {lastInvite && (
            <div style={{ background:"var(--sunk)", border:"1px solid var(--line-gold)", borderRadius:"var(--r-sm)", padding:"18px 16px", marginBottom:14 }}>
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <span style={{ fontFamily:"var(--serif)", fontSize:"32px", fontWeight:600, color:"var(--cream)", letterSpacing:"0.18em" }}>{lastInvite.token}</span>
              </div>
              <button onClick={()=>copyInviteLink(lastInvite.token)} className="cx-btn cx-btn-gold"
                style={{ width:"100%", padding:"12px 0", fontSize:"13.5px" }}>
                {copied===`link-${lastInvite.token}` ? "✓ Lien copié" : "Partager l'invitation"}
              </button>
              <div style={{ fontSize:"12px", color:"var(--txt-3)", marginTop:12, textAlign:"center", lineHeight:1.5 }}>
                Le lien contient le code — l'athlète crée son compte ou le saisit dans l'app.<br/>
                <span style={{ color:"var(--txt-4)" }}>Usage unique · expire dans 7 jours</span>
              </div>
            </div>
          )}

          {/* Historique */}
          <button onClick={()=>setInvitesOpen(o=>!o)}
            style={{ background:"none", border:"none", color:"var(--txt-3)", fontSize:"13px", cursor:"pointer", padding:0 }}>
            {invitesOpen ? "Masquer l'historique" : "Voir l'historique"}
          </button>
          {invitesOpen && (
            <div style={{ marginTop:14 }}>
              {invites.length === 0 && <div style={{ fontSize:"13px", color:"var(--txt-4)" }}>Aucune invitation générée.</div>}
              {invites.map(inv => {
                const used = !!inv.usedAt;
                const expired = inv.expired || new Date(inv.expiresAt) < new Date();
                const statusColor = used ? "var(--green)" : expired ? "var(--txt-4)" : "var(--gold)";
                const statusLabel = used ? "Utilisé" : expired ? "Expiré" : "Actif";
                return (
                  <div key={inv.token} style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 0", borderBottom:"1px solid var(--line-soft)" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"13px", color:"var(--txt-2)" }}>
                        <span style={{ color:"var(--gold)", letterSpacing:"0.08em", marginRight:8 }}>{inv.token}</span>
                        {inv.label && <span style={{ color:"var(--txt-3)" }}>{inv.label} · </span>}
                        <span style={{ color: statusColor }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize:"11.5px", color:"var(--txt-4)", marginTop:3 }}>
                        {new Date(inv.createdAt).toLocaleDateString('fr-FR')} → exp. {new Date(inv.expiresAt).toLocaleDateString('fr-FR')}
                        {used && inv.usedAt && ` · utilisé le ${new Date(inv.usedAt).toLocaleDateString('fr-FR')}`}
                      </div>
                    </div>
                    {!used && !expired && (
                      <button onClick={()=>copyInviteLink(inv.token)}
                        style={{ background:"transparent", border:"1px solid var(--line-gold)", borderRadius:7, padding:"5px 11px", color: copied===`link-${inv.token}`?"var(--green)":"var(--gold)", fontSize:"11px", cursor:"pointer", whiteSpace:"nowrap" }}>
                        {copied===`link-${inv.token}` ? "✓ Copié" : "Copier le lien"}
                      </button>
                    )}
                    {!used && (
                      <button onClick={()=>revokeInvite(inv.token)}
                        style={{ background:"none", border:"none", color:"var(--txt-4)", fontSize:"15px", cursor:"pointer", padding:"2px 4px" }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Bibliothèque de programmes ─── */}
        <div className="cx-card cx-pad" style={{ marginBottom:18 }}>
          <button onClick={()=>setTemplatesOpen(o=>!o)} style={{ width:"100%", background:"none", border:"none", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:0 }}>
            <div className="t-eyebrow gold">📚 Bibliothèque{templates.length>0 && <span style={{ color:"var(--txt-3)" }}> · {templates.length}</span>}</div>
            <span style={{ fontSize:"12px", color:"var(--txt-4)" }}>{templatesOpen?"▲":"▼"}</span>
          </button>
          {templatesOpen && (() => {
            const filtered = templates
              .filter(t => libFilter==='all' || t.type===libFilter)
              .filter(t => !libSearch.trim() || (t.name||'').toLowerCase().includes(libSearch.trim().toLowerCase()));
            const selName = selectedId ? (athletes.find(x=>x.id===selectedId)?.name || '') : '';
            return (
            <div style={{ marginTop:16 }}>
              {/* Recherche */}
              <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="Rechercher un modèle…" className="cx-in"
                style={{ width:"100%", marginBottom:12 }}/>
              {/* Filtre par type */}
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                {[{k:'all',l:'Tous'},{k:'nutrition',l:'Nutrition'},{k:'muscu',l:'Muscu'}].map(f=>(
                  <button key={f.k} onClick={()=>setLibFilter(f.k)} className={`cx-chip${libFilter===f.k?' sel':''}`} style={{ flex:1, padding:"8px 0" }}>{f.l}</button>
                ))}
              </div>
              {/* Hint cible */}
              <div style={{ fontSize:"11.5px", color: selectedId?"var(--txt-3)":"var(--amber)", marginBottom:12, lineHeight:1.5 }}>
                {selectedId ? <>Appliquer sur · <span style={{ color:"var(--gold)" }}>{selName}</span></> : "Sélectionne d'abord un athlète pour appliquer"}
              </div>
              {/* Liste */}
              {filtered.length === 0 ? (
                <div style={{ fontSize:"13px", color:"var(--txt-3)", textAlign:"center", padding:"20px 0", lineHeight:1.6, whiteSpace:"pre-line" }}>
                  {templates.length===0 ? "Aucun modèle enregistré.\nGénère un programme puis « Sauver »." : "Aucun modèle ne correspond."}
                </div>
              ) : filtered.map(t => (
                <div key={t.id} style={{ padding:"13px 0", borderBottom:"1px solid var(--line-soft)" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ fontSize:"17px", lineHeight:1.3 }}>{t.type==='nutrition'?'🥗':'💪'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"var(--serif)", fontSize:"15px", fontWeight:600, color:"var(--cream)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</div>
                      <div style={{ fontSize:"11.5px", color:"var(--txt-4)", marginTop:3 }}>{t.type==='nutrition'?'Nutrition':'Muscu'} · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</div>
                      {t.description && <div style={{ fontSize:"12px", color:"var(--txt-3)", marginTop:5, lineHeight:1.5 }}>{t.description}</div>}
                    </div>
                    <button onClick={()=>deleteTemplate(t.id)} title="Supprimer" style={{ background:"none", border:"none", color:"var(--txt-4)", fontSize:"15px", cursor:"pointer", padding:"2px 4px", lineHeight:1 }}>🗑</button>
                  </div>
                  <button onClick={()=>applyTemplateFromLibrary(t)} disabled={!selectedId || libApplying===t.id}
                    className="cx-btn" style={{ width:"100%", marginTop:10, padding:"9px 0", background:"transparent",
                      border:`1px solid ${selectedId? "var(--line-gold)" : "var(--line)"}`,
                      color: selectedId ? (t.type==='nutrition'?"var(--green)":"var(--violet)") : "var(--txt-4)",
                      fontSize:"12.5px", cursor: selectedId?"pointer":"not-allowed", opacity:libApplying===t.id?0.6:1 }}>
                    {libApplying===t.id ? "Application…" : "Appliquer"}
                  </button>
                </div>
              ))}
            </div>
            );
          })()}
        </div>

        {/* Période rapport */}
        <div style={{ display:"flex", gap:8, marginBottom:20, alignItems:"center" }}>
          <div className="t-label" style={{ marginRight:4 }}>Rapport</div>
          {[7,30,90].map(d=>(
            <button key={d} onClick={()=>setReportDays(d)} className="cx-tile"
              style={{ flex:1, padding:"9px", fontSize:"13px", ...(reportDays===d ? { borderColor:"var(--gold)", color:"var(--gold)" } : {}) }}>
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
            if (a.mediaUnseen > 0) items.push({ name: a.name, id: a.id, msg: `${a.mediaUnseen} suivi photo/vidéo à voir`, level: 'info' });
            return items;
          });
          if (flags.length === 0) return null;
          return (
            <div className="cx-card cx-pad" style={{ marginBottom:20 }}>
              <div className="t-eyebrow amber" style={{ marginBottom:16 }}>À surveiller · {flags.length} alerte{flags.length>1?'s':''}</div>
              {flags.map((f, i) => (
                <div key={i} onClick={()=>selectAthlete(f.id)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom: i<flags.length-1?"1px solid var(--line-soft)":"none", cursor:"pointer" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background: f.level==='bad'?"var(--red)":f.level==='warn'?"var(--amber)":"var(--blue)" }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"14px", color:"var(--txt)" }}>{f.name}</div>
                    <div style={{ fontSize:"12.5px", color:"var(--txt-3)", marginTop:2 }}>{f.msg}</div>
                  </div>
                  <span style={{ fontSize:"14px", color:"var(--txt-4)" }}>→</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Liste compacte des athlètes (sidebar) */}
        <div className="t-label" style={{ margin:"10px 2px 12px" }}>Athlètes · {athletes.length}</div>
        {!loading && athletes.length > 0 && (
          <>
            <input value={athleteSearch} onChange={e=>setAthleteSearch(e.target.value)} placeholder="Rechercher un athlète…" className="cx-in"
              style={{ width:"100%", marginBottom:10 }}/>
            <div style={{ display:"flex", gap:6, marginBottom:14 }}>
              {[{k:'alert',l:'Alerte'},{k:'inactive',l:'Inactifs'},{k:'az',l:'A-Z'}].map(s=>(
                <button key={s.k} onClick={()=>setAthleteSort(s.k)} className={`cx-chip${athleteSort===s.k?' sel':''}`} style={{ flex:1, padding:"7px 0", fontSize:"12px" }}>{s.l}</button>
              ))}
            </div>
          </>
        )}
        {loading ? (
          <div style={{ color:"var(--txt-4)", fontSize:"13.5px", padding:"12px 0" }}>Chargement…</div>
        ) : athletes.length === 0 ? (
          <div style={{ color:"var(--txt-4)", fontSize:"13px", padding:"12px 0", lineHeight:1.8 }}>Aucun élève lié.<br/>Partage ton code.</div>
        ) : (() => {
          const isFlagged = a => !!a.alert || (a.blood?.abnormal?.length > 0) || a.activeDays7j <= 2;
          let list = athletes.filter(a => !athleteSearch.trim() || (a.name||'').toLowerCase().includes(athleteSearch.trim().toLowerCase()));
          list = list.slice().sort((a, b) => {
            if (athleteSort === 'az') return (a.name||'').localeCompare(b.name||'');
            if (athleteSort === 'inactive') return (a.activeDays7j||0) - (b.activeDays7j||0);
            // alerte d'abord
            const fa = isFlagged(a) ? 0 : 1, fb = isFlagged(b) ? 0 : 1;
            if (fa !== fb) return fa - fb;
            return (a.activeDays7j||0) - (b.activeDays7j||0);
          });
          if (list.length === 0) return <div style={{ color:"var(--txt-3)", fontSize:"13px", padding:"12px 2px" }}>Aucun athlète ne correspond.</div>;
          return list.map(a => {
            const sel = selectedId===a.id;
            const actColor = a.activeDays7j>=5?"var(--green)":a.activeDays7j>=3?"var(--amber)":"var(--red)";
            return (
            <div key={a.id} className={`cx-row${sel?' sel':''}`} onClick={()=>selectAthlete(a.id)}>
              <div className="cx-av">{(a.name||'?').trim().charAt(0).toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"15px", color: sel?"var(--cream)":"var(--txt)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
                <div style={{ fontSize:"11px", color:"var(--txt-3)", marginTop:4, display:"flex", alignItems:"center", gap:6 }}>
                  <span>{a.avgKcal7j} kcal/j</span>
                  <span style={{ color:"var(--line-gold)" }}>·</span>
                  <span style={{ color:actColor }}>{a.activeDays7j}/7 actifs</span>
                </div>
              </div>
              {a.alert && <span title={a.alert} style={{ width:7, height:7, borderRadius:"50%", background:"var(--amber)", flexShrink:0 }}/>}
              {a.mediaUnseen > 0 && <span className="cx-badge" title="Nouveau suivi photo/vidéo" style={{ minWidth:18, height:18, padding:"0 5px", background:"#3a2f1a", color:"var(--gold)", border:"1px solid var(--line-gold)" }}>📸 {a.mediaUnseen}</span>}
              {chatUnread[a.id] > 0 && <span className="cx-badge red" style={{ minWidth:18, height:18, padding:"0 4px" }}>{chatUnread[a.id]}</span>}
            </div>
            );
          });
        })()}

        </aside>

        <main className="cx-main">
        {loading ? (
          <div className="cx-empty">Chargement…</div>
        ) : athletes.length === 0 ? (
          <div className="cx-empty"><div style={{ fontSize:"36px", marginBottom:6 }}>🫂</div><div style={{ fontFamily:"var(--serif)", fontSize:"22px", color:"var(--gold-dim)" }}>Aucun élève lié</div>Partage ton code d'invitation pour ajouter un athlète.</div>
        ) : !selectedId ? (
          <div className="cx-empty"><div style={{ fontSize:"36px", marginBottom:6 }}>📋</div><div style={{ fontFamily:"var(--serif)", fontSize:"22px", color:"var(--gold-dim)" }}>Sélectionne un athlète</div>Choisis un athlète à gauche pour voir son suivi détaillé.</div>
        ) : athletes.filter(a => a.id === selectedId).map(a => {
          const kcalPct = a.goalKcal > 0 ? Math.min(100, Math.round(a.todayKcal / a.goalKcal * 100)) : 0;
          const avg7Pct = a.goalKcal > 0 ? Math.round(a.avgKcal7j / a.goalKcal * 100) : 0;
          const protPct = a.goalProtein > 0 ? Math.min(100, Math.round(a.avgProtein7j / a.goalProtein * 100)) : 0;
          return (
            <div key={a.id} className="cx-fiche cx-card" style={{ border:`1px solid ${a.alert?"#4a3128":"var(--line-soft)"}`, borderRadius:"var(--r-lg)", marginBottom:12, boxShadow:"var(--sh-card)", overflow:"hidden" }}>

              {/* ── (1) En-tête de la fiche ── */}
              <div style={{ padding:"26px 28px 24px" }}>
                <div className="cx-fiche-head" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:22 }}>
                  {/* Gauche : avatar + nom + email */}
                  <div style={{ display:"flex", gap:16, minWidth:0, flex:1, alignItems:"center" }}>
                    <div className="cx-av" style={{ width:54, height:54, fontSize:"26px", borderRadius:"50%" }}>{(a.name||'?').trim().charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontFamily:"var(--serif)", fontSize:"28px", fontWeight:600, color:"var(--cream)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.1 }}>{a.name}</div>
                      <div style={{ fontSize:"13px", color:"var(--txt-3)", marginTop:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.email}</div>
                      {a.alert && (
                        <div style={{ display:"inline-block", fontSize:"12px", color:"var(--red)", background:"#1c1010", border:"1px solid #4a2a2a", borderRadius:6, padding:"3px 9px", marginTop:8 }}>
                          {a.alert}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Droite : 3 stats compactes */}
                  <div className="cx-fiche-stats" style={{ display:"flex", alignItems:"flex-start", gap:24, flexShrink:0 }}>
                    {[
                      { v:`${kcalPct}%`, l:"Aujourd'hui", c: kcalPct>90?"var(--green)":kcalPct>60?"var(--amber)":"var(--red)" },
                      { v:`${avg7Pct}%`, l:"Moy 7j", c: avg7Pct>85&&avg7Pct<115?"var(--green)":"var(--amber)" },
                      { v:`${a.activeDays7j}/7`, l:"Actifs", c: a.activeDays7j>=5?"var(--green)":a.activeDays7j>=3?"var(--amber)":"var(--red)" },
                    ].map((s,i)=>(
                      <div key={i} style={{ textAlign:"right", minWidth:36 }}>
                        <div style={{ fontFamily:"var(--serif)", fontSize:"26px", color:s.c, fontWeight:600, lineHeight:1 }}>{s.v}</div>
                        <div style={{ fontSize:"11px", color:"var(--txt-3)", letterSpacing:.8, marginTop:6, textTransform:"uppercase" }}>{s.l}</div>
                      </div>
                    ))}
                    {chatUnread[a.id] > 0 && (
                      <div className="cx-badge red" style={{ width:20, height:20 }}>{chatUnread[a.id]}</div>
                    )}
                  </div>
                </div>
                {/* Barre progression aujourd'hui */}
                <div className="cx-bar">
                  <i style={{ width:`${kcalPct}%`, background: kcalPct>100?"var(--red)":kcalPct>70?"var(--green)":"var(--amber)" }}/>
                </div>
              </div>

              {/* ── Corps ── */}
              <div style={{ padding:"0 28px 28px", borderTop:"1px solid var(--line-soft)" }}>

                  {/* Stats 7j */}
                  <div style={{ display:"flex", gap:14, marginTop:24 }}>
                    <div className="cx-kpi">
                      <div className="k-lbl">Moy kcal · 7j</div>
                      <div className="k-val" style={{ color: avg7Pct>85&&avg7Pct<115?"var(--green)":"var(--amber)" }}>{a.avgKcal7j}</div>
                      <div className="k-sub">objectif {a.goalKcal}</div>
                    </div>
                    <div className="cx-kpi">
                      <div className="k-lbl">Protéines moy</div>
                      <div className="k-val" style={{ color: protPct>85?"var(--green)":"var(--red)" }}>{a.avgProtein7j}g</div>
                      <div className="k-sub">objectif {a.goalProtein}g</div>
                    </div>
                    <div className="cx-kpi">
                      <div className="k-lbl">Jours actifs</div>
                      <div className="k-val" style={{ color:"var(--gold)" }}>{a.activeDays7j}<span style={{ fontSize:"16px", color:"var(--txt-4)" }}>/7</span></div>
                      <div className="k-sub">7 derniers jours</div>
                    </div>
                  </div>

                  {/* ── (2) Nutrition & Poids ── */}
                  <div className="cx-group-hd"><span className="lbl">Nutrition &amp; Poids</span><span className="ln"/></div>

                  {/* Tendance kcal 7j (sparkline) */}
                  {Array.isArray(a.kcalSeries) && a.kcalSeries.filter(v=>typeof v==='number').length >= 2 && (
                    <div className="cx-inner" style={{ padding:"18px 20px", marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
                        <span className="t-eyebrow">Tendance kcal</span>
                        <span style={{ fontSize:"11.5px", color:"var(--txt-3)" }}>kcal/jour · 7 jours</span>
                      </div>
                      <Sparkline values={a.kcalSeries} goal={a.goalKcal} color="#c8b890" height={72} />
                      {a.goalKcal > 0 && (
                        <div style={{ fontSize:"11px", color:"var(--txt-4)", marginTop:8, display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ display:"inline-block", width:14, height:0, borderTop:"1px dashed #5a5446" }} /> objectif {a.goalKcal} kcal
                        </div>
                      )}
                    </div>
                  )}

                  {/* Poids */}
                  {a.lastWeight && (() => {
                    const wpts = (measurements[a.id] || [])
                      .filter(m => m.weight != null)
                      .slice().sort((x,y) => new Date(x.date) - new Date(y.date))
                      .map(m => m.weight);
                    // Sémantique selon l'objectif : prendre du poids est FAVORABLE en prise de masse, défavorable en perte.
                    const md = (a.mode || '').toLowerCase();
                    const gaining = md.includes('mass') || md === 'gain';
                    const losing = md.includes('pert') || md === 'loss';
                    const tr = a.weightTrend;
                    let trendCol = 'var(--txt-3)', trendBd = 'var(--line)', sparkCol = '#c8b890';
                    if (tr !== null && tr !== 0 && (gaining || losing)) {
                      const good = gaining ? tr > 0 : tr < 0;
                      trendCol = good ? 'var(--green)' : 'var(--red)';
                      trendBd = good ? '#2a5a2a' : '#5a2a2a';
                      sparkCol = good ? '#86c896' : '#d28484';
                    }
                    return (
                    <div className="cx-inner" style={{ padding:"18px 20px", marginBottom:16 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                        <span style={{ fontFamily:"var(--serif)", fontSize:"26px", fontWeight:600, color:"var(--cream)" }}>{a.lastWeight}<span style={{ fontSize:"14px", fontFamily:"var(--sans)", color:"var(--txt-3)", marginLeft:4 }}>kg</span></span>
                        {a.weightTrend !== null && (
                          <span style={{ fontSize:"13px", color: trendCol, border:`1px solid ${trendBd}`, borderRadius:7, padding:"4px 11px" }}>
                            {a.weightTrend > 0 ? '+' : ''}{a.weightTrend} kg{md ? <span style={{ color:"var(--txt-4)", marginLeft:6 }}>· {gaining ? 'prise de masse' : losing ? 'perte' : 'maintien'}</span> : null}
                          </span>
                        )}
                      </div>
                      {wpts.length >= 2 && (
                        <div style={{ marginTop:14 }}>
                          <Sparkline values={wpts} color={sparkCol} height={64} />
                          <div style={{ fontSize:"11px", color:"var(--txt-4)", marginTop:6 }}>poids · {wpts.length} relevés</div>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* ── (3) Entraînement & Récupération ── */}
                  <div className="cx-group-hd"><span className="lbl">Entraînement &amp; Récupération</span><span className="ln"/></div>

                  {/* Séances Strava (7 j) — carte détaillée par séance */}
                  {a.strava?.sessions?.length > 0 && (() => {
                    const sess = a.strava.sessions;
                    const isRide = (t) => /ride|vélo|velo|cycl|bike|vtt/i.test(`${t?.type || ''} ${t?.typeLabel || ''}`);
                    const fmtDur = (sec) => {
                      if (sec == null) return null;
                      const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
                      return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m} min`;
                    };
                    const fmtPace = (s, ride) => {
                      if (s.avg_speed == null || s.avg_speed <= 0) return null;
                      if (ride) return { v:`${(s.avg_speed * 3.6).toFixed(1)} km/h`, l:'Vitesse' };
                      const secPerKm = 1000 / s.avg_speed;
                      const mm = Math.floor(secPerKm / 60), ss = Math.round(secPerKm % 60);
                      return { v:`${mm}:${String(ss).padStart(2,'0')}/km`, l:'Allure' };
                    };
                    const totalElev = sess.reduce((t,s) => t + (s.elevation_gain || 0), 0);
                    const totalLoad = sess.reduce((t,s) => t + (s.suffer_score || 0), 0);
                    return (
                    <div className="cx-inner" style={{ padding:"20px", marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                        <span className="t-eyebrow">🏃 Séances Strava (7 j)</span>
                        {(() => { const s = timeAgo(a.strava.updatedAt); return s ? (
                          <span style={{ fontSize:"11px", color: s.stale ? "var(--amber)" : "var(--txt-4)" }}>Synchronisé {s.label}</span>
                        ) : null; })()}
                      </div>
                      {/* Résumé 7j */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"14px 24px", paddingBottom:16, marginBottom:16, borderBottom:"1px solid var(--line-soft)" }}>
                        <RecStat label="Séances 7j" value={sess.length} />
                        {totalElev > 0 && <RecStat label="Dénivelé tot." value={`${Math.round(totalElev)} m`} />}
                        {totalLoad > 0 && <RecStat label="Charge cumulée" value={Math.round(totalLoad)} />}
                      </div>
                      {/* Une mini-carte par séance */}
                      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                        {sess.map((s, i) => {
                          const ride = isRide(s);
                          const pace = fmtPace(s, ride);
                          const metrics = [
                            fmtDur(s.duration) && { l:'Durée', v: fmtDur(s.duration) },
                            s.distance != null && { l:'Distance', v:`${(s.distance / 1000).toFixed(1)} km` },
                            pace && { l: pace.l, v: pace.v },
                            s.elevation_gain != null && s.elevation_gain > 0 && { l:'Dénivelé', v:`${Math.round(s.elevation_gain)} m` },
                            s.avg_hr != null && { l:'FC moy', v:`${Math.round(s.avg_hr)} bpm` },
                            s.max_hr != null && { l:'FC max', v:`${Math.round(s.max_hr)} bpm` },
                            s.avg_cadence != null && { l:'Cadence', v: Math.round(s.avg_cadence) },
                            s.avg_watts != null && { l:'Puissance', v:`${Math.round(s.avg_watts)} W` },
                            s.suffer_score != null && { l:'Effort rel.', v: Math.round(s.suffer_score) },
                            s.caloriesAdjusted != null && { l:'Calories', v:`${Math.round(s.caloriesAdjusted)} kcal` },
                          ].filter(Boolean);
                          return (
                            <div key={s.id ?? i} style={{ padding:"14px 16px", borderRadius:10, background:"var(--line-soft)" }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:12 }}>
                                <div style={{ minWidth:0 }}>
                                  <span style={{ fontSize:"14px", color:"var(--gold)" }}>{s.typeLabel || s.type}</span>
                                  {s.name && <span style={{ fontSize:"13px", color:"var(--txt-3)", marginLeft:8 }}>{s.name}</span>}
                                </div>
                                <span style={{ fontSize:"11px", color:"var(--txt-4)", whiteSpace:"nowrap" }}>{s.date}</span>
                              </div>
                              {metrics.length > 0 && (
                                <div style={{ display:"flex", flexWrap:"wrap", gap:"12px 20px" }}>
                                  {metrics.map((m, j) => <RecStat key={j} label={m.l} value={m.v} />)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Récupération (santé objet connecté : sommeil, FC, etc.) — affiché seulement s'il y a au moins une vraie valeur */}
                  {a.recovery && (a.recovery.sleep != null || a.recovery.restingHR != null || a.recovery.avgHR != null || a.recovery.maxHR != null || a.recovery.hrv != null || a.recovery.spo2 != null || a.recovery.steps != null) && (
                    <div className="cx-inner" style={{ border:`1px solid ${a.recovery.flag==='low'?'#5a2a2a':a.recovery.flag==='warn'?'#5a4a2a':'var(--line-soft)'}`, padding:"20px", marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 4 }}>
                        <span className="t-eyebrow">💤 Récupération</span>
                        <span style={{ fontSize:"11.5px", color: a.recovery.flag==='low'?'var(--red)':a.recovery.flag==='warn'?'var(--amber)':'var(--green)' }}>
                          {a.recovery.flag==='low'?'● faible':a.recovery.flag==='warn'?'● à surveiller':'● bonne'}
                        </span>
                      </div>
                      {(() => { const s = timeAgo(a.recovery.syncedAt); return s ? (
                        <div style={{ fontSize:"11px", color: s.stale ? "var(--amber)" : "var(--txt-4)", marginBottom:12 }}>Synchronisé {s.label}</div>
                      ) : <div style={{ marginBottom:8 }} />; })()}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"14px 20px" }}>
                        {a.recovery.sleep != null && <RecStat label="Sommeil" value={`${a.recovery.sleep} h`} />}
                        {a.recovery.sleepStages && (() => { const s=a.recovery.sleepStages; const t=(s.deep||0)+(s.light||0)+(s.rem||0); return t>0 ? <RecStat label="Profond" value={`${Math.round(s.deep/t*100)}%`} /> : null; })()}
                        {a.recovery.restingHR != null && <RecStat label="FC repos" value={`${a.recovery.restingHR} bpm`} />}
                        {a.recovery.avgHR != null && <RecStat label="FC moy" value={`${a.recovery.avgHR} bpm`} />}
                        {a.recovery.maxHR != null && <RecStat label="FC max" value={`${a.recovery.maxHR} bpm`} />}
                        {a.recovery.hrv != null && <RecStat label="HRV" value={`${a.recovery.hrv} ms`} />}
                        {a.recovery.spo2 != null && <RecStat label="SpO₂" value={`${a.recovery.spo2}%`} />}
                        {a.recovery.steps != null && <RecStat label="Pas/j" value={a.recovery.steps.toLocaleString('fr-FR')} />}
                      </div>
                    </div>
                  )}

                  {/* Bilan sanguin */}
                  {a.blood && (
                    <div className="cx-inner" style={{ border:`1px solid ${a.blood.pendingCoachValidation ? "#a89050" : "var(--line-soft)"}`, padding:"20px", marginBottom:14, ...(a.blood.pendingCoachValidation ? { boxShadow:"0 0 0 1px rgba(168,144,80,.2)" } : {}) }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:11 }}>
                        <div className="t-eyebrow" style={{ color: a.blood.pendingCoachValidation ? "#c8a060" : "var(--txt-3)" }}>
                          🩸 {a.blood.pendingCoachValidation ? "Bilan à valider" : "Bilan sanguin"}
                        </div>
                        <div style={{ fontSize:"12px", color:"var(--txt-4)" }}>{a.blood.date || '—'}</div>
                      </div>
                      <div style={{ fontSize:"14px", color:"var(--gold)", marginBottom:8, lineHeight:1.6 }}>{a.blood.reportType}</div>
                      {a.blood.pendingCoachValidation ? (
                        <>
                          <div style={{ fontSize:"11px", color:"#a89050", letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>✎ Analyse (modifiable avant validation)</div>
                          <Ed block
                            value={bloodEdits[a.id]?.summary ?? a.blood.summary ?? ''}
                            onChange={v => setBloodEdits(p => ({ ...p, [a.id]: { ...p[a.id], summary: v } }))}
                            style={{ fontSize:"13px", color:"var(--gold)", lineHeight:1.6, marginBottom:8, borderBottom:"1px dashed #3a3520", width:"100%" }} />
                        </>
                      ) : (a.blood.summary && (
                        <div style={{ fontSize:"13px", color:"var(--txt-2)", lineHeight:1.6, marginBottom: a.blood.abnormal?.length > 0 ? 11 : 0 }}>{a.blood.summary}</div>
                      ))}
                      {a.blood.abnormal?.length > 0 && (
                        <div>
                          <div style={{ fontSize:"11px", color:"var(--txt-4)", letterSpacing:1, textTransform:"uppercase", marginBottom:7 }}>Marqueurs anormaux</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                            {a.blood.abnormal.map((m, i) => (
                              <div key={i} style={{ background: m.status==='bad'?"#1c0f0f":"#1a1605", border:`1px solid ${m.status==='bad'?"#5a2a2a":"#5a4a1a"}`, borderRadius:7, padding:"5px 10px", fontSize:"12px", color: m.status==='bad'?"var(--red)":"var(--amber)" }}>
                                {m.name} {m.value}{m.unit}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(!a.blood.abnormal || a.blood.abnormal.length === 0) && (
                        <div style={{ fontSize:"12px", color:"var(--green)" }}>✓ Tous les marqueurs sont normaux</div>
                      )}
                      {a.blood.pendingCoachValidation && (
                        <button
                          disabled={validatingBlood === a.id}
                          onClick={async () => {
                            setValidatingBlood(a.id);
                            const edits = bloodEdits[a.id] || {};
                            await fetch('/api/coach/bloodtest', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ athleteId: a.id, bloodTestId: a.blood.id, edits }) });
                            setAthletes(prev => prev.map(x => x.id === a.id ? { ...x, blood: { ...x.blood, ...edits, pendingCoachValidation: false } } : x));
                            setValidatingBlood(null);
                          }}
                          className="cx-btn"
                          style={{ marginTop:13, width:"100%", padding:"9px", background:"var(--gold)", border:"none", color:"#15130d", fontSize:"13px", fontWeight:700, cursor:validatingBlood===a.id?"not-allowed":"pointer", opacity:validatingBlood===a.id?0.6:1 }}>
                          {validatingBlood === a.id ? "Envoi…" : `✓ Valider et envoyer à ${a.name.split(' ')[0]}`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── (4) Nutrition — objectifs & journal ── */}
                  <div className="cx-group-hd"><span className="lbl">Objectifs &amp; Journal</span><span className="ln"/></div>

                  {/* Édition objectifs */}
                  {editingId === a.id ? (
                    <div className="cx-inner" style={{ padding:"16px", marginBottom:14 }}>
                      <div className="t-eyebrow" style={{ marginBottom:14 }}>Modifier les objectifs</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                        {[
                          { k:'goalKcal', l:'Kcal/j' },
                          { k:'goalProtein', l:'Protéines (g)' },
                          { k:'goalCarbs', l:'Glucides (g)' },
                          { k:'goalFat', l:'Lipides (g)' },
                        ].map(f => (
                          <div key={f.k}>
                            <div style={{ fontSize:"11px", color:"var(--txt-3)", letterSpacing:1, marginBottom:6 }}>{f.l}</div>
                            <input type="number" value={editGoals[f.k] || ''} onChange={e => setEditGoals(prev => ({ ...prev, [f.k]: e.target.value }))}
                              placeholder={f.k === 'goalKcal' ? a.goalKcal : f.k === 'goalProtein' ? a.goalProtein : '—'}
                              className="cx-in" style={{ width:"100%" }}/>
                          </div>
                        ))}
                      </div>
                      <textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note pour l'élève (optionnel)…" rows={2}
                        className="cx-in" style={{ width:"100%", resize:"none", marginBottom:10, fontSize:"13.5px" }}/>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => setEditingId(null)} className="cx-btn cx-btn-ghost" style={{ flex:1, padding:"9px", fontSize:"13px" }}>Annuler</button>
                        <button onClick={() => saveGoals(a.id)} disabled={savingId===a.id} className="cx-btn cx-btn-gold" style={{ flex:2, padding:"9px", fontSize:"13px", opacity:savingId===a.id?0.6:1 }}>
                          {savingId===a.id ? "Enregistrement…" : "✓ Appliquer"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(a)} className="cx-collapse" style={{ borderRadius:"var(--r-sm)", marginBottom:10, color:"var(--blue)", justifyContent:"center", gap:6 }}>
                      ✏️ Modifier les objectifs
                    </button>
                  )}

                  {/* Journal du jour */}
                  {a.todayJournal?.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <button onClick={() => setExpandedJournal(expandedJournal===a.id ? null : a.id)}
                        className="cx-collapse" style={{ borderRadius: expandedJournal===a.id?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)" }}>
                        <span>📋 Journal aujourd'hui</span>
                        <span className="chev">{a.todayJournal.length} aliments {expandedJournal===a.id?"▲":"▼"}</span>
                      </button>
                      {expandedJournal===a.id && (
                        <div className="cx-inner" style={{ borderTop:"none", borderRadius:"0 0 var(--r-sm) var(--r-sm)", padding:"16px 18px" }}>
                          {a.todayJournal.map((e,i) => (
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom: i<a.todayJournal.length-1?"1px solid var(--line-soft)":"none" }}>
                              <div>
                                <span style={{ fontSize:"13.5px", color:"var(--gold)" }}>{e.name}</span>
                                {e.meal && <span style={{ fontSize:"11.5px", color:"var(--txt-4)", marginLeft:8 }}>{e.meal}</span>}
                              </div>
                              <span style={{ fontSize:"12.5px", color:"var(--txt-3)", flexShrink:0, marginLeft:8 }}>{e.kcal} kcal · {e.protein}g prot</span>
                            </div>
                          ))}
                          {/* ─── Commentaire coach sur le journal ─── */}
                          {(() => {
                            const today = new Date().toLocaleDateString('fr-CA');
                            const key = `${a.id}:${today}`;
                            const existing = journalComments[key];
                            const inputVal = journalCommentInput[key] ?? '';
                            return (
                              <div style={{ marginTop:11, paddingTop:11, borderTop:"1px solid var(--line-soft)" }}>
                                <div className="t-eyebrow" style={{ marginBottom:7 }}>Commentaire coach</div>
                                {existing && (
                                  <div style={{ fontSize:"13px", color:"var(--txt-2)", fontStyle:"italic", marginBottom:7, lineHeight:1.5 }}>{existing}</div>
                                )}
                                <div style={{ display:"flex", gap:6 }}>
                                  <input value={inputVal} onChange={e=>setJournalCommentInput(prev=>({...prev,[key]:e.target.value}))} placeholder="Ajouter un commentaire…"
                                    className="cx-in" style={{ flex:1, fontSize:"13.5px" }}/>
                                  <button onClick={()=>saveJournalComment(a.id)}
                                    className="cx-btn" style={{ padding:"7px 12px", background:"#1f1b13", border:"1px solid var(--line-gold)", color:"var(--gold)", fontSize:"12.5px", whiteSpace:"nowrap" }}>Enregistrer</button>
                                  {existing && (
                                    <button onClick={()=>deleteJournalComment(a.id)}
                                      className="cx-btn" style={{ padding:"7px 9px", background:"#1a0d0d", border:"1px solid #3a2020", color:"#8a4040", fontSize:"14px" }}>🗑</button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── (5) Suivi (mensurations, logs, check-ins, bilan initial) ── header masqué si aucune sous-section n'a de donnée */}
                  {(measurements[a.id]?.length > 0 || muscuLogs[a.id]?.length > 0 || checkins[a.id]?.length > 0 || (intakes[a.id] && [intakes[a.id].allergies, intakes[a.id].goals, intakes[a.id].medicalHistory, intakes[a.id].injuries, intakes[a.id].lifestyle, intakes[a.id].motivation].some(Boolean))) && (
                    <div className="cx-group-hd"><span className="lbl">Suivi détaillé</span><span className="ln"/></div>
                  )}

                  {/* ─── Mensurations ─── (masqué si aucune donnée chargée) */}
                  {measurements[a.id]?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <button onClick={()=>{
                      const opening = !measurementsOpen[a.id];
                      setMeasurementsOpen(prev=>({...prev,[a.id]:!prev[a.id]}));
                      if (opening) loadMeasurements(a.id);
                    }} className="cx-collapse" style={{ borderRadius: measurementsOpen[a.id]?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)" }}>
                      <span>📏 Mensurations</span>
                      <span className="chev">{measurementsOpen[a.id]?"▲":"▼"}</span>
                    </button>
                    {measurementsOpen[a.id] && (
                      <div className="cx-inner" style={{ borderTop:"none", borderRadius:"0 0 var(--r-sm) var(--r-sm)", padding:"16px 18px" }}>
                        {(
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12.5px" }}>
                            <thead>
                              <tr>
                                {["Date","Poids","Taille","Poitrine","Hanches","Bras","Cuisse","% Graisse","Muscle"].map(h=>(
                                  <th key={h} style={{ textAlign:"left", color:"var(--txt-3)", fontWeight:"normal", letterSpacing:0.5, paddingBottom:9, paddingRight:8, textTransform:"uppercase", fontSize:"11px" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {measurements[a.id].slice(0,5).map((m,i)=>(
                                <tr key={i} style={{ borderTop:"1px solid var(--line-soft)" }}>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt-3)" }}>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--cream)" }}>{m.weight??'—'} kg</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt)" }}>{m.waist??'—'}</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt)" }}>{m.chest??'—'}</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt)" }}>{m.hips??'—'}</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt)" }}>{m.arm??'—'}</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt)" }}>{m.thigh??'—'}</td>
                                  <td style={{ padding:"7px 8px 7px 0", color:"var(--txt)" }}>{m.bodyFat!=null?`${m.bodyFat}%`:'—'}</td>
                                  <td style={{ padding:"7px 0", color:"var(--txt)" }}>{m.muscleMass!=null?`${m.muscleMass} kg`:'—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  {/* ─── Logs muscu (séances réellement enregistrées) ─── (masqué si aucune donnée) */}
                  {muscuLogs[a.id]?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <button onClick={()=>{
                      const opening = !muscuLogsOpen[a.id];
                      setMuscuLogsOpen(prev=>({...prev,[a.id]:!prev[a.id]}));
                      if (opening) loadMuscuLogs(a.id);
                    }} className="cx-collapse" style={{ borderRadius: muscuLogsOpen[a.id]?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)" }}>
                      <span>🏋️ Logs muscu</span>
                      <span className="chev">{muscuLogsOpen[a.id]?"▲":"▼"}</span>
                    </button>
                    {muscuLogsOpen[a.id] && (
                      <div className="cx-inner" style={{ borderTop:"none", borderRadius:"0 0 var(--r-sm) var(--r-sm)", padding:"16px 18px" }}>
                        {(
                          muscuLogs[a.id].slice(0,8).map((sess,si)=>(
                            <div key={si} style={{ borderTop: si>0?"1px solid var(--line-soft)":"none", paddingTop: si>0?9:0, marginTop: si>0?9:0 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                                <span style={{ fontSize:"13px", color:"var(--gold)", fontWeight:500 }}>{new Date(sess.date).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' })}</span>
                                <span style={{ fontSize:"12px", color:"var(--txt-3)" }}>{sess.totalSets} séries · {Math.round(sess.totalVolume)} kg vol.</span>
                              </div>
                              {sess.exercises.map((ex,ei)=>(
                                <div key={ei} style={{ fontSize:"12px", color:"var(--txt-3)", lineHeight:1.7 }}>
                                  <span style={{ color:"var(--txt-2)" }}>{ex.name}</span> — {ex.sets.map(s=>`${s.weight||'–'}kg×${s.reps||'–'}`).join(', ')}
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  {/* ─── Check-ins hebdomadaires ─── (masqué si aucun check-in) */}
                  {checkins[a.id]?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <button onClick={()=>{
                      const opening = !checkinsOpen[a.id];
                      setCheckinsOpen(prev=>({...prev,[a.id]:!prev[a.id]}));
                      if (opening) loadCheckins(a.id);
                    }} className="cx-collapse" style={{ borderRadius: checkinsOpen[a.id]?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)" }}>
                      <span>✅ Check-ins</span>
                      <span className="chev">{checkinsOpen[a.id]?"▲":"▼"}</span>
                    </button>
                    {checkinsOpen[a.id] && (
                      <div className="cx-inner" style={{ borderTop:"none", borderRadius:"0 0 var(--r-sm) var(--r-sm)", padding:"16px 18px" }}>
                        {checkins[a.id].slice(0,4).map((c,i)=>(
                          <div key={i} style={{ padding:"9px 0", borderBottom: i<Math.min(checkins[a.id].length,4)-1?"1px solid var(--line-soft)":"none" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                              <div style={{ fontSize:"12.5px", color:"var(--txt-2)" }}>{new Date(c.date).toLocaleDateString('fr-FR')}</div>
                              {c.weight && <div style={{ fontSize:"12.5px", color:"var(--gold)" }}>{c.weight} kg</div>}
                            </div>
                            <div style={{ display:"flex", gap:16 }}>
                              {[{l:"Humeur",v:c.mood},{l:"Énergie",v:c.energy}].map(({l,v})=>(
                                <div key={l}>
                                  <div style={{ fontSize:"11px", color:"var(--txt-4)", marginBottom:3, textTransform:"uppercase", letterSpacing:.5 }}>{l}</div>
                                  <div style={{ display:"flex", gap:3 }}>
                                    {[1,2,3,4,5].map(s=>(
                                      <div key={s} style={{ width:7, height:7, borderRadius:"50%", background:s<=(v||0)?"var(--gold)":"var(--line)" }}/>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {c.sleep!=null && (
                                <div>
                                  <div style={{ fontSize:"11px", color:"var(--txt-4)", marginBottom:3, textTransform:"uppercase", letterSpacing:.5 }}>Sommeil</div>
                                  <div style={{ fontSize:"12.5px", color:"var(--blue)" }}>{c.sleep}h</div>
                                </div>
                              )}
                            </div>
                            {c.notes && <div style={{ fontSize:"12px", color:"var(--txt-2)", fontStyle:"italic", marginTop:5, lineHeight:1.4 }}>{c.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* ─── Suivi photo / vidéo ─── */}
                  {coachMedia[a.id]?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <button onClick={()=>{
                      const opening = !coachMediaOpen[a.id];
                      setCoachMediaOpen(prev=>({...prev,[a.id]:!prev[a.id]}));
                      if (opening) loadMedia(a.id);
                    }} className="cx-collapse" style={{ borderRadius: coachMediaOpen[a.id]?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)" }}>
                      <span>📸 Suivi photo / vidéo{(() => { const n = (coachMedia[a.id]||[]).filter(m=>!m.viewedAt && !m.expired).length; return n>0 ? <span className="cx-badge red" style={{ minWidth:18, height:18, padding:"0 5px", marginLeft:8 }}>{n}</span> : null; })()}</span>
                      <span className="chev">{coachMediaOpen[a.id]?"▲":"▼"}</span>
                    </button>
                    {coachMediaOpen[a.id] && (() => {
                      const allM = coachMedia[a.id] || [];
                      const items = allM.filter(m => mediaFilter==='all' || m.type===mediaFilter);
                      const selObjs = compareSel.map(id => allM.find(m=>m.id===id)).filter(Boolean);
                      return (
                      <div className="cx-inner" style={{ borderTop:"none", borderRadius:"0 0 var(--r-sm) var(--r-sm)", padding:"16px 18px" }}>
                        {/* Barre d'outils : filtre · avant/après · tout télécharger */}
                        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginBottom:14 }}>
                          {[['all','Tout'],['photo','Photos'],['video','Vidéos']].map(([k,l])=>(
                            <button key={k} onClick={()=>setMediaFilter(k)} className={`cx-chip${mediaFilter===k?' sel':''}`} style={{ padding:"5px 12px", fontSize:"12px" }}>{l}</button>
                          ))}
                          <div style={{ flex:1 }}/>
                          <button onClick={()=>{ setCompareMode(c=>!c); setCompareSel([]); }} className="cx-icon-btn" style={{ padding:"5px 12px", fontSize:"12px", ...(compareMode?{ color:"var(--gold)", borderColor:"var(--line-gold)" }:{}) }}>{compareMode?'Annuler':'⇄ Avant/après'}</button>
                          <button onClick={async()=>{ for (const m of items) { if (m.type==='photo' && m.url) { await downloadMedia(m.url,m.type,m.id); await new Promise(r=>setTimeout(r,400)); } } }} className="cx-icon-btn" style={{ padding:"5px 12px", fontSize:"12px" }}>⬇ Tout</button>
                        </div>
                        {compareMode && (
                          <div style={{ fontSize:"12px", color:"var(--txt-3)", marginBottom:12 }}>
                            Clique 2 photos à comparer ({selObjs.length}/2)
                            {selObjs.length===2 && <button onClick={()=>setCompareView(selObjs)} className="cx-icon-btn cx-btn-gold" style={{ padding:"4px 12px", marginLeft:8, fontSize:"12px" }}>Comparer ▸</button>}
                          </div>
                        )}
                        {items.map((m,i)=>(
                          <div key={m.id} style={{ padding:"12px 0", borderBottom: i<items.length-1?"1px solid var(--line-soft)":"none", ...(compareMode && compareSel.includes(m.id)?{ outline:"2px solid var(--gold)", outlineOffset:"3px", borderRadius:"6px" }:{}) }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:8 }}>
                              <div style={{ fontSize:"12px", color:"var(--txt-3)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                <span>{m.type==='video'?'🎥 Vidéo':'📸 Photo'} · {new Date(m.date).toLocaleDateString('fr-FR')}{m.viewedAt?' · vu':''}</span>
                                {m.weight ? <span style={{ color:"var(--gold)" }}>{m.weight} kg</span> : null}
                                {m.isReference && <span style={{ color:"var(--gold)", border:"1px solid var(--line-gold)", borderRadius:4, padding:"0 5px" }}>★ référence</span>}
                              </div>
                              <div style={{ display:"flex", gap:6 }}>
                                {!m.expired && <button onClick={()=>toggleReference(a.id,m.id)} title="Marquer comme référence (point de départ avant/après)" className="cx-icon-btn" style={{ padding:"4px 9px", fontSize:"12px", ...(m.isReference?{ color:"var(--gold)", borderColor:"var(--line-gold)" }:{}) }}>★</button>}
                                {!m.expired && m.url && <button onClick={()=>downloadMedia(m.url, m.type, m.id)} title="Télécharger" className="cx-icon-btn" style={{ padding:"4px 9px", fontSize:"12px" }}>⬇</button>}
                              </div>
                            </div>
                            {m.note && <div style={{ fontSize:"12px", color:"var(--txt-2)", fontStyle:"italic", marginBottom:8 }}>{m.note}</div>}
                            {m.expired ? (
                              <div style={{ fontSize:"12px", color:"var(--txt-4)", padding:"8px 0" }}>Vidéo expirée (supprimée 48h après visionnage).</div>
                            ) : m.url ? (
                              (compareMode && m.type==='photo')
                                ? <img src={m.url} alt="" onClick={()=>setCompareSel(prev=> prev.includes(m.id) ? prev.filter(x=>x!==m.id) : (prev.length<2 ? [...prev,m.id] : [prev[1],m.id]))} style={{ width:"100%", maxHeight:340, objectFit:"contain", borderRadius:8, background:"#000", cursor:"pointer" }}/>
                                : m.type==='video'
                                ? <div>
                                    <video src={m.url} controls preload="metadata" onPlay={()=>!m.viewedAt && markMediaViewed(a.id,m.id)} style={{ width:"100%", maxHeight:340, borderRadius:8, background:"#000", display:"block" }}/>
                                    <a href={m.url} target="_blank" rel="noopener noreferrer" onClick={()=>!m.viewedAt && markMediaViewed(a.id,m.id)} style={{ display:"inline-block", marginTop:6, fontSize:12, color:"var(--gold)" }}>⬇ Ouvrir / télécharger la vidéo (format iPhone HEVC)</a>
                                  </div>
                                : <img src={m.url} alt="" onLoad={()=>!m.viewedAt && markMediaViewed(a.id,m.id)} style={{ width:"100%", maxHeight:340, objectFit:"contain", borderRadius:8, background:"#000" }}/>
                            ) : (
                              <div style={{ fontSize:"12px", color:"var(--txt-4)" }}>Indisponible.</div>
                            )}
                            {m.comment && <div style={{ fontSize:"12px", color:"var(--gold)", marginTop:8 }}>Ton commentaire : {m.comment}</div>}
                            <div style={{ display:"flex", gap:8, marginTop:8 }}>
                              <input value={mediaComment[m.id]||''} onChange={e=>setMediaComment(prev=>({...prev,[m.id]:e.target.value}))} placeholder="Commenter (form-check, conseils…)" className="cx-in" style={{ flex:1 }}/>
                              <button onClick={()=>sendMediaComment(a.id,m.id)} className="cx-icon-btn" style={{ padding:"8px 14px" }}>Envoyer</button>
                            </div>
                          </div>
                        ))}
                        {items.length===0 && <div style={{ fontSize:"12px", color:"var(--txt-4)", padding:"8px 0" }}>Aucun média pour ce filtre.</div>}
                      </div>
                      );
                    })()}
                  </div>
                  )}

                  {/* ─── Bilan initial ─── (affiché seulement si l'athlète a rempli au moins un champ) */}
                  {(() => {
                    const intake = intakes[a.id];
                    if (!intake) return null;
                    const fields = [
                      { l:"Allergies", v:intake.allergies },
                      { l:"Objectifs", v:intake.goals },
                      { l:"Antécédents médicaux", v:intake.medicalHistory },
                      { l:"Blessures", v:intake.injuries },
                      { l:"Mode de vie", v:intake.lifestyle },
                      { l:"Motivation", v:intake.motivation },
                    ].filter(f=>f.v);
                    if (fields.length === 0) return null;
                    return (
                      <div className="cx-inner" style={{ padding:"18px 20px", marginBottom:10 }}>
                        <div className="t-eyebrow" style={{ marginBottom:9 }}>📋 Bilan initial</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {fields.map(f=>(
                            <div key={f.l}>
                              <div style={{ fontSize:"11px", color:"var(--txt-3)", letterSpacing:1, textTransform:"uppercase", marginBottom:3 }}>{f.l}</div>
                              <div style={{ fontSize:"13px", color:"var(--gold)", lineHeight:1.5 }}>{f.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── (6) Coaching & Actions ── */}
                  <div className="cx-group-hd"><span className="lbl">Coaching &amp; Actions</span><span className="ln"/></div>

                  {/* Programme actuel (nutrition + muscu) — carte masquée si aucun programme */}
                  {(() => {
                    const cur = currentPrograms[a.id];
                    if (!cur) return null; // en chargement (undefined) ou null → rien
                    const rows = [
                      { type:'nutrition', label:'Nutrition', accent:'var(--green)', prog: cur.nutrition },
                      { type:'muscu', label:'Muscu', accent:'var(--violet)', prog: cur.muscu },
                    ].filter(r => r.prog);
                    if (rows.length === 0) return null;
                    return (
                      <div className="cx-inner" style={{ padding:"18px 20px", marginBottom:14 }}>
                        <div className="t-eyebrow" style={{ marginBottom:14 }}>Programme actuel</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                          {rows.map(r => (
                            <div key={r.type} style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:"13.5px", color:"var(--cream)", fontWeight:500 }}>{r.label}</div>
                                <div style={{ fontSize:"11.5px", color:"var(--txt-3)", marginTop:3 }}>
                                  {(r.prog.days?.length||0)} jour{(r.prog.days?.length||0)>1?'s':''}
                                  <span style={{ color:"var(--line-gold)" }}> · </span>
                                  {(r.prog.status==='sent'||r.prog.sentAt)
                                    ? <span style={{ color:"var(--green)" }}>Envoyé{r.prog.sentAt?` le ${new Date(r.prog.sentAt).toLocaleDateString('fr-FR')}`:''}</span>
                                    : <span style={{ color:"var(--amber)" }}>Brouillon</span>}
                                </div>
                              </div>
                              <button onClick={()=>editCurrentProgram(r.type)}
                                className="cx-btn" style={{ padding:"7px 14px", background:"transparent", border:"1px solid var(--line-gold)", color:r.accent, fontSize:"12px", whiteSpace:"nowrap" }}>
                                Modifier / renvoyer
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="cx-actions" style={{ display:"flex", gap:10, marginBottom:10 }}>
                    <button onClick={()=>generateReport(a.id, a.name)} disabled={reportLoading}
                      className="cx-tile" style={{ flex:2, position:"relative", padding:"14px 8px", color:"var(--gold)", fontSize:"13px", ...(a.reportRequest ? { borderColor:"var(--gold)" } : {}), opacity:reportLoading?0.5:1 }}>
                      {reportLoading && reportAthlete===a.name ? "…" : `Rapport ${reportDays}j`}
                      {a.reportRequest && <span className="cx-badge gold" style={{ position:"absolute", top:-6, right:-6, width:16, height:16, zIndex:1 }}>!</span>}
                    </button>
                    <button onClick={() => openProgramModal(a)}
                      className="cx-tile" style={{ flex:1, padding:"14px 6px", color:"var(--green)", fontSize:"13px" }}>
                      Nutrition
                    </button>
                    <button onClick={() => openMuscuModal(a)}
                      className="cx-tile" style={{ flex:1, padding:"14px 6px", color:"var(--violet)", fontSize:"13px" }}>
                      Muscu
                    </button>
                  </div>
                  <div className="cx-actions" style={{ display:"flex", gap:10, marginBottom:18 }}>
                    <button onClick={() => openChat(a)} className="cx-tile" style={{ flex:1, position:"relative", padding:"12px 6px", color:"var(--blue)", fontSize:"12.5px" }}>
                      Message
                      {chatUnread[a.id] > 0 && <span className="cx-badge red" style={{ position:"absolute", top:-6, right:-6, width:16, height:16, zIndex:1 }}>{chatUnread[a.id]}</span>}
                    </button>
                    <button onClick={async () => { await fetch('/api/auth/view-as', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId: a.id }) }); window.location.href = '/'; }}
                      className="cx-tile" style={{ flex:1, position:"relative", padding:"12px 6px", color: a.pendingBlood ? "var(--green)" : "var(--txt-2)", fontSize:"12.5px", ...(a.pendingBlood ? { borderColor:"#3a7a3a" } : {}) }}>
                      Voir son app
                      {a.pendingBlood && <span className="cx-badge" style={{ position:"absolute", top:-6, right:-6, width:16, height:16, background:"var(--green)", color:"#15130d", zIndex:1 }}>!</span>}
                    </button>
                  </div>

                  {/* Notes privées */}
                  <div style={{ marginBottom:12 }}>
                    <button onClick={async()=>{
                      if (notesOpen===a.id) { setNotesOpen(null); return; }
                      if (!notesText[a.id]) {
                        const d = await fetch(`/api/coach/notes?athleteId=${a.id}`).then(r=>r.json());
                        setNotesText(t=>({...t,[a.id]:d.notes||''}));
                      }
                      setNotesOpen(a.id);
                    }} className="cx-collapse" style={{ borderRadius: notesOpen===a.id?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)" }}>
                      <span>📝 Notes privées</span>
                      <span className="chev">{notesOpen===a.id?"▲":"▼"}</span>
                    </button>
                    {notesOpen===a.id && (
                      <div className="cx-inner" style={{ borderTop:"none", borderRadius:"0 0 var(--r-sm) var(--r-sm)", padding:"16px 18px" }}>
                        <textarea value={notesText[a.id]||''} onChange={e=>setNotesText(t=>({...t,[a.id]:e.target.value}))}
                          placeholder="Notes personnelles sur cet élève — non visibles par l'élève…"
                          style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:"var(--txt-2)", fontSize:"14px", resize:"none", minHeight:90, lineHeight:1.7 }}/>
                        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                          <button onClick={async()=>{
                            setNotesSaving(a.id);
                            await fetch('/api/coach/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({athleteId:a.id,notes:notesText[a.id]||''})});
                            setNotesSaving(null);
                          }} disabled={notesSaving===a.id}
                            className="cx-btn" style={{ background:"#1f1b13", border:"1px solid var(--line-gold)", padding:"6px 16px", color:"var(--gold)", fontSize:"13px" }}>
                            {notesSaving===a.id ? '…' : 'Sauvegarder'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setConfirmDelete(a)}
                    className="cx-btn" style={{ width:"100%", padding:"11px", background:"transparent", border:"1px solid #3a2020", color:"var(--red)", fontSize:"12.5px" }}>
                    Retirer cet élève
                  </button>
                </div>
            </div>
          );
        })}
        </main>
      </div>
      )}

      {/* ─────────────── Vue Messages (2 panneaux) ─────────────── */}
      {view === 'messages' && (
        <div className="cx-msg-shell">
          {/* Gauche : liste de toutes les conversations */}
          <div className="cx-msg-list">
            <div style={{ padding:"18px 18px 14px", borderBottom:"1px solid var(--line-soft)", flexShrink:0 }}>
              <div className="t-eyebrow gold">💬 Conversations · {athletes.length}</div>
            </div>
            <div className="cx-msg-list-scroll cx-scroll">
              {athletes.length === 0 ? (
                <div style={{ color:"var(--txt-4)", fontSize:"13px", padding:"24px 18px", lineHeight:1.8 }}>Aucun élève lié.<br/>Partage ton code.</div>
              ) : (() => {
                // Tri : non-lus d'abord, puis activité récente (activeDays7j décroissant), puis A-Z.
                const list = athletes.slice().sort((a, b) => {
                  const ua = chatUnread[a.id] > 0 ? 0 : 1, ub = chatUnread[b.id] > 0 ? 0 : 1;
                  if (ua !== ub) return ua - ub;
                  const da = a.activeDays7j || 0, dbb = b.activeDays7j || 0;
                  if (da !== dbb) return dbb - da;
                  return (a.name||'').localeCompare(b.name||'');
                });
                return list.map(a => {
                  const active = chatModal?.id === a.id;
                  const unread = chatUnread[a.id] || 0;
                  // Aperçu du dernier message : dispo seulement pour la conversation active (messages chargés).
                  const preview = active && chatMessages.length > 0 ? chatMessages[chatMessages.length-1].text : null;
                  return (
                    <div key={a.id} className={`cx-conv-row${active?' active':''}`} onClick={()=>openChat(a)}>
                      <div className="cx-av" style={{ width:42, height:42 }}>{(a.name||'?').trim().charAt(0).toUpperCase()}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"14.5px", color: active?"var(--cream)":"var(--txt)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
                        <div style={{ fontSize:"12px", color: unread>0?"var(--cream)":"var(--txt-3)", marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: unread>0?500:400 }}>
                          {preview ? preview : "Voir la conversation"}
                        </div>
                      </div>
                      {unread > 0 && <span className="cx-badge red" style={{ minWidth:18, height:18, padding:"0 5px" }}>{unread}</span>}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Droite : conversation active */}
          <div className="cx-conv-pane">
            {!chatModal ? (
              <div className="cx-conv-empty">
                <div style={{ fontSize:"36px" }}>💬</div>
                <div style={{ fontFamily:"var(--serif)", fontSize:"20px", color:"var(--gold-dim)" }}>Sélectionne une conversation</div>
                <div>Choisis un athlète à gauche pour échanger.</div>
              </div>
            ) : (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:"1px solid var(--line)", flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:13, minWidth:0 }}>
                    <div className="cx-av" style={{ width:40, height:40 }}>{(chatModal.name||'?').trim().charAt(0).toUpperCase()}</div>
                    <div style={{ fontFamily:"var(--serif)", fontSize:"18px", fontWeight:600, color:"var(--cream)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{chatModal.name}</div>
                  </div>
                </div>
                <div className="cx-scroll" style={{ flex:1, overflowY:"auto", padding:"20px 22px", display:"flex", flexDirection:"column", gap:10 }}>
                  {chatMessages.length === 0 && <div style={{ textAlign:"center", color:"var(--txt-3)", fontSize:"13px", padding:"24px 0" }}>Aucun message avec cet élève.</div>}
                  {chatMessages.map((m, i) => (
                    <div key={m.id||i} style={{ display:"flex", flexDirection:"column", alignItems: m.role==='coach'?"flex-end":"flex-start" }}>
                      <div style={{ maxWidth:"78%", background:"var(--sunk)", border:`1px solid ${m.role==='coach'?"var(--line-gold)":"var(--line)"}`, borderRadius: m.role==='coach'?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"10px 14px" }}>
                        {m.imageUrl && <img src={m.imageUrl} alt="" style={{ maxWidth:220, maxHeight:220, borderRadius:8, display:"block", marginBottom: m.text?6:0, background:"#000", cursor:"pointer" }} onClick={()=>window.open(m.imageUrl,'_blank')}/>}
                        {m.text && <div style={{ fontSize:"14px", color: m.role==='coach'?"var(--cream)":"var(--txt)", lineHeight:1.5 }}>{m.text}</div>}
                      </div>
                      <div style={{ fontSize:"11px", color:"var(--txt-3)", marginTop:4, marginLeft:4, marginRight:4 }}>{new Date(m.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10, padding:"16px 22px", flexShrink:0, borderTop:"1px solid var(--line)" }}>
                  <label className="cx-btn" style={{ padding:"0 14px", display:"flex", alignItems:"center", cursor:"pointer", background:"#1f1b13", border:"1px solid var(--line-gold)", color:"var(--gold)", borderRadius:"var(--r-sm)" }} title="Envoyer une photo">📷
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) sendChatPhoto(f); e.target.value=''; }}/>
                  </label>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChatMessage()} placeholder={`Message à ${chatModal.name}…`} className="cx-in" style={{ flex:1 }}/>
                  <button onClick={sendChatMessage} disabled={!chatInput.trim()||chatSending} className="cx-btn cx-btn-gold" style={{ padding:"0 18px", fontSize:"16px", opacity:!chatInput.trim()||chatSending?0.5:1 }}>→</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation suppression athlète */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div className="cx-modal" style={{ padding:"28px 24px", maxWidth:360, width:"100%" }}>
            <div style={{ fontFamily:"var(--serif)", fontSize:"22px", fontWeight:600, color:"var(--cream)", marginBottom:10 }}>Retirer {confirmDelete.name} ?</div>
            <div style={{ fontSize:"13.5px", color:"var(--txt-2)", marginBottom:24, lineHeight:1.6 }}>Cet élève ne sera plus lié à ton compte. Ses données restent intactes.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirmDelete(null)} className="cx-btn cx-btn-ghost" style={{ flex:1, padding:"11px", fontSize:"13.5px" }}>Annuler</button>
              <button onClick={() => deleteAthlete(confirmDelete.id)} className="cx-btn" style={{ flex:1, padding:"11px", background:"transparent", border:"1px solid #5a2a2a", color:"var(--red)", fontSize:"13.5px" }}>Retirer</button>
            </div>
          </div>
        </div>
      )}

      {view === 'profil' && (
      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px" }}>
        {!profile ? (
          <div style={{ color:"var(--txt-3)", padding:40, textAlign:"center" }}>Chargement…</div>
        ) : (
        <>
          {/* Marque blanche : logo */}
          <div className="cx-inner" style={{ padding:"20px 22px", marginBottom:18 }}>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, fontWeight:600, color:"var(--cream)", marginBottom:6 }}>Ta marque</div>
            <div style={{ fontSize:12.5, color:"var(--txt-3)", marginBottom:16 }}>Ton logo apparaît en en-tête des rapports envoyés à tes élèves.</div>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:88, height:88, borderRadius:12, background:"#fff", border:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                {profile.logo ? <img src={profile.logo} alt="logo" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}/> : <span style={{ color:"#bbb", fontSize:12 }}>Aucun logo</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <label className="cx-icon-btn" style={{ cursor:"pointer", padding:"9px 14px", textAlign:"center" }}>
                  {profile.logo ? 'Changer le logo' : 'Ajouter un logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display:"none" }} onChange={e=>uploadLogo(e.target.files?.[0])}/>
                </label>
                {profile.logo && <button onClick={removeLogo} className="cx-icon-btn" style={{ padding:"9px 14px" }}>Retirer</button>}
                <div style={{ fontSize:11, color:"var(--txt-4)" }}>PNG/JPG/WebP · max 500 Ko</div>
              </div>
            </div>
          </div>

          {/* Profil */}
          <div className="cx-inner" style={{ padding:"20px 22px", marginBottom:18 }}>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, fontWeight:600, color:"var(--cream)", marginBottom:16 }}>Profil</div>
            <div style={{ marginBottom:14 }}>
              <div className="t-label" style={{ marginBottom:8 }}>Nom affiché</div>
              <input value={profile.displayName||''} onChange={e=>setProfile(p=>({...p, displayName:e.target.value}))} className="cx-in" style={{ width:"100%" }} placeholder="Ex: Marc Dupont"/>
            </div>
            <div style={{ marginBottom:14 }}>
              <div className="t-label" style={{ marginBottom:8 }}>Spécialité</div>
              <input value={profile.specialty||''} onChange={e=>setProfile(p=>({...p, specialty:e.target.value}))} className="cx-in" style={{ width:"100%" }} placeholder="Ex: Préparation physique, nutrition sportive"/>
            </div>
            <div style={{ marginBottom:16 }}>
              <div className="t-label" style={{ marginBottom:8 }}>Bio</div>
              <textarea value={profile.bio||''} onChange={e=>setProfile(p=>({...p, bio:e.target.value}))} className="cx-in" style={{ width:"100%", minHeight:80, resize:"vertical" }} placeholder="Quelques mots sur toi"/>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={saveProfileFields} disabled={profileSaving} className="cx-icon-btn" style={{ padding:"10px 18px", color:"var(--gold)", borderColor:"var(--line-gold)" }}>{profileSaving?'…':'Enregistrer'}</button>
              {profileMsg && <span style={{ fontSize:12.5, color:"var(--txt-3)" }}>{profileMsg}</span>}
            </div>
          </div>

          {/* Abonnement */}
          <div className="cx-inner" style={{ padding:"20px 22px", marginBottom:18 }}>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, fontWeight:600, color:"var(--cream)", marginBottom:6 }}>Abonnement</div>
            <div style={{ fontSize:12.5, color:"var(--txt-3)", marginBottom:16 }}>Gère ta facturation et tes places d'élèves.</div>
            <button onClick={()=>window.alert('La gestion de la facturation sera disponible au lancement des abonnements coach.')} className="cx-icon-btn" style={{ padding:"10px 18px" }}>Gérer mon abonnement</button>
          </div>

          {/* Zone sensible */}
          <div className="cx-inner" style={{ padding:"20px 22px", border:"1px solid rgba(224,85,85,0.3)" }}>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, fontWeight:600, color:"#e07a7a", marginBottom:6 }}>Zone sensible</div>
            <div style={{ fontSize:12.5, color:"var(--txt-3)", marginBottom:16 }}>La suppression est définitive. Tes élèves seront déliés et conserveront leurs données.</div>
            <button onClick={deleteAccount} style={{ padding:"10px 18px", background:"transparent", border:"1px solid rgba(224,85,85,0.5)", color:"#e07a7a", borderRadius:10, cursor:"pointer", fontSize:13 }}>Supprimer mon compte</button>
          </div>
        </>
        )}
      </div>
      )}

      {/* Modal avant / après (comparaison côte à côte) */}
      {compareView && (
        <div className="cx-scroll" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:120, overflowY:"auto", padding:16 }} onClick={()=>setCompareView(null)}>
          <div style={{ maxWidth:900, margin:"0 auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontFamily:"var(--serif)", fontSize:"22px", fontWeight:600, color:"var(--cream)" }}>Avant / après</div>
              <button onClick={()=>setCompareView(null)} style={{ background:"transparent", border:"none", fontSize:"22px", cursor:"pointer", color:"var(--txt-2)" }}>✕</button>
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[...compareView].sort((x,y)=>new Date(x.date)-new Date(y.date)).map((m,i)=>(
                <div key={m.id} style={{ flex:"1 1 300px", minWidth:0 }}>
                  <div style={{ fontSize:"12px", color:"var(--txt-3)", marginBottom:6, textAlign:"center" }}>
                    {i===0?'Avant':'Après'} · {new Date(m.date).toLocaleDateString('fr-FR')}{m.weight?` · ${m.weight} kg`:''}{m.isReference?' · ★':''}
                  </div>
                  <img src={m.url} alt="" style={{ width:"100%", borderRadius:8, background:"#000" }}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal programme */}
      {programModal && (
        <div className="cx-scroll" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:100, overflowY:"auto", padding:16 }} onClick={()=>{ if(!programLoading){ setProgramModal(null); setGeneratedProgram(null); } }}>
          <div className="cx-modal" style={{ maxWidth:600, margin:"0 auto", padding:"26px 24px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div>
                <div style={{ fontFamily:"var(--serif)", fontSize:"22px", fontWeight:600, color:"var(--cream)" }}>Programme nutrition</div>
                <div style={{ fontSize:"12.5px", color:"var(--txt-3)", marginTop:4 }}>{programModal.name} · personnalisé par IA selon profil + bilan</div>
              </div>
              {!programLoading && <button onClick={()=>{ setProgramModal(null); setGeneratedProgram(null); }} style={{ background:"transparent", border:"none", fontSize:"22px", cursor:"pointer", color:"var(--txt-2)" }}>✕</button>}
            </div>

            {!generatedProgram ? (
              <div>
                {/* Config */}
                <div style={{ marginBottom:16 }}>
                  <div className="t-label" style={{ marginBottom:8 }}>Repas principaux</div>
                  <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                    {[2,3,4,5].map(n => (
                      <button key={n} onClick={() => setProgramConfig(p => ({ ...p, mainMeals: n }))}
                        className={`cx-chip${programConfig.mainMeals===n?' sel':''}`} style={{ flex:1 }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="t-label" style={{ marginBottom:8 }}>Collations</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {[0,1,2,3].map(n => (
                      <button key={n} onClick={() => setProgramConfig(p => ({ ...p, snacks: n }))}
                        className={`cx-chip${programConfig.snacks===n?' sel':''}`} style={{ flex:1 }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { k:'preferences', l:'Préférences alimentaires', ph:'Ex: végétarien, aime les légumineuses…' },
                  { k:'avoidFoods', l:'Aliments à éviter', ph:'Ex: gluten, lactose, fruits de mer…' },
                  { k:'coachNotes', l:'Notes pour l\'IA', ph:'Ex: semaine de compétition, blessure genou…' },
                ].map(f => (
                  <div key={f.k} style={{ marginBottom:16 }}>
                    <div className="t-label" style={{ marginBottom:8 }}>{f.l}</div>
                    <input value={programConfig[f.k]} onChange={e => setProgramConfig(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph}
                      className="cx-in" style={{ width:"100%" }}/>
                  </div>
                ))}
                {/* Depuis un modèle nutrition */}
                {templates.filter(t=>t.type==='nutrition').length > 0 && (
                  <div className="cx-inner" style={{ padding:"16px 18px", marginBottom:16 }}>
                    <div className="t-label" style={{ marginBottom:10 }}>Depuis un modèle</div>
                    {templates.filter(t=>t.type==='nutrition').map(t=>(
                      <button key={t.id} onClick={()=>applyNutritionTemplate(t)} className="cx-tile"
                        style={{ width:"100%", display:"block", textAlign:"left", padding:"10px 12px", color:"var(--green)", marginBottom:6 }}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {programError && (
                  <div style={{ background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:"var(--r-sm)", padding:"12px 14px", marginBottom:12, fontSize:"13px", color:"var(--red)", lineHeight:1.5 }}>
                    {programError}
                  </div>
                )}
                <button onClick={generateProgram} disabled={programLoading} className="cx-btn"
                  style={{ width:"100%", padding:"14px", background:"transparent", border:"1px solid var(--green)", color:"var(--green)", fontSize:"14px", fontWeight:600, cursor:programLoading?"not-allowed":"pointer", marginTop:4, opacity:programLoading?0.6:1 }}>
                  {programLoading ? "Génération en cours… (30-60s)" : "Générer le programme"}
                </button>
                {!programLoading && <button onClick={async()=>{
                  const empty = buildEmptyNutritionProgram(programConfig);
                  const res = await fetch('/api/coach/program',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId:programModal.id, program:empty }) });
                  const data = await res.json();
                  if (data.program) setGeneratedProgram(data.program);
                }} className="cx-btn cx-btn-ghost" style={{ width:"100%", padding:"13px", fontSize:"13.5px", marginTop:10 }}>
                  Remplir moi-même
                </button>}
              </div>
            ) : (
              <div>
                {/* Programme généré — éditable inline (le coach corrige la sortie IA) */}
                <div style={{ fontSize:"12.5px", color:"var(--green)", marginBottom:10 }}>Tu peux modifier chaque champ avant d'envoyer</div>
                <div className="cx-inner" style={{ borderColor:"#2a4030", padding:"16px 18px", marginBottom:16 }}>
                  <div className="t-label" style={{ color:"var(--green)", marginBottom:6 }}>Conseils de la semaine</div>
                  <Ed block value={generatedProgram.weeklyNotes || ''} onChange={v => setGeneratedProgram(p => ({ ...p, weeklyNotes: v }))}
                    style={{ fontSize:"13.5px", color:"var(--txt)", lineHeight:1.6, borderBottom:"none", width:"100%" }} />
                </div>
                {(generatedProgram.days || []).map((day, di) => (
                  <div key={di} style={{ marginBottom:16 }}>
                    <div style={{ fontFamily:"var(--serif)", fontSize:"15px", color:"var(--gold)", fontWeight:600, marginBottom:8 }}>{day.day}</div>
                    {(day.meals || []).map((meal, mi) => (
                      <div key={mi} className="cx-inner" style={{ padding:"10px 14px", marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                          <Ed value={meal.type} onChange={v => editNutMeal(di, mi, 'type', v)} style={{ fontSize:"13px", fontWeight:500, color:"var(--green)" }} />
                          <div style={{ fontSize:"12px", color:"var(--txt-3)" }}>{meal.totalKcal} kcal · {meal.totalProtein}g prot</div>
                        </div>
                        {(meal.items || []).map((item, ii) => (
                          <div key={ii} style={{ fontSize:"13px", color:"var(--txt)", lineHeight:1.8, display:"flex", alignItems:"center", gap:6 }}>
                            <Ed value={item.name} onChange={v => editNutItem(di, mi, ii, 'name', v)} style={{ color:"var(--cream)" }} />
                            <Ed value={item.quantity} onChange={v => editNutItem(di, mi, ii, 'quantity', v)} style={{ color:"var(--txt-3)", fontSize:"12px" }} />
                            <button onClick={() => deleteNutItem(di, mi, ii)} title="Supprimer"
                              style={{ marginLeft:"auto", background:"transparent", border:"none", color:"var(--txt-4)", cursor:"pointer", fontSize:"14px", lineHeight:1 }}>✕</button>
                          </div>
                        ))}
                        <button onClick={() => addNutItem(di, mi)}
                          style={{ marginTop:6, background:"transparent", border:"1px dashed var(--line)", borderRadius:"var(--r-sm)", color:"var(--green)", cursor:"pointer", fontSize:"12px", padding:"4px 10px" }}>+ aliment</button>
                        <Ed block value={meal.note || ''} onChange={v => editNutMeal(di, mi, 'note', v)}
                          style={{ fontSize:"12px", color:"var(--txt-2)", marginTop:6, fontStyle:"italic", borderBottom:"none", width:"100%" }} />
                      </div>
                    ))}
                  </div>
                ))}
                {/* Enregistrer comme modèle nutrition */}
                <div className="cx-inner" style={{ padding:"16px 18px", marginTop:12 }}>
                  <div className="t-label" style={{ marginBottom:10 }}>Enregistrer dans la bibliothèque</div>
                  <input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="Nom du modèle…"
                    className="cx-in" style={{ width:"100%", marginBottom:8 }}/>
                  <input value={templateDesc} onChange={e=>setTemplateDesc(e.target.value)} placeholder="Description (optionnel)…"
                    className="cx-in" style={{ width:"100%", marginBottom:10 }}/>
                  <button onClick={saveNutritionTemplate} disabled={!templateName.trim()||savingTemplate}
                    className="cx-btn cx-btn-ghost" style={{ width:"100%", padding:"10px 0", opacity:!templateName.trim()||savingTemplate?0.5:1 }}>
                    {savingTemplate?"…":"Sauver le modèle"}
                  </button>
                </div>
                <div style={{ display:"flex", gap:10, marginTop:16, position:"sticky", bottom:0, background:"var(--panel)", padding:"14px 0" }}>
                  <button onClick={() => setGeneratedProgram(null)} className="cx-btn cx-btn-ghost" style={{ flex:1, padding:"12px", fontSize:"13.5px" }}>
                    Regénérer
                  </button>
                  <button onClick={sendProgram} disabled={sendingProgram} className="cx-btn"
                    style={{ flex:2, padding:"12px", background:"var(--green)", border:"none", color:"#0e1a10", fontSize:"13.5px", fontWeight:600, cursor:sendingProgram?"not-allowed":"pointer", opacity:sendingProgram?0.6:1 }}>
                    {sendingProgram ? "Envoi…" : `Envoyer à ${programModal.name}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal muscu */}
      {muscuModal && (
        <div className="cx-scroll" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:100, overflowY:"auto", padding:16 }} onClick={()=>{ if(!muscuProgLoading){ setMuscuModal(null); setGeneratedMuscuProg(null); } }}>
          <div className="cx-modal" style={{ maxWidth:600, margin:"0 auto", padding:"26px 24px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div>
                <div style={{ fontFamily:"var(--serif)", fontSize:"22px", fontWeight:600, color:"var(--cream)" }}>Programme muscu</div>
                <div style={{ fontSize:"12.5px", color:"var(--txt-3)", marginTop:4 }}>{muscuModal.name} · entraînement personnalisé</div>
              </div>
              {!muscuProgLoading && <button onClick={()=>{ setMuscuModal(null); setGeneratedMuscuProg(null); }} style={{ background:"transparent", border:"none", fontSize:"22px", cursor:"pointer", color:"var(--txt-2)" }}>✕</button>}
            </div>

            {!generatedMuscuProg ? (
              <div>
                {/* Séances / semaine */}
                <div style={{ marginBottom:16 }}>
                  <div className="t-label" style={{ marginBottom:8 }}>Séances / semaine</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {[2,3,4,5,6].map(n => (
                      <button key={n} onClick={() => setMuscuProgConfig(p => ({ ...p, daysPerWeek: n }))}
                        className={`cx-chip${muscuProgConfig.daysPerWeek===n?' sel':''}`} style={{ flex:1 }}>{n}j</button>
                    ))}
                  </div>
                </div>
                {/* Objectif */}
                <div style={{ marginBottom:16 }}>
                  <div className="t-label" style={{ marginBottom:8 }}>Objectif</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {['prise de masse','sèche','force','remise en forme'].map(g => (
                      <button key={g} onClick={() => setMuscuProgConfig(p => ({ ...p, goal: g }))}
                        className={`cx-chip${muscuProgConfig.goal===g?' sel':''}`}>{g}</button>
                    ))}
                  </div>
                </div>
                {/* Niveau */}
                <div style={{ marginBottom:16 }}>
                  <div className="t-label" style={{ marginBottom:8 }}>Niveau</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {['débutant','intermédiaire','avancé'].map(l => (
                      <button key={l} onClick={() => setMuscuProgConfig(p => ({ ...p, level: l }))}
                        className={`cx-chip${muscuProgConfig.level===l?' sel':''}`} style={{ flex:1 }}>{l}</button>
                    ))}
                  </div>
                </div>
                {/* Matériel */}
                <div style={{ marginBottom:16 }}>
                  <div className="t-label" style={{ marginBottom:8 }}>Matériel</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {['salle','maison','haltères','barre seule','sans matériel'].map(eq => (
                      <button key={eq} onClick={() => setMuscuProgConfig(p => ({ ...p, equipment: eq }))}
                        className={`cx-chip${muscuProgConfig.equipment===eq?' sel':''}`}>{eq}</button>
                    ))}
                  </div>
                </div>
                {/* Préférences */}
                <div style={{ marginBottom:16 }}>
                  <div className="t-label" style={{ marginBottom:8 }}>Contraintes / préférences</div>
                  <input value={muscuProgConfig.preferences} onChange={e => setMuscuProgConfig(p => ({ ...p, preferences: e.target.value }))} placeholder="Ex: mal de dos, pas de squat, focus bras…"
                    className="cx-in" style={{ width:"100%" }}/>
                </div>
                {/* Depuis un modèle muscu */}
                {templates.filter(t=>t.type==='muscu').length > 0 && (
                  <div className="cx-inner" style={{ padding:"16px 18px", marginBottom:16 }}>
                    <div className="t-label" style={{ marginBottom:10 }}>Depuis un modèle</div>
                    {templates.filter(t=>t.type==='muscu').map(t=>(
                      <button key={t.id} onClick={()=>applyMuscuTemplate(t)} className="cx-tile"
                        style={{ width:"100%", display:"block", textAlign:"left", padding:"10px 12px", color:"var(--violet)", marginBottom:6 }}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {muscuProgError && <div style={{ background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:"var(--r-sm)", padding:"12px 14px", marginBottom:12, fontSize:"13px", color:"var(--red)" }}>{muscuProgError}</div>}
                <button onClick={generateCoachMuscuProgram} disabled={muscuProgLoading} className="cx-btn"
                  style={{ width:"100%", padding:"14px", background:"transparent", border:"1px solid var(--violet)", color:"var(--violet)", fontSize:"14px", fontWeight:600, cursor:muscuProgLoading?"not-allowed":"pointer", marginTop:4, opacity:muscuProgLoading?0.6:1 }}>
                  {muscuProgLoading ? "Génération en cours… (20-40s)" : "Générer le programme"}
                </button>
                {!muscuProgLoading && <button onClick={async()=>{
                  const empty = buildEmptyMuscuProgram(muscuProgConfig);
                  const res = await fetch('/api/coach/muscu-program',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athleteId:muscuModal.id, program:empty }) });
                  const data = await res.json();
                  if (data.program) setGeneratedMuscuProg(data.program);
                }} className="cx-btn cx-btn-ghost" style={{ width:"100%", padding:"13px", fontSize:"13.5px", marginTop:10 }}>
                  Remplir moi-même
                </button>}
              </div>
            ) : (
              <div>
                <div style={{ fontSize:"12.5px", color:"var(--violet)", marginBottom:10 }}>Tu peux modifier chaque champ avant d'envoyer</div>
                <div className="cx-inner" style={{ borderColor:"#2e2a40", padding:"16px 18px", marginBottom:16 }}>
                  <div className="t-label" style={{ color:"var(--violet)", marginBottom:6 }}>Conseils</div>
                  <Ed block value={generatedMuscuProg.weeklyNotes || ''} onChange={v => setGeneratedMuscuProg(p => ({ ...p, weeklyNotes: v }))}
                    style={{ fontSize:"13.5px", color:"var(--txt)", lineHeight:1.6, borderBottom:"none", width:"100%" }} />
                </div>
                {(generatedMuscuProg.days || []).map((day, di) => (
                  <div key={di} style={{ marginBottom:16 }}>
                    <div style={{ fontFamily:"var(--serif)", fontSize:"15px", color:"var(--gold)", fontWeight:600, marginBottom:8 }}>
                      {day.day} — <Ed value={day.label || ''} onChange={v => editMuscuDay(di, d => ({ ...d, label: v }))} style={{ fontFamily:"var(--sans)", fontWeight:400, color:"var(--txt-2)", fontSize:"13px" }} />
                    </div>
                    {(day.exercises||[]).map((ex, ei) => (
                      <div key={ei} className="cx-inner" style={{ padding:"10px 14px", marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                          <Ed value={ex.name} onChange={v => editMuscuEx(di, ei, 'name', v)} style={{ fontSize:"13.5px", fontWeight:500, color:"var(--cream)" }} />
                          <div style={{ fontSize:"12px", color:"var(--txt-3)", display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }}>
                            <Ed value={String(ex.sets ?? '')} onChange={v => editMuscuEx(di, ei, 'sets', v)} style={{ color:"var(--txt-2)" }} />×
                            <Ed value={String(ex.reps ?? '')} onChange={v => editMuscuEx(di, ei, 'reps', v)} style={{ color:"var(--txt-2)" }} /> ·
                            <Ed value={ex.rest || ''} onChange={v => editMuscuEx(di, ei, 'rest', v)} style={{ color:"var(--txt-2)" }} />
                            <button onClick={() => deleteMuscuEx(di, ei)} title="Supprimer"
                              style={{ background:"transparent", border:"none", color:"var(--txt-4)", cursor:"pointer", fontSize:"14px", lineHeight:1, marginLeft:4 }}>✕</button>
                          </div>
                        </div>
                        <Ed block value={ex.note || ''} onChange={v => editMuscuEx(di, ei, 'note', v)}
                          style={{ fontSize:"12px", color:"var(--txt-2)", marginTop:5, fontStyle:"italic", borderBottom:"none", width:"100%" }} />
                      </div>
                    ))}
                    <button onClick={() => addMuscuEx(di)}
                      style={{ background:"transparent", border:"1px dashed var(--line)", borderRadius:"var(--r-sm)", color:"var(--violet)", cursor:"pointer", fontSize:"12px", padding:"4px 10px" }}>+ exercice</button>
                  </div>
                ))}
                {/* Enregistrer comme modèle muscu */}
                <div className="cx-inner" style={{ padding:"16px 18px", marginTop:12 }}>
                  <div className="t-label" style={{ marginBottom:10 }}>Enregistrer dans la bibliothèque</div>
                  <input value={templateNameMuscu} onChange={e=>setTemplateNameMuscu(e.target.value)} placeholder="Nom du modèle…"
                    className="cx-in" style={{ width:"100%", marginBottom:8 }}/>
                  <input value={templateDescMuscu} onChange={e=>setTemplateDescMuscu(e.target.value)} placeholder="Description (optionnel)…"
                    className="cx-in" style={{ width:"100%", marginBottom:10 }}/>
                  <button onClick={saveMuscuTemplate} disabled={!templateNameMuscu.trim()||savingTemplateMuscu}
                    className="cx-btn cx-btn-ghost" style={{ width:"100%", padding:"10px 0", opacity:!templateNameMuscu.trim()||savingTemplateMuscu?0.5:1 }}>
                    {savingTemplateMuscu?"…":"Sauver le modèle"}
                  </button>
                </div>
                <div style={{ display:"flex", gap:10, marginTop:16, position:"sticky", bottom:0, background:"var(--panel)", padding:"14px 0" }}>
                  <button onClick={() => setGeneratedMuscuProg(null)} className="cx-btn cx-btn-ghost" style={{ flex:1, padding:"12px", fontSize:"13.5px" }}>
                    Regénérer
                  </button>
                  <button onClick={sendMuscuProgram} disabled={sendingMuscuProg} className="cx-btn"
                    style={{ flex:2, padding:"12px", background:"var(--violet)", border:"none", color:"#14101e", fontSize:"13.5px", fontWeight:600, cursor:sendingMuscuProg?"not-allowed":"pointer", opacity:sendingMuscuProg?0.6:1 }}>
                    {sendingMuscuProg ? "Envoi…" : `Envoyer à ${muscuModal.name}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal rapport */}
      {reportHtml && (
        <div className="cx-scroll" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, overflowY:"auto", padding:16 }} onClick={()=>{ setReportHtml(null); setReportSent(false); }}>
          <div style={{ maxWidth:640, margin:"0 auto", background:"#faf6ee", borderRadius:16, padding:"28px 24px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:"24px", color:"#2a1a00" }}>Rapport — {reportAthlete}</div>
                <div style={{ fontSize:"13.5px", color:"#8a7a5a", marginTop:2 }}>{reportDays}j · {new Date().toLocaleDateString("fr-FR")} · <span style={{ color:"#a08060" }}>Cliquez dans le texte pour modifier</span></div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => exportPDF(reportEditRef.current?.innerHTML || reportHtml, reportAthlete, reportDays)} style={{ background:"transparent", border:"1px solid #c8b890", borderRadius:8, padding:"5px 10px", fontSize:"12.5px", color:"var(--gold)", cursor:"pointer", fontFamily:"Georgia,serif" }}>⬇ PDF</button>
                <button onClick={()=>{ setReportHtml(null); setReportSent(false); }} style={{ background:"transparent", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#8a7a5a" }}>✕</button>
              </div>
            </div>
            <div
              ref={reportEditRef}
              contentEditable
              suppressContentEditableWarning
              style={{ fontFamily:"Georgia,serif", fontSize:"17px", color:"var(--panel)", lineHeight:1.7, outline:"none", minHeight:100, borderRadius:8, padding:"4px 0" }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportHtml) }}
            />
            <div style={{ marginTop:20, display:"flex", gap:8 }}>
              {reportSent ? (
                <div style={{ flex:1, padding:"12px", background:"#e8f5e8", border:"1px solid #7abf8a", borderRadius:10, color:"#3a7a3a", fontFamily:"Georgia,serif", fontSize:"14.5px", textAlign:"center" }}>
                  ✓ Rapport envoyé à {reportAthlete}
                </div>
              ) : (
                <button onClick={sendReportToPatient} disabled={reportSending || !reportAthleteId}
                  style={{ flex:1, padding:"12px", background:reportSending?"var(--txt)":"#2a1a00", border:"none", borderRadius:10, color:reportSending?"#8a7a5a":"#f0e6c8", fontFamily:"Georgia,serif", fontSize:"14.5px", fontWeight:500, cursor:reportSending||!reportAthleteId?"not-allowed":"pointer", opacity:!reportAthleteId?0.5:1 }}>
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
