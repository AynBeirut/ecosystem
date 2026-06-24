import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const year = new Date().getFullYear();
  const isHome = location.pathname === '/';
  const isLogin = location.pathname === '/login';

  return (
    <footer className="w-full bg-gray-100 border-t py-4 mt-8 flex flex-col items-center gap-2">
      <div className="text-xs text-gray-500">
        © {year} Powered by{' '}
        <a href="https://www.aynbeirut.cm" target="_blank" rel="noopener noreferrer" className="text-market-primary hover:underline">
          AYN BEIRUT
        </a>
      </div>
      <div className="text-xs text-gray-600 flex items-center gap-2">
        <Link to="/contact" className="text-market-primary hover:underline font-medium">Contact Us</Link>
        <span className="text-gray-400">·</span>
        <a href="mailto:support@grabio.space" className="text-market-primary hover:underline">support@grabio.space</a>
      </div>
      {!isHome && !isLogin && (
        <button
          onClick={() => navigate('/search')}
          className="px-4 py-2 rounded bg-market-primary text-white hover:bg-market-primary/90 text-xs font-medium"
        >
          Go to Marketplace
        </button>
      )}
    </footer>
  );
};

export default Footer;
