import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  LayoutTemplate,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import type { DemoOsModule, DemoOsModuleId } from '@/data/marketing/demoOsCatalog';
import { DEMO_OS_MODULE_LIST, demoOsIndexPath, demoOsModulePath, modulesByGroup } from '@/data/marketing/demoOsCatalog';
import { cn } from '@/lib/utils';

const MODULE_ICONS: Partial<Record<DemoOsModuleId, React.ComponentType<{ className?: string }>>> = {
  dashboard: BarChart3,
  'v-pos': ShoppingCart,
  orders: Package,
  products: Package,
  inventory: Package,
  purchases: ShoppingCart,
  invoices: Receipt,
  expenses: Wallet,
  accounting: Wallet,
  'crm-pipeline': Users,
  'theme-editor': LayoutTemplate,
  'ai-assistant': Bot,
};

type Props = {
  activeModuleId: DemoOsModuleId;
  signupHref: string;
  moduleLinkBuilder?: (moduleId: DemoOsModuleId) => string;
  children: React.ReactNode;
};

const DemoOsLayout: React.FC<Props> = ({
  activeModuleId,
  signupHref,
  moduleLinkBuilder = demoOsModulePath,
  children,
}) => {
  const location = useLocation();
  const active = DEMO_OS_MODULE_LIST.find((m) => m.id === activeModuleId);
  const grouped = modulesByGroup();

  return (
    <div className="demo-os-layout" data-admin-theme="light">
      <aside className="demo-os-sidebar" aria-label="Demo admin navigation">
        <div className="demo-os-sidebar-brand">
          <Link to="/" className="demo-os-sidebar-logo">Grabio</Link>
          <span className="demo-os-sidebar-badge">Demo mode</span>
        </div>
        <nav className="demo-os-sidebar-nav">
          <Link
            to={demoOsIndexPath()}
            className={cn('demo-os-nav-item', location.pathname === demoOsIndexPath() && 'is-active')}
          >
            All screens
          </Link>
          {grouped.map(({ group, meta, modules }) => (
            <div key={group} className="demo-os-nav-group">
              <p className="demo-os-nav-group-label">{meta.title}</p>
              {modules.map((mod) => {
                const Icon = MODULE_ICONS[mod.id];
                const href = moduleLinkBuilder(mod.id);
                return (
                  <Link
                    key={mod.id}
                    to={href}
                    className={cn('demo-os-nav-item', mod.id === activeModuleId && 'is-active')}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />}
                    <span>{mod.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="demo-os-sidebar-footer">
          <Link to={signupHref} className="demo-os-sidebar-cta">
            Sign in free
          </Link>
        </div>
      </aside>

      <div className="demo-os-main">
        <header className="demo-os-topbar">
          <div>
            <p className="demo-os-topbar-eyebrow">Read-only preview</p>
            <h1 className="demo-os-topbar-title">{active?.adminLabel ?? 'Grabio Admin'}</h1>
          </div>
          <div className="demo-os-topbar-actions">
            <span className="demo-os-topbar-pill">Sample data</span>
            <Link to={signupHref} className="demo-os-topbar-signin">
              Sign in
            </Link>
          </div>
        </header>
        <div className="demo-os-content">{children}</div>
      </div>
    </div>
  );
};

export default DemoOsLayout;
