export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Grabio Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 21, 2026</p>

      <section className="mb-6">
        <p>
          Grabio (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Grabio mobile application and website.
          This Privacy Policy explains how we collect, use, and protect your personal information when you use our services.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Account information:</strong> Name, email address, and profile photo when you sign in with Google.</li>
          <li><strong>Order information:</strong> Items ordered, delivery address, and order history.</li>
          <li><strong>Device information:</strong> Device token for push notifications.</li>
          <li><strong>Camera:</strong> Used only when you choose to upload a product or profile photo. Images are not shared without your consent.</li>
          <li><strong>Location data:</strong> For authorized sales representatives using Sales CRM, approximate location is collected only when logging a field visit with permission. Location is not collected in the background.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To process and fulfill your orders</li>
          <li>To send push notifications about your orders</li>
          <li>To authenticate your account securely</li>
          <li>To support Sales CRM workflows for authorized store representatives</li>
          <li>To improve our services</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">3. Data Sharing</h2>
        <p>We do not sell or rent your personal data. We share data only with:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>Firebase (Google):</strong> For authentication, database, and push notifications</li>
          <li>Store owners, only the information needed to fulfill your orders</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">4. Location Data</h2>
        <p>
          Location is optional and used only for Sales CRM visit logging by authorized representatives.
          We do not use location for advertising or unrelated tracking.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">5. Data Retention</h2>
        <p>We retain your data for as long as your account is active. You may request deletion of your account and data by contacting us.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">6. Security</h2>
        <p>We use industry-standard security measures including encrypted connections (HTTPS) and Firebase security rules to protect your data.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">7. Children&apos;s Privacy</h2>
        <p>Our services are not directed to children under 13. We do not knowingly collect data from children under 13.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">8. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. Contact us at the email below to exercise these rights.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">9. Contact Us</h2>
        <p>If you have questions about this policy, contact us at: <a href="mailto:support@grabio.space" className="text-blue-600 underline">support@grabio.space</a></p>
      </section>
    </div>
  );
}
