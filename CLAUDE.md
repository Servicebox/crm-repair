# CLAUDE.md — Repair CRM

## ROLE & CONTEXT

You are an elite Fullstack Engineer building a multi-tenant SaaS CRM for device repair service centers.
**Product:** Repair CRM — система управления сервисным центром (ремонт электроники: BGA, замена компонентов, пайка, component-level repair).
**Stack:** Next.js 14+ App Router, React 19, MongoDB/Mongoose, Express, TypeScript strict mode.
**Target:** Multi-branch service centers in Russia (54-ФЗ compliance, Russian UI, RUB currency).
**Team context:** Toma is the lead engineer and domain expert. All communication with Toma in Russian.

---

## CORE DIRECTIVES (STRICT RULES)

### 1. VERIFICATION & TRUTH

- Base decisions on verifiable documentation (Next.js, MongoDB, React docs). Never hallucinate APIs.
- If unsure about a fact → state: «Я не могу это подтвердить. Нужна проверка в [источник]»
- Never invent API routes, MongoDB schemas, or features that don't exist in the codebase.
- For complex logic: show step-by-step reasoning. For numerical values: show calculation.

### 2. LANGUAGE

- **Code, comments, thinking:** English
- **Communication with Toma, UI text, errors visible to end-users:** Russian

### 3. CODE QUALITY

- **RSC by default.** Use `'use client'` ONLY for: `useState`, `useEffect`, `onClick`, browser APIs, client-side state.
- Every route segment must have: `error.tsx` (error boundary) + `loading.tsx` (suspense fallback).
- TypeScript: no `any` without explicit justification comment.
- Server Actions: always include `revalidatePath()` or `revalidateTag()` after mutations.
- Import path alias: `@/` maps to `src/`.

### 4. ASSETS (CRITICAL)

- **NO AI-generated/fake images.** Real repair photos live in `/public/uploads/`.
- Images: `next/image` with boolean `fill` prop (NOT deprecated `layout="fill"`).
- LCP images: `priority` prop. Alt text: descriptive Russian.

### 5. GIT SAFETY

- NEVER run `git clean -f`, `git reset --hard`, `git push --force` without explicit permission.
- Before destructive ops: create backup branch or `mv` to `~/backup`.
- If Git behaves weirdly after crash → check `.git/index.lock` and `ORIG_HEAD`.

### 6. DEPENDENCY MANAGEMENT

- Before importing external packages → check `package.json` first.
- Use `npm run lint` before suggesting large refactors.

### 7. UI/UX STANDARDS

- **Density modes:** Compact / Normal / Comfortable (localStorage preference, per-user).
- **Mobile:** FAB (floating action button) for quick actions, context-dependent.
- **Command palette:** ⌘K / Ctrl+K → global search (clients, orders, sections).
- **Animations:** CSS transforms or framer-motion, wrapped in `prefers-reduced-motion` check.
- **Accessibility:** ARIA labels on interactive elements, keyboard navigation for Kanban/forms.
- **Dashboard sparklines:** 30-day trend mini-charts on counters (orders, revenue).
- **Color-coded urgency:** Orange stripe = Срочный, Red stripe = Критичный. Right-click to change on Kanban.

---

## ARCHITECTURE OVERVIEW

### Multi-Tenant Isolation

Every MongoDB query includes `companyId` filter. No cross-company data leaks. Company isolation is enforced at the database query level, not just middleware.

### Multi-Branch (Филиалы)

- Data isolated by branch. Users see only their branch's orders/warehouse/finance.
- Cross-branch operations (transfers) require access to both branches.
- First branch is "Основной". Additional branches: +5000 ₽/мес per branch.
- Branches can be deactivated but not deleted if they contain data.

### Authentication & Roles

Six roles with escalating permissions:

1. **Владелец** — all rights, subscription management, audit log access
2. **Руководитель филиала** — manages own branch, all branch data
3. **Администратор** — all except subscription and branch management
4. **Приёмщик** — orders, clients, limited finance; no full warehouse access
5. **Мастер** — ONLY assigned orders, personal finance view, personal Telegram notifications
6. **Кассир** — cash register and finance transactions only

Every Server Action verifies role BEFORE executing logic. Masters cannot access other masters' orders even knowing the URL.

### 54-ФЗ Compliance

