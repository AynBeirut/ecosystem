import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Clock,
  Coins,
  CreditCard,
  Factory,
  FileEdit,
  FileSignature,
  FileText,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  Layout,
  Lightbulb,
  Link2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Monitor,
  Newspaper,
  Package,
  PenLine,
  Receipt,
  RefreshCw,
  ScanLine,
  Search,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  UtensilsCrossed,
  Zap,
  Lock,
  Wallet,
} from 'lucide-react';

export type ModuleAccent = {
  /** Tailwind gradient for 3D icon tile */
  gradient: string;
  /** Icon stroke on tile */
  iconClass: string;
  /** Soft glow on hover */
  glow: string;
};

export const MODULE_ICON_MAP: Record<string, { Icon: LucideIcon; accent: ModuleAccent }> = {
  invoicing: {
    Icon: FileText,
    accent: {
      gradient: 'from-slate-600 to-slate-800',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-slate-500/25',
    },
  },
  marketplace: {
    Icon: Store,
    accent: {
      gradient: 'from-teal-500 to-emerald-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-teal-500/30',
    },
  },
  analytics: {
    Icon: BarChart3,
    accent: {
      gradient: 'from-indigo-500 to-violet-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-indigo-500/30',
    },
  },
  payments: {
    Icon: CreditCard,
    accent: {
      gradient: 'from-sky-500 to-blue-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-sky-500/30',
    },
  },
  delivery: {
    Icon: Truck,
    accent: {
      gradient: 'from-orange-500 to-amber-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-orange-500/30',
    },
  },
  stock: {
    Icon: Package,
    accent: {
      gradient: 'from-cyan-500 to-teal-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-cyan-500/30',
    },
  },
  factory: {
    Icon: Factory,
    accent: {
      gradient: 'from-zinc-600 to-stone-800',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-zinc-500/25',
    },
  },
  restaurant: {
    Icon: UtensilsCrossed,
    accent: {
      gradient: 'from-rose-500 to-red-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-rose-500/30',
    },
  },
  crm: {
    Icon: Target,
    accent: {
      gradient: 'from-fuchsia-500 to-purple-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-fuchsia-500/30',
    },
  },
  domainPackage: {
    Icon: Globe,
    accent: {
      gradient: 'from-blue-500 to-indigo-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-blue-500/30',
    },
  },
  whatsappBusiness: {
    Icon: MessageCircle,
    accent: {
      gradient: 'from-emerald-500 to-green-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-emerald-500/30',
    },
  },
  extraStorage: {
    Icon: HardDrive,
    accent: {
      gradient: 'from-slate-500 to-gray-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-slate-500/25',
    },
  },
  team: {
    Icon: Users,
    accent: {
      gradient: 'from-violet-500 to-purple-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-violet-500/30',
    },
  },
  dropship: {
    Icon: Link2,
    accent: {
      gradient: 'from-pink-500 to-rose-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-pink-500/30',
    },
  },
  services: {
    Icon: RefreshCw,
    accent: {
      gradient: 'from-teal-500 to-cyan-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-teal-500/30',
    },
  },
  projects: {
    Icon: Briefcase,
    accent: {
      gradient: 'from-amber-500 to-orange-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-amber-500/30',
    },
  },
  builder: {
    Icon: Layout,
    accent: {
      gradient: 'from-indigo-500 to-blue-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-indigo-500/30',
    },
  },
  ai_builder: {
    Icon: Sparkles,
    accent: {
      gradient: 'from-violet-500 to-fuchsia-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-violet-500/35',
    },
  },
  blog_publisher: {
    Icon: Newspaper,
    accent: {
      gradient: 'from-slate-500 to-slate-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-slate-500/25',
    },
  },
  timesheet_attendance: {
    Icon: Clock,
    accent: {
      gradient: 'from-blue-500 to-slate-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-blue-500/30',
    },
  },
  recruitment_ats: {
    Icon: UserPlus,
    accent: {
      gradient: 'from-indigo-500 to-violet-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-indigo-500/30',
    },
  },
  expense_ocr: {
    Icon: ScanLine,
    accent: {
      gradient: 'from-teal-500 to-emerald-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-teal-500/30',
    },
  },
  shopify_importer: {
    Icon: ShoppingBag,
    accent: {
      gradient: 'from-lime-500 to-green-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-lime-500/30',
    },
  },
  localized_logistics: {
    Icon: MapPin,
    accent: {
      gradient: 'from-orange-500 to-red-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-orange-500/30',
    },
  },
  whatsapp_marketing_engine: {
    Icon: MessagesSquare,
    accent: {
      gradient: 'from-emerald-500 to-teal-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-emerald-500/30',
    },
  },
  dual_currency_accounting: {
    Icon: Coins,
    accent: {
      gradient: 'from-yellow-500 to-amber-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-amber-500/30',
    },
  },
  legal_esign: {
    Icon: FileSignature,
    accent: {
      gradient: 'from-slate-600 to-indigo-800',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-indigo-500/25',
    },
  },
  plm_eco: {
    Icon: GitBranch,
    accent: {
      gradient: 'from-cyan-600 to-blue-800',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-cyan-500/30',
    },
  },
  admin_mobile: {
    Icon: Smartphone,
    accent: {
      gradient: 'from-teal-500 to-emerald-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-teal-500/30',
    },
  },
  pos: {
    Icon: Monitor,
    accent: {
      gradient: 'from-slate-600 to-zinc-800',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-slate-500/25',
    },
  },
  invoice_manager: {
    Icon: Receipt,
    accent: {
      gradient: 'from-sky-500 to-indigo-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-sky-500/30',
    },
  },
  whitelabel: {
    Icon: Layers,
    accent: {
      gradient: 'from-purple-500 to-violet-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-purple-500/30',
    },
  },
  ai_agent: {
    Icon: Bot,
    accent: {
      gradient: 'from-violet-500 to-purple-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-violet-500/35',
    },
  },
  content_creator: {
    Icon: PenLine,
    accent: {
      gradient: 'from-pink-500 to-fuchsia-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-pink-500/30',
    },
  },
  market_strategy: {
    Icon: TrendingUp,
    accent: {
      gradient: 'from-emerald-500 to-teal-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-emerald-500/30',
    },
  },
  email_marketing: {
    Icon: Mail,
    accent: {
      gradient: 'from-blue-500 to-indigo-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-blue-500/30',
    },
  },
  proposal_writer: {
    Icon: FileEdit,
    accent: {
      gradient: 'from-amber-500 to-orange-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-amber-500/30',
    },
  },
  seo_assistant: {
    Icon: Search,
    accent: {
      gradient: 'from-cyan-500 to-teal-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-cyan-500/30',
    },
  },
  analytics_insights: {
    Icon: Lightbulb,
    accent: {
      gradient: 'from-yellow-500 to-amber-600',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-yellow-500/30',
    },
  },
  campaign_writer: {
    Icon: Megaphone,
    accent: {
      gradient: 'from-rose-500 to-pink-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-rose-500/30',
    },
  },
};

