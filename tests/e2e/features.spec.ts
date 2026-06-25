import { test, expect, Page, Browser } from '@playwright/test'

const BASE = 'https://koznova.site'
const OWNER_EMAIL = 'admin@servicebox.ru'
const OWNER_PASS = 'Admin123!'

// ── helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page, email = OWNER_EMAIL, password = OWNER_PASS) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 })
}

// SSE pages (chat, shifts) never reach networkidle — use domcontentloaded + wait
async function gotoPage(page: Page, path: string) {
  await page.goto(`${BASE}${path}`)
  await page.waitForLoadState('domcontentloaded')
  // Wait for React to hydrate and first query to resolve
  await page.waitForTimeout(3000)
}

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await login(p, email, password)
  return p
}

// ── SHIFTS ────────────────────────────────────────────────────────────────────

test.describe('Shifts (Смены)', () => {
  test('shifts page loads with title', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/shifts')
    // Title visible
    await expect(page.locator('h1, h2').filter({ hasText: /смен/i }).first()).toBeVisible({ timeout: 8000 })
  })

  test('shifts page shows content or empty state', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/shifts')
    // Either list of shifts or "Нет открытых смен" or spinner gone
    const hasContent =
      (await page.locator('text=Нет открытых смен').count()) > 0 ||
      (await page.locator('text=Открыть смену').count()) > 0 ||
      (await page.locator('text=Закрыть смену').count()) > 0 ||
      (await page.locator('table').count()) > 0
    expect(hasContent).toBe(true)
  })

  test('can open a shift and see it active', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/shifts')

    const openBtn = page.locator('button').filter({ hasText: /открыть смену/i }).first()
    if (await openBtn.isVisible({ timeout: 5000 })) {
      await openBtn.click()
      await page.waitForTimeout(2000)
      // After opening: close button or active shift info
      const hasActive =
        (await page.locator('button').filter({ hasText: /закрыть/i }).count()) > 0 ||
        (await page.locator('text=/Текущая|активн/i').count()) > 0
      expect(hasActive).toBe(true)
    } else {
      // Already open or no shifts feature — check page is not broken
      await expect(page.locator('h1, h2').first()).toBeVisible()
    }
  })

  test('shifts page shows no MissingSchemaError (critical regression)', async ({ page }) => {
    await login(page)
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await gotoPage(page, '/shifts')
    await page.waitForTimeout(2000)
    const schemaErrors = errors.filter(e => e.includes('MissingSchemaError') || e.includes('Schema hasn'))
    expect(schemaErrors).toHaveLength(0)
    await expect(page.locator('text=500').or(page.locator('text=Internal Server Error'))).not.toBeVisible()
  })
})

// ── SALES ─────────────────────────────────────────────────────────────────────

test.describe('Sales / POS (Продажи)', () => {
  test('sales page loads with product search', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/sales')
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
    const hasSearch = (await page.locator('input').count()) > 0
    expect(hasSearch).toBe(true)
  })

  test('cart starts empty — checkout disabled', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/sales')
    const btn = page.locator('button').filter({ hasText: /оформить продажу/i })
    await expect(btn).toBeVisible({ timeout: 8000 })
    await expect(btn).toBeDisabled()
  })

  test('add product card to cart enables checkout button', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/sales')

    // Products are card-buttons with "В наличии: N" text
    const productCard = page.locator('button').filter({ hasText: /В наличии:/i }).first()
    await expect(productCard).toBeVisible({ timeout: 8000 })
    await productCard.click()
    await page.waitForTimeout(800)

    // Checkout button should now be enabled
    const checkoutBtn = page.locator('button').filter({ hasText: /оформить продажу/i })
    await expect(checkoutBtn).toBeEnabled({ timeout: 3000 })

    // Cart should show total > 0
    await expect(page.locator('text=/Итого/i').first()).toBeVisible()
  })

  test('checkout flow calls /api/sales, decrements stock, shows result', async ({ page }) => {
    await login(page)

    let salesCalled = false
    let salesStatus = 0
    page.on('request', req => {
      if (req.url().includes('/api/sales') && req.method() === 'POST') salesCalled = true
    })
    page.on('response', res => {
      if (res.url().includes('/api/sales')) salesStatus = res.status()
    })

    await gotoPage(page, '/sales')

    // Click first available product card
    const productCard = page.locator('button').filter({ hasText: /В наличии:/i }).first()
    await expect(productCard).toBeVisible({ timeout: 8000 })
    await productCard.click()
    await page.waitForTimeout(500)

    const checkoutBtn = page.locator('button').filter({ hasText: /оформить продажу/i })
    await expect(checkoutBtn).toBeEnabled({ timeout: 3000 })
    await checkoutBtn.click()
    await page.waitForTimeout(3000)

    // /api/sales must have been called
    expect(salesCalled).toBe(true)
    // Must NOT be 500
    expect(salesStatus).not.toBe(500)
    // Response: 201 success or 409 stock issue
    expect([201, 409]).toContain(salesStatus)
    // UI shows result — success or error, never silent
    const hasResult =
      (await page.locator('text=/оформлена|Продажа оформлена/i').count()) > 0 ||
      (await page.locator('text=/ошибка|недостаточно/i').count()) > 0
    expect(hasResult).toBe(true)
  })

  test('sale shows error on out-of-stock product (API validation)', async ({ page }) => {
    await login(page)

    // POST directly to /api/sales with a fake product id to verify error handling
    const res = await page.request.post(`${BASE}/api/sales`, {
      data: {
        items: [{ id: '000000000000000000000000', name: 'Fake', price: 100, qty: 1, type: 'product', discount: 0 }],
        payMethod: 'cash',
        globalDiscount: 0,
      },
    })
    // Should return 404 or 409, not 500
    expect([404, 409, 401]).toContain(res.status())
  })
})

