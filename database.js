const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let sqlDb = null;
const dbPath = process.env.DATABASE_PATH || './data/crm.db';

function saveDatabase() {
  if (sqlDb) {
    try {
      const data = sqlDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {
      console.error('Error saving database:', e);
    }
  }
}

setInterval(saveDatabase, 30000);
process.on('exit', saveDatabase);
process.on('SIGINT', () => { saveDatabase(); process.exit(); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(); });

class DatabaseWrapper {
  constructor(database) {
    this.db = database;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        try {
          self.db.run(sql, params);
          const lastId = self.db.exec("SELECT last_insert_rowid() as id");
          const changes = self.db.getRowsModified();
          saveDatabase();
          return {
            lastInsertRowid: lastId[0]?.values[0]?.[0] || 0,
            changes: changes
          };
        } catch (e) {
          console.error('DB run error:', e, 'SQL:', sql, 'Params:', params);
          throw e;
        }
      },
      get(...params) {
        try {
          const stmt = self.db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          let result = undefined;
          if (stmt.step()) result = stmt.getAsObject();
          stmt.free();
          return result;
        } catch (e) {
          console.error('DB get error:', e, 'SQL:', sql, 'Params:', params);
          throw e;
        }
      },
      all(...params) {
        try {
          const results = [];
          const stmt = self.db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          while (stmt.step()) results.push(stmt.getAsObject());
          stmt.free();
          return results;
        } catch (e) {
          console.error('DB all error:', e, 'SQL:', sql, 'Params:', params);
          throw e;
        }
      }
    };
  }

  exec(sql) {
    try {
      this.db.run(sql);
      saveDatabase();
    } catch (e) {
      console.error('DB exec error:', e, 'SQL:', sql);
      throw e;
    }
  }
}

async function initDatabase() {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(fileBuffer);
    db = new DatabaseWrapper(sqlDb);
    console.log('✅ База данных загружена');

    // Миграция: удаляем city_id из таблицы orders, если она есть
    try {
      const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
      const hasCityId = tableInfo.some(col => col.name === 'city_id');
      if (hasCityId) {
        console.log('⚠️ Обнаружена старая структура БД. Пересоздаём таблицу orders без city_id...');
        // Создаём новую таблицу без city_id
        db.exec(`
          CREATE TABLE orders_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT,
            status_id INTEGER NOT NULL DEFAULT 1,
            source_id INTEGER,
            master_id INTEGER,
            manager_id INTEGER,
            address TEXT,
            metro TEXT,
            problem TEXT,
            comment TEXT,
            phone TEXT,
            client_name TEXT,
            scheduled_time TEXT,
            device_type TEXT,
            device_model TEXT,
            condition TEXT,
            accessories TEXT,
            recording_url TEXT,
            amount REAL,
            my_share REAL,
            master_share REAL,
            closed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Копируем данные (кроме city_id)
        db.exec(`
          INSERT INTO orders_new (
            id, order_number, status_id, source_id, master_id, manager_id,
            address, metro, problem, comment, phone, client_name, scheduled_time,
            device_type, device_model, condition, accessories, recording_url,
            amount, my_share, master_share, closed_at, created_at, updated_at
          )
          SELECT 
            id, order_number, status_id, source_id, master_id, manager_id,
            address, metro, problem, comment, phone, client_name, scheduled_time,
            device_type, device_model, condition, accessories, recording_url,
            amount, my_share, master_share, closed_at, created_at, updated_at
          FROM orders
        `);
        db.exec('DROP TABLE orders');
        db.exec('ALTER TABLE orders_new RENAME TO orders');
        console.log('✅ Таблица orders успешно обновлена');
      }
    } catch (e) {
      console.error('Ошибка миграции:', e);
    }
  } else {
    sqlDb = new SQL.Database();
    db = new DatabaseWrapper(sqlDb);
    console.log('✅ Создана новая база данных');
  }

  // Таблицы
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'manager',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  )`);

  const statusCount = db.prepare('SELECT COUNT(*) as count FROM statuses').get();
  if (statusCount.count === 0) {
    db.exec("INSERT INTO statuses (name, color, sort_order) VALUES ('Новый', '#3b82f6', 1)");
    db.exec("INSERT INTO statuses (name, color, sort_order) VALUES ('На созвоне', '#8b5cf6', 2)");
    db.exec("INSERT INTO statuses (name, color, sort_order) VALUES ('Ожидает мастера', '#eab308', 3)");
    db.exec("INSERT INTO statuses (name, color, sort_order) VALUES ('В работе', '#f97316', 4)");
    db.exec("INSERT INTO statuses (name, color, sort_order) VALUES ('Перенесён', '#6b7280', 5)");
    db.exec("INSERT INTO statuses (name, color, sort_order) VALUES ('Завершён', '#10b981', 6)");
  }

  db.exec(`CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const sourceCount = db.prepare('SELECT COUNT(*) as count FROM sources').get();
  if (sourceCount.count === 0) {
    db.exec("INSERT INTO sources (name) VALUES ('Авито')");
    db.exec("INSERT INTO sources (name) VALUES ('Сайт (Владислав)')");
    db.exec("INSERT INTO sources (name) VALUES ('Сайт (Андрей)')");
  }

  db.exec(`CREATE TABLE IF NOT EXISTS masters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_nick TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица orders уже создана или обновлена выше. Добавляем недостающие колонки.
  const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
  const columnNames = tableInfo.map(col => col.name);
  const neededColumns = ['order_number', 'recording_url', 'device_type', 'device_model', 'condition', 'accessories', 'manager_id'];
  for (const col of neededColumns) {
    if (!columnNames.includes(col)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col} TEXT`);
      console.log(`✅ Добавлена колонка ${col}`);
    }
  }

  // Генерация номеров для старых заказов
  const ordersWithoutNumber = db.prepare('SELECT id, created_at FROM orders WHERE order_number IS NULL ORDER BY created_at').all();
  if (ordersWithoutNumber.length > 0) {
    ordersWithoutNumber.forEach((order, index) => {
      const date = new Date(order.created_at);
      const year = String(date.getFullYear()).slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const num = String(index + 1).padStart(3, '0');
      const orderNumber = `${year}${month}-${num}`;
      db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(orderNumber, order.id);
    });
    console.log(`✅ Сгенерированы номера для ${ordersWithoutNumber.length} заказов`);
  }

  // Пользовательские поля
  db.exec(`CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    field_key TEXT UNIQUE NOT NULL,
    field_type TEXT NOT NULL,
    options TEXT,
    required BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS order_custom_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    field_key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE(order_id, field_key)
  )`);

  saveDatabase();
  console.log('✅ База данных инициализирована (без городов)');
  return db;
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };