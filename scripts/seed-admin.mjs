#!/usr/bin/env node
/**
 * Скрипт создания первого администратора
 * Запуск: node scripts/seed-admin.mjs
 * Или с параметрами: node scripts/seed-admin.mjs --email=admin@example.com --password=MyPass123 --name="Иван Иванов"
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env')
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    console.error('Не удалось загрузить .env файл')
  }
}

loadEnv()

const args = process.argv.slice(2)
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`))
  return arg ? arg.split('=').slice(1).join('=') : null
}

const ADMIN_EMAIL = getArg('email') || 'admin@servicebox.ru'
const ADMIN_PASSWORD = getArg('password') || 'Admin123!'
const ADMIN_NAME = getArg('name') || 'Администратор'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-repair'

const require = createRequire(import.meta.url)
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, default: 'owner' },
  isEmailVerified: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const CompanySchema = new mongoose.Schema({ name: String }, { timestamps: true })

async function seed() {
  console.log(`\n🔗 Подключение к MongoDB: ${MONGODB_URI}\n`)

  await mongoose.connect(MONGODB_URI)

  const User = mongoose.models.User || mongoose.model('User', UserSchema)
  const Company = mongoose.models.Company || mongoose.model('Company', CompanySchema)

  const existingUser = await User.findOne({ email: ADMIN_EMAIL })
  if (existingUser) {
    if (!existingUser.isEmailVerified || existingUser.role !== 'owner') {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)
      existingUser.isEmailVerified = true
      existingUser.role = 'owner'
      existingUser.isActive = true
      existingUser.password = hashedPassword
      await existingUser.save()
      console.log(`✅ Пользователь обновлён: ${ADMIN_EMAIL}`)
    } else {
      console.log(`ℹ️  Пользователь уже существует: ${ADMIN_EMAIL}`)
    }
  } else {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'owner',
      isEmailVerified: true,
      isActive: true,
    })
    console.log(`✅ Администратор создан: ${ADMIN_EMAIL}`)
  }

  const existingCompany = await Company.findOne()
  if (!existingCompany) {
    await Company.create({ name: 'Мой сервисный центр' })
    console.log('✅ Компания создана')
  }

  await mongoose.disconnect()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉  Начальные данные для входа:')
  console.log(`    Email:    ${ADMIN_EMAIL}`)
  console.log(`    Пароль:   ${ADMIN_PASSWORD}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

seed().catch(err => {
  console.error('❌ Ошибка:', err.message)
  process.exit(1)
})