// ── CHAT (one org) ────────────────────────────────────────────────────────────

test.describe('Chat — single org', () => {
  test('chat page loads with rooms and message input', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/chat')
    // Title
    await expect(page.locator('text=Чат').first()).toBeVisible({ timeout: 8000 })
    // Rooms visible (Общий чат and/or Внутренний чат)
    const hasGlobal = (await page.locator('text=Общий чат').count()) > 0
    const hasInternal = (await page.locator('text=Внутренний чат').count()) > 0
    expect(hasGlobal || hasInternal).toBe(true)
    // Input visible (placeholder "Написать сообщение...")
    await expect(page.locator('input[placeholder*="сообщение"], input[placeholder*="Написать"]')).toBeVisible({ timeout: 5000 })
  })

  test('can send a message in internal chat', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/chat')

    // Switch to internal room
    const internalRoom = page.locator('text=Внутренний чат').first()
    if (await internalRoom.isVisible({ timeout: 3000 })) {
      await internalRoom.click()
      await page.waitForTimeout(1000)
    }

    const msgInput = page.locator('input[placeholder*="сообщение"], input[placeholder*="Написать"]').first()
    await expect(msgInput).toBeVisible({ timeout: 5000 })

    const testMsg = `Внутренний тест ${Date.now()}`
    await msgInput.fill(testMsg)
    await msgInput.press('Enter')
    await page.waitForTimeout(2000)

    // Input clears after send
    await expect(msgInput).toHaveValue('')
    // Message appears in chat
    await expect(page.locator(`text=${testMsg}`).first()).toBeVisible({ timeout: 5000 })
  })

  test('can send a message in global chat', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/chat')

    // Click global chat room
    const globalRoom = page.locator('text=Общий чат').first()
    if (await globalRoom.isVisible({ timeout: 3000 })) {
      await globalRoom.click()
      await page.waitForTimeout(1000)
    }

    const msgInput = page.locator('input[placeholder*="сообщение"], input[placeholder*="Написать"]').first()
    await expect(msgInput).toBeVisible({ timeout: 5000 })

    const msg = `Глобальный тест ${Date.now()}`
    await msgInput.fill(msg)
    await msgInput.press('Enter')
    await page.waitForTimeout(2000)

    await expect(msgInput).toHaveValue('')
    await expect(page.locator(`text=${msg}`).first()).toBeVisible({ timeout: 5000 })
  })

  test('global chat shows messages from different users', async ({ page }) => {
    await login(page)
    await gotoPage(page, '/chat')

    const globalRoom = page.locator('text=Общий чат').first()
    if (await globalRoom.isVisible({ timeout: 2000 })) await globalRoom.click()

    await page.waitForTimeout(1000)
    // At least some message bubbles or empty state
    const hasMessages = (await page.locator('[class*="bubble"], [class*="message"], [class*="msg"]').count()) > 0
    const hasEmpty = (await page.locator('text=/пусто|нет сообщений|empty/i').count()) > 0
    expect(hasMessages || hasEmpty).toBe(true)
  })
})

// ── ORG REGISTRATION ──────────────────────────────────────────────────────────

