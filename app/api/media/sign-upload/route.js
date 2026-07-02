import { requireAuth } from '../../auth/session';
import { signUpload } from '../../../lib/storage';

export const maxDuration = 30;

const EXT = {
  photo: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  video: ['mp4', 'mov', 'm4v'],
};

// L'élève demande une URL signée pour uploader directement vers Supabase Storage.
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { type, ext } = await req.json().catch(() => ({}));
  if (!['photo', 'video'].includes(type)) return Response.json({ error: 'type invalide' }, { status: 400 });
  const e = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!EXT[type].includes(e)) return Response.json({ error: 'extension invalide' }, { status: 400 });

  const mediaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${auth.userId}/${type}/${mediaId}.${e}`;
  try {
    const up = await signUpload(path); // { signedUrl, token, path }
    let uploadUrl = up.signedUrl;
    if (uploadUrl && !/^https?:\/\//.test(uploadUrl)) {
      const base = (process.env.SUPABASE_STORAGE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
      uploadUrl = `${base}/storage/v1${uploadUrl.startsWith('/') ? '' : '/'}${uploadUrl}`;
    }
    return Response.json({ uploadUrl, token: up.token, storedPath: path, mediaId, type });
  } catch {
    return Response.json({ error: 'Stockage indisponible (vérifier SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 });
  }
}
