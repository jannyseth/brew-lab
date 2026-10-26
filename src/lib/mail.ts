import nodemailer from "nodemailer";

// Gmail SMTP with an app password (https://myaccount.google.com/apppasswords).
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const purposes = {
  "email-verification": {
    subject: "confirm your Brew Lab account",
    heading: "Confirm your email",
    body: "Enter this code to finish creating your Brew Lab account.",
  },
  "forget-password": {
    subject: "reset your Brew Lab password",
    heading: "Reset your password",
    body: "Enter this code to choose a new password.",
  },
} as const;

export async function sendAuthCode(email: string, code: string, type: keyof typeof purposes) {
  const purpose = purposes[type];
  if (!process.env.GMAIL_APP_PASSWORD) {
    // Local development without Gmail set up: print the code instead. Never in production.
    if (process.env.NODE_ENV === "development") {
      console.log(`[dev] ${type} code for ${email}: ${code}`);
    } else {
      console.error("GMAIL_APP_PASSWORD is not set; codes can't be emailed.");
    }
    return;
  }
  try {
    await transporter.sendMail({
      from: `Brew Lab <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${code} — ${purpose.subject}`,
      text: `${purpose.body}\n\nYour code: ${code}\nIt expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email. Your account is safe.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#2b1d14">
  <h1 style="font-size:20px;margin:0 0 8px">${purpose.heading}</h1>
  <p style="color:#7a6656;margin:0 0 16px">${purpose.body}</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 16px">${code}</p>
  <p style="color:#7a6656;margin:0">It expires in 10 minutes. If you didn't ask for this, you can ignore this email. Your account is safe.</p>
</div>`,
    });
  } catch (err) {
    console.error("Failed to send email code", err);
  }
}

/** Sends a document (receipt, payslip) as a PDF attachment. Returns whether it was sent. */
export async function sendDocument(opts: { to: string[]; subject: string; text: string; filename: string; pdf: Uint8Array }) {
  if (opts.to.length === 0) return false;
  if (!process.env.GMAIL_APP_PASSWORD) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[dev] Would email "${opts.subject}" with ${opts.filename} to ${opts.to.join(", ")}`);
      return true;
    }
    console.error("GMAIL_APP_PASSWORD is not set; documents can't be emailed.");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `Brew Lab <${process.env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      attachments: [{ filename: opts.filename, content: Buffer.from(opts.pdf), contentType: "application/pdf" }],
    });
    return true;
  } catch (err) {
    console.error("Failed to email document", err);
    return false;
  }
}
