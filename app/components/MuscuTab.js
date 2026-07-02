'use client';
import { useState, useEffect, useRef } from 'react';

export default function MuscuTab({ coachLinked, coachMuscuPrograms = [], selfMuscuAllowed = true }) {
  function buildEmptyMuscuProgram({ daysPerWeek=3, goal='prise de masse', level='intermédiaire', equipment='salle', preferences='' }) {
    const DAYS_MAP = { 2:['Lundi','Jeudi'], 3:['Lundi','Mercredi','Vendredi'], 4:['Lundi','Mardi','Jeudi','Vendredi'], 5:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], 6:['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'] };
    const trainingDays = DAYS_MAP[daysPerWeek] || DAYS_MAP[3];
    return { id:Date.now(), generatedAt:new Date().toISOString(), daysPerWeek, goal, level, equipment, preferences, weeklyNotes:'',
      days: trainingDays.map(day=>({ day, label:'', exercises:[] })) };
  }
  function parseSetInput(str) {
    const s = str.trim();
    const mbw = s.match(/^[xX×](\d+)$/);
    if (mbw) return { reps: parseInt(mbw[1]), bodyweight: true };
    const mw = s.match(/^(\d+(?:[.,]\d+)?)[xX×](\d+)$/);
    if (mw) return { weight: parseFloat(mw[1].replace(',','.')), reps: parseInt(mw[2]) };
    const mms = s.match(/^(\d+):(\d{2})$/);
    if (mms) return { duration: parseInt(mms[1])*60 + parseInt(mms[2]) };
    const ms = s.match(/^(\d+)s?$/);
    if (ms) return { duration: parseInt(ms[1]) };
    return null;
  }
  function fmtSet(s) {
    if (s.duration !== undefined) return s.duration >= 60 ? `${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,'0')}` : `${s.duration}s`;
    if (s.bodyweight) return `x${s.reps}`;
    return `${s.weight}x${s.reps}`;
  }
  function fmtSetDisplay(s) {
    if (s.duration !== undefined) return s.duration >= 60 ? `${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,'0')}` : `${s.duration}s`;
    if (s.bodyweight) return `PC × ${s.reps}`;
    return `${s.weight} kg × ${s.reps}`;
  }
  function calcVolume(sets) {
    return sets.filter(x=>!x.bodyweight&&x.duration===undefined).reduce((s,x)=>s+(x.weight||0)*(x.reps||0),0);
  }
  function parseRestSeconds(str) {
    if (!str) return 90;
    const s = String(str).trim();
    const mms = s.match(/^(\d+):(\d{2})$/);
    if (mms) return parseInt(mms[1])*60+parseInt(mms[2]);
    const mmin = s.match(/^(\d+)\s*(?:min|'|m)$/i);
    if (mmin) return parseInt(mmin[1])*60;
    const msec = s.match(/^(\d+)\s*s?$/i);
    if (msec) return parseInt(msec[1]);
    return 90;
  }

  const [muscuProgram,        setMuscuProgram]        = useState(null);
  const [muscuGenOpen,        setMuscuGenOpen]        = useState(false);
  const [muscuGenConfig,      setMuscuGenConfig]      = useState({ daysPerWeek:3, goal:'prise de masse', level:'intermédiaire', equipment:'salle', preferences:'' });
  const [muscuGenLoading,     setMuscuGenLoading]     = useState(false);
  const [muscuGenError,       setMuscuGenError]       = useState(null);
  const [muscuActiveDay,      setMuscuActiveDay]      = useState(0);
  const [muscuEditEx,         setMuscuEditEx]         = useState(null);
  const [muscuSets,           setMuscuSets]           = useState({});
  const [muscuPrevSets,       setMuscuPrevSets]       = useState({});
  const [muscuSetInput,       setMuscuSetInput]       = useState({});
  const [muscuHistoryEx,      setMuscuHistoryEx]      = useState(null);
  const [muscuHistory,        setMuscuHistory]        = useState([]);
  const [muscuHistoryLoading, setMuscuHistoryLoading] = useState(false);
  const [restTimerEnd,        setRestTimerEnd]        = useState(null);
  const [restTimerTotal,      setRestTimerTotal]      = useState(90);
  const [restTimerName,       setRestTimerName]       = useState('');
  const [restTimerRemaining,  setRestTimerRemaining]  = useState(0);
  const restIntervalRef = useRef(null);
  const [muscuWeekDates,      setMuscuWeekDates]      = useState([]);
  const [muscuEditSet,        setMuscuEditSet]        = useState({});
  const [muscuView,           setMuscuView]           = useState('program');
  const [muscuSessions,       setMuscuSessions]       = useState([]);
  const [muscuSessionsLoading,setMuscuSessionsLoading]= useState(false);
  const [sessionSummaryOpen,  setSessionSummaryOpen]  = useState(false);
  const [muscuToast,          setMuscuToast]          = useState(null);
  const toastTimerRef   = useRef(null);
  const newSetInputRefs = useRef({});

  function showMuscuToast(msg) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMuscuToast(msg);
    toastTimerRef.current = setTimeout(() => setMuscuToast(null), 1800);
  }

  useEffect(() => {
    if (!restTimerEnd) return;
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((restTimerEnd - Date.now()) / 1000));
      setRestTimerRemaining(rem);
      if (rem <= 0) {
        clearInterval(restIntervalRef.current);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([300, 100, 300]);
      }
    }, 500);
    return () => clearInterval(restIntervalRef.current);
  }, [restTimerEnd]);

  useEffect(() => {
    const FR_DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const todayName = FR_DAYS[new Date().getDay()];
    fetch('/api/muscu-program').then(r=>r.json()).then(d=>{
      if (d.program) {
        setMuscuProgram(d.program);
        const idx = (d.program.days||[]).findIndex(day => day.day === todayName);
        if (idx >= 0) setMuscuActiveDay(idx);
      }
    });
    const today0 = new Date().toISOString().slice(0,10);
    fetch(`/api/muscu-sets?date=${today0}`).then(r=>r.json()).then(d=>{ setMuscuSets(d.today||{}); setMuscuPrevSets(d.previous||{}); setMuscuWeekDates(d.weekDates||[]); });
  }, []);

  function startRestTimer(seconds, exName) {
    setRestTimerTotal(seconds);
    setRestTimerName(exName);
    setRestTimerEnd(Date.now() + seconds * 1000);
    setRestTimerRemaining(seconds);
  }

  async function openMuscuHistory(exercise) {
    setMuscuHistoryEx(exercise);
    setMuscuHistoryLoading(true);
    const d = await fetch(`/api/muscu-sets?history=1&exercise=${encodeURIComponent(exercise)}`).then(r=>r.json());
    setMuscuHistory(d.history || []);
    setMuscuHistoryLoading(false);
  }

  async function saveMuscuSets(exercise, sets) {
    const date = new Date().toISOString().slice(0,10);
    await fetch('/api/muscu-sets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ exercise, date, sets }) });
    setMuscuSets(prev => ({ ...prev, [exercise]: sets }));
  }

  async function generateMuscuProgram() {
    setMuscuGenLoading(true); setMuscuGenError(null);
    try {
      const res = await fetch('/api/muscu-program', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(muscuGenConfig) });
      let data;
      try { data = await res.json(); } catch { setMuscuGenError(`Erreur HTTP ${res.status} — réessaie`); setMuscuGenLoading(false); return; }
      if (data.program) { setMuscuProgram(data.program); setMuscuGenOpen(false); setMuscuActiveDay(0); }
      else setMuscuGenError(data.error || `Erreur ${res.status} — réessaie`);
    } catch(e) { setMuscuGenError('Erreur réseau — vérifie ta connexion et réessaie'); }
    setMuscuGenLoading(false);
  }

  async function saveMuscuEdit(updated) {
    setMuscuProgram(updated);
    await fetch('/api/muscu-program', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ program: updated }) });
  }

  async function loadMuscuSessions() {
    setMuscuSessionsLoading(true);
    const d = await fetch('/api/muscu-sets?sessions=20').then(r=>r.json());
    setMuscuSessions(d.sessions || []);
    setMuscuSessionsLoading(false);
  }

  const trainedThisWeek = muscuWeekDates.length;
  const coachMuscuProgram = coachMuscuPrograms[0];

  const genModal = (title) => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>setMuscuGenOpen(false)}>
      <div style={{ width:"100%", maxWidth:520, margin:"0 auto", background:"#111", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8", marginBottom:20 }}>{title}</div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:"0.6rem", color:"#5a5a4a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:6 }}>Séances / semaine</div>
          <div style={{ display:"flex", gap:6 }}>
            {[2,3,4,5,6].map(n=>(
              <button key={n} onClick={()=>setMuscuGenConfig(c=>({...c,daysPerWeek:n}))}
                style={{ flex:1, padding:"8px 4px", background:muscuGenConfig.daysPerWeek===n?"#c8b890":"#1a1a1a", color:muscuGenConfig.daysPerWeek===n?"#0d0d0d":"#5a5a4a", border:`1px solid ${muscuGenConfig.daysPerWeek===n?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.75rem", cursor:"pointer" }}>{n}j</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:"0.6rem", color:"#5a5a4a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:6 }}>Objectif</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {['prise de masse','sèche','force','remise en forme'].map(g=>(
              <button key={g} onClick={()=>setMuscuGenConfig(c=>({...c,goal:g}))}
                style={{ padding:"7px 12px", background:muscuGenConfig.goal===g?"#c8b890":"#1a1a1a", color:muscuGenConfig.goal===g?"#0d0d0d":"#5a5a4a", border:`1px solid ${muscuGenConfig.goal===g?"#c8b890":"#2a2a2a"}`, borderRadius:20, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:"0.6rem", color:"#5a5a4a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:6 }}>Niveau</div>
          <div style={{ display:"flex", gap:6 }}>
            {['débutant','intermédiaire','avancé'].map(l=>(
              <button key={l} onClick={()=>setMuscuGenConfig(c=>({...c,level:l}))}
                style={{ flex:1, padding:"7px 4px", background:muscuGenConfig.level===l?"#c8b890":"#1a1a1a", color:muscuGenConfig.level===l?"#0d0d0d":"#5a5a4a", border:`1px solid ${muscuGenConfig.level===l?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:"0.6rem", color:"#5a5a4a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:6 }}>Matériel</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {['salle','maison','haltères','barre seule','sans matériel'].map(eq=>(
              <button key={eq} onClick={()=>setMuscuGenConfig(c=>({...c,equipment:eq}))}
                style={{ padding:"7px 12px", background:muscuGenConfig.equipment===eq?"#c8b890":"#1a1a1a", color:muscuGenConfig.equipment===eq?"#0d0d0d":"#5a5a4a", border:`1px solid ${muscuGenConfig.equipment===eq?"#c8b890":"#2a2a2a"}`, borderRadius:20, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>{eq}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:"0.6rem", color:"#5a5a4a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:6 }}>Contraintes / préférences</div>
          <textarea value={muscuGenConfig.preferences} onChange={e=>setMuscuGenConfig(c=>({...c,preferences:e.target.value}))} placeholder="Ex: mal de dos, pas de squat, focus bras..."
            style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10, padding:"10px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.75rem", outline:"none", resize:"none", minHeight:60 }} />
        </div>

        {muscuGenError && <div className="error-msg" style={{ marginBottom:12 }}>⚠ {muscuGenError}</div>}

        <button className="btn" style={{ width:"100%" }} disabled={muscuGenLoading} onClick={generateMuscuProgram}>
          {muscuGenLoading ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="dot-pulse"><span/><span/><span/></span> Génération en cours…</span> : '✨ Générer'}
        </button>
        {!muscuGenLoading && <button onClick={()=>{ const p=buildEmptyMuscuProgram(muscuGenConfig); setMuscuProgram(p); fetch('/api/muscu-program',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({program:p})}); setMuscuGenOpen(false); setMuscuActiveDay(0); }}
          style={{ width:"100%", padding:"11px", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", letterSpacing:1, marginTop:8 }}>
          📝 Remplir moi-même
        </button>}
      </div>
    </div>
  );

  function renderSetTracker(exName, ex, keyPrefix) {
    const todaySets = muscuSets[exName] || [];
    const prevData = muscuPrevSets[exName];
    const ek = (si) => `${keyPrefix}-${si}`;
    const nwk = `${keyPrefix}-nw`;
    const vol = calcVolume(todaySets);
    const prevVol = prevData ? calcVolume(prevData.sets) : null;
    const allWeights = todaySets.map(s=>s.weight||0);
    const prevAllWeights = prevData ? prevData.sets.map(s=>s.weight||0) : [];
    const isPR = allWeights.length > 0 && Math.max(...allWeights) > (prevAllWeights.length > 0 ? Math.max(...prevAllWeights) : 0);
    const prevSet = prevData?.sets[todaySets.length];
    const prefill = prevSet ? fmtSet(prevSet) : '';
    const saveNew = async () => { const val = muscuSetInput[nwk]!==undefined ? muscuSetInput[nwk] : prefill; const parsed=parseSetInput(val); if(!parsed) return; await saveMuscuSets(exName,[...todaySets,parsed]); setMuscuSetInput(p=>{const n={...p}; delete n[nwk]; return n;}); startRestTimer(parseRestSeconds(ex.rest||'90'), exName); showMuscuToast('✓ Série enregistrée'); setTimeout(()=>newSetInputRefs.current[exName]?.focus(), 50); };
    const saveEdit = async (si) => { const parsed=parseSetInput(muscuEditSet[ek(si)]||''); if(!parsed) return; const ns=[...todaySets]; ns[si]=parsed; await saveMuscuSets(exName,ns); setMuscuEditSet(p=>{const n={...p}; delete n[ek(si)]; return n;}); showMuscuToast('✓ Série modifiée'); };
    return (
      <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #1e1e1e" }}>
        {prevData && <div style={{ fontSize:"0.56rem", color:"#2e2e2e", marginBottom:8 }}>Préc. {new Date(prevData.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} — {prevData.sets.map(s=>fmtSetDisplay(s)).join(' · ')}</div>}
        {todaySets.map((s,si) => (
          <div key={si} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, padding:"6px 10px", background:"#0f0f0f", borderRadius:8 }}>
            <span style={{ fontSize:"0.58rem", color:"#3a3a2a", width:50, flexShrink:0 }}>Série {si+1}</span>
            {muscuEditSet[ek(si)] !== undefined
              ? <>
                  <input autoFocus value={muscuEditSet[ek(si)]} onChange={e=>setMuscuEditSet(p=>({...p,[ek(si)]:e.target.value}))}
                    onKeyDown={async e=>{ if(e.key==='Enter') await saveEdit(si); if(e.key==='Escape'){setMuscuEditSet(p=>{const n={...p}; delete n[ek(si)]; return n;});}}}
                    style={{ flex:1, background:"#0d0d0d", border:"1px solid #c8b890", borderRadius:6, padding:"4px 8px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", outline:"none" }}/>
                  <button onClick={()=>saveEdit(si)} style={{ background:"none", border:"none", color:"#7abf8a", cursor:"pointer", fontSize:"0.75rem", padding:"0 4px" }}>✓</button>
                </>
              : <>
                  <span onClick={()=>setMuscuEditSet(p=>({...p,[ek(si)]:fmtSet(s)}))} style={{ flex:1, fontSize:"0.72rem", color:"#c8b890", cursor:"pointer" }}>{fmtSetDisplay(s)}</span>
                  <button onClick={async()=>{ await saveMuscuSets(exName,todaySets.filter((_,j)=>j!==si)); showMuscuToast('Série supprimée'); }} style={{ background:"none", border:"none", color:"#2a2a2a", cursor:"pointer", fontSize:"0.7rem", padding:"6px 8px", margin:"-6px -4px" }}>✕</button>
                </>
            }
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, marginBottom:4 }}>
          <span style={{ fontSize:"0.58rem", color:"#5a5a4a", width:50, flexShrink:0 }}>Série {todaySets.length+1}</span>
          <input ref={el => { newSetInputRefs.current[exName] = el; }}
            value={muscuSetInput[nwk]!==undefined ? muscuSetInput[nwk] : prefill}
            onChange={e=>setMuscuSetInput(p=>({...p,[nwk]:e.target.value}))}
            onFocus={()=>{ if(muscuSetInput[nwk]===undefined && prefill) setMuscuSetInput(p=>({...p,[nwk]:prefill})); }}
            onKeyDown={async e=>{ if(e.key==='Enter') await saveNew(); }}
            placeholder={prefill||"80x10 ou 60s"}
            style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:6, padding:"4px 8px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", outline:"none" }}/>
          <button onClick={saveNew} style={{ background:"#1e2a1e", border:"none", borderRadius:6, padding:"4px 10px", color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>✓</button>
        </div>
        {todaySets.length > 0 && !todaySets[0].duration && <div style={{ marginTop:4, fontSize:"0.57rem", color:"#4a4a3a", display:"flex", gap:10 }}>
          <span>Vol : <span style={{ color:"#5a5a5a" }}>{vol.toLocaleString('fr-FR')} kg</span></span>
          {prevVol !== null && <span style={{ color: vol >= prevVol ? "#5a8a5a" : "#8a5a5a" }}>{vol >= prevVol ? '↑' : '↓'} {Math.abs(vol-prevVol).toLocaleString('fr-FR')} vs préc.</span>}
          {isPR && <span style={{ color:"#c8b890" }}>🏆 PR</span>}
        </div>}
      </div>
    );
  }

  let content;

  if (coachLinked && coachMuscuProgram) {
    content = (
      <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
          <div style={{ fontSize:"0.6rem", color: trainedThisWeek > 0 ? "#7abf8a" : "#3a3a2a", background:"#0f0f0f", border:"1px solid #1a1a1a", borderRadius:20, padding:"4px 10px" }}>
            {trainedThisWeek > 0 ? `${trainedThisWeek} séance${trainedThisWeek>1?'s':''} cette semaine` : 'Pas encore entraîné cette semaine'}
          </div>
        </div>
        <div style={{ background:"#0d0d1a", border:"1px solid #2a2a4a", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
          <div style={{ fontSize:"0.55rem", color:"#5a5a8a", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Programme de ton coach</div>
          <div style={{ fontSize:"0.65rem", color:"#8a7abf" }}>{coachMuscuProgram.daysPerWeek}j/sem · {coachMuscuProgram.goal} · {coachMuscuProgram.level}</div>
          <div style={{ fontSize:"0.55rem", color:"#3a3a5a", marginTop:2 }}>envoyé le {new Date(coachMuscuProgram.sentAt||coachMuscuProgram.generatedAt).toLocaleDateString('fr-FR')}</div>
          {coachMuscuProgram.weeklyNotes && <div style={{ fontSize:"0.6rem", color:"#5a5a8a", marginTop:6, lineHeight:1.6, fontStyle:"italic" }}>{coachMuscuProgram.weeklyNotes}</div>}
        </div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:14, scrollbarWidth:"none" }}>
          {(coachMuscuProgram.days||[]).map((day, i) => (
            <button key={i} onClick={()=>{}} style={{ flexShrink:0, padding:"6px 10px", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", color:"#5a5a4a", cursor:"default" }}>
              {day.day?.slice(0,3)}
            </button>
          ))}
        </div>
        {(coachMuscuProgram.days||[]).map((day, di) => (
          <div key={di} style={{ marginBottom:14 }}>
            <div style={{ fontSize:"0.65rem", color:"#c8b890", fontWeight:500, marginBottom:6, letterSpacing:1 }}>{day.day} {day.label && <span style={{ color:"#5a5a4a", fontSize:"0.58rem" }}>— {day.label}</span>}</div>
            {(day.exercises||[]).length === 0
              ? <div style={{ fontSize:"0.6rem", color:"#3a3a2a", padding:"8px", background:"#0d0d0d", borderRadius:8 }}>Aucun exercice</div>
              : (day.exercises||[]).map((ex, ei) => (
                <div key={ei} style={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ fontSize:"0.68rem", color:"#c8b890" }}>{ex.name}</div>
                      {ex.name && <button onClick={()=>openMuscuHistory(ex.name)} style={{ background:"none", border:"none", color:"#3a3a2a", cursor:"pointer", fontSize:"0.7rem", padding:0, lineHeight:1 }}>📈</button>}
                    </div>
                    <div style={{ fontSize:"0.58rem", color:"#4a4a3a" }}>{ex.sets}×{ex.reps} · {ex.rest}</div>
                  </div>
                  {ex.note && <div style={{ fontSize:"0.55rem", color:"#4a4a3a", marginTop:4, fontStyle:"italic" }}>{ex.note}</div>}
                  {ex.name && renderSetTracker(ex.name, ex, `coach-${di}-${ei}`)}
                </div>
              ))
            }
          </div>
        ))}
      </div>
    );
  } else if (!muscuProgram && coachLinked) {
    content = (
      <div style={{ textAlign:"center", padding:"40px 16px" }}>
        <div style={{ fontSize:"1.6rem", marginBottom:10 }}>💪</div>
        <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>Ton coach s'occupe de tes entraînements</div>
        <div style={{ fontSize:"0.6rem", color:"#4a4a3a", lineHeight:1.7 }}>Tu recevras ton programme directement de sa part. En attendant, tu peux lui envoyer un message.</div>
      </div>
    );
  } else if (!muscuProgram) {
    content = (
      <div>
        <div style={{ textAlign:"center", padding:"32px 0 24px" }}>
          <div style={{ fontSize:"1.6rem", marginBottom:10 }}>💪</div>
          <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>Aucun programme muscu</div>
          <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginBottom:24, lineHeight:1.7 }}>Génère un programme personnalisé selon ton objectif, ton niveau et ton matériel disponible.</div>
          <button onClick={()=>setMuscuGenOpen(true)} style={{ padding:"11px 28px", background:"#1e1a12", border:"1px solid #c8b890", borderRadius:10, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", letterSpacing:1 }}>
            ✨ Générer mon programme
          </button>
        </div>
        {muscuGenOpen && genModal('✨ Générer un programme')}
      </div>
    );
  } else {
    const days = muscuProgram.days || [];
    const activeDay = days[muscuActiveDay];
    content = (
      <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
          <div style={{ fontSize:"0.6rem", color: trainedThisWeek > 0 ? "#7abf8a" : "#3a3a2a", background:"#0f0f0f", border:"1px solid #1a1a1a", borderRadius:20, padding:"4px 10px" }}>
            {trainedThisWeek > 0 ? `${trainedThisWeek} séance${trainedThisWeek>1?'s':''} cette semaine` : 'Pas encore entraîné cette semaine'}
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:"0.62rem", color:"#5a5a4a", letterSpacing:"2px", textTransform:"uppercase" }}>Programme muscu</div>
            {muscuProgram.goal && <div style={{ fontSize:"0.75rem", color:"#c8b890", marginTop:2, textTransform:"capitalize" }}>{muscuProgram.goal} · {muscuProgram.level} · {muscuProgram.equipment}</div>}
          </div>
          {!coachLinked && !coachMuscuProgram && <div style={{ display:"flex", gap:6 }}>
            <button className="btn secondary" style={{ fontSize:"0.6rem", padding:"6px 10px" }} onClick={()=>setMuscuGenOpen(true)}>↺ Regénérer</button>
            <button className="btn danger" style={{ fontSize:"0.6rem", padding:"6px 10px" }} onClick={async()=>{
              await fetch('/api/muscu-program',{method:'DELETE'}); setMuscuProgram(null);
            }}>🗑</button>
          </div>}
        </div>

        {days.length > 0 && (
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:14, scrollbarWidth:"none" }}>
            {days.map((d,i)=>(
              <button key={i} onClick={()=>setMuscuActiveDay(i)}
                style={{ flexShrink:0, padding:"7px 12px", background:muscuActiveDay===i?"#1e1a12":"#1a1a1a", border:`1px solid ${muscuActiveDay===i?"#c8b890":"#2a2a2a"}`, borderRadius:20, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color:muscuActiveDay===i?"#c8b890":"#5a5a4a", cursor:"pointer", whiteSpace:"nowrap" }}>
                {d.day}
              </button>
            ))}
            <button onClick={()=>{
              const newDay = { day:`Jour ${days.length+1}`, label:'', exercises:[] };
              const updated = { ...muscuProgram, days:[...days, newDay] };
              setMuscuActiveDay(days.length);
              saveMuscuEdit(updated);
            }} style={{ flexShrink:0, padding:"7px 12px", background:"#1a1a1a", border:"1px dashed #2a2a2a", borderRadius:20, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color:"#3a3a2a", cursor:"pointer" }}>+ Jour</button>
          </div>
        )}

        {activeDay && (
          <div>
            <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
              <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:4 }}>Séance</div>
              <input value={activeDay.label||''} onChange={e=>{
                const updated = { ...muscuProgram, days: days.map((d,i)=>i===muscuActiveDay?{...d,label:e.target.value}:d) };
                saveMuscuEdit(updated);
              }} placeholder="Ex: Push – Pectoraux / Épaules / Triceps"
                style={{ width:"100%", background:"none", border:"none", outline:"none", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.8rem" }} />
            </div>

            {(activeDay.exercises||[]).map((ex,ei)=>(
              <div key={ei} style={{ background:"#1a1a1a", border:`1px solid ${muscuEditEx?.dayIdx===muscuActiveDay&&muscuEditEx?.exIdx===ei?"#c8b890":"#222"}`, borderRadius:12, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, cursor:"pointer" }}
                  onClick={()=>setMuscuEditEx(muscuEditEx?.dayIdx===muscuActiveDay&&muscuEditEx?.exIdx===ei?null:{dayIdx:muscuActiveDay,exIdx:ei})}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ fontSize:"0.82rem", color:"#e8e0d0" }}>{ex.name}</div>
                      {ex.name && <button onClick={e=>{e.stopPropagation(); openMuscuHistory(ex.name);}} style={{ background:"none", border:"none", color:"#3a3a2a", cursor:"pointer", fontSize:"0.72rem", padding:0, lineHeight:1 }}>📈</button>}
                    </div>
                    <div style={{ fontSize:"0.65rem", color:"#5a5a4a", marginTop:3 }}>
                      {ex.sets} séries × {ex.reps} · repos {ex.rest}
                    </div>
                    {ex.note && <div style={{ fontSize:"0.62rem", color:"#4a4a3a", marginTop:3, fontStyle:"italic" }}>{ex.note}</div>}
                  </div>
                  <button onClick={e=>{e.stopPropagation(); const updated={...muscuProgram,days:days.map((d,i)=>i===muscuActiveDay?{...d,exercises:(d.exercises||[]).filter((_,j)=>j!==ei)}:d)}; saveMuscuEdit(updated);}} style={{ background:"none",border:"none",color:"#3a3a2a",cursor:"pointer",fontSize:"0.85rem",padding:0 }}>✕</button>
                </div>

                {ex.name && renderSetTracker(ex.name, ex, `ind-${muscuActiveDay}-${ei}`)}

                {muscuEditEx?.dayIdx===muscuActiveDay&&muscuEditEx?.exIdx===ei && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #2a2a2a", display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      {key:'name',label:'Exercice',placeholder:'Développé couché'},
                      {key:'sets',label:'Séries',placeholder:'4'},
                      {key:'reps',label:'Répétitions',placeholder:'8-10'},
                      {key:'rest',label:'Repos',placeholder:'90s'},
                      {key:'note',label:'Note technique',placeholder:'Optionnel'},
                    ].map(({key,label,placeholder})=>(
                      <div key={key} style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:"1px", textTransform:"uppercase", width:80, flexShrink:0 }}>{label}</div>
                        <input value={ex[key]||''} onChange={e=>{
                          const updated={...muscuProgram,days:days.map((d,i)=>i===muscuActiveDay?{...d,exercises:(d.exercises||[]).map((x,j)=>j===ei?{...x,[key]:e.target.value}:x)}:d)};
                          saveMuscuEdit(updated);
                        }} placeholder={placeholder}
                          style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 10px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", outline:"none" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button onClick={()=>{
              const newEx = { name:'', sets:3, reps:'10', rest:'60s', note:'' };
              const updated = { ...muscuProgram, days: days.map((d,i)=>i===muscuActiveDay?{...d,exercises:[...(d.exercises||[]),newEx]}:d) };
              saveMuscuEdit(updated);
              setMuscuEditEx({ dayIdx:muscuActiveDay, exIdx:(activeDay.exercises||[]).length });
            }} style={{ width:"100%", padding:"10px", background:"transparent", border:"1px dashed #2a2a2a", borderRadius:10, color:"#3a3a2a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer", marginBottom:14, transition:"all 0.2s" }}
              onMouseEnter={e=>e.target.style.borderColor="#c8b890"} onMouseLeave={e=>e.target.style.borderColor="#2a2a2a"}>
              + Ajouter un exercice
            </button>
          </div>
        )}

        {days.length === 0 && (
          <div style={{ textAlign:"center", color:"#3a3a2a", fontSize:"0.65rem", padding:"24px 0" }}>
            Aucune séance. Ajoute un jour.
          </div>
        )}

        {muscuProgram.weeklyNotes && (
          <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"12px 14px", marginTop:8 }}>
            <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:"2px", textTransform:"uppercase", marginBottom:6 }}>Conseils</div>
            <div style={{ fontSize:"0.72rem", color:"#8a8070", lineHeight:1.7 }}>{muscuProgram.weeklyNotes}</div>
          </div>
        )}

        {muscuGenOpen && genModal('✨ Regénérer le programme')}
      </div>
    );
  }

  const todayExercises = Object.entries(muscuSets).filter(([,sets])=>sets.length>0);
  const todayVolume = todayExercises.reduce((t,[,sets])=>t+calcVolume(sets),0);
  const todaySetsCount = todayExercises.reduce((t,[,sets])=>t+sets.length,0);

  return (
    <>
      {/* Tabs Programme / Historique */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {[{v:'program',l:'💪 Programme'},{v:'history',l:'📅 Historique'}].map(({v,l})=>(
          <button key={v} onClick={()=>{ setMuscuView(v); if(v==='history'&&!muscuSessions.length) loadMuscuSessions(); }}
            style={{ flex:1, padding:"9px", background:muscuView===v?"#1e1a12":"#1a1a1a", border:`1px solid ${muscuView===v?"#c8b890":"#2a2a2a"}`, borderRadius:10, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:muscuView===v?"#c8b890":"#5a5a4a", cursor:"pointer", transition:"all 0.2s" }}>
            {l}
          </button>
        ))}
      </div>

      {muscuView === 'program' && (
        <>
          {content}
          {todaySetsCount > 0 && (
            <button onClick={()=>setSessionSummaryOpen(true)}
              style={{ width:"100%", marginTop:16, padding:"12px", background:"#0d1a0d", border:"1px solid #2a5a2a", borderRadius:12, color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", cursor:"pointer", letterSpacing:1 }}>
              ✓ Terminer la séance
            </button>
          )}
        </>
      )}

      {muscuView === 'history' && (
        <div>
          {muscuSessionsLoading && <div style={{ textAlign:"center", color:"#4a4a3a", fontSize:"0.7rem", padding:"30px 0" }}>Chargement…</div>}
          {!muscuSessionsLoading && muscuSessions.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0" }}>
              <div style={{ fontSize:"1.4rem", marginBottom:10 }}>📭</div>
              <div style={{ fontSize:"0.7rem", color:"#4a4a3a" }}>Aucune séance enregistrée</div>
            </div>
          )}
          {muscuSessions.map((s, si) => (
            <div key={si} style={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:"0.7rem", color:"#c8b890", fontWeight:500 }}>{new Date(s.date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div>
                {s.totalVolume > 0 && <div style={{ fontSize:"0.6rem", color:"#5a8a5a", background:"#0d1a0d", border:"1px solid #1a3a1a", borderRadius:20, padding:"3px 10px" }}>{s.totalVolume.toLocaleString('fr-FR')} kg</div>}
              </div>
              {s.exercises.map((ex, ei) => (
                <div key={ei} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom: ei<s.exercises.length-1?"1px solid #1e1e1e":"none" }}>
                  <div style={{ fontSize:"0.65rem", color:"#8a8070" }}>{ex.name}</div>
                  <div style={{ fontSize:"0.6rem", color:"#4a4a3a" }}>{ex.sets.map(x=>fmtSetDisplay(x)).join(' · ')}</div>
                </div>
              ))}
            </div>
          ))}
          {muscuSessions.length > 0 && <div style={{ fontSize:"0.52rem", color:"#3a3a2a", textAlign:"center", marginTop:4 }}>20 dernières séances</div>}
        </div>
      )}

      {/* Modal résumé de séance */}
      {sessionSummaryOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>setSessionSummaryOpen(false)}>
          <div style={{ width:"100%", maxWidth:520, background:"#111", borderRadius:"20px 20px 0 0", padding:"28px 20px 40px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:"1.8rem", marginBottom:8 }}>🏁</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8" }}>Séance terminée</div>
              <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginTop:4 }}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[{l:'Exercices',v:todayExercises.length},{l:'Séries',v:todaySetsCount},{l:'Volume',v:todayVolume>0?`${todayVolume.toLocaleString('fr-FR')} kg`:'—'}].map(({l,v})=>(
                <div key={l} style={{ flex:1, background:"#1a1a1a", border:"1px solid #242424", borderRadius:10, padding:"12px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:"0.9rem", color:"#c8b890", fontWeight:500 }}>{v}</div>
                  <div style={{ fontSize:"0.5rem", color:"#4a4a3a", marginTop:3, letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:20 }}>
              {todayExercises.map(([name, sets], i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: i<todayExercises.length-1?"1px solid #1e1e1e":"none" }}>
                  <div style={{ fontSize:"0.65rem", color:"#c8b890" }}>{name}</div>
                  <div style={{ fontSize:"0.6rem", color:"#5a5a4a" }}>{sets.map(x=>fmtSetDisplay(x)).join(' · ')}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setSessionSummaryOpen(false)}
              style={{ width:"100%", padding:"12px", background:"#0d1a0d", border:"1px solid #2a5a2a", borderRadius:12, color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Toast confirmation */}
      {muscuToast && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", zIndex:9998, background:"#1a2a1a", border:"1px solid #3a7a3a", borderRadius:20, padding:"8px 18px", fontSize:"0.65rem", color:"#7abf8a", fontFamily:"'DM Mono',monospace", letterSpacing:1, boxShadow:"0 4px 16px rgba(0,0,0,0.6)", whiteSpace:"nowrap", pointerEvents:"none" }}>
          {muscuToast}
        </div>
      )}

      {/* Timer repos */}
      {restTimerEnd !== null && (
        <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, background:"#1a1a1a", border:"1px solid #c8b890", borderRadius:16, padding:"10px 18px", display:"flex", alignItems:"center", gap:14, boxShadow:"0 4px 24px rgba(0,0,0,0.8)", minWidth:260, maxWidth:380, width:"90%" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"0.55rem", color:"#c8b890", letterSpacing:2, textTransform:"uppercase", marginBottom:5 }}>Repos — {restTimerName}</div>
            <div style={{ height:4, background:"#2a2a2a", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"#c8b890", borderRadius:2, width:`${Math.max(0,(restTimerRemaining/restTimerTotal)*100)}%`, transition:"width 0.5s linear" }}/>
            </div>
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.6rem", color: restTimerRemaining <= 0 ? "#7abf8a" : "#c8b890", minWidth:52, textAlign:"center" }}>
            {restTimerRemaining <= 0 ? "Go !" : restTimerRemaining >= 60 ? `${Math.floor(restTimerRemaining/60)}:${String(restTimerRemaining%60).padStart(2,'0')}` : `${restTimerRemaining}s`}
          </div>
          <button onClick={()=>{ setRestTimerEnd(null); setRestTimerRemaining(0); }} style={{ background:"none", border:"none", color:"#4a4a3a", cursor:"pointer", fontSize:"1.1rem", padding:0 }}>✕</button>
        </div>
      )}

      {/* Modal historique exercice */}
      {muscuHistoryEx && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, display:"flex", alignItems:"flex-end" }} onClick={()=>setMuscuHistoryEx(null)}>
          <div style={{ width:"100%", maxWidth:520, margin:"0 auto", background:"#111", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px", maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8" }}>{muscuHistoryEx}</div>
                <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginTop:2 }}>Historique</div>
              </div>
              <button onClick={()=>setMuscuHistoryEx(null)} style={{ background:"none", border:"none", color:"#4a4a3a", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>
            {muscuHistoryLoading
              ? <div style={{ textAlign:"center", color:"#4a4a3a", fontSize:"0.7rem", padding:"20px 0" }}>Chargement…</div>
              : muscuHistory.length === 0
                ? <div style={{ textAlign:"center", color:"#3a3a2a", fontSize:"0.7rem", padding:"20px 0" }}>Aucune donnée enregistrée</div>
                : (() => {
                    const isTime = muscuHistory.some(s => s.sets.some(x => x.duration !== undefined));
                    const calc1RM = (weight, reps) => reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
                    const vals = muscuHistory.map(s => isTime
                      ? s.sets.reduce((max,x)=>Math.max(max,x.duration||0),0)
                      : s.sets.reduce((max,x)=>Math.max(max,x.weight||0),0));
                    const oneRMs = !isTime ? muscuHistory.map(s => s.sets.filter(x=>x.weight&&x.reps).reduce((max,x)=>Math.max(max,calc1RM(x.weight,x.reps)),0)) : [];
                    const best1RM = oneRMs.length > 0 ? Math.max(...oneRMs) : 0;
                    const maxVal = Math.max(...vals, 1);
                    return (
                      <>
                        {best1RM > 0 && (
                          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                            <div style={{ flex:1, background:"#1a1a12", border:"1px solid #2a2a1a", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                              <div style={{ fontSize:"1rem", color:"#c8b890", fontWeight:500 }}>{best1RM} kg</div>
                              <div style={{ fontSize:"0.48rem", color:"#5a5a4a", marginTop:3, letterSpacing:1, textTransform:"uppercase" }}>1RM estimé</div>
                            </div>
                            <div style={{ flex:1, background:"#1a1a1a", border:"1px solid #222", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                              <div style={{ fontSize:"1rem", color:"#c8b890", fontWeight:500 }}>{Math.max(...vals)} kg</div>
                              <div style={{ fontSize:"0.48rem", color:"#5a5a4a", marginTop:3, letterSpacing:1, textTransform:"uppercase" }}>Max soulevé</div>
                            </div>
                            <div style={{ flex:1, background:"#1a1a1a", border:"1px solid #222", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                              <div style={{ fontSize:"1rem", color:"#c8b890", fontWeight:500 }}>{muscuHistory.length}</div>
                              <div style={{ fontSize:"0.48rem", color:"#5a5a4a", marginTop:3, letterSpacing:1, textTransform:"uppercase" }}>Séances</div>
                            </div>
                          </div>
                        )}
                        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:96, marginBottom:8 }}>
                          {muscuHistory.map((s,i) => (
                            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                              <div style={{ fontSize:"0.48rem", color:"#5a5a4a" }}>{isTime?(vals[i]>=60?`${Math.floor(vals[i]/60)}:${String(vals[i]%60).padStart(2,'0')}`:`${vals[i]}s`):`${vals[i]}`}</div>
                              <div style={{ width:"100%", background:i===muscuHistory.length-1?"#c8b890":"#2a2a2a", borderRadius:"3px 3px 0 0", height:`${Math.round((vals[i]/maxVal)*70)}px`, minHeight:4 }}/>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:"flex", gap:4, marginBottom:18 }}>
                          {muscuHistory.map((s,i) => (
                            <div key={i} style={{ flex:1, textAlign:"center", fontSize:"0.44rem", color:"#3a3a2a" }}>
                              {new Date(s.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop:"1px solid #1a1a1a", paddingTop:14, display:"flex", flexDirection:"column", gap:9 }}>
                          {[...muscuHistory].reverse().map((s,i) => (
                            <div key={i} style={{ display:"flex", alignItems:"baseline", gap:10 }}>
                              <div style={{ fontSize:"0.6rem", color:"#3a3a2a", width:70, flexShrink:0 }}>{new Date(s.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'})}</div>
                              <div style={{ fontSize:"0.68rem", color:"#5a5a4a", flex:1 }}>{s.sets.map(x=>fmtSetDisplay(x)).join(' · ')}</div>
                              {!isTime && <div style={{ fontSize:"0.58rem", color:"#3a3a2a", flexShrink:0 }}>{calcVolume(s.sets).toLocaleString('fr-FR')} kg</div>}
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()
            }
          </div>
        </div>
      )}
    </>
  );
}
