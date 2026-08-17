const nodemailer = require('nodemailer');
const env = require('../config/env');

function assertSmtpConfigured() {
  const missing = [];

  if (!env.smtpHost) missing.push('SMTP_HOST');
  if (!env.smtpUser) missing.push('SMTP_USER');
  if (!env.smtpPass) missing.push('SMTP_PASS');

  if (missing.length > 0) {
    const error = new Error(`Faltan variables SMTP: ${missing.join(', ')}`);
    error.code = 'SMTP_NOT_CONFIGURED';
    error.missing = missing;
    throw error;
  }
}

function createTransporter() {
  assertSmtpConfigured();

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

async function sendCoordinatorInvitation({ to, registrationUrl, expiresAt, role }) {
  const transporter = createTransporter();
  const roleLabel = role === 'coordinador_zonal' ? 'coordinador zonal' : 'coordinador parroquial';

  return transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject: 'Invitación para registrarte en Catequesis San Pedro',
    text: [
      'Hola.',
      '',
      `Recibiste una invitación para registrarte como ${roleLabel}.`,
      `El enlace vence el ${expiresAt}.`,
      '',
      registrationUrl,
      '',
      'Si no esperabas esta invitación, podés ignorar este correo.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <h1 style="font-size: 22px;">Invitación Catequesis San Pedro</h1>
        <p>Recibiste una invitación para registrarte como <strong>${roleLabel}</strong>.</p>
        <p>El enlace vence el <strong>${expiresAt}</strong>.</p>
        <p>
          <a href="${registrationUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
            Completar registro
          </a>
        </p>
        <p>Si el botón no funciona, copiá este enlace:</p>
        <p><a href="${registrationUrl}">${registrationUrl}</a></p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail({ to, resetUrl, expiresAt }) {
  const transporter = createTransporter();

  return transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject: 'Restablecé tu contraseña de Catequesis San Pedro',
    text: [
      'Hola.',
      '',
      'Recibimos una solicitud para restablecer tu contraseña.',
      'El enlace vence en 15 minutos.',
      '',
      resetUrl,
      '',
      'Si no solicitaste este cambio, podés ignorar este correo.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <h1 style="font-size: 22px;">Restablecer contraseña</h1>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>El enlace vence en <strong>15 minutos</strong>.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
            Elegir nueva contraseña
          </a>
        </p>
        <p>Si el botón no funciona, copiá este enlace:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no solicitaste este cambio, podés ignorar este correo.</p>
      </div>
    `,
  });
}

module.exports = {
  assertSmtpConfigured,
  sendCoordinatorInvitation,
  sendPasswordResetEmail,
};
