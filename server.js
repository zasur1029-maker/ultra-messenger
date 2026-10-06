/**
 * Ultra Messenger — сервер v5.
 * PostgreSQL + WebSocket + загрузка файлов.
 */
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Папка для загрузок
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer — загрузка файлов
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }  // 100 МБ
});

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

// Инициализация схемы
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT,
        avatar TEXT,
        gradient TEXT,
        bio TEXT,
        created_at BIGINT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        gradient TEXT,
        avatar TEXT,
        participants JSONB,
        data JSONB,
        created_at BIGINT,
        updated_at BIGINT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT,
        author_id TEXT,
        author_name TEXT,
        text TEXT,
        type TEXT,
        attachments JSONB,
        reactions JSONB,
        data JSONB,
        status TEXT,
        created_at BIGINT
      );
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users_online (
        username TEXT PRIMARY KEY,
        online BOOLEAN,
        last_seen BIGINT
      );
    `);
    console.log('✅ PostgreSQL схема готова');
  } catch (e) {
    console.error('❌ Ошибка initDB:', e.message);
  }
}

// Middleware
app.use(express.json({ limit: '150mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === ЗАГРУЗКА ФАЙЛОВ ===
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file' });
    const filename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = Date.now() + '_' + filename;
    const finalPath = path.join(UPLOADS_DIR, finalName);
    fs.renameSync(file.path, finalPath);
    console.log('📤 Загружено:', finalName, (file.size / 1024 / 1024).toFixed(2), 'МБ');
    res.json({
      ok: true,
      url: '/uploads/' + finalName,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype
    });
  } catch (e) {
    console.error('Upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.use('/uploads', express.static(UPLOADS_DIR));

// Новый endpoint — сохранение base64 в БД
app.post('/api/upload-base64', async (req, res) => {
  try {
    const { dataUrl, name } = req.body;
    if (!dataUrl) return res.status(400).json({ error: 'No dataUrl' });

    const id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, data TEXT, created_at BIGINT)`
    );
    await pool.query(
      `INSERT INTO files (id, name, data, created_at) VALUES ($1, $2, $3, $4)`,
      [id, name || 'file', dataUrl, Date.now()]
    );

    console.log('📤 Base64 сохранён:', id, '(', (dataUrl.length / 1024).toFixed(1), 'KB )');
    res.json({ ok: true, url: '/api/file/' + id, id });
  } catch (e) {
    console.error('upload-base64:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Раздача файлов из БД
app.get('/api/file/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT data, name FROM files WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).send('Not found');
    const dataUrl = r.rows[0].data;

    console.log('[File] Запрос:', req.params.id, '| Первые 60 символов:', dataUrl.slice(0, 60));

    // Гибкий парсинг: находим ;base64, и берём всё после
    const base64Index = dataUrl.indexOf(';base64,');
    if (base64Index === -1) {
      console.error('[File] ❌ Нет ;base64, в dataUrl');
      return res.status(500).send('Invalid');
    }

    // MIME — между data: и ;base64,
    const mimeStart = dataUrl.indexOf(':') + 1;
    const mime = dataUrl.slice(mimeStart, base64Index).split(';')[0] || 'application/octet-stream';
    const base64 = dataUrl.slice(base64Index + 8);

    const buffer = Buffer.from(base64, 'base64');

    console.log('[File] ✅ MIME:', mime, '| Размер:', buffer.length, 'байт');

    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Content-Length', buffer.length);
    res.send(buffer);
  } catch (e) {
    console.error('[File] Ошибка:', e.message);
    res.status(500).send(e.message);
  }
});

