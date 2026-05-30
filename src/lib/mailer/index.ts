import { Resend } from 'resend';
import { sanitiseError } from '@/lib/security/sanitise-error';
import { logNotification } from '@/lib/db/notification-log';
import { format } from 'date-fns';

const FROM = process.env.EMAIL_FROM ?? 'noreply@raghuvirexim.com';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

// ─── Shared branding ─────────────────────────────────────────────
const HEADER = `
  <div style="background:#878687;padding:20px 32px;border-radius:8px 8px 0 0">
    <div style="color:#F5C400;font-size:20px;font-weight:700;letter-spacing:1px;font-family:Helvetica,Arial,sans-serif">
      RAGHUVIR EXIM LIMITED
    </div>
    <div style="color:#ffffff;font-size:11px;font-family:Helvetica,Arial,sans-serif;margin-top:2px">
      REL Certification Tracker
    </div>
  </div>
`;
const FOOTER = `
  <div style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;font-family:Helvetica,Arial,sans-serif;border-radius:0 0 8px 8px">
    This is an automated message from REL Certification Tracker.
    Do not reply to this email.
  </div>
`;
function wrap(body: string): string {
  return `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Helvetica,Arial,sans-serif">
      ${HEADER}
      <div style="padding:32px;color:#222">${body}</div>
      ${FOOTER}
    </div>
  `;
}

type SendResult = { success: boolean; error?: string };

// ─── sendCertExpiryReminder ───────────────────────────────────────
export async function sendCertExpiryReminder(params: {
  to: string;
  certName: string;
  expiryDate: Date;
  daysRemaining: number;
  buyerTags: string[];
  renewalCost?: number;
  appUrl: string;
}): Promise<SendResult> {
  const subject = `⚠ Certificate Expiry Alert — ${params.certName} (${params.daysRemaining} days)`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Certificate Expiry Alert</h2>
    <p><strong>${params.certName}</strong> expires on <strong>${format(params.expiryDate, 'dd MMM yyyy')}</strong>
    — that is <strong style="color:#d9534f">${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}</strong> from today.</p>
    ${params.buyerTags.length > 0 ? `<p><strong>Buyer Tags:</strong> ${params.buyerTags.join(', ')}</p>` : ''}
    ${params.renewalCost ? `<p><strong>Estimated Renewal Cost:</strong> ₹${params.renewalCost.toLocaleString()}</p>` : ''}
    <p style="margin-top:24px">
      <a href="${params.appUrl}/certificates" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        View in Tracker →
      </a>
    </p>
  `);
  return sendEmail({ to: params.to, subject, html, certName: params.certName, trigger: `expiry_${params.daysRemaining}d` });
}

// ─── sendSupplierExpiryReminder ───────────────────────────────────
export async function sendSupplierExpiryReminder(params: {
  to: string;
  cc?: string;
  supplierName: string;
  certName: string;
  expiryDate: Date;
  daysRemaining: number;
  portalUrl: string;
}): Promise<SendResult> {
  const subject = `Action Required — ${params.certName} expires in ${params.daysRemaining} days`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Certificate Renewal Required</h2>
    <p>Dear ${params.supplierName},</p>
    <p>Your certificate <strong>${params.certName}</strong> expires on
    <strong>${format(params.expiryDate, 'dd MMM yyyy')}</strong>
    (${params.daysRemaining} days remaining).</p>
    <p>Please upload the renewed certificate as soon as possible.</p>
    <p style="margin-top:24px">
      <a href="${params.portalUrl}/upload" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        Upload Renewed Certificate →
      </a>
    </p>
  `);
  return sendEmail({ to: params.to, cc: params.cc, subject, html, certName: params.certName, trigger: `supplier_expiry_${params.daysRemaining}d` });
}

// ─── sendPortalInvite ─────────────────────────────────────────────
export async function sendPortalInvite(params: {
  to: string;
  supplierName: string;
  inviteUrl: string;
}): Promise<SendResult> {
  const subject = `Welcome — Set up your REL Supplier Portal account`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Supplier Portal Invitation</h2>
    <p>Dear ${params.supplierName},</p>
    <p>You have been invited to the <strong>Raghuvir Exim Limited Supplier Portal</strong>.
    Please click the link below to activate your account and set your password.</p>
    <p style="margin-top:24px">
      <a href="${params.inviteUrl}" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        Activate Supplier Account →
      </a>
    </p>
    <p style="color:#999;font-size:12px;margin-top:16px">This invitation link expires in 7 days.</p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'portal_invite' });
}