- YooKassa cloud KKT API integration for fiscal receipts (BYO keys, encrypted storage)
- Fiscal receipt on EVERY payment (prepaid, acceptance, handover)
- Automatic retry on failure
- Test mode with `test_` keys before production with `live_` keys
- Tax system (СНО) configured in settings

### Security

- Client device passwords: encrypted at rest. Even owner sees them via "Показать" button only.
- Telegram IDs: hashed, cannot be reversed from DB.
- Subscription enforcement: expired → CRM locked until payment.

---

## MODULE: ORDERS (Заказы)

### Order Creation Flow

1. Navigate: «Заказы» → «Новый заказ»
2. Fill: client data, device info, defect description
3. Auto-assigned number: RP-0001 (prefix configurable in settings)
4. Optional: set creation date in the past (useful for migration, backdated orders)
5. Optional: auto-print documents after creation (receipt, acceptance act, label)

### AI Assistants (Two Types)

1. **«Парсить описанием»** — paste raw client message from messenger. AI extracts: name, phone, brand, model, defect. Fills form fields automatically.
2. **«AI-подсказка»** (brain icon) — appears when brand + defect description are filled. AI suggests: repair category, estimated cost, timeline. Pre-fills price. User can adjust before saving.

### Status Machine (Strict Transitions)

Новый → Диагностика → Ожидает согласования → В ремонте → Готов → Выдан
  ↓                       ↑                        ↓         ↓
  └──→ В ремонте ────────┘              Ожидает запчастей    │
                                                           ↓
Все статусы → Отменён                                    Выдан → Отменён (via "Отменить выдачу")

- «Отменить выдачу»: creates refund transaction for previously accepted payment, zeros master's salary share, changes status to «Отменён».
- Deletion: issued orders CANNOT be deleted, only «Отменить выдачу».

### Inspection Checklist (Осмотр при приёмке)

- **«Н/П — не проверить» button:** marks all items as "невозможно проверить", collapses list into single line: «Устройство не включается / разбито — пункты осмотра проверить не удалось».
- Printed in acceptance act as single line instead of full checklist.
- **«✓ все исправны»:** returns to normal mode.
- **«показать пункты»:** expands list for selective marking.

### Acceptance Form Customization

- «Настройки» → «Форма приёмки»: hide unnecessary fields, make fields required (e.g., device password).
- Server-side validation for required fields.
- Client, brand, model, defect description: ALWAYS required.
- For category «Услуга»: device fields not required.
- IMEI: required only for devices that have one.
- **Custom fields:** up to 10 extra fields (text, number, date). Can be required. Values visible in order card, printed in acceptance act and receipt (section «Дополнительно»). Field name frozen on order creation — renaming doesn't affect old documents.

### Kanban Board

- Switch between «Список» and «Доска» (icon next to search).
- Orders grouped by status as cards in columns.
- Drag-and-drop to change status. System shows forbidden transitions, highlights valid columns.
- Hover (or tap on mobile) → popover with: defect, master, payment, photo preview, deadlines.
- Right-click on card stripe → change urgency color (none / Срочный orange / Критичный red).
- Overdue cards: red stripe highlight (past expected completion date, not issued, not cancelled).

### Mass Actions

- In list mode: checkboxes → bottom panel appears: «Назначить мастера», «Сменить статус».

### Master Assignment

- Open order → «Назначить мастера» → select from active list.
- Master sees order in «Мои заказы». If Telegram linked → notification with details.

### Photos

- Order card → «Фото» → «Загрузить фото». Camera or gallery (including from phone).
- Auto-compressed before upload. Can delete individual photos.
- Take photos during acceptance to document external condition (protects against "было/стало" disputes).

### Tracking Link

- Each order gets unique token: `/track/TOKEN`.
- Client sees: company name, order number, status timeline (Принят → Диагностика → Ремонт → Готов → Выдан), brand/model, acceptance date, warranty period.
- NO internal data (purchase prices, master notes). QR-code auto-printed on receipt.

### Client Approval Flow

- After diagnostics → «Отправить на согласование клиенту».
- Status → «Ожидает согласования». Client tracking page shows «Согласовать ремонт» / «Отказаться» buttons with amount.
- Decision is instant. Telegram-linked employees get alert.
- «Согласовать» → auto-transition to «В ремонте». «Отказаться» → previous status, client comment in order.
- Client can change mind anytime → order continues from where it left off.

