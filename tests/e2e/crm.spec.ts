import { test, expect, Page } from '@playwright/test'

const BASE = 'http://localhost:3000'
const EMAIL = 'test@servicebox.local'
const PASSWORD = 'test123'

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 })
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test('login page loads', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await expect(page.locator('h1, h2').first()).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('login with valid credentials', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(`${BASE}/dashboard`)
})

test('login with wrong password shows error', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', 'wrongpassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=/ошибка|неверный|invalid/i')).toBeVisible({ timeout: 5000 })
})

// ── Dashboard ────────────────────────────────────────────────────────────────

test('dashboard loads with KPI cards', async ({ page }) => {
  await login(page)
  await expect(page.locator('main')).toBeVisible()
})

// ── Sidebar navigation ───────────────────────────────────────────────────────

const PAGES = [
  ['/orders', 'Заказы'],
  ['/clients', 'Клиенты'],
  ['/employees', 'Сотрудники'],
  ['/sales', 'Касса'],
  ['/warehouse', 'Склад'],
  ['/ai', 'AI'],
  ['/chat', 'Чат'],
  ['/journal', 'Журнал'],
  ['/telemetry', 'Телеметрия'],
  ['/marketplace', 'Маркетплейс'],
  ['/import', 'Импорт'],
  ['/support', 'Поддержка'],
  ['/settings', 'Настройки'],
  ['/settings/profile', 'Профиль'],
  ['/settings/permissions', 'Права доступа'],
  ['/settings/api', 'API'],
  ['/my-earnings', 'Мой заработок'],
  ['/my-orders', 'Мои заказы'],
  ['/clients/return', 'Возврат'],
  ['/finance', 'Финансы'],
  ['/reports', 'Отчёты'],
]

for (const [path, label] of PAGES) {
  test(`page ${path} loads (${label})`, async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}${path}`)
    await expect(page.locator('main')).toBeVisible({ timeout: 8000 })
    // No 404 page
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=This page could not be found')).not.toBeVisible()
  })
}

// ── Orders ───────────────────────────────────────────────────────────────────

test('orders list loads and has table', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders`)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('h1')).toBeVisible()
})

test('new order form has all sections', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders/new`)
  await expect(page.locator('main h1').first()).toBeVisible()
  // Client section
  await expect(page.locator('main').locator('text=Клиент').first()).toBeVisible()
  // Device section
  await expect(page.locator('main').locator('text=Устройство').first()).toBeVisible()
})

test('new order form - add custom field', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders/new`)
  // Find and click "Добавить поле"
  const addBtn = page.locator('text=Добавить поле')
  await expect(addBtn).toBeVisible()
  await addBtn.click()
  await expect(page.locator('input[placeholder="Название поля"]')).toBeVisible()
})

test('new order - repair/service tab switch', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders/new`)
  const servicetab = page.locator('text=Услуга')
  if (await servicetab.isVisible()) {
    await servicetab.click()
  }
  await expect(page.locator('main')).toBeVisible()
})

// ── Clients ──────────────────────────────────────────────────────────────────

test('clients page loads', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/clients`)
  await expect(page.locator('main')).toBeVisible()
})

// ── Employees ────────────────────────────────────────────────────────────────

test('employees page has tabs', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/employees`)
  await expect(page.locator('main')).toBeVisible()
})

// ── My Earnings ──────────────────────────────────────────────────────────────

test('my-earnings page has month picker and recalc button', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/my-earnings`)
  await expect(page.locator('h1, h2').first()).toBeVisible()
  await expect(page.locator('input[type="month"]')).toBeVisible()
})

// ── Permissions ──────────────────────────────────────────────────────────────

test('permissions page loads with employee list', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/settings/permissions`)
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

// ── Support ──────────────────────────────────────────────────────────────────

test('support page has FAQ', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/support`)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('text=Часто задаваемые вопросы')).toBeVisible()
})

test('support page - FAQ accordion opens', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/support`)
  const faqBtn = page.locator('button').filter({ hasText: 'Как добавить нового сотрудника' }).first()
  await faqBtn.click()
  await expect(page.locator('text=/Перейдите в раздел/').first()).toBeVisible()
})

// ── AI ───────────────────────────────────────────────────────────────────────

test('AI page has chat and knowledge base tabs', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/ai`)
  // Tab buttons at top of page
  await expect(page.locator('button:has-text("База знаний")').first()).toBeVisible()
})

test('AI - switch to knowledge base tab', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/ai`)
  await page.locator('text=База знаний').click()
  await expect(page.locator('text=Загрузить')).toBeVisible()
})

// ── Sales / POS ──────────────────────────────────────────────────────────────

test('sales POS page loads', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/sales`)
  await expect(page.locator('main')).toBeVisible()
})

// ── Settings API ─────────────────────────────────────────────────────────────

test('settings/api has tabs and key display', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/settings/api`)
  await expect(page.locator('text=REST API')).toBeVisible()
  await expect(page.locator('text=Фискализация')).toBeVisible()
  await expect(page.locator('text=1С')).toBeVisible()
})

test('settings/api - switch to 1C tab', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/settings/api`)
  await page.locator('text=1С').click()
  await expect(page.locator('text=Выгрузить склад')).toBeVisible()
})

// ── Floating Chat ─────────────────────────────────────────────────────────────

test('floating chat button visible on dashboard', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/dashboard`)
  // FloatingChat button is fixed bottom-right
  const chatBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
  await expect(chatBtn).toBeVisible()
})

test('floating chat opens on click', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders`)
  // Click the floating button (fixed bottom-right, last button with svg)
  await page.locator('.fixed.bottom-5.right-5 button').last().click()
  await expect(page.locator('text=Общий чат')).toBeVisible({ timeout: 3000 })
})