// ─── sendPdfRequestNotification ──────────────────────────────────
export async function sendPdfRequestNotification(params: {
  to: string;
  cc: string;
  buyerName: string;
  buyerCompany: string;
  certName: string;
  approveUrl: string;
  denyUrl: string;
}): Promise<SendResult> {
  const subject = `PDF Access Request — ${params.certName}`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">PDF Access Request</h2>
    <p><strong>${params.buyerName}</strong> from <strong>${params.buyerCompany}</strong>
    has requested access to the PDF for: <strong>${params.certName}</strong></p>
    <p>Please approve or deny this request:</p>
    <p style="margin-top:24px">
      <a href="${params.approveUrl}" style="background:#5cb85c;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600;margin-right:12px">
        ✓ Approve
      </a>
      <a href="${params.denyUrl}" style="background:#d9534f;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        ✗ Deny
      </a>
    </p>
  `);
  return sendEmail({ to: params.to, cc: params.cc, subject, html, trigger: 'pdf_request' });
}

// ─── sendPdfDownloadLink ──────────────────────────────────────────
export async function sendPdfDownloadLink(params: {
  to: string;
  certName: string;
  downloadUrl: string;
  expiresAt: Date;
}): Promise<SendResult> {
  const subject = `Your download link — ${params.certName}`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Certificate PDF Download</h2>
    <p>Your request for <strong>${params.certName}</strong> has been approved.</p>
    <p>Click the link below to download the PDF. This link expires on
    <strong>${format(params.expiresAt, 'dd MMM yyyy HH:mm')}</strong>.</p>
    <p style="margin-top:24px">
      <a href="${params.downloadUrl}" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        Download PDF →
      </a>
    </p>
    <p style="color:#d9534f;font-size:12px">This link is single-use and cannot be shared.</p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'pdf_download_link' });
}

// ─── sendOtp ─────────────────────────────────────────────────────
export async function sendOtp(params: { to: string; otp: string }): Promise<SendResult> {
  const subject = `REL Tracker — Your verification code`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Two-Factor Authentication</h2>
    <p>Your one-time verification code is:</p>
    <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#F5C400;background:#222;display:inline-block;padding:16px 24px;border-radius:8px">
      ${params.otp}
    </p>
    <p style="color:#999;font-size:12px;margin-top:16px">This code expires in 10 minutes. Do not share it.</p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'otp' });
}

// ─── sendBuyerRegistrationNotification (to REL admin) ─────────────
export async function sendBuyerRegistrationNotification(params: {
  to: string;
  buyerName: string;
  company: string;
  email: string;
  adminUrl: string;
}): Promise<SendResult> {
  const subject = `New buyer registration pending approval — ${params.buyerName}`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">New Buyer Registration</h2>
    <p>A new buyer has requested access and is awaiting approval:</p>
    <p style="line-height:1.8">
      <strong>Name:</strong> ${params.buyerName}<br/>
      <strong>Company:</strong> ${params.company || '—'}<br/>
      <strong>Email:</strong> ${params.email}
    </p>
    <p style="margin-top:24px">
      <a href="${params.adminUrl}" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        Review in Buyer Activity →
      </a>
    </p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'buyer_register' });
}

// ─── sendBuyerApprovalEmail (to buyer) ────────────────────────────
export async function sendBuyerApprovalEmail(params: {
  to: string;
  buyerName: string;
  setPasswordUrl: string;
}): Promise<SendResult> {
  const subject = `Your REL buyer access has been approved`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Access Approved</h2>
    <p>Dear ${params.buyerName},</p>
    <p>Your request for access to the <strong>REL Compliance Portal</strong> has been approved.
    Please set your password to activate your account.</p>
    <p style="margin-top:24px">
      <a href="${params.setPasswordUrl}" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        Set Your Password →
      </a>
    </p>
    <p style="color:#999;font-size:12px;margin-top:16px">This link expires in 7 days.</p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'buyer_approved' });
}

// ─── sendBuyerRejectionEmail (to buyer) ───────────────────────────
export async function sendBuyerRejectionEmail(params: {
  to: string;
  buyerName: string;
}): Promise<SendResult> {
  const subject = `Update on your REL access request`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Access Request Update</h2>
    <p>Dear ${params.buyerName},</p>
    <p>Thank you for your interest. After review, we are unable to grant portal access at this time.
    If you believe this is in error, please contact your REL representative.</p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'buyer_rejected' });
}

// ─── sendWeeklyDigest (to REL) ────────────────────────────────────
export async function sendWeeklyDigest(params: {
  to: string;
  appUrl: string;
  expiring7: number;
  expiring30: number;
  expiring60: number;
  renewalsInProgress: number;
  supplierReview: number;
  pendingBuyers: number;
}): Promise<SendResult> {
  const subject = `REL Weekly Compliance Digest`;
  const row = (label: string, n: number, urgent = false) => `
    <tr>
      <td style="padding:8px 0;color:#444">${label}</td>
      <td style="padding:8px 0;text-align:right;font-weight:700;color:${urgent && n > 0 ? '#d9534f' : '#222'}">${n}</td>
    </tr>`;
  const html = wrap(`
    <h2 style="color:#878687;margin-top:0">Weekly Compliance Digest</h2>
    <p>Here is this week's certification summary.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row('Certificates expiring within 7 days', params.expiring7, true)}
      ${row('Certificates expiring within 30 days', params.expiring30, true)}
      ${row('Certificates expiring within 60 days', params.expiring60)}
      ${row('Renewals in progress', params.renewalsInProgress)}
      ${row('Supplier certificates pending review', params.supplierReview, true)}
      ${row('Buyer registrations pending approval', params.pendingBuyers, true)}
    </table>
    <p style="margin-top:24px">
      <a href="${params.appUrl}" style="background:#F5C400;color:#222;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">
        Open Tracker →
      </a>
    </p>
  `);
  return sendEmail({ to: params.to, subject, html, trigger: 'digest' });
}

// ─── Internal sendEmail helper ────────────────────────────────────
async function sendEmail(params: {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  certName?: string;
  trigger?: string;
}): Promise<SendResult> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: params.to,
      ...(params.cc && { cc: params.cc }),
      subject: params.subject,
      html: params.html,
    });

    // Log success
    logNotification({
      cert_type: 'internal',
      recipient: params.to,
      subject: params.subject,
      trigger_label: params.trigger,
      status: 'sent',
    });

    return { success: true };
  } catch (err) {
    const safe = sanitiseError(err);
    console.error('[mailer] sendEmail failed:', safe);

    // Log failure — never throw
    logNotification({
      cert_type: 'internal',
      recipient: params.to,
      subject: params.subject,
      trigger_label: params.trigger,
      status: 'failed',
      error_message: safe,
    });

    return { success: false, error: safe };
  }
}
