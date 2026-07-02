import { userDb } from '../api/db';

export async function sendExpoPushToUser(userId, title, body, data = {}) {
  try {
    const token = await userDb(userId).get('expoPushToken');
    if (!token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'high' }),
    });
  } catch {}
}
