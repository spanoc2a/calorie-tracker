"use client";
import { useState, useEffect, useRef } from "react";
import MuscuTab from "./components/MuscuTab";
import { sanitizeHtml } from "./lib/sanitize";
import { useLocale } from "./lib/i18n";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0d; font-family: 'DM Mono', monospace; color: #e8e0d0; min-height: 100vh; }
  .app { max-width: 480px; margin: 0 auto; padding: 24px 16px 100px; min-height: 100vh; overflow-x: hidden; width: 100%; }
  .header { text-align: center; margin-bottom: 24px; padding-top: 12px; }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 2rem; color: #f0e6c8; }
  .header .sub { font-size: 0.65rem; color: #6b6b5a; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
  .tabs { display: flex; gap: 6px; margin-bottom: 24px; }
  .tab { flex: 1; padding: 10px 2px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 1px; text-transform: uppercase; color: #6b6b5a; cursor: pointer; transition: all 0.2s; }
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
  .macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
  .macro-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 12px 10px; text-align: center; }
  .macro-card .m-val { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: #f0e6c8; }
  .macro-card .m-label { font-size: 0.62rem; letter-spacing: 2px; text-transform: uppercase; color: #6b6b5a; margin-top: 2px; }
  .macro-card .m-goal { font-size: 0.62rem; color: #3a3a2a; margin-top: 2px; }
  .macro-card .m-bar { height: 3px; border-radius: 2px; margin-top: 8px; background: #2a2a2a; overflow: hidden; }
  .macro-card .m-bar-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .goals-section { margin-bottom: 20px; }
  .goals-kcal-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .goals-kcal-row label { font-size: 0.62rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; flex-shrink: 0; }
  .goals-kcal-row input { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 6px 10px; color: #c8b890; font-family: 'DM Mono', monospace; font-size: 0.8rem; width: 80px; text-align: center; outline: none; }
  .goals-kcal-row input:focus { border-color: #c8b890; }
  .goals-kcal-row .kcal-label { font-size: 0.6rem; color: #4a4a3a; }
  .macro-goals-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .macro-goal-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .macro-goal-cell label { font-size: 0.55rem; color: #4a4a3a; letter-spacing: 1px; text-transform: uppercase; }
  .macro-goal-inp { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 5px 6px; color: #c8b890; font-family: 'DM Mono', monospace; font-size: 0.72rem; width: 100%; text-align: center; outline: none; }
  .macro-goal-inp:focus { border-color: #c8b890; }
  .macro-goal-cell .unit { font-size: 0.55rem; color: #3a3a2a; }
  .favs-wrap { margin-bottom: 12px; }
  .favs-label { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .favs-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .favs-scroll::-webkit-scrollbar { display: none; }
  .fav-chip { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 20px; padding: 6px 14px; font-size: 0.65rem; color: #c8b890; white-space: nowrap; cursor: pointer; transition: border-color 0.2s; flex-shrink: 0; }
  .fav-chip:hover { border-color: #c8b890; }
  .fav-expand { display: flex; align-items: center; gap: 6px; background: #1e1a12; border: 1px solid #c8b890; border-radius: 20px; padding: 4px 8px; flex-shrink: 0; }
  .fav-expand .fav-name { font-size: 0.65rem; color: #c8b890; white-space: nowrap; }
  .fav-qty-inp { width: 44px; background: #0d0d0d; border: 1px solid #3a3a2a; border-radius: 6px; color: #c8b890; font-family: 'DM Mono', monospace; font-size: 0.65rem; padding: 2px 4px; text-align: center; outline: none; }
  .fav-qty-inp:focus { border-color: #c8b890; }
  .fav-unit { font-size: 0.6rem; color: #5a5a4a; }
  .meal-selector { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }
  .meal-pill { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:20px; padding:5px 12px; font-family:'DM Mono',monospace; font-size:0.6rem; color:#5a5a4a; cursor:pointer; letter-spacing:1px; transition:all 0.15s; }
  .meal-pill.active { border-color:#c8b890; color:#c8b890; background:#1f1e18; }
  .meal-group-header { font-family:'DM Mono',monospace; font-size:0.65rem; color:#4a4a3a; letter-spacing:2px; text-transform:uppercase; padding:10px 0 4px; border-bottom:1px solid #1a1a1a; margin-bottom:6px; }
  .input-area { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 14px; margin-bottom: 12px; transition: border-color 0.2s; }
  .input-area:focus-within { border-color: #c8b890; }
  .input-area textarea { width: 100%; background: none; border: none; outline: none; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.82rem; resize: none; line-height: 1.5; min-height: 56px; word-break: break-word; overflow-wrap: break-word; }
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
  @keyframes slideUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
  .entry-check { width: 16px; height: 16px; accent-color: #c8b890; cursor: pointer; flex-shrink: 0; margin-top: 3px; }
  .entry-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 1px; }
  .entry-info { flex: 1; min-width: 0; }
  .entry-name { font-size: 0.8rem; color: #e8e0d0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .entry-name.clickable { cursor: pointer; }
  .entry-macros { font-size: 0.62rem; color: #5a5a4a; margin-top: 3px; }
  .journal-ing-list { margin-top: 8px; padding-top: 8px; border-top: 1px solid #222; width: 100%; }
  .journal-ing-row { display: flex; justify-content: space-between; font-size: 0.65rem; color: #5a5a4a; padding: 3px 0; }
  .journal-ing-row span:first-child { color: #8a8070; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
  .entry-kcal { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #c8b890; flex-shrink: 0; text-align: right; }
  .entry-kcal span { display: block; font-family: 'DM Mono', monospace; font-size: 0.62rem; color: #4a4a3a; letter-spacing: 1px; }
  .del-btn { background: none; border: none; color: #3a3a2a; cursor: pointer; font-size: 0.9rem; padding: 6px 8px; margin-left: 0; flex-shrink: 0; transition: color 0.2s; align-self: center; }
  .del-btn:hover { color: #8b4444; }
  .select-bar { display: flex; align-items: center; justify-content: space-between; background: #1e1a12; border: 1px solid #c8b890; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; gap: 10px; animation: fadeIn 0.2s ease; }
  .select-bar span { font-size: 0.68rem; color: #c8b890; letter-spacing: 1px; }
  .empty-state { text-align: center; padding: 32px 0; color: #3a3a2a; font-size: 0.72rem; letter-spacing: 2px; }
  .error-msg { background: #2a1a1a; border: 1px solid #5a2a2a; border-radius: 10px; padding: 10px 14px; font-size: 0.72rem; color: #c87070; margin-bottom: 12px; }
  .recipe-card { background: #1a1a1a; border: 1px solid #222; border-radius: 12px; padding: 14px; margin-bottom: 8px; }
  .recipe-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; margin-bottom: 4px; gap: 8px; }
  .recipe-card .recipe-name { font-family: 'Playfair Display', serif; font-size: 1rem; color: #f0e6c8; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recipe-name-input { font-family: 'Playfair Display', serif; font-size: 1rem; color: #f0e6c8; background: #0d0d0d; border: 1px solid #c8b890; border-radius: 6px; padding: 2px 8px; outline: none; width: 100%; }
  .recipe-toggle { font-size: 0.65rem; color: #4a4a3a; flex-shrink: 0; }
  .edit-name-btn { background: none; border: none; color: #3a3a2a; cursor: pointer; font-size: 0.75rem; padding: 2px 4px; flex-shrink: 0; transition: color 0.2s; }
  .edit-name-btn:hover { color: #c8b890; }
  .recipe-card .recipe-info { font-size: 0.65rem; color: #5a5a4a; margin-bottom: 10px; }
  .ingredient-list { border-top: 1px solid #222; padding-top: 10px; margin-bottom: 10px; }
  .ingredient-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #161616; }
  .ingredient-row:last-child { border-bottom: none; }
  .ing-name { flex: 1; font-size: 0.72rem; color: #d0c8b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .ing-kcal { font-size: 0.65rem; color: #5a5a4a; min-width: 58px; text-align: right; }
  .ing-qty-wrap { display: flex; align-items: center; gap: 4px; }
  .ing-qty-input { background: #0d0d0d; border: 1px solid #3a3a2a; border-radius: 5px; color: #c8b890; font-family: 'DM Mono', monospace; font-size: 0.72rem; width: 52px; padding: 3px 6px; text-align: center; outline: none; }
  .ing-qty-input:focus { border-color: #c8b890; }
  .ing-unit { font-size: 0.65rem; color: #5a5a4a; min-width: 24px; }
  .recipe-actions { display: flex; gap: 8px; align-items: center; }
  .portion-ctrl { display: flex; align-items: center; gap: 5px; }
  .portion-ctrl button { background: #2a2a2a; border: 1px solid #3a3a2a; color: #c8b890; border-radius: 5px; width: 22px; height: 22px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .portion-ctrl button:hover { background: #3a3a2a; }
  .portion-val { font-size: 0.68rem; color: #c8b890; min-width: 26px; text-align: center; }
  .category-group { margin-bottom: 4px; }
  .category-header { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 3px; text-transform: uppercase; margin: 16px 0 8px; padding-left: 2px; border-bottom: 1px solid #1e1e1e; padding-bottom: 6px; }
  .subtabs { display: flex; gap: 6px; margin-bottom: 20px; }
  .subtab { flex: 1; padding: 8px; background: #141414; border: 1px solid #222; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 2px; text-transform: uppercase; color: #5a5a4a; cursor: pointer; }
  .subtab.active { background: #1e1e1e; color: #c8b890; border-color: #3a3a2a; }
  .macro-section { margin-bottom: 8px; }
  .macro-section-header { font-size: 0.75rem; font-family: 'Playfair Display', serif; color: #f0e6c8; margin: 20px 0 4px; padding-bottom: 6px; border-bottom: 1px solid #2a2a2a; }
  .food-cat-header { font-size: 0.65rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; margin: 10px 0 6px; padding-left: 2px; }
  .ing-card { background: #1a1a1a; border: 1px solid #1e1e1e; border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; transition: border-color 0.2s; }
  .ing-card.selected { border-color: #c8b890; }
  .ing-card-name { flex: 1; font-size: 0.78rem; color: #d0c8b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .ing-card-ref { font-size: 0.58rem; color: #3a3a2a; margin-top: 2px; letter-spacing: 1px; }
  .ing-card-macros { font-size: 0.6rem; color: #5a5a4a; text-align: right; line-height: 1.6; }
  .ing-card-kcal { font-family: 'Playfair Display', serif; font-size: 1rem; color: #c8b890; flex-shrink: 0; min-width: 44px; text-align: right; }
  .ing-qty-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #222; }
  .ing-qty-row label { font-size: 0.6rem; color: #5a5a4a; letter-spacing: 1px; flex-shrink: 0; }
  .builder-preview { background: #1e1a12; border: 1px solid #3a3520; border-radius: 12px; padding: 14px; margin-top: 16px; }
  .builder-preview h3 { font-family: 'Playfair Display', serif; font-size: 1rem; color: #f0e6c8; margin-bottom: 10px; }
  .builder-totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
  .builder-total-cell { text-align: center; }
  .builder-total-val { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #c8b890; }
  .builder-total-label { font-size: 0.62rem; color: #5a5a4a; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .builder-items { font-size: 0.65rem; color: #4a4a3a; margin-bottom: 12px; line-height: 1.8; }
  .cat-select { width: 100%; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.8rem; outline: none; margin-bottom: 12px; appearance: none; }
  .cat-select:focus { border-color: #c8b890; }
  .week-chart { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 16px; margin-bottom: 20px; }
  .week-chart .chart-title { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px; }
  .bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; }
  .bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
  .bar { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.5s ease; min-height: 2px; }
  .bar-label { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 1px; }
  .bar-val { font-size: 0.6rem; color: #6b6b5a; }
  .range-toggle { display: flex; gap: 6px; margin-bottom: 16px; }
  .range-btn { flex: 1; padding: 7px; background: #141414; border: 1px solid #222; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 2px; color: #5a5a4a; cursor: pointer; text-align: center; }
  .range-btn.active { background: #1e1e1e; color: #c8b890; border-color: #3a3a2a; }
  .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
  .stat-cell { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px; text-align: center; }
  .stat-val { font-family: 'Playfair Display', serif; font-size: 1.4rem; color: #c8b890; }
  .stat-unit { font-size: 0.65rem; color: #5a5a4a; }
  .stat-label { font-size: 0.62rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
  .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 20px; width: 100%; max-width: 400px; max-height: 90vh; overflow-y: auto; }
  .modal h2 { font-family: 'Playfair Display', serif; font-size: 1.2rem; color: #f0e6c8; margin-bottom: 16px; }
  .modal input[type="text"], .modal input[type="number"] { width: 100%; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #e8e0d0; font-family: 'DM Mono', monospace; font-size: 0.8rem; outline: none; margin-bottom: 12px; }
  .modal input:focus { border-color: #c8b890; }
  .modal-actions { display: flex; gap: 8px; margin-top: 4px; }
  .upload-zone { border: 1px dashed #3a3a2a; border-radius: 14px; padding: 28px 20px; text-align: center; cursor: pointer; transition: border-color 0.2s; margin-bottom: 16px; }
  .upload-zone:hover { border-color: #c8b890; }
  .upload-zone .up-icon { font-size: 2rem; margin-bottom: 8px; }
  .upload-zone .up-text { font-size: 0.72rem; color: #5a5a4a; letter-spacing: 1px; }
  .upload-zone .up-hint { font-size: 0.6rem; color: #3a3a2a; margin-top: 4px; }
  .blood-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
  .blood-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; gap: 8px; cursor: pointer; }
  .blood-card-title { font-family: 'Playfair Display', serif; font-size: 1rem; color: #f0e6c8; }
  .blood-card-date { font-size: 0.6rem; color: #4a4a3a; flex-shrink: 0; }
  .blood-summary { font-size: 0.7rem; color: #6b6b5a; margin-bottom: 12px; line-height: 1.5; }
  .blood-marker-row { display: flex; align-items: center; gap: 6px; padding: 5px 0; border-bottom: 1px solid #161616; }
  .blood-marker-row:last-child { border-bottom: none; }
  .marker-name { font-size: 0.68rem; color: #8a8070; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .marker-value { font-size: 0.72rem; font-family: 'DM Mono', monospace; flex-shrink: 0; }
  .marker-ref { font-size: 0.6rem; color: #3a3a2a; flex-shrink: 0; }
  .status-ok { color: #7abf8a; }
  .status-warn { color: #c8a060; }
  .status-bad { color: #c87070; }
  .reco-section { border-top: 1px solid #2a2a2a; padding-top: 12px; margin-top: 12px; }
  .reco-group-label { font-size: 0.6rem; letter-spacing: 2px; text-transform: uppercase; margin: 10px 0 6px; }
  .reco-eat-label { color: #7abf8a; }
  .reco-avoid-label { color: #c87070; }
  .reco-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid #161616; }
  .reco-row:last-child { border-bottom: none; }
  .reco-emoji { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
  .reco-body { flex: 1; min-width: 0; }
  .reco-food-name { font-size: 0.75rem; color: #e8e0d0; }
  .reco-reason { font-size: 0.62rem; color: #5a5a4a; margin-top: 2px; line-height: 1.4; }
  .scan-video { width: 100%; border-radius: 10px; display: block; background: #0d0d0d; aspect-ratio: 4/3; object-fit: cover; }
  .scan-divider { text-align: center; font-size: 0.6rem; color: #3a3a2a; letter-spacing: 2px; margin: 12px 0; }
  .weight-row-list { max-height: 120px; overflow-y: auto; margin-top: 8px; }
  .weight-row-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #1e1e1e; font-size: 0.65rem; }
  .reminder-wrap { display: flex; align-items: center; gap: 10px; }
  .toggle-track { width: 36px; height: 20px; border-radius: 10px; display: inline-block; position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0; }
  .toggle-thumb { position: absolute; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #e8e0d0; transition: left 0.2s; }
  .profil-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 16px; margin-bottom: 14px; }
  .profil-card-title { font-size: 0.6rem; color: #4a4a3a; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 14px; }
  .profil-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
  .profil-row:last-child { margin-bottom: 0; }
  .profil-label { font-size: 0.65rem; color: #6b6b5a; flex: 1; }
  .profil-input { background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 7px 10px; color: #c8b890; font-family: 'DM Mono', monospace; font-size: 0.8rem; width: 90px; text-align: center; outline: none; }
  .profil-input:focus { border-color: #c8b890; }
  .profil-unit { font-size: 0.6rem; color: #3a3a2a; width: 28px; }
  .sex-toggle { display: flex; gap: 6px; }
  .sex-btn { background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 6px 14px; font-family: 'DM Mono', monospace; font-size: 0.65rem; color: #5a5a4a; cursor: pointer; transition: all 0.2s; }
  .sex-btn.active { background: #1e1a12; border-color: #c8b890; color: #c8b890; }
  .bmr-card { background: #0d0d0d; border: 1px solid #c8b890; border-radius: 12px; padding: 16px; margin-bottom: 14px; text-align: center; }
  .bmr-value { font-family: 'Playfair Display', serif; font-size: 2.2rem; color: #c8b890; line-height: 1; }
  .bmr-label { font-size: 0.58rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
  .bmr-note { font-size: 0.62rem; color: #3a3a2a; margin-top: 6px; line-height: 1.4; }
  .mode-btns { display: flex; gap: 6px; margin-bottom: 14px; }
  .mode-btn { flex: 1; padding: 10px 4px; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 10px; font-family: 'DM Mono', monospace; font-size: 0.58rem; color: #5a5a4a; cursor: pointer; text-align: center; letter-spacing: 1px; line-height: 1.5; transition: all 0.2s; }
  .mode-btn.active { background: #1e1a12; border-color: #c8b890; color: #c8b890; }
  .proactive { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
  .proactive-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .proactive-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .need-chip { background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 6px; padding: 3px 9px; font-size: 0.6rem; color: #5a5a4a; }
  .need-chip.warn { border-color: #5a3a1a; color: #c8a060; }
  .suggest-list { margin-top: 10px; border-top: 1px solid #222; padding-top: 8px; }
  .suggest-item { padding: 7px 0; border-bottom: 1px solid #1a1a1a; }
  .suggest-item:last-child { border-bottom: none; }
  .delta-up { color: #7abf8a; font-size: 0.6rem; margin-left: 3px; }
  .delta-down { color: #c87070; font-size: 0.6rem; margin-left: 3px; }
  .delta-same { color: #5a5a4a; font-size: 0.6rem; margin-left: 3px; }
  .compare-banner { font-size: 0.6rem; color: #4a4a3a; background: #111; border-radius: 6px; padding: 4px 8px; margin-bottom: 8px; letter-spacing: 1px; }
  .report-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 20px 0 40px; }
  .report-modal { background: #f5f0e8; color: #1a1a1a; border-radius: 14px; padding: 28px 24px 80px; max-width: 640px; width: calc(100% - 32px); position: relative; font-family: Georgia, serif; line-height: 1.7; }
  .report-close-fab { position: sticky; bottom: 16px; float: right; background: #2a1a00; color: #f0e6c8; border: none; border-radius: 20px; padding: 10px 20px; font-family: 'DM Mono', monospace; font-size: 0.7rem; cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.3); margin-top: 16px; }
  .report-modal h2 { font-size: 1.05rem; color: #2a2010; margin: 22px 0 8px; border-bottom: 1px solid #c8b890; padding-bottom: 4px; }
  .report-modal h2:first-child { margin-top: 0; }
  .report-modal p { font-size: 0.88rem; margin-bottom: 10px; }
  .report-modal ul { padding-left: 18px; margin-bottom: 10px; }
  .report-modal li { font-size: 0.88rem; margin-bottom: 5px; }
  .report-modal strong { color: #2a2010; }
  .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #c8b890; gap: 10px; }
  .report-title { font-family: Georgia, serif; font-size: 1.1rem; color: #2a2010; font-weight: bold; }
  .report-date { font-size: 0.65rem; color: #8a7a5a; }
  .report-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 448px; background: #1e1a12; border: 1px solid #c8b890; border-radius: 12px; padding: 12px 14px; z-index: 90; box-shadow: 0 4px 24px rgba(0,0,0,0.6); animation: slideUp 0.3s ease; }
  .report-toast-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .report-toast-label { font-size: 0.68rem; color: #c8b890; letter-spacing: 1px; flex: 1; }
  .report-progress { height: 3px; background: #2a2a2a; border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .report-progress-fill { height: 100%; background: linear-gradient(90deg, #6b6040, #c8b890, #f0e6c8); background-size: 200% 100%; border-radius: 2px; animation: progress-move 2s linear infinite; width: 60%; }
  @keyframes progress-move { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
  .toast-ui { position:fixed; bottom:76px; left:50%; transform:translateX(-50%); padding:10px 20px; border-radius:20px; font-family:'DM Mono',monospace; font-size:0.7rem; letter-spacing:0.5px; z-index:200; box-shadow:0 4px 20px rgba(0,0,0,0.5); animation:toastIn 0.25s ease; white-space:nowrap; pointer-events:none; }
  .toast-ui.success { background:#1a2a1a; border:1px solid #3a6a3a; color:#8adf8a; }
  .toast-ui.error { background:#2a1a1a; border:1px solid #6a3a3a; color:#df8a8a; }
  .toast-ui.info { background:#1a1a2a; border:1px solid #3a3a5a; color:#9a9adf; }
  @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);} }
  @keyframes shimmer { 0%{background-position:200% 0;}100%{background-position:-200% 0;} }
  .skeleton-pulse { background:linear-gradient(90deg,#1a1a1a 25%,#252525 50%,#1a1a1a 75%);background-size:200% 100%;animation:shimmer 1.4s ease infinite;border-radius:6px; }
  .skeleton-ring { width:170px; height:170px; border-radius:50%; margin:0 auto 24px; }
  .entry.pending { opacity:0.5; pointer-events:none; }
  .water-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
  .strava-card { background: #1a1a1a; border: 1px solid #fc4c02; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
  .strava-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .strava-label { font-size: 0.58rem; color: #fc4c02; letter-spacing: 2px; text-transform: uppercase; }
  .strava-activity { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #2a2a2a; }
  .strava-activity:last-child { border-bottom: none; }
  .strava-connect-btn { background: #fc4c02; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-family: 'DM Mono',monospace; font-size: 0.65rem; font-weight: 500; letter-spacing: 1px; cursor: pointer; transition: background 0.2s; }
  .strava-connect-btn:hover { background: #e04000; }
  .water-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .water-label { font-size: 0.58rem; color: #4a4a3a; letter-spacing: 2px; text-transform: uppercase; }
  .water-count { font-family: 'Playfair Display', serif; font-size: 1rem; color: #7a9abf; }
  .water-glasses { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .water-glass { font-size: 1.3rem; cursor: pointer; opacity: 0.25; transition: opacity 0.15s, transform 0.15s; line-height: 1; }
  .water-glass.filled { opacity: 1; }
  .water-glass:hover { transform: scale(1.15); }
  .water-goal { font-size: 0.58rem; color: #3a3a2a; margin-top: 6px; letter-spacing: 1px; }
  .legal-note { text-align: center; font-size: 0.58rem; color: #3a3a2a; letter-spacing: 1px; padding: 16px 0 4px; line-height: 1.6; }
  /* ── Mode clair ── */
  [data-theme="light"] body { background: #f5f2ec; color: #1a1a1a; }
  [data-theme="light"] .app { background: #f5f2ec; }
  [data-theme="light"] .header h1 { color: #2a2010; }
  [data-theme="light"] .header .sub { color: #9a9080; }
  [data-theme="light"] .tab { background: #ede8df; border-color: #d0c8b8; color: #7a7060; }
  [data-theme="light"] .tab.active { background: #c8b890; color: #0d0d0d; border-color: #c8b890; }
  [data-theme="light"] .date-nav { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .date-nav .date-label { color: #8a6a30; }
  [data-theme="light"] .date-nav button { color: #9a9080; }
  [data-theme="light"] .date-nav button:hover { color: #8a6a30; }
  [data-theme="light"] .ring-center .cals { color: #2a2010; }
  [data-theme="light"] .ring-center .cals-label { color: #9a9080; }
  [data-theme="light"] .ring-center .goal-text { color: #9a9080; }
  [data-theme="light"] .macro-card { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .macro-card .m-val { color: #2a2010; }
  [data-theme="light"] .macro-card .m-label { color: #7a7060; }
  [data-theme="light"] .macro-card .m-goal { color: #aaa090; }
  [data-theme="light"] .macro-card .m-bar { background: #d0c8b8; }
  [data-theme="light"] .input-area { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .input-area:focus-within { border-color: #c8b890; }
  [data-theme="light"] .input-area textarea { color: #1a1a1a; }
  [data-theme="light"] .input-area textarea::placeholder { color: #b0a898; }
  [data-theme="light"] .input-hint { color: #9a9080; }
  [data-theme="light"] .entry { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .entry-name { color: #1a1a1a; }
  [data-theme="light"] .entry-macros { color: #7a7060; }
  [data-theme="light"] .entry-kcal { color: #8a6a30; }
  [data-theme="light"] .entry-kcal span { color: #9a9080; }
  [data-theme="light"] .del-btn { color: #b0a898; }
  [data-theme="light"] .del-btn:hover { color: #c87070; }
  [data-theme="light"] .meal-group-header { color: #9a9080; border-bottom-color: #d0c8b8; }
  [data-theme="light"] .section-label { color: #9a9080; }
  [data-theme="light"] .empty-state { color: #b0a898; }
  [data-theme="light"] .error-msg { background: #f5e8e8; border-color: #c87070; color: #8a3030; }
  [data-theme="light"] .loading-row { background: #ede8df; border-color: #d0c8b8; color: #9a9080; }
  [data-theme="light"] .week-chart { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .week-chart .chart-title { color: #9a9080; }
  [data-theme="light"] .bar-label { color: #9a9080; }
  [data-theme="light"] .bar-val { color: #7a7060; }
  [data-theme="light"] .stat-cell { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .stat-val { color: #8a6a30; }
  [data-theme="light"] .stat-label { color: #9a9080; }
  [data-theme="light"] .stat-unit { color: #9a9080; }
  [data-theme="light"] .modal { background: #f0ece4; border-color: #d0c8b8; }
  [data-theme="light"] .modal h2 { color: #2a2010; }
  [data-theme="light"] .modal input[type="text"], [data-theme="light"] .modal input[type="number"] { background: #e8e4dc; border-color: #d0c8b8; color: #1a1a1a; }
  [data-theme="light"] .profil-card { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .profil-card-title { color: #9a9080; }
  [data-theme="light"] .profil-label { color: #7a7060; }
  [data-theme="light"] .profil-input { background: #e0dbd2; border-color: #d0c8b8; color: #2a2010; }
  [data-theme="light"] .profil-unit { color: #9a9080; }
  [data-theme="light"] .bmr-card { background: #e8e4dc; }
  [data-theme="light"] .bmr-label { color: #9a9080; }
  [data-theme="light"] .bmr-note { color: #9a9080; }
  [data-theme="light"] .subtab { background: #e8e4dc; border-color: #d0c8b8; color: #7a7060; }
  [data-theme="light"] .subtab.active { background: #ede8df; color: #8a6a30; border-color: #c8b890; }
  [data-theme="light"] .range-btn { background: #e8e4dc; border-color: #d0c8b8; color: #7a7060; }
  [data-theme="light"] .range-btn.active { background: #ede8df; color: #8a6a30; border-color: #c8b890; }
  [data-theme="light"] .blood-card { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .blood-card-title { color: #2a2010; }
  [data-theme="light"] .blood-summary { color: #7a7060; }
  [data-theme="light"] .marker-name { color: #7a7060; }
  [data-theme="light"] .marker-ref { color: #9a9080; }
  [data-theme="light"] .water-card { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .water-label { color: #9a9080; }
  [data-theme="light"] .water-goal { color: #b0a898; }
  [data-theme="light"] .recipe-card { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .recipe-card .recipe-name { color: #2a2010; }
  [data-theme="light"] .recipe-card .recipe-info { color: #7a7060; }
  [data-theme="light"] .ingredient-row { border-bottom-color: #d0c8b8; }
  [data-theme="light"] .ing-name { color: #2a2010; }
  [data-theme="light"] .food-cat-header { color: #9a9080; }
  [data-theme="light"] .ing-card { background: #ede8df; border-color: #d0c8b8; }
  [data-theme="light"] .ing-card-name { color: #2a2010; }
  [data-theme="light"] .ing-card-macros { color: #7a7060; }
  [data-theme="light"] .builder-preview { background: #e8e4dc; border-color: #d0c8b8; }
  [data-theme="light"] .builder-total-label { color: #7a7060; }
  [data-theme="light"] .cat-select { background: #e8e4dc; border-color: #d0c8b8; color: #1a1a1a; }
  [data-theme="light"] .legal-note { color: #b0a898; }
  [data-theme="light"] .fav-chip { background: #ede8df; border-color: #d0c8b8; color: #8a6a30; }
  [data-theme="light"] .meal-pill { background: #ede8df; border-color: #d0c8b8; color: #7a7060; }
  [data-theme="light"] .meal-pill.active { border-color: #c8b890; color: #8a6a30; background: #e8e2d4; }
  [data-theme="light"] .mode-btn { background: #e8e4dc; border-color: #d0c8b8; color: #7a7060; }
  [data-theme="light"] .mode-btn.active { background: #e8e2d4; border-color: #c8b890; color: #8a6a30; }
`;


const CATEGORY_EMOJI = { "fruit":"🍎","légume":"🥦","viande":"🥩","poisson":"🐟","céréale":"🌾","produit laitier":"🥛","légumineuse":"🫘","matière grasse":"🧈","noix et graines":"🥜","boisson":"🥤","autre":"🍽️" };
const KEYWORD_EMOJI = [
  [/melon(?!\s*d'eau)/i,"🍈"],[/past[eè]qu|melon d'eau/i,"🍉"],[/banane/i,"🍌"],
  [/\bpomme\b/i,"🍎"],[/poire\b/i,"🍐"],[/fraise/i,"🍓"],[/cerise/i,"🍒"],
  [/raisin/i,"🍇"],[/ananas/i,"🍍"],[/mangue/i,"🥭"],[/kiwi/i,"🥝"],
  [/p[eê]che/i,"🍑"],[/abricot/i,"🍑"],[/citron/i,"🍋"],[/orange/i,"🍊"],
  [/oeuf|egg/i,"🥚"],[/poulet|volaille|dinde/i,"🍗"],[/boeuf|steak|veau/i,"🥩"],
  [/porc|jambon|lardons?|bacon/i,"🥩"],[/saumon/i,"🐟"],[/thon/i,"🐟"],
  [/crevette/i,"🍤"],[/poisson/i,"🐟"],[/riz/i,"🍚"],[/p[âa]te/i,"🍝"],
  [/pain/i,"🍞"],[/fromage/i,"🧀"],[/lait\b/i,"🥛"],[/yaourt|yogurt/i,"🥛"],
  [/beurre/i,"🧈"],[/huile/i,"🫒"],[/olive/i,"🫒"],[/avocat/i,"🥑"],
  [/tomate/i,"🍅"],[/carotte/i,"🥕"],[/brocoli/i,"🥦"],[/salade|laitue/i,"🥗"],
  [/concombre/i,"🥒"],[/poivron/i,"🫑"],[/maïs/i,"🌽"],[/champignon/i,"🍄"],
  [/noix\b|noisette|amande|cajou|cacahu/i,"🥜"],[/flocon|avoine/i,"🌾"],
  [/chocolat/i,"🍫"],[/gâteau|cake/i,"🎂"],[/miel/i,"🍯"],
  [/caf[eé]/i,"☕"],[/th[eé]\b/i,"🍵"],[/eau\b/i,"💧"],[/jus\b/i,"🥤"],
  [/lentille|pois\b|haricot|pois chiche/i,"🫘"],
];
function dateKey(d) { return d.toLocaleDateString('fr-CA'); }
function formatDate(d) { return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
function getIcon(entry) {
  const name = (entry.name || "").toLowerCase();
  for (const [re, em] of KEYWORD_EMOJI) { if (re.test(name)) return em; }
  return entry.emoji || CATEGORY_EMOJI[entry.foodCategory] || "🍽️";
}
const DAYS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const CATEGORIES = [
  { id: "plat",      label: "🍽️ Plat" },
  { id: "collation", label: "🥪 Collation" },
  { id: "dessert",   label: "🧁 Dessert" },
  { id: "biohack",   label: "⚡ Biohack" },
];
function scale(item, mult) {
  return { name: item.name, kcal: Math.round(item.kcal*mult), protein: Math.round(item.protein*mult*10)/10, carbs: Math.round(item.carbs*mult*10)/10, fat: Math.round(item.fat*mult*10)/10 };
}

function JournalRecipeEntry({ e, isSelected, onSelect, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`entry ${isSelected ? "selected" : ""}`} style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
      <input type="checkbox" className="entry-check" checked={isSelected} onChange={onSelect} />
      <div style={{ fontSize: "1.4rem", flexShrink: 0, marginTop: 1 }}>🍲</div>
      <div className="entry-info" style={{ flex: 1, minWidth: 0 }}>
        <div className="entry-name clickable" onClick={() => setExpanded(v => !v)}>
          {e.name} <span style={{ fontSize: "0.6rem", color: "#4a4a3a" }}>{expanded ? "▲" : "▼"}</span>
        </div>
        <div className="entry-macros">P {Math.round(e.protein)}g · G {Math.round(e.carbs)}g · L {Math.round(e.fat)}g</div>
        {expanded && (
          <div className="journal-ing-list">
            {(e.items || []).map(i => (
              <div className="journal-ing-row" key={i.id}>
                <span>{i.name}{i.quantity != null ? ` · ${i.quantity}${i.unit}` : ""}</span>
                <span>{i.kcal} kcal</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="entry-kcal">{e.kcal}<span>kcal</span></div>
      <button className="del-btn" onClick={onDelete}>✕</button>
    </div>
  );
}

const MACRO_SECTIONS = [
  { id: "proteine", label: "Protéines" },
  { id: "glucide",  label: "Glucides"  },
  { id: "lipide",   label: "Lipides"   },
  { id: "autre",    label: "Autre"     },
];
const FOOD_CATEGORY_ORDER = ["fruit","légume","viande","poisson","céréale","produit laitier","légumineuse","matière grasse","noix et graines","boisson","autre"];

function getMacros(ing, qty) {
  if (ing.per100) {
    const f = qty / 100;
    return { kcal: Math.round(ing.per100.kcal*f), protein: Math.round(ing.per100.protein*f*10)/10, carbs: Math.round(ing.per100.carbs*f*10)/10, fat: Math.round(ing.per100.fat*f*10)/10 };
  }
  const p = ing.perUnit || { kcal:0, protein:0, carbs:0, fat:0 };
  return { kcal: Math.round(p.kcal*qty), protein: Math.round(p.protein*qty*10)/10, carbs: Math.round(p.carbs*qty*10)/10, fat: Math.round(p.fat*qty*10)/10 };
}

function IngredientLibrary({ ingredients, onDelete, onCreateRecipe, onAddToJournal }) {
  const { t } = useLocale();
  const [selected, setSelected] = useState({});
  const [recipeQtys, setRecipeQtys] = useState({});
  const [adding, setAdding] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  function toggleCollapse(key) { setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; }); }

  function toggleSelect(ing) {
    setSelected(prev => {
      if (prev[ing.id] != null) { const s = { ...prev }; delete s[ing.id]; return s; }
      return { ...prev, [ing.id]: ing.per100 ? 100 : 1 };
    });
  }
  function startAdd(ing) { setAdding(prev => ({ ...prev, [ing.id]: ing.per100 ? 100 : 1 })); }
  function cancelAdd(id) { setAdding(prev => { const s = { ...prev }; delete s[id]; return s; }); }
  function confirmAdd(ing) { if (adding[ing.id] > 0) onAddToJournal(ing, adding[ing.id]); cancelAdd(ing.id); }

  const selectedList = ingredients.filter(i => selected[i.id] != null);
  const totals = selectedList.reduce((acc, i) => {
    const m = getMacros(i, recipeQtys[i.id] ?? selected[i.id]);
    return { kcal: acc.kcal+m.kcal, protein: acc.protein+m.protein, carbs: acc.carbs+m.carbs, fat: acc.fat+m.fat };
  }, { kcal:0, protein:0, carbs:0, fat:0 });

  function buildItems() {
    return selectedList.map(i => {
      const qty = recipeQtys[i.id] ?? selected[i.id];
      const m = getMacros(i, qty);
      return { id: Date.now()+Math.random(), name: i.name, quantity: qty, unit: i.baseUnit, ...m };
    });
  }

  if (ingredients.length === 0) return <div className="empty-state">{t('app.no_ingredients')}<br/><br/>{t('app.no_ingredients_sub')}</div>;

  return (
    <div>
      <div className="section-label">{t('app.library')} — {ingredients.length}</div>
      {MACRO_SECTIONS.map(section => {
        const sectionItems = ingredients.filter(i => (i.macroType || "autre") === section.id);
        if (!sectionItems.length) return null;
        const byCategory = {};
        for (const item of sectionItems) {
          const cat = item.foodCategory || "autre";
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(item);
        }
        const macroKey = section.id;
        const macroCollapsed = !expanded.has(macroKey);
        return (
          <div className="macro-section" key={section.id}>
            <div className="macro-section-header" onClick={()=>toggleCollapse(macroKey)} style={{ cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>{section.label}</span>
              <span style={{ fontSize:"0.7rem", color:"#4a4a3a" }}>{macroCollapsed ? "▸" : "▾"}</span>
            </div>
            {!macroCollapsed && FOOD_CATEGORY_ORDER.filter(c => byCategory[c]).map(cat => {
              const catKey = `${section.id}-${cat}`;
              const catCollapsed = !expanded.has(catKey);
              return (
              <div key={cat}>
                <div className="food-cat-header" onClick={()=>toggleCollapse(catKey)} style={{ cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>{CATEGORY_EMOJI[cat] || ''} {cat} <span style={{ fontSize:"0.55rem", color:"#3a3a2a" }}>({byCategory[cat].length})</span></span>
                  <span style={{ fontSize:"0.65rem", color:"#3a3a2a" }}>{catCollapsed ? "▸" : "▾"}</span>
                </div>
                {!catCollapsed && byCategory[cat].map(i => {
                  const isSelected = selected[i.id] != null;
                  const isAdding   = adding[i.id]   != null;
                  const ref        = i.per100 ?? i.perUnit;
                  const refLabel   = i.per100 ? `/ 100${i.baseUnit}` : `/ ${i.baseUnit}`;
                  return (
                    <div className={`ing-card ${isSelected ? "selected" : ""}`} key={i.id} style={{ flexWrap: "wrap" }}>
                      <input type="checkbox" className="entry-check" checked={isSelected} onChange={() => toggleSelect(i)} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="ing-card-name">{i.name}</div>
                        <div className="ing-card-ref">{ref?.kcal} kcal · P {ref?.protein}g · G {ref?.carbs}g · L {ref?.fat}g {refLabel}</div>
                        {isAdding ? (
                          <div className="ing-qty-row">
                            <input className="ing-qty-input" type="number" min="0" step="any" value={adding[i.id]} autoFocus
                              onFocus={e => e.target.select()} onChange={e => setAdding(prev => ({ ...prev, [i.id]: +e.target.value }))} style={{ width:60 }} />
                            <span className="ing-unit">{i.baseUnit}</span>
                            <span style={{ fontSize:"0.6rem", color:"#6b6b5a" }}>= {getMacros(i, adding[i.id]).kcal} kcal</span>
                            <button className="btn" style={{ fontSize:"0.6rem", padding:"4px 10px" }} onClick={() => confirmAdd(i)}>✓</button>
                            <button className="btn secondary" style={{ fontSize:"0.6rem", padding:"4px 8px" }} onClick={() => cancelAdd(i.id)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ marginTop:6 }}>
                            <button className="btn secondary" style={{ fontSize:"0.6rem", padding:"4px 10px" }} onClick={() => startAdd(i)}>{t('app.add_to_journal')}</button>
                          </div>
                        )}
                        {isSelected && (
                          <div className="ing-qty-row">
                            <label>Recette</label>
                            <input className="ing-qty-input" type="number" min="0" step="any" value={recipeQtys[i.id] ?? selected[i.id]}
                              onFocus={e => e.target.select()} onChange={e => setRecipeQtys(prev => ({ ...prev, [i.id]: +e.target.value }))} style={{ width:60 }} />
                            <span className="ing-unit">{i.baseUnit}</span>
                            <span style={{ fontSize:"0.6rem", color:"#6b6b5a" }}>= {getMacros(i, recipeQtys[i.id] ?? selected[i.id]).kcal} kcal</span>
                          </div>
                        )}
                      </div>
                      <button className="del-btn" onClick={() => onDelete(i.id)}>✕</button>
                    </div>
                  );
                })}
              </div>
            );})}
          </div>
        );
      })}
      {selectedList.length > 0 && (
        <div className="builder-preview">
          <h3>{t('app.recipe_preview')} — {selectedList.length}</h3>
          <div className="builder-totals">
            {[{ label:"kcal", val:totals.kcal }, { label:"protéines", val:`${Math.round(totals.protein)}g` }, { label:"glucides", val:`${Math.round(totals.carbs)}g` }, { label:"lipides", val:`${Math.round(totals.fat)}g` }].map(c => (
              <div className="builder-total-cell" key={c.label}>
                <div className="builder-total-val">{c.val}</div>
                <div className="builder-total-label">{c.label}</div>
              </div>
            ))}
          </div>
          <div className="builder-items">{selectedList.map(i => { const qty = recipeQtys[i.id] ?? selected[i.id]; return <span key={i.id}>{i.name} {qty}{i.baseUnit} &nbsp;</span>; })}</div>
          <button className="btn" style={{ width:"100%" }} onClick={() => onCreateRecipe(buildItems())}>{t('app.create_recipe_sel')}</button>
        </div>
      )}
    </div>
  );
}

function RecipeCard({ r, onAdd, onDelete, onUpdateItems, onRename }) {
  const [expanded, setExpanded] = useState(false);
  const [qtys, setQtys] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(r.name);
  const nameRef = useRef();

  function getRatio(i) {
    if (i.quantity && i.quantity > 0) return (qtys[i.id] ?? i.quantity) / i.quantity;
    return qtys[i.id] ?? 1;
  }
  function setQty(id, val) { setQtys(prev => ({ ...prev, [id]: val })); }
  function commitQty(i) {
    const newQty = qtys[i.id];
    if (newQty == null || newQty <= 0 || newQty === i.quantity) return;
    const updatedItems = r.items.map(x => x.id === i.id ? { ...scale(x, newQty/i.quantity), id:x.id, quantity:newQty, unit:x.unit } : x);
    setQtys(prev => { const s={...prev}; delete s[i.id]; return s; });
    onUpdateItems(updatedItems);
  }
  function commitRename() {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== r.name) onRename(trimmed);
    else setNameVal(r.name);
    setEditingName(false);
  }

  const scaledItems = r.items.map(i => ({ ...scale(i, getRatio(i)), id:i.id, quantity:qtys[i.id]??i.quantity, unit:i.unit }));
  const totalKcal   = scaledItems.reduce((a,i) => a+i.kcal, 0);
  const hasChanges  = r.items.some(i => getRatio(i) !== 1);

  return (
    <div className="recipe-card">
      <div className="recipe-header">
        {editingName ? (
          <input ref={nameRef} className="recipe-name-input" value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={commitRename}
            onKeyDown={e => { if (e.key==="Enter") commitRename(); if (e.key==="Escape") { setNameVal(r.name); setEditingName(false); } }}
            onClick={e => e.stopPropagation()} />
        ) : (
          <div className="recipe-name" onClick={() => setExpanded(e=>!e)}>{r.name}</div>
        )}
        <button className="edit-name-btn" onClick={e => { e.stopPropagation(); setEditingName(true); setTimeout(() => nameRef.current?.select(), 0); }}>✎</button>
        <span className="recipe-toggle" onClick={() => setExpanded(e=>!e)}>{expanded ? "▲" : "▼"}</span>
      </div>
      <div className="recipe-info">{r.items.length} ingrédient{r.items.length>1?"s":""} · {totalKcal} kcal{hasChanges && <span style={{ color:"#c8b890" }}> (modifié)</span>}</div>
      {expanded && (
        <div className="ingredient-list">
          {r.items.map(i => (
            <div className="ingredient-row" key={i.id}>
              <span className="ing-name">{i.name}</span>
              <span className="ing-kcal">{Math.round(i.kcal*getRatio(i))} kcal</span>
              {i.quantity != null ? (
                <div className="ing-qty-wrap">
                  <input className="ing-qty-input" type="number" min="0" step="any" value={qtys[i.id]??i.quantity}
                    onFocus={e=>e.target.select()} onChange={e=>setQty(i.id,+e.target.value)} onBlur={()=>commitQty(i)} onClick={e=>e.stopPropagation()} />
                  <span className="ing-unit">{i.unit}</span>
                </div>
              ) : (
                <div className="portion-ctrl">
                  <button onClick={e=>{e.stopPropagation();setQty(i.id,Math.max(0.5,+((getRatio(i)-0.5).toFixed(1))));}}>−</button>
                  <span className="portion-val">{getRatio(i)}×</span>
                  <button onClick={e=>{e.stopPropagation();setQty(i.id,+((getRatio(i)+0.5).toFixed(1)));}}>+</button>
                </div>
              )}
              <button className="del-btn" onClick={e=>{e.stopPropagation();onUpdateItems(r.items.filter(x=>x.id!==i.id));}}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="recipe-actions">
        <button className="btn" style={{ fontSize:"0.65rem", padding:"7px 12px" }} onClick={() => onAdd(scaledItems, r.name)}>➕ Ajouter</button>
        <button className="btn danger" style={{ fontSize:"0.65rem", padding:"7px 12px" }} onClick={onDelete}>🗑</button>
      </div>
    </div>
  );
}

function BloodTestCard({ result, prevResult, isLatest, onDelete }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(isLatest);
  const [markerOpen, setMarkerOpen] = useState(null);
  const eatRecos   = (result.recommendations || []).filter(r => r.type === "eat");
  const avoidRecos = (result.recommendations || []).filter(r => r.type === "avoid");
  const title = result.reportType || "Bilan de santé";
  const prevMap = {};
  if (prevResult) (prevResult.markers || []).forEach(m => { prevMap[m.name] = m; });
  const markerRecos = result.markerRecos || [];
  const abnormalMarkers = (result.markers||[]).filter(m => m.status !== 'ok');

  return (
    <div className="blood-card">
      <div className="blood-card-header" onClick={() => setExpanded(v=>!v)}>
        <div className="blood-card-title">🩺 {title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div className="blood-card-date">{result.date || new Date(result.uploadedAt).toLocaleDateString("fr-FR")} {expanded?"▲":"▼"}</div>
          <button className="del-btn" onClick={e=>{ e.stopPropagation(); if(window.confirm('Supprimer ce bilan ? Cette action est irréversible.')) onDelete(); }} title="Supprimer">✕</button>
        </div>
      </div>
      {expanded && (
        <>
          {prevResult && <div className="compare-banner">↔ Comparé avec le bilan du {prevResult.date || new Date(prevResult.uploadedAt).toLocaleDateString("fr-FR")}</div>}
          {result.summary && <div className="blood-summary">{result.summary}</div>}

          {/* Focus semaine */}
          {result.weeklyFocus && (
            <div style={{ background:"#1a1a12", border:"1px solid #3a3218", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
              <div style={{ fontSize:"0.55rem", color:"#c8b890", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>🎯 {t('app.weekly_focus')}</div>
              <div style={{ fontSize:"0.68rem", color:"#e8d8a0", lineHeight:1.6 }}>{result.weeklyFocus}</div>
            </div>
          )}

          {/* Marqueurs */}
          <div style={{ marginBottom:12 }}>
            {(result.markers||[]).map((m,i) => {
              const prev = prevMap[m.name];
              let delta = null;
              if (prev && typeof m.value === 'number' && typeof prev.value === 'number') {
                const diff = m.value - prev.value;
                if (Math.abs(diff) > 0.001) delta = diff;
              }
              const reco = markerRecos.find(r => r.marker === m.name);
              return (
                <div key={i}>
                  <div className="blood-marker-row" style={{ cursor: reco ? 'pointer' : 'default' }}
                    onClick={() => reco && setMarkerOpen(markerOpen === m.name ? null : m.name)}>
                    <span className="marker-name">{m.name}</span>
                    <span className={`marker-value status-${m.status}`}>{m.value} {m.unit}
                      {delta !== null && <span className={delta > 0 ? "delta-up" : "delta-down"}>{delta > 0 ? "▲" : "▼"}{Math.abs(Math.round(delta * 100) / 100)}</span>}
                    </span>
                    <span className="marker-ref">[{m.refMin ?? '?'}–{m.refMax ?? '?'}]</span>
                    <span className={`status-${m.status}`}>{m.status==="ok"?"✓":m.status==="warn"?"⚠":"✗"}{reco ? (markerOpen===m.name?" ▲":" ▼") : ""}</span>
                  </div>
                  {/* Détail par marqueur */}
                  {reco && markerOpen === m.name && (
                    <div style={{ background:"#0f0f0d", border:"1px solid #2a2a18", borderRadius:10, padding:"12px 14px", marginBottom:8, marginTop:-2 }}>
                      {reco.cause && <div style={{ fontSize:"0.62rem", color:"#8a8060", lineHeight:1.6, marginBottom:10, fontStyle:"italic" }}>💡 {reco.cause}</div>}

                      <div style={{ fontSize:"0.55rem", color:"#c8b890", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Aliments recommandés</div>
                      {(reco.foods||[]).map((f,fi) => (
                        <div key={fi} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8, paddingBottom:8, borderBottom: fi < reco.foods.length-1 ? "1px solid #1a1a10" : "none" }}>
                          <span style={{ fontSize:"1.2rem", flexShrink:0 }}>{f.emoji}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:"0.68rem", color:"#e8d8a0", fontWeight:500 }}>{f.name}</div>
                            <div style={{ fontSize:"0.6rem", color:"#c8b890", marginTop:1 }}>{f.quantity} · {f.frequency}</div>
                            {f.tip && <div style={{ fontSize:"0.58rem", color:"#6a6a50", marginTop:2, lineHeight:1.5 }}>{f.tip}</div>}
                          </div>
                        </div>
                      ))}

                      {reco.synergy && (
                        <div style={{ background:"#1a2010", border:"1px solid #2a3a18", borderRadius:8, padding:"8px 10px", marginTop:8 }}>
                          <div style={{ fontSize:"0.55rem", color:"#7abf8a", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Synergie</div>
                          <div style={{ fontSize:"0.62rem", color:"#7abf8a", lineHeight:1.5 }}>{reco.synergy}</div>
                        </div>
                      )}
                      {reco.avoid && (
                        <div style={{ background:"#1a1010", border:"1px solid #3a2018", borderRadius:8, padding:"8px 10px", marginTop:6 }}>
                          <div style={{ fontSize:"0.55rem", color:"#c87070", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>À éviter</div>
                          <div style={{ fontSize:"0.62rem", color:"#c87070", lineHeight:1.5 }}>{reco.avoid}</div>
                        </div>
                      )}
                      {reco.supplements && (
                        <div style={{ fontSize:"0.6rem", color:"#5a5a4a", marginTop:8, lineHeight:1.5, fontStyle:"italic" }}>💊 {reco.supplements}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recommandations globales */}
          {(eatRecos.length>0||avoidRecos.length>0) && (
            <div className="reco-section">
              {eatRecos.length>0 && (<>
                <div className="reco-group-label reco-eat-label">À favoriser</div>
                {eatRecos.map((r,i) => (
                  <div className="reco-row" key={i}>
                    <div className="reco-emoji">{r.emoji}</div>
                    <div className="reco-body"><div className="reco-food-name">{r.food}</div><div className="reco-reason">{r.reason}</div></div>
                  </div>
                ))}
              </>)}
              {avoidRecos.length>0 && (<>
                <div className="reco-group-label reco-avoid-label" style={{ marginTop: eatRecos.length>0?12:0 }}>À limiter</div>
                {avoidRecos.map((r,i) => (
                  <div className="reco-row" key={i}>
                    <div className="reco-emoji">{r.emoji}</div>
                    <div className="reco-body"><div className="reco-food-name">{r.food}</div><div className="reco-reason">{r.reason}</div></div>
                  </div>
                ))}
              </>)}
            </div>
          )}

          {/* Prochain bilan */}
          {result.nextCheckup && (
            <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginTop:12, padding:"8px 12px", background:"#1a1a1a", borderRadius:8, borderLeft:"2px solid #3a3a2a" }}>
              📅 {result.nextCheckup}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WeightChart({ log }) {
  const data = log.slice(-30);
  const vals = data.map(d => d.value);
  const min  = Math.min(...vals) - 1;
  const max  = Math.max(...vals) + 1;
  const W = 440, H = 80, PAD = 8;
  const n = data.length;
  const xv = (i) => PAD + (n === 1 ? (W-PAD*2)/2 : (i/(n-1))*(W-PAD*2));
  const yv = (v) => H - PAD - ((v-min)/(max-min))*(H-PAD*2);
  const points = data.map((d,i) => `${xv(i)},${yv(d.value)}`).join(' ');
  const last = data[n-1];
  const first = data[0];
  const diff = n > 1 ? +(last.value - first.value).toFixed(1) : null;
  const trendColor = diff === null ? '#c8b890' : diff < -0.1 ? '#7abf8a' : diff > 0.1 ? '#c87070' : '#c8b890';
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', display:'block', marginBottom:4 }}>
        <polyline points={points} fill="none" stroke="#c8b890" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d,i) => <circle key={d.date} cx={xv(i)} cy={yv(d.value)} r="3" fill="#c8b890" />)}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.6rem', color:'#4a4a3a' }}>
        <span>{first.value} kg</span>
        {diff !== null && Math.abs(diff) > 0 && <span style={{ color:trendColor }}>{diff>0?'▲':'▼'} {Math.abs(diff)} kg</span>}
        <span>{last.value} kg</span>
      </div>
    </div>
  );
}

export default function App() {
  const { t } = useLocale();
  const [upgradeModal,  setUpgradeModal]  = useState(null); // { feature: 'suggestions'|'bloodtest'|'reports' }
  const [tab,           setTab]          = useState(() => { if (typeof window !== 'undefined') { const p = new URLSearchParams(window.location.search); return p.get('tab') || 'journal'; } return 'journal'; });
  const [offset,        setOffset]       = useState(0);
  const [input,         setInput]        = useState("");
  const [loading,       setLoading]      = useState(false);
  const [error,         setError]        = useState("");
  const [entries,       setEntries]      = useState([]);
  const [recipes,       setRecipes]      = useState([]);
  const [weekData,      setWeekData]     = useState([]);
  const [prevWeekData,  setPrevWeekData] = useState([]);
  const [monthData,     setMonthData]    = useState([]);
  const [longData,      setLongData]     = useState([]);
  const [statsRange,    setStatsRange]   = useState(7);
  const [streak,        setStreak]       = useState(0);
  const [saveModal,     setSaveModal]    = useState(false);
  const [recipeName,    setRecipeName]   = useState("");
  const [saveCategory,  setSaveCategory] = useState("plat");

  const [pendingItems,  setPendingItems] = useState([]);
  const [selectedIds,   setSelectedIds]  = useState(new Set());
  const [ingredients,   setIngredients]  = useState([]);
  const [recetteTab,    setRecetteTab]   = useState("recettes");
  const [createTab,     setCreateTab]    = useState("plat");
  const [dessertWhey,   setDessertWhey]  = useState(true);
  const [suggestion,    setSuggestion]   = useState(null);
  const [suggLoading,   setSuggLoading]  = useState(false);
  const [suggestLoading,setSuggestLoading]=useState(false);
  const [suggestions,   setSuggestions]  = useState([]);
  const [bloodTests,    setBloodTests]   = useState([]);
  const [bloodLoading,    setBloodLoading]    = useState(false);
  const [bloodError,      setBloodError]      = useState("");
  const [compareOpen,     setCompareOpen]     = useState(false);
  const [compareA,        setCompareA]        = useState(0);
  const [compareB,        setCompareB]        = useState(1);
  const [bloodTransferRef] = useState(() => ({ current: null }));
  const [transferLoading,  setTransferLoading] = useState(false);
  const [transferSent,     setTransferSent]    = useState(false);
  const [pendingBlood,     setPendingBlood]    = useState(null);
  const [analyzeLoading,   setAnalyzeLoading]  = useState(false);
  const [reviewResult,     setReviewResult]    = useState(null);
  const [confirmLoading,   setConfirmLoading]  = useState(false);
  const [reportHtml,    setReportHtml]   = useState(null);
  const [reportStatus,  setReportStatus] = useState(null);
  const [reportTitle,   setReportTitle]  = useState("");
  const [reportDays,    setReportDays]   = useState(30);
  const [reportHistory, setReportHistory] = useState([]); // { title, days, date, html }
  const [reportHistoryIdx, setReportHistoryIdx] = useState(0);
  const [reportNutriOpen,  setReportNutriOpen]  = useState(false);
  const [reportMedOpen,    setReportMedOpen]    = useState(false);
  const [reportReqSent,    setReportReqSent]    = useState(false);
  const [reportReqLoading, setReportReqLoading] = useState(false);
  const [notifPermission,  setNotifPermission]  = useState('default');
  const [mode,          setMode]         = useState("maintien");
  const [sex,           setSex]          = useState("homme");
  const [birthdate,     setBirthdate]    = useState("");
  const [height,        setHeight]       = useState("");
  const [weight,        setWeight]       = useState("");
  const [favAdding,     setFavAdding]    = useState({});
  const [goal,          setGoal]         = useState(2000);
  const [proteinGoal,   setProteinGoal]  = useState(150);
  const [carbsGoal,     setCarbsGoal]    = useState(250);
  const [fatGoal,       setFatGoal]      = useState(70);
  const [settingsLoaded,setSettingsLoaded] = useState(false);
  const [photoLoading,  setPhotoLoading] = useState(false);
  const [barcodeModal,  setBarcodeModal] = useState(false);
  const [barcodeConfirm,setBarcodeConfirm] = useState(null);
  const [barcodeQty,    setBarcodeQty]   = useState(100);
  const [barcodeManual, setBarcodeManual] = useState("");
  const [barcodeError,  setBarcodeError] = useState("");
  const [weightLog,     setWeightLog]    = useState([]);
  const [weightInput,   setWeightInput]  = useState("");
  const [healthHistory,   setHealthHistory]   = useState('');
  const [reminders, setReminders] = useState([]); // [{ id, time }]
  const [waterCount,      setWaterCount]      = useState(0);
  const [user,            setUser]            = useState(null);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthlete,   setStravaAthlete]   = useState(null);
  const [stravaActivities,setStravaActivities]= useState([]);
  const [stravaDebug,     setStravaDebug]     = useState(null);
  const [gfitConnected,   setGfitConnected]   = useState(false);
  const [gfitData,        setGfitData]        = useState(null);
  const [currentMeal,     setCurrentMeal]     = useState('Petit-déjeuner');
  const [mealSlots,       setMealSlots]       = useState(['Petit-déjeuner']);
  const [mealDropdownOpen, setMealDropdownOpen] = useState(false);
  const [onboardStep,     setOnboardStep]     = useState(0);
  const [obSex,           setObSex]           = useState('homme');
  const [obBirthdate,     setObBirthdate]     = useState('');
  const [obHeight,        setObHeight]        = useState('');
  const [obWeight,        setObWeight]        = useState('');
  const [obMode,          setObMode]          = useState('maintien');
  const [obKcal,          setObKcal]          = useState('');
  const [obProtein,       setObProtein]       = useState('');
  const [obSaving,        setObSaving]        = useState(false);
  const [coachCode,       setCoachCode]       = useState('');
  const [coachLinked,     setCoachLinked]     = useState(null);
  const [coachLinkMsg,    setCoachLinkMsg]    = useState('');
  const [selfNutritionAllowed, setSelfNutritionAllowed] = useState(true);
  const [selfMuscuAllowed,     setSelfMuscuAllowed]     = useState(true);
  const [coachNotifs,     setCoachNotifs]     = useState([]);
  const [coachPrograms,   setCoachPrograms]   = useState([]);
  const [coachMuscuPrograms, setCoachMuscuPrograms] = useState([]);
  const [activeProgramDay,    setActiveProgramDay]    = useState(0);
  const [programTab,          setProgramTab]          = useState('muscu');
  const [nutritionProgram,    setNutritionProgram]    = useState(null);
  const [nutritionGenOpen,    setNutritionGenOpen]    = useState(false);
  const [nutritionGenConfig,  setNutritionGenConfig]  = useState({ mainMeals:3, snacks:1, preferences:'', avoidFoods:'' });
  const [nutritionGenLoading, setNutritionGenLoading] = useState(false);
  const [nutritionGenError,   setNutritionGenError]   = useState(null);
  const [nutritionEditDay,    setNutritionEditDay]    = useState(0);
  const [nutritionEditItem,   setNutritionEditItem]   = useState(null);
  const [nutritionConfirmDel,     setNutritionConfirmDel]     = useState(null);
  const [nutritionAddRecipe,      setNutritionAddRecipe]      = useState(null);
  const [nutritionAddRecipeCat,   setNutritionAddRecipeCat]   = useState('plat');
  const [nutritionConfirmDelProg, setNutritionConfirmDelProg] = useState(false);
  const [nutritionConfirmDelDay,  setNutritionConfirmDelDay]  = useState(null);
  const [collapsedMeals,          setCollapsedMeals]          = useState(new Set());
  function toggleMeal(key) { setCollapsedMeals(prev => { const s=new Set(prev); s.has(key)?s.delete(key):s.add(key); return s; }); }
  function buildEmptyNutritionProgram({ mainMeals=3, snacks=1 }) {
    const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const MAIN = mainMeals===2?['Petit-déjeuner','Dîner']:mainMeals===3?['Petit-déjeuner','Déjeuner','Dîner']:mainMeals===4?['Petit-déjeuner','Déjeuner','Goûter','Dîner']:['Petit-déjeuner','Brunch','Déjeuner','Goûter','Dîner'];
    const MT = [];
    MT.push(MAIN[0]);
    if(snacks>=1) MT.push('Collation matin');
    if(MAIN[1]) MT.push(MAIN[1]);
    if(snacks>=2) MT.push('Collation après-midi');
    if(MAIN[2]) MT.push(MAIN[2]);
    if(snacks>=3) MT.push('Collation soirée');
    if(MAIN[3]) MT.push(MAIN[3]);
    if(MAIN[4]) MT.push(MAIN[4]);
    return { id:Date.now(), generatedAt:new Date().toISOString(), mainMeals, snacks, mealsPerDay:MT.length, preferences:'', avoidFoods:'', weeklyNotes:'',
      days: DAYS.map(day=>({ day, meals: MT.map(type=>({ type, items:[], totalKcal:0, totalProtein:0, totalCarbs:0, totalFat:0, note:'' })) })) };
  }
  const [profilOpen,      setProfilOpen]      = useState(false);
  const [chatOpen,        setChatOpen]        = useState(false);
  const [chatMessages,    setChatMessages]    = useState([]);
  const [chatInput,       setChatInput]       = useState('');
  const [chatSending,     setChatSending]     = useState(false);
  const [chatUnread,      setChatUnread]      = useState(0);
  const [isOnline,        setIsOnline]        = useState(true);
  const [theme,           setTheme]           = useState('dark');
  const textRef     = useRef();
  const fileRef     = useRef();
  const cameraRef   = useRef();
  const videoRef    = useRef();
  const canvasRef   = useRef();
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const reminderFiredRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [aiMsgIdx, setAiMsgIdx] = useState(0);
  const [installBanner, setInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const installEventRef = useRef(null);

  const today = new Date();
  today.setDate(today.getDate() + offset);
  const key = dateKey(today);

  // Détection hors-ligne
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Thème clair/sombre
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }
  function dismissInstall() {
    localStorage.removeItem('nutrainer_show_install');
    setInstallBanner(false);
  }
  async function handleInstall() {
    localStorage.removeItem('nutrainer_show_install');
    if (!installEventRef.current) return;
    installEventRef.current.prompt();
    await installEventRef.current.userChoice;
    setInstallBanner(false);
  }

  // PWA install prompt
  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
    setIsIos(ios);
    const shouldShow = !!localStorage.getItem('nutrainer_show_install');
    if (!shouldShow) return;
    if (ios) {
      const t = setTimeout(() => setInstallBanner(true), 2000);
      return () => clearTimeout(t);
    }
    const handler = (e) => {
      e.preventDefault();
      installEventRef.current = e;
      setTimeout(() => setInstallBanner(true), 1500);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auth
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setUser(d.user);
        if (d.user.role === 'coach' && !d.user.isViewAs) window.location.href = '/coach';
        else if (!d.user.isViewAs) {
          fetch('/api/coach/athlete').then(r=>r.json()).then(d=>setCoachNotifs((d.notifications||[]).filter(n=>!n.read)));
          fetch('/api/athlete/program').then(r=>r.json()).then(d=>{ setCoachPrograms(d.programs||[]); setCoachMuscuPrograms(d.muscuPrograms||[]); });
          fetch('/api/chat').then(r=>r.json()).then(d=>{ setChatMessages(d.messages||[]); setChatUnread(d.unreadCount||0); });
          fetch('/api/nutrition-program').then(r=>r.json()).then(d=>{ if (d.program) setNutritionProgram(d.program); });
          fetch('/api/reports').then(r=>r.json()).then(d=>{
            if (d.reports?.length) {
              setReportHistory(d.reports.map(r => ({ ...r, date: r.date })));
            }
          }).catch(()=>{});
          // Rapport généré en arrière-plan (app était fermée)
          fetch('/api/report').then(r=>r.json()).then(d=>{
            if (d.report?.html) {
              setReportHtml(d.report.html);
              setReportTitle(d.report.title || 'Rapport');
              setReportStatus('ready');
            }
          }).catch(()=>{});
        }
      }
      else window.location.href = '/login';
    }).catch(() => window.location.href = '/login');
  }, []);

  // Charger settings depuis DB au montage
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(({ settings: s }) => {
        setGoal(s.goalKcal);
        setProteinGoal(s.goalProtein);
        setCarbsGoal(s.goalCarbs);
        setFatGoal(s.goalFat);
        if (s.reminders) setReminders(s.reminders);
        else if (s.reminderEnabled && s.reminderTime) setReminders([{ id: 'legacy', time: s.reminderTime }]);
        if (s.sex)       setSex(s.sex);
        if (s.birthdate) setBirthdate(s.birthdate);
        else if (s.age)  setBirthdate(""); // migration: ignorer ancien âge
        if (s.height) setHeight(s.height);
        if (s.weight) setWeight(s.weight);
        if (s.mode)   setMode(s.mode);
        const hasProfile = s.height || s.weight || s.birthdate;
        if (!s.onboardingDone && !hasProfile) { window.location.href = '/onboarding'; return; }
        if (s.coachId) setCoachLinked(s.coachId);
        setSelfNutritionAllowed(s.selfNutritionAllowed !== false);
        setSelfMuscuAllowed(s.selfMuscuAllowed !== false);
        if (s.healthHistory) setHealthHistory(s.healthHistory);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  // Sync settings vers DB (debounce 1s)
  useEffect(() => {
    if (!settingsLoaded) return;
    const timer = setTimeout(() => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalKcal: goal, goalProtein: proteinGoal, goalCarbs: carbsGoal, goalFat: fatGoal, reminders, sex, birthdate, height, weight, mode, healthHistory }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [goal, proteinGoal, carbsGoal, fatGoal, reminders, sex, birthdate, height, weight, mode, healthHistory, settingsLoaded]);

  // Entrées du jour
  useEffect(() => {
    fetch(`/api/entries?date=${key}`).then(r=>r.json()).then(d=>{
      const loaded = d.entries||[];
      setEntries(loaded);
      const existing = [...new Set(loaded.map(e=>e.meal).filter(Boolean))];
      const BASE = ['Petit-déjeuner'];
      let slots = [...new Set([...BASE, ...existing])];
      const isToday = key === new Date().toISOString().slice(0, 10);
      if (isToday) {
        const h = new Date().getHours();
        const mealEntries = e => loaded.filter(x => x.meal === e).length > 0;
        let autoMeal = 'Petit-déjeuner';
        if (h >= 11 && h < 15 || h >= 18) {
          // Trouver le prochain Repas vide
          const repasSlots = slots.filter(s => s.startsWith('Repas'));
          const nextRepas = repasSlots.find(s => !mealEntries(s));
          if (nextRepas) { autoMeal = nextRepas; }
          else { const n = repasSlots.length + 1; autoMeal = `Repas ${n}`; slots = [...new Set([...slots, autoMeal])]; }
        } else if (h >= 15 && h < 18) {
          // Trouver la prochaine Collation vide
          const collSlots = slots.filter(s => s.startsWith('Collation'));
          const nextColl = collSlots.find(s => !mealEntries(s));
          if (nextColl) { autoMeal = nextColl; }
          else { const n = collSlots.length + 1; autoMeal = `Collation ${n}`; slots = [...new Set([...slots, autoMeal])]; }
          if (!slots.includes('Repas 1')) slots = [...new Set(['Petit-déjeuner', 'Repas 1', ...slots])];
        }
        if (!slots.includes(autoMeal)) slots = [...new Set([...slots, autoMeal])];
        setMealSlots(slots);
        setCurrentMeal(autoMeal);
      } else {
        setMealSlots(slots);
        if (existing.length > 0 && !slots.includes(currentMeal)) setCurrentMeal(slots[slots.length-1]);
      }
    }).catch(()=>{});
    setSelectedIds(new Set());
  }, [key]);

  // Streak — un seul appel API parallélisé côté serveur
  useEffect(() => {
    fetch('/api/streak').then(r=>r.json()).then(d=>setStreak(d.streak||0)).catch(()=>{});
  }, []);

  // Chat polling — toutes les 8s si chat ouvert, sinon toutes les 30s pour le badge
  useEffect(() => {
    if (!coachLinked) return;
    const poll = () => fetch('/api/chat').then(r=>r.json()).then(d=>{
      setChatMessages(d.messages||[]);
      if (!chatOpen) setChatUnread(d.unreadCount||0);
      else setChatUnread(0);
    }).catch(()=>{});
    const interval = setInterval(poll, chatOpen ? 8000 : 30000);
    return () => clearInterval(interval);
  }, [coachLinked, chatOpen]);

  async function generateNutritionProgram() {
    setNutritionGenLoading(true); setNutritionGenError(null);
    try {
      const res = await fetch('/api/nutrition-program', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(nutritionGenConfig) });
      let data;
      try { data = await res.json(); } catch { setNutritionGenError(`Erreur HTTP ${res.status} — réessaie`); setNutritionGenLoading(false); return; }
      if (data.program) { setNutritionProgram(data.program); setNutritionGenOpen(false); setNutritionEditDay(0); }
      else setNutritionGenError(data.error || `Erreur ${res.status} — réessaie`);
    } catch(e) { setNutritionGenError(`Erreur réseau : ${e.message}`); }
    setNutritionGenLoading(false);
  }

  async function saveNutritionEdit(updated) {
    // Recalculer les totaux de chaque repas
    const withTotals = { ...updated, days: (updated.days||[]).map(day => ({ ...day, meals: (day.meals||[]).map(meal => {
      const items = meal.items || [];
      return { ...meal, totalKcal: items.reduce((s,i)=>s+(i.kcal||0),0), totalProtein: items.reduce((s,i)=>s+(i.protein||0),0), totalCarbs: items.reduce((s,i)=>s+(i.carbs||0),0), totalFat: items.reduce((s,i)=>s+(i.fat||0),0) };
    }) })) };
    setNutritionProgram(withTotals);
    await fetch('/api/nutrition-program', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ program: withTotals }) });
  }

  async function analyzeNutritionItem(name, quantity) {
    if (!name?.trim()) return null;
    try {
      const text = quantity ? `${name} ${quantity}` : name;
      const res = await fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text, programMode: true }) });
      const data = await res.json();
      const item = data.items?.[0];
      if (!item) return null;
      setIngredients(prev => { const exists = prev.find(i => i.name.toLowerCase().trim() === item.name.toLowerCase().trim()); if (exists) return prev; return prev; }); // librairie mise à jour côté API
      return { kcal: item.kcal||0, protein: item.protein||0, carbs: item.carbs||0, fat: item.fat||0 };
    } catch { return null; }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatSending) return;
    setChatSending(true);
    const text = chatInput.trim();
    setChatInput('');
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
    const data = await res.json();
    if (data.message) setChatMessages(prev => [...prev, data.message]);
    setChatSending(false);
  }

  // Recettes + ingrédients
  useEffect(() => {
    fetch('/api/recipes').then(r=>r.json()).then(d=>setRecipes(d.recipes||[]));
    fetch('/api/ingredients').then(r=>r.json()).then(d=>setIngredients(d.ingredients||[]));
  }, []);

  // Stats
  useEffect(() => {
    if (tab !== "stats") return;
    const n = statsRange;
    const burnedPromise = n === 7
      ? fetch('/api/strava/activities?burned=week').then(r=>r.json()).then(d=>d.burnedByDate||{}).catch(()=>({}))
      : Promise.resolve({});
    const promises = Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate()-(n-1-i));
      return fetch(`/api/entries?date=${dateKey(d)}`).then(r=>r.json()).then(data => {
        const entries = data.entries||[];
        return {
          day: DAYS[d.getDay()], date: dateKey(d),
          kcal:    entries.reduce((a,e)=>a+(e.kcal||0),0),
          protein: entries.reduce((a,e)=>a+(e.protein||0),0),
          carbs:   entries.reduce((a,e)=>a+(e.carbs||0),0),
          fat:     entries.reduce((a,e)=>a+(e.fat||0),0),
        };
      });
    });
    // Pour la vue 7j, récupère aussi la semaine précédente pour comparer
    const prevWeekPromise = n === 7 ? Promise.all(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate()-(13-i));
      return fetch(`/api/entries?date=${dateKey(d)}`).then(r=>r.json()).then(data => {
        const entries = data.entries||[];
        return { date: dateKey(d), kcal: entries.reduce((a,e)=>a+(e.kcal||0),0) };
      });
    })) : Promise.resolve([]);
    Promise.all([Promise.all(promises), burnedPromise, prevWeekPromise]).then(([data, burnedByDate, prevWeek]) => {
      const withBurned = data.map(d => ({ ...d, burned: burnedByDate[d.date] || 0 }));
      if (n===7) { setWeekData(withBurned); setPrevWeekData(prevWeek); }
      else if (n===30) setMonthData(withBurned);
      else setLongData(withBurned);
    });
  }, [tab, statsRange]);

  // Poids — chargé au montage pour la saisie rapide dans le journal
  useEffect(() => {
    fetch('/api/weight').then(r=>r.json()).then(d=>setWeightLog(d.log||[]));
  }, []);

  // Eau
  useEffect(() => {
    fetch(`/api/water?date=${key}`).then(r=>r.json()).then(d=>setWaterCount(d.count||0)).catch(()=>{});
  }, [key]);

  // Strava
  function fetchStrava(dateKey) {
    fetch(`/api/strava/activities?date=${dateKey}`)
      .then(r=>{ if(r.status===402){ setUpgradeModal({ feature:'strava' }); return null; } return r.json(); })
      .then(d=>{ if(!d) return; setStravaDebug(d); setStravaConnected(!!d.connected); if(d.athlete) setStravaAthlete(d.athlete); setStravaActivities(d.activities||[]); })
      .catch(e=>setStravaDebug({fetchError: String(e)}));
  }
  useEffect(() => { fetchStrava(key); }, [key]);

  // Google Fit
  function fetchGoogleFit(dateKey) {
    fetch(`/api/googlefit/activities?date=${dateKey}`)
      .then(r=>r.json())
      .then(d=>{ setGfitConnected(!!d.connected); if(d.connected) setGfitData(d); })
      .catch(()=>{});
  }
  useEffect(() => { fetchGoogleFit(key); }, [key]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('strava') || p.get('googlefit')) window.history.replaceState({}, '', '/');
  }, []);

  async function logWater(n) {
    const count = Math.max(0, Math.min(8, n));
    setWaterCount(count);
    fetch('/api/water', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ date:key, count }) }).catch(()=>{});
  }

  // Prise de sang
  useEffect(() => {
    if (tab !== "sante") return;
    fetch('/api/bloodtest').then(r=>r.json()).then(d=>setBloodTests(d.results||[]));
    if (coachLinked) fetch('/api/blood-transfer').then(r=>r.json()).then(d=>setPendingBlood(d.pending||null));
  }, [tab, coachLinked]);

  // Écouter les messages du SW (push reçue avec app ouverte)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = async (event) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return;
      const url = event.data?.data?.url || '';
      // Rapport patient
      if (url.startsWith('/') && !url.startsWith('/coach')) {
        const d = await fetch('/api/report').then(r => r.json()).catch(() => ({}));
        if (d.report?.html) {
          setReportHtml(d.report.html);
          setReportTitle(d.report.title || 'Rapport');
          setReportStatus('ready');
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // Service Worker + Push : enregistrer et auto-souscrire si permission déjà accordée
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if ('Notification' in window) setNotifPermission(Notification.permission);
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
  }, []);

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: existing }) }); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
      await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subscription: sub }) });
    } catch {}
  }

  async function enablePatientNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm !== 'granted') return;
    await subscribeToPush();
  }

  // Rappels
  async function sendNotification(title, body) {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body, icon: '/icon.png', badge: '/icon-192.png', vibrate: [200, 100, 200] });
        return;
      } catch {}
    }
    try { new Notification(title, { body, icon: '/icon.png' }); } catch {}
  }

  useEffect(() => {
    if (reminders.length === 0) return;
    const check = () => {
      const now = new Date();
      const hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
      const today = dateKey(now);
      for (const r of reminders) {
        const firedKey = `${today}:${r.time}`;
        if (hhmm === r.time && !reminderFiredRef.current.has(firedKey)) {
          reminderFiredRef.current.add(firedKey);
          sendNotification('🍽️ Journal nutritionnel', "N'oublie pas d'enregistrer tes repas !");
        }
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [reminders]);

  // Nettoyer stream quand le modal barcode se ferme
  useEffect(() => { if (!barcodeModal) stopBarcodeStream(); }, [barcodeModal]);

  const AI_ANALYZE_MSGS = ['Identification des aliments…', 'Calcul des macros…', 'Enregistrement dans le journal…'];

  useEffect(() => {
    if (!loading && !photoLoading) { setAiMsgIdx(0); return; }
    const id = setInterval(() => setAiMsgIdx(i => (i + 1) % 3), 1800);
    return () => clearInterval(id);
  }, [loading, photoLoading]);

  function showToast(msg, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  const totals = entries.reduce((acc,e) => ({ kcal:acc.kcal+e.kcal, protein:acc.protein+e.protein, carbs:acc.carbs+e.carbs, fat:acc.fat+e.fat }), { kcal:0, protein:0, carbs:0, fat:0 });
  const sportBurned   = stravaActivities.reduce((a,act)=>a+(act.caloriesAdjusted||act.calories||0),0);
  const effectiveGoal = goal + sportBurned;
  const pct       = totals.kcal / effectiveGoal;
  const ringColor = totals.kcal > effectiveGoal        ? "#c87070"
                  : totals.kcal > effectiveGoal * 0.85 ? "#c8a060"
                  : totals.kcal > goal                 ? "#5a9abf"
                  : "#7abf8a";
  const circ      = 2*Math.PI*68;
  const dash      = Math.min(pct,1)*circ;

  const favorites = [...ingredients].filter(i=>(i.usageCount||0)>0).sort((a,b)=>(b.usageCount||0)-(a.usageCount||0)).slice(0,6);
  const displayData = statsRange===7 ? weekData : statsRange===30 ? monthData : longData;
  const maxKcal  = Math.max(...displayData.map(d=>d.kcal), goal);
  const activeDays  = displayData.filter(d=>d.kcal>0);
  const avgKcal     = activeDays.length ? Math.round(activeDays.reduce((a,d)=>a+d.kcal,0)/activeDays.length) : 0;
  const bestDay     = displayData.reduce((best,d)=>d.kcal>best.kcal?d:best, { kcal:0, day:"—" });
  const daysOnGoal  = displayData.filter(d=>d.kcal>0&&d.kcal<=goal*1.05).length;

  async function analyze() {
    if (!input.trim()) return;
    setLoading(true); setError("");
    const savedInput = input;
    const tempId = `tmp-${Date.now()}`;
    setEntries(prev => [...prev, { id: tempId, name: savedInput, kcal: 0, protein: 0, carbs: 0, fat: 0, meal: currentMeal, pending: true }]);
    setInput("");
    try {
      const res  = await fetch("/api/analyze", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text:savedInput, date:key, meal:currentMeal }) });
      const data = await res.json();
      if (data.error) {
        setEntries(prev => prev.filter(e => e.id !== tempId));
        setInput(savedInput);
        setError(data.error); setLoading(false); return;
      }
      setEntries(prev => [...prev.filter(e => e.id !== tempId), ...data.items]);
      showToast(`✓ ${data.items.length} aliment${data.items.length > 1 ? 's' : ''} ajouté${data.items.length > 1 ? 's' : ''}`);
      textRef.current?.focus();
    } catch {
      setEntries(prev => prev.filter(e => e.id !== tempId));
      setInput(savedInput);
      setError("Impossible d'analyser. Réessaie.");
    }
    setLoading(false);
  }

  async function analyzePhoto(file) {
    if (!file) return;
    setPhotoLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('date', key);
      fd.append('meal', currentMeal);
      const res  = await fetch("/api/analyze", { method:"POST", body:fd });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setEntries(prev=>[...prev,...data.items]);
    } catch { setError("Impossible d'analyser la photo. Réessaie."); }
    setPhotoLoading(false);
  }

  async function removeEntry(id) {
    setEntries(prev=>prev.filter(e=>e.id!==id));
    setSelectedIds(prev=>{ const s=new Set(prev); s.delete(id); return s; });
    await fetch('/api/entries', { method:'DELETE', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date:key, id }) });
    showToast('Entrée supprimée', 'info');
  }

  function toggleSelect(id) { setSelectedIds(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; }); }

  function openSaveFromSelection() { setPendingItems(entries.filter(e=>selectedIds.has(e.id))); setSaveModal(true); }

  async function saveRecipe() {
    if (!recipeName.trim()||!pendingItems.length) return;
    try {
      const res  = await fetch('/api/recipes', { method:'POST', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:recipeName, category:saveCategory, items:pendingItems }) });
      const data = await res.json();
      setRecipes(prev=>[...prev,data.recipe]);
      setSaveModal(false); setRecipeName(""); setPendingItems([]); setSelectedIds(new Set());
      showToast(`Recette « ${data.recipe.name} » enregistrée`);
    } catch(e) { showToast("Erreur lors de l'enregistrement", 'error'); }
  }

  async function addRecipeToDay(scaledItems, recipeName) {
    const tot = scaledItems.reduce((acc,i)=>({ kcal:acc.kcal+i.kcal, protein:acc.protein+i.protein, carbs:acc.carbs+i.carbs, fat:acc.fat+i.fat }), { kcal:0, protein:0, carbs:0, fat:0 });
    const res  = await fetch('/api/entries', { method:'POST', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date:key, items:[{ type:"recipe", name:recipeName, items:scaledItems, meal:currentMeal, ...tot }] }) });
    const data = await res.json();
    setEntries(prev=>[...prev,...data.items]);
    showToast(`${recipeName} ajoutée au journal`);
    setTab("journal");
  }

  async function deleteRecipe(id) {
    setRecipes(prev=>prev.filter(r=>r.id!==id));
    await fetch('/api/recipes', { method:'DELETE', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) });
    showToast('Recette supprimée', 'info');
  }

  async function updateRecipeItems(id, items) {
    if (!items.length) { deleteRecipe(id); return; }
    await fetch('/api/recipes', { method:'PATCH', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, items }) });
    setRecipes(prev=>prev.map(r=>r.id===id?{ ...r, items }:r));
  }

  async function addIngredientToDay(ing, qty) {
    const m = getMacros(ing, qty);
    const res  = await fetch('/api/entries', { method:'POST', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date:key, items:[{ name:ing.name, quantity:qty, unit:ing.baseUnit, meal:currentMeal, ...m }] }) });
    const data = await res.json();
    setEntries(prev=>[...prev,...data.items]);
    fetch('/api/ingredients', { method:'PATCH', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:ing.id, lastQty:qty }) });
    setIngredients(prev=>prev.map(i=>i.id===ing.id?{ ...i, usageCount:(i.usageCount||0)+1, lastQty:qty }:i));
  }

  async function renameRecipe(id, name) {
    await fetch('/api/recipes', { method:'PATCH', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, name }) });
    setRecipes(prev=>prev.map(r=>r.id===id?{ ...r, name }:r));
  }

  function startFavAdd(ing) { setFavAdding(prev=>({ ...prev, [ing.id]: ing.lastQty ?? (ing.per100?100:1) })); }
  function cancelFavAdd(id) { setFavAdding(prev=>{ const s={...prev}; delete s[id]; return s; }); }
  async function confirmFavAdd(ing) { if (favAdding[ing.id]>0) await addIngredientToDay(ing, favAdding[ing.id]); cancelFavAdd(ing.id); }

  // --- Barcode ---
  function stopBarcodeStream() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current = null; }
  }

  async function startBarcodeScanner() {
    setBarcodeError(""); setBarcodeManual("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:{ ideal:'environment' } } }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      if (!('BarcodeDetector' in window)) {
        setBarcodeError("Scanner non supporté sur ce navigateur. Utilise la saisie manuelle ci-dessous.");
        return;
      }
      const detector = new window.BarcodeDetector({ formats:['ean_13','ean_8','upc_a','upc_e','code_128'] });
      const scan = async () => {
        const canvas = canvasRef.current;
        const video  = videoRef.current;
        if (!canvas || !video || video.readyState < 2) { rafRef.current = requestAnimationFrame(scan); return; }
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        try {
          const codes = await detector.detect(canvas);
          if (codes.length > 0) { await fetchBarcode(codes[0].rawValue); return; }
        } catch {}
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch(err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setBarcodeError("Accès caméra refusé. Dans Chrome : clique sur 🔒 dans la barre d'adresse → Caméra → Autoriser, puis recharge la page.");
      } else if (err.name === 'NotFoundError') {
        setBarcodeError("Aucune caméra détectée sur cet appareil.");
      } else {
        setBarcodeError("Caméra inaccessible. Utilise la saisie manuelle ci-dessous.");
      }
    }
  }

  async function fetchBarcode(code) {
    setBarcodeError("");
    try {
      const res  = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.error) { setBarcodeError(data.error); return; }
      stopBarcodeStream();
      setBarcodeModal(false);
      setBarcodeConfirm(data.product);
      setBarcodeQty(100);
    } catch { setBarcodeError("Erreur réseau."); }
  }

  async function confirmBarcodeAdd() {
    if (!barcodeConfirm) return;
    const p = barcodeConfirm;
    const factor = barcodeQty / 100;
    const entry = { name:p.name, quantity:barcodeQty, unit:'g', kcal:Math.round(p.kcal*factor), protein:Math.round(p.protein*factor*10)/10, carbs:Math.round(p.carbs*factor*10)/10, fat:Math.round(p.fat*factor*10)/10, meal:currentMeal };
    const res  = await fetch('/api/entries', { method:'POST', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date:key, items:[entry] }) });
    const data = await res.json();
    setEntries(prev=>[...prev,...data.items]);
    setBarcodeConfirm(null);
    showToast(`${entry.name} ajouté`);
    setTab("journal");
  }

  // --- Poids ---
  async function logWeight() {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) return;
    const today = dateKey(new Date());
    const res  = await fetch('/api/weight', { method:'POST', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date:today, value:val }) });
    const data = await res.json();
    setWeightLog(prev => {
      const filtered = prev.filter(e=>e.date!==today);
      return [...filtered, data.entry].sort((a,b)=>a.date.localeCompare(b.date));
    });
    setWeight(String(val));
    setWeightInput("");
    showToast('Poids enregistré ✓');
  }

  async function deleteWeight(id) {
    await fetch('/api/weight', { method:'DELETE', headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) });
    setWeightLog(prev=>prev.filter(e=>e.id!==id));
  }

  // --- Export CSV ---
  async function getSuggestions(remKcal, remProtein, remCarbs, remFat, ings, recs, type = 'plat', withWhey = true) {
    setSuggestLoading(true); setSuggestions([]);
    try {
      const topIngs = [...(ings||[])].sort((a,b)=>(b.usageCount||0)-(a.usageCount||0)).slice(0,25).map(i=>({
        name: i.name,
        kcal: i.per100 ? Math.round(i.per100.kcal) : i.perUnit?.kcal,
        unit: i.baseUnit,
        protein: i.per100 ? i.per100.protein : i.perUnit?.protein,
      }));
      const topRecs = (recs||[]).slice(0,10).map(r=>({ name:r.name, items:(r.items||[]).map(i=>({ name:i.name, quantity:i.quantity, unit:i.unit, kcal:i.kcal, protein:i.protein, carbs:i.carbs, fat:i.fat })) }));
      const latestBlood = bloodTests[0] ? {
        summary: bloodTests[0].summary || null,
        markers: (bloodTests[0].markers || []).filter(m => m.status !== 'ok').map(m => ({ name: m.name, value: m.value, unit: m.unit, status: m.status })),
        recommendations: (bloodTests[0].recommendations || []).slice(0, 8),
        markerRecos: (bloodTests[0].markerRecos || []),
        weeklyFocus: bloodTests[0].weeklyFocus || null,
      } : null;
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remainingKcal: remKcal, remainingProtein: remProtein, remainingCarbs: remCarbs, remainingFat: remFat, hour: new Date().getHours(), ingredientLibrary: topIngs, savedRecipes: topRecs, type, withWhey, bloodTest: latestBlood, healthHistory }),
      });
      if (res.status === 402) { setUpgradeModal({ feature: 'suggestions' }); setSuggestLoading(false); return; }
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
      else setSuggestions([{ name: '⚠️ Erreur', steps: [data.error || 'Réponse inattendue de l\'API'], ingredients: [], kcal: 0, protein: 0, carbs: 0, fat: 0 }]);
    } catch(e) { setSuggestions([{ name: '⚠️ Erreur réseau', steps: [e.message], ingredients: [], kcal: 0, protein: 0, carbs: 0, fat: 0 }]); }
    setSuggestLoading(false);
  }

  function saveGeneratedRecipe(s, type = 'plat') {
    const items = s.ingredients || [];
    const gramItems = items.filter(i => (i.unit||'').toLowerCase().startsWith('g'));
    const totalGrams = gramItems.reduce((a, i) => a + i.quantity, 0);
    const withMacros = items.map(i => {
      const isGram = (i.unit||'').toLowerCase().startsWith('g');
      const ratio = (totalGrams > 0 && isGram) ? i.quantity / totalGrams : 1 / items.length;
      return { id: Date.now() + Math.random(), name: i.name, quantity: i.quantity, unit: i.unit, kcal: Math.round(s.kcal * ratio), protein: Math.round(s.protein * ratio * 10) / 10, carbs: Math.round(s.carbs * ratio * 10) / 10, fat: Math.round(s.fat * ratio * 10) / 10 };
    });
    const catMap = { maintenant: 'plat', plat: 'plat', dessert: 'dessert', biohack: 'biohack' };
    setPendingItems(withMacros);
    setRecipeName(s.name);
    setSaveCategory(catMap[type] || 'dejeuner');
    setSaveModal(true);
  }

  function saveReportToHistory(html, title, days, type = 'nutritionnel', summary = null) {
    const entry = { title, days, date: new Date().toLocaleDateString('fr-FR'), html, id: Date.now(), type, summary };
    setReportHistory(prev => [entry, ...prev].slice(0, 20));
    setReportHistoryIdx(0);
    fetch('/api/reports', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, days, html, type, summary }) }).catch(()=>{});
  }

  async function generateHealthReport() {
    setReportTitle("Analyse biologique"); setReportStatus('loading'); setReportHtml(null);
    try {
      const res = await fetch('/api/report', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type:'health', sex, birthdate, height, weight }) });
      if (res.status === 402) { setUpgradeModal({ feature: 'reports' }); setReportStatus('idle'); return; }
      let data; try { data = await res.json(); } catch { setReportHtml(`<p style="color:#c87070">Erreur HTTP ${res.status}</p>`); setReportStatus('ready'); return; }
      if (res.status === 429) { setReportHtml(`<p style="color:#c87070">Limite atteinte — ${data.limitLabel}.</p>`); setReportStatus('ready'); return; }
      if (data.error) setReportHtml(`<p style="color:#c87070">Erreur : ${data.error}</p>`);
      else { setReportHtml(data.html); saveReportToHistory(data.html, "Analyse biologique", null, 'medical'); }
    } catch(e) { setReportHtml(`<p style="color:#c87070">Erreur : ${e.message}</p>`); }
    setReportStatus('ready');
  }

  async function finishOnboarding() {
    setObSaving(true);
    try {
      const calcBMR = (obHeight && obWeight && obBirthdate)
        ? (() => {
            const age = Math.floor((new Date() - new Date(obBirthdate)) / (365.25*24*3600*1000));
            return Math.round(10*Number(obWeight)+6.25*Number(obHeight)-5*age+(obSex==='homme'?5:-161));
          })()
        : null;
      const maintien = calcBMR ? Math.round(calcBMR*1.2) : 2000;
      const modeKcal = obMode==='perte' ? maintien-400 : obMode==='masse' ? maintien+300 : maintien;
      const kcal  = Number(obKcal) || modeKcal;
      const ratios = obMode==='perte'?{p:0.35,g:0.35,l:0.30}:obMode==='masse'?{p:0.25,g:0.50,l:0.25}:{p:0.25,g:0.45,l:0.30};
      const prot  = Number(obProtein) || Math.round(kcal*ratios.p/4);
      const carbs = Math.round(kcal*ratios.g/4);
      const fat   = Math.round(kcal*ratios.l/9);
      await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        sex: obSex, birthdate: obBirthdate, height: obHeight, weight: obWeight,
        goalKcal: kcal, goalProtein: prot, goalCarbs: carbs, goalFat: fat,
        mode: obMode, onboardingDone: true,
      })});
      setSex(obSex); setBirthdate(obBirthdate); setHeight(obHeight); setWeight(obWeight);
      setGoal(kcal); setProteinGoal(prot); setCarbsGoal(carbs); setFatGoal(fat);
    } catch(e) {}
    setObSaving(false); setOnboardStep(0);
  }

  async function linkCoach() {
    if (!coachCode.trim()) return;
    const res = await fetch('/api/coach/link', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code: coachCode.trim() }) });
    const data = await res.json();
    if (data.ok) { setCoachLinked(true); setCoachLinkMsg(`Lié à ${data.coachName} ✓`); setCoachCode(''); }
    else setCoachLinkMsg(data.error || 'Code invalide');
  }

  async function unlinkCoach() {
    await fetch('/api/coach/link', { method:'DELETE' });
    setCoachLinked(false); setCoachLinkMsg('');
  }

  async function requestReport() {
    setReportReqLoading(true);
    await fetch('/api/report-request', { method: 'POST' });
    setReportReqSent(true);
    setReportReqLoading(false);
  }

  async function generateReport() {
    setReportTitle("Rapport nutritionnel"); setReportStatus('loading'); setReportHtml(null);
    try {
      const prevReports = reportHistory.filter(r => r.type !== 'medical').slice(0, 3).map(r => ({
        date: r.date, days: r.days, summary: r.summary || null,
      }));
      const res = await fetch('/api/report', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ sex, birthdate, height, weight, goalKcal:goal, goalProtein:proteinGoal, goalCarbs:carbsGoal, goalFat:fatGoal, days:reportDays, prevReports }) });
      if (res.status === 402) { setUpgradeModal({ feature: 'reports' }); setReportStatus('idle'); return; }
      let data; try { data = await res.json(); } catch { setReportHtml(`<p style="color:#c87070">Erreur HTTP ${res.status}</p>`); setReportStatus('ready'); return; }
      if (res.status === 429) { setReportHtml(`<p style="color:#c87070">Limite atteinte — ${data.limitLabel}.</p>`); setReportStatus('ready'); return; }
      if (data.error) setReportHtml(`<p style="color:#c87070">Erreur : ${data.error}</p>`);
      else { setReportHtml(data.html); saveReportToHistory(data.html, `Rapport nutritionnel`, reportDays, 'nutritionnel', data.summary || null); }
    } catch(e) { setReportHtml(`<p style="color:#c87070">Erreur : ${e.message}</p>`); }
    setReportStatus('ready');
  }

  // --- Rappels ---
  async function addReminder(time = '08:00') {
    if (typeof window === 'undefined' || !('Notification' in window)) { alert('Notifications non supportées sur cet appareil.'); return; }
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { alert('Permission refusée. Active les notifications dans les réglages de ton navigateur ou de l\'app.'); return; }
    }
    await subscribeToPush();
    const newReminder = { id: Date.now().toString(), time };
    setReminders(prev => [...prev, newReminder]);
  }
  function removeReminder(id) { setReminders(prev => prev.filter(r => r.id !== id)); }
  function updateReminderTime(id, time) { setReminders(prev => prev.map(r => r.id === id ? { ...r, time } : r)); }

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        {user?.isViewAs && (
          <div style={{ background:"#1a1200", border:"1px solid #c8a870", borderRadius:8, padding:"8px 14px", marginBottom:12, fontSize:"0.65rem", color:"#c8a870", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
            <span>👁 Vue coach — <strong>{user.name}</strong></span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setProfilOpen(true)}
                style={{ background:"#c8a870", border:"none", borderRadius:6, padding:"5px 12px", color:"#0d0d0d", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", fontWeight:600 }}>
                ✏️ Modifier les objectifs
              </button>
              <button onClick={async () => { await fetch('/api/auth/view-as', { method:'DELETE' }); window.location.href = '/coach'; }}
                style={{ background:"transparent", border:"1px solid #c8a870", borderRadius:6, padding:"4px 10px", color:"#c8a870", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>
                ← Retour
              </button>
            </div>
          </div>
        )}
        {!isOnline && (
          <div style={{ background:"#1a1000", border:"1px solid #4a3000", borderRadius:8, padding:"7px 12px", marginBottom:12, fontSize:"0.6rem", color:"#c8a060", textAlign:"center", letterSpacing:1 }}>
            {t('app.offline_msg')}
          </div>
        )}
        <div>
        <div className="header" style={{ position:"relative" }}>
          <h1>Nutrainer</h1>
          <div className="sub">{t('app.subtitle')}</div>
          {user && (
            <button onClick={()=>setProfilOpen(true)} style={{ position:"absolute", top:12, right:0, width:36, height:36, borderRadius:"50%", background:"#2a2a1e", border:"1px solid #4a4a3a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:"0.75rem", color:"#c8b890", fontWeight:500 }}>
              {(user.name||'?')[0].toUpperCase()}
            </button>
          )}
        </div>

        <div className="tabs">
          {[{ id:"journal",label:t('app.tab_journal')},{ id:"recettes",label:t('app.tab_recipes')},{ id:"stats",label:t('app.tab_stats')},{ id:"sante",label:t('app.tab_health')},{ id:"programme",label:t('app.tab_program')}].map(tb => (
            <button key={tb.id} className={`tab ${tab===tb.id?"active":""}`} onClick={()=>setTab(tb.id)}>{tb.label}</button>
          ))}
        </div>

        {/* ─── Notifications coach ─── */}
        {coachNotifs.length > 0 && coachNotifs.map(n => (
          <div key={n.id} style={{ background:"#0d1a0d", border:"1px solid #2a5a2a", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ fontSize:"0.62rem", color:"#7abf8a" }}>
                {n.type === 'program' ? t('app.notif_program')(n.coachName) : n.type === 'muscuProgram' ? t('app.notif_muscu')(n.coachName) : n.type === 'bloodResult' ? t('app.notif_blood')(n.coachName) : n.type === 'report' ? t('app.notif_report')(n.coachName) : t('app.notif_goals')(n.coachName)}
              </div>
              <button onClick={async ()=>{ await fetch('/api/coach/athlete',{method:'PATCH'}); setCoachNotifs([]); }}
                style={{ background:"transparent", border:"none", color:"#3a5a3a", fontSize:"0.7rem", cursor:"pointer", padding:0 }}>✕</button>
            </div>
            {n.type === 'program' && (
              <button onClick={()=>{ setTab('programme'); fetch('/api/coach/athlete',{method:'PATCH'}); setCoachNotifs([]); }}
                style={{ fontSize:"0.6rem", color:"#7abf8a", background:"#1a2a1a", border:"1px solid #2a4a2a", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                {t('app.view_program')}
              </button>
            )}
            {n.type === 'bloodResult' && (
              <button onClick={()=>{ setTab('sante'); fetch('/api/coach/athlete',{method:'PATCH'}); setCoachNotifs([]); }}
                style={{ fontSize:"0.6rem", color:"#7abf8a", background:"#1a2a1a", border:"1px solid #2a4a2a", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                {t('app.view_health')}
              </button>
            )}
            {n.type === 'report' && (
              <button onClick={()=>{ setTab('sante'); fetch('/api/coach/athlete',{method:'PATCH'}); setCoachNotifs([]); }}
                style={{ fontSize:"0.6rem", color:"#7abf8a", background:"#1a2a1a", border:"1px solid #2a4a2a", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                {t('app.view_report')}
              </button>
            )}
            {n.goals && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: n.note?6:0 }}>
                {[{l:"Kcal",v:n.goals.goalKcal},{l:"Prot",v:`${n.goals.goalProtein}g`},{l:"Gluc",v:`${n.goals.goalCarbs}g`},{l:"Lip",v:`${n.goals.goalFat}g`}].map(m=>(
                  <span key={m.l} style={{ fontSize:"0.6rem", background:"#1a2a1a", border:"1px solid #2a4a2a", borderRadius:6, padding:"3px 8px", color:"#a8dfa8" }}>{m.l} : {m.v}</span>
                ))}
              </div>
            )}
            {n.note && <div style={{ fontSize:"0.62rem", color:"#5a8a5a", marginTop:6, fontStyle:"italic" }}>"{n.note}"</div>}
          </div>
        ))}

        {/* ─── JOURNAL ─── */}
        {tab==="journal" && (<>
          {notifPermission === 'default' && (
            <div style={{ background:"#1a1a12", border:"1px solid #3a3520", borderRadius:12, padding:"12px 16px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ fontSize:"0.65rem", color:"#c8b890" }}>{t('app.notif_title')}</div>
                <div style={{ fontSize:"0.54rem", color:"#5a5a3a", marginTop:3 }}>{t('app.notif_desc')}</div>
              </div>
              <button onClick={enablePatientNotifications}
                style={{ background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, padding:"7px 14px", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", fontWeight:500, cursor:"pointer", whiteSpace:"nowrap" }}>
                {t('app.notif_btn')}
              </button>
            </div>
          )}
          {streak > 0 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:12, padding:"6px 14px", background:"#1a1500", border:"1px solid #3a3000", borderRadius:20, width:"fit-content", margin:"0 auto 12px" }}>
              <span style={{ fontSize:"0.9rem" }}>🔥</span>
              <span style={{ fontSize:"0.65rem", color:"#c8a060", letterSpacing:1 }}>{t('app.streak')(streak)}</span>
            </div>
          )}
          <div className="date-nav">
            <button onClick={()=>setOffset(o=>o-1)}>←</button>
            <div className="date-label">{formatDate(today)}</div>
            <button onClick={()=>setOffset(o=>Math.min(o+1,0))} disabled={offset===0} style={{ opacity:offset===0?0.2:1 }}>→</button>
          </div>
          {!settingsLoaded ? (
            <div>
              <div className="skeleton-pulse skeleton-ring"/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
                {[0,1,2].map(i=><div key={i} className="skeleton-pulse" style={{height:76,borderRadius:10}}/>)}
              </div>
              <div className="skeleton-pulse" style={{height:100,borderRadius:14,marginBottom:12}}/>
              <div className="skeleton-pulse" style={{height:72,borderRadius:14,marginBottom:8}}/>
              <div className="skeleton-pulse" style={{height:72,borderRadius:14}}/>
            </div>
          ) : (<>
          <div className="ring-wrap">
            <svg width="170" height="170" viewBox="0 0 170 170">
              <circle cx="85" cy="85" r="68" fill="none" stroke="#1e1e1e" strokeWidth="10" />
              <circle cx="85" cy="85" r="68" fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`} style={{ transition:"stroke-dasharray 0.6s ease, stroke 0.4s" }} />
            </svg>
            <div className="ring-center">
              <div className="cals">{totals.kcal}</div>
              <div className="cals-label">kcal</div>
              <div className="goal-text">/ {goal} {t('app.goal')}</div>
              {sportBurned > 0 && <div style={{ fontSize:"0.55rem", color:"#fc4c02", marginTop:2 }}>+⚡{sportBurned} sport</div>}
            </div>
          </div>
          <div className="macros">
            {[{ label:t('app.proteins'), val:totals.protein, max:proteinGoal, color:"#7a9abf" },{ label:t('app.carbs'), val:totals.carbs, max:carbsGoal, color:"#c8b890" },{ label:t('app.fats'), val:totals.fat, max:fatGoal, color:"#bf9a7a" }].map(m => (
              <div className="macro-card" key={m.label}>
                <div className="m-val">{Math.round(m.val)}<span style={{ fontSize:"0.65rem", color:"#5a5a4a" }}>g</span></div>
                <div className="m-label">{m.label}</div>
                <div className="m-goal">/ {m.max}g</div>
                <div className="m-bar"><div className="m-bar-fill" style={{ width:`${Math.min(m.val/m.max*100,100)}%`, background:m.color }} /></div>
              </div>
            ))}
          </div>



          <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" style={{ display:"none" }}
            onChange={e=>{ analyzePhoto(e.target.files?.[0]); e.target.value=""; }} />


          {favorites.length > 0 && (
            <div className="favs-wrap">
              <div className="favs-label">{t('app.favorites')}</div>
              <div className="favs-scroll">
                {favorites.map(ing => {
                  const isAdding = favAdding[ing.id] != null;
                  if (isAdding) return (
                    <div className="fav-expand" key={ing.id}>
                      <span className="fav-name">{ing.name}</span>
                      <input className="fav-qty-inp" type="number" min="0" step="any" value={favAdding[ing.id]} autoFocus
                        onFocus={e=>e.target.select()} onChange={e=>setFavAdding(prev=>({ ...prev,[ing.id]:+e.target.value }))} />
                      <span className="fav-unit">{ing.baseUnit}</span>
                      <button className="btn" style={{ fontSize:"0.6rem",padding:"3px 8px" }} onClick={()=>confirmFavAdd(ing)}>✓</button>
                      <button className="btn secondary" style={{ fontSize:"0.6rem",padding:"3px 6px" }} onClick={()=>cancelFavAdd(ing.id)}>✕</button>
                    </div>
                  );
                  return <button key={ing.id} className="fav-chip" onClick={()=>startFavAdd(ing)}>{getIcon(ing)} {ing.name}</button>;
                })}
              </div>
            </div>
          )}

          <div className="input-area">
            <div style={{ position:'relative', marginBottom:8 }}>
              <button onClick={() => setMealDropdownOpen(o => !o)}
                style={{ background:'#0d0d0d', border:'1px solid #c8b890', borderRadius:20, padding:'4px 12px', color:'#c8b890', fontSize:'0.65rem', fontFamily:"'DM Mono',monospace", cursor:'pointer', letterSpacing:'1px', display:'inline-flex', alignItems:'center', gap:5 }}>
                {currentMeal.startsWith('Petit')? '🌅' : currentMeal.startsWith('Collation')? '🍎' : '🍽️'} {currentMeal} <span style={{ opacity:0.5 }}>▾</span>
              </button>
              {mealDropdownOpen && (<>
                <div style={{ position:'fixed', inset:0, zIndex:99 }} onClick={() => setMealDropdownOpen(false)} />
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:100, background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, padding:4, minWidth:150, boxShadow:'0 4px 20px rgba(0,0,0,0.6)' }}>
                  {mealSlots.map(slot => (
                    <div key={slot} style={{ display:'flex', alignItems:'center', gap:2 }}>
                      <button onClick={() => { setCurrentMeal(slot); setMealDropdownOpen(false); }}
                        style={{ flex:1, background: slot===currentMeal ? '#1f1e18' : 'none', border:'none', borderRadius:7, padding:'7px 12px', color: slot===currentMeal ? '#c8b890' : '#5a5a4a', fontSize:'0.62rem', fontFamily:"'DM Mono',monospace", cursor:'pointer', textAlign:'left', letterSpacing:'1px' }}>
                        {slot.startsWith('Petit')? '🌅' : slot.startsWith('Collation')? '🍎' : '🍽️'} {slot}
                      </button>
                      {slot !== 'Petit-déjeuner' && entries.filter(e=>e.meal===slot).length === 0 && (
                        <button onClick={() => { setMealSlots(p=>p.filter(s=>s!==slot)); if(currentMeal===slot) setCurrentMeal('Petit-déjeuner'); }}
                          style={{ background:'none', border:'none', color:'#3a3a2a', fontSize:'0.7rem', cursor:'pointer', padding:'4px 6px', borderRadius:5, lineHeight:1 }}
                          title="Supprimer">✕</button>
                      )}
                    </div>
                  ))}
                  {mealSlots.length < 8 && (<>
                    <div style={{ borderTop:'1px solid #2a2a2a', margin:'4px 0' }}/>
                    <button onClick={() => { const n=mealSlots.filter(s=>s.startsWith('Repas')).length+1; const name=`Repas ${n}`; setMealSlots(p=>[...p,name]); setCurrentMeal(name); setMealDropdownOpen(false); }}
                      style={{ display:'block', width:'100%', background:'none', border:'none', borderRadius:7, padding:'6px 12px', color:'#4a4a3a', fontSize:'0.6rem', fontFamily:"'DM Mono',monospace", cursor:'pointer', textAlign:'left', letterSpacing:'1px' }}>+ Repas</button>
                    <button onClick={() => { const n=mealSlots.filter(s=>s.startsWith('Collation')).length+1; const name=`Collation ${n}`; setMealSlots(p=>[...p,name]); setCurrentMeal(name); setMealDropdownOpen(false); }}
                      style={{ display:'block', width:'100%', background:'none', border:'none', borderRadius:7, padding:'6px 12px', color:'#4a4a3a', fontSize:'0.6rem', fontFamily:"'DM Mono',monospace", cursor:'pointer', textAlign:'left', letterSpacing:'1px' }}>+ Collation</button>
                  </>)}
                </div>
              </>)}
            </div>
            <textarea ref={textRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); analyze(); } }}
              placeholder={t('app.input_placeholder')} rows={3} />
            <div className="input-row">
              <span className="input-hint">{t('app.input_hint')}</span>
              <div style={{ display:"flex", gap:6 }}>
                <button className="btn secondary" style={{ padding:"8px 10px", fontSize:"1rem" }} title="Photo du repas"
                  onClick={()=>cameraRef.current?.click()} disabled={photoLoading||loading}>📷</button>
                <button className="btn secondary" style={{ padding:"8px 10px", fontSize:"1rem" }} title="Scanner un code-barres"
                  onClick={()=>{ setBarcodeModal(true); startBarcodeScanner(); }}>▦</button>
                <button className="btn" onClick={analyze} disabled={loading||photoLoading||!input.trim()||!!user?.isViewAs}>
                  {loading||photoLoading?"...":t('app.analyze')}
                </button>
              </div>
            </div>
          </div>
          {(loading||photoLoading) && <div className="loading-row"><div className="dot-pulse"><span/><span/><span/></div>{photoLoading ? t('app.loading_photo') : AI_ANALYZE_MSGS[aiMsgIdx % 3]}</div>}
          {error && <div className="error-msg">{error}</div>}

          <div className="water-card">
            <div className="water-header">
              <span className="water-label">{t('app.water')}</span>
              <span className="water-count">{waterCount} / 8 verres</span>
            </div>
            <div className="water-glasses">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={`water-glass${i < waterCount ? " filled" : ""}`}
                  onClick={() => !user?.isViewAs && logWater(i < waterCount ? i : i + 1)}>💧</span>
              ))}
            </div>
            <div className="water-goal">{waterCount >= 8 ? t('app.water_done') : `${(waterCount * 0.25).toFixed(2)}L / 2L`}</div>
          </div>


          {entries.length > 0 && (() => {
            const mealIcon = s => s.startsWith('Petit')? '🌅' : s.startsWith('Repas')? '🍽️' : s.startsWith('Collation')? '🍎' : '🍽️';
            const groups = {};
            for (const e of entries) {
              const m = e.meal || 'Autre';
              if (!groups[m]) groups[m] = [];
              groups[m].push(e);
            }
            const orderedMeals = [...mealSlots.filter(m=>groups[m]), ...Object.keys(groups).filter(m=>!mealSlots.includes(m))];
            return (<>
              <div className="section-label" style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{t('app.today_meals')} — {entries.length}</span>
              </div>
              {selectedIds.size > 0 && (
                <div className="select-bar">
                  <span>{selectedIds.size} ✓</span>
                  <button className="btn" style={{ fontSize:"0.65rem",padding:"7px 12px" }} onClick={openSaveFromSelection}>{t('app.create_recipe_sel')}</button>
                  <button className="btn secondary" style={{ fontSize:"0.65rem",padding:"7px 10px" }} onClick={()=>setSelectedIds(new Set())}>✕</button>
                </div>
              )}
              {orderedMeals.map(meal => {
                const mealEntries = groups[meal];
                const mealKcal = mealEntries.reduce((a,e)=>a+e.kcal,0);
                return (
                  <div key={meal}>
                    <div className="meal-group-header">{mealIcon(meal)} {meal} <span style={{ float:"right", color:"#5a5a4a" }}>{mealKcal} kcal</span></div>
                    {mealEntries.map(e => e.pending ? (
                      <div className="entry pending" key={e.id}>
                        <div className="skeleton-pulse" style={{width:28,height:28,flexShrink:0,borderRadius:6}}/>
                        <div className="entry-info">
                          <div className="skeleton-pulse" style={{height:13,borderRadius:4,marginBottom:6,width:'65%'}}/>
                          <div className="skeleton-pulse" style={{height:10,borderRadius:4,width:'40%'}}/>
                        </div>
                        <div className="skeleton-pulse" style={{width:38,height:28,flexShrink:0,borderRadius:6}}/>
                      </div>
                    ) : e.type==="recipe" ? (
                      <JournalRecipeEntry key={e.id} e={e} isSelected={selectedIds.has(e.id)} onSelect={()=>toggleSelect(e.id)} onDelete={()=>removeEntry(e.id)} />
                    ) : (
                      <div className={`entry ${selectedIds.has(e.id)?"selected":""}`} key={e.id}>
                        <input type="checkbox" className="entry-check" checked={selectedIds.has(e.id)} onChange={()=>toggleSelect(e.id)} />
                        <div className="entry-icon">{getIcon(e)}</div>
                        <div className="entry-info">
                          <div className="entry-name">{e.name}{e.quantity!=null?<span style={{ color:"#5a5a4a",fontSize:"0.7rem" }}> · {e.quantity}{e.unit}</span>:null}</div>
                          <div className="entry-macros">P {e.protein}g · G {e.carbs}g · L {e.fat}g</div>
                        </div>
                        <div className="entry-kcal">{e.kcal}<span>kcal</span></div>
                        <button className="del-btn" onClick={()=>removeEntry(e.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>);
          })()}
          {stravaConnected && stravaActivities.length > 0 && (() => {
            const totalBurned = stravaActivities.reduce((a,act)=>a+(act.calories||0),0);
            return (
              <div className="strava-card" style={{ marginTop:12 }}>
                <div className="strava-header">
                  <span className="strava-label">⚡ Strava</span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={()=>fetchStrava(key)} style={{ background:"none", border:"none", color:"#fc4c02", cursor:"pointer", fontSize:"0.75rem", padding:0, opacity:0.7 }} title="Rafraîchir">↻</button>
                    <span style={{ fontSize:"0.75rem", color:"#fc4c02", fontFamily:"'Playfair Display',serif" }}>−{totalBurned} kcal</span>
                  </div>
                </div>
                {stravaActivities.map(act => (
                  <div key={act.id} className="strava-activity">
                    <div>
                      <div style={{ fontSize:"0.72rem", color:"#e8e0d0" }}>{act.typeLabel} — {act.name}</div>
                      <div style={{ fontSize:"0.6rem", color:"#5a5a4a", marginTop:2 }}>
                        {Math.floor(act.duration/60)} min
                        {act.distance > 0 ? ` · ${(act.distance/1000).toFixed(1)} km` : ""}
                        {act.avg_hr ? ` · ♥ ${Math.round(act.avg_hr)} bpm` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize:"0.72rem", color:"#fc4c02", fontFamily:"'Playfair Display',serif" }}>{act.calories > 0 ? `${act.estimated?'~':''}${act.calories} kcal` : "—"}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          {gfitConnected && gfitData && (gfitData.steps > 0 || gfitData.activeMinutes > 0) && (
            <div style={{ background:"#0d1a0d", border:"1px solid #4caf5040", borderRadius:12, padding:"12px 14px", marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:"0.58rem", color:"#4caf50", letterSpacing:2, textTransform:"uppercase" }}>🟢 Google Fit</span>
                <button onClick={()=>fetchGoogleFit(key)} style={{ background:"none", border:"none", color:"#4caf50", cursor:"pointer", fontSize:"0.75rem", padding:0, opacity:0.7 }}>↻</button>
              </div>
              <div style={{ display:"flex", gap:16 }}>
                {gfitData.steps > 0 && <div style={{ fontSize:"0.65rem", color:"#a0d0a0" }}>👟 {gfitData.steps.toLocaleString()} pas</div>}
                {gfitData.activeMinutes > 0 && <div style={{ fontSize:"0.65rem", color:"#a0d0a0" }}>⏱ {gfitData.activeMinutes} min actives</div>}
              </div>
            </div>
          )}
          {entries.length===0&&!loading&&!photoLoading && (
            <div style={{ textAlign:"center", padding:"28px 16px 16px" }}>
              <div style={{ fontSize:"1.8rem", marginBottom:10 }}>🍽</div>
              <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>{t('app.add_food_title')}</div>
              <div style={{ fontSize:"0.6rem", color:"#4a4a3a", lineHeight:1.8 }}>{t('app.add_food_sub').split('\n').map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</div>
            </div>
          )}
          </>)}
        </>)}

        {/* ─── RECETTES ─── */}
        {tab==="recettes" && (<>
          <div className="subtabs">
            <button className={`subtab ${recetteTab==="recettes"?"active":""}`} onClick={()=>setRecetteTab("recettes")}>{t('app.subtab_recipes')}</button>
            <button className={`subtab ${recetteTab==="ingredients"?"active":""}`} onClick={()=>setRecetteTab("ingredients")}>{t('app.subtab_ingredients')}</button>
            <button className={`subtab ${recetteTab==="creation"?"active":""}`} onClick={()=>{ setRecetteTab("creation"); setSuggestions([]); }}>{t('app.subtab_create')}</button>
          </div>
          {recetteTab==="recettes" && (<>
            <div className="section-label">{t('app.my_recipes')} — {recipes.length}</div>
            {recipes.length===0 && (
              <div style={{ textAlign:"center", padding:"28px 16px" }}>
                <div style={{ fontSize:"1.6rem", marginBottom:10 }}>🍲</div>
                <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>{t('app.no_recipes')}</div>
                <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginBottom:20, lineHeight:1.7 }}>{t('app.no_recipes_sub').split('\n').map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</div>
                <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                  <button className="btn secondary" style={{ fontSize:"0.65rem" }} onClick={()=>setRecetteTab("creation")}>{t('app.gen_ai')}</button>
                  <button className="btn secondary" style={{ fontSize:"0.65rem" }} onClick={()=>setRecetteTab("creation")}>{t('app.create_manual')}</button>
                </div>
              </div>
            )}
            {CATEGORIES.map(cat => {
              const catRecipes = recipes.filter(r=>r.category===cat.id);
              if (!catRecipes.length) return null;
              return (
                <div className="category-group" key={cat.id}>
                  <div className="category-header">{cat.label}</div>
                  {catRecipes.map(r => <RecipeCard key={r.id} r={r} onAdd={(items,name)=>addRecipeToDay(items,name)} onDelete={()=>deleteRecipe(r.id)} onUpdateItems={items=>updateRecipeItems(r.id,items)} onRename={name=>renameRecipe(r.id,name)} />)}
                </div>
              );
            })}
            {recipes.filter(r=>!r.category).length>0 && (
              <div className="category-group">
                <div className="category-header">Sans catégorie</div>
                {recipes.filter(r=>!r.category).map(r => <RecipeCard key={r.id} r={r} onAdd={(items,name)=>addRecipeToDay(items,name)} onDelete={()=>deleteRecipe(r.id)} onUpdateItems={items=>updateRecipeItems(r.id,items)} onRename={name=>renameRecipe(r.id,name)} />)}
              </div>
            )}
          </>)}
          {recetteTab==="ingredients" && (
            <IngredientLibrary ingredients={ingredients}
              onDelete={id=>{ fetch('/api/ingredients',{method:'DELETE',headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}); setIngredients(prev=>prev.filter(i=>i.id!==id)); }}
              onCreateRecipe={items=>{ setPendingItems(items); setSaveModal(true); }}
              onAddToJournal={(ing,qty)=>addIngredientToDay(ing,qty)} />
          )}

          {recetteTab==="creation" && (() => {
            const stravaBurned = stravaActivities.reduce((a,act)=>a+(act.caloriesAdjusted||act.calories||0),0);
            const remKcal    = goal + stravaBurned - totals.kcal;
            const remProtein = proteinGoal - totals.protein;
            const remCarbs   = carbsGoal - totals.carbs;
            const remFat     = fatGoal - totals.fat;
            const typeInfo = {
              maintenant: { e:"🕐", label:"Maintenant",        desc:"Suggestions adaptées à l'heure et à vos macros restantes, en priorité avec vos ingrédients et recettes sauvegardées." },
              plat:       { e:"🍽️", label:"Plat",              desc:"Création libre — plats équilibrés et savoureux calculés précisément sur vos objectifs du jour." },
              dessert:    { e:"🧁", label:"Dessert",            desc:"Desserts protéinés gourmands à base de whey ou iso whey. Ingrédients libres, macro-optimisés." },
              biohack:    { e:"⚡", label:"Biohack",            desc:"Optimisation du corps humain : adaptogens, nootropiques, mitochondries, gut microbiome, anti-aging. Science-based." },
            };
            const isBiohack = createTab === 'biohack';
            return (<>
              <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                {Object.entries(typeInfo).map(([id, t]) => (
                  <button key={id}
                    style={{ flex:1, padding:"10px 4px", background: createTab===id ? (id==='biohack'?"#0d1a0d":"#1e1a12") : "#0d0d0d", border:`1px solid ${createTab===id?(id==='biohack'?"#3a7a3a":"#c8b890"):"#2a2a2a"}`, borderRadius:10, fontFamily:"'DM Mono',monospace", fontSize:"0.55rem", color: createTab===id?(id==='biohack'?"#7abf8a":"#c8b890"):"#5a5a4a", cursor:"pointer", textAlign:"center", lineHeight:1.6, transition:"all 0.2s", whiteSpace:"pre-line" }}
                    onClick={()=>{ setCreateTab(id); setSuggestions([]); }}>
                    {t.e}{"\n"}{t.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:"0.65rem", color: isBiohack?"#5a8a5a":"#5a5a4a", marginBottom:14, lineHeight:1.6, padding:"0 2px", borderLeft:`2px solid ${isBiohack?"#3a7a3a":"#2a2a2a"}`, paddingLeft:10 }}>
                {typeInfo[createTab].desc}
              </div>
              {createTab === 'dessert' && (
                <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                  {[{v:true,l:"🥛 Avec whey"},{v:false,l:"🍫 Sans whey"}].map(o => (
                    <button key={String(o.v)}
                      style={{ flex:1, padding:"8px 4px", background: dessertWhey===o.v?"#1e1a12":"#0d0d0d", border:`1px solid ${dessertWhey===o.v?"#c8b890":"#2a2a2a"}`, borderRadius:9, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color: dessertWhey===o.v?"#c8b890":"#5a5a4a", cursor:"pointer", transition:"all 0.2s" }}
                      onClick={()=>{ setDessertWhey(o.v); setSuggestions([]); }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
              {createTab === 'maintenant' && (
                <div style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", gap:8, flexWrap:"wrap" }}>
                  {remKcal > 0 && <span className="need-chip warn">+{Math.round(remKcal)} kcal</span>}
                  {remProtein > 0 && <span className="need-chip warn">+{Math.round(remProtein)}g prot</span>}
                  {remCarbs > 0 && <span className="need-chip">+{Math.round(remCarbs)}g gluc</span>}
                  {remFat > 0 && <span className="need-chip">+{Math.round(remFat)}g lip</span>}
                  {remKcal <= 0 && <span style={{ fontSize:"0.62rem", color:"#7abf8a" }}>Objectif calorique atteint 🎯</span>}
                </div>
              )}
              {isBiohack && (
                <div style={{ background:"#0d1a0d", border:"1px solid #1a4a1a", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:"0.62rem", color:"#5a8a5a", lineHeight:1.6 }}>
                  ⚡ Protocoles indépendants de votre alimentation du jour — basés sur la biologie et la recherche.
                </div>
              )}
              <button style={{ width:"100%", fontSize:"0.7rem", marginBottom:16, background: isBiohack?"#0d1a0d":"#c8b890", color: isBiohack?"#7abf8a":"#0d0d0d", border: isBiohack?"1px solid #3a7a3a":"none", borderRadius:8, padding:"10px", fontFamily:"'DM Mono',monospace", fontWeight:500, letterSpacing:1, cursor:suggestLoading?"not-allowed":"pointer", opacity:suggestLoading?0.6:1, transition:"all 0.2s" }}
                onClick={()=>getSuggestions(remKcal,remProtein,remCarbs,remFat,ingredients,recipes,createTab,dessertWhey)}
                disabled={suggestLoading||!!user?.isViewAs}>
                {suggestLoading ? "Génération en cours…" : isBiohack ? "⚡ Générer des protocoles biohack" : `✨ Générer — ${typeInfo[createTab].label}`}
              </button>
              {suggestLoading && <div className="loading-row"><div className="dot-pulse"><span/><span/><span/></div>{isBiohack?"Analyse des protocoles…":"L'IA compose vos recettes…"}</div>}
              {suggestions.length > 0 && (<>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span className="section-label" style={{ margin:0 }}>{isBiohack?"3 protocoles biohack":"3 suggestions personnalisées"}</span>
                  <button className="del-btn" style={{ fontSize:"0.8rem" }} onClick={()=>setSuggestions([])}>✕</button>
                </div>
                {suggestions.map((s,i) => (
                  <div key={i} style={{ background: isBiohack?"#0a0f0a":"#1a1a1a", border:`1px solid ${isBiohack?"#1a4a2a":"#222"}`, borderRadius:12, padding:14, marginBottom:8 }}>
                    {isBiohack && s.target && (
                      <div style={{ fontSize:"0.52rem", color:"#2a6a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{s.target}</div>
                    )}
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1rem", color: isBiohack?"#8adf9a":"#f0e6c8", marginBottom: isBiohack?2:4 }}>{s.name}</div>
                    {isBiohack && s.timing && (
                      <div style={{ fontSize:"0.58rem", color:"#3a7a4a", marginBottom:8 }}>⏱ {s.timing} · {s.kcal} kcal</div>
                    )}
                    {!isBiohack && (
                      <div style={{ fontSize:"0.62rem", color:"#5a5a4a", marginBottom:10 }}>
                        {s.kcal} kcal · {s.protein}g prot · {s.carbs}g gluc · {s.fat}g lip
                      </div>
                    )}
                    {(s.steps||[]).length > 0 && (
                      <div style={{ borderTop:`1px solid ${isBiohack?"#0a2a1a":"#222"}`, paddingTop:8, marginBottom:8 }}>
                        {s.steps.map((step,j) => (
                          <div key={j} style={{ fontSize:"0.65rem", color: isBiohack?"#5aaf6a":"#8a8070", padding:"3px 0", display:"flex", gap:6 }}>
                            <span style={{ color: isBiohack?"#2a5a2a":"#3a3a2a", flexShrink:0 }}>{j+1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ borderTop:`1px solid ${isBiohack?"#0a2a1a":"#222"}`, paddingTop:8 }}>
                      <div style={{ fontSize:"0.55rem", color: isBiohack?"#2a5a2a":"#3a3a2a", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{isBiohack?"Composition":"Ingrédients"}</div>
                      {(s.ingredients||[]).map((ing,j) => (
                        <div key={j} style={{ fontSize:"0.65rem", color: isBiohack?"#5aaf6a":"#8a8070", padding:"3px 0", display:"flex", justifyContent:"space-between" }}>
                          <span>{ing.name}</span>
                          <span style={{ color: isBiohack?"#3a7a4a":"#5a5a4a", flexShrink:0, marginLeft:8 }}>{ing.quantity}{ing.unit}</span>
                        </div>
                      ))}
                    </div>
                    <button className="btn secondary" style={{ width:"100%", fontSize:"0.62rem", padding:"7px", marginTop:10 }}
                      onClick={()=>saveGeneratedRecipe(s, createTab)}>
                      💾 {t('app.save')}
                    </button>
                  </div>
                ))}
              </>)}
            </>);
          })()}
        </>)}

        {/* ─── STATS ─── */}
        {tab==="stats" && (<>
          <div className="range-toggle">
            {[{n:7,l:'7j'},{n:30,l:'30j'},{n:90,l:'3 mois'},{n:180,l:'6 mois'}].map(({n,l}) => (
              <button key={n} className={`range-btn ${statsRange===n?"active":""}`} onClick={()=>setStatsRange(n)}>{l}</button>
            ))}
          </div>

          {statsRange===7 && (() => {
            const active7 = weekData.filter(d=>d.kcal>0);
            const avg7 = active7.length ? Math.round(active7.reduce((a,d)=>a+d.kcal,0)/active7.length) : 0;
            const prevActive = prevWeekData.filter(d=>d.kcal>0);
            const prevAvg = prevActive.length ? Math.round(prevActive.reduce((a,d)=>a+d.kcal,0)/prevActive.length) : 0;
            const trendDiff = prevAvg > 0 && avg7 > 0 ? avg7 - prevAvg : null;
            const trendPct = trendDiff !== null ? Math.round(Math.abs(trendDiff)/prevAvg*100) : null;
            return (
              <div className="week-chart">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div className="chart-title" style={{ marginBottom:0 }}>Calories — 7 derniers jours</div>
                  {avg7 > 0 && <div style={{ fontSize:"0.6rem", color:"#6b6b5a" }}>moy <span style={{ color:"#c8b890" }}>{avg7}</span> kcal</div>}
                </div>
                <div className="bars">
                  {weekData.map((d,i) => (
                    <div className="bar-wrap" key={i}>
                      <div className="bar-val">{d.kcal>0?d.kcal:""}</div>
                      <div className="bar" style={{ height:`${(d.kcal/maxKcal)*70}px`, background:(()=>{ const eg=goal+(d.burned||0); return d.kcal>eg?"#c87070":d.kcal>eg*0.85?"#c8a060":d.kcal>goal*0.85?"#5a9abf":"#7abf8a"; })() }} />
                      <div className="bar-label">{d.day}</div>
                    </div>
                  ))}
                </div>
                {(trendDiff !== null || active7.length > 0) && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, paddingTop:10, borderTop:"1px solid #1e1e1e", fontSize:"0.6rem" }}>
                    <span style={{ color:"#4a4a3a" }}>Obj. {goal} kcal/j</span>
                    {trendDiff !== null && (
                      <span style={{ color: Math.abs(trendDiff)<100?"#6b6b5a":trendDiff>0?"#c8a060":"#7abf8a" }}>
                        {trendDiff>0?'▲':'▼'} {trendPct}% vs semaine passée
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {(statsRange===90||statsRange===180) && longData.length > 0 && (() => {
            // Grouper par mois
            const byMonth = {};
            for (const d of longData) {
              const m = d.date.slice(0,7);
              if (!byMonth[m]) byMonth[m] = { kcal:[], protein:[], days:0 };
              if (d.kcal > 0) { byMonth[m].kcal.push(d.kcal); byMonth[m].protein.push(d.protein); byMonth[m].days++; }
            }
            const months = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]));
            const avg = arr => arr.length ? Math.round(arr.reduce((a,v)=>a+v,0)/arr.length) : 0;

            // Tendance kcal : premiers 30j vs derniers 30j
            const first30 = longData.slice(0,30).filter(d=>d.kcal>0);
            const last30 = longData.slice(-30).filter(d=>d.kcal>0);
            const avgFirst = avg(first30.map(d=>d.kcal));
            const avgLast = avg(last30.map(d=>d.kcal));
            const trend = avgLast - avgFirst;
            const trendColor = Math.abs(trend) < 50 ? '#c8b890' : trend > 0 ? '#c87070' : '#7abf8a';
            const trendLabel = Math.abs(trend) < 50 ? 'Stable' : trend > 0 ? `+${trend} kcal/j vs début` : `${trend} kcal/j vs début`;

            return (
              <>
                <div className="week-chart" style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div className="chart-title" style={{ marginBottom:0 }}>Tendance calories</div>
                    <div style={{ fontSize:"0.65rem", color: trendColor, fontWeight:500 }}>{trendLabel}</div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(${months.length},1fr)`, gap:6, alignItems:"end" }}>
                    {months.map(([m, data]) => {
                      const mAvg = avg(data.kcal);
                      const maxAvg = Math.max(...months.map(([,d])=>avg(d.kcal)), goal);
                      const h = mAvg > 0 ? Math.max(4, Math.round((mAvg/maxAvg)*70)) : 2;
                      const color = mAvg === 0 ? '#2a2a2a' : mAvg > goal*1.05 ? '#c87070' : mAvg > goal*0.9 ? '#7abf8a' : '#c8b890';
                      const label = new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short'});
                      return (
                        <div key={m} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                          <div style={{ fontSize:"0.52rem", color:"#5a5a4a" }}>{mAvg||''}</div>
                          <div style={{ width:"100%", height:`${h}px`, background:color, borderRadius:"3px 3px 0 0" }}/>
                          <div style={{ fontSize:"0.52rem", color:"#4a4a3a" }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, paddingTop:8, borderTop:"1px solid #1e1e1e" }}>
                    <span style={{ fontSize:"0.6rem", color:"#5a5a4a" }}>Objectif : {goal} kcal</span>
                    <span style={{ fontSize:"0.6rem", color:"#5a5a4a" }}>{longData.filter(d=>d.kcal>0).length} jours loggés / {statsRange}</span>
                  </div>
                </div>

                <div className="week-chart" style={{ marginBottom:12 }}>
                  <div className="chart-title">Résumé mensuel</div>
                  {months.map(([m, data]) => {
                    const mKcal = avg(data.kcal);
                    const mProt = avg(data.protein);
                    const label = new Date(m+'-01').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
                    return (
                      <div key={m} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #1e1e1e", fontSize:"0.65rem" }}>
                        <span style={{ color:"#8a8070", flex:1 }}>{label}</span>
                        <span style={{ color:"#c8b890", minWidth:70, textAlign:"right" }}>{mKcal ? `${mKcal} kcal` : '—'}</span>
                        <span style={{ color:"#7a9abf", minWidth:60, textAlign:"right" }}>{mProt ? `${mProt}g prot` : ''}</span>
                        <span style={{ color:"#4a4a3a", minWidth:50, textAlign:"right" }}>{data.days}j</span>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {statsRange===30 && monthData.length > 0 && (() => {
            const macros = [
              { key:'kcal',    label:'Calories', color:'#c8b890', goal: goal,        unit:'kcal' },
              { key:'protein', label:'Protéines',color:'#7a9abf', goal: proteinGoal, unit:'g' },
              { key:'carbs',   label:'Glucides', color:'#bf9a7a', goal: carbsGoal,   unit:'g' },
              { key:'fat',     label:'Lipides',  color:'#9abf7a', goal: fatGoal,     unit:'g' },
            ];
            return macros.map(m => {
              const vals = monthData.map(d => d[m.key]||0);
              const max = Math.max(...vals, m.goal * 1.1, 1);
              const w = 320; const h = 60; const pad = 8;
              const pts = vals.map((v,i) => {
                const x = pad + (i/(vals.length-1))*(w-pad*2);
                const y = h - pad - (v/max)*(h-pad*2);
                return `${x},${y}`;
              }).join(' ');
              const goalY = h - pad - (m.goal/max)*(h-pad*2);
              const activeVals = vals.filter(v=>v>0);
              const avg = activeVals.length ? Math.round(activeVals.reduce((a,v)=>a+v,0)/activeVals.length) : 0;
              return (
                <div key={m.key} className="week-chart" style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <div className="chart-title" style={{ marginBottom:0 }}>{m.label} — 30j</div>
                    <div style={{ fontSize:"0.6rem", color:"#5a5a4a" }}>moy {avg}{m.unit}</div>
                  </div>
                  <svg viewBox={`0 0 ${w} ${h}`} style={{ width:"100%", height:60 }}>
                    <line x1={pad} y1={goalY} x2={w-pad} y2={goalY} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,3"/>
                    <polyline points={pts} fill="none" stroke={m.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
                    {vals.map((v,i) => v>0 && (
                      <circle key={i} cx={pad+(i/(vals.length-1))*(w-pad*2)} cy={h-pad-(v/max)*(h-pad*2)} r="2" fill={m.color}/>
                    ))}
                  </svg>
                </div>
              );
            });
          })()}

          <div className="stat-grid">
            <div className="stat-cell"><div className="stat-val">{avgKcal}<span className="stat-unit"> kcal</span></div><div className="stat-label">{t('app.avg_calories')}</div></div>
            <div className="stat-cell"><div className="stat-val">{activeDays.length}<span className="stat-unit"> /{statsRange}</span></div><div className="stat-label">{t('app.days_logged')}</div></div>
            <div className="stat-cell"><div className="stat-val">{bestDay.kcal>0?bestDay.kcal:"—"}<span className="stat-unit">{bestDay.kcal>0?" kcal":""}</span></div><div className="stat-label">{t('app.best_day')}</div></div>
            <div className="stat-cell"><div className="stat-val">{daysOnGoal}<span className="stat-unit"> /{activeDays.length||"—"}</span></div><div className="stat-label">{t('app.on_goal')}</div></div>
            <div className="stat-cell"><div className="stat-val">🔥 {streak}<span className="stat-unit"> j</span></div><div className="stat-label">{t('app.consistency')}</div></div>
            <div className="stat-cell"><div className="stat-val">{activeDays.length>0?Math.round(activeDays.reduce((a,d)=>a+(d.protein||0),0)/activeDays.length):0}<span className="stat-unit">g</span></div><div className="stat-label">{t('app.avg_protein')}</div></div>
          </div>

          {/* Poids */}
          <div className="week-chart">
            <div className="chart-title">{t('app.weight_chart')}</div>
            <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
              <input type="number" step="0.1" min="30" max="300" placeholder="ex: 72.5" value={weightInput}
                onChange={e=>setWeightInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&logWeight()}
                style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 12px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.8rem", outline:"none" }} />
              <span style={{ fontSize:"0.7rem", color:"#5a5a4a", flexShrink:0 }}>kg</span>
              <button className="btn" style={{ fontSize:"0.7rem", padding:"8px 14px" }} onClick={logWeight} disabled={!weightInput||!!user?.isViewAs}>{t('app.weight_log')}</button>
            </div>
            {weightLog.length >= 2 && <WeightChart log={weightLog} />}
            {weightLog.length === 0 && <div style={{ fontSize:"0.65rem", color:"#3a3a2a", textAlign:"center", padding:"12px 0" }}>{t('app.no_data')}</div>}
            {weightLog.length > 0 && (
              <div className="weight-row-list" style={{ marginTop:8 }}>
                {[...weightLog].reverse().slice(0,7).map(e => (
                  <div className="weight-row-item" key={e.id}>
                    <span style={{ color:"#6b6b5a" }}>{e.date}</span>
                    <span style={{ color:"#c8b890", fontFamily:"'Playfair Display',serif" }}>{e.value} kg</span>
                    <button className="del-btn" onClick={()=>deleteWeight(e.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            {[7,30,90].map(d => (
              <button key={d}
                style={{ flex:1, padding:"7px 4px", background: reportDays===d?"#1e1a12":"#0d0d0d", border:`1px solid ${reportDays===d?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color: reportDays===d?"#c8b890":"#5a5a4a", cursor:"pointer", transition:"all 0.2s" }}
                onClick={()=>setReportDays(d)}>{d}j</button>
            ))}
          </div>
          {!user?.isViewAs && (coachLinked ? (
            reportReqSent
              ? <div style={{ width:"100%", marginBottom:16, padding:"10px 0", textAlign:"center", fontSize:"0.7rem", color:"#7abf8a", border:"1px solid #7abf8a", borderRadius:8 }}>{t('app.report_sent')}</div>
              : <button className="btn" style={{ width:"100%", marginBottom:16, fontSize:"0.7rem" }} onClick={requestReport} disabled={reportReqLoading}>
                  {reportReqLoading ? '…' : t('app.report_req_btn')(reportDays)}
                </button>
          ) : (
            <button className="btn" style={{ width:"100%", marginBottom:16, fontSize:"0.7rem" }} onClick={generateReport}>
              {t('app.report_btn')(reportDays)}
            </button>
          ))}

        </>)}

        {/* ─── PROGRAMME ─── */}
        {tab==="programme" && (
          <div>
            {/* Message global si tout est bloqué par le coach */}
            {coachLinked && !selfNutritionAllowed && !selfMuscuAllowed && !coachPrograms[0] && !coachMuscuPrograms[0] ? (
              <div style={{ textAlign:"center", padding:"48px 16px" }}>
                <div style={{ fontSize:"1.8rem", marginBottom:12 }}>🔒</div>
                <div style={{ fontSize:"0.78rem", color:"#c8b890", marginBottom:8 }}>{t('app.coach_manages')}</div>
                <div style={{ fontSize:"0.62rem", color:"#4a4a3a", lineHeight:1.8 }}>Tu recevras tes plans nutrition et musculation directement de sa part.<br/>En attendant, tu peux lui envoyer un message.</div>
              </div>
            ) : (
            <>
            {/* Sous-onglets */}
            <div style={{ display:"flex", gap:6, marginBottom:16 }}>
              {[{id:"nutrition",label:t('app.prog_nutrition')},{id:"muscu",label:t('app.prog_muscu')}].map(st => (
                <button key={st.id} onClick={()=>setProgramTab(st.id)}
                  style={{ flex:1, padding:"9px", background:programTab===st.id?"#1e1a12":"#1a1a1a", border:`1px solid ${programTab===st.id?"#c8b890":"#2a2a2a"}`, borderRadius:10, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:programTab===st.id?"#c8b890":"#5a5a4a", cursor:"pointer", transition:"all 0.2s" }}>
                  {st.label}
                </button>
              ))}
            </div>

            {/* ── Nutrition ── */}
            {programTab==="nutrition" && (() => {
              const coachProgram = coachPrograms[0];
              // Athlète lié à un coach → afficher programme coach
              if (coachLinked && coachProgram) {
                const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
                return (
                  <div>
                    <div style={{ background:"#0d1a0d", border:"1px solid #2a4a2a", borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
                      <div style={{ fontSize:"0.55rem", color:"#3a7a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Plan de ton coach</div>
                      <div style={{ fontSize:"0.65rem", color:"#7abf8a" }}>{coachProgram.mealsPerDay} repas/jour · envoyé le {new Date(coachProgram.sentAt||coachProgram.generatedAt).toLocaleDateString('fr-FR')}</div>
                      {coachProgram.weeklyNotes && <div style={{ fontSize:"0.6rem", color:"#5a8a5a", marginTop:6, lineHeight:1.6, fontStyle:"italic" }}>{coachProgram.weeklyNotes}</div>}
                    </div>
                    <div style={{ display:"flex", gap:4, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
                      {(coachProgram.days||[]).map((day, i) => (
                        <button key={i} onClick={() => setActiveProgramDay(i)}
                          style={{ flexShrink:0, padding:"6px 10px", background:activeProgramDay===i?"#1e2a1e":"#1a1a1a", border:`1px solid ${activeProgramDay===i?"#4a8a4a":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", color:activeProgramDay===i?"#7abf8a":"#5a5a4a", cursor:"pointer" }}>
                          {day.day?.slice(0,3) || DAYS[i]?.slice(0,3)}
                        </button>
                      ))}
                    </div>
                    {((coachProgram.days||[])[activeProgramDay]?.meals || []).map((meal, mi) => (
                      <div key={mi} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <div style={{ fontSize:"0.62rem", color:"#5a8acf", letterSpacing:1 }}>{meal.type}</div>
                          <div style={{ fontSize:"0.55rem", color:"#4a4a3a" }}>{meal.totalKcal} kcal · {meal.totalProtein}g prot</div>
                        </div>
                        {(meal.items||[]).map((item, ii) => (
                          <div key={ii} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom: ii < meal.items.length-1 ? "1px solid #1e1e1e" : "none" }}>
                            <div style={{ fontSize:"0.68rem", color:"#c8b890" }}>{item.name}</div>
                            <div style={{ fontSize:"0.6rem", color:"#4a4a3a" }}>{item.quantity}</div>
                          </div>
                        ))}
                        {meal.note && <div style={{ fontSize:"0.55rem", color:"#4a4a3a", marginTop:6, fontStyle:"italic" }}>{meal.note}</div>}
                      </div>
                    ))}
                  </div>
                );
              }

              // Athlète indépendant → programme perso
              const prog = nutritionProgram;
              const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

              if (!prog && coachLinked && !selfNutritionAllowed) return (
                <div style={{ textAlign:"center", padding:"40px 16px" }}>
                  <div style={{ fontSize:"1.6rem", marginBottom:10 }}>🥗</div>
                  <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>Ton coach s'occupe de ta nutrition</div>
                  <div style={{ fontSize:"0.6rem", color:"#4a4a3a", lineHeight:1.7 }}>Tu recevras ton plan de repas directement de sa part. En attendant, tu peux lui envoyer un message.</div>
                </div>
              );

              if (!prog) return (
                <div>
                  <div style={{ textAlign:"center", padding:"32px 0 24px" }}>
                    <div style={{ fontSize:"1.6rem", marginBottom:10 }}>🥗</div>
                    <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>Aucun programme nutritionnel</div>
                    <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginBottom:24, lineHeight:1.7 }}>Génère un programme personnalisé selon tes objectifs, ton profil et tes bilans sanguins.</div>
                    <button onClick={()=>setNutritionGenOpen(true)} disabled={!!user?.isViewAs} style={{ padding:"11px 28px", background:"#1e1a12", border:"1px solid #c8b890", borderRadius:10, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor: user?.isViewAs?"not-allowed":"pointer", letterSpacing:1, opacity: user?.isViewAs?0.4:1 }}>
                      ✨ Générer mon programme
                    </button>
                  </div>

                  {/* Modal génération */}
                  {nutritionGenOpen && (
                    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>!nutritionGenLoading&&setNutritionGenOpen(false)}>
                      <div style={{ width:"100%", maxWidth:520, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"16px 16px 0 0", padding:"20px 16px 32px" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1rem", color:"#f0e6c8" }}>Générer mon programme</div>
                          {!nutritionGenLoading && <button onClick={()=>setNutritionGenOpen(false)} style={{ background:"none", border:"none", color:"#5a5a4a", fontSize:"1rem", cursor:"pointer" }}>✕</button>}
                        </div>
                        <div style={{ marginBottom:14 }}>
                          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Repas principaux</div>
                          <div style={{ display:"flex", gap:4, marginBottom:12 }}>
                            {[2,3,4,5].map(n => (
                              <button key={n} onClick={()=>setNutritionGenConfig(p=>({...p,mainMeals:n}))}
                                style={{ flex:1, padding:"8px", background:nutritionGenConfig.mainMeals===n?"#1e1a12":"#0d0d0d", border:`1px solid ${nutritionGenConfig.mainMeals===n?"#c8b890":"#2a2a2a"}`, borderRadius:8, color:nutritionGenConfig.mainMeals===n?"#c8b890":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                                {n}
                              </button>
                            ))}
                          </div>
                          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Collations</div>
                          <div style={{ display:"flex", gap:4 }}>
                            {[0,1,2,3].map(n => (
                              <button key={n} onClick={()=>setNutritionGenConfig(p=>({...p,snacks:n}))}
                                style={{ flex:1, padding:"8px", background:nutritionGenConfig.snacks===n?"#1e2a1e":"#0d0d0d", border:`1px solid ${nutritionGenConfig.snacks===n?"#4a8a4a":"#2a2a2a"}`, borderRadius:8, color:nutritionGenConfig.snacks===n?"#7abf8a":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        {[{k:'preferences',l:'Préférences',ph:'Ex: végétarien, sans gluten…'},{k:'avoidFoods',l:'Aliments à éviter',ph:'Ex: lactose, fruits de mer…'}].map(f => (
                          <div key={f.k} style={{ marginBottom:12 }}>
                            <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{f.l}</div>
                            <input value={nutritionGenConfig[f.k]} onChange={e=>setNutritionGenConfig(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                              style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", outline:"none" }}/>
                          </div>
                        ))}
                        {nutritionGenError && <div style={{ background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:"0.62rem", color:"#c87070" }}>⚠ {nutritionGenError}</div>}
                        <button onClick={generateNutritionProgram} disabled={nutritionGenLoading}
                          style={{ width:"100%", padding:"12px", background:nutritionGenLoading?"#1a1a1a":"#1e1a12", border:"1px solid #c8b890", borderRadius:10, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", fontWeight:500, cursor:nutritionGenLoading?"not-allowed":"pointer", letterSpacing:1, marginTop:4, opacity:nutritionGenLoading?0.6:1 }}>
                          {nutritionGenLoading ? "Génération en cours… (30-60s)" : "✨ Générer par IA"}
                        </button>
                        {!nutritionGenLoading && <button onClick={()=>{ const p=buildEmptyNutritionProgram(nutritionGenConfig); setNutritionProgram(p); fetch('/api/nutrition-program',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({program:p})}); setNutritionGenOpen(false); setNutritionEditDay(0); }}
                          style={{ width:"100%", padding:"11px", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", letterSpacing:1, marginTop:8 }}>
                          📝 Remplir moi-même
                        </button>}
                      </div>
                    </div>
                  )}
                </div>
              );

              // Programme existant — affichage + édition inline
              const currentDay = prog.days?.[nutritionEditDay];
              return (
                <div>
                  {/* Actions programme — masquées si coach a déjà envoyé un programme */}
                  {!coachProgram && <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                    <button onClick={()=>setNutritionGenOpen(true)} disabled={!!user?.isViewAs} style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"7px 10px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor: user?.isViewAs?"not-allowed":"pointer", opacity: user?.isViewAs?0.4:1 }}>↻ Regénérer</button>
                    {nutritionConfirmDelProg ? (
                      <>
                        <span style={{ flex:2, fontSize:"0.62rem", color:"#c87070", display:"flex", alignItems:"center", justifyContent:"center" }}>{t('app.delete_q')}</span>
                        <button onClick={async()=>{ await fetch('/api/nutrition-program',{method:'DELETE'}); setNutritionProgram(null); setNutritionConfirmDelProg(false); }} style={{ background:"#2a0d0d", border:"none", borderRadius:8, padding:"7px 14px", color:"#c87070", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>{t('app.yes')}</button>
                        <button onClick={()=>setNutritionConfirmDelProg(false)} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"7px 14px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>{t('app.no')}</button>
                      </>
                    ) : (
                      <button onClick={()=>setNutritionConfirmDelProg(true)} style={{ background:"#1a0d0d", border:"1px solid #3a1a1a", borderRadius:8, padding:"7px 10px", color:"#6a3a3a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>🗑 Supprimer</button>
                    )}
                  </div>}

                  {/* Sélecteur jour */}
                  <div style={{ display:"flex", gap:4, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
                    {(prog.days||[]).map((day, i) => (
                      <button key={i} onClick={()=>setNutritionEditDay(i)} style={{ flexShrink:0, padding:"6px 10px", background:nutritionEditDay===i?"#1e1a12":"#1a1a1a", border:`1px solid ${nutritionEditDay===i?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", color:nutritionEditDay===i?"#c8b890":"#5a5a4a", cursor:"pointer" }}>
                        {day.day?.slice(0,3) || DAYS[i]?.slice(0,3)}
                      </button>
                    ))}
                  </div>

                  {/* Repas du jour */}
                  {(currentDay?.meals || []).map((meal, mi) => {
                    const mealKey = `${nutritionEditDay}-${mi}`;
                    const isCollapsed = collapsedMeals.has(mealKey);
                    return (
                    <div key={mi} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isCollapsed ? 0 : 8, cursor:"pointer" }} onClick={()=>toggleMeal(mealKey)}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:"0.55rem", color:"#3a3a2a" }}>{isCollapsed ? "▶" : "▼"}</span>
                          <div style={{ fontSize:"0.62rem", color:"#5a8acf", letterSpacing:1 }}>{meal.type}</div>
                          {isCollapsed && meal.items?.length > 0 && <span style={{ fontSize:"0.5rem", color:"#3a3a2a" }}>({meal.items.length})</span>}
                        </div>
                        <div style={{ display:"flex", gap:5 }} onClick={e=>e.stopPropagation()}>
                          <button onClick={async()=>{
                            const items = (meal.items||[]).map(it=>({ name:it.name, quantity:it.quantity||'', kcal:it.kcal||0, protein:it.protein||0, carbs:it.carbs||0, fat:it.fat||0 }));
                            const tot = items.reduce((a,i)=>({ kcal:a.kcal+i.kcal, protein:a.protein+i.protein, carbs:a.carbs+i.carbs, fat:a.fat+i.fat }),{ kcal:0,protein:0,carbs:0,fat:0 });
                            const res = await fetch('/api/entries',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ date:key, items:[{ type:'recipe', name:`${meal.type} – ${currentDay.day}`, items, meal:currentMeal, ...tot }] }) });
                            const data = await res.json();
                            setEntries(prev=>[...prev,...(data.items||[])]);
                            setTab('journal');
                          }} style={{ background:"#0d1a0d", border:"1px solid #2a4a2a", borderRadius:6, padding:"3px 8px", color:"#5a8a5a", fontFamily:"'DM Mono',monospace", fontSize:"0.55rem", cursor:"pointer" }}>
                            → Journal
                          </button>
                          <button onClick={()=>{ setNutritionAddRecipe({ meal, dayLabel: currentDay.day }); setNutritionAddRecipeCat('plat'); }}
                            style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:6, padding:"3px 8px", color:"#3a3a2a", fontFamily:"'DM Mono',monospace", fontSize:"0.55rem", cursor:"pointer" }}>
                            + Recette
                          </button>
                        </div>
                      </div>
                      {!isCollapsed && (meal.items||[]).map((item, ii) => {
                        const isEditing = nutritionEditItem?.dayIdx===nutritionEditDay && nutritionEditItem?.mealIdx===mi && nutritionEditItem?.itemIdx===ii;
                        const isConfirming = nutritionConfirmDel?.dayIdx===nutritionEditDay && nutritionConfirmDel?.mealIdx===mi && nutritionConfirmDel?.itemIdx===ii;
                        return (
                          <div key={ii} style={{ borderBottom: ii < meal.items.length-1 ? "1px solid #1e1e1e" : "none", padding:"4px 0" }}>
                            {isConfirming ? (
                              <div style={{ display:"flex", gap:6, alignItems:"center", padding:"2px 0" }}>
                                <span style={{ flex:1, fontSize:"0.62rem", color:"#c87070" }}>{t('app.delete_q')}</span>
                                <button onClick={()=>{
                                  const updated = JSON.parse(JSON.stringify(prog));
                                  updated.days[nutritionEditDay].meals[mi].items.splice(ii,1);
                                  saveNutritionEdit(updated);
                                  setNutritionConfirmDel(null); setNutritionEditItem(null);
                                }} style={{ background:"#2a0d0d", border:"none", borderRadius:6, padding:"4px 10px", color:"#c87070", cursor:"pointer", fontSize:"0.65rem" }}>{t('app.yes')}</button>
                                <button onClick={()=>setNutritionConfirmDel(null)} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:6, padding:"4px 10px", color:"#5a5a4a", cursor:"pointer", fontSize:"0.65rem" }}>{t('app.no')}</button>
                              </div>
                            ) : isEditing ? (
                              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                                <input defaultValue={item.name} id={`en-${mi}-${ii}`}
                                  style={{ width:"100%", background:"#0d0d0d", border:"1px solid #3a3a2a", borderRadius:6, padding:"5px 8px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", outline:"none" }}/>
                                <div style={{ display:"flex", gap:5 }}>
                                  <input defaultValue={item.quantity} id={`eq-${mi}-${ii}`}
                                    style={{ flex:1, background:"#0d0d0d", border:"1px solid #3a3a2a", borderRadius:6, padding:"5px 8px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", outline:"none" }}/>
                                  <button onClick={async()=>{
                                    const name = document.getElementById(`en-${mi}-${ii}`).value;
                                    const quantity = document.getElementById(`eq-${mi}-${ii}`).value;
                                    const updated = JSON.parse(JSON.stringify(prog));
                                    updated.days[nutritionEditDay].meals[mi].items[ii] = { ...item, name, quantity, kcal:0, protein:0, carbs:0, fat:0 };
                                    setNutritionEditItem(null);
                                    const macros = await analyzeNutritionItem(name, quantity);
                                    if (macros) updated.days[nutritionEditDay].meals[mi].items[ii] = { ...updated.days[nutritionEditDay].meals[mi].items[ii], ...macros };
                                    saveNutritionEdit(updated);
                                    // Recharger la librairie
                                    fetch('/api/ingredients').then(r=>r.json()).then(d=>setIngredients(d.ingredients||[]));
                                  }} style={{ background:"#2a4a2a", border:"none", borderRadius:6, padding:"5px 12px", color:"#7abf8a", cursor:"pointer", fontSize:"0.7rem" }}>✓</button>
                                  <button onClick={()=>{ setNutritionConfirmDel({dayIdx:nutritionEditDay,mealIdx:mi,itemIdx:ii}); setNutritionEditItem(null); }}
                                    style={{ background:"#2a0d0d", border:"none", borderRadius:6, padding:"5px 10px", color:"#c87070", cursor:"pointer", fontSize:"0.7rem" }}>🗑</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ cursor:"pointer" }} onClick={()=>setNutritionEditItem({dayIdx:nutritionEditDay,mealIdx:mi,itemIdx:ii})}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                  <div style={{ fontSize:"0.68rem", color:"#c8b890" }}>{item.name}</div>
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ fontSize:"0.6rem", color:"#4a4a3a" }}>{item.quantity}</span>
                                    {item.kcal > 0 && <span style={{ fontSize:"0.6rem", color:"#5a5a4a" }}>{item.kcal} kcal</span>}
                                    <span style={{ fontSize:"0.55rem", color:"#2a2a2a" }}>✎</span>
                                  </div>
                                </div>
                                {item.kcal > 0 && <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:2 }}>P {item.protein}g · G {item.carbs}g · L {item.fat}g</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!isCollapsed && meal.note && <div style={{ fontSize:"0.55rem", color:"#4a4a3a", marginTop:6, fontStyle:"italic" }}>{meal.note}</div>}
                      {!isCollapsed && <button onClick={()=>{
                        const updated = JSON.parse(JSON.stringify(prog));
                        updated.days[nutritionEditDay].meals[mi].items.push({ name:'', quantity:'', kcal:0, protein:0, carbs:0, fat:0 });
                        const newIdx = updated.days[nutritionEditDay].meals[mi].items.length - 1;
                        saveNutritionEdit(updated);
                        setNutritionEditItem({ dayIdx:nutritionEditDay, mealIdx:mi, itemIdx:newIdx });
                      }} style={{ width:"100%", marginTop:8, padding:"5px", background:"transparent", border:"1px dashed #2a2a2a", borderRadius:7, color:"#3a3a2a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>+ aliment</button>}
                    </div>
                    );
                  })}

                  {/* Total du jour */}
                  {currentDay && (
                    <div style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"10px 14px", marginTop:4, marginBottom:8, display:"flex", justifyContent:"space-around" }}>
                      {[
                        { l:"Kcal", v: (currentDay.meals||[]).reduce((a,m)=>a+(m.totalKcal||0),0) },
                        { l:"Prot", v: (currentDay.meals||[]).reduce((a,m)=>a+(m.totalProtein||0),0)+'g' },
                        { l:"Gluc", v: (currentDay.meals||[]).reduce((a,m)=>a+(m.totalCarbs||0),0)+'g' },
                        { l:"Lip",  v: (currentDay.meals||[]).reduce((a,m)=>a+(m.totalFat||0),0)+'g' },
                      ].map(({l,v}) => (
                        <div key={l} style={{ textAlign:"center" }}>
                          <div style={{ fontSize:"0.75rem", color:"#c8b890" }}>{v}</div>
                          <div style={{ fontSize:"0.5rem", color:"#3a3a2a", letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modal + Recette */}
                  {nutritionAddRecipe && (
                    <div className="modal-overlay" onClick={()=>setNutritionAddRecipe(null)}>
                      <div className="modal" onClick={e=>e.stopPropagation()}>
                        <h2>{t('app.save')} recette</h2>
                        <input type="text" placeholder="Nom de la recette..."
                          value={nutritionAddRecipe.name ?? `${nutritionAddRecipe.meal.type} – ${nutritionAddRecipe.dayLabel}`}
                          onChange={e=>setNutritionAddRecipe(r=>({...r, name:e.target.value}))}
                          onKeyDown={e=>{ if(e.key==='Enter') e.currentTarget.blur(); }}
                          autoFocus />
                        <select className="cat-select" value={nutritionAddRecipeCat} onChange={e=>setNutritionAddRecipeCat(e.target.value)}>
                          {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <div className="modal-actions">
                          <button className="btn" onClick={async()=>{
                            const { meal, dayLabel, name } = nutritionAddRecipe;
                            const recipeName = (name ?? `${meal.type} – ${dayLabel}`).trim();
                            if (!recipeName) return;
                            const items = (meal.items||[]).map(it=>({ name:it.name, quantity:it.quantity||'', kcal:it.kcal||0, protein:it.protein||0, carbs:it.carbs||0, fat:it.fat||0 }));
                            const res = await fetch('/api/recipes',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:recipeName, category:nutritionAddRecipeCat, items }) });
                            const data = await res.json();
                            if (data.recipe) setRecipes(r=>[...r, data.recipe]);
                            setNutritionAddRecipe(null);
                          }}>{t('app.save')}</button>
                          <button className="btn secondary" onClick={()=>setNutritionAddRecipe(null)}>{t('app.cancel')}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal regénérer */}
                  {nutritionGenOpen && (
                    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>!nutritionGenLoading&&setNutritionGenOpen(false)}>
                      <div style={{ width:"100%", maxWidth:520, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"16px 16px 0 0", padding:"20px 16px 32px" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1rem", color:"#f0e6c8" }}>Regénérer le programme</div>
                          {!nutritionGenLoading && <button onClick={()=>setNutritionGenOpen(false)} style={{ background:"none", border:"none", color:"#5a5a4a", fontSize:"1rem", cursor:"pointer" }}>✕</button>}
                        </div>
                        <div style={{ marginBottom:14 }}>
                          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Repas principaux</div>
                          <div style={{ display:"flex", gap:4, marginBottom:12 }}>
                            {[2,3,4,5].map(n => (
                              <button key={n} onClick={()=>setNutritionGenConfig(p=>({...p,mainMeals:n}))}
                                style={{ flex:1, padding:"8px", background:nutritionGenConfig.mainMeals===n?"#1e1a12":"#0d0d0d", border:`1px solid ${nutritionGenConfig.mainMeals===n?"#c8b890":"#2a2a2a"}`, borderRadius:8, color:nutritionGenConfig.mainMeals===n?"#c8b890":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                                {n}
                              </button>
                            ))}
                          </div>
                          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Collations</div>
                          <div style={{ display:"flex", gap:4 }}>
                            {[0,1,2,3].map(n => (
                              <button key={n} onClick={()=>setNutritionGenConfig(p=>({...p,snacks:n}))}
                                style={{ flex:1, padding:"8px", background:nutritionGenConfig.snacks===n?"#1e2a1e":"#0d0d0d", border:`1px solid ${nutritionGenConfig.snacks===n?"#4a8a4a":"#2a2a2a"}`, borderRadius:8, color:nutritionGenConfig.snacks===n?"#7abf8a":"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        {[{k:'preferences',l:'Préférences',ph:'Ex: végétarien…'},{k:'avoidFoods',l:'Aliments à éviter',ph:'Ex: lactose…'}].map(f => (
                          <div key={f.k} style={{ marginBottom:12 }}>
                            <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{f.l}</div>
                            <input value={nutritionGenConfig[f.k]} onChange={e=>setNutritionGenConfig(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                              style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", outline:"none" }}/>
                          </div>
                        ))}
                        {nutritionGenError && <div style={{ background:"#1a0d0d", border:"1px solid #4a2a2a", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:"0.62rem", color:"#c87070" }}>⚠ {nutritionGenError}</div>}
                        <button onClick={generateNutritionProgram} disabled={nutritionGenLoading}
                          style={{ width:"100%", padding:"12px", background:nutritionGenLoading?"#1a1a1a":"#1e1a12", border:"1px solid #c8b890", borderRadius:10, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", fontWeight:500, cursor:nutritionGenLoading?"not-allowed":"pointer", letterSpacing:1, marginTop:4, opacity:nutritionGenLoading?0.6:1 }}>
                          {nutritionGenLoading ? "Génération en cours… (30-60s)" : "✨ Générer par IA"}
                        </button>
                        {!nutritionGenLoading && <button onClick={()=>{ const p=buildEmptyNutritionProgram(nutritionGenConfig); setNutritionProgram(p); fetch('/api/nutrition-program',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({program:p})}); setNutritionGenOpen(false); setNutritionEditDay(0); }}
                          style={{ width:"100%", padding:"11px", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", letterSpacing:1, marginTop:8 }}>
                          📝 Remplir moi-même
                        </button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Muscu ── */}
            {programTab==="muscu" && <MuscuTab coachLinked={coachLinked} coachMuscuPrograms={coachMuscuPrograms} selfMuscuAllowed={selfMuscuAllowed} />}
            </>
            )}
          </div>
        )}
        </div>{/* fin wrapper readonly viewAs */}

        {/* ── Modal révision bilan (nutritionniste) ── */}
        {reviewResult && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ maxWidth:560, margin:"0 auto", padding:"16px 16px 40px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", color:"#f0e6c8" }}>🔬 Révision du bilan</div>
                <button onClick={()=>setReviewResult(null)} style={{ background:"transparent", border:"none", color:"#5a5a4a", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
              </div>
              <div style={{ fontSize:"0.6rem", color:"#7abf8a", marginBottom:16, background:"#0d1a0d", border:"1px solid #3a7a3a", borderRadius:8, padding:"8px 12px" }}>
                ✓ Analyse IA terminée — vérifiez et modifiez avant d'envoyer au patient
              </div>

              {/* Résumé */}
              <div className="profil-card">
                <div className="profil-card-title">Résumé</div>
                <textarea value={reviewResult.summary||''} onChange={e=>setReviewResult(r=>({...r,summary:e.target.value}))}
                  style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", outline:"none", resize:"none", minHeight:80 }}/>
              </div>

              {/* Marqueurs */}
              <div className="profil-card">
                <div className="profil-card-title">Marqueurs</div>
                {(reviewResult.markers||[]).map((m,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, fontSize:"0.65rem" }}>
                    <span style={{ flex:2, color:"#c8b890" }}>{m.name}</span>
                    <span style={{ flex:1, color:"#8a8a7a" }}>{m.value} {m.unit}</span>
                    <select value={m.status} onChange={e=>setReviewResult(r=>({...r,markers:r.markers.map((mk,j)=>j===i?{...mk,status:e.target.value}:mk)}))}
                      style={{ background:"#1a1a1a", border:`1px solid ${m.status==='ok'?'#3a7a3a':m.status==='warn'?'#7a6a20':'#7a3a3a'}`, borderRadius:6, padding:"3px 6px", color:m.status==='ok'?'#7abf8a':m.status==='warn'?'#c8a870':'#c87070', fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", outline:"none" }}>
                      <option value="ok">ok</option>
                      <option value="warn">warn</option>
                      <option value="bad">bad</option>
                    </select>
                    <button onClick={()=>setReviewResult(r=>({...r,markers:r.markers.filter((_,j)=>j!==i)}))}
                      style={{ background:"transparent", border:"none", color:"#5a3a3a", cursor:"pointer", fontSize:"0.8rem" }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Focus semaine */}
              <div className="profil-card">
                <div className="profil-card-title">Focus semaine</div>
                <textarea value={reviewResult.weeklyFocus||''} onChange={e=>setReviewResult(r=>({...r,weeklyFocus:e.target.value}))}
                  style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", outline:"none", resize:"none", minHeight:50 }}/>
              </div>

              {/* Prochain bilan */}
              <div className="profil-card">
                <div className="profil-card-title">Prochain bilan</div>
                <input value={reviewResult.nextCheckup||''} onChange={e=>setReviewResult(r=>({...r,nextCheckup:e.target.value}))}
                  style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", outline:"none" }}/>
              </div>

              {bloodError && <div className="error-msg">{bloodError}</div>}
              <button className="btn" style={{ width:"100%", fontSize:"0.75rem", padding:"12px" }} onClick={handleConfirmAnalysis} disabled={confirmLoading}>
                {confirmLoading ? "Envoi en cours…" : "✓ Confirmer et envoyer au patient"}
              </button>
              <button onClick={()=>setReviewResult(null)} style={{ width:"100%", marginTop:8, background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px", color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>
                {t('app.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* ── Modal comparaison bilans ── */}
        {compareOpen && bloodTests.length >= 2 && (() => {
          const a = bloodTests[compareA];
          const b = bloodTests[compareB];
          const allNames = [...new Set([...(a.markers||[]).map(m=>m.name), ...(b.markers||[]).map(m=>m.name)])];
          const mapA = Object.fromEntries((a.markers||[]).map(m=>[m.name,m]));
          const mapB = Object.fromEntries((b.markers||[]).map(m=>[m.name,m]));
          const dateA = a.date || new Date(a.uploadedAt).toLocaleDateString('fr-FR');
          const dateB = b.date || new Date(b.uploadedAt).toLocaleDateString('fr-FR');
          return (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, overflowY:"auto" }} onClick={()=>setCompareOpen(false)}>
              <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 40px" }} onClick={e=>e.stopPropagation()}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", color:"#f0e6c8" }}>↔ Comparaison de bilans</div>
                  <button onClick={()=>setCompareOpen(false)} style={{ background:"transparent", border:"none", color:"#5a5a4a", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
                </div>

                {/* Sélecteurs */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                  {[[compareA, setCompareA, "Bilan A"],[compareB, setCompareB, "Bilan B"]].map(([val, set, label],si)=>(
                    <div key={si}>
                      <div style={{ fontSize:"0.55rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>{label}</div>
                      <select value={val} onChange={e=>set(Number(e.target.value))}
                        style={{ width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 10px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", outline:"none" }}>
                        {bloodTests.map((t,i)=>(
                          <option key={i} value={i}>{t.reportType||'Bilan'} — {t.date||new Date(t.uploadedAt).toLocaleDateString('fr-FR')}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* En-têtes dates */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:8 }}>
                  <div style={{ fontSize:"0.6rem", color:"#4a4a3a", letterSpacing:1 }}>Marqueur</div>
                  <div style={{ fontSize:"0.6rem", color:"#8a8acf", textAlign:"center" }}>{dateA}</div>
                  <div style={{ fontSize:"0.6rem", color:"#c8b890", textAlign:"center" }}>{dateB}</div>
                </div>

                {/* Tableau marqueurs */}
                {allNames.map((name,i)=>{
                  const ma = mapA[name];
                  const mb = mapB[name];
                  const improved = ma && mb && ma.status !== 'ok' && mb.status === 'ok';
                  const degraded = ma && mb && ma.status === 'ok' && mb.status !== 'ok';
                  const statusColor = s => s==='ok'?'#7abf8a':s==='warn'?'#c8a870':'#c87070';
                  return (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, padding:"8px 0", borderBottom:"1px solid #1a1a1a", alignItems:"center" }}>
                      <div style={{ fontSize:"0.65rem", color:"#8a8a7a" }}>{name}{improved&&<span style={{ marginLeft:6, fontSize:"0.55rem", color:"#7abf8a" }}>↑</span>}{degraded&&<span style={{ marginLeft:6, fontSize:"0.55rem", color:"#c87070" }}>↓</span>}</div>
                      <div style={{ textAlign:"center", fontSize:"0.65rem", color: ma ? statusColor(ma.status) : "#3a3a2a" }}>
                        {ma ? `${ma.value} ${ma.unit||''}` : '—'}
                      </div>
                      <div style={{ textAlign:"center", fontSize:"0.65rem", color: mb ? statusColor(mb.status) : "#3a3a2a" }}>
                        {mb ? `${mb.value} ${mb.unit||''}` : '—'}
                        {ma && mb && typeof ma.value==='number' && typeof mb.value==='number' && Math.abs(mb.value-ma.value)>0.001 && (
                          <span style={{ marginLeft:4, fontSize:"0.55rem", color: mb.value>ma.value?"#c87070":"#7abf8a" }}>
                            {mb.value>ma.value?'▲':'▼'}{Math.abs(Math.round((mb.value-ma.value)*100)/100)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Légende */}
                <div style={{ display:"flex", gap:16, marginTop:16, fontSize:"0.55rem", color:"#3a3a2a" }}>
                  <span><span style={{ color:"#7abf8a" }}>■</span> Ok</span>
                  <span><span style={{ color:"#c8a870" }}>■</span> Attention</span>
                  <span><span style={{ color:"#c87070" }}>■</span> Hors norme</span>
                  <span><span style={{ color:"#7abf8a" }}>↑</span> Amélioré</span>
                  <span><span style={{ color:"#c87070" }}>↓</span> Dégradé</span>
                </div>
              </div>
            </div>
          );
        })()}

        {profilOpen && (() => {
          const w = Number(weight), h = Number(height);
          const age = birthdate ? Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 3600 * 1000)) : 0;
          const bmr = (w > 0 && h > 0 && age > 0)
            ? Math.round(10*w + 6.25*h - 5*age + (sex==="homme" ? 5 : -161))
            : null;
          return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:180, overflowY:"auto" }} onClick={()=>setProfilOpen(false)}>
            <div style={{ maxWidth:520, margin:"0 auto", padding:"16px 16px 40px" }} onClick={e=>e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8" }}>Profil</div>
                <button onClick={()=>setProfilOpen(false)} style={{ background:"transparent", border:"none", color:"#5a5a4a", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
              </div>
            <>

            {/* ── 1. Compte ── */}
            {user && !user.isViewAs && (
              <div className="profil-card">
                <div className="profil-card-title">Compte</div>
                <div className="profil-row" style={{ alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:"0.78rem", color:"#e8e0d0", fontWeight:500 }}>{user.name}</div>
                    <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginTop:3 }}>{user.email}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      {user.inTrial
                        ? <span style={{ fontSize:"0.52rem", background:"#1a1a00", border:"1px solid #c8a870", borderRadius:20, padding:"2px 8px", color:"#c8a870", letterSpacing:1 }}>✦ ESSAI — {user.trialDaysLeft}j restant{user.trialDaysLeft > 1 ? 's' : ''}</span>
                        : user.activePlan === 'free'
                          ? <span style={{ fontSize:"0.52rem", background:"#1a1a1a", border:"1px solid #3a3a2a", borderRadius:20, padding:"2px 8px", color:"#5a5a4a", letterSpacing:1 }}>FREE</span>
                          : <span style={{ fontSize:"0.52rem", background:"#1a1200", border:"1px solid #c8a870", borderRadius:20, padding:"2px 8px", color:"#c8a870", letterSpacing:1 }}>✦ {(user.activePlan||'PRO').toUpperCase().replace('_',' ')}</span>
                      }
                    </div>
                  </div>
                  <button className="btn danger" style={{ fontSize:"0.6rem", padding:"6px 12px" }}
                    onClick={()=>fetch('/api/auth/logout',{method:'POST'}).then(()=>window.location.href='/login')}>
                    Déconnexion
                  </button>
                </div>
                {user.activePlan === 'free' && !user.inTrial && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1e1e1e" }}>
                    <a href="https://buy.stripe.com/eVqeV6f9M8251t73FY2Nq00" target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"block" }}>
                      <button style={{ width:"100%", padding:"10px", background:"#1e1a12", border:"1px solid #c8b890", borderRadius:8, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer", letterSpacing:1 }}>
                        ✦ Passer à Pro — 8,99€/mois
                      </button>
                    </a>
                  </div>
                )}
                {user.hasSubscription && (
                  <div style={{ marginTop:10 }}>
                    <a href="/api/stripe/portal" style={{ textDecoration:"none", display:"block" }}>
                      <button style={{ width:"100%", padding:"9px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", letterSpacing:1 }}>
                        Gérer mon abonnement →
                      </button>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ── 2. Profil physique + BMR ── */}
            {!user?.isViewAs && <div className="profil-card">
              <div className="profil-card-title">Profil physique</div>
              <div className="profil-row">
                <span className="profil-label">Sexe</span>
                <div className="sex-toggle">
                  <button className={`sex-btn${sex==="homme"?" active":""}`} onClick={()=>setSex("homme")}>Homme</button>
                  <button className={`sex-btn${sex==="femme"?" active":""}`} onClick={()=>setSex("femme")}>Femme</button>
                </div>
              </div>
              <div className="profil-row">
                <span className="profil-label">Naissance</span>
                <input className="profil-input" type="date" value={birthdate} onChange={e=>setBirthdate(e.target.value)} style={{ width:130 }} />
                {age > 0 && <span className="profil-unit" style={{ width:"auto" }}>{age} ans</span>}
              </div>
              <div className="profil-row">
                <span className="profil-label">Taille</span>
                <input className="profil-input" type="number" min="100" max="250" placeholder="—" value={height} onChange={e=>setHeight(e.target.value)} />
                <span className="profil-unit">cm</span>
              </div>
              <div className="profil-row" style={{ marginBottom:0 }}>
                <span className="profil-label">Poids</span>
                <input className="profil-input" type="number" min="30" max="300" step="0.1" placeholder="—" value={weight} onChange={e=>setWeight(e.target.value)} />
                <span className="profil-unit">kg</span>
              </div>
              {bmr && (
                <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid #1e1e1e", display:"flex", alignItems:"baseline", gap:8 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.6rem", color:"#c8b890" }}>{bmr}</div>
                  <div>
                    <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase" }}>kcal/j · métabolisme de base</div>
                    <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:2 }}>Calories minimales au repos, sans activité physique</div>
                  </div>
                </div>
              )}
            </div>}

            {/* ── 3. Objectif calorique ── */}
            {!user?.isViewAs && (
              <div className="profil-card">
                <div className="profil-card-title">Objectif calorique</div>
                {bmr ? (
                  <>
                    <div className="mode-btns" style={{ marginBottom:12 }}>
                      {[{id:"perte",e:"📉",l:"Perte\nde poids"},{id:"maintien",e:"⚖️",l:"Maintien"},{id:"masse",e:"📈",l:"Prise\nde masse"}].map(m=>(
                        <button key={m.id} className={`mode-btn${mode===m.id?" active":""}`} onClick={()=>setMode(m.id)} style={{ whiteSpace:"pre-line" }}>{m.e}{"\n"}{m.l}</button>
                      ))}
                    </div>
                    {(() => {
                      const maintien = Math.round(bmr * 1.2);
                      const modeKcal = mode==="perte" ? maintien-400 : mode==="masse" ? maintien+300 : maintien;
                      const modeDesc = mode==="perte" ? `${maintien} − 400 · déficit modéré` : mode==="masse" ? `${maintien} + 300 · surplus propre` : `BMR × 1.2 · activité légère`;
                      const ratios = mode==="perte" ? {p:0.35,g:0.35,l:0.30} : mode==="masse" ? {p:0.25,g:0.50,l:0.25} : {p:0.25,g:0.45,l:0.30};
                      const recP = Math.round(modeKcal*ratios.p/4);
                      const recG = Math.round(modeKcal*ratios.g/4);
                      const recL = Math.round(modeKcal*ratios.l/9);
                      return (
                        <div style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
                          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.8rem", color:"#c8b890" }}>{modeKcal}</div>
                            <div style={{ fontSize:"0.7rem", color:"#5a5a4a" }}>kcal/jour</div>
                          </div>
                          <div style={{ fontSize:"0.58rem", color:"#4a4a3a", marginBottom:12 }}>{modeDesc}</div>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:12 }}>
                            {[{l:"Protéines",v:recP,c:"#7a9abf"},{l:"Glucides",v:recG,c:"#c8b890"},{l:"Lipides",v:recL,c:"#bf9a7a"}].map(m=>(
                              <div key={m.l} style={{ background:"#1a1a1a", borderRadius:8, padding:"8px 6px", textAlign:"center" }}>
                                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:m.c }}>{m.v}<span style={{ fontSize:"0.6rem", color:"#5a5a4a" }}>g</span></div>
                                <div style={{ fontSize:"0.52rem", color:"#3a3a2a", letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>{m.l}</div>
                              </div>
                            ))}
                          </div>
                          <button className="btn" style={{ fontSize:"0.65rem", width:"100%" }}
                            onClick={()=>{ setGoal(modeKcal); setProteinGoal(recP); setCarbsGoal(recG); setFatGoal(recL); }}>
                            Appliquer ces valeurs
                          </button>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div style={{ fontSize:"0.62rem", color:"#3a3a2a", marginBottom:14, fontStyle:"italic" }}>Remplis ton profil physique pour obtenir une recommandation personnalisée.</div>
                )}
                <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:12 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Objectifs manuels</div>
                  <div className="profil-row">
                    <span className="profil-label">Calories</span>
                    <input className="profil-input" type="number" min="500" max="5000" step="50" value={goal} onChange={e=>setGoal(Number(e.target.value))} />
                    <span className="profil-unit">kcal</span>
                  </div>
                  <div className="profil-row">
                    <span className="profil-label">Protéines</span>
                    <input className="profil-input" type="number" min="0" max="999" step="5" value={proteinGoal} onChange={e=>setProteinGoal(Number(e.target.value))} />
                    <span className="profil-unit">g</span>
                  </div>
                  <div className="profil-row">
                    <span className="profil-label">Glucides</span>
                    <input className="profil-input" type="number" min="0" max="999" step="5" value={carbsGoal} onChange={e=>setCarbsGoal(Number(e.target.value))} />
                    <span className="profil-unit">g</span>
                  </div>
                  <div className="profil-row" style={{ marginBottom:0 }}>
                    <span className="profil-label">Lipides</span>
                    <input className="profil-input" type="number" min="0" max="999" step="5" value={fatGoal} onChange={e=>setFatGoal(Number(e.target.value))} />
                    <span className="profil-unit">g</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 4. Notifications ── */}
            {!user?.isViewAs && (
              <div className="profil-card">
                <div className="profil-card-title">Notifications</div>
                {reminders.length === 0 ? (
                  <div style={{ fontSize:"0.62rem", color:"#4a4a3a", marginBottom:12 }}>Reçois une notification si tu oublies de logger tes repas.</div>
                ) : (
                  <div style={{ marginBottom:10 }}>
                    {reminders.map((r, i) => (
                      <div key={r.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom: i < reminders.length-1 ? "1px solid #1e1e1e" : "none" }}>
                        <span style={{ fontSize:"0.65rem", color:"#6b6b5a", minWidth:24 }}>{i+1}.</span>
                        <input type="time" value={r.time} onChange={e => updateReminderTime(r.id, e.target.value)}
                          style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 10px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.78rem", outline:"none" }} />
                        <button onClick={() => removeReminder(r.id)}
                          style={{ background:"none", border:"none", color:"#3a3a2a", fontSize:"0.85rem", cursor:"pointer", padding:"4px 6px", transition:"color 0.2s" }}
                          onMouseOver={e=>e.currentTarget.style.color="#c87070"} onMouseOut={e=>e.currentTarget.style.color="#3a3a2a"}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {reminders.length < 5 && (
                  <button onClick={() => addReminder('08:00')}
                    style={{ width:"100%", padding:"8px", background:"#141414", border:"1px dashed #2a2a2a", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color:"#4a4a3a", cursor:"pointer", letterSpacing:1, transition:"all 0.2s" }}
                    onMouseOver={e=>{e.currentTarget.style.borderColor="#c8b890";e.currentTarget.style.color="#c8b890";}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor="#2a2a2a";e.currentTarget.style.color="#4a4a3a";}}>
                    + Ajouter un rappel
                  </button>
                )}
                {reminders.length > 0 && <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:8, letterSpacing:1 }}>Notifications actives chaque jour à ces horaires</div>}
              </div>
            )}

            {/* ── 5. Historique santé ── */}
            <div className="profil-card">
              <div className="profil-card-title">Historique de santé</div>
              <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginBottom:10, lineHeight:1.6 }}>Antécédents, pathologies, allergies, traitements en cours… L'IA en tient compte pour toutes ses recommandations.</div>
              <textarea value={healthHistory} onChange={e=>setHealthHistory(e.target.value)}
                placeholder="Ex: calculs rénaux (2023), intolérance au lactose, hypertension légère, traitement vitamine D…"
                style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"10px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.68rem", outline:"none", resize:"none", minHeight:80, lineHeight:1.6 }}/>
              {healthHistory && <div style={{ fontSize:"0.55rem", color:"#4a4a3a", marginTop:6, textAlign:"right" }}>Sauvegardé automatiquement ✓</div>}
            </div>

            {/* ── 6. Connexions ── */}
            {!user?.isViewAs &&
            <div className="profil-card">
              <div className="profil-card-title">Connexions</div>
              <div className="profil-row" style={{ alignItems:"center" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:"0.72rem", color:"#e8e0d0" }}>🟠 Strava</span>
                    <details style={{ display:"inline" }}>
                      <summary style={{ fontSize:"0.58rem", color:"#4a4a3a", cursor:"pointer", listStyle:"none", border:"1px solid #2a2a2a", borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>?</summary>
                      <div style={{ position:"absolute", zIndex:10, background:"#1e1e1e", border:"1px solid #3a3a2a", borderRadius:10, padding:"10px 12px", marginTop:4, maxWidth:240, fontSize:"0.62rem", color:"#a0a090", lineHeight:1.6 }}>
                        Strava est une appli de suivi sportif (course, vélo, natation…). En connectant ton compte, tes séances apparaissent automatiquement dans ton journal pour ajuster tes calories brûlées.<br/><br/>Le compte gratuit Strava suffit.
                      </div>
                    </details>
                  </div>
                  {stravaConnected && stravaAthlete
                    ? <div style={{ fontSize:"0.6rem", color:"#fc4c02", marginTop:2 }}>{stravaAthlete.name} · connecté</div>
                    : <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginTop:2 }}>Synchronise tes séances automatiquement</div>}
                </div>
                {stravaConnected
                  ? <button className="btn danger" style={{ fontSize:"0.6rem", padding:"6px 10px" }}
                      onClick={()=>fetch('/api/strava/activities',{method:'DELETE'}).then(()=>{ setStravaConnected(false); setStravaAthlete(null); setStravaActivities([]); })}>
                      Déconnecter
                    </button>
                  : (user?.activePlan === 'free' && !user?.inTrial)
                    ? <button className="strava-connect-btn" onClick={()=>setUpgradeModal({ feature:'strava' })}>Connecter</button>
                    : <a href="/api/strava/auth"><button className="strava-connect-btn">Connecter</button></a>
                }
              </div>

              {/* Google Fit — désactivé temporairement */}
              {gfitConnected && (
                <div className="profil-row" style={{ alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px solid #2a2a2a" }}>
                  <div>
                    <div style={{ fontSize:"0.72rem", color:"#e8e0d0" }}>🟢 Google Fit</div>
                    <div style={{ fontSize:"0.6rem", color:"#4caf50", marginTop:2 }}>Connecté</div>
                  </div>
                  <button className="btn danger" style={{ fontSize:"0.6rem", padding:"6px 10px" }}
                    onClick={()=>fetch('/api/googlefit/activities',{method:'DELETE'}).then(()=>{ setGfitConnected(false); setGfitData(null); })}>
                    Déconnecter
                  </button>
                </div>
              )}

              {user?.role !== 'coach' && (
                <div className="profil-row" style={{ alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px solid #2a2a2a" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.72rem", color:"#e8e0d0" }}>🎯 Coach</div>
                    {coachLinked
                      ? <div style={{ fontSize:"0.6rem", color:"#7abf8a", marginTop:2 }}>{coachLinkMsg || 'Lié à un coach ✓'}</div>
                      : <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginTop:2 }}>Entre le code de ton coach</div>}
                  </div>
                  {coachLinked
                    ? <button className="btn danger" style={{ fontSize:"0.6rem", padding:"6px 10px" }} onClick={unlinkCoach}>Se délier</button>
                    : <div style={{ display:"flex", gap:6 }}>
                        <input value={coachCode} onChange={e=>setCoachCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={8}
                          style={{ width:80, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:7, padding:"6px 8px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", letterSpacing:2, outline:"none", textAlign:"center" }}/>
                        <button onClick={linkCoach} style={{ background:"#1e1a12", border:"1px solid #c8b890", borderRadius:7, padding:"6px 10px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer" }}>Lier</button>
                      </div>
                  }
                </div>
              )}
              {coachLinkMsg && !coachLinked && <div style={{ fontSize:"0.6rem", color:"#c87070", marginTop:6 }}>{coachLinkMsg}</div>}
              {user?.role === 'coach' && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #2a2a2a" }}>
                  <a href="/coach">
                    <button style={{ width:"100%", padding:"10px", background:"#1e1a12", border:"1px solid #c8b890", borderRadius:8, color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer", letterSpacing:1 }}>
                      🎯 Espace Coach →
                    </button>
                  </a>
                </div>
              )}
            </div>}

            {/* ── 7. Données & app ── */}
            {!user?.isViewAs && (
              <div className="profil-card">
                <div className="profil-card-title">Données & app</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <span style={{ fontSize:"0.65rem", color:"#6b6b5a" }}>Apparence</span>
                  <button onClick={toggleTheme} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:20, padding:"5px 14px", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", color:"#6b6b5a", cursor:"pointer", letterSpacing:1, transition:"all 0.2s" }}>
                    {theme === 'dark' ? '☀ Mode clair' : '◑ Mode sombre'}
                  </button>
                </div>
                <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <a href="/api/export" download style={{ color:"#4a4a3a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", letterSpacing:1, textDecoration:"none" }}>
                    ⬇ Exporter mes données (CSV)
                  </a>
                  <button style={{ background:"none", border:"none", color:"#3a2a2a", fontFamily:"'DM Mono',monospace", fontSize:"0.6rem", cursor:"pointer", letterSpacing:1 }}
                    onClick={async()=>{
                      if (!window.confirm('Supprimer définitivement ton compte et toutes tes données ? Cette action est irréversible.')) return;
                      const password = window.prompt('Confirme ton mot de passe pour supprimer ton compte :');
                      if (!password) return;
                      const res = await fetch('/api/auth/delete-account', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password }) });
                      if (!res.ok) { const d = await res.json(); window.alert(d.error || 'Erreur'); return; }
                      window.location.href = '/login';
                    }}>
                    Supprimer mon compte
                  </button>
                </div>
                <div style={{ borderTop:"1px solid #1e1e1e", marginTop:10, paddingTop:10, display:"flex", gap:16 }}>
                  <a href="/cgu" style={{ color:"#3a3a2a", fontFamily:"'DM Mono',monospace", fontSize:"0.55rem", letterSpacing:1, textDecoration:"none" }}>CGU</a>
                  <a href="/privacy" style={{ color:"#3a3a2a", fontFamily:"'DM Mono',monospace", fontSize:"0.55rem", letterSpacing:1, textDecoration:"none" }}>Confidentialité</a>
                </div>
              </div>
            )}

          </>
          </div>
          </div>);
        })()}

        {/* ─── SANTÉ ─── */}
        {tab==="sante" && (<>
          {/* ─── Accordéon rapports nutritionnels ─── */}
          {(() => {
            const nutri = reportHistory.filter(r => r.type !== 'medical');
            return (
              <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
                <button onClick={()=>setReportNutriOpen(o=>!o)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:"none", border:"none", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:"0.8rem" }}>📊</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:"#c8b890", letterSpacing:1 }}>Rapports nutritionnels</span>
                    {nutri.length > 0 && <span style={{ background:"#2a2a1a", border:"1px solid #3a3a1a", borderRadius:10, padding:"1px 7px", fontSize:"0.55rem", color:"#a0904a" }}>{nutri.length}</span>}
                  </div>
                  <span style={{ color:"#4a4a3a", fontSize:"0.7rem" }}>{reportNutriOpen ? "▲" : "▼"}</span>
                </button>
                {reportNutriOpen && (
                  <div style={{ borderTop:"1px solid #2a2a2a", padding:"8px 14px 12px" }}>
                    {nutri.length === 0 ? (
                      <div style={{ fontSize:"0.6rem", color:"#3a3a2a", textAlign:"center", padding:"8px 0" }}>{t('app.no_report')}</div>
                    ) : nutri.map((r, i) => (
                      <div key={r.id || i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom: i < nutri.length-1 ? "1px solid #1e1e1e" : "none" }}>
                        <button onClick={() => { const idx = reportHistory.findIndex(x=>x.id===r.id); setReportHistoryIdx(idx>=0?idx:0); setReportHtml(r.html); setReportTitle(r.title); setReportStatus(null); }}
                          style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", flex:1, padding:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:"0.65rem", color:"#c8b890" }}>{r.title}{r.days ? ` — ${r.days}j` : ''}</span>
                            {r.type === 'coach' && <span style={{ fontSize:"0.48rem", color:"#8a7abf", background:"#1a1a2a", border:"1px solid #2a2a4a", borderRadius:5, padding:"1px 5px", flexShrink:0 }}>coach</span>}
                          </div>
                          <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:1 }}>{r.date}</div>
                        </button>
                        <button onClick={async () => { await fetch('/api/reports', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: r.id }) }); setReportHistory(prev => prev.filter(x => x.id !== r.id)); }}
                          style={{ background:"none", border:"none", color:"#3a2a2a", cursor:"pointer", fontSize:"0.7rem", padding:"4px 8px", flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── Accordéon rapports médicaux ─── */}
          {(() => {
            const med = reportHistory.filter(r => r.type === 'medical');
            return (
              <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, marginBottom:16, overflow:"hidden" }}>
                <button onClick={()=>setReportMedOpen(o=>!o)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:"none", border:"none", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:"0.8rem" }}>🧪</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:"#c8b890", letterSpacing:1 }}>Analyses biologiques</span>
                    {med.length > 0 && <span style={{ background:"#1a0d0d", border:"1px solid #3a1a1a", borderRadius:10, padding:"1px 7px", fontSize:"0.55rem", color:"#a07070" }}>{med.length}</span>}
                  </div>
                  <span style={{ color:"#4a4a3a", fontSize:"0.7rem" }}>{reportMedOpen ? "▲" : "▼"}</span>
                </button>
                {reportMedOpen && (
                  <div style={{ borderTop:"1px solid #2a2a2a", padding:"8px 14px 12px" }}>
                    {med.length === 0 ? (
                      <div style={{ fontSize:"0.6rem", color:"#3a3a2a", textAlign:"center", padding:"8px 0" }}>{t('app.no_report')}</div>
                    ) : med.map((r, i) => (
                      <div key={r.id || i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom: i < med.length-1 ? "1px solid #1e1e1e" : "none" }}>
                        <button onClick={() => { const idx = reportHistory.findIndex(x=>x.id===r.id); setReportHistoryIdx(idx>=0?idx:0); setReportHtml(r.html); setReportTitle(r.title); setReportStatus(null); }}
                          style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", flex:1, padding:0 }}>
                          <div style={{ fontSize:"0.65rem", color:"#c8b890" }}>{r.title}</div>
                          <div style={{ fontSize:"0.55rem", color:"#3a3a2a", marginTop:1 }}>{r.date}</div>
                        </button>
                        <button onClick={async () => { await fetch('/api/reports', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: r.id }) }); setReportHistory(prev => prev.filter(x => x.id !== r.id)); }}
                          style={{ background:"none", border:"none", color:"#3a2a2a", cursor:"pointer", fontSize:"0.7rem", padding:"4px 8px", flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Input fichier — toujours présent */}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display:"none" }} onChange={handleBloodUpload} />

          {/* Upload direct (nutritionniste en viewAs ou patient sans coach) */}
          {(user?.isViewAs || !coachLinked) && (<>
            <div className="upload-zone" onClick={()=>!user?.isViewAs&&fileRef.current?.click()}
              style={user?.isViewAs?{opacity:0.4,cursor:"not-allowed"}:{}}>
              <div className="up-icon">🩺</div>
              <div className="up-text">{user?.isViewAs ? "Upload réservé au coach" : "Importer un bilan de santé"}</div>
              <div className="up-hint">Prise de sang · Bilan hormonal · Vitamines · PDF ou photo(s)</div>
            </div>
          </>)}

          {/* Bouton analyser bilan reçu (viewAs uniquement) */}
          {user?.isViewAs && pendingBlood && (
            <div style={{ background:"#0d1a0d", border:"1px solid #3a7a3a", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:"0.68rem", color:"#7abf8a", marginBottom:8 }}>📎 Bilan reçu du patient — {pendingBlood.count} fichier{pendingBlood.count>1?'s':''} · {new Date(pendingBlood.sentAt).toLocaleDateString('fr-FR')}</div>
              <button className="btn" style={{ width:"100%", fontSize:"0.7rem" }} onClick={handleAnalyzePending} disabled={analyzeLoading}>
                {analyzeLoading ? <span className="dot-pulse"><span/><span/><span/></span> : "🔬 Analyser ce bilan"}
              </button>
            </div>
          )}

          {/* Zone envoi bilan au coach */}
          {!user?.isViewAs && coachLinked && (<>
            <div className="upload-zone" onClick={()=>fileRef.current?.click()}>
              <div className="up-icon">📎</div>
              <div className="up-text">{bloodLoading ? 'Envoi en cours…' : 'Envoyer un bilan à mon coach'}</div>
              <div className="up-hint">Prise de sang · Bilan hormonal · Vitamines · PDF ou photo(s)</div>
            </div>
          </>)}

          {bloodLoading && <div className="loading-row"><div className="dot-pulse"><span/><span/><span/></div>{t('app.blood_analyzing')}</div>}
          {analyzeLoading && <div className="loading-row"><div className="dot-pulse"><span/><span/><span/></div>Analyse du bilan patient en cours…</div>}
          {bloodError && <div className="error-msg">{bloodError}</div>}
          {bloodTests.length >= 1 && !user?.isViewAs && !coachLinked && (
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <button className="btn" style={{ flex:2, fontSize:"0.7rem" }} onClick={generateHealthReport}>{t('app.bio_analyze')}</button>
              {bloodTests.length >= 2 && <button className="btn" style={{ flex:1, fontSize:"0.7rem", background:"#1a1a2a", border:"1px solid #3a3a6a", color:"#8a8acf" }} onClick={()=>{ setCompareA(0); setCompareB(1); setCompareOpen(true); }}>{t('app.blood_compare')}</button>}
            </div>
          )}
          {bloodTests.length===0&&!bloodLoading && (
            <div style={{ textAlign:"center", padding:"20px 16px 24px" }}>
              <div style={{ fontSize:"1.8rem", marginBottom:10 }}>🩺</div>
              <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:6 }}>{t('app.blood_none')}</div>
              <div style={{ fontSize:"0.6rem", color:"#4a4a3a", marginBottom:16, lineHeight:1.7 }}>
                {coachLinked && !user?.isViewAs ? t('app.blood_none_coach') : t('app.blood_none_self')}
              </div>
              {!user?.isViewAs && !coachLinked && (
                <button className="btn secondary" style={{ fontSize:"0.65rem" }} onClick={()=>fileRef.current?.click()}>{t('app.blood_import')}</button>
              )}
              {/* Pas de bouton ici quand coachLinked — la zone upload au-dessus suffit */}
            </div>
          )}
          {bloodTests.map((result,i) => result.pendingCoachValidation ? (
            <div key={result.id} style={{ background:"#1a1a0d", border:"1px solid #a8905040", borderRadius:10, padding:"14px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ fontSize:"1.4rem" }}>🕐</div>
              <div>
                <div style={{ fontSize:"0.72rem", color:"#c8b890", marginBottom:2 }}>En cours d'analyse par ton coach</div>
                <div style={{ fontSize:"0.6rem", color:"#4a4a3a" }}>{result.reportType || 'Bilan'} · {result.date || new Date(result.uploadedAt).toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
          ) : (
            <BloodTestCard key={result.id} result={result} prevResult={bloodTests.filter(b=>!b.pendingCoachValidation)[i+1]||null} isLatest={i===0} onDelete={()=>handleDeleteBlood(result.id)} />
          ))}
          {!coachLinked && <div className="legal-note">{t('app.legal_note')}<br/>{t('app.legal_note2')}</div>}
        </>)}
      </div>

      {/* ─── Toast global ─── */}
      {toast && <div className={`toast-ui ${toast.type}`}>{toast.msg}</div>}

      {/* ─── Toast rapport ─── */}
      {reportStatus && (
        <div className="report-toast">
          <div className="report-toast-row">
            <span className="report-toast-label">
              {reportStatus === 'loading' ? `⏳ ${reportTitle} en cours…` : `✓ ${reportTitle} prêt`}
            </span>
            {reportStatus === 'ready' && (
              <button className="btn" style={{ fontSize:"0.65rem", padding:"6px 12px" }} onClick={()=>setReportStatus(null)}>
                Ouvrir
              </button>
            )}
            <button className="del-btn" style={{ fontSize:"0.8rem" }} onClick={()=>{ if(reportStatus==='ready') setReportHtml(null); setReportStatus(null); }}>✕</button>
          </div>
          {reportStatus === 'loading' && (
            <div className="report-progress"><div className="report-progress-fill" /></div>
          )}
        </div>
      )}

      {/* ─── Modal rapport ─── */}
      {reportHtml && reportStatus === null && (
        <div className="report-overlay" onClick={()=>setReportHtml(null)}>
          <div className="report-modal" onClick={e=>e.stopPropagation()}>
            <div className="report-header">
              <div>
                <div className="report-title">{reportTitle}</div>
                <div className="report-date">{reportHistory[reportHistoryIdx]?.date || new Date().toLocaleDateString("fr-FR",{year:"numeric",month:"long",day:"numeric"})}{reportHistory[reportHistoryIdx]?.days ? ` · ${reportHistory[reportHistoryIdx].days}j` : ''}</div>
              </div>
              <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                <button className="btn" style={{ fontSize:"0.65rem", padding:"7px 12px" }} onClick={()=>{
                  const html = reportHtml;
                  const w = window.open('','_blank');
                  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport nutritionnel</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.7}h1{font-size:1.5rem;border-bottom:2px solid #c8a860;padding-bottom:10px}h2{font-size:1.05rem;color:#2a1a00;margin-top:26px;margin-bottom:6px;border-bottom:1px solid #e8d8a0;padding-bottom:3px}p{margin-bottom:12px;font-size:0.92rem}ul{padding-left:18px;margin-bottom:12px}li{margin-bottom:5px;font-size:0.92rem}strong{color:#2a1a00}.date{font-size:0.7rem;color:#8a7a5a;margin-bottom:28px}@media print{body{margin:0}}</style></head><body><h1>Rapport nutritionnel personnalisé</h1><p class="date">Généré le ${new Date().toLocaleDateString("fr-FR",{year:"numeric",month:"long",day:"numeric"})}</p>${html}</body></html>`);
                  w.document.close();
                  setTimeout(()=>w.print(), 400);
                }}>⬇ PDF</button>
                <button className="btn secondary" style={{ fontSize:"0.65rem", padding:"7px 12px" }} onClick={()=>setReportHtml(null)}>Fermer</button>
              </div>
            </div>

            {/* Navigation historique */}
            {reportHistory.length > 1 && (
              <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
                {reportHistory.map((r, i) => (
                  <button key={i} onClick={()=>{ setReportHistoryIdx(i); setReportHtml(r.html); setReportTitle(r.title); }}
                    style={{ flexShrink:0, padding:"5px 10px", background: reportHistoryIdx===i?"#2a1a00":"transparent", border:`1px solid ${reportHistoryIdx===i?"#c8a860":"#d8c8a0"}`, borderRadius:16, fontFamily:"'DM Mono',monospace", fontSize:"0.58rem", color: reportHistoryIdx===i?"#f0e6c8":"#8a7a5a", cursor:"pointer" }}>
                    {r.title.replace('Rapport ','')}{r.days ? ` ${r.days}j` : ''} · {r.date}
                  </button>
                ))}
              </div>
            )}

            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportHtml) }} />
            <button className="report-close-fab" onClick={()=>setReportHtml(null)}>✕ Fermer</button>
          </div>
        </div>
      )}

      {/* ─── Onboarding (remplacé par /onboarding) ─── */}
      {false && (
        <div style={{ display:"none" }}>
          <div>
            {/* Progression */}
            <div style={{ display:"flex", gap:4, marginBottom:24 }}>
              {[1,2,3,4].map(s=>(
                <div key={s} style={{ flex:1, height:3, borderRadius:2, background: s<=onboardStep?"#c8b890":"#2a2a2a", transition:"background 0.3s" }}/>
              ))}
            </div>

            {/* Étape 1 — Bienvenue */}
            {onboardStep===1 && (<>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.4rem", color:"#f0e6c8", marginBottom:8 }}>Bienvenue 👋</div>
              <div style={{ fontSize:"0.65rem", color:"#5a5a4a", lineHeight:1.8, marginBottom:24 }}>
                Configurons ton profil en <strong style={{ color:"#c8b890" }}>2 minutes</strong> pour personnaliser tes objectifs nutritionnels et tes rapports.
              </div>
              <div style={{ fontSize:"0.58rem", color:"#3a3a2a", marginBottom:24, lineHeight:1.7 }}>
                Tu pourras tout modifier ensuite dans l'onglet Profil.
              </div>
              <button style={{ width:"100%", padding:"12px", background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", fontWeight:500, cursor:"pointer" }}
                onClick={()=>setOnboardStep(2)}>Commencer →</button>
            </>)}

            {/* Étape 2 — Profil physique */}
            {onboardStep===2 && (<>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8", marginBottom:16 }}>Profil physique</div>
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                {[{v:"homme",l:"👨 Homme"},{v:"femme",l:"👩 Femme"}].map(o=>(
                  <button key={o.v} onClick={()=>setObSex(o.v)} style={{ flex:1, padding:"8px", background:obSex===o.v?"#1e1a12":"#0d0d0d", border:`1px solid ${obSex===o.v?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color:obSex===o.v?"#c8b890":"#5a5a4a", cursor:"pointer" }}>{o.l}</button>
                ))}
              </div>
              {[
                { label:"Date de naissance", val:obBirthdate, set:setObBirthdate, type:"date", ph:"" },
                { label:"Taille (cm)", val:obHeight, set:setObHeight, type:"number", ph:"175" },
                { label:"Poids (kg)", val:obWeight, set:setObWeight, type:"number", ph:"72" },
              ].map(f=>(
                <div key={f.label} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{f.label}</div>
                  <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                    style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.78rem", outline:"none" }}/>
                </div>
              ))}
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Objectif</div>
                <div style={{ display:"flex", gap:6 }}>
                  {[{v:"perte",e:"📉",l:"Perte"},{v:"maintien",e:"⚖️",l:"Maintien"},{v:"masse",e:"📈",l:"Masse"}].map(o=>(
                    <button key={o.v} onClick={()=>setObMode(o.v)} style={{ flex:1, padding:"8px 4px", background:obMode===o.v?"#1e1a12":"#0d0d0d", border:`1px solid ${obMode===o.v?"#c8b890":"#2a2a2a"}`, borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", color:obMode===o.v?"#c8b890":"#5a5a4a", cursor:"pointer", textAlign:"center" }}>
                      {o.e} {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:16 }}>
                <button onClick={()=>setOnboardStep(1)} style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>← Retour</button>
                <button onClick={()=>setOnboardStep(3)} style={{ flex:2, padding:"10px", background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", fontWeight:500, cursor:"pointer" }}>Continuer →</button>
              </div>
            </>)}

            {/* Étape 3 — Objectifs */}
            {onboardStep===3 && (()=>{
              const age = obBirthdate ? Math.floor((new Date()-new Date(obBirthdate))/(365.25*24*3600*1000)) : null;
              const bmr = (obHeight && obWeight && age) ? Math.round(10*Number(obWeight)+6.25*Number(obHeight)-5*age+(obSex==='homme'?5:-161)) : null;
              const maintien = bmr ? Math.round(bmr*1.2) : null;
              const suggestedKcal = maintien ? (obMode==='perte' ? maintien-400 : obMode==='masse' ? maintien+300 : maintien) : null;
              const ratios = obMode==='perte'?{p:0.35,g:0.35,l:0.30}:obMode==='masse'?{p:0.25,g:0.50,l:0.25}:{p:0.25,g:0.45,l:0.30};
              const suggestedProt = suggestedKcal ? Math.round(suggestedKcal*ratios.p/4) : null;
              return (<>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8", marginBottom:16 }}>Objectifs nutritionnels</div>
                {bmr && (
                  <div style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:"0.62rem", color:"#5a5a4a", lineHeight:1.7 }}>
                    BMR calculé : <strong style={{ color:"#c8b890" }}>{bmr} kcal</strong> · Maint. estimé : <strong style={{ color:"#c8b890" }}>{suggestedKcal} kcal</strong>
                    <div style={{ fontSize:"0.55rem", marginTop:2 }}>Pré-rempli automatiquement — ajuste si besoin</div>
                  </div>
                )}
                {[
                  { label:"Objectif calorique (kcal/j)", val:obKcal, set:setObKcal, ph:suggestedKcal||"2000" },
                  { label:"Protéines (g/j)", val:obProtein, set:setObProtein, ph:suggestedProt||"150" },
                ].map(f=>(
                  <div key={f.label} style={{ marginBottom:10 }}>
                    <div style={{ fontSize:"0.58rem", color:"#4a4a3a", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{f.label}</div>
                    <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={String(f.ph)}
                      style={{ width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.78rem", outline:"none" }}/>
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:16 }}>
                  <button onClick={()=>setOnboardStep(2)} style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>← Retour</button>
                  <button onClick={()=>setOnboardStep(4)} style={{ flex:2, padding:"10px", background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", fontWeight:500, cursor:"pointer" }}>Continuer →</button>
                </div>
              </>);
            })()}

            {/* Étape 4 — Connexions optionnelles */}
            {onboardStep===4 && (<>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", color:"#f0e6c8", marginBottom:8 }}>Presque terminé !</div>
              <div style={{ fontSize:"0.62rem", color:"#5a5a4a", lineHeight:1.8, marginBottom:20 }}>
                Tu peux connecter ces services maintenant ou plus tard depuis l'onglet <strong style={{ color:"#c8b890" }}>Profil</strong>.
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                <a href="/api/strava/auth" style={{ textDecoration:"none" }}>
                  <div style={{ background:"#1a0d00", border:"1px solid #fc4c02", borderRadius:10, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:"0.7rem", color:"#fc4c02" }}>🟠 Strava</div>
                      <div style={{ fontSize:"0.58rem", color:"#5a3a2a", marginTop:2 }}>Calories sportives automatiques</div>
                    </div>
                    <div style={{ fontSize:"0.6rem", color:"#fc4c02" }}>→</div>
                  </div>
                </a>
                <div style={{ background:"#0d0d1a", border:"1px solid #2a2a4a", borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:"0.7rem", color:"#8a8acf" }}>🩺 Bilan sanguin</div>
                  <div style={{ fontSize:"0.58rem", color:"#3a3a5a", marginTop:2 }}>Import depuis l'onglet Santé après configuration</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setOnboardStep(3)} style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:8, color:"#5a5a4a", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer" }}>← Retour</button>
                <button onClick={finishOnboarding} disabled={obSaving} style={{ flex:2, padding:"10px", background:"#c8b890", color:"#0d0d0d", border:"none", borderRadius:8, fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", fontWeight:500, cursor:obSaving?"not-allowed":"pointer", opacity:obSaving?0.7:1 }}>
                  {obSaving ? "Enregistrement…" : "Commencer 🎯"}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* ─── Modal barcode scanner ─── */}
      {barcodeModal && (
        <div className="modal-overlay" onClick={()=>setBarcodeModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:360 }}>
            <h2>▦ Code-barres</h2>
            <div style={{ position:"relative", borderRadius:10, overflow:"hidden", background:"#0d0d0d", aspectRatio:"4/3", marginBottom:12 }}>
              <video ref={videoRef} autoPlay playsInline muted className="scan-video" />
              <div style={{ position:"absolute", top:"50%", left:"10%", right:"10%", height:2, background:"#c8b890", opacity:0.7 }} />
            </div>
            <canvas ref={canvasRef} style={{ display:"none" }} />
            {barcodeError && <div className="error-msg" style={{ marginBottom:10 }}>{barcodeError}</div>}
            <div className="scan-divider">— ou saisir manuellement —</div>
            <div style={{ display:"flex", gap:6 }}>
              <input type="text" inputMode="numeric" placeholder="3017620425035" value={barcodeManual}
                onChange={e=>setBarcodeManual(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&barcodeManual.trim()&&fetchBarcode(barcodeManual.trim())}
                style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 10px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.75rem", outline:"none", marginBottom:0 }} />
              <button className="btn" onClick={()=>fetchBarcode(barcodeManual.trim())} disabled={!barcodeManual.trim()}>OK</button>
            </div>
            <div className="modal-actions" style={{ marginTop:12 }}>
              <button className="btn secondary" style={{ width:"100%" }} onClick={()=>setBarcodeModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Chat Coach ─── */}
      {coachLinked && (
        <button onClick={()=>{ setChatOpen(true); setChatUnread(0); }} style={{ position:"fixed", bottom:80, right:16, zIndex:90, width:48, height:48, borderRadius:"50%", background:"#1e2a1e", border:"1px solid #4a8a4a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 12px rgba(0,0,0,0.5)" }}>
          <span style={{ fontSize:"1.2rem" }}>💬</span>
          {chatUnread > 0 && <span style={{ position:"absolute", top:0, right:0, background:"#c87070", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:"0.55rem", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace" }}>{chatUnread}</span>}
        </button>
      )}

      {chatOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:150, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 0 0" }} onClick={()=>setChatOpen(false)}>
          <div style={{ width:"100%", maxWidth:520, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:"16px 16px 0 0", padding:"16px 16px 0", maxHeight:"70vh", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexShrink:0 }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", color:"#c8b890", letterSpacing:1 }}>💬 Coach</div>
              <button onClick={()=>setChatOpen(false)} style={{ background:"none", border:"none", color:"#5a5a4a", fontSize:"1rem", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", paddingBottom:8, display:"flex", flexDirection:"column", gap:8 }}>
              {chatMessages.length === 0 && <div style={{ textAlign:"center", color:"#3a3a2a", fontSize:"0.62rem", padding:"20px 0" }}>Aucun message. Dis bonjour à ton coach !</div>}
              {chatMessages.map((m, i) => (
                <div key={m.id||i} style={{ display:"flex", flexDirection:"column", alignItems: m.role==='athlete'?"flex-end":"flex-start" }}>
                  <div style={{ maxWidth:"78%", background: m.role==='athlete'?"#1e2a1e":"#1e1a12", border:`1px solid ${m.role==='athlete'?"#3a6a3a":"#3a3218"}`, borderRadius: m.role==='athlete'?"12px 12px 2px 12px":"12px 12px 12px 2px", padding:"8px 12px" }}>
                    <div style={{ fontSize:"0.68rem", color: m.role==='athlete'?"#7abf8a":"#c8b890", lineHeight:1.5 }}>{m.text}</div>
                  </div>
                  <div style={{ fontSize:"0.5rem", color:"#3a3a2a", marginTop:2, marginLeft:4, marginRight:4 }}>{new Date(m.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, padding:"12px 0", flexShrink:0, borderTop:"1px solid #2a2a2a" }}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChatMessage()} placeholder="Message…" style={{ flex:1, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"9px 12px", color:"#e8e0d0", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", outline:"none" }}/>
              <button onClick={sendChatMessage} disabled={!chatInput.trim()||chatSending} style={{ padding:"9px 14px", background:"#2a4a2a", border:"1px solid #4a8a4a", borderRadius:10, color:"#7abf8a", fontFamily:"'DM Mono',monospace", fontSize:"0.7rem", cursor:"pointer", opacity:!chatInput.trim()||chatSending?0.5:1 }}>→</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmation produit scanné ─── */}
      {barcodeConfirm && (
        <div className="modal-overlay" onClick={()=>setBarcodeConfirm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>{t('app.confirm_add')}</h2>
            <div style={{ background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ fontSize:"0.85rem", color:"#e8e0d0", marginBottom:4 }}>{barcodeConfirm.name}</div>
              {barcodeConfirm.brand && <div style={{ fontSize:"0.62rem", color:"#5a5a4a", marginBottom:6 }}>{barcodeConfirm.brand}</div>}
              <div style={{ fontSize:"0.65rem", color:"#6b6b5a" }}>Pour 100g : {barcodeConfirm.kcal} kcal · P {barcodeConfirm.protein}g · G {barcodeConfirm.carbs}g · L {barcodeConfirm.fat}g</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <label style={{ fontSize:"0.65rem", color:"#5a5a4a", flexShrink:0 }}>{t('app.quantity')}</label>
              <input type="number" min="1" step="1" value={barcodeQty} onChange={e=>setBarcodeQty(Number(e.target.value))}
                style={{ width:80, background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:8, padding:"7px 10px", color:"#c8b890", fontFamily:"'DM Mono',monospace", fontSize:"0.8rem", textAlign:"center", outline:"none", marginBottom:0 }} />
              <span style={{ fontSize:"0.65rem", color:"#5a5a4a" }}>g</span>
              <span style={{ fontSize:"0.65rem", color:"#7abf8a", marginLeft:"auto" }}>= {Math.round(barcodeConfirm.kcal*barcodeQty/100)} kcal</span>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={confirmBarcodeAdd}>{t('app.add_to_journal')}</button>
              <button className="btn secondary" onClick={()=>setBarcodeConfirm(null)}>{t('app.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal sauvegarde recette ─── */}
      {saveModal && (
        <div className="modal-overlay" onClick={()=>setSaveModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>{t('app.save')}</h2>
            <input type="text" placeholder="Nom de la recette..." value={recipeName}
              onChange={e=>setRecipeName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveRecipe()} autoFocus />
            <select className="cat-select" value={saveCategory} onChange={e=>setSaveCategory(e.target.value)}>
              {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn" onClick={saveRecipe} disabled={!recipeName.trim()}>{t('app.save')}</button>
              <button className="btn secondary" onClick={()=>setSaveModal(false)}>{t('app.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PWA Install Banner ─── */}
      {installBanner && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, maxWidth:480, margin:"0 auto", background:"#161616", border:"1px solid #2a2a2a", borderRadius:"20px 20px 0 0", padding:"28px 20px 32px", zIndex:900, boxShadow:"0 -12px 48px rgba(0,0,0,0.7)", animation:"slideUp 0.35s cubic-bezier(0.32,0.72,0,1)" }}>
          <button onClick={dismissInstall}
            style={{ position:"absolute", top:14, right:16, background:"none", border:"none", color:"#4a4a3a", fontSize:"1.1rem", cursor:"pointer", lineHeight:1, padding:4 }}>✕</button>

          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:"#1e1a12", border:"1px solid #3a3218", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.6rem", flexShrink:0 }}>🥗</div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.2rem", color:"#f0e6c8", lineHeight:1.2 }}>Nutrainer</div>
              <div style={{ fontSize:"0.6rem", color:"#c8b890", letterSpacing:1, marginTop:3 }}>{t('app.install_subtitle')}</div>
            </div>
          </div>

          {isIos ? (
            <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ fontSize:"0.55rem", color:"#4a4a3a", letterSpacing:2, textTransform:"uppercase", marginBottom:12, textAlign:"center" }}>{t('app.install_ios_title')}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:"#2a2a1a", border:"1px solid #3a3a2a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.6rem", color:"#c8b890", flexShrink:0 }}>1</div>
                  <span style={{ fontSize:"0.7rem", color:"#8a8070" }}>{t('app.install_ios_1')} <strong style={{ color:"#c8b890" }}>{t('app.install_ios_share')}</strong> en bas de Safari</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:"#2a2a1a", border:"1px solid #3a3a2a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.6rem", color:"#c8b890", flexShrink:0 }}>2</div>
                  <span style={{ fontSize:"0.7rem", color:"#8a8070" }}>{t('app.install_ios_2')} <strong style={{ color:"#c8b890" }}>{t('app.install_ios_home')}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={handleInstall}
              style={{ width:"100%", padding:"14px", background:"#c8b890", border:"none", borderRadius:12, color:"#0d0d0d", fontFamily:"'DM Mono',monospace", fontSize:"0.8rem", fontWeight:600, cursor:"pointer", letterSpacing:1, marginBottom:10 }}>
              {t('app.install_btn')}
            </button>
          )}

          <button onClick={dismissInstall}
            style={{ width:"100%", padding:"10px", background:"transparent", border:"1px solid #2a2a2a", borderRadius:10, color:"#4a4a3a", fontFamily:"'DM Mono',monospace", fontSize:"0.62rem", cursor:"pointer" }}>
            {t('app.install_later')}
          </button>
        </div>
      )}

      {/* ─── Modal upgrade ─── */}
      {upgradeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }} onClick={()=>setUpgradeModal(null)}>
          <div style={{ width:"100%", maxWidth:380, background:"#1a1a1a", border:"1px solid #3a3218", borderRadius:16, padding:"24px 20px 28px" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", color:"#f0e6c8" }}>
                {upgradeModal.feature === 'suggestions' ? '✨ Suggestions IA' : upgradeModal.feature === 'bloodtest' ? '🩸 Bilan sanguin' : upgradeModal.feature === 'strava' ? '🟠 Strava' : '📊 Rapports'}
              </div>
              <button onClick={()=>setUpgradeModal(null)} style={{ background:"none", border:"none", color:"#5a5a4a", fontSize:"1.1rem", cursor:"pointer" }}>✕</button>
            </div>

            <div style={{ fontSize:"0.68rem", color:"#a09880", lineHeight:1.7, marginBottom:18 }}>
              {upgradeModal.feature === 'suggestions'
                ? 'Tu as atteint ta limite mensuelle de 5 suggestions IA. Passe à Pro pour des suggestions illimitées.'
                : upgradeModal.feature === 'bloodtest'
                ? 'Le plan gratuit inclut 1 analyse de bilan sanguin. Passe à Pro pour des analyses illimitées.'
                : upgradeModal.feature === 'strava'
                ? 'La connexion Strava est réservée aux abonnés Pro. Synchronise tes séances pour ajuster tes calories automatiquement.'
                : 'La génération de rapports nutritionnels est réservée aux abonnés Pro.'}
            </div>

            <div style={{ background:"#1e1a12", border:"1px solid #3a3218", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:"0.58rem", color:"#7a6a40", letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Pro — 8,99€/mois</div>
              {['Suggestions IA illimitées', 'Bilans sanguins illimités', 'Rapports nutritionnels', 'Connexion Strava'].map(f => (
                <div key={f} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ color:"#c8a870", fontSize:"0.7rem" }}>✓</span>
                  <span style={{ fontSize:"0.65rem", color:"#c8b890" }}>{f}</span>
                </div>
              ))}
            </div>

            <a href="https://buy.stripe.com/eVqeV6f9M8251t73FY2Nq00" target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"block" }}>
              <button style={{ width:"100%", padding:"12px", background:"#c8a870", border:"none", borderRadius:10, color:"#0d0d0d", fontFamily:"'DM Mono',monospace", fontSize:"0.75rem", fontWeight:600, cursor:"pointer", letterSpacing:1 }}>
                Passer à Pro →
              </button>
            </a>
            <a href="https://buy.stripe.com/eVqbIU2n0eqt1t74K22Nq01" target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"block", marginTop:8 }}>
              <button style={{ width:"100%", padding:"10px", background:"transparent", border:"1px solid #3a3218", borderRadius:10, color:"#7a6a40", fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", cursor:"pointer", letterSpacing:1 }}>
                Annuel — 86,30€/an (−20%)
              </button>
            </a>
          </div>
        </div>
      )}

    </>
  );

  async function compressImage(file) {
    if (file.type === 'application/pdf') return file;
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleBloodTransfer(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setTransferLoading(true); setBloodError("");
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      const fd = new FormData();
      compressed.forEach(f => fd.append('files', f));
      const res = await fetch('/api/blood-transfer', { method:'POST', body:fd });
      const data = await res.json();
      if (data.error) setBloodError(data.error);
      else { setTransferSent(true); setPendingBlood({ sentAt: new Date().toISOString(), count: files.length }); }
    } catch(err) { setBloodError("Erreur : " + (err?.message || 'Réessaie')); }
    setTransferLoading(false);
    e.target.value = "";
  }

  async function handleAnalyzePending() {
    setAnalyzeLoading(true); setBloodError("");
    try {
      const res = await fetch('/api/blood-transfer', { method:'PUT' });
      const data = await res.json();
      if (data.error) setBloodError(data.error);
      else setReviewResult(JSON.parse(JSON.stringify(data.result)));
    } catch(err) { setBloodError("Erreur : " + (err?.message || 'Réessaie')); }
    setAnalyzeLoading(false);
  }

  async function handleConfirmAnalysis() {
    setConfirmLoading(true);
    try {
      const res = await fetch('/api/blood-transfer', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ result: reviewResult }) });
      const data = await res.json();
      if (data.error) setBloodError(data.error);
      else { setBloodTests(prev => [reviewResult, ...prev]); setPendingBlood(null); setReviewResult(null); }
    } catch(err) { setBloodError("Erreur : " + (err?.message || 'Réessaie')); }
    setConfirmLoading(false);
  }

  async function handleBloodUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBloodLoading(true); setBloodError("");
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      const totalMB = compressed.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
      if (totalMB > 18) {
        setBloodError("Fichiers trop volumineux même après compression. Essaie avec moins d'images.");
        setBloodLoading(false);
        return;
      }
      const recentEntries = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate()-i);
        const res = await fetch(`/api/entries?date=${dateKey(d)}`);
        const data = await res.json();
        if (data.entries?.length) recentEntries.push(`${dateKey(d)}: ${data.entries.map(en=>en.name).join(", ")}`);
      }
      const fd = new FormData();
      compressed.forEach(f => fd.append('files', f));
      fd.append('recentFoods', recentEntries.join('\n'));
      const res  = await fetch('/api/bloodtest', { method:'POST', body:fd });
      if (res.status === 402) { setUpgradeModal({ feature: 'bloodtest' }); setBloodLoading(false); e.target.value = ""; return; }
      const data = await res.json();
      if (data.error) setBloodError(data.error);
      else setBloodTests(prev=>[data.result,...prev]);
    } catch(err) { setBloodError("Erreur : " + (err?.message || "Impossible d'analyser le fichier. Réessaie.")); }
    setBloodLoading(false);
    e.target.value = "";
  }

  async function handleDeleteBlood(id) {
    await fetch('/api/bloodtest', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
    setBloodTests(prev => prev.filter(r => r.id !== id));
  }
}
