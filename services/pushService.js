import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

export async function sendPushToUser(userId, payload) {
  const subs = await PushSubscription.find({ userId });
  return sendToSubs(subs, payload);
}

export async function sendPushToAll(payload) {
  const subs = await PushSubscription.find();
  return sendToSubs(subs, payload);
}

async function sendToSubs(subs, payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, body)));
  const toDelete = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = r.reason?.statusCode;
      if (code === 404 || code === 410) toDelete.push(subs[i].endpoint);
    }
  });
  if (toDelete.length) await PushSubscription.deleteMany({ endpoint: { $in: toDelete } });
  return { sent: subs.length - toDelete.length, removed: toDelete.length };
}
