import { userDb } from '../api/db';

// `extra` (optionnel) : champs supplémentaires fusionnés au niveau racine du message Expo
// (ex. { categoryId: 'log-meal' } pour les actions rapides iOS/Android). Rétro-compatible :
// les appels existants à 4 arguments sont inchangés.
export async function sendExpoPushToUser(userId, title, body, data = {}, extra = {}) {
  try {
    const token = await userDb(userId).get('expoPushToken');
    if (!token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'high', ...extra }),
    });
  } catch {}
}
