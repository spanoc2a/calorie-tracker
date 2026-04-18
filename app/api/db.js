import fs from 'fs';
import path from 'path';

// Production: use Vercel KV. Development: use local JSON file.
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const DB_PATH = path.join(process.cwd(), 'data.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return {}; }
}
function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

async function kvGet(key) {
  const { kv } = await import('@vercel/kv');
  return kv.get(key);
}
async function kvSet(key, value) {
  const { kv } = await import('@vercel/kv');
  return kv.set(key, value);
}

export const db = {
  async get(key) {
    if (useKV) return kvGet(key);
    return load()[key] ?? null;
  },
  async set(key, value) {
    if (useKV) return kvSet(key, value);
    const data = load();
    data[key] = value;
    save(data);
  },
};
