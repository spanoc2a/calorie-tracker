import { db } from '../db';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes('@')) return Response.json({ error: 'Email invalide' }, { status: 400 });
    const normalized = email.toLowerCase().trim();
    const list = await db.get('waitlist:emails') || [];
    const already = list.includes(normalized);
    if (!already) await db.set('waitlist:emails', [...list, normalized]);
    return Response.json({ ok: true, already });
  } catch {
    return Response.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
