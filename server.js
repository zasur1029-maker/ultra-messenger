const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

let DB = { users: [], chats: [], messages: [] };
if (fs.existsSync(DB_FILE)) {
  try { DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
}

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2)); } catch {}
}

app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/data', (req, res) => res.json(DB));

app.post('/api/users', (req, res) => {
  const user = req.body;
  const existing = DB.users.find((u) => u.username === user.username);
  if (existing) Object.assign(existing, user);
  else DB.users.push(user);
  saveDB();
  broadcast({ type: 'users:update', users: DB.users });
  res.json({ ok: true });
});

app.post('/api/chats', (req, res) => {
  const chat = req.body;
  const existing = DB.chats.find((c) => c.id === chat.id);
  if (existing) Object.assign(existing, chat);
  else DB.chats.push(chat);
  saveDB();
  broadcast({ type: 'chats:update', chats: DB.chats });
  res.json({ ok: true });
});

app.post('/api/messages', (req, res) => {
  const msg = req.body;
  const existing = DB.messages.find((m) => m.id === msg.id);
  if (existing) Object.assign(existing, msg);
  else DB.messages.push(msg);
  saveDB();
  broadcast({ type: 'messages:update', message: msg });
  res.json({ ok: true });
});

const clients = new Set();
wss.on('connection', (ws) => {
  console.log('Client connected. Total:', clients.size + 1);
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'init', data: DB }));

  ws.on('close', () => clients.delete(ws));
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'message') {
        if (!DB.messages.find((m) => m.id === msg.message.id)) {
          DB.messages.push(msg.message);
          saveDB();
          broadcast({ type: 'messages:update', message: msg.message }, ws);
        }
      }
      if (msg.type === 'chat') {
        if (!DB.chats.find((c) => c.id === msg.chat.id)) {
          DB.chats.push(msg.chat);
          saveDB();
          broadcast({ type: 'chats:update', chats: DB.chats }, ws);
        }
      }
      if (msg.type === 'user') {
        if (!DB.users.find((u) => u.username === msg.user.username)) {
          DB.users.push(msg.user);
          saveDB();
          broadcast({ type: 'users:update', users: DB.users }, ws);
        }
      }
    } catch (e) {}
  });
});

function broadcast(data, except = null) {
  const str = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}

app.use(express.static(__dirname));

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ip = net.address;
    }
  }
  console.log('');
  console.log('🚀 Ultra Messenger Server');
  console.log('Local:   http://localhost:' + PORT);
  console.log('Network: http://' + ip + ':' + PORT);
  console.log('');
});
