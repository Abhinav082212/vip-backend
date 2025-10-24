// server.js
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

function queryDB(sql, values) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection({
      host: process.env.DB_HOST || 'sql12.freesqldatabase.com',
      user: process.env.DB_USER || 'sql12802679',
      password: process.env.DB_PASS || '4MILvy77BL',
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

// Validate VIP by serial_number only
app.post('/vipvalidate', async (req, res) => {
  const serial = (req.body.serial || req.body.qr || '').trim();
  if (!serial) return res.send({ status: 'error', msg: 'Serial number missing' });

  try {
    const rows = await queryDB('SELECT * FROM vip_guests WHERE serial_number = ?', [serial]);
    if (!rows || rows.length === 0) {
      return res.send({ status: 'invalid', msg: '❌ Serial not found' });
    }

    const guest = rows[0];

    if (guest.entered) {
      return res.send({ status: 'used', msg: `❌ Serial ${serial} — Already scanned` });
    }

    // mark as entered
    await queryDB('UPDATE vip_guests SET entered = 1 WHERE id = ?', [guest.id]);

    return res.send({
      status: 'ok',
      msg: `🎉 CSE[AI&ML] Welcomes! you to Tech Fiesta event 2025.`
    });
  } catch (err) {
    console.error('DB error:', err && err.message ? err.message : err);
    return res.send({ status: 'error', msg: 'Database error' });
  }
});

app.get('/health', (req, res) => res.send({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VIP server listening on port ${PORT}`));


