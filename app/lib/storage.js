import { createClient } from '@supabase/supabase-js';

// Stockage objet (photos/vidéos de suivi) — Supabase Storage.
// Variables DÉDIÉES (isolées de db.js/KV) : SUPABASE_STORAGE_URL + SUPABASE_STORAGE_KEY
// doivent former une paire cohérente (même projet) avec une clé service_role.
// Fallback sur les vars principales si non définies.
const supabase = createClient(
  process.env.SUPABASE_STORAGE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_STORAGE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export const BUCKET = 'coach-media';
let bucketReady = false;

export async function ensureBucket() {
  if (bucketReady) return;
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (!data) {
      await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 52428800 }); // 50 Mo (plafond free tier)
    }
  } catch {
    // createBucket peut échouer si déjà créé (course) — on continue
  }
  bucketReady = true;
}

export async function signUpload(path) {
  await ensureBucket();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data; // { signedUrl, token, path }
}

export async function signRead(path, ttl = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function removeFiles(paths) {
  const clean = (paths || []).filter(Boolean);
  if (!clean.length) return;
  try { await supabase.storage.from(BUCKET).remove(clean); } catch {}
}