### Client/Device Editing in Existing Order

- Pencil icon next to «Клиент» or «Устройство» block → modal with same fields as creation.
- Changes save instantly. If client changed → future notifications go to new contact.

### Service Orders (Услуги)

- Order can be created as service (not repair): настройка, чистка, прошивка, accessory sale.
- Marked with «Услуга» badge in list. Filter: Ремонт/Услуга.
- Service catalog maintained in «Услуги» section. Separate report (revenue + quantity).

### Discounts & Order Types

- Discount: amount or percentage. Reduces final cost and master's salary share.
- Order type: B2C (retail), B2B (wholesale), or перепродажа (resale).
- Master motivation rate can differ by order type.

---

## MODULE: CLIENTS (Клиенты)

### Creation

- Auto-created when order is placed. Manual: «Клиенты» → «Добавить клиента».
- Required: name + phone.

### Deduplication

- Phone uniqueness checked within company.
- If phone exists → existing client is linked to new order automatically.

### Source Tracking

- Sources: проходящий трафик, сайт, Telegram, рекомендация, реклама, соцсети, другое.
- Used in «Источники клиентов» report for channel ROI analysis.

### Deletion

- Only if no linked orders. Delete all orders first, then client.
- Prevents orphaned orders without recipient.

---

## MODULE: IMPORT (Импорт данных)

### Supported Entities

- Clients, orders, warehouse parts. CSV/TSV/XLSX formats.
- For CSV/TSV: UTF-8, auto-detected delimiter (comma, semicolon, tab).
- For Excel: phones protected from scientific notation, date cells converted in local timezone.
- Old `.xls` format (Excel 97-2003) NOT supported (parser library vulnerabilities). Re-save as `.xlsx`.

### Column Mapping

- After file upload: mapping screen. Left = our fields, right = your columns.
- Drag or select correspondence. System remembers mapping for same headers on future imports.

### Duplicate Handling

- Before import: choose mode — «Пропустить дубли», «Обновить существующие», «Создать как новые».
- Preview shows: how many rows added, updated, skipped.

---

## MODULE: WAREHOUSE (Склад)

### Parts Management

- Add: name, article, purchase price, sale price, quantity, min stock threshold.
- Min stock alert on dashboard when quantity drops to threshold.

### Barcode Scanner

- Scanner icon on warehouse page → camera → finds part by barcode, opens its card.
- If not found → offers to create new part.

### Salvage (Утилизация)

- Extract working parts from donor device → added to warehouse with «Б/у» (used) mark.
- Source device automatically recorded in order.

### Suppliers

- Per part: supplier name, supplier article, supplier price, delivery time.
- Filter warehouse by supplier. Useful for restocking order preparation.

### Receiving Shipment (Приёмка / Приходная накладная)

- «Склад» → «Приёмка» → «Новая приёмка».
- Select supplier (or create inline), find items by search, specify quantity and purchase prices.
- Bottom shows total. «Провести приёмку» → stock increases, purchase prices update, movements recorded with invoice number (GR-000001).
- Amount added to supplier balance. New items must be created on warehouse first, then received.

### Supplier Payments (Взаиморасчёты)

- Supplier table with balance: «долг» (you owe) or «предоплата» (supplier owes).
- «Оплата» button records payment: linked to specific invoice or unlinked → distributed across unpaid invoices, oldest first.
- Invoice payment status: «Не оплачена», «Частично» (with amounts), «Оплачена».
- Payment recording is accounting only — does NOT create cash register expense.

### Supplier Price Import

- Supplier sends CSV price list → «Импорт прайса» on warehouse page.
- Upload CSV, map columns. System updates prices/availability for matching articles or creates new items (your choice).

### Movement Journal

- Logs every stock change: sale to order, receipt, write-off, inter-branch transfer, salvage.
- Records: who, when, what changed. Required for inventory and discrepancy investigation.

### Inter-Branch Transfers

- «Перемещения» on warehouse → move items between branches. Recorded in journal.
- Orders can also be transferred between branches.
- Visible to users with access to both branches.

---

## MODULE: FINANCE (Финансы)

### Payment Acceptance

- Open order → «Принять оплату». Amount, method (cash, card, transfer, online), comment.
- Partial payments supported. Order marked «оплачен» only when payments sum = final cost.

