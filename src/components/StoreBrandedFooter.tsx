import React from 'react';
import { Link } from 'react-router-dom';

interface StoreBrandedFooterProps {
  storeName: string;
  logo?: string;
  contactEmail?: string;
  contactPhone?: string;
  primaryColor?: string;
  contactLabel?: string;
  contactHref?: string;
}

const StoreBrandedFooter: React.FC<StoreBrandedFooterProps> = ({
  storeName,
  logo,
  contactEmail,
  contactPhone,
  primaryColor,
  contactLabel = 'Contact Us',
  contactHref = '/contact',
}) => {
  const year = new Date().getFullYear();
  const accent = primaryColor || '#38B2AC';

  return (
    <footer
      className="w-full border-t mt-8 py-8"
      style={{ backgroundColor: `${accent}12` }}
    >
      <div className="container mx-auto px-4 flex flex-col items-center gap-3 text-center">
        {logo && (
          <span className="inline-flex h-14 w-14 overflow-hidden rounded-full ring-2 ring-black/5 shadow-sm">
            <img src={logo} alt={storeName} className="h-full w-full object-cover" />
          </span>
        )}
        <p className="text-sm font-semibold text-gray-900">{storeName}</p>
        <p className="text-xs text-gray-500">© {year} {storeName}</p>
        <div className="text-xs text-gray-600 flex flex-wrap items-center justify-center gap-2">
          <Link to={contactHref} className="font-medium hover:underline" style={{ color: accent }}>
            {contactLabel}
          </Link>
          {contactEmail && (
            <>
              <span className="text-gray-300">·</span>
              <a href={`mailto:${contactEmail}`} className="hover:underline" style={{ color: accent }}>
                {contactEmail}
              </a>
            </>
          )}
          {contactPhone && (
            <>
              <span className="text-gray-300">·</span>
              <a href={`tel:${contactPhone}`} className="hover:underline" style={{ color: accent }}>
                {contactPhone}
              </a>
            </>
          )}
        </div>
      </div>
    </footer>
  );
};

export default StoreBrandedFooter;
