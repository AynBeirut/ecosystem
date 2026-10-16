import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OpsShellSection } from '@/lib/hrVenueOpsShell';

type LegacyLink = { to: string; label: string };

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  sections: OpsShellSection[];
  active: OpsShellSection;
  notes: string[];
  legacyLinks?: LegacyLink[];
  children?: ReactNode;
};

export default function OpsHubShell({
  eyebrow,
  title,
  description,
  sections,
  active,
  notes,
  legacyLinks = [],
  children,
}: Props) {
  return (
    <AdminPageShell eyebrow={eyebrow} title={title} description={description}>
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => {
          const selected = section.id === active.id;
          return (
            <Link
              key={section.id}
              to={section.path}
              className={
                selected
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700'
              }
              aria-current={selected ? 'page' : undefined}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
      <AdminPanel>
        <CardHeader>
          <CardTitle>{active.label}</CardTitle>
          <CardDescription>{active.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {legacyLinks.length > 0 ? (
            <div className="flex flex-wrap gap-3 pt-2">
              {legacyLinks.map((link) => (
                <Link key={link.to} to={link.to} className="text-sm font-medium text-teal-800 underline">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
          {children}
        </CardContent>
      </AdminPanel>
    </AdminPageShell>
  );
}