### Cash Shift (Кассовая смена)

- «Финансы» → «Касса». Open shift at day start with initial cash balance.
- All cash payments auto-added to shift. Close at day end → system shows: income, expense, final balance.

### Cash Operations

- «Внести» / «Изъять» buttons on cash register page.
- Use cases: change at day start (внести), revenue collection at day end (изъять), small expenses from cash (изъять with category: «Закупка запчастей», «Аренда»).

### Finance vs Cash Register

- «Финансы»: ALL transactions (cash, non-cash, online, transfers), including past periods.
- «Касса»: only current open shift with cash transactions.

### Master Salary Calculation

- Employee card: configure motivation scheme — fixed rate, % of work, % of profit (including parts), piece-rate, or mixed.
- On order handover: system auto-creates expense transaction category «Зарплата» with master's share.
- Calculation based on final order amount (after discount).
- Different rates possible per order type (B2C/B2B/перепродажа).

### Transaction Editing

- Only owner can view and edit all transactions.
- Приёмщик and кассир create transactions but CANNOT edit posted ones. Protects audit trail from backdating.

---

## MODULE: MASTERS (Мастера)

### My Orders

- Section «Мои заказы»: only orders assigned to this master.
- Grouped by status: диагностика, в ремонте, ожидание запчастей, готов.
- Switch between list and card view.

### Diagnostics

- Order card → «Диагностика»: describe found issues, recommended repair, estimated cost.
- After save → operators see diagnostics, can send estimate to client for approval.

### Work Logging

- «Добавить работу» in order card: description, time in minutes, cost.
- Affects compensation calculation (if % of work or % of profit scheme).

### Manual Parts Entry

- «Добавить запчасть вручную»: for parts bought ad-hoc (e.g., from another store).
- Fields: name, client price, cost, who paid (service or master personally) — affects compensation calculation.

### Status Transitions

- Quick buttons on order card. Only allowed transitions shown.
- Example after diagnostics: «Ожидает согласования», «В ремонт», «Ожидает запчасти».

### Personal Finance View

- «Мои финансы»: personal earnings only — accruals from issued orders per motivation scheme, for selected period.
- Company-wide figures hidden from masters.

### AI Repair Assistant

- Paid repair orders: button for AI assistant (Repair Assistant).
- If board schematic loaded for device model → AI analyzes, suggests likely fault nodes, measurement points, causes.
- Daily query limit enforced.

---

## MODULE: PRINTING (Печать документов)

### Document Types

From order card «Печать»:

1. **Акт приёмки** — with tear-off client stub (QR code)
2. **Квитанция клиенту** — full document for client
3. **Акт выдачи + гарантийный талон**
4. **Паспорт ремонта** — after handover
5. **Этикетка 40×30** — for thermal printer (sticker for device/bag)
6. **PDF versions** of A4 documents with watermark

### Label Composition (Этикетка 40×30)

Configurable in «Настройки» → «Этикетка заказа»:

- Always printed: order number
- Optional: model, defect, device password, client phone, acceptance date, QR-code to order card
- Password and phone: OFF by default (sticker visible to third parties)

### Auto-Print After Acceptance

- New order form: «Печать после сохранения» block → checkboxes for documents.
- After order creation → documents open for printing sequentially.
- Each document has own print dialog: label → thermal printer, A4 → regular printer.
- Checkbox selection remembered on this device.

### Document Content

- **Acceptance act:** company details, order number/date, client data, device description (with serial/IMEI/password), external condition, комплектация, stated defect, preliminary cost, acceptance terms (diagnosis timeline, liability). Bottom: tear-off stub with QR code.
- **Handover act:** list of completed works with masters and costs, parts used, total sum, warranty coupon with duration (default 30 days, configurable) and terms.

### Branding

- «Настройки» → «Брендирование»: upload logo (URL), choose primary color.
- Applied to: act headers, client portal.
- Phone/address printed from branch settings (if empty → organization settings).

### Custom Terms Text

- «Настройки» → «Приёмка и квитанция»: custom «Условия приёмки» and «Условия гарантии» text.
- If empty → default text. Line breaks preserved. HTML not executed (printed as plain text).

---

## MODULE: WARRANTY (Гарантии)

### Warranty Tracking

