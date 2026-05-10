/**
 * Lit le cache Google Fit 7j et retourne une chaîne de contexte pour les prompts IA.
 * Si Strava est aussi connecté, on omet les calories brûlées (déjà couvertes par Strava)
 * pour éviter le double comptage. On garde pas, minutes actives et poids.
 */
export async function getGoogleFitContext(udb) {
  try {
    const [cache, stravaCache] = await Promise.all([
      udb.get('googleFitCache'),
      udb.get('stravaCache'),
    ]);
    if (!cache) return '';

    const { avgSteps7d, avgActiveMinutes7d, activeDays7d } = cache;
    if (!avgSteps7d && !avgActiveMinutes7d) return '';

    const hasStrava = !!(stravaCache?.activities?.length);
    const label = hasStrava
      ? `Activité quotidienne Google Fit — pas et vie active (complémentaire à Strava) :`
      : `Données Google Fit (moyenne 7 derniers jours, ${activeDays7d} jours actifs) :`;

    const parts = [label];
    if (avgSteps7d > 0) parts.push(`- Pas moyen/j : ${avgSteps7d.toLocaleString('fr-FR')} (${avgSteps7d >= 10000 ? 'objectif OMS atteint ✓' : avgSteps7d >= 7000 ? 'niveau modéré' : 'sédentarité à corriger'})`);
    if (avgActiveMinutes7d > 0) parts.push(`- Minutes actives moy/j : ${avgActiveMinutes7d} min (OMS recommande ≥ 30 min/j)`);
    if (parts.length === 1) return '';
    return '\n\n' + parts.join('\n');
  } catch {
    return '';
  }
}
