import { db } from './db';

// Magasin utilisateurs scalable (2026-07-02).
// Avant : TOUS les users dans un seul blob JSON `auth:users` (read-modify-write global
// → écritures perdues en concurrence, téléchargé entier sur chaque requête via getUserWithPlan).
// Après : 1 enregistrement par user + index email :
//   user:<id>        → objet user (source de vérité)
//   useremail:<email> → id (email en minuscules)
// `auth:users` n'est PLUS écrit (sauf retrait à la suppression de compte, pour que le
// fallback legacy ne ressuscite pas un compte supprimé). Fallback legacy auto-migrant :
// un user encore absent de user:<id> est recopié depuis le blob à la première lecture.

const norm = (email) => String(email || '').toLowerCase().trim();

async function lazyMigrate(user) {
  if (!user?.id) return null;
  await db.set(`user:${user.id}`, user);
  if (user.email) await db.set(`useremail:${norm(user.email)}`, user.id);
  return user;
}

export async function getUser(id) {
  if (!id) return null;
  const u = await db.get(`user:${id}`);
  if (u) return u;
  const legacy = (await db.get('auth:users')) || [];
  const found = legacy.find((x) => x.id === id);
  return found ? lazyMigrate(found) : null;
}

export async function getUserByEmail(email) {
  const e = norm(email);
  if (!e) return null;
  const id = await db.get(`useremail:${e}`);
  if (id) {
    const u = await db.get(`user:${id}`);
    if (u) return u;
  }
  const legacy = (await db.get('auth:users')) || [];
  const found = legacy.find((x) => norm(x.email) === e);
  return found ? lazyMigrate(found) : null;
}

export async function createUser(user) {
  await db.set(`user:${user.id}`, user);
  if (user.email) await db.set(`useremail:${norm(user.email)}`, user.id);
  return user;
}

// Merge superficiel. RMW limité à UN user (conflit concurrent improbable et borné,
// contrairement à l'ancien blob global).
export async function updateUser(id, patch) {
  const current = await getUser(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (patch.email && norm(patch.email) !== norm(current.email)) {
    if (current.email) await db.del(`useremail:${norm(current.email)}`);
    await db.set(`useremail:${norm(patch.email)}`, id);
    next.email = norm(patch.email);
  }
  await db.set(`user:${id}`, next);
  return next;
}

// Tous les users (crons, recherche de coachs). Une seule requête LIKE — OK jusqu'à
// plusieurs milliers de lignes ; au-delà, paginer ici sans toucher les appelants.
export async function listUsers() {
  const rows = await db.listPrefix('user:');
  if (rows.length) return rows.map((r) => r.value).filter(Boolean);
  return (await db.get('auth:users')) || [];
}

export async function deleteUser(id) {
  const u = await getUser(id);
  await db.del(`user:${id}`);
  if (u?.email) await db.del(`useremail:${norm(u.email)}`);
  // Retire aussi du blob legacy, sinon le fallback de getUser le ressusciterait.
  const legacy = await db.get('auth:users');
  if (Array.isArray(legacy) && legacy.some((x) => x.id === id)) {
    await db.set('auth:users', legacy.filter((x) => x.id !== id));
  }
}