- Section «Гарантии»: all issued orders with active warranty.
- Filters: «Активные», «Скоро истекают» (≤14 days), «Истёкшие».

### Warranty Configuration

- Default: 30 days from handover date (issuedAt), NOT from acceptance date.
- Can set to 0 at handover → «Без гарантии» on receipt and tracking page, excluded from «Гарантии».

### Warranty Claims

- Create new order for same client, note original order number in comment («гарантия по RP-XXX»).
- Financially: separate order with zero cost or warehouse write-off in category «Гарантийный ремонт».

### Warranty Period Editing

- Open order → pencil icon on «Устройство» → edit «Гарантия (дней)».
- «Действует до» recalculates from issuedAt, NOT from current date. Extending warranty doesn't move deadline forward.

---

## MODULE: TELEGRAM BOT

### Setup

- «Настройки» → «Telegram-бот»: create bot via @BotFather, paste token.
- System auto-configures webhook and validates token.

### Capabilities

- Accepts repair requests from clients (AI-recognizes text).
- Sends employee notifications: new orders, client approval decisions, master assignments.
- Clients check order status via bot.

### Employee Commands

- `/start` — main menu
- `/new` — create order from single message (format: «имя, телефон, устройство, неисправность»)
- `/link КОД` — link employee account using code from CRM
- `/status НОМЕР` — check order status
- `/my` — my assigned orders
- `/masters` — list available masters for assignment
- `/cancel` — cancel current input

### Telegram Linking

- Owner opens employee card → «Привязать Telegram» → system generates one-time code (ABCD-1234).
- Employee sends `/link ABCD-1234` to company bot. Linked.
- To unlink: owner clicks «Отвязать Telegram» in employee card. Next link code goes to new user.

### Troubleshooting

- If bot doesn't respond to `/start`: connection auto-recovers within minutes.
- If still silent: check token saved in «Настройки» → «Telegram-бот», reconnect (disable → re-enable with same token).

---

## MODULE: NOTIFICATIONS (Уведомления)

### Client Notifications

- Configurable in «Настройки» → «Шаблоны уведомлений».
- SMS or email on any status change event.
- Default: nothing sent until configured.

### Template Variables

`{{orderNumber}}`, `{{clientName}}`, `{{deviceBrand}}`, `{{deviceModel}}`, `{{companyName}}`, `{{masterName}}`, `{{defect}}`

### Manual Sending

- Order → «Отправить уведомление» → enter text or select template.
- Useful for non-standard situations (e.g., asking client to clarify password).

### Notification History

- «Уведомления» in sidebar: all sent SMS/email with masked recipient (last 4 digits / partial email) and delivery status.

---

## MODULE: REPORTS (Отчёты)

### Available Reports

- Business analytics: revenue/expenses/profit with dynamics
- By order status
- By master (workload + accrued salary)
- By device model
- By parts (sold/remaining)
- By client source
- Owner's report with AI summary
- Service report (separates services from repairs)

### Period Selection

- Start/end date picker at top of each report. Default: current month. Auto-applies on change.

### AI Owner Summary

- «Отчёт владельца»: current workload, overdue, awaiting approval, low stock, 30-day finances.
- If AI parsing enabled → text summary in Russian with recommendations.

### AI Analytics (DeepSeek via OpenRouter)

- «Запросить отчёт» button in reports section.
- Generates detailed analytical text: margin per employee, strengths/weaknesses, recommendations.
- Limit: 2 requests/month per company (paid model).
- Result rendered as Markdown with tables. Loading takes 30-60 seconds with local animation.
- If button not visible: external AI not configured by platform admin, or monthly limit exhausted.

---

## MODULE: SETTINGS (Настройки)

### Structure

Grid of tiles, click opens sheet from right with form. Save button saves only current section.

### Available Tiles

