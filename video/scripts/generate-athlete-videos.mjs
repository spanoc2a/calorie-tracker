/**
 * Génère automatiquement un rapport vidéo mp4 pour chaque athlète.
 * Usage : node scripts/generate-athlete-videos.mjs
 *
 * Prérequis : SESSION_COOKIE dans le .env du dossier video/
 */

import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'https://nutrainer.io';
const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

if (!SESSION_COOKIE) {
  console.error('❌ SESSION_COOKIE manquant dans le .env');
  console.error('   Récupère-le depuis les DevTools (Application → Cookies → session)');
  process.exit(1);
}

// ── 1. Récupérer les athlètes depuis l'API ──────────────────────────────────
async function fetchAthletes() {
  const res = await fetch(`${BASE_URL}/api/coach/athletes`, {
    headers: { Cookie: `session=${SESSION_COOKIE}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const { athletes } = await res.json();
  return athletes || [];
}

// ── 2. Rendre une vidéo pour un athlète ────────────────────────────────────
function renderVideo(athlete, coachName, outDir) {
  const now = new Date();
  const weekLabel = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const props = JSON.stringify({
    name: athlete.name,
    coachName,
    avgKcal7j: athlete.avgKcal7j || 0,
    goalKcal: athlete.goalKcal || 2000,
    avgProtein7j: athlete.avgProtein7j || 0,
    goalProtein: athlete.goalProtein || 150,
    activeDays7j: athlete.activeDays7j || 0,
    lastWeight: athlete.lastWeight || null,
    weightTrend: athlete.weightTrend || null,
    alert: athlete.alert || null,
    stravaCount7j: athlete.strava?.count7j || 0,
    weekLabel,
  });

  const safeName = athlete.name.replace(/[^a-zA-Z0-9]/g, '_');
  const outPath = join(outDir, `rapport_${safeName}.mp4`);

  console.log(`\n🎬 Rendu en cours : ${athlete.name}...`);
  try {
    execSync(
      `npx remotion render src/index.js AthleteReport "${outPath}" --props='${props}' --overwrite`,
      { cwd: join(__dirname, '..'), stdio: 'inherit' }
    );
    console.log(`✅ ${athlete.name} → ${outPath}`);
  } catch (e) {
    console.error(`❌ Échec pour ${athlete.name}`);
  }
}

// ── 3. Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Génération des rapports vidéo athlètes...\n');

  const athletes = await fetchAthletes();
  console.log(`📋 ${athletes.length} athlète(s) trouvé(s)`);

  const outDir = join(__dirname, '..', 'out', 'athletes');
  mkdirSync(outDir, { recursive: true });

  // Récupère le nom du coach depuis le premier athlète (ou depuis l'API /auth/me)
  const coachRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `session=${SESSION_COOKIE}` },
  });
  const { user } = await coachRes.json();
  const coachName = user?.name || 'Votre coach';

  for (const athlete of athletes) {
    await renderVideo(athlete, coachName, outDir);
  }

  console.log(`\n✅ Tous les rapports générés dans : out/athletes/`);
}

main().catch(console.error);
