import { useState, useEffect } from 'react';
import { initGA, trackPageView } from '@/lib/analytics';
import { initMetaPixel, pixelPageView } from '@/lib/metaPixel';

const CONSENT_KEY = 'grabio_cookie_consent';

export type ConsentStatus = 'accepted' | 'declined' | null;

export function getCookieConsent(): ConsentStatus {
  try {
    return (localStorage.getItem(CONSENT_KEY) as ConsentStatus) ?? null;
  } catch {
    return null;
  }
}

export function setCookieConsent(status: 'accepted' | 'declined') {
  try {
    localStorage.setItem(CONSENT_KEY, status);
  } catch {
    // ignore
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (getCookieConsent() === null) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    setCookieConsent('accepted');
    setVisible(false);
    initGA();
    initMetaPixel();
    trackPageView(window.location.pathname + window.location.search);
    pixelPageView();
  };

  const handleDecline = () => {
    setCookieConsent('declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-5">
        <div className="flex items-start gap-4">
          <span className="text-3xl flex-shrink-0">🍪</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-base mb-1">We use cookies</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              We use cookies and similar tracking technologies to improve your browsing experience,
              analyze site traffic, and show personalized content.{' '}
              <button
                className="text-indigo-600 underline hover:text-indigo-800 text-sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide details' : 'Learn more'}
              </button>
            </p>

            {showDetails && (
              <div className="mt-3 text-sm text-gray-600 space-y-2 bg-gray-50 rounded-lg p-3">
                <p>
                  <strong>Essential cookies</strong> — Always active. Required for the site to function
                  (cart, authentication, order tracking).
                </p>
                <p>
                  <strong>Analytics cookies (Google Analytics 4)</strong> — Measures how visitors interact
                  with our site. Helps us improve the experience.
                </p>
                <p>
                  <strong>Marketing cookies (Meta Pixel)</strong> — Used to show relevant ads on Facebook
                  and Instagram, and measure ad campaign performance.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            onClick={handleAccept}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
          >
            Decline Optional
          </button>
        </div>
      </div>
    </div>
  );
}
