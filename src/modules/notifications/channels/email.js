import nodemailer from 'nodemailer';
import { loadConfig } from '../../../shared/config.js';

const config = loadConfig();

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined
});

export async function sendEmail(recipient, { subject, body, attachments }) {
  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: recipient,
    subject,
    text: body,
    attachments
  });
  return { messageId: info.messageId };
}
