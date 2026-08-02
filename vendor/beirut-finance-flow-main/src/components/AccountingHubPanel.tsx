import { Link } from "react-router-dom";
import { BookOpen, FileText, Scale } from "lucide-react";

type HubItem = {
  to: string;
  label: string;
  description: string;
  icon: typeof FileText;
};

const PRIMARY_ITEMS: HubItem[] = [
  {
    to: "/admin/finance/accounting?tab=vouchers",
    label: "Vouchers",
    description: "JV, PV, RV, CV — sales, purchases, and manual entries.",
    icon: FileText,
  },
  {
    to: "/admin/finance/accounting?tab=workspace",
    label: "Workspace",
    description: "Accountant desk — quick post, drafts, and review.",
    icon: BookOpen,
  },
  {
    to: "/admin/finance/accounting?tab=party-soa",
    label: "Party statement",
    description: "Customer or supplier balance from the ledger.",
    icon: Scale,
  },
];

const linkClass =
  "admin-subnav-link flex flex-col items-start gap-1 h-auto py-3 px-3 text-left w-full rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors";

export default function AccountingHubPanel() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Daily accounting</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={linkClass}>
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <Icon className="h-4 w-4 shrink-0 text-teal-700" />
                  {item.label}
                </span>
                <span className="text-xs font-normal text-slate-600">{item.description}</span>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
        <p>
          <strong className="text-slate-800">Reports</strong> (trial balance, P&amp;L, aging, VAT) and{" "}
          <strong className="text-slate-800">Settings</strong> (COA, FX, import) live on their own tabs — not here.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link to="/admin/finance/reports" className="text-teal-700 font-medium hover:underline">
            Open Reports →
          </Link>
          <Link to="/admin/finance/settings" className="text-teal-700 font-medium hover:underline">
            Open Settings →
          </Link>
        </div>
      </section>
    </div>
  );
}
