// server.js
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ---- Helper to run a single query (new connection each time) ----
function queryDB(sql, values) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST || 'sql12.freesqldatabase.com',
      user: process.env.DB_USER || 'sql12802679',
      password: process.env.DB_PASS || 'YOUR_DB_PASSWORD', // replace locally or use env vars
      database: process.env.DB_NAME || 'sql12802679',
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000
    });

    connection.connect(err => {
      if (err) return reject(err);
      connection.query(sql, values, (err, results) => {
        connection.end();
        if (err) return reject(err);
        resolve(results);
      });
    });
  });
}

// ---- Endpoint to validate VIP by name+role or name only ----
app.post('/vipvalidate', async (req, res) => {
  // Accept either { name, role } or a single `qr` string (scanned string)
  const body = req.body || {};
  let name = (body.name || '').trim();
  let role = (body.role || '').trim();
  const qr = (body.qr || '').trim();
  const raw = (body.code || body.qr_code || '').trim(); // backward compat

  // If client sent a raw scanned string (code), try to parse JSON:
  if (!name && raw) {
    try {
      const parsed = JSON.parse(raw);
      name = (parsed.name || '').trim();
      role = (parsed.role || '').trim();
    } catch (e) {
      // treat raw as plain name
      if (!name) name = raw;
    }
  }

  // If qr field sent
  if (!name && qr) {
    try {
      const parsed = JSON.parse(qr);
      name = (parsed.name || '').trim();
      role = (parsed.role || '').trim();
    } catch (e) {
      name = qr;
    }
  }

  if (!name) return res.send({ status: 'error', msg: 'Name missing from QR' });

  try {
    // 1) If role provided => lookup both name+role
    let rows;
    if (role) {
      rows = await queryDB('SELECT * FROM vip_guests WHERE name = ? AND role = ?', [name, role]);
    } else {
      // 2) If role not provided => lookup by name only (case-insensitive)
      rows = await queryDB('SELECT * FROM vip_guests WHERE name = ?', [name]);
    }

    if (!rows || rows.length === 0) {
      return res.send({ status: 'invalid', msg: '❌ VIP not found' });
    }

    const guest = rows[0];

    if (guest.entered) {
      return res.send({ status: 'used', msg: `❌ ${guest.name} (${guest.role}) — Already scanned` });
    }

    // mark as entered
    await queryDB('UPDATE vip_guests SET entered = 1 WHERE id = ?', [guest.id]);

    return res.send({
      status: 'ok',
      msg: `🎉 Welcome ${guest.name}! The AIML Department warmly welcomes you, our respected ${guest.role}!`
    });

  } catch (err) {
    console.error('DB error:', err && err.message ? err.message : err);
    return res.send({ status: 'error', msg: 'Database error' });
  }
});

// health
app.get('/health', (req, res) => res.send({ status: 'ok' }));

// serve static if you want (not required)
// app.use(express.static(__dirname));

// start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VIP server listening on port ${PORT}`));
