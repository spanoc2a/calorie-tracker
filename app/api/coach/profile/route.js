import { db, userDb } from '../../db';
import { requireAuth } from '../../auth/session';

// Profil coach : logo (marque blanche rapports), bio, spécialité + gestion du compte.
// Stocké dans userDb(coachId).coachProfile pour ne pas toucher au tableau global auth:users.

const MAX_LOGO_BYTES = 500 * 1024; // 500 Ko (le client doit redimensionner avant)
const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function validLogo(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return false;
  const m = dataUrl.match(/^data:([^;]+);base64,/);
  if (!m || !LOGO_MIME.includes(m[1])) return false;
  // taille approx du base64 décodé
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = Math.floor(b64.length * 3 / 4);
  return bytes <= MAX_LOGO_BYTES;
}

async function requireCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, me, users };
}

export async function GET(req) {
  const v = await requireCoach(req); if (v.error) return v.error;
  const profile = await userDb(v.coachId).get('coachProfile') || {};
  return Response.json({
    profile: {
      displayName: profile.displayName || v.me.name || '',
      logo: profile.logo || null,
      bio: profile.bio || '',
      specialty: profile.specialty || '',
      email: v.me.email || '',
    },
  });
}

export async function PATCH(req) {
  const v = await requireCoach(req); if (v.error) return v.error;
  const body = await req.json();
  const current = await userDb(v.coachId).get('coachProfile') || {};
  const next = { ...current };

  if ('logo' in body) {
    if (body.logo === null) next.logo = null;
    else if (validLogo(body.logo)) next.logo = body.logo;
    else return Response.json({ error: 'Logo invalide (PNG/JPG/WebP/SVG, max 500 Ko)' }, { status: 400 });
  }
  // Neutralise toute injection HTML à la source (le nom du coach finit dans le HTML du rapport → anti-XSS stocké).
  const noTags = s => s.replace(/[<>]/g, '');
  if (typeof body.displayName === 'string') next.displayName = noTags(body.displayName).trim().slice(0, 80);
  if (typeof body.bio === 'string') next.bio = noTags(body.bio).trim().slice(0, 500);
  if (typeof body.specialty === 'string') next.specialty = noTags(body.specialty).trim().slice(0, 120);

  await userDb(v.coachId).set('coachProfile', next);
  return Response.json({ ok: true, profile: next });
}

// Suppression de compte : retire le coach de auth:users, délie ses élèves (ils gardent
// leurs données → conversion possible en Pro), supprime ses liens. RGPD : droit à l'effacement.
export async function DELETE(req) {
  const v = await requireCoach(req); if (v.error) return v.error;
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'SUPPRIMER') return Response.json({ error: 'Confirmation requise' }, { status: 400 });

  // Délier tous les élèves (ils conservent leur historique)
  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  await Promise.all(athleteIds.map(async aId => {
    const cur = await userDb(aId).get('coachId');
    if (cur === v.coachId) await userDb(aId).del('coachId');
  }));

  // Supprimer le lien coach→élèves et le profil
  await db.del(`coach:${v.coachId}:athletes`);
  await userDb(v.coachId).del('coachProfile');

  // Retirer le coach du tableau global des utilisateurs
  const users = await db.get('auth:users') || [];
  await db.set('auth:users', users.filter(u => u.id !== v.coachId));

  return Response.json({ ok: true });
}
