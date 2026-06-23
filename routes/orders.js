const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const router = express.Router();

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
};

// Middleware для проверки прав на редактирование (только admin и manager)
const canEditMiddleware = (req, res, next) => {
    if (req.user.role === 'master') {
        return res.status(403).json({ error: 'Мастер не может редактировать заказы' });
    }
    next();
};

// Получить все заказы
router.get('/', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const orders = db.prepare(`
      SELECT o.*, 
        s.name as status_name, s.color as status_color,
        src.name as source_name,
        m.telegram_nick as master_nick,
        u.username as manager_name
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      LEFT JOIN sources src ON src.id = o.source_id
      LEFT JOIN masters m ON m.id = o.master_id
      LEFT JOIN users u ON u.id = o.manager_id
      ORDER BY o.created_at DESC
    `).all();
        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Ошибка получения заказов' });
    }
});

// Поиск по телефону
router.get('/by-phone/:phone', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { phone } = req.params;
        if (!phone || phone.length < 5) return res.json([]);
        const orders = db.prepare(`
      SELECT o.*, s.name as status_name, s.color as status_color
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      WHERE o.phone = ?
      ORDER BY o.created_at DESC LIMIT 10
    `).all(phone);
        res.json(orders);
    } catch (error) {
        console.error('Get orders by phone error:', error);
        res.status(500).json({ error: 'Ошибка получения истории' });
    }
});

// Поиск по тексту
router.get('/search', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);
        const searchTerm = `%${q}%`;
        const orders = db.prepare(`
      SELECT o.*, s.name as status_name, s.color as status_color
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      WHERE o.address LIKE ? OR o.phone LIKE ? OR o.client_name LIKE ? OR o.problem LIKE ? OR o.order_number LIKE ?
      ORDER BY o.created_at DESC LIMIT 50
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        res.json(orders);
    } catch (error) {
        console.error('Search orders error:', error);
        res.status(500).json({ error: 'Ошибка поиска' });
    }
});

// Получить один заказ
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const order = db.prepare(`
      SELECT o.*, 
        s.name as status_name, s.color as status_color,
        src.name as source_name,
        m.telegram_nick as master_nick,
        u.username as manager_name
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      LEFT JOIN sources src ON src.id = o.source_id
      LEFT JOIN masters m ON m.id = o.master_id
      LEFT JOIN users u ON u.id = o.manager_id
      WHERE o.id = ?
    `).get(id);
        if (!order) return res.status(404).json({ error: 'Заказ не найден' });
        const customValues = db.prepare('SELECT field_key, value FROM order_custom_values WHERE order_id = ?').all(id);
        const custom = {};
        customValues.forEach(v => custom[v.field_key] = v.value);
        order.custom_fields = custom;
        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Ошибка получения заказа' });
    }
});

// Создать заказ
router.post('/', authMiddleware, canEditMiddleware, (req, res) => {
    try {
        const db = getDb();
        const {
            source_id, master_id,
            address, metro, problem, comment,
            phone, client_name, scheduled_time, recording_url,
            device_type, device_model, condition, accessories,
            custom_fields = {}
        } = req.body;

        if (phone && phone.trim()) {
            const phoneRegex = /^\+7\d{10}$/;
            if (!phoneRegex.test(phone.trim())) {
                return res.status(400).json({ error: 'Телефон должен быть в формате +7XXXXXXXXXX' });
            }
        }

        const manager_id = req.user.userId;

        // Генерация номера заказа
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${year}${month}-`;
        const lastOrder = db.prepare(`SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1`).get(`${prefix}%`);
        let nextNum = 1;
        if (lastOrder && lastOrder.order_number) {
            const parts = lastOrder.order_number.split('-');
            if (parts.length === 2) nextNum = parseInt(parts[1], 10) + 1;
        }
        const orderNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;

        const result = db.prepare(`
      INSERT INTO orders (
        order_number, status_id, source_id, master_id, manager_id,
        address, metro, problem, comment,
        phone, client_name, scheduled_time, recording_url,
        device_type, device_model, condition, accessories
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            orderNumber, source_id || null, master_id || null, manager_id,
            address || null, metro || null, problem || null, comment || null,
            phone || null, client_name || null, scheduled_time || null, recording_url || null,
            device_type || null, device_model || null, condition || null, accessories || null
        );

        const orderId = result.lastInsertRowid;

        for (const [key, value] of Object.entries(custom_fields)) {
            if (value !== undefined && value !== '') {
                db.prepare(`INSERT INTO order_custom_values (order_id, field_key, value) VALUES (?, ?, ?)`).run(orderId, key, String(value));
            }
        }

        const order = db.prepare(`
      SELECT o.*, s.name as status_name, s.color as status_color,
             src.name as source_name, m.telegram_nick as master_nick,
             u.username as manager_name
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      LEFT JOIN sources src ON src.id = o.source_id
      LEFT JOIN masters m ON m.id = o.master_id
      LEFT JOIN users u ON u.id = o.manager_id
      WHERE o.id = ?
    `).get(orderId);

        res.json(order);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Ошибка создания заказа' });
    }
});

// Обновить заказ
router.put('/:id', authMiddleware, canEditMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const {
            source_id, master_id,
            address, metro, problem, comment,
            phone, client_name, scheduled_time, recording_url,
            device_type, device_model, condition, accessories,
            custom_fields = {}
        } = req.body;

        if (phone && phone.trim()) {
            const phoneRegex = /^\+7\d{10}$/;
            if (!phoneRegex.test(phone.trim())) {
                return res.status(400).json({ error: 'Телефон должен быть в формате +7XXXXXXXXXX' });
            }
        }

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Заказ не найден' });

        db.prepare(`
      UPDATE orders SET
        source_id = ?, master_id = ?,
        address = ?, metro = ?, problem = ?, comment = ?,
        phone = ?, client_name = ?, scheduled_time = ?, recording_url = ?,
        device_type = ?, device_model = ?, condition = ?, accessories = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
            source_id !== undefined ? source_id : order.source_id,
            master_id !== undefined ? master_id : order.master_id,
            address !== undefined ? address : order.address,
            metro !== undefined ? metro : order.metro,
            problem !== undefined ? problem : order.problem,
            comment !== undefined ? comment : order.comment,
            phone !== undefined ? phone : order.phone,
            client_name !== undefined ? client_name : order.client_name,
            scheduled_time !== undefined ? scheduled_time : order.scheduled_time,
            recording_url !== undefined ? recording_url : order.recording_url,
            device_type !== undefined ? device_type : order.device_type,
            device_model !== undefined ? device_model : order.device_model,
            condition !== undefined ? condition : order.condition,
            accessories !== undefined ? accessories : order.accessories,
            id
        );

        for (const [key, value] of Object.entries(custom_fields)) {
            if (value !== undefined && value !== '') {
                db.prepare(`INSERT OR REPLACE INTO order_custom_values (order_id, field_key, value) VALUES (?, ?, ?)`).run(id, key, String(value));
            } else {
                db.prepare(`DELETE FROM order_custom_values WHERE order_id = ? AND field_key = ?`).run(id, key);
            }
        }

        const updatedOrder = db.prepare(`
      SELECT o.*, s.name as status_name, s.color as status_color,
             src.name as source_name, m.telegram_nick as master_nick,
             u.username as manager_name
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      LEFT JOIN sources src ON src.id = o.source_id
      LEFT JOIN masters m ON m.id = o.master_id
      LEFT JOIN users u ON u.id = o.manager_id
      WHERE o.id = ?
    `).get(id);

        res.json(updatedOrder);
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Ошибка обновления заказа' });
    }
});