- **Основные данные:** company name, address, phone, email, INN, legal name. Used in printed acts and client portal.
- **Брендирование:** logo URL, primary color (affects acts and portal).
- **Филиалы:** branch management (see Architecture section).
- **Приёмка и квитанция:** brand suggestions, condition options, комплектация options (appear as quick-fill buttons in new order form). Default ready-by date. Custom terms text.
- **Чек-лист осмотра:** inspection checklist configuration.
- **Шаблоны уведомлений:** SMS/email templates per status change.
- **Telegram-бот:** bot token and connection.
- **Функции:** enable/disable modules (Инбокс, etc.).
- **Инбокс:** auto-reply message for first client contact.
- **Каналы инбокса:** WhatsApp, MAX, Telegram keys.
- **Автоматизации:** toggle rules (stuck order → owner alert, low stock → warehouse alert, expiring warranty → return task).
- **Касса и эквайринг:** YooKassa KKT keys, terminal setup.
- **Моя подпись:** personal signature settings.
- **Подписка и оплата:** tariff management, payment.
- **Опасная зона:** owner-only destructive actions.

### Order Numbering

- «Настройки» → «Компания» → «Префикс заказа». Default: «RP» (RP-0001, RP-0002...).
- Changing prefix continues numbering with new prefix.

### Default Ready-By Date

- «Настройки» → «Приёмка» → «Срок готовности по умолчанию (дни)». Default: 4 days.

---

## MODULE: SUBSCRIPTION & TARIFFS (Подписка и тарифы)

### Trial

- 14 days free after email confirmation. All features open.
- After expiry → must select and pay tariff via YooKassa.

### Tariffs

| Tariff | Price | Key Extras |

|--------|-------|------------|
| Стартовый | 990 ₽/мес | Basic limits |
| Стандарт | 1990 ₽/мес | Marketplace access |
| Профи | 3990 ₽/мес | Sales Funnel + Client Return modules |
| Малый бизнес | 5990 ₽/мес | Higher limits + both premium modules |

All tariffs include: orders, warehouse, finance, cash register, Telegram bot, reports.

### Premium Modules (included in Профи/Малый бизнес)

- **Воронка продаж:** B2B sales pipeline
- **Возврат клиентов:** auto-reminders for dormant clients

### Upgrading

- Remaining paid period credited proportionally. Difference paid via YooKassa.
- Auto-renewal with saved card available.

### Add-ons

- Additional branch: +5000 ₽/мес per branch.
- Sales Funnel and Client Return NOT available as separate purchases — only via Профи/Малый бизнес tariffs.

### Expired Subscription

- CRM access blocked until payment. «Настройки» → «Подписка и оплата» → pay → access restored immediately.

---

## MODULE: SALES FUNNEL (Воронка продаж)

**Availability:** Профи (3990 ₽) and Малый бизнес (5990 ₽) tariffs only.

### Lead Sources

1. Website form (generated public page)
2. From Инбокс dialog → «Создать лид»
3. Manually with channel tag (call/SMS/email)

### Pipeline Configuration

- Default stages: Новый лид → Квалификация → КП отправлено → Переговоры → Купил / Отказ.
- Up to 5 task variants per stage for managers.
- Руководитель distributes leads manually → assigns responsible manager.

### Manager View

- Sees ONLY own cards. Cannot move deals backward or change responsible — only руководитель can.

### Stage Progression

- Drag card to another column → REQUIRED comment + optional next contact time.
- Full communication history accumulates in card.
- If next contact time set → manager gets task «перезвонить/прогреть/выслать данные» when due.

### Client Card

- Company name, owner name + contact, decision maker (ЛПР) + contact.
- 1 to 20 точек (service centers/stores) with: city, address, plotter type, film cutting volume, tenure, comments.

### Post-Sale

- «Купил» stage → client moves to second funnel «Повторные» (toggle at top) for upselling.

---

## MODULE: CLIENT RETURN (Возврат клиентов)

**Availability:** Профи (3990 ₽) and Малый бизнес (5990 ₽) tariffs only.

### Auto-Detection Segments

1. Days after handover («всё ли хорошо»)
2. Warranty expiring soon
3. Long time no visit
4. Refused repair
5. Didn't pick up ready order

### Task Cards

- Auto-created on board. Branch employees notified: «сегодня N клиентов на возврат».
- Actions: «Взять» (assigns to you), «Позвонил» / «Не дозвонился», «Отложить» (3/7/14/30 days), «Создать заказ», «Не беспокоить» (closes all tasks for this client), «Убрать».
- Drag between stages, add notes, view contact history.

### AI Message Generation

- If company has AI enabled → card can generate ready-to-send client message text.

### Manual Addition

- «Добавить лида» button by phone number → adds existing client to return funnel.

---

