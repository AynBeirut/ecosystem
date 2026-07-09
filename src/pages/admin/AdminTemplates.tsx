import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuth } from 'firebase/auth';
import { useModuleEntitlement } from '@/hooks/useModuleEntitlement';
import { getApiBaseUrl } from '@/lib/apiBase';
import {
  Palette, Eye, Check, Upload, Trash2, ChevronLeft, ChevronRight,
  LayoutGrid, Layers, Settings2, Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  extractSectionOrderFromDesignImport,
  layoutImportFirestorePatch,
} from '@/lib/designImport';
import { assertCanUploadBytes, trackStorageUsageAfterUpload } from '@/lib/subscriptionEnforcement';
import type {
  ProductDisplayType, HeroLayout, MenuStyle, ContactFormStyle,
  RatingDisplayType, AboutLayout, StoreTemplateColors,
  ProductCardAnimation, PageLayout, StoreCardStyle, VisualStyle,
  StoreSectionId, StoreSectionOrder, SectionWidth, SectionAnimation,
} from '@/types/storeProfile';

// ── types ────────────────────────────────────────────────────────────────────
type TemplateId = 'modern' | 'minimalist' | 'minimal' | 'classic' | 'classic_ecom' | 'fashion_boutique' | 'food_restaurant' | 'tech_electronics' | 'vibrant' | 'professional' | 'artistic' | 'custom';
type TabId = 'templates' | 'colors' | 'layout' | 'sections';

type TemplateLayoutConfig = {
  heroLayout: HeroLayout;
  productDisplayType: ProductDisplayType;
  productCardAnimation: ProductCardAnimation;
  menuStyle: MenuStyle;
  aboutLayout: AboutLayout;
  contactFormStyle: ContactFormStyle;
  ratingDisplayType: RatingDisplayType;
  pageLayout: PageLayout;
  storeCardStyle: StoreCardStyle;
  visualStyle: VisualStyle;
};

type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  colors: string[];   // preview swatches (3 main)
  features: string[];
  isPremium: boolean;
  defaultPalette: Required<StoreTemplateColors>;
  layoutConfig?: TemplateLayoutConfig; // Optional for custom template
};

