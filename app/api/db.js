import fs from 'fs';
import path from 'path';

const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const DB_PATH = path.join(process.cwd(), 'data.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return {}; }
}
function save(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

async function kvGet(key) { const { kv } = await import('@vercel/kv'); return kv.get(key); }
async function kvSet(key, value) { const { kv } = await import('@vercel/kv'); return kv.set(key, value); }
async function kvDel(key) { const { kv } = await import('@vercel/kv'); return kv.del(key); }

export const db = {
  async get(key) { if (useKV) return kvGet(key); return load()[key] ?? null; },
  async set(key, value) { if (useKV) return kvSet(key, value); const data = load(); data[key] = value; save(data); },
  async del(key) { if (useKV) return kvDel(key); const data = load(); delete data[key]; save(data); },
};

// Base de données scopée par utilisateur
// Fallback transparent sur les clés legacy (données existantes de l'utilisateur historique)
export function userDb(userId) {
  return {
    async get(key) { return db.get(`u:${userId}:${key}`); },
    async set(key, value) { return db.set(`u:${userId}:${key}`, value); },
    async del(key) { return db.del(`u:${userId}:${key}`); },
  };
}