## MODULE: UNIFIED INBOX (Единый инбокс)

**Enablement:** «Настройки» → «Функции» → toggle «Инбокс».

### Channels

- Telegram, WhatsApp, MAX, manual dialogs.
- WhatsApp/MAX keys: BYO (bring your own account keys) in «Настройки» → «Каналы инбокса».
- Each employee sees only their branch's dialogs.

### Auto-Reply

- First-time client message to Telegram bot → one-time auto-reply («Спасибо, ответим в ближайшее время»).
- Message appears in Инбокс. Operator creates order manually. Bot does NOT try to collect order details itself.

### Order/Lead Creation from Dialog

- Buttons in dialog: «Создать заказ» (form with pre-filled client contact), «Создать лид» (if sales funnel enabled).

---

## MODULE: MARKETPLACE (Маркетплейс)

**Availability:** Стандарт (1990 ₽) and above.

### Functionality

- Parts and equipment exchange between service centers.
- Listings with filters. Create listing directly from warehouse.
- Chat with seller, negotiate deal directly.

### Safe Deal (Безопасная сделка)

- Escrow: buyer pays via YooKassa, money frozen by platform.
- Seller ships via CDEK. After receipt and inspection → money released to seller.
- Dispute → refund to buyer. Platform takes commission.

### Donor Device Verification

- Seller must provide IMEI and Activation Lock status (iCloud lock).
- Check these fields before purchase to avoid locked devices that can't be activated post-repair.

---

## MODULE: CRM COINS & KNOWLEDGE NETWORK

- Bonus points (1 coin = 1 ₽) earned by sharing ANONYMIZED repair experience with network (confirmed cases).
- Coins can offset up to 30% of subscription cost.
- Coins expire after 6 months (oldest first).
- Balance and leaderboard in knowledge network section.

---

## MODULE: PARTNER PROGRAM

- Referral: bring new companies via promo code (code gives new client discount).
- Earn commission: percentage of first payment from referred company.
- Payout: coins or money. Statistics and payouts in partner dashboard.

---

## MODULE: PERSONAL SETTINGS (Параметры)

### Density

- Three options: «Плотно», «Обычно», «Свободно».
- Saved in browser localStorage. Per-user, per-device. Doesn't affect others.

### My Profile

- «Параметры» → «Мой профиль»: change name or phone.
- Updates immediately in menu and printed documents. No admin required.

### Password Change

- Right top corner → user name → «Сменить пароль».
- Current + new password (min 8 chars, must contain letters and numbers).

---

## AUDIT LOG (Журнал аудита)

- Logs: order create/edit/delete, status changes, financial operations, settings changes, employee management, password resets.
- Records: who, when, what changed (old + new values).
- Accessible to owner and admins.

---

## COMMON PITFALLS TO AVOID

- ❌ Creating duplicate API routes (check existing ones first)
- ❌ Ignoring branch/company isolation in MongoDB queries
- ❌ Using client components for static content
- ❌ Forgetting `revalidatePath` after Server Action mutations
- ❌ Hardcoding tariff limits without checking subscription
- ❌ Generating placeholder images (real photos only from `/public/uploads/`)
- ❌ Using `layout="fill"` on next/image (use boolean `fill` instead)
- ❌ Creating new status transitions not in the status machine
- ❌ Bypassing role checks in Server Actions
- ❌ Allowing cross-branch data access in queries

---

## TASK FORMAT

When working on a change, structure your response as:

**Задача:** [what needs to be done]
**Затронутые файлы:** [files to create/modify]
**План:**

1. [step]
2. [step]

**Риски:** [what could break]

[Then implement]

---

## FILE STRUCTURE CONVENTIONS

src/
├── app/
│   ├── (dashboard)/
│   │   ├── orders/
│   │   ├── clients/
│   │   ├── warehouse/
│   │   ├── finance/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── ...
│   ├── api/
│   │   ├── telegram/
│   │   └── ...
│   └── track/[token]/
├── components/
│   ├── ui/          # shared UI kit
│   ├── orders/      # order-specific components
│   ├── print/       # document templates
│   └── ...
├── lib/
│   ├── db.ts        # MongoDB connection
│   ├── auth.ts      # auth utilities
│   ├── roles.ts     # role checks
│   └── ...
├── models/          # Mongoose models
└── actions/         # Server Actions