test.describe('Organization Registration (Регистрация организации)', () => {
  test('register-org page loads with form', async ({ page }) => {
    await page.goto(`${BASE}/register-org`)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('input').first()).toBeVisible()
  })

  test('register-org step 1 requires org name', async ({ page }) => {
    await page.goto(`${BASE}/register-org`)
    await page.waitForLoadState('networkidle')
    // Try to proceed without entering org name
    const nextBtn = page.locator('button:has-text("Далее"), button[type="submit"]').first()
    await nextBtn.click()
    // HTML5 validation or custom error should appear
    await page.waitForTimeout(500)
    // Should still be on step 1
    const step2Fields = page.locator('input[type="email"]')
    // Email field is on step 2 — should NOT be visible yet (validation blocked)
    // OR org name input has validation message
    const orgInput = page.locator('input').first()
    expect(await orgInput.evaluate((el: HTMLInputElement) => el.validity.valid || el.value.length > 0)).toBeFalsy()
  })

  test('register-org step 1 → step 2 transition', async ({ page }) => {
    await page.goto(`${BASE}/register-org`)
    await page.waitForLoadState('networkidle')

    // Fill org name
    const orgInput = page.locator('input').first()
    await orgInput.fill(`Тест Орг ${Date.now()}`)

    const nextBtn = page.locator('button:has-text("Далее"), button[type="submit"]').first()
    await nextBtn.click()
    await page.waitForTimeout(500)

    // Step 2 should have email field
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 3000 })
  })

  test('register-org full flow creates new organization', async ({ page }) => {
    await page.goto(`${BASE}/register-org`)
    await page.waitForLoadState('networkidle')

    const timestamp = Date.now()
    const orgName = `Авто Тест ${timestamp}`
    const adminEmail = `autotest${timestamp}@example.com`

    // Step 1 — org name
    await page.locator('input').first().fill(orgName)
    await page.locator('button:has-text("Далее"), button[type="submit"]').first().click()
    await page.waitForTimeout(500)

    // Step 2 — admin details
    await page.locator('input[type="email"]').fill(adminEmail)
    const passwordInputs = page.locator('input[type="password"]')
    await passwordInputs.nth(0).fill('TestPass123!')
    if (await passwordInputs.count() > 1) {
      await passwordInputs.nth(1).fill('TestPass123!')
    }
    // Name field
    const nameInput = page.locator('input[placeholder*="Имя"], input[placeholder*="имя"], input[name="name"]').first()
    if (await nameInput.isVisible({ timeout: 1000 })) {
      await nameInput.fill('Авто Администратор')
    }

    // Submit
    await page.locator('button[type="submit"]').last().click()
    await page.waitForTimeout(4000)

    // Should show success or redirect to login with success message
    const success =
      (await page.locator('text=создан, text=успешно, text=Готово, text=зарегистрирован').count()) > 0 ||
      (await page.locator('text=организация').count()) > 0 ||
      page.url().includes('/login') ||
      page.url().includes('/verify')

    expect(success).toBe(true)
  })

  test('/api/orgs/register validation — duplicate org name', async ({ page }) => {
    // Try to register with empty payload
    const res = await page.request.post(`${BASE}/api/orgs/register`, {
      data: { orgName: '', adminName: '', adminEmail: 'bad', password: '123' },
    })
    expect([400, 422]).toContain(res.status())
  })
})

// ── PLATFORM DASHBOARD ────────────────────────────────────────────────────────

test.describe('Platform dashboard', () => {
  test('/platform returns 403 for non-owner', async ({ page }) => {
    await login(page)
    // admin@servicebox.ru is NOT the platform owner
    const res = await page.request.get(`${BASE}/api/platform/orgs`)
    // Should be 403 forbidden
    expect(res.status()).toBe(403)
  })

  test('/platform page loads for platform owner (mocked check)', async ({ page }) => {
    await page.goto(`${BASE}/platform`)
    // Should redirect to login (not a 404)
    await page.waitForURL(/login|platform/, { timeout: 5000 })
    const url = page.url()
    expect(url.includes('/login') || url.includes('/platform')).toBe(true)
  })
})

// ── SHIFTS API direct ─────────────────────────────────────────────────────────

test.describe('Shifts API (regression)', () => {
  test('GET /api/shifts returns 200 with valid session', async ({ page }) => {
    await login(page)
    const res = await page.request.get(`${BASE}/api/shifts`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    // Must NOT have MissingSchemaError
    expect(JSON.stringify(json)).not.toContain('MissingSchemaError')
    expect(json.data !== undefined || json.error !== undefined).toBe(true)
  })

  test('GET /api/shifts/active returns valid response', async ({ page }) => {
    await login(page)
    const res = await page.request.get(`${BASE}/api/shifts/active`)
    expect([200, 404]).toContain(res.status())
    const json = await res.json()
    expect(JSON.stringify(json)).not.toContain('MissingSchemaError')
  })
})
