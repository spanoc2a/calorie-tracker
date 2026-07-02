import { requireAuth } from '../auth/session';
import { userDb } from '../db';

// Planning de séances datées — v1 = couche d'overrides.
// Le programme muscu reste en jours génériques (Lundi/Mardi…) ; la projection par
// défaut se calcule côté client. On ne stocke ICI que les exceptions :
//   userDb(userId).sessionSchedule = { 'YYYY-MM-DD': { dayLabel: string|null, skipped?: true } }
//   - dayLabel : jour de programme déplacé SUR cette date
//   - skipped  : la séance prévue ce jour-là est sautée (ou déplacée ailleurs)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 24 * 3600 * 1000;
const MAX_ENTRIES = 200;   // cap absolu du nombre d'overrides
const PURGE_DAYS = 90;     // les overrides de plus de 90 j sont purgés au passage
const BOUND_DAYS = 60;     // les écritures sont bornées à ±60 j d'aujourd'hui

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Date valide = format YYYY-MM-DD ET date réelle (rejette 2026-02-31).
function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function daysFromToday(dateStr) {
  return Math.round((Date.parse(dateStr + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / MS_DAY);
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Purge les dates trop anciennes puis applique le cap (on évince les plus anciennes).
function prune(overrides) {
  const cutoff = shiftDate(today(), -PURGE_DAYS);
  let keys = Object.keys(overrides).filter(k => k >= cutoff).sort();
  if (keys.length > MAX_ENTRIES) keys = keys.slice(keys.length - MAX_ENTRIES);
  const out = {};
  for (const k of keys) out[k] = overrides[k];
  return out;
}

// Les overrides de l'élève sur une plage de dates (défaut : −7 j → +28 j)
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || shiftDate(today(), -7);
  const to = searchParams.get('to') || shiftDate(today(), 28);
  if (!isValidDate(from) || !isValidDate(to)) return Response.json({ error: 'from/to invalides (format YYYY-MM-DD)' }, { status: 400 });
  if (from > to) return Response.json({ error: 'from doit précéder to' }, { status: 400 });

  const all = await userDb(auth.userId).get('sessionSchedule') || {};
  const overrides = {};
  for (const [date, o] of Object.entries(all)) {
    if (date >= from && date <= to) overrides[date] = o;
  }
  return Response.json({ overrides });
}

// Modifier le planning : move / skip / reset
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { action } = body || {};

  const store = userDb(auth.userId);
  const overrides = prune(await store.get('sessionSchedule') || {});

  const checkDate = (d, name) => {
    if (!isValidDate(d)) return `${name} invalide (format YYYY-MM-DD)`;
    if (Math.abs(daysFromToday(d)) > BOUND_DAYS) return `${name} hors limite (±${BOUND_DAYS} jours)`;
    return null;
  };

  if (action === 'move') {
    const { fromDate, toDate, dayLabel } = body;
    const err = checkDate(fromDate, 'fromDate') || checkDate(toDate, 'toDate');
    if (err) return Response.json({ error: err }, { status: 400 });
    const label = typeof dayLabel === 'string' ? dayLabel.trim() : '';
    if (!label || label.length > 60) return Response.json({ error: 'dayLabel invalide (1 à 60 caractères)' }, { status: 400 });
    // Ordre important : si fromDate === toDate, la pose du dayLabel doit gagner.
    overrides[fromDate] = { dayLabel: null, skipped: true };
    overrides[toDate] = { dayLabel: label };
  } else if (action === 'skip') {
    const { date } = body;
    const err = checkDate(date, 'date');
    if (err) return Response.json({ error: err }, { status: 400 });
    overrides[date] = { dayLabel: null, skipped: true };
  } else if (action === 'reset') {
    const { date } = body;
    if (!isValidDate(date)) return Response.json({ error: 'date invalide (format YYYY-MM-DD)' }, { status: 400 });
    delete overrides[date];
  } else {
    return Response.json({ error: 'action invalide (move|skip|reset)' }, { status: 400 });
  }

  const next = prune(overrides);
  await store.set('sessionSchedule', next);
  return Response.json({ ok: true, overrides: next });
}