// ── color presets (10 per template) ─────────────────────────────────────────
const COLOR_PRESETS: Record<TemplateId, Array<{ name: string; palette: Required<StoreTemplateColors> }>> = {
  modern: [
    { name: 'Ocean Teal',    palette: { primary:'#38B2AC', secondary:'#2C5282', accent:'#ED8936', background:'#f0fdfd', surface:'#ffffff', textColor:'#1a202c', highlight:'#22d3ee' } },
    { name: 'Midnight Blue', palette: { primary:'#4299E1', secondary:'#1A365D', accent:'#F6AD55', background:'#EBF8FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#90CDF4' } },
    { name: 'Forest',        palette: { primary:'#38A169', secondary:'#276749', accent:'#F6E05E', background:'#F0FFF4', surface:'#ffffff', textColor:'#1C4532', highlight:'#9AE6B4' } },
    { name: 'Crimson',       palette: { primary:'#E53E3E', secondary:'#742A2A', accent:'#F6AD55', background:'#FFF5F5', surface:'#ffffff', textColor:'#1A202C', highlight:'#FEB2B2' } },
    { name: 'Indigo Pop',    palette: { primary:'#667EEA', secondary:'#434190', accent:'#FC8181', background:'#EBF4FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#A3BFFA' } },
    { name: 'Amber Storm',   palette: { primary:'#D69E2E', secondary:'#744210', accent:'#38B2AC', background:'#FFFFF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FAF089' } },
    { name: 'Rose Gold',     palette: { primary:'#B7791F', secondary:'#97266D', accent:'#F6AD55', background:'#FFF5F7', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBB6CE' } },
    { name: 'Slate',         palette: { primary:'#718096', secondary:'#2D3748', accent:'#38B2AC', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#CBD5E0' } },
    { name: 'Lime Fresh',    palette: { primary:'#68D391', secondary:'#2F855A', accent:'#F6AD55', background:'#F0FFF4', surface:'#ffffff', textColor:'#1A202C', highlight:'#C6F6D5' } },
    { name: 'Violet Dreams', palette: { primary:'#9F7AEA', secondary:'#553C9A', accent:'#F6AD55', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#D6BCFA' } },
  ],
  minimalist: [
    { name: 'Sandstone',      palette: { primary:'#6B7280', secondary:'#111827', accent:'#C08457', background:'#F8F6F1', surface:'#FFFFFF', textColor:'#111827', highlight:'#E7E5E4' } },
    { name: 'Cloud White',    palette: { primary:'#4B5563', secondary:'#0F172A', accent:'#94A3B8', background:'#FAFAFA', surface:'#FFFFFF', textColor:'#1F2937', highlight:'#E5E7EB' } },
    { name: 'Nordic Soft',    palette: { primary:'#334155', secondary:'#0B1120', accent:'#A8A29E', background:'#F5F7FA', surface:'#FFFFFF', textColor:'#111827', highlight:'#CBD5E1' } },
    { name: 'Clay Neutral',   palette: { primary:'#57534E', secondary:'#292524', accent:'#CA8A04', background:'#F7F5F2', surface:'#FFFFFF', textColor:'#1C1917', highlight:'#E7E5E4' } },
    { name: 'Mist Grey',      palette: { primary:'#6B7280', secondary:'#1F2937', accent:'#9CA3AF', background:'#F3F4F6', surface:'#FFFFFF', textColor:'#111827', highlight:'#D1D5DB' } },
    { name: 'Olive Paper',    palette: { primary:'#4D5D53', secondary:'#1F2937', accent:'#A16207', background:'#F7F8F4', surface:'#FFFFFF', textColor:'#111827', highlight:'#D9E2D3' } },
    { name: 'Latte Mono',     palette: { primary:'#6F6256', secondary:'#2E2A27', accent:'#B45309', background:'#FAF7F2', surface:'#FFFFFF', textColor:'#1F2937', highlight:'#E5D7C7' } },
    { name: 'Graphite Calm',  palette: { primary:'#374151', secondary:'#111827', accent:'#6B7280', background:'#F9FAFB', surface:'#FFFFFF', textColor:'#111827', highlight:'#E5E7EB' } },
    { name: 'Linen Blue',     palette: { primary:'#475569', secondary:'#0F172A', accent:'#64748B', background:'#F7FAFC', surface:'#FFFFFF', textColor:'#111827', highlight:'#CBD5E1' } },
    { name: 'Concrete',       palette: { primary:'#52525B', secondary:'#18181B', accent:'#71717A', background:'#FAFAFA', surface:'#FFFFFF', textColor:'#18181B', highlight:'#D4D4D8' } },
  ],
  minimal: [
    { name: 'Pure White',    palette: { primary:'#4A5568', secondary:'#2D3748', accent:'#718096', background:'#ffffff', surface:'#F7FAFC', textColor:'#1A202C', highlight:'#E2E8F0' } },
    { name: 'Cool Grey',     palette: { primary:'#607D8B', secondary:'#37474F', accent:'#90A4AE', background:'#ECEFF1', surface:'#ffffff', textColor:'#263238', highlight:'#CFD8DC' } },
    { name: 'Ink',           palette: { primary:'#2D3748', secondary:'#1A202C', accent:'#4A5568', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#A0AEC0' } },
    { name: 'Stone',         palette: { primary:'#78716C', secondary:'#44403C', accent:'#A8A29E', background:'#FAFAF9', surface:'#ffffff', textColor:'#1C1917', highlight:'#E7E5E4' } },
    { name: 'Bone',          palette: { primary:'#A0AEC0', secondary:'#718096', accent:'#CBD5E0', background:'#F7FAFC', surface:'#EDF2F7', textColor:'#2D3748', highlight:'#E2E8F0' } },
    { name: 'Charcoal',      palette: { primary:'#4A5568', secondary:'#1A202C', accent:'#ED8936', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBD38D' } },
    { name: 'Warm Minimal',  palette: { primary:'#6B6565', secondary:'#3D3333', accent:'#D69E2E', background:'#FFFDF7', surface:'#ffffff', textColor:'#1A202C', highlight:'#FAF089' } },
    { name: 'Steel',         palette: { primary:'#5F6B7A', secondary:'#2C3E50', accent:'#1ABC9C', background:'#F0F4F8', surface:'#ffffff', textColor:'#1A202C', highlight:'#A8D8EA' } },
    { name: 'Pebble',        palette: { primary:'#9E9E9E', secondary:'#616161', accent:'#FF7043', background:'#FAFAFA', surface:'#ffffff', textColor:'#212121', highlight:'#FFCCBC' } },
    { name: 'Black & White', palette: { primary:'#212121', secondary:'#000000', accent:'#9E9E9E', background:'#ffffff', surface:'#F5F5F5', textColor:'#212121', highlight:'#BDBDBD' } },
  ],
  classic: [
    { name: 'Navy Blue',     palette: { primary:'#2C5282', secondary:'#1A365D', accent:'#C05621', background:'#EBF8FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#90CDF4' } },
    { name: 'Royal',         palette: { primary:'#3182CE', secondary:'#2B6CB0', accent:'#F6AD55', background:'#EBF8FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#BEE3F8' } },
    { name: 'Oxford',        palette: { primary:'#1A365D', secondary:'#0F2344', accent:'#C05621', background:'#E8F0F8', surface:'#ffffff', textColor:'#1A202C', highlight:'#7EB3E3' } },
    { name: 'Claret',        palette: { primary:'#702459', secondary:'#521B41', accent:'#D69E2E', background:'#FFF5F7', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBB6CE' } },
    { name: 'British Green', palette: { primary:'#276749', secondary:'#1C4532', accent:'#B7791F', background:'#F0FFF4', surface:'#ffffff', textColor:'#1A202C', highlight:'#9AE6B4' } },
    { name: 'Burgundy',      palette: { primary:'#9B2335', secondary:'#6B1A24', accent:'#D69E2E', background:'#FFF5F5', surface:'#ffffff', textColor:'#1A202C', highlight:'#FEB2B2' } },
    { name: 'Sapphire',      palette: { primary:'#2A4E8C', secondary:'#19325C', accent:'#E07C1A', background:'#E8EFF9', surface:'#ffffff', textColor:'#1A202C', highlight:'#93B5E1' } },
    { name: 'Charcoal',      palette: { primary:'#2D3748', secondary:'#1A202C', accent:'#C05621', background:'#EDF2F7', surface:'#ffffff', textColor:'#1A202C', highlight:'#A0AEC0' } },
    { name: 'Hunter',        palette: { primary:'#285E61', secondary:'#1D4044', accent:'#B7791F', background:'#E6FFFA', surface:'#ffffff', textColor:'#1A202C', highlight:'#81E6D9' } },
    { name: 'Plum',          palette: { primary:'#553C9A', secondary:'#44337A', accent:'#C05621', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#D6BCFA' } },
  ],
  classic_ecom: [
    { name: 'Heritage Navy', palette: { primary:'#1E3A5F', secondary:'#0F2942', accent:'#C28B36', background:'#F5F7FA', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#D1E2F5' } },
    { name: 'Merchant Blue', palette: { primary:'#1D4E89', secondary:'#123561', accent:'#D19A3E', background:'#F2F6FB', surface:'#FFFFFF', textColor:'#111827', highlight:'#C7DBF2' } },
    { name: 'Old Gold',      palette: { primary:'#2C3E50', secondary:'#1B2A38', accent:'#B8872F', background:'#F8F7F3', surface:'#FFFFFF', textColor:'#111827', highlight:'#E9DFC6' } },
    { name: 'Regal Slate',   palette: { primary:'#334155', secondary:'#1E293B', accent:'#A16207', background:'#F8FAFC', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#D7E1EA' } },
    { name: 'Ivory Shop',    palette: { primary:'#3F4E5E', secondary:'#2A3642', accent:'#C08457', background:'#FBFAF6', surface:'#FFFFFF', textColor:'#1F2937', highlight:'#EADAC8' } },
    { name: 'Royal Shop',    palette: { primary:'#1E40AF', secondary:'#1E3A8A', accent:'#D97706', background:'#F3F6FD', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#CCD8F8' } },
    { name: 'Graphite Gold', palette: { primary:'#374151', secondary:'#1F2937', accent:'#B45309', background:'#F9FAFB', surface:'#FFFFFF', textColor:'#111827', highlight:'#E5D6BE' } },
    { name: 'Tradition',     palette: { primary:'#2F4858', secondary:'#1F3440', accent:'#B7791F', background:'#F5F8FA', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#D6E4ED' } },
    { name: 'Classic Ink',   palette: { primary:'#1F2937', secondary:'#111827', accent:'#A16207', background:'#F6F7F9', surface:'#FFFFFF', textColor:'#111827', highlight:'#D1D5DB' } },
    { name: 'Commerce Tan',  palette: { primary:'#4B5563', secondary:'#1F2937', accent:'#B97A31', background:'#FAF8F4', surface:'#FFFFFF', textColor:'#1F2937', highlight:'#EAD9C2' } },
  ],
  fashion_boutique: [
    { name: 'Runway Rose',    palette: { primary:'#8B5E7A', secondary:'#2E2330', accent:'#D4A373', background:'#FFF8FB', surface:'#FFFFFF', textColor:'#2A2230', highlight:'#F3D9E5' } },
    { name: 'Velvet Noir',    palette: { primary:'#5B3A59', secondary:'#1F1722', accent:'#C08A5B', background:'#FAF7FB', surface:'#FFFFFF', textColor:'#241C28', highlight:'#E8D8EA' } },
    { name: 'Champagne',      palette: { primary:'#9A7B5F', secondary:'#3B2F2A', accent:'#B86B77', background:'#FFFDF8', surface:'#FFFFFF', textColor:'#2E2522', highlight:'#F3E4D2' } },
    { name: 'Paris Plum',     palette: { primary:'#6D4A6F', secondary:'#2B1F2E', accent:'#C58F5A', background:'#FBF8FD', surface:'#FFFFFF', textColor:'#2A2230', highlight:'#E6DDEE' } },
    { name: 'Dusty Blush',    palette: { primary:'#A56A84', secondary:'#402C3A', accent:'#C38D62', background:'#FFF9FA', surface:'#FFFFFF', textColor:'#33242D', highlight:'#F4DFE7' } },
    { name: 'Monaco Taupe',   palette: { primary:'#7C6A5E', secondary:'#2F2925', accent:'#B76E79', background:'#FCFAF8', surface:'#FFFFFF', textColor:'#2D2622', highlight:'#E8DED5' } },
    { name: 'Silk Berry',     palette: { primary:'#7A3E63', secondary:'#261828', accent:'#D19A66', background:'#FFF8FC', surface:'#FFFFFF', textColor:'#2A1F2B', highlight:'#EEDBE7' } },
    { name: 'Midnight Satin', palette: { primary:'#4A3B5C', secondary:'#1B1721', accent:'#C48A5A', background:'#F9F8FC', surface:'#FFFFFF', textColor:'#211C28', highlight:'#DDD9EA' } },
    { name: 'Rosewood',       palette: { primary:'#87586C', secondary:'#2E1F28', accent:'#BE7C57', background:'#FFF9FB', surface:'#FFFFFF', textColor:'#2D2129', highlight:'#F1DFE7' } },
    { name: 'Boutique Sand',  palette: { primary:'#8A6F5A', secondary:'#312822', accent:'#B35E74', background:'#FFFCF9', surface:'#FFFFFF', textColor:'#2E2622', highlight:'#EADFCC' } },
  ],
  food_restaurant: [
    { name: 'Olive Bistro',   palette: { primary:'#6B8E23', secondary:'#2F3E2D', accent:'#D4A373', background:'#FFFCF7', surface:'#FFFFFF', textColor:'#2B2B2B', highlight:'#E8DCCB' } },
    { name: 'Tomato Basil',   palette: { primary:'#B7410E', secondary:'#3A1F1A', accent:'#E9C46A', background:'#FFF8F3', surface:'#FFFFFF', textColor:'#2D1F1B', highlight:'#F2D7C7' } },
    { name: 'Saffron Night',  palette: { primary:'#C17B1A', secondary:'#2C2A28', accent:'#8E5A3C', background:'#FFFBF2', surface:'#FFFFFF', textColor:'#2A2520', highlight:'#F1E2B8' } },
    { name: 'Terra Oven',     palette: { primary:'#A64B2A', secondary:'#3C2A24', accent:'#D9A066', background:'#FFF7F1', surface:'#FFFFFF', textColor:'#2E221D', highlight:'#EED5C0' } },
    { name: 'Seafood Blue',   palette: { primary:'#2C6E91', secondary:'#1B2E3A', accent:'#E2A458', background:'#F5FAFC', surface:'#FFFFFF', textColor:'#1F2A33', highlight:'#D6EAF3' } },
    { name: 'Espresso Bar',   palette: { primary:'#6F4E37', secondary:'#2F241F', accent:'#C0894A', background:'#FBF7F3', surface:'#FFFFFF', textColor:'#2B221D', highlight:'#E7D5C5' } },
    { name: 'Garden Fresh',   palette: { primary:'#3F7D20', secondary:'#23412A', accent:'#D99E4F', background:'#F8FCF5', surface:'#FFFFFF', textColor:'#243022', highlight:'#DCEBCF' } },
    { name: 'Sunset Grill',   palette: { primary:'#C85A2E', secondary:'#3B2620', accent:'#F4B860', background:'#FFF7EF', surface:'#FFFFFF', textColor:'#2D211D', highlight:'#F6DFC4' } },
    { name: 'Mediterranean',  palette: { primary:'#1F6F78', secondary:'#1E2A3A', accent:'#E3A93C', background:'#F4FBFC', surface:'#FFFFFF', textColor:'#1F2A30', highlight:'#D0E9EC' } },
    { name: 'Brick Kitchen',  palette: { primary:'#8B3A3A', secondary:'#2D1E1E', accent:'#D9A066', background:'#FFF8F7', surface:'#FFFFFF', textColor:'#2B1F1F', highlight:'#EFD5D0' } },
  ],
  tech_electronics: [
    { name: 'Neon Circuit',   palette: { primary:'#0EA5E9', secondary:'#0F172A', accent:'#22D3EE', background:'#F4FBFF', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#D1F3FF' } },
    { name: 'Graphite Neon',  palette: { primary:'#2563EB', secondary:'#111827', accent:'#10B981', background:'#F8FAFC', surface:'#FFFFFF', textColor:'#111827', highlight:'#D7FBEF' } },
    { name: 'Cyber Purple',   palette: { primary:'#7C3AED', secondary:'#1F1147', accent:'#06B6D4', background:'#F8F5FF', surface:'#FFFFFF', textColor:'#1E1B4B', highlight:'#E0D6FF' } },
    { name: 'Silicon Orange', palette: { primary:'#0F172A', secondary:'#111827', accent:'#F97316', background:'#F8FAFC', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#FFE2CC' } },
    { name: 'Electric Lime',  palette: { primary:'#1D4ED8', secondary:'#0B1220', accent:'#84CC16', background:'#F6FAFF', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#E8F8C8' } },
    { name: 'Quantum Blue',   palette: { primary:'#1E40AF', secondary:'#0A1A3A', accent:'#38BDF8', background:'#F2F8FF', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#CDEBFF' } },
    { name: 'Chipset Grey',   palette: { primary:'#334155', secondary:'#111827', accent:'#0EA5E9', background:'#F8FAFC', surface:'#FFFFFF', textColor:'#1F2937', highlight:'#D8E5F5' } },
    { name: 'Matrix Teal',    palette: { primary:'#0F766E', secondary:'#102A43', accent:'#22D3EE', background:'#F2FCFC', surface:'#FFFFFF', textColor:'#102A43', highlight:'#CFF3F1' } },
    { name: 'Aurora Mint',    palette: { primary:'#0284C7', secondary:'#082F49', accent:'#34D399', background:'#F2FBFF', surface:'#FFFFFF', textColor:'#0F172A', highlight:'#D2F9EE' } },
    { name: 'Infrared',       palette: { primary:'#1F2937', secondary:'#0B1020', accent:'#EF4444', background:'#F9FAFB', surface:'#FFFFFF', textColor:'#111827', highlight:'#FFD4D4' } },
  ],
  vibrant: [
    { name: 'Sunset',        palette: { primary:'#ED8936', secondary:'#DD6B20', accent:'#E53E3E', background:'#FFFAF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBD38D' } },
    { name: 'Electric',      palette: { primary:'#F56565', secondary:'#E53E3E', accent:'#9F7AEA', background:'#FFF5F5', surface:'#ffffff', textColor:'#1A202C', highlight:'#FEB2B2' } },
    { name: 'Neon Lime',     palette: { primary:'#84CC16', secondary:'#65A30D', accent:'#EC4899', background:'#F7FEE7', surface:'#ffffff', textColor:'#1A202C', highlight:'#D9F99D' } },
    { name: 'Hot Pink',      palette: { primary:'#EC4899', secondary:'#DB2777', accent:'#F59E0B', background:'#FDF2F8', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBCFE8' } },
    { name: 'Festival',      palette: { primary:'#F59E0B', secondary:'#D97706', accent:'#7C3AED', background:'#FFFBEB', surface:'#ffffff', textColor:'#1A202C', highlight:'#FDE68A' } },
    { name: 'Magenta',       palette: { primary:'#D946EF', secondary:'#A21CAF', accent:'#06B6D4', background:'#FDF4FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#F5D0FE' } },
    { name: 'Coral Rush',    palette: { primary:'#FF6B6B', secondary:'#EE5A24', accent:'#0652DD', background:'#FFF5F5', surface:'#ffffff', textColor:'#1A202C', highlight:'#FFAEAE' } },
    { name: 'Citrus',        palette: { primary:'#F9CA24', secondary:'#F0932B', accent:'#6AB04C', background:'#FFFFF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FFEAA7' } },
    { name: 'Psychedelic',   palette: { primary:'#9F7AEA', secondary:'#6B46C1', accent:'#F56565', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#D6BCFA' } },
    { name: 'Candy',         palette: { primary:'#F472B6', secondary:'#EC4899', accent:'#60A5FA', background:'#FFF0F9', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBCFE8' } },
  ],
  professional: [
    { name: 'Corporate',     palette: { primary:'#2D3748', secondary:'#1A202C', accent:'#3182CE', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#BEE3F8' } },
    { name: 'Executive',     palette: { primary:'#1A365D', secondary:'#0F2344', accent:'#2F855A', background:'#EDF2F7', surface:'#ffffff', textColor:'#1A202C', highlight:'#9AE6B4' } },
    { name: 'Finance',       palette: { primary:'#2F855A', secondary:'#276749', accent:'#2C5282', background:'#F0FFF4', surface:'#ffffff', textColor:'#1A202C', highlight:'#9AE6B4' } },
    { name: 'Law',           palette: { primary:'#744210', secondary:'#5F370E', accent:'#2C5282', background:'#FFFFF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FAF089' } },
    { name: 'Medical',       palette: { primary:'#2B6CB0', secondary:'#2C5282', accent:'#38A169', background:'#EBF8FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#90CDF4' } },
    { name: 'Tech',          palette: { primary:'#0969DA', secondary:'#0550AE', accent:'#1F883D', background:'#F6F8FA', surface:'#ffffff', textColor:'#24292F', highlight:'#AEE8FF' } },
    { name: 'Consulting',    palette: { primary:'#6B46C1', secondary:'#553C9A', accent:'#DD6B20', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#D6BCFA' } },
    { name: 'Steel Pro',     palette: { primary:'#4A5568', secondary:'#2D3748', accent:'#E53E3E', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#CBD5E0' } },
    { name: 'Neutral',       palette: { primary:'#718096', secondary:'#4A5568', accent:'#ED8936', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBD38D' } },
    { name: 'Dark Pro',      palette: { primary:'#2D3748', secondary:'#1A202C', accent:'#38B2AC', background:'#EDF2F7', surface:'#ffffff', textColor:'#1A202C', highlight:'#81E6D9' } },
  ],
  artistic: [
    { name: 'Violet Garden', palette: { primary:'#9F7AEA', secondary:'#6B46C1', accent:'#ED64A6', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#D6BCFA' } },
    { name: 'Sakura',        palette: { primary:'#ED64A6', secondary:'#D53F8C', accent:'#F6AD55', background:'#FFF0F3', surface:'#ffffff', textColor:'#1A202C', highlight:'#FED7E2' } },
    { name: 'Mosaic',        palette: { primary:'#F6AD55', secondary:'#DD6B20', accent:'#9F7AEA', background:'#FFFAF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBD38D' } },
    { name: 'Impressionist', palette: { primary:'#B794F4', secondary:'#805AD5', accent:'#F6AD55', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#E9D8FD' } },
    { name: 'Bauhaus',       palette: { primary:'#E53E3E', secondary:'#C53030', accent:'#2B6CB0', background:'#FFF5F5', surface:'#ffffff', textColor:'#1A202C', highlight:'#FEB2B2' } },
    { name: 'Tropical',      palette: { primary:'#48BB78', secondary:'#38A169', accent:'#F6AD55', background:'#F0FFF4', surface:'#ffffff', textColor:'#1A202C', highlight:'#9AE6B4' } },
    { name: 'Dusk',          palette: { primary:'#FC8181', secondary:'#F56565', accent:'#9F7AEA', background:'#FFF5F5', surface:'#ffffff', textColor:'#1A202C', highlight:'#FEB2B2' } },
    { name: 'Ceramic',       palette: { primary:'#B7791F', secondary:'#975A16', accent:'#553C9A', background:'#FFFFF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FAF089' } },
    { name: 'Surreal',       palette: { primary:'#76E4F7', secondary:'#00B5D8', accent:'#ED64A6', background:'#E6FFFA', surface:'#ffffff', textColor:'#1A202C', highlight:'#B2F5EA' } },
    { name: 'Canvas',        palette: { primary:'#ECC94B', secondary:'#D69E2E', accent:'#9F7AEA', background:'#FFFFF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FAF089' } },
  ],
  custom: [
    { name: 'Neutral',       palette: { primary:'#4A5568', secondary:'#2D3748', accent:'#38B2AC', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#CBD5E0' } },
    { name: 'Sky',           palette: { primary:'#3182CE', secondary:'#2C5282', accent:'#38B2AC', background:'#EBF8FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#90CDF4' } },
    { name: 'Sunset',        palette: { primary:'#ED8936', secondary:'#DD6B20', accent:'#E53E3E', background:'#FFFAF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBD38D' } },
    { name: 'Forest',        palette: { primary:'#38A169', secondary:'#276749', accent:'#F6E05E', background:'#F0FFF4', surface:'#ffffff', textColor:'#1C4532', highlight:'#9AE6B4' } },
    { name: 'Purple',        palette: { primary:'#9F7AEA', secondary:'#6B46C1', accent:'#ED64A6', background:'#FAF5FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#D6BCFA' } },
    { name: 'Monochrome',    palette: { primary:'#2D3748', secondary:'#1A202C', accent:'#718096', background:'#F7FAFC', surface:'#ffffff', textColor:'#1A202C', highlight:'#CBD5E0' } },
    { name: 'Warm',          palette: { primary:'#C05621', secondary:'#9C4221', accent:'#D69E2E', background:'#FFFAF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#FBD38D' } },
    { name: 'Cool',          palette: { primary:'#2B6CB0', secondary:'#2C5282', accent:'#38B2AC', background:'#EBF8FF', surface:'#ffffff', textColor:'#1A202C', highlight:'#90CDF4' } },
    { name: 'Earth',         palette: { primary:'#744210', secondary:'#5F370E', accent:'#38A169', background:'#FFFFF0', surface:'#ffffff', textColor:'#1A202C', highlight:'#9AE6B4' } },
    { name: 'Ocean',         palette: { primary:'#0987A0', secondary:'#086F83', accent:'#0EA5E9', background:'#ECFEFF', surface:'#ffffff', textColor:'#1A202C', highlight:'#67E8F9' } },
  ],
};

// ── option definitions ───────────────────────────────────────────────────────
const PRODUCT_DISPLAY_OPTIONS: Array<{ id: ProductDisplayType; label: string; desc: string; icon: string }> = [
  { id: 'grid-standard', label: 'Grid Standard', desc: '4-col grid, classic cards', icon: '▦' },
  { id: 'grid-large',    label: 'Grid Large',    desc: '2-col, big images',        icon: '▩' },
  { id: 'list',          label: 'List',          desc: 'Full-width rows',          icon: '☰' },
  { id: 'masonry',       label: 'Masonry',       desc: 'Pinterest-style mix',      icon: '⊞' },
  { id: 'spotlight',     label: 'Spotlight',     desc: 'Hero + grid below',        icon: '◉' },
];

type ProductCardAnimation = 'none' | 'parallax' | 'lift-3d' | 'glow-pulse' | 'slide-reveal' | 'zoom-tilt';
const PRODUCT_ANIMATION_OPTIONS: Array<{ id: ProductCardAnimation; label: string; desc: string; icon: string }> = [
  { id: 'none',         label: 'None',          desc: 'No hover animation',       icon: '○' },
  { id: 'parallax',     label: 'Parallax',      desc: 'Image moves slower',       icon: '⇅' },
  { id: 'lift-3d',      label: '3D Lift',       desc: 'Rotates in 3D space',      icon: '▣' },
  { id: 'glow-pulse',   label: 'Glow Pulse',    desc: 'Pulsing gradient glow',    icon: '◉' },
  { id: 'slide-reveal', label: 'Slide Reveal',  desc: 'Content slides up',        icon: '⬆' },
  { id: 'zoom-tilt',    label: 'Zoom Tilt',     desc: 'Intense zoom + tilt',      icon: '◬' },
];

const HERO_LAYOUT_OPTIONS: Array<{ id: HeroLayout; label: string; desc: string; icon: string }> = [
  { id: 'fullscreen', label: 'Fullscreen',    desc: 'Full-screen image banner', icon: '🖼' },
  { id: 'split',      label: 'Split',         desc: 'Image left, text right',   icon: '◫' },
  { id: 'minimal',    label: 'Minimal Bar',   desc: 'Compact top bar',          icon: '▬' },
  { id: 'centered',   label: 'Centered Text', desc: 'Text over gradient',       icon: '◎' },
];

const MENU_STYLE_OPTIONS: Array<{ id: MenuStyle; label: string; desc: string; icon: string }> = [
  { id: 'classic',      label: 'Classic',       desc: 'Logo left, links right', icon: '═' },
  { id: 'centered',     label: 'Centered',      desc: 'Logo center, links below', icon: '≡' },
  { id: 'bold',         label: 'Bold Bar',      desc: 'Full-width accent bar', icon: '▬' },
  { id: 'sticky-glass', label: 'Sticky Glass',  desc: 'Frosted, transparent on scroll', icon: '◻' },
  { id: 'hamburger',    label: 'Hamburger',     desc: 'Always collapsed menu', icon: '☰' },
];

const CONTACT_FORM_OPTIONS: Array<{ id: ContactFormStyle; label: string; desc: string }> = [
  { id: 1, label: 'Simple',           desc: 'Name · Email · Message' },
  { id: 2, label: 'With Phone',       desc: 'Name · Email · Phone · Message' },
  { id: 3, label: 'With Subject',     desc: 'Name · Email · Subject · Message' },
  { id: 4, label: 'Multi-step',       desc: 'Step 1: Info / Step 2: Message' },
  { id: 5, label: 'Floating Card',    desc: 'Elevated card with shadow' },
  { id: 6, label: 'Side Panel',       desc: 'Info on left, form on right' },
  { id: 7, label: 'WhatsApp First',   desc: 'WhatsApp button + optional form' },
  { id: 8, label: 'Compact Inline',   desc: 'Name & Email side-by-side, compact' },
  { id: 9, label: 'Full Details',     desc: 'All fields: Name, Email, Phone, Subject, Message, Company' },
  { id: 10, label: 'Newsletter Style', desc: 'Email-focused subscription form' },
  { id: 11, label: 'Appointment',     desc: 'Includes date/time picker fields' },
  { id: 12, label: 'Quote Request',   desc: 'Product selection + quantity' },
  { id: 13, label: 'Support Ticket',  desc: 'Priority selector + issue type' },
  { id: 14, label: 'Feedback Form',   desc: 'Rating slider + comment' },
  { id: 15, label: 'Bordered Glass',  desc: 'Frosted glass effect with borders' },
];

const RATING_OPTIONS: Array<{ id: RatingDisplayType; label: string; desc: string; preview: string }> = [
  { id: 'stars',   label: 'Classic Stars', desc: '★★★★☆ with count',          preview: '★★★★☆  4.2 (18)' },
  { id: 'pill',    label: 'Pill Badge',    desc: 'Score inside a badge',        preview: '⬤ 4.2 / 5.0' },
  { id: 'number',  label: 'Large Number', desc: 'Big score + small stars',      preview: '4.2 ★★★★☆' },
  { id: 'card',    label: 'Review Card',  desc: 'Card with avatar & comment',   preview: '📋 Card layout' },
  { id: 'minimal', label: 'Minimal Text', desc: '"92% positive reviews"',       preview: '92% positive' },
];

const ABOUT_LAYOUT_OPTIONS: Array<{ id: AboutLayout; label: string; desc: string; icon: string }> = [
  { id: 'off',        label: 'Hidden',       desc: 'No About Us section', icon: '✕' },
  { id: 'left',       label: 'Left Text',    desc: '3-col cards, left aligned', icon: '▤' },
  { id: 'centered',   label: 'Centered',     desc: 'Full-width centered text', icon: '≅' },
  { id: 'with-image', label: 'With Image',   desc: 'Image + text side-by-side', icon: '▣' },
];

const PAGE_LAYOUT_OPTIONS: Array<{ id: PageLayout; label: string; desc: string; icon: string }> = [
  { id: 'contained',  label: 'Contained',    desc: 'All content centered, max-width container', icon: '▢' },
  { id: 'full-width', label: 'Full-Width',   desc: 'Edge-to-edge, spans entire screen', icon: '▭' },
  { id: 'hybrid',     label: 'Hybrid',       desc: 'Full hero, contained content', icon: '▥' },
];

const STORE_CARD_STYLE_OPTIONS: Array<{ id: StoreCardStyle; label: string; desc: string; icon: string }> = [
  { id: 'standard',   label: 'Standard',     desc: 'Normal card with rounded corners', icon: '▢' },
  { id: 'full-width', label: 'Full-Width',   desc: 'Spans entire width, edge-to-edge', icon: '▭' },
  { id: 'split',      label: 'Split',        desc: '2-column grid layout', icon: '▦' },
  { id: 'minimal',    label: 'Minimal',      desc: 'No background, just content', icon: '○' },
];

const VISUAL_STYLE_OPTIONS: Array<{ id: VisualStyle; label: string; desc: string; icon: string }> = [
  { id: 'rounded',    label: 'Rounded',      desc: 'Soft, rounded corners everywhere', icon: '◯' },
  { id: 'sharp',      label: 'Sharp',        desc: 'Clean, square edges', icon: '▢' },
  { id: 'mixed',      label: 'Mixed',        desc: 'Combination of round and sharp', icon: '◪' },
];

const SECTION_ANIMATION_OPTIONS: Array<{ id: SectionAnimation; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'zoom', label: 'Zoom' },
];

// ── AI agent prompts ─────────────────────────────────────────────────────────
const AI_STORE_TASKS = [
  { id: 'tagline', label: '✨ Generate store tagline', prompt: (name: string, type: string) => `Write 3 short, catchy taglines for a ${type} store named "${name}". Each on its own line. Keep each under 10 words.` },
  { id: 'about', label: '📝 Write About section', prompt: (name: string, type: string) => `Write a professional About Us section (3 short paragraphs) for a ${type} store named "${name}". Warm, trustworthy tone.` },
  { id: 'welcome', label: '👋 Write welcome message', prompt: (name: string, type: string) => `Write a warm welcome message (2-3 sentences) for the homepage of a ${type} store named "${name}".` },
  { id: 'colors', label: '🎨 Suggest color palette', prompt: (name: string, type: string) => `Suggest a color palette for a ${type} store named "${name}". Give 3 palette options with hex codes for: primary, background, accent, and text. Format clearly.` },
  { id: 'seo_title', label: '🔍 Generate SEO title & meta', prompt: (name: string, type: string) => `Write an SEO meta title (under 60 chars) and meta description (under 155 chars) for a ${type} store named "${name}".` },
];

type AdminTemplatesProps = {
  /** When set, read/write design under builders/{uid}/demoStores/{demoId}/profile/branding */
  demoId?: string;
};

// ── component ────────────────────────────────────────────────────────────────
const AdminTemplates: React.FC<AdminTemplatesProps> = ({ demoId }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const demoMode = Boolean(demoId && user?.id);
  const builderUid = user?.id ?? '';
  const storeId = demoMode ? demoId! : getActualStoreId(user);
  const db = getFirestore();
  const firebaseAuth = getAuth();
  const { enabled: hasAiBuilder } = useModuleEntitlement('ai_builder');
  const canPersist = demoMode ? Boolean(demoId && builderUid) : Boolean(storeId);
  const designDocRef = demoMode
    ? doc(db, 'builders', builderUid, 'demoStores', demoId!, 'profile', 'branding')
    : storeId
      ? doc(db, 'storeProfiles', storeId)
      : null;

  const mediaRoot = demoMode
    ? `builder-demos/${builderUid}/${demoId}`
    : `store-media/${storeId ?? 'unknown'}`;

  // AI agent state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTask, setAiTask] = useState(AI_STORE_TASKS[0].id);
  const [aiBusinessType, setAiBusinessType] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<TabId>('templates');

  // Templates tab
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateId>('modern');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [storeSlug, setStoreSlug] = useState<string>('');
  const [uploadingSection, setUploadingSection] = useState<'background' | 'carousel' | 'gallery' | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ mode: 'carousel' | 'gallery'; index: number } | null>(null);

  // Colors tab  
  const EMPTY_COLORS = (): Required<StoreTemplateColors> => ({
    primary: '#38B2AC', secondary: '#2C5282', accent: '#ED8936',
    background: '#f8fafc', surface: '#ffffff', textColor: '#1a202c', highlight: '#22d3ee',
    heroBg: '#38B2AC', storeCardBg: '#ffffff', contentCardBg: '#f8fafc',
    heroTextColor: '#ffffff', storeCardTextColor: '#1a202c', contentCardTextColor: '#1a202c',
  });
  const [colors, setColors] = useState<Required<StoreTemplateColors>>(EMPTY_COLORS());
  const [savingColors, setSavingColors] = useState(false);

  // Layout tab
  const [productDisplayType, setProductDisplayType] = useState<ProductDisplayType>('grid-standard');
  const [productCardAnimation, setProductCardAnimation] = useState<ProductCardAnimation>('none');
  const [heroLayout, setHeroLayout] = useState<HeroLayout>('fullscreen');
  const [menuStyle, setMenuStyle] = useState<MenuStyle>('classic');
  const [aboutLayout, setAboutLayout] = useState<AboutLayout>('left');
  const [pageLayout, setPageLayout] = useState<PageLayout>('contained');
  const [storeCardStyleLayout, setStoreCardStyleLayout] = useState<StoreCardStyle>('standard');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('rounded');
  const [savingLayout, setSavingLayout] = useState(false);

  // Sections tab
  const [contactFormStyle, setContactFormStyle] = useState<ContactFormStyle>(1);
  const [ratingDisplayType, setRatingDisplayType] = useState<RatingDisplayType>('stars');
  const [sectionOrder, setSectionOrder] = useState<StoreSectionOrder[]>([
    { id: 'hero', enabled: true, order: 0, width: 'full', container: 'full-width', padding: 'none', showBackground: true, showBorders: false, animation: 'fade', customCss: '' },
    { id: 'about', enabled: true, order: 1, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'announcements', enabled: true, order: 2, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'products', enabled: true, order: 3, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'gallery', enabled: true, order: 4, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'reviews', enabled: true, order: 5, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
    { id: 'contact', enabled: true, order: 6, width: 'full', container: 'contained', padding: 'medium', showBackground: true, showBorders: true, animation: 'fade', customCss: '' },
  ]);
  const [savingSections, setSavingSections] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<StoreSectionId | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedColors, setHasUnsavedColors] = useState(false);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [hasUnsavedSections, setHasUnsavedSections] = useState(false);

  // ── load from Firestore ──────────────────────────────────────────────────
  const templates: TemplateDefinition[] = [
    { 
      id: 'modern', 
      name: 'Modern', 
      description: 'Clean, contemporary design with bold typography and full-width hero',
      colors: ['#38B2AC','#2C5282','#ED8936'], 
      features: ['Full-Width Hero','Grid Products','3D Hover Effects'], 
      isPremium: false, 
      defaultPalette: COLOR_PRESETS.modern[0].palette,
      layoutConfig: {
        heroLayout: 'fullscreen',
        productDisplayType: 'grid-standard',
        productCardAnimation: 'lift-3d',
        menuStyle: 'sticky-glass',
        aboutLayout: 'left',
        contactFormStyle: 2,
        ratingDisplayType: 'pill',
        pageLayout: 'hybrid',
        storeCardStyle: 'standard',
        visualStyle: 'rounded',
      }
    },
    { 
      id: 'minimalist',
      name: 'Modern Minimalist',
      description: 'Editorial minimal design with calm neutrals, generous spacing, and subtle contrast',
      colors: ['#6B7280','#111827','#C08457'],
      features: ['Editorial Spacing','Calm Neutral Palette','Subtle Contrast UI'],
      isPremium: false,
      defaultPalette: COLOR_PRESETS.minimalist[0].palette,
      layoutConfig: {
        heroLayout: 'centered',
        productDisplayType: 'grid-large',
        productCardAnimation: 'none',
        menuStyle: 'centered',
        aboutLayout: 'centered',
        contactFormStyle: 8,
        ratingDisplayType: 'minimal',
        pageLayout: 'contained',
        storeCardStyle: 'minimal',
        visualStyle: 'mixed',
      }
    },
    {
      id: 'minimal', 
      name: 'Minimal', 
      description: 'Simple, elegant design with centered layout and minimal hero',
      colors: ['#718096','#2D3748','#E2E8F0'], 
      features: ['Centered Design','List View','Sharp Edges'], 
      isPremium: false, 
      defaultPalette: COLOR_PRESETS.minimal[0].palette,
      layoutConfig: {
        heroLayout: 'minimal',
        productDisplayType: 'list',
        productCardAnimation: 'none',
        menuStyle: 'classic',
        aboutLayout: 'centered',
        contactFormStyle: 1,
        ratingDisplayType: 'minimal',
        pageLayout: 'contained',
        storeCardStyle: 'minimal',
        visualStyle: 'sharp',
      }
    },
    { 
      id: 'classic', 
      name: 'Classic', 
      description: 'Timeless design with split hero and traditional grid layout',
      colors: ['#2C5282','#3182CE','#63B3ED'], 
      features: ['Split Hero','Standard Grid','Classic Menu'], 
      isPremium: false, 
      defaultPalette: COLOR_PRESETS.classic[0].palette,
      layoutConfig: {
        heroLayout: 'split',
        productDisplayType: 'grid-standard',
        productCardAnimation: 'none',
        menuStyle: 'classic',
        aboutLayout: 'left',
        contactFormStyle: 1,
        ratingDisplayType: 'stars',
        pageLayout: 'contained',
        storeCardStyle: 'standard',
        visualStyle: 'rounded',
      }
    },
    {
      id: 'classic_ecom',
      name: 'Classic E-Commerce',
      description: 'Storefront-first classic commerce layout with trusted colors and conversion-focused structure',
      colors: ['#1E3A5F','#0F2942','#C28B36'],
      features: ['Conversion Hero','Catalog Grid','Trust-First Styling'],
      isPremium: false,
      defaultPalette: COLOR_PRESETS.classic_ecom[0].palette,
      layoutConfig: {
        heroLayout: 'split',
        productDisplayType: 'grid-standard',
        productCardAnimation: 'slide-reveal',
        menuStyle: 'classic',
        aboutLayout: 'left',
        contactFormStyle: 3,
        ratingDisplayType: 'stars',
        pageLayout: 'contained',
        storeCardStyle: 'standard',
        visualStyle: 'rounded',
      }
    },
    {
      id: 'fashion_boutique',
      name: 'Fashion / Boutique',
      description: 'Elegant boutique storefront with editorial visuals, premium palette, and style-first layout defaults',
      colors: ['#8B5E7A','#2E2330','#D4A373'],
      features: ['Editorial Hero','Boutique Cards','Luxury Palette'],
      isPremium: false,
      defaultPalette: COLOR_PRESETS.fashion_boutique[0].palette,
      layoutConfig: {
        heroLayout: 'fullscreen',
        productDisplayType: 'grid-large',
        productCardAnimation: 'lift-3d',
        menuStyle: 'centered',
        aboutLayout: 'with-image',
        contactFormStyle: 5,
        ratingDisplayType: 'pill',
        pageLayout: 'hybrid',
        storeCardStyle: 'split',
        visualStyle: 'rounded',
      }
    },
    {
      id: 'food_restaurant',
      name: 'Food / Restaurant',
      description: 'Menu-first dining storefront with warm appetite-driven visuals and reservation-friendly section defaults',
      colors: ['#6B8E23','#2F3E2D','#D4A373'],
      features: ['Menu Spotlight','Warm Culinary Palette','Reservation-Friendly Contact'],
      isPremium: false,
      defaultPalette: COLOR_PRESETS.food_restaurant[0].palette,
      layoutConfig: {
        heroLayout: 'fullscreen',
        productDisplayType: 'list',
        productCardAnimation: 'slide-reveal',
        menuStyle: 'bold',
        aboutLayout: 'with-image',
        contactFormStyle: 11,
        ratingDisplayType: 'pill',
        pageLayout: 'contained',
        storeCardStyle: 'standard',
        visualStyle: 'rounded',
      }
    },
    {
      id: 'tech_electronics',
      name: 'Tech / Electronics',
      description: 'High-clarity commerce layout for gadgets with spec-friendly cards and modern digital visual language',
      colors: ['#0EA5E9','#0F172A','#22D3EE'],
      features: ['Spec-Ready Grid','Digital Contrast UI','High-Tech Hero'],
      isPremium: false,
      defaultPalette: COLOR_PRESETS.tech_electronics[0].palette,
      layoutConfig: {
        heroLayout: 'split',
        productDisplayType: 'grid-standard',
        productCardAnimation: 'zoom-tilt',
        menuStyle: 'sticky-glass',
        aboutLayout: 'left',
        contactFormStyle: 12,
        ratingDisplayType: 'number',
        pageLayout: 'hybrid',
        storeCardStyle: 'split',
        visualStyle: 'sharp',
      }
    },
    { 
      id: 'vibrant', 
      name: 'Vibrant', 
      description: 'Energetic design with masonry products and bold full-width layout',
      colors: ['#ED8936','#F56565','#9F7AEA'], 
      features: ['Masonry Layout','Bold Menu','Slide-Up Animations'], 
      isPremium: true, 
      defaultPalette: COLOR_PRESETS.vibrant[0].palette,
      layoutConfig: {
        heroLayout: 'fullscreen',
        productDisplayType: 'masonry',
        productCardAnimation: 'slide-reveal',
        menuStyle: 'bold',
        aboutLayout: 'left',
        contactFormStyle: 3,
        ratingDisplayType: 'number',
        pageLayout: 'full-width',
        storeCardStyle: 'full-width',
        visualStyle: 'mixed',
      }
    },
    { 
      id: 'professional', 
      name: 'Professional', 
      description: 'Corporate-style with large grid and split store card',
      colors: ['#2D3748','#4A5568','#718096'], 
      features: ['Large Grid','Split Card','Professional Menu'], 
      isPremium: true, 
      defaultPalette: COLOR_PRESETS.professional[0].palette,
      layoutConfig: {
        heroLayout: 'centered',
        productDisplayType: 'grid-large',
        productCardAnimation: 'zoom-tilt',
        menuStyle: 'classic',
        aboutLayout: 'centered',
        contactFormStyle: 2,
        ratingDisplayType: 'stars',
        pageLayout: 'contained',
        storeCardStyle: 'split',
        visualStyle: 'sharp',
      }
    },
    { 
      id: 'artistic', 
      name: 'Artistic', 
      description: 'Creative layouts with compact grid and unique artistic feel',
      colors: ['#9F7AEA','#ED64A6','#F6AD55'], 
      features: ['Compact Grid','Creative Layouts','Mixed Styles'], 
      isPremium: true, 
      defaultPalette: COLOR_PRESETS.artistic[0].palette,
      layoutConfig: {
        heroLayout: 'centered',
        productDisplayType: 'grid-standard',
        productCardAnimation: 'lift-3d',
        menuStyle: 'bold',
        aboutLayout: 'left',
        contactFormStyle: 3,
        ratingDisplayType: 'pill',
        pageLayout: 'hybrid',
        storeCardStyle: 'standard',
        visualStyle: 'mixed',
      }
    },
    {
      id: 'custom',
      name: 'Custom',
      description: 'Build your own template with complete control over all settings',
      colors: ['#4A5568','#38B2AC','#ED8936'],
      features: ['Full Control','Any Layout','Complete Customization'],
      isPremium: false,
      defaultPalette: COLOR_PRESETS.modern[0].palette,
      // No layoutConfig - custom template uses manual settings
    }
  ];

  useEffect(() => {
    const load = async () => {
      if (!designDocRef) return;
      const snap = await getDoc(designDocRef);
      if (!snap.exists()) return;
      const d = snap.data();
      // templates tab
      if (d.template && templates.some(t => t.id === d.template)) {
        setSelectedTemplate(d.template as TemplateId);
        setPreviewTemplate(d.template as TemplateId);
      }
      setStoreSlug(typeof d.slug === 'string' ? d.slug : '');
      setBackgroundImage(typeof d.storeBackgroundImage === 'string' ? d.storeBackgroundImage : '');
      setCarouselImages(Array.isArray(d.carouselImages) ? d.carouselImages.filter((u: unknown) => typeof u === 'string') : []);
      setGalleryImages(Array.isArray(d.galleryImages) ? d.galleryImages.filter((u: unknown) => typeof u === 'string') : []);
      // colors tab - merge with defaults to ensure all fields exist
      if (d.templateColors && typeof d.templateColors === 'object') {
        const defaults = EMPTY_COLORS();
        setColors({ ...defaults, ...d.templateColors });
      }
      // layout tab
      if (d.productDisplayType) setProductDisplayType(d.productDisplayType as ProductDisplayType);
      if (d.productCardAnimation) setProductCardAnimation(d.productCardAnimation as ProductCardAnimation);
      if (d.heroLayout) setHeroLayout(d.heroLayout as HeroLayout);
      if (d.menuStyle) setMenuStyle(d.menuStyle as MenuStyle);
      if (d.aboutLayout) setAboutLayout(d.aboutLayout as AboutLayout);
      if (d.pageLayout) setPageLayout(d.pageLayout as PageLayout);
      if (d.storeCardStyle) setStoreCardStyleLayout(d.storeCardStyle as StoreCardStyle);
      if (d.visualStyle) setVisualStyle(d.visualStyle as VisualStyle);
      // sections tab
      if (d.contactFormStyle) setContactFormStyle(d.contactFormStyle as ContactFormStyle);
      if (d.ratingDisplayType) setRatingDisplayType(d.ratingDisplayType as RatingDisplayType);
      if (Array.isArray(d.sectionOrder)) {
        setSectionOrder(
          (d.sectionOrder as StoreSectionOrder[])
            .sort((a, b) => a.order - b.order)
            .map((section) => ({
              ...section,
              container: section.container || 'contained',
              padding: section.padding || 'medium',
              showBackground: section.showBackground ?? true,
              showBorders: section.showBorders ?? true,
              animation: section.animation || 'fade',
              customCss: section.customCss || '',
              backgroundImage: section.backgroundImage || '',
            }))
        );
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoId, storeId, builderUid]);

  // ── warn before leaving with unsaved changes ─────────────────────────────
  useEffect(() => {
    const hasUnsaved = hasUnsavedColors || hasUnsavedLayout || hasUnsavedSections;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = 'Your changes are not saved. Save before you leave or you will lose the changes.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedColors, hasUnsavedLayout, hasUnsavedSections]);

  // ── template handlers ────────────────────────────────────────────────────
  const previewStyles: Record<TemplateId, { shell: string; header: string; block: string; title: string }> = {
    modern:       { shell: 'bg-gradient-to-br from-cyan-100 via-blue-50 to-indigo-100', header: 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg', block: 'bg-white shadow-md hover:shadow-lg transition-shadow border-cyan-200', title: 'text-white drop-shadow-sm' },
    minimalist:   { shell: 'bg-gradient-to-br from-stone-100 via-zinc-50 to-neutral-100', header: 'bg-white/95 border border-stone-300 shadow-sm', block: 'bg-white shadow-sm hover:shadow-md transition-shadow border border-stone-200', title: 'text-zinc-800 tracking-wide' },
    minimal:      { shell: 'bg-gradient-to-br from-gray-50 to-slate-100', header: 'bg-white shadow-md border-2 border-gray-300', block: 'bg-white shadow-sm hover:shadow-md transition-shadow border border-gray-200', title: 'text-gray-800' },
    classic:      { shell: 'bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100', header: 'bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg', block: 'bg-white shadow-md hover:shadow-lg transition-shadow border-blue-300', title: 'text-white font-bold drop-shadow' },
    classic_ecom: { shell: 'bg-gradient-to-br from-slate-100 via-blue-50 to-stone-100', header: 'bg-gradient-to-r from-[#1E3A5F] to-[#0F2942] shadow-lg', block: 'bg-white shadow-md hover:shadow-lg transition-shadow border-slate-300', title: 'text-white font-semibold tracking-wide' },
    fashion_boutique: { shell: 'bg-gradient-to-br from-rose-100 via-fuchsia-50 to-amber-100', header: 'bg-gradient-to-r from-[#8B5E7A] to-[#2E2330] shadow-lg', block: 'bg-white shadow-md hover:shadow-xl transition-all border-rose-200', title: 'text-white font-semibold tracking-wide' },
    food_restaurant: { shell: 'bg-gradient-to-br from-lime-100 via-amber-50 to-orange-100', header: 'bg-gradient-to-r from-[#6B8E23] to-[#2F3E2D] shadow-lg', block: 'bg-white shadow-md hover:shadow-lg transition-all border-amber-200', title: 'text-white font-semibold tracking-wide' },
    tech_electronics: { shell: 'bg-gradient-to-br from-cyan-100 via-slate-50 to-blue-100', header: 'bg-gradient-to-r from-[#0EA5E9] to-[#0F172A] shadow-lg', block: 'bg-white shadow-md hover:shadow-lg transition-all border-cyan-200', title: 'text-white font-semibold tracking-wide' },
    vibrant:      { shell: 'bg-gradient-to-br from-orange-200 via-pink-200 to-fuchsia-200', header: 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 shadow-xl', block: 'bg-white shadow-lg hover:shadow-xl transition-all border-2 border-pink-300', title: 'text-white font-extrabold drop-shadow-lg' },
    professional: { shell: 'bg-gradient-to-br from-slate-200 via-gray-100 to-zinc-200', header: 'bg-gradient-to-r from-slate-700 to-gray-800 shadow-xl', block: 'bg-white shadow-md hover:shadow-xl transition-all border-slate-300', title: 'text-white tracking-wide font-semibold' },
    artistic:     { shell: 'bg-gradient-to-tr from-violet-200 via-fuchsia-100 to-amber-200', header: 'bg-gradient-to-r from-violet-600 via-purple-500 to-pink-500 shadow-2xl', block: 'bg-white/95 shadow-lg hover:shadow-2xl transition-all border-2 border-violet-300 backdrop-blur-sm', title: 'text-white font-bold drop-shadow-xl' },
    custom:       { shell: 'bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100', header: 'bg-gradient-to-r from-teal-600 to-cyan-600 shadow-lg', block: 'bg-white shadow-md hover:shadow-lg transition-shadow border-teal-200', title: 'text-white font-semibold' },
  };

  const handleAiGenerate = async () => {
    const storeName = (user as { storeName?: string } | null)?.storeName || 'My Store';
    const businessType = aiBusinessType.trim() || 'retail';
    const task = AI_STORE_TASKS.find(t => t.id === aiTask);
    if (!task) return;
    const prompt = task.prompt(storeName, businessType);
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (!token) return;
    setAiLoading(true);
    setAiOutput('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId, tool: 'ai_builder', prompt }),
      });
      const data = await res.json() as { success: boolean; content?: string; message?: string };
      if (!data.success) throw new Error(data.message || 'Generation failed');
      setAiOutput(data.content ?? '');
    } catch (err) {
      toast({ title: 'AI Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelectTemplate = async (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setColors(found.defaultPalette);
      
      // Apply layout configuration if available (not for custom template)
      if (found.layoutConfig) {
        setHeroLayout(found.layoutConfig.heroLayout);
        setProductDisplayType(found.layoutConfig.productDisplayType);
        setProductCardAnimation(found.layoutConfig.productCardAnimation);
        setMenuStyle(found.layoutConfig.menuStyle);
        setAboutLayout(found.layoutConfig.aboutLayout);
        setContactFormStyle(found.layoutConfig.contactFormStyle);
        setRatingDisplayType(found.layoutConfig.ratingDisplayType);
        setPageLayout(found.layoutConfig.pageLayout);
        setStoreCardStyleLayout(found.layoutConfig.storeCardStyle);
        setVisualStyle(found.layoutConfig.visualStyle);
      }
    }
    if (designDocRef) {
      const updateData: Record<string, unknown> = {
        template: templateId,
        templateColors: found?.defaultPalette ?? colors,
      };
      
      // Include layout config in the update if available
      if (found?.layoutConfig) {
        updateData.heroLayout = found.layoutConfig.heroLayout;
        updateData.productDisplayType = found.layoutConfig.productDisplayType;
        updateData.productCardAnimation = found.layoutConfig.productCardAnimation;
        updateData.menuStyle = found.layoutConfig.menuStyle;
        updateData.aboutLayout = found.layoutConfig.aboutLayout;
        updateData.contactFormStyle = found.layoutConfig.contactFormStyle;
        updateData.ratingDisplayType = found.layoutConfig.ratingDisplayType;
        updateData.pageLayout = found.layoutConfig.pageLayout;
        updateData.storeCardStyle = found.layoutConfig.storeCardStyle;
        updateData.visualStyle = found.layoutConfig.visualStyle;
      }
      
      await setDoc(designDocRef, updateData, { merge: true });
    }
    toast({ title: 'Template Applied', description: `Now using the ${found?.name} template with complete layout settings.` });
  };

  const saveMediaSettings = async (next: { backgroundImage?: string; carouselImages?: string[]; galleryImages?: string[] }) => {
    if (!designDocRef) return;
    await setDoc(designDocRef, {
      ...(next.backgroundImage !== undefined ? { storeBackgroundImage: next.backgroundImage } : {}),
      ...(next.carouselImages !== undefined ? { carouselImages: next.carouselImages } : {}),
      ...(next.galleryImages !== undefined ? { galleryImages: next.galleryImages } : {}),
    }, { merge: true });
  };

  const uploadSingleImage = async (file: File, folder: 'background' | 'carousel' | 'gallery') => {
    if (!demoMode && storeId) await assertCanUploadBytes(db, storeId, file.size);
    const path = `${mediaRoot}/${folder}/${Date.now()}_${encodeURIComponent(file.name)}`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, file);
    if (!demoMode && storeId) await trackStorageUsageAfterUpload(db, storeId, file.size);
    return getDownloadURL(imageRef);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canPersist) return;
    setUploadingSection('background');
    try {
      const url = await uploadSingleImage(file, 'background');
      setBackgroundImage(url);
      await saveMediaSettings({ backgroundImage: url });
      toast({ title: 'Background Updated' });
    } catch { toast({ title: 'Upload Failed', variant: 'destructive' }); }
    finally { setUploadingSection(null); }
  };

  const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'carousel' | 'gallery') => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !canPersist) return;
    setUploadingSection(mode);
    try {
      const urls = await Promise.all(files.map(f => uploadSingleImage(f, mode)));
      if (mode === 'carousel') {
        const next = [...carouselImages, ...urls].slice(0, 12);
        setCarouselImages(next);
        await saveMediaSettings({ carouselImages: next });
      } else {
        const next = [...galleryImages, ...urls].slice(0, 24);
        setGalleryImages(next);
        await saveMediaSettings({ galleryImages: next });
      }
      toast({ title: 'Images Uploaded', description: `${urls.length} image(s) added.` });
    } catch { toast({ title: 'Upload Failed', variant: 'destructive' }); }
    finally { setUploadingSection(null); }
  };

  const removeImageAt = async (mode: 'carousel' | 'gallery', index: number) => {
    const source = mode === 'carousel' ? carouselImages : galleryImages;
    const next = source.filter((_, i) => i !== index);
    if (mode === 'carousel') { setCarouselImages(next); await saveMediaSettings({ carouselImages: next }); }
    else { setGalleryImages(next); await saveMediaSettings({ galleryImages: next }); }
  };

  const reorderImages = async (mode: 'carousel' | 'gallery', from: number, to: number) => {
    const source = mode === 'carousel' ? carouselImages : galleryImages;
    if (from === to || from < 0 || to < 0 || from >= source.length || to >= source.length) return;
    const next = [...source];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    if (mode === 'carousel') { setCarouselImages(next); await saveMediaSettings({ carouselImages: next }); }
    else { setGalleryImages(next); await saveMediaSettings({ galleryImages: next }); }
  };

  const handleDragStart = (mode: 'carousel' | 'gallery', index: number) => setDraggingItem({ mode, index });
  const handleDrop = async (mode: 'carousel' | 'gallery', targetIndex: number) => {
    if (!draggingItem || draggingItem.mode !== mode) { setDraggingItem(null); return; }
    await reorderImages(mode, draggingItem.index, targetIndex);
    setDraggingItem(null);
  };
  const moveImageByStep = async (mode: 'carousel' | 'gallery', index: number, step: -1 | 1) => {
    await reorderImages(mode, index, index + step);
  };

  // ── color handlers ───────────────────────────────────────────────────────
  const applyPreset = (preset: Required<StoreTemplateColors>) => updateColors(preset);

  const updateColor = (key: keyof Required<StoreTemplateColors>, value: string) => {
    // accept raw hex input without # too
    const clean = value.startsWith('#') ? value : `#${value}`;
    updateColors(prev => ({ ...prev, [key]: clean }));
  };

  const handleHexInput = (key: keyof Required<StoreTemplateColors>, raw: string) => {
    const sanitized = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    updateColors(prev => ({ ...prev, [key]: `#${sanitized}` }));
  };

  const saveColors = async () => {
    if (!designDocRef) return;
    setSavingColors(true);
    try {
      await setDoc(designDocRef, { templateColors: colors }, { merge: true });
      setHasUnsavedColors(false);
      toast({ title: 'Colors Saved', description: 'Your custom palette is live.' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setSavingColors(false); }
  };

  // ── layout handlers ──────────────────────────────────────────────────────
  const saveLayout = async () => {
    if (!designDocRef) return;
    setSavingLayout(true);
    try {
      await setDoc(designDocRef, { 
        productDisplayType, 
        productCardAnimation, 
        heroLayout, 
        menuStyle, 
        aboutLayout,
        contactFormStyle,
        ratingDisplayType,
        pageLayout,
        storeCardStyle: storeCardStyleLayout,
        visualStyle,
      }, { merge: true });
      setHasUnsavedLayout(false);
      toast({ title: 'Layout Saved', description: 'Store layout preferences updated.' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setSavingLayout(false); }
  };

  // ── sections handlers ────────────────────────────────────────────────────
  const saveSections = async () => {
    if (!designDocRef) return;
    setSavingSections(true);
    try {
      await setDoc(designDocRef, { contactFormStyle, ratingDisplayType, sectionOrder }, { merge: true });
      setHasUnsavedSections(false);
      toast({ title: 'Sections Saved', description: 'Section styles updated.' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setSavingSections(false); }
  };

  // ── wrapper functions to mark unsaved changes ────────────────────────────
  const updateColors = (updater: React.SetStateAction<Required<StoreTemplateColors>>) => {
    setColors(updater);
    setHasUnsavedColors(true);
  };

  const updateLayoutSetting = (setter: () => void) => {
    setter();
    setHasUnsavedLayout(true);
  };

  const updateSectionSetting = (setter: () => void) => {
    setter();
    setHasUnsavedSections(true);
  };

  // Layout wrapper functions
  const updateProductDisplayType = (val: ProductDisplayType) => {
    setProductDisplayType(val);
    setHasUnsavedLayout(true);
  };
  const updateProductCardAnimation = (val: ProductCardAnimation) => {
    setProductCardAnimation(val);
    setHasUnsavedLayout(true);
  };
  const updateHeroLayout = (val: HeroLayout) => {
    setHeroLayout(val);
    setHasUnsavedLayout(true);
  };
  const updateMenuStyle = (val: MenuStyle) => {
    setMenuStyle(val);
    setHasUnsavedLayout(true);
  };
  const updateAboutLayout = (val: AboutLayout) => {
    setAboutLayout(val);
    setHasUnsavedLayout(true);
  };
  const updatePageLayout = (val: PageLayout) => {
    setPageLayout(val);
    setHasUnsavedLayout(true);
  };
  const updateStoreCardStyleLayout = (val: StoreCardStyle) => {
    setStoreCardStyleLayout(val);
    setHasUnsavedLayout(true);
  };
  const updateVisualStyle = (val: VisualStyle) => {
    setVisualStyle(val);
    setHasUnsavedLayout(true);
  };

  // Sections wrapper functions
  const updateContactFormStyle = (val: ContactFormStyle) => {
    setContactFormStyle(val);
    setHasUnsavedSections(true);
  };
  const updateRatingDisplayType = (val: RatingDisplayType) => {
    setRatingDisplayType(val);
    setHasUnsavedSections(true);
  };
  const updateSectionOrder = (updater: React.SetStateAction<StoreSectionOrder[]>) => {
    setSectionOrder(updater);
    setHasUnsavedSections(true);
  };

  const reorderSectionById = (fromId: StoreSectionId, toId: StoreSectionId) => {
    if (fromId === toId) return;
    updateSectionOrder(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const fromIndex = sorted.findIndex(section => section.id === fromId);
      const toIndex = sorted.findIndex(section => section.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      return sorted.map((section, idx) => ({ ...section, order: idx }));
    });
  };

  const uploadSectionBackgroundImage = async (sectionId: StoreSectionId, file: File) => {
    if (!canPersist) return;
    try {
      if (!demoMode && storeId) await assertCanUploadBytes(db, storeId, file.size);
      const path = `${mediaRoot}/section-backgrounds/${sectionId}/${Date.now()}_${encodeURIComponent(file.name)}`;
      const imageRef = ref(storage, path);
      await uploadBytes(imageRef, file);
      await trackStorageUsageAfterUpload(db, storeId, file.size);
      const imageUrl = await getDownloadURL(imageRef);
      updateSectionOrder(prev => prev.map(section => section.id === sectionId ? { ...section, backgroundImage: imageUrl } : section));
      toast({ title: 'Section Background Added', description: 'Save sections to publish this change.' });
    } catch {
      toast({ title: 'Upload Failed', variant: 'destructive' });
    }
  };

  // ── color slot labels ────────────────────────────────────────────────────
  const COLOR_SLOTS: Array<{ key: keyof Required<StoreTemplateColors>; label: string; hint: string; affects: string }> = [
    { key: 'primary',              label: 'Primary Color',           hint: 'Header bar, buttons, links',                 affects: 'Top navigation bar, primary buttons, product links' },
    { key: 'heroBg',               label: 'Banner Background',       hint: 'Store banner/hero section background',       affects: 'The banner area below the top navigation with store name and slogan' },
    { key: 'heroTextColor',        label: 'Banner Text Color',       hint: 'Text color in banner/hero section',          affects: 'Store name and slogan text in the banner area' },
    { key: 'storeCardBg',          label: 'Store Info Card BG',      hint: 'Store information card background',          affects: 'The main card showing store logo, description, and contact info' },
    { key: 'storeCardTextColor',   label: 'Store Info Text',         hint: 'Text color in store info card',              affects: 'Store description, contact details text in the info card' },
    { key: 'contentCardBg',        label: 'Content Cards BG',        hint: 'About, contact, and section cards',          affects: 'About Us cards, Contact page cards, and other content sections' },
    { key: 'contentCardTextColor', label: 'Content Cards Text',      hint: 'Text color in content cards',                affects: 'Text in About Us, Contact, and other content sections' },
    { key: 'surface',              label: 'Product Cards BG',        hint: 'Product card backgrounds',                   affects: 'Individual product card backgrounds in the products grid' },
    { key: 'textColor',            label: 'Product Text Color',      hint: 'Text in product cards',                      affects: 'Product names, prices, descriptions in product cards' },
    { key: 'background',           label: 'Page Background',         hint: 'Main page background color',                 affects: 'Entire page background behind all content' },
    { key: 'secondary',            label: 'Secondary Color',         hint: 'Secondary buttons, accents',                 affects: 'Secondary elements and navigation accents' },
    { key: 'accent',               label: 'Accent Color',            hint: 'Call-to-action, highlights, badges',         affects: 'Buy Now button, badges, special highlights' },
    { key: 'highlight',            label: 'Highlight/Border Color',  hint: 'Borders, hover effects, decorative',         affects: 'Card borders, hover effects, dividers' },
  ];

  // ── shared picker tile ───────────────────────────────────────────────────
  function OptionTile<T extends string | number>({
    option, selected, onSelect
  }: { option: { id: T; label: string; desc: string; icon?: string; preview?: string }; selected: T; onSelect: (id: T) => void }) {
    const isActive = option.id === selected;
    return (
      <button
        type="button"
        onClick={() => onSelect(option.id)}
        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all focus:outline-none
          ${isActive
            ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
            : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
          }`}
      >
        {isActive && (
          <span className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
            <Check className="h-3 w-3" />
          </span>
        )}
        {option.icon && (
          <span className="text-2xl leading-none">{option.icon}</span>
        )}
        {option.preview && (
          <span className={`text-xs font-mono px-2 py-1 rounded ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {option.preview}
          </span>
        )}
        <span className="font-semibold text-sm">{option.label}</span>
        <span className="text-xs text-muted-foreground leading-tight">{option.desc}</span>
      </button>
    );
  }

  // ── tab bar ──────────────────────────────────────────────────────────────
  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'templates', label: 'Templates', icon: <Eye className="h-4 w-4" /> },
    { id: 'colors',    label: 'Colors',    icon: <Palette className="h-4 w-4" /> },
    { id: 'layout',    label: 'Layout',    icon: <LayoutGrid className="h-4 w-4" /> },
    { id: 'sections',  label: 'Forms & ratings', icon: <Layers className="h-4 w-4" /> },
  ];

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <AdminPageShell
      title={demoMode ? 'Demo Store Design' : 'Classic Template Editor'}
      description={
        demoMode
          ? 'Templates, colors, layout, and sections for this demo store'
          : 'Original Grabio drag-and-drop — reorder sections, grid widths, and layout controls'
      }
      eyebrow={demoMode ? 'Builder Demo' : 'Classic drag & drop'}
      backTo={demoMode ? '/builder' : '/admin/dashboard'}
      backLabel={demoMode ? 'Back to Builder Dashboard' : 'Dashboard'}
      actions={
        <div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                if (!designDocRef) return;
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const imported = JSON.parse(text);
                  const sectionOrderImport = extractSectionOrderFromDesignImport(imported);
                  if (!sectionOrderImport) {
                    toast({ title: 'Import Failed', description: 'JSON must include a sectionOrder array.', variant: 'destructive' });
                    return;
                  }
                  await setDoc(
                    designDocRef,
                    { ...layoutImportFirestorePatch(sectionOrderImport), updatedAt: new Date().toISOString() },
                    { merge: true },
                  );
                  setSectionOrder(sectionOrderImport);
                  setSelectedTemplate('custom');
                  toast({ title: 'Layout Imported', description: 'Section order applied to Custom template only.' });
                } catch (err) {
                  toast({ title: 'Import Failed', description: 'Invalid JSON file.', variant: 'destructive' });
                }
              }}
            />
            <Button variant="outline" size="sm" className="gap-2" as="span">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import layout
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            JSON import applies section order only (Custom template)
          </p>
        </div>
      }
    >
        {!demoMode && (
          <AdminPanel className="mb-6 border border-violet-200 bg-violet-50/50">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Live preview, themes &amp; store content</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use Theme Editor for Shopify-style preview, themes, colors, and copy.
                </p>
              </div>
              <Button asChild variant="default" size="sm">
                <Link to="/admin/theme-editor">Open Theme Editor</Link>
              </Button>
            </CardContent>
          </AdminPanel>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all flex-1 justify-center
                ${activeTab === tab.id
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ══ TEMPLATES TAB ══ */}
        {activeTab === 'templates' && (
          <div className="space-y-8">
            {/* Template cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(tmpl => (
                <AdminPanel key={tmpl.id} className={`relative overflow-hidden ${selectedTemplate === tmpl.id ? 'ring-2 ring-primary' : ''}`}>
                  {selectedTemplate === tmpl.id && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="bg-primary text-primary-foreground"><Check className="h-3 w-3 mr-1" />Active</Badge>
                    </div>
                  )}
                  {tmpl.isPremium && (
                    <div className="absolute top-2 left-2 z-10"><Badge variant="secondary">Premium</Badge></div>
                  )}
                  {/* Visual Layout Preview */}
                  <div className={`aspect-video relative overflow-hidden border-b-2 shadow-inner ${previewStyles[tmpl.id].shell} transition-transform hover:scale-[1.02] duration-300`}>
                    {/* Modern: Hybrid layout with 4-col grid */}
                    {tmpl.id === 'modern' && (
                      <div className="h-full flex flex-col">
                        <div className={`h-1/3 ${previewStyles[tmpl.id].header} flex items-center justify-center relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                          <span className={`text-xs font-bold ${previewStyles[tmpl.id].title} relative z-10`}>FULL HERO</span>
                        </div>
                        <div className="flex-1 p-2">
                          <div className="grid grid-cols-4 gap-1.5 h-full">
                            {[1,2,3,4].map(i => <div key={i} className={`rounded-lg ${previewStyles[tmpl.id].block}`}/>)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Minimal: Contained with list view */}
                    {tmpl.id === 'minimal' && (
                      <div className="h-full flex flex-col p-3">
                        <div className={`h-8 ${previewStyles[tmpl.id].header} rounded-lg mb-2 flex items-center justify-center`}>
                          <span className="text-[10px] font-semibold">Minimal Bar</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          {[1,2,3].map(i => <div key={i} className={`h-1/3 rounded-lg ${previewStyles[tmpl.id].block}`}/>)}
                        </div>
                      </div>
                    )}
                    
                    {/* Classic: Split hero + 3-col grid */}
                    {tmpl.id === 'classic' && (
                      <div className="h-full flex flex-col p-2">
                        <div className="h-1/2 grid grid-cols-2 gap-2 mb-2">
                          <div className={`rounded-lg ${previewStyles[tmpl.id].header} relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                          </div>
                          <div className={`rounded-lg ${previewStyles[tmpl.id].header} opacity-80 relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-gradient-to-tl from-black/20 to-transparent"></div>
                          </div>
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-1.5">
                          {[1,2,3].map(i => <div key={i} className={`rounded-lg ${previewStyles[tmpl.id].block}`}/>)}
                        </div>
                      </div>
                    )}
                    
                    {/* Vibrant: Full-width masonry */}
                    {tmpl.id === 'vibrant' && (
                      <div className="h-full flex flex-col">
                        <div className={`h-1/4 ${previewStyles[tmpl.id].header} flex items-center justify-center relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_70%)]"></div>
                          <span className={`text-xs font-extrabold ${previewStyles[tmpl.id].title} relative z-10 tracking-wider`}>FULL WIDTH</span>
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-1.5 p-2">
                          <div className={`rounded-xl ${previewStyles[tmpl.id].block} row-span-2`}/>
                          <div className={`rounded-xl ${previewStyles[tmpl.id].block}`}/>
                          <div className={`rounded-xl ${previewStyles[tmpl.id].block} row-span-2`}/>
                          <div className={`rounded-xl ${previewStyles[tmpl.id].block}`}/>
                        </div>
                      </div>
                    )}
                    
                    {/* Professional: Large 2-col cards */}
                    {tmpl.id === 'professional' && (
                      <div className="h-full flex flex-col p-3">
                        <div className={`h-1/4 ${previewStyles[tmpl.id].header} rounded-lg mb-3 flex items-center justify-center shadow-lg`}>
                          <span className={`text-xs ${previewStyles[tmpl.id].title} font-semibold tracking-wide`}>CENTERED</span>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          {[1,2].map(i => <div key={i} className={`rounded-lg ${previewStyles[tmpl.id].block}`}/>)}
                        </div>
                      </div>
                    )}
                    
                    {/* Artistic: Compact 4-col */}
                    {tmpl.id === 'artistic' && (
                      <div className="h-full flex flex-col">
                        <div className={`h-1/3 ${previewStyles[tmpl.id].header} flex items-center justify-center relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.3)_0%,_transparent_60%)]"></div>
                          <span className={`text-xs font-extrabold ${previewStyles[tmpl.id].title} relative z-10 tracking-widest`}>HYBRID</span>
                        </div>
                        <div className="flex-1 p-2">
                          <div className="grid grid-cols-4 gap-1.5 h-full">
                            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`rounded-lg ${previewStyles[tmpl.id].block}`}/>)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Custom: User defined */}
                    {tmpl.id === 'custom' && (
                      <div className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-teal-100 via-emerald-50 to-cyan-100">
                        <div className="text-center">
                          <div className="text-4xl mb-3 animate-pulse">⚙️</div>
                          <div className="text-sm font-bold text-teal-800 mb-1">Your Layout</div>
                          <div className="text-xs text-teal-600 font-medium">Customize Everything</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle>{tmpl.name}</CardTitle>
                    <CardDescription>{tmpl.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium mb-2">Color Palette</div>
                        <div className="flex gap-2">
                          {tmpl.colors.map((c, i) => (
                            <span key={i} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tmpl.features.map((f, i) => <Badge key={i} variant="outline" className="text-xs">{f}</Badge>)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedTemplate === tmpl.id ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => handleSelectTemplate(tmpl.id)}
                          disabled={selectedTemplate === tmpl.id}
                        >
                          {selectedTemplate === tmpl.id ? <><Check className="h-4 w-4 mr-2" />Active</> : 'Use Template'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setPreviewTemplate(tmpl.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </AdminPanel>
              ))}
            </div>

            {/* Section Order & Visibility - only show when Custom template is selected */}
            {selectedTemplate === 'custom' && (
              <AdminPanel className="border-2 border-primary/30 shadow-lg">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Customize Your Template Sections
                  </CardTitle>
                  <CardDescription>Control which sections appear and their display order on your storefront</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {sectionOrder
                      .sort((a, b) => a.order - b.order)
                      .map((section) => {
                        const sectionLabels: Record<StoreSectionId, string> = {
                          hero: 'Hero / Banner',
                          about: 'About Us',
                          announcements: 'Announcements',
                          products: 'Products Catalog',
                          gallery: 'Gallery',
                          reviews: 'Customer Reviews',
                          contact: 'Contact Form',
                        };
                        const label = sectionLabels[section.id];
                        
                        return (
                          <div
                            key={section.id}
                            className="border-2 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 hover:border-primary/40 transition-all p-4"
                            draggable
                            onDragStart={() => setDraggingSectionId(section.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggingSectionId) reorderSectionById(draggingSectionId, section.id);
                              setDraggingSectionId(null);
                            }}
                            onDragEnd={() => setDraggingSectionId(null)}
                          >
                            {/* Row 1: Basic controls */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* Drag handle */}
                              <div className="text-muted-foreground cursor-move select-none" title="Drag to reorder">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                                </svg>
                              </div>
                              
                              {/* Position */}
                              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                {section.order + 1}
                              </span>
                              
                              {/* Label */}
                              <span className="flex-1 font-bold text-sm">{label}</span>
                              
                              {/* Up/Down */}
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentIdx = sectionOrder.findIndex(s => s.id === section.id);
                                    if (currentIdx <= 0) return;
                                    const newOrder = [...sectionOrder];
                                    [newOrder[currentIdx], newOrder[currentIdx - 1]] = [newOrder[currentIdx - 1], newOrder[currentIdx]];
                                    newOrder.forEach((s, idx) => s.order = idx);
                                    updateSectionOrder(newOrder);
                                  }}
                                  disabled={section.order === 0}
                                  className="p-1.5 rounded hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title="Move up"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentIdx = sectionOrder.findIndex(s => s.id === section.id);
                                    if (currentIdx >= sectionOrder.length - 1) return;
                                    const newOrder = [...sectionOrder];
                                    [newOrder[currentIdx], newOrder[currentIdx + 1]] = [newOrder[currentIdx + 1], newOrder[currentIdx]];
                                    newOrder.forEach((s, idx) => s.order = idx);
                                    updateSectionOrder(newOrder);
                                  }}
                                  disabled={section.order === sectionOrder.length - 1}
                                  className="p-1.5 rounded hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title="Move down"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                              
                              {/* Visible/Hidden */}
                              <button
                                type="button"
                                onClick={() => {
                                  updateSectionOrder(prev =>
                                    prev.map(s => s.id === section.id ? { ...s, enabled: !s.enabled } : s)
                                  );
                                }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                  section.enabled
                                    ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30'
                                    : 'bg-gray-300/60 text-gray-600 hover:bg-gray-300/80'
                                }`}
                              >
                                {section.enabled ? '👁 Visible' : '🚫 Hidden'}
                              </button>
                            </div>

                            {/* Row 2: Style controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 pl-7">
                              {/* Grid Width */}
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Grid Width</label>
                                <div className="flex gap-0.5 border rounded overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, width: 'full' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${(section.width || 'full') === 'full' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                    title="Full width row"
                                  >
                                    Full
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, width: 'half' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.width === 'half' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                    title="Half - 2 per row"
                                  >
                                    1/2
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, width: 'third' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.width === 'third' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                    title="Third - 3 per row"
                                  >
                                    1/3
                                  </button>
                                </div>
                              </div>

                              {/* Container Width */}
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Container</label>
                                <div className="flex gap-0.5 border rounded overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, container: 'full-width' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${(section.container || 'contained') === 'full-width' ? 'bg-blue-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="Edge-to-edge"
                                  >
                                    Full
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, container: 'wide' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.container === 'wide' ? 'bg-blue-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="Wide 1536px"
                                  >
                                    Wide
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, container: 'contained' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.container === 'contained' ? 'bg-blue-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="Contained 1280px"
                                  >
                                    Box
                                  </button>
                                </div>
                              </div>

                              {/* Padding */}
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Padding</label>
                                <div className="flex gap-0.5 border rounded overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, padding: 'none' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.padding === 'none' ? 'bg-purple-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="No padding"
                                  >
                                    0
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, padding: 'small' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.padding === 'small' ? 'bg-purple-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="Small padding"
                                  >
                                    S
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, padding: 'medium' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${(section.padding || 'medium') === 'medium' ? 'bg-purple-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="Medium padding"
                                  >
                                    M
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, padding: 'large' } : s))}
                                    className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${section.padding === 'large' ? 'bg-purple-500 text-white' : 'bg-background hover:bg-muted'}`}
                                    title="Large padding"
                                  >
                                    L
                                  </button>
                                </div>
                              </div>

                              {/* Toggles */}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, showBackground: !(s.showBackground ?? true) } : s))}
                                  className={`flex-1 px-2 py-1 text-xs font-bold rounded transition-all ${(section.showBackground ?? true) ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                                  title="Toggle background"
                                >
                                  {(section.showBackground ?? true) ? '🎨 BG' : '⬜ BG'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, showBorders: !(s.showBorders ?? true) } : s))}
                                  className={`flex-1 px-2 py-1 text-xs font-bold rounded transition-all ${(section.showBorders ?? true) ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                                  title="Toggle borders/rounded corners"
                                >
                                  {(section.showBorders ?? true) ? '📐 Border' : '▢ Border'}
                                </button>
                              </div>

                              {/* Animation */}
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Animation</label>
                                <div className="flex flex-wrap gap-1">
                                  {SECTION_ANIMATION_OPTIONS.map((option) => (
                                    <button
                                      key={`${section.id}-${option.id}`}
                                      type="button"
                                      onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, animation: option.id } : s))}
                                      className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${(section.animation || 'fade') === option.id ? 'bg-indigo-500 text-white' : 'bg-background border hover:bg-muted'}`}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Section background image */}
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Background Image</label>
                                <div className="space-y-2">
                                  <label className="cursor-pointer block">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (!file) return;
                                        void uploadSectionBackgroundImage(section.id, file);
                                      }}
                                    />
                                    <span className="inline-flex items-center justify-center px-2 py-1 text-[11px] border rounded w-full hover:bg-muted">Upload</span>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, backgroundImage: '' } : s))}
                                    className="inline-flex items-center justify-center px-2 py-1 text-[11px] border rounded w-full hover:bg-muted"
                                  >
                                    Clear
                                  </button>
                                  {section.backgroundImage && (
                                    <img src={section.backgroundImage} alt={`${label} background`} className="w-full h-10 object-cover rounded border" />
                                  )}
                                </div>
                              </div>

                              {/* Custom CSS */}
                              <div className="md:col-span-2 lg:col-span-2">
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Custom CSS (inline declarations)</label>
                                <textarea
                                  value={section.customCss || ''}
                                  onChange={(e) => updateSectionOrder(prev => prev.map(s => s.id === section.id ? { ...s, customCss: e.target.value } : s))}
                                  className="w-full min-h-[54px] text-xs border rounded p-2 bg-background"
                                  placeholder="background-size: cover; border-style: dashed;"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Visual Layout Preview */}
                  <div className="mt-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-blue-300 rounded-xl">
                    <p className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Layout Preview - How Your Sections Will Appear:
                    </p>
                    <div className="space-y-3">
                      {(() => {
                        // Group sections into rows based on width
                        const enabledSections = sectionOrder
                          .filter(s => s.enabled)
                          .sort((a, b) => a.order - b.order);
                        
                        const rows: StoreSectionOrder[][] = [];
                        let currentRow: StoreSectionOrder[] = [];
                        let currentRowWidth: SectionWidth | null = null;
                        
                        enabledSections.forEach((section) => {
                          const width = section.width || 'full';
                          
                          if (width === 'full') {
                            if (currentRow.length > 0) {
                              rows.push(currentRow);
                              currentRow = [];
                              currentRowWidth = null;
                            }
                            rows.push([section]);
                          } else {
                            if (currentRowWidth !== null && currentRowWidth !== width) {
                              rows.push(currentRow);
                              currentRow = [];
                              currentRowWidth = null;
                            }
                            
                            currentRow.push(section);
                            currentRowWidth = width;
                            
                            const maxSectionsInRow = width === 'half' ? 2 : 3;
                            if (currentRow.length === maxSectionsInRow) {
                              rows.push(currentRow);
                              currentRow = [];
                              currentRowWidth = null;
                            }
                          }
                        });
                        
                        if (currentRow.length > 0) {
                          rows.push(currentRow);
                        }
                        
                        const sectionLabels: Record<StoreSectionId, string> = {
                          hero: 'Hero',
                          about: 'About',
                          announcements: 'News',
                          products: 'Products',
                          gallery: 'Gallery',
                          reviews: 'Reviews',
                          contact: 'Contact',
                        };
                        
                        return rows.map((row, rowIdx) => (
                          <div
                            key={rowIdx}
                            className={`grid gap-2 ${
                              row.length === 1 
                                ? 'grid-cols-1' 
                                : row.length === 2 
                                ? 'grid-cols-2'
                                : 'grid-cols-3'
                            }`}
                          >
                            {row.map((section) => (
                              <div
                                key={section.id}
                                className="bg-white border-2 border-primary/40 rounded-lg p-3 text-center shadow-sm"
                              >
                                <div className="text-xs font-bold text-primary mb-1">
                                  {sectionLabels[section.id]}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {section.width === 'half' ? '50% width' : section.width === 'third' ? '33% width' : '100% width'}
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                    {sectionOrder.filter(s => s.enabled).length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No visible sections - enable sections to see preview
                      </div>
                    )}
                  </div>

                  <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-sm">
                    <p className="text-base text-blue-900 font-bold mb-3 flex items-center gap-2">
                      <Settings2 className="h-5 w-5" />
                      Elementor-Style Controls Guide:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-900">
                      <div>
                        <p className="font-bold mb-1.5">📐 Grid Width (Row Position)</p>
                        <ul className="space-y-0.5 ml-3">
                          <li>• <strong>Full</strong> - Section takes entire row</li>
                          <li>• <strong>1/2</strong> - 2 sections side-by-side</li>
                          <li>• <strong>1/3</strong> - 3 sections side-by-side</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold mb-1.5">📦 Container (Section Width)</p>
                        <ul className="space-y-0.5 ml-3">
                          <li>• <strong>Full</strong> - Edge-to-edge (fullscreen)</li>
                          <li>• <strong>Wide</strong> - 1536px max, centered</li>
                          <li>• <strong>Box</strong> - 1280px max, centered</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold mb-1.5">📏 Padding</p>
                        <ul className="space-y-0.5 ml-3">
                          <li>• <strong>0</strong> - No padding (tight)</li>
                          <li>• <strong>S</strong> - Small (16px)</li>
                          <li>• <strong>M</strong> - Medium (24px, default)</li>
                          <li>• <strong>L</strong> - Large (48px)</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold mb-1.5">🎨 Style Toggles</p>
                        <ul className="space-y-0.5 ml-3">
                          <li>• <strong>BG</strong> - Show/hide background color</li>
                          <li>• <strong>Border</strong> - Show/hide rounded corners & borders</li>
                          <li>• <strong>Visible/Hidden</strong> - Enable/disable section</li>
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs text-blue-800 mt-3 pt-3 border-t border-blue-200">
                      <strong>💡 Pro Tip:</strong> For fullscreen hero banners, use <strong>Container: Full + Padding: 0 + BG: Off + Border: Off</strong> to get true edge-to-edge layouts like Elementor!
                    </p>
                  </div>
                </CardContent>
              </AdminPanel>
            )}

            {/* Media upload */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Store Images</CardTitle>
                <CardDescription>Hero background, carousel slides, and photo gallery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Background */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Background Image</h4>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
                        <span className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted">
                          <Upload className="h-4 w-4" />{uploadingSection === 'background' ? 'Uploading…' : 'Upload'}
                        </span>
                      </label>
                    </div>
                    {backgroundImage ? (
                      <div className="relative">
                        <img src={backgroundImage} alt="Store background" className="w-full h-48 object-cover rounded-lg border" />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2"
                          onClick={async () => { setBackgroundImage(''); await saveMediaSettings({ backgroundImage: '' }); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                        No background image uploaded
                      </div>
                    )}
                  </div>

                  {/* Carousel */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Carousel Images <span className="text-xs text-muted-foreground ml-1">({carouselImages.length}/12)</span></h4>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleMultiUpload(e, 'carousel')} />
                        <span className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted">
                          <Upload className="h-4 w-4" />{uploadingSection === 'carousel' ? 'Uploading…' : 'Add Images'}
                        </span>
                      </label>
                    </div>
                    {carouselImages.length === 0 ? (
                      <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">No carousel images yet</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {carouselImages.map((url, index) => (
                          <div key={`${url}-${index}`}
                            className={`relative ${draggingItem?.mode === 'carousel' && draggingItem.index === index ? 'opacity-60 ring-2 ring-primary rounded-md' : ''}`}
                            draggable onDragStart={() => handleDragStart('carousel', index)}
                            onDragOver={e => e.preventDefault()} onDrop={() => void handleDrop('carousel', index)}
                            onDragEnd={() => setDraggingItem(null)}>
                            <img src={url} alt={`Carousel ${index + 1}`} className="w-full h-24 rounded-md object-cover border" />
                            <div className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">#{index + 1}</div>
                            {isMobile && (
                              <div className="absolute top-1 left-1 flex gap-1">
                                <button type="button" onClick={() => void moveImageByStep('carousel', index, -1)} disabled={index === 0} className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /></button>
                                <button type="button" onClick={() => void moveImageByStep('carousel', index, 1)} disabled={index === carouselImages.length - 1} className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"><ChevronRight className="h-3 w-3" /></button>
                              </div>
                            )}
                            <button type="button" onClick={() => removeImageAt('carousel', index)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gallery */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Store Gallery <span className="text-xs text-muted-foreground ml-1">({galleryImages.length}/24)</span></h4>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleMultiUpload(e, 'gallery')} />
                        <span className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-muted">
                          <Upload className="h-4 w-4" />{uploadingSection === 'gallery' ? 'Uploading…' : 'Add Images'}
                        </span>
                      </label>
                    </div>
                    {galleryImages.length === 0 ? (
                      <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">No gallery images yet</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {galleryImages.map((url, index) => (
                          <div key={`${url}-${index}`}
                            className={`relative ${draggingItem?.mode === 'gallery' && draggingItem.index === index ? 'opacity-60 ring-2 ring-primary rounded-md' : ''}`}
                            draggable onDragStart={() => handleDragStart('gallery', index)}
                            onDragOver={e => e.preventDefault()} onDrop={() => void handleDrop('gallery', index)}
                            onDragEnd={() => setDraggingItem(null)}>
                            <img src={url} alt={`Gallery ${index + 1}`} className="w-full h-24 rounded-md object-cover border" />
                            <div className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">#{index + 1}</div>
                            {isMobile && (
                              <div className="absolute top-1 left-1 flex gap-1">
                                <button type="button" onClick={() => void moveImageByStep('gallery', index, -1)} disabled={index === 0} className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /></button>
                                <button type="button" onClick={() => void moveImageByStep('gallery', index, 1)} disabled={index === galleryImages.length - 1} className="bg-black/70 text-white rounded-full p-1 disabled:opacity-40"><ChevronRight className="h-3 w-3" /></button>
                              </div>
                            )}
                            <button type="button" onClick={() => removeImageAt('gallery', index)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </AdminPanel>

            {/* Auto-save Notice */}
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
              <strong>✓ Auto-Save Enabled:</strong> Template selection and media uploads are saved automatically. No save button needed!
            </div>
          </div>
        )}

        {/* ══ COLORS TAB ══ */}
        {activeTab === 'colors' && (
          <div className="space-y-8">
            {/* Enhanced Live Preview */}
            <AdminPanel>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Store Preview
                </CardTitle>
                <CardDescription>Real-time preview showing how your colors look on your store</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Realistic store page mockup */}
                <div className="rounded-xl overflow-hidden border-4 shadow-2xl" style={{ background: colors.background }}>
                  {/* Top Navigation Bar */}
                  <div className="px-6 py-4 flex items-center justify-between border-b" style={{ background: colors.primary, borderColor: colors.highlight }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/20" />
                      <span className="text-white font-bold text-lg">Your Store</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/20" />
                      <div className="w-8 h-8 rounded-full bg-white/20" />
                    </div>
                  </div>

                  {/* Hero/Banner Section */}
                  <div className="mx-6 mt-6 mb-0 p-6 rounded-xl shadow-sm" style={{ background: colors.heroBg }}>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: colors.heroTextColor }}>Store Banner</h2>
                    <p className="text-sm" style={{ color: colors.heroTextColor, opacity: 0.9 }}>Banner Background & Text Color</p>
                  </div>

                  {/* Store Info Card */}
                  <div className="m-6 p-6 rounded-xl border-2" style={{ background: colors.storeCardBg, borderColor: colors.highlight }}>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-20 h-20 rounded-xl border-4 border-white shadow-lg" style={{ background: colors.primary + '40' }} />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2" style={{ color: colors.storeCardTextColor }}>Store Name</h3>
                        <p className="text-sm" style={{ color: colors.storeCardTextColor, opacity: 0.8 }}>Store Info Card BG & Text</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      {[1,2,3].map(i => (
                        <div key={i} className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: colors.accent }}>
                          Badge {i}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: colors.storeCardTextColor }}>
                      Store description and contact information appears here.
                    </p>
                  </div>

                  {/* Content Card (About/Contact) */}
                  <div className="mx-6 mb-4 p-4 rounded-xl border" style={{ background: colors.contentCardBg, borderColor: colors.highlight }}>
                    <h3 className="font-semibold mb-2" style={{ color: colors.contentCardTextColor }}>About / Contact Section</h3>
                    <p className="text-sm" style={{ color: colors.contentCardTextColor, opacity: 0.8 }}>Content Cards BG & Text</p>
                  </div>

                  {/* Products Section */}
                  <div className="px-6 pb-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold" style={{ color: colors.textColor }}>Products</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {[1,2,3].map(i => (
                        <div key={i} className="rounded-xl p-4 border-2 hover:shadow-lg transition-shadow" style={{ background: colors.surface, borderColor: colors.highlight }}>
                          <div className="aspect-square rounded-lg mb-3" style={{ background: colors.primary + '20' }} />
                          <div className="font-semibold mb-2" style={{ color: colors.textColor }}>Product {i}</div>
                          <div className="text-sm mb-3" style={{ color: colors.textColor, opacity: 0.7 }}>$99.99</div>
                          <button 
                            className="w-full py-2 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90" 
                            style={{ background: colors.accent }}
                          >
                            Add to Cart
                          </button>
                          <a href="#" className="block text-center text-sm mt-2 hover:underline" style={{ color: colors.primary }}>
                            View Details →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color Swatches */}
                <div className="mt-6 flex flex-wrap gap-3">
                  {COLOR_SLOTS.map(slot => (
                    <div key={slot.key} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-full border-4 border-white shadow-lg" style={{ backgroundColor: colors[slot.key] }} />
                      <span className="text-[10px] text-muted-foreground font-semibold text-center leading-tight max-w-[60px]">{slot.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </AdminPanel>

            {/* Preset Palettes */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Preset Palettes</CardTitle>
                <CardDescription>10 curated palettes for the {templates.find(t => t.id === selectedTemplate)?.name} template — click to apply all 7 colors at once</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {COLOR_PRESETS[selectedTemplate].map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset.palette)}
                      className="group flex flex-col items-center gap-2 p-3 border rounded-xl hover:border-primary hover:bg-muted/40 transition-all"
                    >
                      <div className="flex gap-1">
                        {(['primary','secondary','accent','highlight'] as const).map(k => (
                          <div key={k} className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ background: preset.palette[k] }} />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-center leading-tight">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </AdminPanel>

            {/* Free-pick color pickers */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Custom Colors</CardTitle>
                <CardDescription>Fine-tune each color to match your brand — changes preview instantly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {COLOR_SLOTS.map(slot => {
                    const colorValue = colors[slot.key] || '#000000';
                    return (
                    <div key={slot.key} className="flex items-start gap-4 p-4 border-2 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary/40 transition-colors">
                      <label className="cursor-pointer flex-shrink-0 relative group" title="Click to pick color">
                        <input
                          type="color"
                          value={colorValue}
                          onChange={e => updateColor(slot.key, e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <div className="w-16 h-16 rounded-xl border-4 border-white shadow-lg ring-2 ring-border group-hover:ring-primary transition-all" style={{ background: colorValue }} />
                        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Palette className="h-3 w-3" />
                        </div>
                      </label>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base mb-1">{slot.label}</div>
                        <div className="text-sm text-foreground/80 mb-2 font-medium">{slot.hint}</div>
                        <div className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          <span className="font-semibold">Affects:</span> {slot.affects}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground font-mono">#</span>
                          <input
                            type="text"
                            maxLength={7}
                            value={colorValue.replace('#', '')}
                            onChange={e => handleHexInput(slot.key, e.target.value)}
                            className="w-28 text-sm font-mono font-bold border-2 rounded-lg px-3 py-2 bg-background uppercase focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="RRGGBB"
                          />
                          <span className="text-xs text-muted-foreground">{colorValue}</span>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </CardContent>
            </AdminPanel>

            {/* Hero/Banner Layout Style */}
            <AdminPanel className="border-2 border-primary/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Banner / Hero Layout Style
                </CardTitle>
                <CardDescription>Choose how your banner section appears - configure both style and colors in one place</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {HERO_LAYOUT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setHeroLayout(opt.id)}
                      className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-center transition-all focus:outline-none hover:shadow-lg ${
                        heroLayout === opt.id
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-lg'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      {heroLayout === opt.id && (
                        <span className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="text-3xl leading-none">{opt.icon}</span>
                      <div>
                        <div className="font-semibold text-sm mb-1">{opt.label}</div>
                        <div className="text-xs text-muted-foreground leading-tight">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Visual Preview of Selected Layout */}
                <div className="mt-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-sm font-bold text-slate-800 mb-4">Preview: {HERO_LAYOUT_OPTIONS.find(o => o.id === heroLayout)?.label}</p>
                  
                  {heroLayout === 'fullscreen' && (
                    <div className="aspect-video rounded-lg overflow-hidden" style={{ background: colors.heroBg }}>
                      <div className="h-full flex flex-col items-center justify-center p-8">
                        <h2 className="text-2xl font-bold mb-2" style={{ color: colors.heroTextColor }}>Your Store Name</h2>
                        <p className="text-sm" style={{ color: colors.heroTextColor, opacity: 0.9 }}>Welcome message or slogan goes here</p>
                      </div>
                    </div>
                  )}
                  
                  {heroLayout === 'split' && (
                    <div className="grid grid-cols-2 gap-4 rounded-lg overflow-hidden">
                      <div className="aspect-video rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-gray-600">
                        Image
                      </div>
                      <div className="flex flex-col justify-center p-6 rounded-lg" style={{ background: colors.heroBg }}>
                        <h2 className="text-xl font-bold mb-2" style={{ color: colors.heroTextColor }}>Store Name</h2>
                        <p className="text-xs" style={{ color: colors.heroTextColor, opacity: 0.9 }}>Description text</p>
                      </div>
                    </div>
                  )}
                  
                  {heroLayout === 'minimal' && (
                    <div className="h-16 rounded-lg flex items-center justify-between px-6" style={{ background: colors.heroBg }}>
                      <span className="font-bold" style={{ color: colors.heroTextColor }}>Store Name</span>
                      <span className="text-sm" style={{ color: colors.heroTextColor, opacity: 0.8 }}>Minimal Banner</span>
                    </div>
                  )}
                  
                  {heroLayout === 'centered' && (
                    <div className="aspect-video rounded-lg flex items-center justify-center text-center p-8" style={{ background: colors.heroBg }}>
                      <div>
                        <h2 className="text-2xl font-bold mb-2" style={{ color: colors.heroTextColor }}>Your Store</h2>
                        <p className="text-sm" style={{ color: colors.heroTextColor, opacity: 0.9 }}>Centered text over gradient background</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Banner colors are configured above (Banner Background & Banner Text Color). Choose a layout that complements your brand - Fullscreen for impact, Minimal for simplicity, Split for visual balance.
                </div>
              </CardContent>
            </AdminPanel>

            {/* Save Colors Section */}
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => {
                const found = templates.find(t => t.id === selectedTemplate);
                if (found) updateColors(found.defaultPalette);
              }}>
                Reset to Template Defaults
              </Button>
              <div className="flex items-center gap-3">
                {hasUnsavedColors && (
                  <span className="text-xs text-amber-600 font-medium">• Unsaved changes</span>
                )}
                <Button onClick={saveColors} disabled={savingColors} className="gap-2" variant={hasUnsavedColors ? 'default' : 'outline'}>
                  <Save className="h-4 w-4" />{savingColors ? 'Saving…' : hasUnsavedColors ? 'Save Colors *' : 'Save Colors'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ══ LAYOUT TAB ══ */}
        {activeTab === 'layout' && (
          <div className="space-y-8">
            {/* Product display */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Product Display</CardTitle>
                <CardDescription>How products appear on your store — all include smooth entry animations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {PRODUCT_DISPLAY_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={productDisplayType} onSelect={updateProductDisplayType} />
                  ))}
                </div>
                {/* Mini animation demo */}
                <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Preview — {PRODUCT_DISPLAY_OPTIONS.find(o => o.id === productDisplayType)?.label}</div>
                  {productDisplayType === 'grid-standard' && (
                    <div className="grid grid-cols-4 gap-2">
                      {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-lg bg-white border animate-fade-in shadow-sm" />)}
                    </div>
                  )}
                  {productDisplayType === 'grid-large' && (
                    <div className="grid grid-cols-2 gap-2">
                      {[1,2].map(i => <div key={i} className="h-24 rounded-lg bg-white border animate-fade-in shadow-sm" />)}
                    </div>
                  )}
                  {productDisplayType === 'list' && (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-white border flex gap-2 items-center px-3 animate-fade-in shadow-sm">
                        <div className="w-8 h-8 rounded bg-muted" /><div className="flex-1 h-2 rounded bg-muted/60" />
                      </div>)}
                    </div>
                  )}
                  {productDisplayType === 'masonry' && (
                    <div className="grid grid-cols-3 gap-2">
                      {[24,16,20,18,24,14].map((h,i) => <div key={i} style={{ height: `${h * 2}px` }} className="rounded-lg bg-white border animate-fade-in shadow-sm" />)}
                    </div>
                  )}
                  {productDisplayType === 'spotlight' && (
                    <div className="space-y-2">
                      <div className="h-20 rounded-lg bg-white border animate-fade-in shadow-sm" />
                      <div className="grid grid-cols-3 gap-2">
                        {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-white border animate-fade-in shadow-sm" />)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </AdminPanel>

            {/* Product hover animation */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Product Hover Animation</CardTitle>
                <CardDescription>Choose how product cards animate when users hover over them — adds visual interest and interactivity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {PRODUCT_ANIMATION_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={productCardAnimation} onSelect={updateProductCardAnimation} />
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Hover animations are subtle on mobile but create an engaging experience on desktop. Try "Parallax" or "3D Lift" for modern stores.
                </div>
              </CardContent>
            </AdminPanel>

            {/* Menu style */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Navigation Menu Style</CardTitle>
                <CardDescription>How the top navigation bar appears to customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {MENU_STYLE_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={menuStyle} onSelect={updateMenuStyle} />
                  ))}
                </div>
              </CardContent>
            </AdminPanel>

            {/* About layout */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>About Us Layout</CardTitle>
                <CardDescription>Control how your About / Mission / Vision section appears (when filled in Store Profile)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ABOUT_LAYOUT_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={aboutLayout} onSelect={updateAboutLayout} />
                  ))}
                </div>
              </CardContent>
            </AdminPanel>

            {/* Page Layout */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Page Layout</CardTitle>
                <CardDescription>Choose how content is positioned on the page — full-width for modern edge-to-edge design or contained for classic centered layout</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PAGE_LAYOUT_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={pageLayout} onSelect={updatePageLayout} />
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-violet-800">
                  <strong>🎨 Pro Tip:</strong> "Hybrid" gives you the best of both worlds — full-width hero banner with contained content sections for optimal readability.
                </div>
              </CardContent>
            </AdminPanel>

            {/* Store Card Style */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Store Info Card Style</CardTitle>
                <CardDescription>Control how your store information card (logo, description, contact) is displayed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {STORE_CARD_STYLE_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={storeCardStyleLayout} onSelect={updateStoreCardStyleLayout} />
                  ))}
                </div>
              </CardContent>
            </AdminPanel>

            {/* Visual Style */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Visual Style</CardTitle>
                <CardDescription>Choose the overall visual aesthetic for borders and corners throughout your store</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {VISUAL_STYLE_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={visualStyle} onSelect={updateVisualStyle} />
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <strong>✨ Style Guide:</strong> "Rounded" is friendly and modern, "Sharp" is professional and bold, "Mixed" combines both for unique visual interest.
                </div>
              </CardContent>
            </AdminPanel>

            <div className="flex justify-end gap-3 items-center">
              {hasUnsavedLayout && (
                <span className="text-xs text-amber-600 font-medium">• Unsaved changes</span>
              )}
              <Button onClick={saveLayout} disabled={savingLayout} className="gap-2" variant={hasUnsavedLayout ? 'default' : 'outline'}>
                <Save className="h-4 w-4" />{savingLayout ? 'Saving…' : hasUnsavedLayout ? 'Save Layout *' : 'Save Layout'}
              </Button>
            </div>
          </div>
        )}

        {/* ══ SECTIONS TAB (form & rating styles — layout DnD lives under Templates → Custom) ══ */}
        {activeTab === 'sections' && (
          <div className="space-y-8">
            <AdminPanel className="border border-dashed bg-muted/20">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Section drag-and-drop</strong> is on the{' '}
                  <button
                    type="button"
                    className="text-primary underline font-medium"
                    onClick={() => setActiveTab('templates')}
                  >
                    Templates
                  </button>{' '}
                  tab — select the <strong>Custom</strong> template for reorder, grid width, and visibility.
                </p>
              </CardContent>
            </AdminPanel>

            {/* Contact form */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Contact Form Style</CardTitle>
                <CardDescription>Choose which fields and layout appear on your Contact Us page</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {CONTACT_FORM_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={contactFormStyle} onSelect={updateContactFormStyle} />
                  ))}
                </div>

                {/* Form field preview */}
                <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Fields Preview — {CONTACT_FORM_OPTIONS.find(o => o.id === contactFormStyle)?.label}
                  </div>
                  <div className="space-y-2 max-w-xs">
                    {[1,2,3,4,5,6,7].includes(contactFormStyle) && (
                      <>
                        <div className="h-8 rounded border bg-white text-xs flex items-center px-2 text-muted-foreground">Your Name *</div>
                        <div className="h-8 rounded border bg-white text-xs flex items-center px-2 text-muted-foreground">Email Address *</div>
                      </>
                    )}
                    {contactFormStyle === 2 && <div className="h-8 rounded border bg-white text-xs flex items-center px-2 text-muted-foreground">Phone Number</div>}
                    {contactFormStyle === 3 && <div className="h-8 rounded border bg-white text-xs flex items-center px-2 text-muted-foreground">Subject ▾</div>}
                    {contactFormStyle !== 4 && contactFormStyle !== 7 && <div className="h-20 rounded border bg-white text-xs flex items-start p-2 text-muted-foreground">Message *</div>}
                    {contactFormStyle === 4 && <div className="h-8 rounded border bg-primary/20 text-xs flex items-center px-2 text-primary font-medium">Step 1 of 2 — Your Info</div>}
                    {contactFormStyle === 7 && (
                      <div className="h-10 rounded bg-green-500 text-white text-xs flex items-center justify-center gap-2 font-semibold">
                        <span>📲</span> Send on WhatsApp
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </AdminPanel>

            {/* Rating display */}
            <AdminPanel>
              <CardHeader>
                <CardTitle>Rating Display Style</CardTitle>
                <CardDescription>How customer ratings appear on your store — only visible to customers viewing your store</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {RATING_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={ratingDisplayType} onSelect={updateRatingDisplayType} />
                  ))}
                </div>

                {/* Rating preview */}
                <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Preview — {RATING_OPTIONS.find(o => o.id === ratingDisplayType)?.label}
                  </div>
                  {ratingDisplayType === 'stars' && (
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-lg">★★★★☆</span>
                      <span className="font-semibold">4.2</span>
                      <span className="text-muted-foreground text-sm">(18 reviews)</span>
                    </div>
                  )}
                  {ratingDisplayType === 'pill' && (
                    <div className="flex items-center gap-2">
                      <span className="bg-yellow-400 text-white text-sm font-bold px-3 py-1 rounded-full">★ 4.2</span>
                      <span className="text-muted-foreground text-sm">/ 5.0 · 18 reviews</span>
                    </div>
                  )}
                  {ratingDisplayType === 'number' && (
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-yellow-500">4.2</span>
                      <div>
                        <div className="text-yellow-400 text-sm">★★★★☆</div>
                        <div className="text-muted-foreground text-xs">18 reviews</div>
                      </div>
                    </div>
                  )}
                  {ratingDisplayType === 'card' && (
                    <div className="bg-white border rounded-xl p-4 max-w-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div>
                          <div className="font-semibold text-sm">Sample Customer</div>
                          <div className="text-yellow-400 text-xs">★★★★☆</div>
                          <div className="text-xs text-muted-foreground mt-1">"Great store, fast delivery!"</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {ratingDisplayType === 'minimal' && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">92% positive</span> based on 18 reviews
                    </div>
                  )}
                </div>
              </CardContent>
            </AdminPanel>

            <div className="flex justify-end gap-3 items-center">
              {hasUnsavedSections && (
                <span className="text-xs text-amber-600 font-medium">• Unsaved changes</span>
              )}
              <Button onClick={saveSections} disabled={savingSections} className="gap-2" variant={hasUnsavedSections ? 'default' : 'outline'}>
                <Save className="h-4 w-4" />{savingSections ? 'Saving…' : hasUnsavedSections ? 'Save Sections *' : 'Save Sections'}
              </Button>
            </div>
          </div>
        )}

        {/* ── AI Agent ──────────────────────────────────────────────────── */}
        {hasAiBuilder && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <span>🤖</span> AI Store Assistant
                <Badge variant="secondary" className="text-xs">ai_builder</Badge>
              </span>
              <span className="text-muted-foreground text-sm">{aiOpen ? '▲ Close' : '▼ Open'}</span>
            </button>

            {aiOpen && (
              <AdminPanel className="mt-3 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Generate store content with AI</CardTitle>
                  <CardDescription>
                    Uses your AI Builder credits. Results are copyable — apply them manually where needed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">What to generate</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={aiTask}
                        onChange={e => { setAiTask(e.target.value); setAiOutput(''); }}
                      >
                        {AI_STORE_TASKS.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Business type</label>
                      <input
                        type="text"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        placeholder="e.g. bakery, clothing boutique, electronics"
                        value={aiBusinessType}
                        onChange={e => setAiBusinessType(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={() => void handleAiGenerate()} disabled={aiLoading} className="w-full">
                    {aiLoading ? 'Generating…' : 'Generate with AI'}
                  </Button>
                  {aiOutput && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Result</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { void navigator.clipboard.writeText(aiOutput); toast({ title: 'Copied!' }); }}
                        >
                          Copy
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{aiOutput}</pre>
                    </div>
                  )}
                </CardContent>
              </AdminPanel>
            )}
          </div>
        )}

        {!hasAiBuilder && (
          <div className="mt-6 rounded-xl border border-dashed border-muted-foreground/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              🤖 <span className="font-medium">AI Store Assistant</span> — enable the <span className="font-medium">AI Builder</span> module in your{' '}
              <a href="/subscription" className="underline text-primary">subscription</a> to generate taglines, about text, and color palettes with AI.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (demoMode && demoId) {
                window.open(`/builder/demo/${demoId}/preview`, '_blank', 'noopener,noreferrer');
                return;
              }
              window.open(`/store/${storeSlug}`, '_blank', 'noopener,noreferrer');
            }}
            disabled={demoMode ? !demoId : !storeSlug}
          >
            {demoMode ? 'Preview demo store' : 'Visit Store Profile'}
          </Button>
        </div>
    </AdminPageShell>
  );
};

export default AdminTemplates;
