const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
    try {
        const db = getDb();
        const fields = db.prepare('SELECT * FROM custom_fields ORDER BY sort_order').all();
        res.json(fields);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка получения полей' });
    }
});

router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { name, field_key, field_type, options, required } = req.body;
        if (!name || !field_key || !field_type) return res.status(400).json({ error: 'Название, ключ и тип обязательны' });
        const existing = db.prepare('SELECT id FROM custom_fields WHERE field_key = ?').get(field_key);
        if (existing) return res.status(400).json({ error: 'Поле с таким ключом уже существует' });
        const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM custom_fields').get();
        const sortOrder = (maxOrder.max || 0) + 1;
        const result = db.prepare(`INSERT INTO custom_fields (name, field_key, field_type, options, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(name, field_key, field_type, options ? JSON.stringify(options) : null, required ? 1 : 0, sortOrder);
        const newField = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(result.lastInsertRowid);
        res.json(newField);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка создания поля' });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const field = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(id);
        if (!field) return res.status(404).json({ error: 'Поле не найдено' });
        db.prepare('DELETE FROM order_custom_values WHERE field_key = ?').run(field.field_key);
        db.prepare('DELETE FROM custom_fields WHERE id = ?').run(id);
        res.json({ message: 'Поле удалено' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка удаления поля' });
    }
});

module.exports = router;