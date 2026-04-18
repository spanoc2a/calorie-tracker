"use client";
import { useState, useEffect, useRef } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0d; font-family: 'DM Mono', monospace; color: #e8e0d0; min-height: 100vh; }
  .app { max-width: 480px; margin: 0 auto; padding: 24px 16px 100px; min-height: 100vh; }
  .header { text-align: center; margin-bottom: 24px; padding-top: 12px; }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 2rem; color: #f0e6c8; }
  .header .sub { font-size: 0.65rem; color: #6b6b5a; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
  .tabs { display: flex; gap: 8px; margin-bottom: 24px; }
  .tab { flex: 1; padding: 10px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 2px; text-transform: uppercase; color: #6b6b5a; cursor: pointer; transition: all 0.2s; }
  .tab.active { background: #c8b890; color: #0d0d0d; border-color: #c8b890; }
  .date-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 10px 14px; }
  .date-nav .date-label { font-size: 0.75rem; color: #c8b890; letter-spacing: 1px; }
  .date-nav button { background: none; border: none; color: #6b6b5a; cursor: pointer; font-size: 1.1rem; padding: 2px 8px; border-radius: 6px; transition: color 0.2s; }
  .date-nav button:hover { color: #c8b890; }
  .ring-wrap { display: flex; justify-content: center; align-items: center; margin-bottom: 24px; position: relative; }
  .ring-wrap svg { transform: rotate(-90deg); }
  .ring-center { position: absolute; text-align: center; }
  .ring-center .cals { font-family: 'Playfair Display', serif; font-size: 2.2rem; color: #f0e6c8; line-height: 1; }
  .ring-center .cals-label { font-size: 0.6rem; color: #6b6b5a; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .ring-center .goal-text { font-size: 0.65rem; color: #5a5a4a; margin-top: 4px; }
  .macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 24px; }
  .macro-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 12px 10px; text-align: center; }
  .macro-card .m-val { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: #f0e6c8; }
  .macro-card .m-label { font-size: 0.55rem; letter-spacing: 2px; text-transform: uppercase; color: #6b6b5a; margin-top: 2px; }
  .macro-card .m-bar { height: 3px; border-radius: 2px; margin-top: 8px; background: #2a2a2a; overflow: hidden; }
  .macro-card .m-bar-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .input-area { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 14px; margin-bottom: 12px; transition: border-color 0.2s; }
  .input-area:focus-within { border-color: #c8b890; }
  .input-area textarea { width: 100%; background: none; border: none; outline: none; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.82rem; resize: none; line-height: 1.5; min-height: 56px; }
  .input-area textarea::placeholder { color: #3d3d30; }
  .input-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 10px; border-top: 1px solid #222; gap: 8px; }
  .input-hint { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 1px; }
  .btn { background: #c8b890; color: #0d0d0d; border: none; border-radius: 8px; padding: 8px 14px; font-family: 'DM Mono', monospace; font-size: 0.72rem; font-weight: 500; letter-spacing: 1px; cursor: pointer; transition: background 0.2s, transform 0.1s; white-space: nowrap; }
  .btn:hover { background: #e0cfa8; }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { background: #3a3a2a; color: #5a5a4a; cursor: not-allowed; }
  .btn.secondary { background: #2a2a2a; color: #c8b890; border: 1px solid #3a3a2a; }
  .btn.secondary:hover { background: #3a3a2a; }
  .btn.danger { background: #3a1a1a; color: #c87070; border: 1px solid #5a2a2a; }
  .loading-row { display: flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: 16px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; font-size: 0.72rem; color: #6b6b5a; }
  .dot-pulse span { display: inline-block; width: 5px; height: 5px; background: #c8b890; border-radius: 50%; margin: 0 1px; animation: pulse 1.2s infinite; }
  .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
  .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%,80%,100% { opacity:0.2; transform:scale(0.8); } 40% { opacity:1; transform:scale(1); } }
  .section-label { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 10px; padding-left: 2px; }
  .entry { background: #1a1a1a; border: 1px solid #222; border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 10px; animation: fadeIn 0.3s ease; transition: border-color 0.2s; }
  .entry.selected { border-color: #c8b890; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .entry-check { width: 16px; height: 16px; accent-color: #c8b890; cursor: pointer; flex-shrink: 0; margin-top: 3px; }
  .entry-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 1px; }
  .entry-info { flex: 1; min-width: 0; }
  .entry-name { font-size: 0.8rem; color: #e8e0d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .entry-macros { font-size: 0.62rem; color: #5a5a4a; margin-top: 3px; }
  .entry-kcal { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #c8b890; flex-shrink: 0; text-align: right; }
  .entry-kcal span { display: block; font-family: 'DM Mono', monospace; font-size: 0.55rem; color: #4a4a3a; letter-spacing: 1px; }
  .del-btn { background: none; border: none; color: #3a3a2a; cursor: pointer; font-size: 0.9rem; padding: 0; margin-left: 4px; flex-shrink: 0; transition: color 0.2s; align-self: center; }
  .del-btn:hover { color: #8b4444; }
  .select-bar { display: flex; align-items: center; justify-content: space-between; background: #1e1a12; border: 1px solid #c8b890; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; gap: 10px; animation: fadeIn 0.2s ease; }
  .select-bar span { font-size: 0.68rem; color: #c8b890; letter-spacing: 1px; }
  .empty-state { text-align: center; padding: 32px 0; color: #3a3a2a; font-size: 0.72rem; letter-spacing: 2px; }
  .error-msg { background: #2a1a1a; border: 1px solid #5a2a2a; border-radius: 10px; padding: 10px 14px; font-size: 0.72rem; color: #c87070; margin-bottom: 12px; }
  .goal-row { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
  .goal-row label { font-size: 0.62rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; flex-shrink: 0; }
  .goal-row input { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 6px 10px; color: #c8b890; font-family: 'DM Mono', monospace; font-size: 0.8rem; width: 80px; text-align: center; outline: none; }
  .goal-row input:focus { border-color: #c8b890; }
  .goal-row .kcal-label { font-size: 0.6rem; color: #4a4a3a; }
  .recipe-card { background: #1a1a1a; border: 1px solid #222; border-radius: 12px; padding: 14px; margin-bottom: 8px; }
  .recipe-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; margin-bottom: 4px; }
  .recipe-card .recipe-name { font-family: 'Playfair Display', serif; font-size: 1rem; color: #f0e6c8; }
  .recipe-toggle { font-size: 0.65rem; color: #4a4a3a; }
  .recipe-card .recipe-info { font-size: 0.65rem; color: #5a5a4a; margin-bottom: 10px; }
  .ingredient-list { border-top: 1px solid #222; padding-top: 10px; margin-bottom: 10px; }
  .ingredient-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #161616; }
  .ingredient-row:last-child { border-bottom: none; }
  .ing-name { flex: 1; font-size: 0.72rem; color: #d0c8b8; }
  .ing-kcal { font-size: 0.65rem; color: #5a5a4a; min-width: 58px; text-align: right; }
  .recipe-actions { display: flex; gap: 8px; align-items: center; }
  .portion-ctrl { display: flex; align-items: center; gap: 5px; }
  .portion-ctrl button { background: #2a2a2a; border: 1px solid #3a3a2a; color: #c8b890; border-radius: 5px; width: 22px; height: 22px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .portion-ctrl button:hover { background: #3a3a2a; }
  .portion-val { font-size: 0.68rem; color: #c8b890; min-width: 26px; text-align: center; }
  .category-group { margin-bottom: 4px; }
  .category-header { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 3px; text-transform: uppercase; margin: 16px 0 8px; padding-left: 2px; border-bottom: 1px solid #1e1e1e; padding-bottom: 6px; }
  .cat-select { width: 100%; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.8rem; outline: none; margin-bottom: 12px; appearance: none; }
  .cat-select:focus { border-color: #c8b890; }
  .week-chart { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 16px; margin-bottom: 20px; }
  .week-chart .chart-title { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px; }
  .bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
  .bar { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.5s ease; min-height: 2px; }
  .bar-label { font-size: 0.55rem; color: #4a4a3a; letter-spacing: 1px; }
  .bar-val { font-size: 0.55rem; color: #6b6b5a; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
  .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 20px; width: 100%; max-width: 400px; }
  .modal h2 { font-family: 'Playfair Display', serif; font-size: 1.2rem; color: #f0e6c8; margin-bottom: 16px; }
  .modal input { width: 100%; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.8rem; outline: none; margin-bottom: 12px; }
  .modal input:focus { border-color: #c8b890; }
  .modal-actions { display: flex; gap: 8px; margin-top: 4px; }
`;

const MEAL_ICONS = ["🥗","🥩","🍳","🥑","🍎","🥦","🍚","🥛","🍞","🧀","🍗","🥚","🍜","🥜","🫐","🍌"];
function dateKey(d) { return d.toISOString().split("T")[0]; }
function formatDate(d) { return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
function getIcon(name) { return MEAL_ICONS[name.charCodeAt(0) % MEAL_ICONS.length]; }
const DAYS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const CATEGORIES = [
  { id: "petit_dej",       label: "Petit déjeuner" },
  { id: "collation_matin", label: "Collation matin" },
  { id: "dejeuner",        label: "Déjeuner" },
  { id: "collation_am",    label: "Collation après-midi" },
  { id: "diner",           label: "Dîner" },
];

function scale(item, mult) {
  return {
    name:    item.name,
    kcal:    Math.round(item.kcal    * mult),
    protein: Math.round(item.protein * mult * 10) / 10,
    carbs:   Math.round(item.carbs   * mult * 10) / 10,
    fat:     Math.round(item.fat     * mult * 10) / 10,
  };
}

function RecipeCard({ r, onAdd, onDelete }) {
  const [expanded, setExpanded]   = useState(false);
  const [mults,    setMults]      = useState({});

  function getMult(id) { return mults[id] ?? 1; }
  function changeMult(id, delta) {
    setMults(prev => ({ ...prev, [id]: Math.max(0.5, +((getMult(id) + delta).toFixed(1))) }));
  }

  const scaledItems = r.items.map(i => ({ ...scale(i, getMult(i.id)), id: i.id }));
  const totalKcal   = scaledItems.reduce((a, i) => a + i.kcal, 0);
  const hasChanges  = r.items.some(i => getMult(i.id) !== 1);

  return (
    <div className="recipe-card">
      <div className="recipe-header" onClick={() => setExpanded(e => !e)}>
        <div className="recipe-name">{r.name}</div>
        <span className="recipe-toggle">{expanded ? "▲" : "▼"}</span>
      </div>
      <div className="recipe-info">
        {r.items.length} ingrédient{r.items.length > 1 ? "s" : ""} · {totalKcal} kcal
        {hasChanges && <span style={{ color: "#c8b890" }}> (modifié)</span>}
      </div>

      {expanded && (
        <div className="ingredient-list">
          {r.items.map(i => (
            <div className="ingredient-row" key={i.id}>
              <span className="ing-name">{i.name}</span>
              <span className="ing-kcal">{Math.round(i.kcal * getMult(i.id))} kcal</span>
              <div className="portion-ctrl">
                <button onClick={e => { e.stopPropagation(); changeMult(i.id, -0.5); }}>−</button>
                <span className="portion-val">{getMult(i.id)}×</span>
                <button onClick={e => { e.stopPropagation(); changeMult(i.id, +0.5); }}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="recipe-actions">
        <button className="btn" style={{ fontSize: "0.65rem", padding: "7px 12px" }}
          onClick={() => onAdd(scaledItems)}>
          ➕ Ajouter
        </button>
        <button className="btn danger" style={{ fontSize: "0.65rem", padding: "7px 12px" }}
          onClick={onDelete}>
          🗑
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,          setTab]          = useState("journal");
  const [offset,       setOffset]       = useState(0);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [goal,         setGoal]         = useState(2000);
  const [entries,      setEntries]      = useState([]);
  const [recipes,      setRecipes]      = useState([]);
  const [weekData,     setWeekData]     = useState([]);
  const [saveModal,    setSaveModal]    = useState(false);
  const [recipeName,   setRecipeName]   = useState("");
  const [saveCategory, setSaveCategory] = useState("dejeuner");
  const [pendingItems, setPendingItems] = useState([]);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const textRef = useRef();

  const today = new Date();
  today.setDate(today.getDate() + offset);
  const key = dateKey(today);

  useEffect(() => {
    fetch(`/api/entries?date=${key}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries || []))
      .catch(e => console.error("Erreur entries:", e));
    setSelectedIds(new Set());
  }, [key]);

  useEffect(() => {
    fetch('/api/recipes')
      .then(r => r.json())
      .then(d => setRecipes(d.recipes || []));
  }, []);

  useEffect(() => {
    if (tab !== "stats") return;
    const promises = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return fetch(`/api/entries?date=${dateKey(d)}`)
        .then(r => r.json())
        .then(data => ({ day: DAYS[d.getDay()], kcal: (data.entries || []).reduce((a, e) => a + e.kcal, 0) }));
    });
    Promise.all(promises).then(setWeekData);
  }, [tab]);

  const totals = entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const pct       = totals.kcal / goal;
  const ringColor = pct > 1 ? "#c87070" : pct > 0.85 ? "#c8a060" : "#7abf8a";
  const circ      = 2 * Math.PI * 68;
  const dash      = Math.min(pct, 1) * circ;

  async function analyze() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input, date: key }) });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setEntries(prev => [...prev, ...data.items]);
      setInput("");
      textRef.current?.focus();
    } catch {
      setError("Impossible d'analyser. Réessaie.");
    }
    setLoading(false);
  }

  async function removeEntry(id) {
    await fetch('/api/entries', { method: 'DELETE', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: key, id }) });
    setEntries(prev => prev.filter(e => e.id !== id));
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function openSaveFromSelection() {
    const items = entries.filter(e => selectedIds.has(e.id));
    setPendingItems(items);
    setSaveModal(true);
  }

  async function saveRecipe() {
    if (!recipeName.trim() || pendingItems.length === 0) return;
    try {
      const res  = await fetch('/api/recipes', { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: recipeName, category: saveCategory, items: pendingItems }) });
      const data = await res.json();
      setRecipes(prev => [...prev, data.recipe]);
      setSaveModal(false);
      setRecipeName("");
      setPendingItems([]);
      setSelectedIds(new Set());
    } catch(e) {
      alert("Erreur lors de la sauvegarde : " + e.message);
    }
  }

  async function addRecipeToDay(scaledItems) {
    const res  = await fetch('/api/entries', { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: key, items: scaledItems }) });
    const data = await res.json();
    setEntries(prev => [...prev, ...data.items]);
    setTab("journal");
  }

  async function deleteRecipe(id) {
    await fetch('/api/recipes', { method: 'DELETE', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setRecipes(prev => prev.filter(r => r.id !== id));
  }

  const maxKcal = Math.max(...weekData.map(d => d.kcal), goal);

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <div className="header">
          <h1>Calories</h1>
          <div className="sub">journal nutritionnel</div>
        </div>

        <div className="tabs">
          {["journal","recettes","stats"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "journal" ? "📋 Journal" : t === "recettes" ? "🍲 Recettes" : "📊 Stats"}
            </button>
          ))}
        </div>

        {/* JOURNAL */}
        {tab === "journal" && (
          <>
            <div className="date-nav">
              <button onClick={() => setOffset(o => o - 1)}>←</button>
              <div className="date-label">{formatDate(today)}</div>
              <button onClick={() => setOffset(o => Math.min(o + 1, 0))} disabled={offset === 0} style={{ opacity: offset === 0 ? 0.2 : 1 }}>→</button>
            </div>
            <div className="ring-wrap">
              <svg width="170" height="170" viewBox="0 0 170 170">
                <circle cx="85" cy="85" r="68" fill="none" stroke="#1e1e1e" strokeWidth="10" />
                <circle cx="85" cy="85" r="68" fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s" }} />
              </svg>
              <div className="ring-center">
                <div className="cals">{totals.kcal}</div>
                <div className="cals-label">kcal</div>
                <div className="goal-text">/ {goal} objectif</div>
              </div>
            </div>
            <div className="macros">
              {[
                { label: "Protéines", val: totals.protein, max: 150, color: "#7a9abf" },
                { label: "Glucides",  val: totals.carbs,   max: 250, color: "#c8b890" },
                { label: "Lipides",   val: totals.fat,     max: 70,  color: "#bf9a7a" },
              ].map(m => (
                <div className="macro-card" key={m.label}>
                  <div className="m-val">{Math.round(m.val)}<span style={{ fontSize: "0.65rem", color: "#5a5a4a" }}>g</span></div>
                  <div className="m-label">{m.label}</div>
                  <div className="m-bar"><div className="m-bar-fill" style={{ width: `${Math.min(m.val / m.max * 100, 100)}%`, background: m.color }} /></div>
                </div>
              ))}
            </div>
            <div className="goal-row">
              <label>Objectif</label>
              <input type="number" value={goal} onChange={e => setGoal(Number(e.target.value))} min={500} max={5000} step={50} />
              <span className="kcal-label">kcal / jour</span>
            </div>
            <div className="input-area">
              <textarea ref={textRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyze(); } }}
                placeholder="Ex : 2 œufs brouillés, une tartine de beurre..." rows={3} />
              <div className="input-row">
                <span className="input-hint">ENTRÉE pour valider</span>
                <button className="btn" onClick={analyze} disabled={loading || !input.trim()}>{loading ? "..." : "ANALYSER"}</button>
              </div>
            </div>
            {loading && <div className="loading-row"><div className="dot-pulse"><span /><span /><span /></div>Analyse en cours…</div>}
            {error && <div className="error-msg">{error}</div>}
            {entries.length > 0 && (
              <>
                <div className="section-label">Repas du jour — {entries.length} entrée{entries.length > 1 ? "s" : ""}</div>
                {selectedIds.size > 0 && (
                  <div className="select-bar">
                    <span>{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
                    <button className="btn" style={{ fontSize: "0.65rem", padding: "7px 12px" }} onClick={openSaveFromSelection}>
                      💾 Créer une recette
                    </button>
                    <button className="btn secondary" style={{ fontSize: "0.65rem", padding: "7px 10px" }} onClick={() => setSelectedIds(new Set())}>
                      ✕
                    </button>
                  </div>
                )}
                {[...entries].reverse().map(e => (
                  <div className={`entry ${selectedIds.has(e.id) ? "selected" : ""}`} key={e.id}>
                    <input type="checkbox" className="entry-check" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} />
                    <div className="entry-icon">{getIcon(e.name)}</div>
                    <div className="entry-info">
                      <div className="entry-name">{e.name}</div>
                      <div className="entry-macros">P {e.protein}g · G {e.carbs}g · L {e.fat}g</div>
                    </div>
                    <div className="entry-kcal">{e.kcal}<span>kcal</span></div>
                    <button className="del-btn" onClick={() => removeEntry(e.id)}>✕</button>
                  </div>
                ))}
              </>
            )}
            {entries.length === 0 && !loading && <div className="empty-state">— aucun repas enregistré —</div>}
          </>
        )}

        {/* RECETTES */}
        {tab === "recettes" && (
          <>
            <div className="section-label">Mes recettes — {recipes.length}</div>
            {recipes.length === 0 && (
              <div className="empty-state">— aucune recette sauvegardée —<br/><br/>Dans le journal, cochez des aliments puis "Créer une recette"</div>
            )}
            {CATEGORIES.map(cat => {
              const catRecipes = recipes.filter(r => r.category === cat.id);
              if (catRecipes.length === 0) return null;
              return (
                <div className="category-group" key={cat.id}>
                  <div className="category-header">{cat.label}</div>
                  {catRecipes.map(r => (
                    <RecipeCard key={r.id} r={r} onAdd={items => addRecipeToDay(items)} onDelete={() => deleteRecipe(r.id)} />
                  ))}
                </div>
              );
            })}
            {recipes.filter(r => !r.category).length > 0 && (
              <div className="category-group">
                <div className="category-header">Sans catégorie</div>
                {recipes.filter(r => !r.category).map(r => (
                  <RecipeCard key={r.id} r={r} onAdd={items => addRecipeToDay(items)} onDelete={() => deleteRecipe(r.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <>
            <div className="week-chart">
              <div className="chart-title">Calories — 7 derniers jours</div>
              <div className="bars">
                {weekData.map((d, i) => (
                  <div className="bar-wrap" key={i}>
                    <div className="bar-val">{d.kcal > 0 ? d.kcal : ""}</div>
                    <div className="bar" style={{ height: `${(d.kcal / maxKcal) * 70}px`, background: d.kcal > goal ? "#c87070" : d.kcal > goal * 0.85 ? "#c8a060" : "#7abf8a" }} />
                    <div className="bar-label">{d.day}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="macros">
              {[
                { label: "Moy. calories", val: weekData.length ? Math.round(weekData.reduce((a,d)=>a+d.kcal,0) / (weekData.filter(d=>d.kcal>0).length || 1)) : 0, unit: "kcal" },
                { label: "Jours actifs",  val: weekData.filter(d=>d.kcal>0).length, unit: "/7" },
                { label: "Objectif",      val: goal, unit: "kcal" },
              ].map(m => (
                <div className="macro-card" key={m.label}>
                  <div className="m-val">{m.val}<span style={{ fontSize: "0.65rem", color: "#5a5a4a" }}>{m.unit}</span></div>
                  <div className="m-label">{m.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal sauvegarde recette */}
      {saveModal && (
        <div className="modal-overlay" onClick={() => setSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Sauvegarder la recette</h2>
            <input
              placeholder="Nom de la recette..."
              value={recipeName}
              onChange={e => setRecipeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveRecipe()}
              autoFocus
            />
            <select className="cat-select" value={saveCategory} onChange={e => setSaveCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn" onClick={saveRecipe} disabled={!recipeName.trim()}>Sauvegarder</button>
              <button className="btn secondary" onClick={() => setSaveModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