export const PLATFORM_CAPABILITY_ICONS: Record<
  string,
  { Icon: LucideIcon; accent: ModuleAccent }
> = {
  'One Account': {
    Icon: Layers,
    accent: {
      gradient: 'from-teal-500 to-emerald-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-teal-500/30',
    },
  },
  'Admin Android App': {
    Icon: Smartphone,
    accent: {
      gradient: 'from-slate-600 to-slate-800',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-slate-500/25',
    },
  },
  'Secure by Default': {
    Icon: Shield,
    accent: {
      gradient: 'from-indigo-500 to-violet-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-indigo-500/30',
    },
  },
  'Real-Time Sync': {
    Icon: Zap,
    accent: {
      gradient: 'from-amber-500 to-orange-600',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-amber-500/30',
    },
  },
  'Dual Currency': {
    Icon: Wallet,
    accent: {
      gradient: 'from-yellow-500 to-amber-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-amber-500/30',
    },
  },
  'Push Alerts': {
    Icon: Bell,
    accent: {
      gradient: 'from-rose-500 to-red-600',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-rose-500/30',
    },
  },
  'AI Growth Tools': {
    Icon: Sparkles,
    accent: {
      gradient: 'from-violet-500 to-fuchsia-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-violet-500/35',
    },
  },
  'White-Label': {
    Icon: Globe,
    accent: {
      gradient: 'from-blue-500 to-indigo-700',
      iconClass: 'text-white',
      glow: 'group-hover:shadow-blue-500/30',
    },
  },
};

const FALLBACK = {
  Icon: Layers,
  accent: {
    gradient: 'from-slate-500 to-slate-700',
    iconClass: 'text-white',
    glow: 'group-hover:shadow-slate-500/25',
  },
} as const;

export function getModuleIcon(moduleId: string) {
  return MODULE_ICON_MAP[moduleId] ?? FALLBACK;
}

export function getPlatformCapabilityIcon(title: string) {
  return PLATFORM_CAPABILITY_ICONS[title] ?? FALLBACK;
}