// === API ===
app.get('/api/data', async (req, res) => {
  try {
    const users = (await pool.query('SELECT * FROM users')).rows;
    const chats = (await pool.query('SELECT * FROM chats')).rows;
    const messages = (await pool.query('SELECT * FROM messages ORDER BY created_at ASC')).rows;
    const online = (await pool.query('SELECT * FROM users_online')).rows;

    res.json({
      users: users.map((r) => ({
        id: r.id, username: r.username, name: r.name,
        avatar: r.avatar, gradient: r.gradient, bio: r.bio,
        createdAt: Number(r.created_at)
      })),
      chats: chats.map((r) => ({
        ...(r.data || {}), id: r.id, type: r.type, title: r.title,
        gradient: r.gradient, avatar: r.avatar,
        participants: r.participants,
        createdAt: Number(r.created_at), updatedAt: Number(r.updated_at)
      })),
      messages: messages.map((r) => ({
        ...(r.data || {}), id: r.id, chatId: r.chat_id,
        authorId: r.author_id, authorName: r.author_name,
        text: r.text, type: r.type,
        attachments: r.attachments, reactions: r.reactions,
        status: r.status, createdAt: Number(r.created_at)
      })),
      online: online.map((r) => ({ username: r.username, online: r.online, lastSeen: Number(r.last_seen) }))
    });
  } catch (e) {
    console.error('GET /api/data:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const u = req.body;
    await pool.query(
      `INSERT INTO users (id, username, name, avatar, gradient, bio, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (username) DO UPDATE SET
         name = EXCLUDED.name, avatar = EXCLUDED.avatar, gradient = EXCLUDED.gradient`,
      [u.id || u.username, u.username, u.name, u.avatar || null,
       u.gradient || null, u.bio || '', u.createdAt || Date.now()]
    );
    broadcast({ type: 'users:refresh' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/users:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const c = req.body;
    await pool.query(
      `INSERT INTO chats (id, type, title, gradient, avatar, participants, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, participants = EXCLUDED.participants,
         data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [c.id, c.type || 'personal', c.title, c.gradient || null, c.avatar || null,
       JSON.stringify(c.participants || []), JSON.stringify(c),
       c.createdAt || Date.now(), c.updatedAt || Date.now()]
    );
    broadcast({ type: 'chats:refresh' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/chats:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const m = req.body;
    const size = JSON.stringify(m).length;
    if (m.type !== 'text') console.log('POST /api/messages:', m.type, (size / 1024).toFixed(1), 'KB');

    await pool.query(
      `INSERT INTO messages (id, chat_id, author_id, author_name, text, type, attachments, reactions, data, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         text = EXCLUDED.text, reactions = EXCLUDED.reactions,
         status = EXCLUDED.status, attachments = EXCLUDED.attachments`,
      [m.id, m.chatId, m.authorId, m.authorName || null, m.text || '',
       m.type || 'text', JSON.stringify(m.attachments || []),
       JSON.stringify(m.reactions || {}), JSON.stringify(m),
       m.status || 'sent', m.createdAt || Date.now()]
    );
    broadcast({ type: 'messages:refresh' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/messages:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// === WebSocket ===
const clients = new Set();

wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log('Клиент подключён. Всего:', clients.size);

  // Отправляем полную базу
  try {
    const users = (await pool.query('SELECT * FROM users')).rows;
    const chats = (await pool.query('SELECT * FROM chats')).rows;
    const messages = (await pool.query('SELECT * FROM messages ORDER BY created_at ASC')).rows;

    ws.send(JSON.stringify({
      type: 'init',
      data: {
        users: users.map((r) => ({ ...r, createdAt: Number(r.created_at) })),
        chats: chats.map((r) => ({ ...(r.data || {}), id: r.id, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at) })),
        messages: messages.map((r) => ({ ...(r.data || {}), id: r.id, chatId: r.chat_id, createdAt: Number(r.created_at) })),
      }
    }));
  } catch (e) { console.error('Init error:', e.message); }

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Клиент отключён. Всего:', clients.size);
  });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ONLINE
    if (msg.type === 'online') {
      try {
        await pool.query(
          `INSERT INTO users_online (username, online, last_seen) VALUES ($1, $2, $3)
           ON CONFLICT (username) DO UPDATE SET online = EXCLUDED.online, last_seen = EXCLUDED.last_seen`,
          [msg.username, msg.online, Date.now()]
        );
      } catch (e) {}
      broadcast({ type: 'user:online', username: msg.username, online: msg.online }, ws);
      return;
    }

    // TYPING
    if (msg.type === 'typing') {
      broadcast({ type: 'user:typing', username: msg.username, chatId: msg.chatId, typing: msg.typing }, ws);
      return;
    }

    // MARK READ
    if (msg.type === 'mark-read') {
      try {
        await pool.query(
          `UPDATE messages SET status = 'read' WHERE chat_id = $1 AND author_id != $2 AND status != 'read'`,
          [msg.chatId, msg.readerId]
        );
      } catch (e) {}
      broadcast({ type: 'message:read', chatId: msg.chatId, readerId: msg.readerId }, ws);
      return;
    }

    // MESSAGE
    if (msg.type === 'message') {
      const m = msg.message;
      try {
        await pool.query(
          `INSERT INTO messages (id, chat_id, author_id, author_name, text, type, attachments, reactions, data, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [m.id, m.chatId, m.authorId, m.authorName, m.text,
           m.type || 'text', JSON.stringify(m.attachments || []),
           JSON.stringify(m.reactions || {}), JSON.stringify(m),
           m.status || 'sent', m.createdAt || Date.now()]
        );
      } catch (e) { console.error('Insert message:', e.message); }
      broadcast({ type: 'messages:update', message: m }, ws);
      return;
    }

    // CHAT
    if (msg.type === 'chat') {
      const c = msg.chat;
      try {
        await pool.query(
          `INSERT INTO chats (id, type, title, gradient, avatar, participants, data, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.type || 'personal', c.title, c.gradient, c.avatar,
           JSON.stringify(c.participants || []), JSON.stringify(c),
           c.createdAt || Date.now(), c.updatedAt || Date.now()]
        );
      } catch (e) {}
      broadcast({ type: 'chats:refresh' }, ws);
      return;
    }

    // USER
    if (msg.type === 'user') {
      const u = msg.user;
      try {
        await pool.query(
          `INSERT INTO users (id, username, name, avatar, gradient, bio, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, gradient = EXCLUDED.gradient`,
          [u.id || u.username, u.username, u.name, u.avatar || null,
           u.gradient || null, u.bio || '', u.createdAt || Date.now()]
        );
      } catch (e) {}
      broadcast({ type: 'users:refresh' }, ws);
      return;
    }

    // DRAWING
    if (msg.type === 'drawing') {
      const d = msg.drawing;
      try {
        await pool.query(
          `INSERT INTO drawings (id, chat_id, data, updated_at) VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
          [d.chatId, d.chatId, JSON.stringify(d.strokes || []), Date.now()]
        );
      } catch (e) {}
      broadcast({ type: 'drawings:update', chatId: d.chatId, strokes: d.strokes }, ws);
      return;
    }
  });
});

function broadcast(data, except = null) {
  const str = JSON.stringify(data);
  clients.forEach((c) => {
    if (c !== except && c.readyState === WebSocket.OPEN) c.send(str);
  });
}

// Раздача файлов приложения
app.use(express.static(__dirname));

// Запуск
initDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Ultra Messenger Server');
    console.log('Port:', PORT);
    console.log('DATABASE_URL:', !!process.env.DATABASE_URL);
  });
});
