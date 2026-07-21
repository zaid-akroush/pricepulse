export default function PrivacyPolicy() {
  const updated = 'July 16, 2026';

  const Section = ({ title, children }) => (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-app mb-3">{title}</h2>
      <div className="text-sm text-muted leading-relaxed space-y-3">{children}</div>
    </div>
  );

  return (
    <div className="bg-app min-h-screen">
      <div className="bg-app-subtle border-b border-app py-14 px-4 text-center">
        <p className="eyebrow mb-3">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight text-app">Privacy Policy</h1>
        <p className="text-muted mt-2 text-sm">Last updated: {updated}</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="card p-6 md:p-10">
          <p className="text-sm text-muted leading-relaxed mb-8">
            PricePulse is an electronics price tracking project built for academic purposes. This
            policy explains what information we collect, why we collect it, and how you can
            control it. By creating an account or using the site, you agree to the practices
            described below.
          </p>

          <Section title="1. Information We Collect">
            <p>
              <strong className="text-app">Account information.</strong> When you register, we
              store your name, email address, and a securely hashed password. We never store your
              password in plain text.
            </p>
            <p>
              <strong className="text-app">Wishlist and tracking activity.</strong> Products you
              search for, add to your wishlist, target prices you set, likes, comments, and
              searches you save are stored so we can show you your history and check prices on
              your behalf.
            </p>
            <p>
              <strong className="text-app">Social features.</strong> If you follow other users or
              share a wishlist, we store that connection and generate a share link tied to your
              account.
            </p>
            <p>
              <strong className="text-app">Notifications.</strong> If you enable browser push
              alerts, we store the push subscription your browser provides so we can deliver
              price-drop notifications. In-app notifications are stored until you clear them.
            </p>
            <p>
              <strong className="text-app">Technical data.</strong> Standard request metadata
              (such as IP address and browser type) may be logged temporarily for security and
              rate-limiting purposes.
            </p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information above to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Operate your account, wishlist, and saved searches</li>
              <li>Check tracked product prices roughly every six hours and record price history</li>
              <li>Send email or push alerts when a tracked product hits your target price</li>
              <li>Show community features like leaderboards and shared wishlists, when you choose to use them</li>
              <li>Protect the service against abuse, such as excessive login attempts</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </Section>

          <Section title="3. Cookies and Local Storage">
            <p>
              PricePulse stores a login token in your browser's local storage to keep you signed
              in. It also remembers your light/dark mode preference locally. These values stay on
              your device and are used only to operate the site; we do not use third-party
              advertising cookies.
            </p>
          </Section>

          <Section title="4. Third-Party Services">
            <p>
              Product search results are retrieved from Google Shopping via a third-party search
              API. Password reset and price alert emails are sent through a transactional email
              provider. These providers process the minimum data needed to perform their function
              (such as a search query or an email address and message body) and are not permitted
              to use it for their own marketing.
            </p>
          </Section>

          <Section title="5. Data Retention and Deletion">
            <p>
              We keep your account and activity data for as long as your account is active. You
              can remove items from your wishlist, unfollow other users, and disable push
              notifications at any time from your account settings. To request full deletion of
              your account and associated data, contact us using the details below.
            </p>
          </Section>

          <Section title="6. Your Choices">
            <ul className="list-disc pl-5 space-y-1">
              <li>Update your name, email, or password from your profile page</li>
              <li>Turn browser push alerts on or off at any time</li>
              <li>Delete individual wishlist items, saved searches, or comments</li>
              <li>Log out to clear your local session token</li>
            </ul>
          </Section>

          <Section title="7. Children's Privacy">
            <p>
              PricePulse is not directed at children under 13, and we do not knowingly collect
              information from them.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this policy as the project evolves. Material changes will be reflected
              by updating the date at the top of this page.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              Questions about this policy or your data can be sent to{' '}
              <a href="mailto:support@pricepulse.app" className="text-brand font-semibold">
                support@pricepulse.app
              </a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
