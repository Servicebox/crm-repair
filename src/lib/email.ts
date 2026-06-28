import nodemailer from 'nodemailer'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      `SMTP configuration incomplete. Missing: ${[
        !host && 'SMTP_HOST',
        !user && 'SMTP_USER',
        !pass && 'SMTP_PASS',
      ]
        .filter(Boolean)
        .join(', ')}`
    )
  }

  const smtpPort = Number(process.env.SMTP_PORT) || 465
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465

  return nodemailer.createTransport({
    host,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user, pass },
  })
}

export async function sendVerificationEmail(email: string, token: string, name: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = `${baseUrl}/verify-email?token=${token}`
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Вас добавили в ServiceBox CRM — установите пароль',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="margin-bottom:24px">
          <div style="display:inline-block;background:#eff6ff;border-radius:8px;padding:10px 14px;margin-bottom:16px">
            <span style="font-size:24px">🔐</span>
          </div>
          <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">Вас добавили в команду!</h1>
          <p style="color:#64748b;margin:0">Здравствуйте, ${escapeHtml(name)}!</p>
        </div>
        <p style="color:#475569;margin:0 0 8px">Вы добавлены в ServiceBox CRM. Чтобы начать работу, нажмите кнопку ниже и придумайте пароль для входа.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">Ссылка действительна <strong>48 часов</strong>.</p>
        <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">Установить пароль</a>
        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f1f5f9">
          <p style="color:#94a3b8;font-size:13px;margin:0 0 6px">Данные для входа:</p>
          <p style="color:#475569;font-size:13px;margin:0">Логин: <strong>${escapeHtml(email)}</strong></p>
          <p style="color:#94a3b8;font-size:12px;margin:8px 0 0">Если вас не добавляли — просто проигнорируйте это письмо.</p>
        </div>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = `${baseUrl}/reset-password?token=${token}`
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Сброс пароля — ServiceBox CRM',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">Сброс пароля</h1>
        <p style="color:#64748b;margin:0 0 24px">Нажмите кнопку ниже для сброса пароля. Ссылка действительна 1 час.</p>
        <a href="${url}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">Сбросить пароль</a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
      </div>
    `,
  })
}

export async function sendOrderStatusNotification(
  email: string,
  clientName: string,
  orderNumber: string,
  status: string,
  message?: string
) {
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Заказ ${orderNumber} — обновление статуса`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">Здравствуйте, ${escapeHtml(clientName)}!</h1>
        <p style="color:#64748b;margin:0 0 16px">Статус вашего заказа <strong>${escapeHtml(orderNumber)}</strong> обновлён.</p>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:0 0 16px">
          <p style="margin:0;font-weight:600;color:#0369a1">Новый статус: ${escapeHtml(status)}</p>
          ${message ? `<p style="margin:8px 0 0;color:#0369a1">${escapeHtml(message)}</p>` : ''}
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/track/${orderNumber}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">Отследить заказ</a>
      </div>
    `,
  })
}

export type BillingEmailType =
  | 'trial_blocked'
  | 'subscription_blocked'
  | 'payment_past_due'
  | 'payment_succeeded'
  | 'payment_failed'

const BILLING_EMAIL_TEMPLATES: Record<
  BillingEmailType,
  { subject: string; heading: string; body: string; cta?: { text: string; path: string } }
> = {
  trial_blocked: {
    subject: 'Пробный период завершён — ServiceBox',
    heading: 'Пробный период завершён',
    body: 'Ваш бесплатный пробный период подошёл к концу. Оформите подписку, чтобы продолжить работу.',
    cta: { text: 'Выбрать тариф', path: '/billing' },
  },
  subscription_blocked: {
    subject: 'Доступ приостановлен — ServiceBox',
    heading: 'Доступ приостановлен',
    body: 'Платёж не поступил в течение grace period. Оплатите подписку для восстановления доступа.',
    cta: { text: 'Оплатить', path: '/billing' },
  },
  payment_past_due: {
    subject: 'Требуется оплата — ServiceBox',
    heading: 'Подписка истекла',
    body: 'Срок действия вашей подписки истёк. У вас есть 3 дня для оплаты до блокировки доступа.',
    cta: { text: 'Продлить подписку', path: '/billing' },
  },
  payment_succeeded: {
    subject: 'Оплата прошла — ServiceBox',
    heading: 'Оплата прошла успешно',
    body: 'Ваша подписка продлена. Спасибо за доверие!',
  },
  payment_failed: {
    subject: 'Ошибка оплаты — ServiceBox',
    heading: 'Не удалось списать оплату',
    body: 'При автоматическом списании возникла ошибка. Проверьте данные карты и оплатите вручную.',
    cta: { text: 'Оплатить', path: '/billing' },
  },
}

export async function sendSubscriptionEmail(
  email: string,
  type: BillingEmailType,
  data?: Record<string, string>
): Promise<void> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000'

    const tmpl = BILLING_EMAIL_TEMPLATES[type]
    const ctaHtml = tmpl.cta
      ? `<a href="${baseUrl}${tmpl.cta.path}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:16px">${tmpl.cta.text}</a>`
      : ''

    const transporter = createTransporter()
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: tmpl.subject,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
          <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">${tmpl.heading}</h1>
          <p style="color:#64748b;margin:0 0 4px">Здравствуйте, ${escapeHtml(data?.['name'] ?? '')}!</p>
          <p style="color:#475569;margin:0 0 8px">${tmpl.body}</p>
          ${ctaHtml}
          <p style="color:#94a3b8;font-size:12px;margin:24px 0 0">ServiceBox CRM</p>
        </div>
      `,
    })
  } catch (error) {
    console.error('Failed to send subscription email:', error)
  }
}
