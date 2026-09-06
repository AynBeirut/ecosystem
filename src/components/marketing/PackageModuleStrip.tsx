import React from 'react';
import { MODULE_CATALOG } from '@/lib/pricingDisplay';

type Props = {
  moduleIds: string[];
  title: string;
  labelOverrides?: Record<string, string>;
};

const PackageModuleStrip: React.FC<Props> = ({ moduleIds, title, labelOverrides }) => {
  const modules = MODULE_CATALOG.filter((m) => moduleIds.includes(m.id));

  if (modules.length === 0) return null;

  return (
    <section className="public-panel">
      <h2 className="text-xl font-bold text-slate-900 mb-4">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {modules.map((mod) => (
          <span
            key={mod.id}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {labelOverrides?.[mod.id] ?? mod.name}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Modular — add or remove capabilities as your operation grows.
      </p>
    </section>
  );
};

export default PackageModuleStrip;
