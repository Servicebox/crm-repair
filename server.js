require('dotenv').config();

const express = require('express');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/masters', require('./routes/masters'));
app.use('/api/sources', require('./routes/sources'));
app.use('/api/statuses', require('./routes/statuses'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/custom-fields', require('./routes/customFields'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
    await initDatabase();
    app.listen(PORT, () => console.log(`🚀 Сервер запущен на http://localhost:${PORT}`));
}

start();