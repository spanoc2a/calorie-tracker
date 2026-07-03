import { createClient } from '@supabase/supabase-js';

// RLS is disabled on kv_store — anon key works server-side
// Upgrade to SUPABASE_SERVICE_ROLE_KEY once retrieved from Supabase Dashboard > Settings > API
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export const db = {
  async get(key) {
    const { data } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return data?.value ?? null;
  },

  async set(key, value) {
    // set(key, null) est utilisé partout comme « effacer » (déconnexion Strava/HC,
    // retrait de coach…) : on supprime réellement la ligne. Un upsert de null peut
    // échouer EN SILENCE (contrainte NOT NULL) et laisser l'ancienne valeur — vu en
    // prod : Strava « reconnecté » après déconnexion.
    if (value === null || value === undefined) {
      return this.del(key);
    }
    const { error } = await supabase
      .from('kv_store')
      .upsert({ key, value }, { onConflict: 'key' });
    if (error) console.error('kv set failed:', key, error.message);
  },

  async del(key) {
    await supabase
      .from('kv_store')
      .delete()
      .eq('key', key);
  },

  // Liste toutes les entrées dont la clé commence par `prefix` (kv_store = Postgres → LIKE).
  async listPrefix(prefix) {
    const { data } = await supabase
      .from('kv_store')
      .select('key,value')
      .like('key', escapeLike(prefix) + '%');
    return data || [];
  },

  // Lit plusieurs clés en UNE requête (chunks de 200). Renvoie une Map clé → valeur
  // (clés absentes = pas d'entrée). Sert à casser les N+1 (ex. dashboard coach).
  async getMany(keys) {
    const out = new Map();
    for (let i = 0; i < keys.length; i += 200) {
      const chunk = keys.slice(i, i + 200);
      const { data } = await supabase
        .from('kv_store')
        .select('key,value')
        .in('key', chunk);
      for (const row of data || []) out.set(row.key, row.value);
    }
    return out;
  },

  // Supprime toutes les entrées dont la clé commence par `prefix`.
  async deletePrefix(prefix) {
    await supabase
      .from('kv_store')
      .delete()
      .like('key', escapeLike(prefix) + '%');
  },
};

// Échappe les métacaractères LIKE (%, _) pour que le préfixe soit traité littéralement.
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, '\\$&');
}

export function userDb(userId) {
  return {
    async get(key) { return db.get(`u:${userId}:${key}`); },
    async set(key, value) { return db.set(`u:${userId}:${key}`, value); },
    async del(key) { return db.del(`u:${userId}:${key}`); },
  };
}
