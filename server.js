/**
 * GRAVITY POS — Shared Database Server
 * Serves as the central data hub for all store terminals.
 * Run once per network; all HTML clients point to this server.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, 'db.json');

// ── Seed database if not exists ──────────────────────────────────────────────
const SEED = {
  meta: { version: 1, lastSync: new Date().toISOString() },
  stores: [
    { id: 'store-001', name: 'Gravity — Mayfair', location: 'London, UK' },
    { id: 'store-002', name: 'Gravity — 5th Avenue', location: 'New York, USA' },
    { id: 'store-003', name: 'Gravity — Ginza', location: 'Tokyo, JP' }
  ],
  products: [
    { id: 'p001', sku: 'GRV-001', name: 'Obsidian Tote', category: 'Bags', price: 2800, cost: 820, stock: 12, image: '🖤' },
    { id: 'p002', sku: 'GRV-002', name: 'Silk Scarf Noir', category: 'Accessories', price: 650, cost: 120, stock: 34, image: '🪬' },
    { id: 'p003', sku: 'GRV-003', name: 'Cashmere Overcoat', category: 'Outerwear', price: 4200, cost: 1400, stock: 6, image: '🧥' },
    { id: 'p004', sku: 'GRV-004', name: 'Velvet Evening Bag', category: 'Bags', price: 1950, cost: 560, stock: 9, image: '👜' },
    { id: 'p005', sku: 'GRV-005', name: 'Gold Cuff Bracelet', category: 'Jewellery', price: 3400, cost: 980, stock: 5, image: '⭕' },
    { id: 'p006', sku: 'GRV-006', name: 'Leather Gloves', category: 'Accessories', price: 480, cost: 130, stock: 20, image: '🧤' },
    { id: 'p007', sku: 'GRV-007', name: 'Suede Loafers', category: 'Footwear', price: 1100, cost: 340, stock: 14, image: '👞' },
    { id: 'p008', sku: 'GRV-008', name: 'Merino Wrap', category: 'Accessories', price: 890, cost: 210, stock: 18, image: '🧣' },
    { id: 'p009', sku: 'GRV-009', name: 'Crystal Hairpin Set', category: 'Accessories', price: 320, cost: 80, stock: 40, image: '✨' },
    { id: 'p010', sku: 'GRV-010', name: 'Lambskin Wallet', category: 'Accessories', price: 740, cost: 195, stock: 22, image: '💳' },
    { id: 'p011', sku: 'GRV-011', name: 'Satin Heels', category: 'Footwear', price: 1350, cost: 420, stock: 8, image: '👠' },
    { id: 'p012', sku: 'GRV-012', name: 'Pearl Earrings', category: 'Jewellery', price: 2100, cost: 610, stock: 11, image: '🔘' }
  ],
  customers: [
    { id: 'c001', name: 'Isabelle Fontaine', email: 'i.fontaine@email.com', phone: '+44 7700 900123', tier: 'Noir', totalSpend: 28400, visits: 14 },
    { id: 'c002', name: 'Marcus Chen', email: 'm.chen@email.com', phone: '+1 212 555 0191', tier: 'Obsidian', totalSpend: 67200, visits: 31 },
    { id: 'c003', name: 'Sophia Adeyemi', email: 's.adeyemi@email.com', phone: '+44 7911 223344', tier: 'Platinum', totalSpend: 12800, visits: 7 },
    { id: 'c004', name: 'Riku Tanaka', email: 'r.tanaka@email.com', phone: '+81 3 1234 5678', tier: 'Noir', totalSpend: 19600, visits: 9 }
  ],
  transactions: [],
  staff: [
    { id: 'staff-001', name: 'Amélie Rousseau', pin: '1234', role: 'Manager', storeId: 'store-001' },
    { id: 'staff-002', name: 'James Hartley', pin: '5678', role: 'Associate', storeId: 'store-001' },
    { id: 'staff-003', name: 'Yuki Mori', pin: '9012', role: 'Associate', storeId: 'store-003' }
  ]
};

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(SEED, null, 2));
  console.log('✦ Database seeded at', DB_FILE);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  data.meta.lastSync = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

// ── Router ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') { send(res, 200, {}); return; }

  // GET / — healthcheck / root ping (Railway and similar hosts probe this)
  if (method === 'GET' && parts.length === 0) {
    send(res, 200, { status: 'ok', service: 'gravity-pos-server' }); return;
  }

  const db = readDB();

  // GET /db — full database snapshot
  if (method === 'GET' && parts[0] === 'db') {
    send(res, 200, db); return;
  }

  // GET /products
  if (method === 'GET' && parts[0] === 'products') {
    send(res, 200, db.products); return;
  }

  // GET /customers
  if (method === 'GET' && parts[0] === 'customers') {
    const q = url.searchParams.get('q');
    const list = q
      ? db.customers.filter(c =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.email.toLowerCase().includes(q.toLowerCase()))
      : db.customers;
    send(res, 200, list); return;
  }

  // POST /customers
  if (method === 'POST' && parts[0] === 'customers') {
    const body = await parseBody(req);
    const customer = { id: `c${Date.now()}`, tier: 'Platinum', totalSpend: 0, visits: 0, ...body };
    db.customers.push(customer);
    writeDB(db);
    send(res, 201, customer); return;
  }

  // GET /transactions
  if (method === 'GET' && parts[0] === 'transactions') {
    const storeId = url.searchParams.get('storeId');
    const list = storeId
      ? db.transactions.filter(t => t.storeId === storeId)
      : db.transactions;
    send(res, 200, list); return;
  }

  // POST /transactions — create new sale
  if (method === 'POST' && parts[0] === 'transactions') {
    const body = await parseBody(req);
    const txn = {
      id: `txn-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...body
    };
    db.transactions.push(txn);

    // Update stock
    if (txn.items) {
      txn.items.forEach(item => {
        const product = db.products.find(p => p.id === item.productId);
        if (product) product.stock = Math.max(0, product.stock - item.qty);
      });
    }

    // Update customer spend
    if (txn.customerId) {
      const customer = db.customers.find(c => c.id === txn.customerId);
      if (customer) {
        customer.totalSpend += txn.total || 0;
        customer.visits += 1;
        // Tier upgrade logic
        if (customer.totalSpend > 50000) customer.tier = 'Obsidian';
        else if (customer.totalSpend > 20000) customer.tier = 'Noir';
      }
    }

    writeDB(db);
    send(res, 201, txn); return;
  }

  // PUT /products/:id — update stock manually
  if (method === 'PUT' && parts[0] === 'products' && parts[1]) {
    const body = await parseBody(req);
    const idx = db.products.findIndex(p => p.id === parts[1]);
    if (idx === -1) { send(res, 404, { error: 'Not found' }); return; }
    db.products[idx] = { ...db.products[idx], ...body };
    writeDB(db);
    send(res, 200, db.products[idx]); return;
  }

  // GET /stores
  if (method === 'GET' && parts[0] === 'stores') {
    send(res, 200, db.stores); return;
  }

  // GET /staff/:pin — authenticate staff
  if (method === 'GET' && parts[0] === 'staff' && parts[1]) {
    const member = db.staff.find(s => s.pin === parts[1]);
    if (member) send(res, 200, member);
    else send(res, 404, { error: 'Invalid PIN' });
    return;
  }

  // GET /dashboard — analytics summary
  if (method === 'GET' && parts[0] === 'dashboard') {
    const today = new Date().toDateString();
    const todayTxns = db.transactions.filter(t => new Date(t.timestamp).toDateString() === today);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekTxns = db.transactions.filter(t => new Date(t.timestamp) >= weekAgo);

    send(res, 200, {
      todaySales: todayTxns.reduce((s, t) => s + (t.total || 0), 0),
      todayTransactions: todayTxns.length,
      weekSales: weekTxns.reduce((s, t) => s + (t.total || 0), 0),
      totalCustomers: db.customers.length,
      lowStock: db.products.filter(p => p.stock < 5),
      topProducts: db.products.slice(0, 5)
    });
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         GRAVITY POS — SERVER          ║
║  Shared Database Node  •  Port ${PORT}   ║
╚═══════════════════════════════════════╝
  → http://localhost:${PORT}/db
  → Database: ${DB_FILE}

  Point all store terminals to:
  https://<your-railway-domain>
`);
});
