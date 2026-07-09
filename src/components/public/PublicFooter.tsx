import React from 'react';
import { Link } from 'react-router-dom';
import PoweredByEmoove from '@/components/PoweredByEmoove';

const PublicFooter: React.FC = () => (
  <footer className="bg-gray-900 text-gray-400 mt-auto">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Link to="/home" className="text-white font-bold text-xl hover:text-teal-400 transition-colors">
            Grabio
          </Link>
          <p className="mt-3 text-sm leading-relaxed">
            All-in-one business management platform for modern commerce. POS, inventory, invoicing, and marketplace in one place.
          </p>
        </div>

        {/* Product */}
        <div>
          <h3 className="text-white font-semibold text-sm mb-4">Product</h3>
          <ul className="space-y-2 text-sm list-none p-0 m-0">
            <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
            <li><Link to="/use-cases" className="hover:text-white transition-colors">Use Cases</Link></li>
            <li><Link to="/search" className="hover:text-white transition-colors">Marketplace</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h3 className="text-white font-semibold text-sm mb-4">Company</h3>
          <ul className="space-y-2 text-sm list-none p-0 m-0">
            <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
            <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
          </ul>
        </div>

        {/* Get Started */}
        <div className="col-span-2 md:col-span-1">
          <h3 className="text-white font-semibold text-sm mb-4">Get Started</h3>
          <ul className="space-y-2 text-sm list-none p-0 m-0 mb-4">
            <li><Link to="/login?tab=signup" className="hover:text-white transition-colors">Create Account</Link></li>
            <li><Link to="/login" className="hover:text-white transition-colors">Sign In</Link></li>
          </ul>
          <Link
            to="/login?tab=signup"
            className="block w-full sm:w-auto sm:inline-block text-center px-4 py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors"
          >
            Get Started Free →
          </Link>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <p>© {new Date().getFullYear()} Grabio. All rights reserved.</p>
        <p className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
          <PoweredByEmoove variant="muted" className="text-gray-500 hover:text-gray-300" />
          <span className="hidden sm:inline text-gray-700">·</span>
          <span>
            Built for small businesses that need serious tools.{' '}
            <a href="mailto:support@grabio.space" className="hover:text-white transition-colors">
              support@grabio.space
            </a>
          </span>
        </p>
      </div>
    </div>
  </footer>
);

export default PublicFooter;
