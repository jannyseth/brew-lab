import type { Metadata } from "next";
import { contactEmail, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Safety & Security" };

export default function SecurityPage() {
  const email = contactEmail();
  return (
    <LegalPage
      title="Safety & Security"
      intro="How we keep your account, your orders and your data safe, what branches must do, and what to do if something goes wrong."
    >
      <section>
        <h2>Protecting your account</h2>
        <ul>
          <li>Passwords are stored only as a salted, one-way hash (scrypt). Nobody at Brew Lab can read them.</li>
          <li>New accounts must confirm their email with a 6-digit code before they can sign in.</li>
          <li>Email codes expire after 10 minutes and are locked after 3 wrong attempts.</li>
          <li>
            You can turn on two-factor sign-in from your profile, so signing in also needs a code from an authenticator app.
            Brew Lab staff must use it. Ten one-time backup codes cover a lost phone.
          </li>
          <li>Repeated sign-in or code requests from the same place are slowed down to stop guessing attacks.</li>
          <li>Resetting your password signs you out everywhere else.</li>
          <li>Sessions use a secure, HTTP-only cookie and end after 7 days.</li>
        </ul>
      </section>

      <section>
        <h2>Protecting your data</h2>
        <ul>
          <li>Every connection to Brew Lab is encrypted with HTTPS (TLS). Our database is encrypted at rest.</li>
          <li>Access is role-based: customers see only their own orders, branch owners see only their own branches, and only the administrator sees platform-wide data.</li>
          <li>Prices are always recalculated on our servers, so totals can&apos;t be tampered with in the browser.</li>
          <li>Sign-ins and every change (orders, approvals, licenses, payroll entries) are recorded in an activity log reviewed by the administrator.</li>
          <li>Secrets such as email credentials are stored encrypted with our hosting provider, never in our code.</li>
          <li>Uploaded photos are checked to be real images, resized and re-encoded, which removes hidden data such as GPS location. They are stored in our encrypted database.</li>
          <li>Employee account numbers are shown masked (last 4 digits only) on screens and payslips.</li>
          <li>Data we share or sell is anonymous statistics only, never names or individual order histories.</li>
        </ul>
      </section>

      <section>
        <h2>Branch standards</h2>
        <ul>
          <li>Every branch owner is verified, and every branch is approved, before customers can order.</li>
          <li>Branches must hold the permits required by law (e.g. business and sanitary permits) and follow food safety and hygiene standards.</li>
          <li>Branch owners must keep customers&apos; and employees&apos; personal data confidential and use it only to run their branch.</li>
          <li>Licenses are reviewed yearly. Brew Lab may suspend a branch or revoke its license at any time for safety or privacy concerns.</li>
        </ul>
      </section>

      <section>
        <h2>If something goes wrong</h2>
        <ol>
          <li>We contain the incident and secure affected systems.</li>
          <li>We investigate using our activity log to find what was affected.</li>
          <li>If personal data is at risk, we notify the National Privacy Commission and affected users within 72 hours, as required by NPC Circular No. 16-03.</li>
          <li>We fix the cause and review our safeguards.</li>
        </ol>
      </section>

      <section>
        <h2>Staying safe yourself</h2>
        <ul>
          <li>Use a unique password you don&apos;t use anywhere else.</li>
          <li>Brew Lab will never ask for your password or a code by phone, chat or social media.</li>
          <li>Sign out on shared devices.</li>
        </ul>
      </section>

      <section>
        <h2>Report a problem</h2>
        <p>
          If you notice suspicious activity or find a security issue, email{" "}
          <a href={`mailto:${email}`} className="text-accent underline">{email}</a>. Please don&apos;t share details publicly
          until we&apos;ve had a chance to fix it.
        </p>
      </section>
    </LegalPage>
  );
}
