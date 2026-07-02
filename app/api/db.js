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
    await supabase
      .from('kv_store')
      .upsert({ key, value }, { onConflict: 'key' });
  },

  async del(key) {
    await supabase
      .from('kv_store')
      .delete()
      .eq('key', key);
  },
};

export function userDb(userId) {
  return {
    async get(key) { return db.get(`u:${userId}:${key}`); },
    async set(key, value) { return db.set(`u:${userId}:${key}`, value); },
    async del(key) { return db.del(`u:${userId}:${key}`); },
  };
}
