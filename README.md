# 🔧 CRM - Система управления заказами на ремонт

Простая и удобная CRM система для агрегаторов заказов на ремонт компьютеров.

## ✨ Возможности

- 📋 **Канбан-доски** - отдельная доска для каждого города
- 🔄 **Drag-and-drop** - перетаскивание заказов между статусами
- 👨‍🔧 **Учёт мастеров** - автодополнение по нику в Telegram
- 💰 **Финансы** - автоматический расчёт 50/50 при закрытии заказа
- 📊 **Статистика** - за день, неделю, месяц и всё время
- 🔐 **Авторизация** - JWT токены, безопасный вход
- 📱 **Мобильная версия** - PWA, можно установить как приложение
- 🔍 **Поиск** - по адресу, телефону, имени клиента

## 🚀 Быстрый старт (локально)

### 1. Установите зависимости

```bash
cd срм
npm install
```

### 2. Настройте переменные окружения

```bash
# Скопируйте и отредактируйте .env файл
cp .env.example .env
```

Важно: измените `JWT_SECRET` на свой секретный ключ!

### 3. Запустите сервер

```bash
npm run dev
```

### 4. Откройте в браузере

```
http://localhost:3000
```

При первом входе создайте аккаунт (только один пользователь).

## ⚡ Быстрая установка на сервер (Ubuntu)

**Одна команда - и всё готово:**

```bash
curl -sSL https://raw.githubusercontent.com/inersu-msk/crm-repair/main/install.sh | sudo bash
```

Скрипт автоматически:
- ✅ Установит Node.js 20
- ✅ Установит Nginx
- ✅ Скопирует файлы в `/var/www/crm`
- ✅ Создаст systemd сервис
- ✅ Настроит прокси через Nginx
- ✅ Сгенерирует уникальный JWT_SECRET

## 🖥️ Ручной деплой на Ubuntu сервер

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка build-essential для native модулей
sudo apt install -y build-essential python3

# Установка Nginx
sudo apt install -y nginx

# Установка certbot для SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Копирование проекта

```bash
# Создаём директорию
sudo mkdir -p /var/www/crm
sudo chown $USER:$USER /var/www/crm

# Копируем файлы (через scp, git или вручную)
# scp -r ./* user@server:/var/www/crm/
```

### 3. Установка зависимостей на сервере

```bash
cd /var/www/crm
npm install --production
```

### 4. Настройка .env

```bash
cp .env.example .env
nano .env
```

Измените:
- `JWT_SECRET` - сгенерируйте надёжный ключ: `openssl rand -hex 32`
- `PORT` - порт (по умолчанию 3000)

### 5. Настройка systemd сервиса

```bash
# Копируем файл сервиса
sudo cp deploy/crm.service /etc/systemd/system/

# Обновляем путь если нужно
sudo nano /etc/systemd/system/crm.service

# Включаем и запускаем
sudo systemctl daemon-reload
sudo systemctl enable crm
sudo systemctl start crm

# Проверяем статус
sudo systemctl status crm
```

### 6. Настройка Nginx

```bash
# Копируем конфиг
sudo cp deploy/nginx.conf /etc/nginx/sites-available/crm

# Редактируем домен
sudo nano /etc/nginx/sites-available/crm
# Замените your-domain.com на ваш домен

# Создаём символическую ссылку
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Проверяем конфигурацию
sudo nginx -t

# Перезагружаем Nginx
sudo systemctl reload nginx
```

### 7. Настройка SSL (HTTPS)

```bash
# Получаем сертификат
sudo certbot --nginx -d your-domain.com

# Certbot автоматически обновит конфиг Nginx
```

### 8. Готово!

Откройте `https://your-domain.com` в браузере.

## 📁 Структура проекта

```
срм/
├── server.js          # Точка входа сервера
├── database.js        # Инициализация SQLite
├── package.json       # Зависимости
├── .env               # Переменные окружения
├── routes/            # API маршруты
│   ├── auth.js
│   ├── cities.js
│   ├── orders.js
│   ├── masters.js
│   ├── sources.js
│   ├── statuses.js
│   └── stats.js
├── middleware/        # Middleware
│   └── auth.js
├── public/            # Статические файлы
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       ├── kanban.js
│       └── app.js
├── data/              # База данных (создаётся автоматически)
│   └── crm.db
└── deploy/            # Файлы для деплоя
    ├── nginx.conf
    └── crm.service
```

## 🔧 API Endpoints

### Авторизация
- `POST /api/auth/register` - регистрация (только первый пользователь)
- `POST /api/auth/login` - вход
- `GET /api/auth/me` - проверка токена
- `GET /api/auth/check` - проверка нужна ли регистрация

### Города
- `GET /api/cities` - список городов
- `POST /api/cities` - добавить город
- `PUT /api/cities/:id` - редактировать
- `DELETE /api/cities/:id` - удалить

### Заказы
- `GET /api/orders/city/:cityId` - заказы по городу
- `GET /api/orders/search?q=` - поиск
- `POST /api/orders` - создать заказ
- `PUT /api/orders/:id` - обновить
- `PUT /api/orders/:id/status` - изменить статус
- `PUT /api/orders/:id/close` - закрыть с суммой
- `DELETE /api/orders/:id` - удалить

### Статистика
- `GET /api/stats/overview` - общая статистика
- `GET /api/stats/masters?period=` - по мастерам
- `GET /api/stats/sources?period=` - по источникам

## 💾 Бэкап базы данных

База данных хранится в файле `data/crm.db`. Для бэкапа просто скопируйте этот файл:

```bash
# Бэкап
cp /var/www/crm/data/crm.db /backup/crm-$(date +%Y%m%d).db

# Можно настроить автоматический бэкап через cron
crontab -e
# Добавить строку (бэкап каждый день в 2 ночи):
# 0 2 * * * cp /var/www/crm/data/crm.db /backup/crm-$(date +\%Y\%m\%d).db
```

## 📱 Установка на телефон (PWA)

1. Откройте сайт в Chrome/Safari
2. В меню браузера выберите "Добавить на главный экран"
3. Приложение будет работать как обычное мобильное приложение

## 🛠️ Возможные проблемы

### Ошибка при установке better-sqlite3

```bash
# Установите build-essential
sudo apt install -y build-essential python3
npm rebuild better-sqlite3
```

### Порт 3000 занят

Измените порт в `.env` файле или остановите процесс на этом порту:
```bash
lsof -i :3000
kill -9 <PID>
```

### Нет прав на директорию

```bash
sudo chown -R www-data:www-data /var/www/crm
```

## 📄 Лицензия

MIT
# crm-repair
