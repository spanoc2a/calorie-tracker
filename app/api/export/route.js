import { userDb } from '../db';
import { requireAuth } from '../auth/session';

function esc(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(...cols) { return cols.map(esc).join(','); }

function getDates(days) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  if (auth.isViewAs) return Response.json({ error: 'Non autorisé' }, { status: 403 });

  const udb = userDb(auth.userId);
  const dates = getDates(365);

  const [settings, weightLog, bloodTests, reportHistory] = await Promise.all([
    udb.get('userSettings').then(s => s || {}),
    udb.get('weightLog').then(l => l || []),
    udb.get('bloodTests').then(b => b || []),
    udb.get('reportHistory').then(r => r || []),
  ]);

  const dayData = await Promise.all(dates.map(d => udb.get(`day:${d}`).then(e => ({ date: d, entries: e || [] }))));
  const waterData = await Promise.all(dates.map(d => udb.get(`water:${d}`).then(v => ({ date: d, glasses: v || 0 }))));

  const lines = ['# Export Nutrainer —' + new Date().toISOString().slice(0, 10), ''];

  // Journal alimentaire
  lines.push('## Journal alimentaire');
  lines.push(row('Date', 'Repas', 'Aliment', 'Quantité', 'Unité', 'Kcal', 'Protéines (g)', 'Glucides (g)', 'Lipides (g)'));
  for (const { date, entries } of dayData) {
    for (const e of entries) {
      lines.push(row(date, e.meal || '', e.name || '', e.quantity || '', e.unit || '', e.kcal || 0, e.protein || 0, e.carbs || 0, e.fat || 0));
    }
  }

  lines.push('');

  // Poids
  lines.push('## Suivi du poids');
  lines.push(row('Date', 'Poids (kg)'));
  for (const e of weightLog) {
    lines.push(row(e.date, e.value || e.weight));
  }

  lines.push('');

  // Eau
  lines.push('## Hydratation');
  lines.push(row('Date', 'Verres'));
  for (const { date, glasses } of waterData.filter(w => w.glasses > 0)) {
    lines.push(row(date, glasses));
  }

  lines.push('');

  // Bilans sanguins
  if (bloodTests.length > 0) {
    lines.push('## Bilans sanguins');
    lines.push(row('Date', 'Type', 'Marqueur', 'Valeur', 'Unité', 'Ref min', 'Ref max', 'Statut'));
    for (const test of bloodTests) {
      for (const m of (test.markers || [])) {
        lines.push(row(test.date || '', test.reportType || '', m.name, m.value, m.unit || '', m.refMin || '', m.refMax || '', m.status));
      }
    }
    lines.push('');
  }

  // Objectifs
  lines.push('## Objectifs actuels');
  lines.push(row('Kcal', 'Protéines (g)', 'Glucides (g)', 'Lipides (g)'));
  lines.push(row(settings.goalKcal || '', settings.goalProtein || '', settings.goalCarbs || '', settings.goalFat || ''));

  const csv = lines.join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nutri-export-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
