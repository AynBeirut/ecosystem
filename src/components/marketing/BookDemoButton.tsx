import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';

/** Phase 2 / multi-branch — design-system CTA, not used above fold on Phase 1 pages */
type Props = {
  className?: string;
  source?: string;
};

const BookDemoButton: React.FC<Props> = ({
  className = '',
  source = 'marketing',
}) => (
  <Link
    to={`/contact?intent=book-demo&source=${encodeURIComponent(source)}`}
    className={
      className ||
      'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900'
    }
  >
    <CalendarDays className="h-4 w-4" aria-hidden />
    Book a demo
  </Link>
);

export default BookDemoButton;
