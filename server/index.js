import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const app = express();
const port = Number(process.env.PORT || 3001);
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', async (_req, res) => {
  if (!pool) return res.json({ status: 'ok', storage: 'local' });
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', storage: 'postgres' }); }
  catch { res.status(503).json({ status: 'database unavailable' }); }
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const ready = (req, res, next) => pool ? next() : res.status(503).json({ error: 'PostgreSQL is not configured. Set DATABASE_URL in .env.' });
const validExpense = (body) => body.title?.trim() && body.category?.trim() && Number.isFinite(Number(body.amount)) && Number(body.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(body.spent_on);

app.get('/api/expenses', ready, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, title, category, amount, TO_CHAR(spent_on, \'YYYY-MM-DD\') AS spent_on, payment_method, note FROM expenses ORDER BY spent_on DESC, id DESC');
  res.json(rows);
}));
app.post('/api/expenses', ready, asyncRoute(async (req, res) => {
  if (!validExpense(req.body)) return res.status(400).json({ error: 'Enter a title, category, positive amount, and valid date.' });
  const { title, category, amount, spent_on, payment_method = 'Card', note = '' } = req.body;
  const { rows } = await pool.query('INSERT INTO expenses (title, category, amount, spent_on, payment_method, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, category, amount, TO_CHAR(spent_on, \'YYYY-MM-DD\') AS spent_on, payment_method, note', [title.trim(), category.trim(), amount, spent_on, payment_method, note]);
  res.status(201).json(rows[0]);
}));
app.put('/api/expenses/:id', ready, asyncRoute(async (req, res) => {
  if (!validExpense(req.body)) return res.status(400).json({ error: 'Enter a title, category, positive amount, and valid date.' });
  const { title, category, amount, spent_on, payment_method = 'Card', note = '' } = req.body;
  const { rows } = await pool.query('UPDATE expenses SET title=$1, category=$2, amount=$3, spent_on=$4, payment_method=$5, note=$6 WHERE id=$7 RETURNING id, title, category, amount, TO_CHAR(spent_on, \'YYYY-MM-DD\') AS spent_on, payment_method, note', [title.trim(), category.trim(), amount, spent_on, payment_method, note, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found.' });
  res.json(rows[0]);
}));
app.delete('/api/expenses/:id', ready, asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Expense not found.' });
  res.status(204).end();
}));

app.get('/api/budgets', ready, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT category, amount FROM budgets ORDER BY category');
  res.json(rows);
}));
app.put('/api/budgets', ready, asyncRoute(async (req, res) => {
  if (!Array.isArray(req.body.budgets) || req.body.budgets.some((b) => !b.category?.trim() || !Number.isFinite(Number(b.amount)) || Number(b.amount) <= 0)) return res.status(400).json({ error: 'Every category needs a positive budget.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const budget of req.body.budgets) await client.query('INSERT INTO budgets(category, amount, updated_at) VALUES($1,$2,NOW()) ON CONFLICT(category) DO UPDATE SET amount=EXCLUDED.amount, updated_at=NOW()', [budget.category.trim(), budget.amount]);
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
  const { rows } = await pool.query('SELECT category, amount FROM budgets ORDER BY category');
  res.json(rows);
}));

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Something went wrong while saving your data.' });
});

if (process.env.NODE_ENV === 'production') {
  const { default: path } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(root));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));
}

const server = app.listen(port, () => console.log(`Pennywise API listening at http://localhost:${port}`));
async function shutdown() { server.close(); if (pool) await pool.end(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
