const { Resend } = require('resend');

function createEmailService() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY é obrigatória. Configure no arquivo .env');
  }

  return new Resend(process.env.RESEND_API_KEY);
}

const resend = createEmailService();

async function sendPasswordResetEmail(to, resetLink) {
  const appName = process.env.APP_NAME || "CineList";
  const from = process.env.MAIL_FROM;
  const subject = `${appName} - Redefinição de Senha`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;font-size:14px;line-height:1.5;">
      <h2 style="color:#444;">Redefinição de Senha</h2>
      <p>Recebemos uma solicitação para redefinir sua senha no <strong>${appName}</strong>.</p>
      <p>Clique no botão abaixo (ou copie o link) para continuar. Este link é válido por 1 hora.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${resetLink}" style="background:#FFD704;color:#1A1A1A;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight: bold;">Redefinir Senha</a>
      </p>
      <p>Se você não solicitou, ignore este email. Nenhuma mudança será feita.</p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #eee;"/>
      <p style="font-size:12px;color:#666;word-break:break-all;">Link direto: <br/>${resetLink}</p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html
    });
    return result;
  } catch (error) {
    console.error('[MAILER] Erro ao enviar email:', error);
    throw error;
  }
}

module.exports = { sendPasswordResetEmail };
