import React from 'react';
import { Link } from 'react-router-dom';
import { adminSubnavLink } from '@/lib/adminStyles';
import type { LucideIcon } from 'lucide-react';

export type BusinessFinanceHubItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  external?: boolean;
};

export function BusinessFinanceHubSection({ title, items }: { title: string; items: BusinessFinanceHubItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const className = `${adminSubnavLink(false)} flex flex-col items-start gap-1 h-auto py-3 text-left w-full`;
          return (
            <Link key={item.to + item.label} to={item.to} className={className}>
              <span className="flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </span>
              <span className="text-xs font-normal text-gray-600">{item.description}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

type BusinessFinanceHubLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function BusinessFinanceHubLayout({ title, description, children }: BusinessFinanceHubLayoutProps) {
  return (
    <div className="space-y-8 rounded-lg border bg-white p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** White frame for embedded finance modules (Quotation, Reçu, deep-linked reports). */
export function BusinessFinancePageFrame({
  title,
  description,
  backTo,
  backLabel = 'Back',
  children,
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-white p-4 md:p-6">
      {backTo ? (
        <Link to={backTo} className="text-sm text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1">
          ← {backLabel}
        </Link>
      ) : null}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {description ? <p className="text-sm text-gray-600 mt-1">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