// Изменить статус
router.put('/:id/status', authMiddleware, canEditMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const { status_id, master_id } = req.body;

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Заказ не найден' });

        const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status_id);
        if (!status) return res.status(400).json({ error: 'Статус не найден' });

        const inWorkStatus = db.prepare(`SELECT * FROM statuses WHERE name = 'В работе'`).get();
        if (inWorkStatus && status_id === inWorkStatus.id && !order.master_id && !master_id) {
            return res.status(400).json({
                error: 'Укажите мастера для перевода в работу',
                requireMaster: true,
                orderId: id,
                statusId: status_id
            });
        }

        let masterId = master_id !== undefined ? master_id : order.master_id;
        if (masterId !== order.master_id) {
            db.prepare(`UPDATE orders SET master_id = ? WHERE id = ?`).run(masterId, id);
        }

        db.prepare(`UPDATE orders SET status_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status_id, id);

        const updatedOrder = db.prepare(`
      SELECT o.*, s.name as status_name, s.color as status_color,
             src.name as source_name, m.telegram_nick as master_nick,
             u.username as manager_name
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      LEFT JOIN sources src ON src.id = o.source_id
      LEFT JOIN masters m ON m.id = o.master_id
      LEFT JOIN users u ON u.id = o.manager_id
      WHERE o.id = ?
    `).get(id);

        res.json(updatedOrder);
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Ошибка обновления статуса' });
    }
});

// Закрыть заказ
router.put('/:id/close', authMiddleware, canEditMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const { amount } = req.body;

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Заказ не найден' });
        if (amount === undefined || amount < 0) return res.status(400).json({ error: 'Укажите сумму заказа' });

        const completedStatusId = 6;
        const myShare = amount / 2;
        const masterShare = amount / 2;

        db.prepare(`
      UPDATE orders SET status_id = ?, amount = ?, my_share = ?, master_share = ?,
      closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(completedStatusId, amount, myShare, masterShare, id);

        const updatedOrder = db.prepare(`
      SELECT o.*, s.name as status_name, s.color as status_color,
             src.name as source_name, m.telegram_nick as master_nick,
             u.username as manager_name
      FROM orders o
      LEFT JOIN statuses s ON s.id = o.status_id
      LEFT JOIN sources src ON src.id = o.source_id
      LEFT JOIN masters m ON m.id = o.master_id
      LEFT JOIN users u ON u.id = o.manager_id
      WHERE o.id = ?
    `).get(id);

        res.json(updatedOrder);
    } catch (error) {
        console.error('Close order error:', error);
        res.status(500).json({ error: 'Ошибка закрытия заказа' });
    }
});

// Удалить заказ
router.delete('/:id', authMiddleware, canEditMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) return res.status(404).json({ error: 'Заказ не найден' });
        db.prepare('DELETE FROM orders WHERE id = ?').run(id);
        res.json({ message: 'Заказ удалён' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ error: 'Ошибка удаления заказа' });
    }
});

module.exports = router;