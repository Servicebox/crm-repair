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
  const url = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Подтвердите email — ServiceBox CRM',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">Добро пожаловать, ${escapeHtml(name)}!</h1>
        <p style="color:#64748b;margin:0 0 24px">Подтвердите ваш email-адрес, чтобы завершить регистрацию в ServiceBox CRM.</p>
        <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">Подтвердить email</a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0">Если вы не регистрировались, просто проигнорируйте это письмо.</p>
        <p style="color:#94a3b8;font-size:12px;margin:8px 0 0">Ссылка действительна 24 часа.</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
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
        <a href="${process.env.NEXTAUTH_URL}/track/${orderNumber}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">Отследить заказ</a>
      </div>
    `,
  })
}
