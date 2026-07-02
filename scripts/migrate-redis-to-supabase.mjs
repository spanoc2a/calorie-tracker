/**
 * Migration : Redis (Upstash) → Supabase kv_store
 * Usage : node scripts/migrate-redis-to-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js';

const KV_URL   = 'https://adjusted-bison-101587.upstash.io';
const KV_TOKEN = 'gQAAAAAAAYzTAAIocDE1OGRhMWFjM2MyYjY0M2VmYTRmYjMyYjliMDUzYjQxYXAxMTAxNTg3';

const SUPABASE_URL  = 'https://yaswyihuwmeepislgfhw.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhc3d5aWh1d21lZXBpc2xnZmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDU3NDIsImV4cCI6MjA5NDMyMTc0Mn0.xjoMrEJEcxRkS7D4fPQuZ4iwo_0qsj_RAOwXjd4_FW4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function kvFetch(path) {
  const res = await fetch(`${KV_URL}${path}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Redis error: ${JSON.stringify(json)}`);
  return json.result;
}

async function scanAllKeys() {
  const keys = [];
  let cursor = 0;
  do {
    const result = await kvFetch(`/scan/${cursor}?count=200`);
    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);
  return keys;
}

async function getKey(key) {
  // Upstash returns the raw stored value (already JSON-serialized by @vercel/kv)
  const raw = await kvFetch(`/get/${encodeURIComponent(key)}`);
  if (raw === null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

async function main() {
  console.log('🔍  Scan des clés Redis...');
  const keys = await scanAllKeys();
  console.log(`✅  ${keys.length} clés trouvées\n`);

  let ok = 0, skip = 0, err = 0;

  // batch upsert par chunks de 200
  const CHUNK = 200;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const rows = [];

    for (const key of chunk) {
      const value = await getKey(key);
      if (value === null) { skip++; continue; }
      rows.push({ key, value });
    }

    if (rows.length === 0) continue;

    const { error } = await supabase
      .from('kv_store')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error(`❌  Batch ${i}–${i + CHUNK} échoué:`, error.message);
      err += rows.length;
    } else {
      ok += rows.length;
      console.log(`  ✔  ${ok} / ${keys.length} clés migrées...`);
    }
  }

  console.log(`\n🏁  Migration terminée — OK: ${ok}  |  Sautées (null): ${skip}  |  Erreurs: ${err}`);
}

main().catch(e => { console.error(e); process.exit(1); });
