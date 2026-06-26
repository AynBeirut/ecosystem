import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  eyebrow?: string;
};

export default function AdminPageHero({
  title,
  description,
  backTo,
  backLabel = 'Back',
  eyebrow = 'Grabio Ecosystem',
}: Props) {
  return (
    <section className="relative mb-6 rounded-xl bg-[#0b1220] text-white py-4 px-4 md:px-5 overflow-hidden">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.25) 0%, transparent 40%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      <div className="relative">
        {backTo && (
          <div className="mb-5">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to={backTo}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          </div>
        )}

        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/90 mb-3">
          <span className="h-px w-6 bg-teal-400/50" />
          {eyebrow}
          <span className="h-px w-6 bg-teal-400/50" />
        </p>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-1">{title}</h1>
        {description && <p className="text-sm text-slate-300 max-w-2xl">{description}</p>}
      </div>
    </section>
  );
}