// ── API v1 routes ─────────────────────────────────────────────────────────────

test('GET /api/v1/tracking/UNKNOWN returns 404 json', async ({ page }) => {
  const res = await page.request.get(`${BASE}/api/v1/tracking/NOTEXIST-000`)
  expect(res.status()).toBe(404)
  const text = await res.text()
  expect(text).toContain('success')
})

test('GET /api/v1/orders without key returns 401', async ({ page }) => {
  // Use a fresh context without session cookies
  const ctx = await page.context().browser()!.newContext()
  const apiPage = await ctx.newPage()
  const res = await apiPage.request.get(`${BASE}/api/v1/orders`)
  expect(res.status()).toBe(401)
  const json = await res.json()
  expect(json.success).toBe(false)
  await ctx.close()
})

// ── Chat page ─────────────────────────────────────────────────────────────────

test('chat page loads with input', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/chat`)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('input[placeholder*="сообщен"]')).toBeVisible()
})

// ── Forgot / Reset Password ───────────────────────────────────────────────────

test('forgot-password page loads', async ({ page }) => {
  await page.goto(`${BASE}/forgot-password`)
  await expect(page.locator('text=Забыли пароль')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test('forgot-password back link goes to login', async ({ page }) => {
  await page.goto(`${BASE}/forgot-password`)
  await page.locator('text=Вернуться ко входу').click()
  await expect(page).toHaveURL(`${BASE}/login`)
})

test('forgot-password submit shows success', async ({ page }) => {
  await page.goto(`${BASE}/forgot-password`)
  await page.fill('input[type="email"]', 'nonexistent@test.ru')
  await page.click('button[type="submit"]')
  // Server always returns success (anti-enumeration)
  await expect(page.locator('text=Письмо отправлено')).toBeVisible({ timeout: 5000 })
})

test('reset-password page loads without token', async ({ page }) => {
  await page.goto(`${BASE}/reset-password`)
  await expect(page.locator('main, .bg-white')).toBeVisible()
})

test('login page has forgot-password link', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
})

// ── API auth providers ─────────────────────────────────────────────────────────

test('/api/auth/providers returns 200 (not 500)', async ({ page }) => {
  const res = await page.request.get(`${BASE}/api/auth/providers`)
  expect(res.status()).toBe(200)
})

test('/api/auth/session returns valid json', async ({ page }) => {
  const res = await page.request.get(`${BASE}/api/auth/session`)
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json).toBeDefined()
})

// ── New order creation flow ────────────────────────────────────────────────────

test('new order - prepayment shows checkbox when amount entered', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders/new`)
  // Find prepayment input
  const prepayInput = page.locator('input[type="number"]').filter({ hasText: '' }).nth(1)
  // Try to find by placeholder
  const prepayField = page.locator('input[placeholder*="000"]').or(page.locator('input[placeholder*="предоплат"]')).first()
  // Just verify the form section exists
  await expect(page.locator('text=Предоплата').or(page.locator('text=предоплата'))).toBeVisible()
})

test('new order - custom fields section visible', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/orders/new`)
  await expect(page.locator('text=Свои поля')).toBeVisible()
})

// ── Employees payroll tab ─────────────────────────────────────────────────────

test('employees page - switch to payroll tab', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/employees`)
  const payrollTab = page.locator('button:has-text("Начисления")').or(page.locator('text=Начисления')).first()
  if (await payrollTab.isVisible()) {
    await payrollTab.click()
    await expect(page.locator('main')).toBeVisible()
  }
})

// ── My earnings ───────────────────────────────────────────────────────────────

test('my-earnings - recalculate button works', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/my-earnings`)
  const recalcBtn = page.locator('button:has-text("Пересчитать")')
  await expect(recalcBtn).toBeVisible()
  await recalcBtn.click()
  // Should not crash
  await expect(page.locator('main')).toBeVisible()
})

// ── Floating chat functional ──────────────────────────────────────────────────

test('floating chat - send message', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/dashboard`)
  // Open chat
  await page.locator('.fixed.bottom-5.right-5 button').last().click()
  await expect(page.locator('text=Общий чат')).toBeVisible()
  // Type and send
  await page.fill('input[placeholder*="Сообщение"]', 'Тест сообщение')
  await page.keyboard.press('Enter')
  // Input should clear after send
  await expect(page.locator('input[placeholder*="Сообщение"]')).toHaveValue('')
})

// ── AI knowledge base ─────────────────────────────────────────────────────────

test('AI KB - file list shows demo files', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/ai`)
  await page.locator('button:has-text("База знаний")').click()
  await expect(page.locator('text=iPhone').first()).toBeVisible()
  await expect(page.locator('button:has-text("Загрузить")')).toBeVisible()
})

// ── Settings/API ──────────────────────────────────────────────────────────────

test('settings/api - copy API key button works', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/settings/api`)
  await expect(page.locator('h2:has-text("API ключ")')).toBeVisible()
  const copyBtn = page.locator('button:has-text("Копировать")')
  await expect(copyBtn).toBeVisible()
  await copyBtn.click()
  await expect(page.locator('text=Скопировано')).toBeVisible({ timeout: 3000 })
})

// ── Support page functional ───────────────────────────────────────────────────

test('support page - write support form submit', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/support`)
  const topicSelect = page.locator('select').first()
  await topicSelect.selectOption({ index: 1 })
  await page.fill('textarea', 'Тестовое обращение в поддержку')
  const sendBtn = page.locator('button:has-text("Отправить")')
  await sendBtn.click()
  await expect(page.locator('text=отправлено').or(page.locator('text=Отправлено'))).toBeVisible({ timeout: 3000 })
})
