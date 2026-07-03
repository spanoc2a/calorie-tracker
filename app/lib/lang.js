import { userDb } from '../api/db';

// Langues servies par les textes serveur (pushes, erreurs, templates par défaut).
// fr = défaut/fallback. Les routes IA peuvent supporter plus large (de/pt/it) via
// leur detectLang local historique — inchangé.
export const SUPPORTED_LANGS = ['fr', 'en', 'es'];

export const LANG_NAMES = { fr: 'français', en: 'English', es: 'español' };

// Normalise une valeur de langue ('en-US', 'ES', 'fr,en;q=0.9'…) → 'fr'|'en'|'es'|null.
export function normalizeLang(l) {
  const v = String(l || '').split(',')[0].split('-')[0].trim().toLowerCase();
  return SUPPORTED_LANGS.includes(v) ? v : null;
}

// Langue d'une requête entrante : header Accept-Language (envoyé par apiFetch mobile).
export function detectLang(req) {
  return normalizeLang(req.headers.get('accept-language')) || 'fr';
}

// Langue persistée d'un user (userSettings.lang, posé par POST /api/settings).
// À utiliser pour les crons/pushes SANS requête entrante, et pour tout push dont le
// DESTINATAIRE n'est pas l'émetteur de la requête. Fallback 'fr'.
export async function getUserLang(userId) {
  try {
    const settings = await userDb(userId).get('userSettings');
    return normalizeLang(settings?.lang) || 'fr';
  } catch {
    return 'fr';
  }
}

// Instruction de langue à concaténer aux prompts IA (générations serveur/cron).
export function aiLangInstr(lang) {
  return lang && lang !== 'fr'
    ? `\nIMPORTANT: Write ALL user-facing text of your response in ${LANG_NAMES[lang] || 'English'}.`
    : '';
}
