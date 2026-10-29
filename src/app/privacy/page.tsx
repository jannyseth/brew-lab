import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  const email = contactEmail();
  return (
    <LegalPage
      title="Privacy Notice"
      intro="Brew Lab respects your privacy. This notice explains what personal data we collect, why, how we protect it, and the rights you have under the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and issuances of the National Privacy Commission (NPC)."
    >
      <section>
        <h2>1. Who we are</h2>
        <p>
          Brew Lab (“we”, “us”) operates this website and is the personal information controller for the data described here.
          Our Data Protection Officer can be reached at <a href={`mailto:${email}`} className="text-accent underline">{email}</a>.
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Account data:</strong> your name, email address, account type (customer or branch owner) and password. Passwords are stored only as a one-way hash; we can never see them.</li>
          <li><strong>Order data:</strong> the drinks you order and customize, your pickup name, notes to the barista, the branch, order status, amounts and payment status.</li>
          <li><strong>Saved drinks:</strong> recipes you choose to save.</li>
          <li><strong>Rewards data:</strong> your bean coin balance and history, signature drinks you publish, the creator name you choose, and whether you agreed to appear on the public leaderboard.</li>
          <li><strong>Profile pictures:</strong> a photo you upload for your account, or a branch photo uploaded by its owner. Photos are resized and stripped of hidden data such as location before they are stored.</li>
          <li><strong>Branch owner data:</strong> legal name, mobile number, business details, branch names, addresses and hours, sales records, and employee names, positions, pay rates, payroll records, emails and receiving accounts (bank or e-wallet) that owners enter.</li>
          <li><strong>Security data:</strong> the date and time you sign in, your IP address and browser type, and a record of changes made in your account (our activity log).</li>
        </ul>
        <p>We do not collect payment card details: you pay at the counter. We do not use advertising or tracking cookies.</p>
      </section>

      <section>
        <h2>3. Why we use it (purpose and lawful basis)</h2>
        <ul>
          <li>To create and secure your account and verify your email: <em>necessary to provide the service you request.</em></li>
          <li>To prepare your orders, notify the branch, and issue receipts: <em>contract fulfillment.</em></li>
          <li>To verify branch owners, issue and renew branch licenses, and compute sales toward the license quota: <em>contract fulfillment and legitimate interest.</em></li>
          <li>To detect fraud and abuse, investigate security incidents, and keep an activity log: <em>legitimate interest in keeping the platform safe.</em></li>
          <li>To keep financial records required by tax and accounting laws, and to compute each branch&apos;s platform fee: <em>legal obligation and contract fulfillment.</em></li>
          <li>To email payslips that branch owners record to their employees and records inbox: <em>performed for the branch owner.</em></li>
          <li>
            <strong>Personalized offers (optional):</strong> if you turn this on at sign-up or in your profile, we analyze your
            order history (for example, the ingredients you use most and least) to send you offers: <em>your consent, which you
            can withdraw at any time.</em>
          </li>
          <li>
            <strong>Anonymous coffee insights:</strong> we combine orders from everyone into statistics, such as which
            ingredients, combinations and times are most popular. These statistics contain no names, emails or other details
            that identify you, and we may share or sell them to partners such as coffee suppliers: <em>legitimate interest; anonymous data is no longer personal data.</em>
          </li>
        </ul>
        <p>We do not sell your personal data. Your name and your individual order history are never part of what we share or sell.</p>
      </section>

      <section>
        <h2>4. Who we share it with</h2>
        <ul>
          <li><strong>The branch you order from</strong> sees your pickup name, order details and notes so it can prepare your drinks.</li>
          <li><strong>The public</strong> sees your published signature drinks with your creator name, and, only if you opt in, your place on the leaderboard. Your real name and email are never shown. You can turn the leaderboard off any time in Rewards.</li>
          <li><strong>Service providers</strong> that process data for us under contract: Vercel (website hosting), Neon (database and photo storage) and Google (sending email codes and documents). Their servers may be located outside the Philippines; we require them to protect your data to a standard comparable to Philippine law.</li>
          <li><strong>Authorities</strong>, only when required by law or a lawful order.</li>
        </ul>
      </section>

      <section>
        <h2>5. How long we keep it</h2>
        <p>
          We keep account data while your account is active. Order and sales records are kept as long as required by tax and
          accounting laws. Security and activity logs are kept as long as needed for security and accountability. When data is
          no longer needed, we delete or anonymize it.
        </p>
      </section>

      <section>
        <h2>6. How we protect it</h2>
        <p>
          We apply organizational, physical and technical security measures, including encrypted connections (HTTPS), hashed
          passwords, email verification, role-based access, and an activity log reviewed by our administrator. See{" "}
          <Link href="/security" className="text-accent underline">Safety &amp; Security</Link> for details.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul>
          <li>be informed about how your data is processed;</li>
          <li>access your personal data;</li>
          <li>object to processing, and withdraw consent at any time;</li>
          <li>correct inaccurate data;</li>
          <li>have your data erased or blocked when it is no longer needed or was processed unlawfully;</li>
          <li>obtain a copy of your data in a portable format;</li>
          <li>be indemnified for damages caused by inaccurate or unlawfully used data; and</li>
          <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
        </ul>
        <p>
          To exercise these rights, email <a href={`mailto:${email}`} className="text-accent underline">{email}</a> from your
          account&apos;s address. We respond within a reasonable time and may ask you to confirm your identity.
        </p>
      </section>

      <section>
        <h2>8. Data breaches</h2>
        <p>
          If a breach puts your data at real risk, we will notify the National Privacy Commission and affected users within 72
          hours of discovering it, as required by NPC Circular No. 16-03, and tell you what we are doing about it.
        </p>
      </section>

      <section>
        <h2>9. Changes to this notice</h2>
        <p>We will post any changes here and update the date above. Significant changes will be announced by email.</p>
      </section>
    </LegalPage>
  );
}
