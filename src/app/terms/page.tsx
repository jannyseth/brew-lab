import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  const email = contactEmail();
  return (
    <LegalPage
      title="Terms of Use"
      intro="These Terms govern your use of Brew Lab. By creating an account you agree to them and to our Privacy Notice. Please read them carefully."
    >
      <section>
        <h2>Article 1. Acceptance</h2>
        <p>
          By creating an account or placing an order, you confirm that you are at least 18 years old, or have the consent of
          a parent or guardian, and that you accept these Terms.
        </p>
      </section>

      <section>
        <h2>Article 2. Your account</h2>
        <ol>
          <li>You must give accurate information and confirm your email address.</li>
          <li>Keep your password secret. You are responsible for activity under your account.</li>
          <li>Tell us right away at {email} if you suspect unauthorized use.</li>
          <li>Customer and branch owner accounts are separate. A branch owner account cannot place customer orders.</li>
        </ol>
      </section>

      <section>
        <h2>Article 3. Orders and payment</h2>
        <ol>
          <li>Prices are in Philippine pesos and are confirmed by our system when you place the order.</li>
          <li>You pay at the counter when you pick up your order. An order is complete once it is paid and collected.</li>
          <li>You may cancel an order until the branch starts preparing it.</li>
          <li>Receipts shown in the app are order receipts. The branch is responsible for issuing official receipts or invoices required by the Bureau of Internal Revenue.</li>
        </ol>
      </section>

      <section>
        <h2>Article 4. Branch owners and licenses</h2>
        <ol>
          <li>Branch owners must be verified by Brew Lab before they can open a branch, and every branch must be approved before customers can see it.</li>
          <li>An approved branch receives a license valid for one (1) year. The license renews for another year only if the branch records at least ₱100,000 in paid sales through Brew Lab during the license year. Otherwise it expires and the branch stops accepting online orders until Brew Lab issues a new license.</li>
          <li>Each branch pays Brew Lab a platform fee of thirty percent (30%) of its paid sales through Brew Lab, settled monthly. Brew Lab shows the amount due in the branch dashboard and records each payment.</li>
          <li>Owners must hold all permits required by law, follow food safety and sanitation standards, and treat customers and employees fairly.</li>
          <li>The payroll feature is a record-keeping log only. Brew Lab does not pay employees or handle wages, and owners remain responsible for their legal obligations as employers. Owners confirm they may share their employees&apos; names, emails and receiving accounts with Brew Lab so payslips can be generated and emailed.</li>
          <li>Brew Lab may suspend a branch or revoke its license for breach of these Terms or the law.</li>
        </ol>
      </section>

      <section>
        <h2>Article 5. Use of your personal data</h2>
        <p>By creating an account, you consent to Brew Lab processing your personal data as follows:</p>
        <ol>
          <li><strong>Service:</strong> we use your name, email, and order details to run your account, prepare your orders, and issue receipts.</li>
          <li><strong>Sharing with branches:</strong> the branch you order from receives your pickup name, order and notes, only to fulfill that order.</li>
          <li><strong>Branch operations:</strong> branch owners consent to Brew Lab using their identity, business, sales and payroll records to verify them, issue and renew licenses, and prepare platform-wide financial reports.</li>
          <li><strong>Security:</strong> we record sign-ins (time, IP address, browser) and changes made in accounts in an activity log visible to our administrator, to protect users and investigate misuse.</li>
          <li><strong>Legal compliance:</strong> we keep records required by law and disclose data to authorities only when legally required.</li>
          <li><strong>Personalized offers (optional):</strong> only if you opt in, we use your order history to learn your preferences and send you offers. Opting in is never required to use Brew Lab.</li>
          <li><strong>Anonymous statistics:</strong> we may combine all orders into anonymous statistics (for example, popular ingredients and busy hours) and share or sell those statistics. They never include your name, contact details or individual order history.</li>
          <li><strong>Limits:</strong> we will not sell your personal data, or use it for marketing without your separate, express consent.</li>
          <li><strong>Withdrawal:</strong> you may withdraw your consent and ask for your account to be deleted at any time by emailing {email}. Records we must keep by law are retained only for as long as required.</li>
        </ol>
        <p>
          More detail is in our <Link href="/privacy" className="text-accent underline">Privacy Notice</Link>.
        </p>
      </section>

      <section>
        <h2>Article 6. Acceptable use</h2>
        <p>
          You must not misuse Brew Lab: no fake orders, attempts to access other people&apos;s accounts or data, interference
          with the site&apos;s security, automated scraping, or unlawful, abusive or misleading content.
        </p>
      </section>

      <section>
        <h2>Article 7. Intellectual property</h2>
        <p>The Brew Lab name, design and software belong to Brew Lab. Your saved recipes remain yours.</p>
      </section>

      <section>
        <h2>Article 8. Liability</h2>
        <p>
          We work to keep Brew Lab available and accurate, but the service is provided “as is”. To the extent allowed by law,
          Brew Lab is not liable for indirect losses, or for a branch&apos;s products and services, which are the
          responsibility of that branch. Nothing in these Terms limits rights you have under the Consumer Act of the
          Philippines.
        </p>
      </section>

      <section>
        <h2>Article 9. Suspension and termination</h2>
        <p>
          You may stop using Brew Lab at any time. We may suspend or close accounts that breach these Terms, after notice
          where practical.
        </p>
      </section>

      <section>
        <h2>Article 10. Changes</h2>
        <p>We may update these Terms. We will post the new version here, and significant changes will be announced by email.</p>
      </section>

      <section>
        <h2>Article 11. Governing law</h2>
        <p>These Terms are governed by the laws of the Republic of the Philippines.</p>
      </section>

      <section>
        <h2>Article 12. Contact</h2>
        <p>
          Questions about these Terms: <a href={`mailto:${email}`} className="text-accent underline">{email}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
