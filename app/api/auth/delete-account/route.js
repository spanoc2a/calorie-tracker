import crypto from 'crypto';
import { db, userDb } from '../../db';
import { requireAuth } from '../session';

const ITERATIONS = 100_000;
function hashPassword(password, salt, iterations = ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
}

const STATIC_KEYS = [
  'userSettings', 'coachId', 'weightLog', 'bloodTests', 'pendingBloodFiles',
  'reportHistory', 'goalsHistory', 'ingredientLibrary', 'strava:token',
  'stravaCache', 'reportRequest', 'coachNotifications', 'coachPrograms',
  'coachMuscuPrograms', 'savedRecipes', 'nutritionProgram', 'muscuProgram',
];

function getDatesRange(days) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  if (auth.isViewAs) return Response.json({ error: 'Non autorisé' }, { status: 403 });

  const { password } = await req.json().catch(() => ({}));
  if (!password) return Response.json({ error: 'Mot de passe requis' }, { status: 400 });

  const users = await db.get('auth:users') || [];
  const user = users.find(u => u.id === auth.userId);
  if (!user || hashPassword(password, user.salt, user.iterations || ITERATIONS) !== user.passwordHash) {
    return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }

  const userId = auth.userId;
  const udb = userDb(userId);

  // Supprimer les clés statiques
  await Promise.all(STATIC_KEYS.map(k => udb.del(k)));

  // Supprimer les entrées quotidiennes (2 ans)
  const dates = getDatesRange(730);
  await Promise.all(dates.flatMap(d => [udb.del(`day:${d}`), udb.del(`water:${d}`)]));

  // Supprimer les séances muscu (365 jours)
  await Promise.all(getDatesRange(365).map(d => udb.del(`muscu:${d}`)));

  // Retirer de auth:users
  await db.set('auth:users', users.filter(u => u.id !== userId));

  // Retirer des listes de coaches
  const coachId = await udb.get('coachId').catch(() => null);
  if (coachId) {
    const athleteIds = await db.get(`coach:${coachId}:athletes`) || [];
    await db.set(`coach:${coachId}:athletes`, athleteIds.filter(id => id !== userId));
  }

  return Response.json({ ok: true }, {
    headers: {
      'Set-Cookie': [
        'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'viewAs=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      ].join(', '),
    },
  });
}
