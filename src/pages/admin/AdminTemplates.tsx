import React, { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Palette, Eye, Check, Upload, Trash2, ChevronLeft, ChevronRight,
  LayoutGrid, Layers, Settings2, Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { assertCanUploadBytes, trackStorageUsageAfterUpload } from '@/lib/subscriptionEnforcement';
import type {
  ProductDisplayType, HeroLayout, MenuStyle, ContactFormStyle,
  RatingDisplayType, AboutLayout, StoreTemplateColors,
} from '@/types/storeProfile';

// ── types ────────────────────────────────────────────────────────────────────
type TemplateId = 'modern' | 'minimal' | 'classic' | 'vibrant' | 'professional' | 'artistic';
type TabId = 'templates' | 'colors' | 'layout' | 'sections';

type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  colors: string[];   // preview swatches (3 main)
  features: string[];
  isPremium: boolean;
  defaultPalette: Required<StoreTemplateColors>;
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

// ── component ────────────────────────────────────────────────────────────────
const AdminTemplates: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const db = getFirestore();

  // Tab
  const [activeTab, setActiveTab] = useState<TabId>('templates');

  // Templates tab
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('modern');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateId>('modern');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploadingSection, setUploadingSection] = useState<'background' | 'carousel' | 'gallery' | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ mode: 'carousel' | 'gallery'; index: number } | null>(null);

  // Colors tab  
  const EMPTY_COLORS = (): Required<StoreTemplateColors> => ({
    primary: '#38B2AC', secondary: '#2C5282', accent: '#ED8936',
    background: '#f8fafc', surface: '#ffffff', textColor: '#1a202c', highlight: '#22d3ee',
  });
  const [colors, setColors] = useState<Required<StoreTemplateColors>>(EMPTY_COLORS());
  const [savingColors, setSavingColors] = useState(false);

  // Layout tab
  const [productDisplayType, setProductDisplayType] = useState<ProductDisplayType>('grid-standard');
  const [productCardAnimation, setProductCardAnimation] = useState<ProductCardAnimation>('none');
  const [heroLayout, setHeroLayout] = useState<HeroLayout>('fullscreen');
  const [menuStyle, setMenuStyle] = useState<MenuStyle>('classic');
  const [aboutLayout, setAboutLayout] = useState<AboutLayout>('left');
  const [savingLayout, setSavingLayout] = useState(false);

  // Sections tab
  const [contactFormStyle, setContactFormStyle] = useState<ContactFormStyle>(1);
  const [ratingDisplayType, setRatingDisplayType] = useState<RatingDisplayType>('stars');
  const [sectionOrder, setSectionOrder] = useState<StoreSectionOrder[]>([
    { id: 'hero', enabled: true, order: 0, width: 'full' },
    { id: 'about', enabled: true, order: 1, width: 'full' },
    { id: 'announcements', enabled: true, order: 2, width: 'full' },
    { id: 'products', enabled: true, order: 3, width: 'full' },
    { id: 'gallery', enabled: true, order: 4, width: 'full' },
    { id: 'reviews', enabled: true, order: 5, width: 'full' },
    { id: 'contact', enabled: true, order: 6, width: 'full' },
  ]);
  const [savingSections, setSavingSections] = useState(false);

  // ── load from Firestore ──────────────────────────────────────────────────
  const templates: TemplateDefinition[] = [
    { id: 'modern', name: 'Modern', description: 'Clean, contemporary design with bold typography', colors: ['#38B2AC','#2C5282','#ED8936'], features: ['Responsive','Animations','Teal Accents'], isPremium: false, defaultPalette: COLOR_PRESETS.modern[0].palette },
    { id: 'minimal', name: 'Minimal', description: 'Simple, elegant design focusing on whitespace', colors: ['#718096','#2D3748','#E2E8F0'], features: ['Clean Layout','Typography','Fast Loading'], isPremium: false, defaultPalette: COLOR_PRESETS.minimal[0].palette },
    { id: 'classic', name: 'Classic', description: 'Timeless design with proven usability', colors: ['#2C5282','#3182CE','#63B3ED'], features: ['Traditional','High Contrast','Easy Nav'], isPremium: false, defaultPalette: COLOR_PRESETS.classic[0].palette },
    { id: 'vibrant', name: 'Vibrant', description: 'Energetic design with bold colors', colors: ['#ED8936','#F56565','#9F7AEA'], features: ['Bold Colors','Dynamic','Interactive'], isPremium: true, defaultPalette: COLOR_PRESETS.vibrant[0].palette },
    { id: 'professional', name: 'Professional', description: 'Corporate-style for B2B stores', colors: ['#2D3748','#4A5568','#718096'], features: ['Corporate','Trust','Formal'], isPremium: true, defaultPalette: COLOR_PRESETS.professional[0].palette },
    { id: 'artistic', name: 'Artistic', description: 'Creative layouts with unique artistic feel', colors: ['#9F7AEA','#ED64A6','#F6AD55'], features: ['Creative','Artistic','Unique'], isPremium: true, defaultPalette: COLOR_PRESETS.artistic[0].palette },
  ];

  useEffect(() => {
    const load = async () => {
      if (!storeId) return;
      const snap = await getDoc(doc(db, 'storeProfiles', storeId));
      if (!snap.exists()) return;
      const d = snap.data();
      // templates tab
      if (d.template && templates.some(t => t.id === d.template)) {
        setSelectedTemplate(d.template as TemplateId);
        setPreviewTemplate(d.template as TemplateId);
      }
      setBackgroundImage(typeof d.storeBackgroundImage === 'string' ? d.storeBackgroundImage : '');
      setCarouselImages(Array.isArray(d.carouselImages) ? d.carouselImages.filter((u: unknown) => typeof u === 'string') : []);
      setGalleryImages(Array.isArray(d.galleryImages) ? d.galleryImages.filter((u: unknown) => typeof u === 'string') : []);
      // colors tab
      if (d.templateColors && typeof d.templateColors === 'object') {
        setColors(prev => ({ ...prev, ...d.templateColors }));
      }
      // layout tab
      if (d.productDisplayType) setProductDisplayType(d.productDisplayType as ProductDisplayType);
      if (d.productCardAnimation) setProductCardAnimation(d.productCardAnimation as ProductCardAnimation);
      if (d.heroLayout) setHeroLayout(d.heroLayout as HeroLayout);
      if (d.menuStyle) setMenuStyle(d.menuStyle as MenuStyle);
      if (d.aboutLayout) setAboutLayout(d.aboutLayout as AboutLayout);
      // sections tab
      if (d.contactFormStyle) setContactFormStyle(d.contactFormStyle as ContactFormStyle);
      if (d.ratingDisplayType) setRatingDisplayType(d.ratingDisplayType as RatingDisplayType);
      if (Array.isArray(d.sectionOrder)) setSectionOrder(d.sectionOrder as StoreSectionOrder[]);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // ── template handlers ────────────────────────────────────────────────────
  const previewStyles: Record<TemplateId, { shell: string; header: string; block: string; title: string }> = {
    modern:       { shell: 'bg-gradient-to-b from-cyan-50 to-indigo-50', header: 'bg-white/90 border-cyan-200', block: 'bg-white border-cyan-100', title: 'text-cyan-800' },
    minimal:      { shell: 'bg-white', header: 'bg-white border-gray-200', block: 'bg-white border-gray-200', title: 'text-gray-800' },
    classic:      { shell: 'bg-blue-50/50', header: 'bg-white border-blue-300', block: 'bg-white border-blue-200', title: 'text-blue-900' },
    vibrant:      { shell: 'bg-gradient-to-br from-orange-50 via-pink-50 to-violet-100', header: 'bg-white border-orange-200', block: 'bg-white border-pink-200', title: 'text-fuchsia-900' },
    professional: { shell: 'bg-slate-100', header: 'bg-white border-slate-300', block: 'bg-white border-slate-200', title: 'text-slate-900' },
    artistic:     { shell: 'bg-gradient-to-tr from-violet-100 to-amber-50', header: 'bg-white border-violet-200', block: 'bg-white border-rose-200', title: 'text-violet-900' },
  };

  const handleSelectTemplate = async (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setColors(found.defaultPalette);
    }
    if (storeId) {
      await setDoc(doc(db, 'storeProfiles', storeId), {
        template: templateId,
        templateColors: found?.defaultPalette ?? colors,
      }, { merge: true });
    }
    toast({ title: 'Template Applied', description: `Now using the ${found?.name} template.` });
  };

  const saveMediaSettings = async (next: { backgroundImage?: string; carouselImages?: string[]; galleryImages?: string[] }) => {
    if (!storeId) return;
    await setDoc(doc(db, 'storeProfiles', storeId), {
      ...(next.backgroundImage !== undefined ? { storeBackgroundImage: next.backgroundImage } : {}),
      ...(next.carouselImages !== undefined ? { carouselImages: next.carouselImages } : {}),
      ...(next.galleryImages !== undefined ? { galleryImages: next.galleryImages } : {}),
    }, { merge: true });
  };

  const uploadSingleImage = async (file: File, folder: 'background' | 'carousel' | 'gallery') => {
    if (storeId) await assertCanUploadBytes(db, storeId, file.size);
    const path = `store-media/${storeId ?? 'unknown'}/${folder}/${Date.now()}_${encodeURIComponent(file.name)}`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, file);
    if (storeId) await trackStorageUsageAfterUpload(db, storeId, file.size);
    return getDownloadURL(imageRef);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !storeId) return;
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
    if (!files.length || !storeId) return;
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
  const applyPreset = (preset: Required<StoreTemplateColors>) => setColors(preset);

  const updateColor = (key: keyof Required<StoreTemplateColors>, value: string) => {
    // accept raw hex input without # too
    const clean = value.startsWith('#') ? value : `#${value}`;
    setColors(prev => ({ ...prev, [key]: clean }));
  };

  const handleHexInput = (key: keyof Required<StoreTemplateColors>, raw: string) => {
    const sanitized = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setColors(prev => ({ ...prev, [key]: `#${sanitized}` }));
  };

  const saveColors = async () => {
    if (!storeId) return;
    setSavingColors(true);
    try {
      await setDoc(doc(db, 'storeProfiles', storeId), { templateColors: colors }, { merge: true });
      toast({ title: 'Colors Saved', description: 'Your custom palette is live.' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setSavingColors(false); }
  };

  // ── layout handlers ──────────────────────────────────────────────────────
  const saveLayout = async () => {
    if (!storeId) return;
    setSavingLayout(true);
    try {
      await setDoc(doc(db, 'storeProfiles', storeId), { productDisplayType, productCardAnimation, heroLayout, menuStyle, aboutLayout }, { merge: true });
      toast({ title: 'Layout Saved', description: 'Store layout preferences updated.' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setSavingLayout(false); }
  };

  // ── sections handlers ────────────────────────────────────────────────────
  const saveSections = async () => {
    if (!storeId) return;
    setSavingSections(true);
    try {
      await setDoc(doc(db, 'storeProfiles', storeId), { contactFormStyle, ratingDisplayType, sectionOrder }, { merge: true });
      toast({ title: 'Sections Saved', description: 'Section styles updated.' });
    } catch { toast({ title: 'Save Failed', variant: 'destructive' }); }
    finally { setSavingSections(false); }
  };

  // ── color slot labels ────────────────────────────────────────────────────
  const COLOR_SLOTS: Array<{ key: keyof Required<StoreTemplateColors>; label: string; hint: string; affects: string }> = [
    { key: 'primary',    label: 'Primary Color',       hint: 'Header bar, buttons, links',             affects: 'Top navigation bar, Add to Cart button, product links' },
    { key: 'secondary',  label: 'Secondary Color',     hint: 'Secondary buttons, accents',            affects: 'Secondary elements and navigation accents' },
    { key: 'accent',     label: 'Accent Color',        hint: 'Call-to-action, highlights, badges',    affects: 'Buy Now button, badges, special highlights' },
    { key: 'background', label: 'Page Background',     hint: 'Main page background color',            affects: 'Entire page background behind all content' },
    { key: 'surface',    label: 'Cards Background',    hint: 'Product cards, info sections',          affects: 'Product cards, store info card, all card backgrounds' },
    { key: 'textColor',  label: 'Main Text Color',     hint: 'Headings, descriptions, body text',     affects: 'Product names, descriptions, all main text' },
    { key: 'highlight',  label: 'Highlight Color',     hint: 'Borders, hover effects, decorative',    affects: 'Card borders, hover effects, dividers' },
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
    { id: 'sections',  label: 'Sections',  icon: <Layers className="h-4 w-4" /> },
  ];

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileHeader title="Store Design" />}

      <div className="p-4 md:p-6">
        <BackButton to="/admin/profile" label="Back to Store Profile" />

        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings2 className="h-6 w-6" /> Store Design
              </h1>
              <p className="text-muted-foreground">Customise your store's look, layout, and sections</p>
            </div>
            <div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    if (!storeId) return;
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const imported = JSON.parse(text);
                      // Mark store as having imported design for white-label header
                      await setDoc(doc(db, 'storeProfiles', storeId), { ...imported, hasImportedDesign: true }, { merge: true });
                      // Update local state
                      if (imported.template) {
                        setSelectedTemplate(imported.template);
                        setPreviewTemplate(imported.template);
                      }
                      if (imported.templateColors) setColors({ ...EMPTY_COLORS(), ...imported.templateColors });
                      if (imported.productDisplayType) setProductDisplayType(imported.productDisplayType);
                      if (imported.productCardAnimation) setProductCardAnimation(imported.productCardAnimation);
                      if (imported.heroLayout) setHeroLayout(imported.heroLayout);
                      if (imported.menuStyle) setMenuStyle(imported.menuStyle);
                      if (imported.contactFormStyle) setContactFormStyle(imported.contactFormStyle);
                      if (imported.ratingDisplayType) setRatingDisplayType(imported.ratingDisplayType);
                      if (imported.aboutLayout) setAboutLayout(imported.aboutLayout);
                      if (Array.isArray(imported.sectionOrder)) setSectionOrder(imported.sectionOrder);
                      toast({ title: 'Design Imported', description: 'All settings applied from preset.' });
                    } catch (err) {
                      toast({ title: 'Import Failed', description: 'Invalid JSON file.', variant: 'destructive' });
                    }
                  }}
                />
                <Button variant="outline" size="sm" className="gap-2" as="span">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Design
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                💡 Upload a JSON design file to instantly apply a preset
              </p>
            </div>
          </div>
        </div>

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
            {/* Live preview */}
            <Card>
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>Hover template cards and click Eye to preview style</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`rounded-lg border p-4 ${previewStyles[previewTemplate].shell}`}>
                  <div className={`rounded-md border p-3 mb-3 ${previewStyles[previewTemplate].header}`}>
                    <div className={`font-semibold ${previewStyles[previewTemplate].title}`}>Store Header</div>
                    <div className="text-sm text-muted-foreground">Brand · Slogan · Nav</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className={`rounded-md border p-3 ${previewStyles[previewTemplate].block}`}>
                      <div className="text-sm font-medium">Product Card</div>
                      <div className="text-xs text-muted-foreground">Image · Name · Price</div>
                    </div>
                    <div className={`rounded-md border p-3 ${previewStyles[previewTemplate].block}`}>
                      <div className="text-sm font-medium">Announcement</div>
                      <div className="text-xs text-muted-foreground">Store update block</div>
                    </div>
                    <div className={`rounded-md border p-3 ${previewStyles[previewTemplate].block}`}>
                      <div className="text-sm font-medium">Review Card</div>
                      <div className="text-xs text-muted-foreground">Rating · Comment</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(tmpl => (
                <Card key={tmpl.id} className={`relative overflow-hidden ${selectedTemplate === tmpl.id ? 'ring-2 ring-primary' : ''}`}>
                  {selectedTemplate === tmpl.id && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="bg-primary text-primary-foreground"><Check className="h-3 w-3 mr-1" />Active</Badge>
                    </div>
                  )}
                  {tmpl.isPremium && (
                    <div className="absolute top-2 left-2 z-10"><Badge variant="secondary">Premium</Badge></div>
                  )}
                  <div className={`aspect-video relative overflow-hidden p-3 ${previewStyles[tmpl.id].shell}`}>
                    <div className={`rounded-md border p-2 mb-2 ${previewStyles[tmpl.id].header}`}>
                      <div className={`text-xs font-semibold ${previewStyles[tmpl.id].title}`}>{tmpl.name} Header</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-md border p-2 ${previewStyles[tmpl.id].block}`}><div className="text-[10px] font-medium">Products</div></div>
                      <div className={`rounded-md border p-2 ${previewStyles[tmpl.id].block}`}><div className="text-[10px] font-medium">Reviews</div></div>
                    </div>
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
                </Card>
              ))}
            </div>

            {/* Media upload */}
            <Card>
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
            </Card>
          </div>
        )}

        {/* ══ COLORS TAB ══ */}
        {activeTab === 'colors' && (
          <div className="space-y-8">
            {/* Enhanced Live Preview */}
            <Card>
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

                  {/* Store Info Card */}
                  <div className="m-6 p-6 rounded-xl border-2" style={{ background: colors.surface, borderColor: colors.highlight }}>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-20 h-20 rounded-xl" style={{ background: colors.primary + '40' }} />
                      <div className="flex-1">
                        <div className="h-6 w-48 rounded mb-2" style={{ background: colors.textColor + '30' }} />
                        <div className="h-4 w-64 rounded" style={{ background: colors.textColor + '20' }} />
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      {[1,2,3].map(i => (
                        <div key={i} className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: colors.accent }}>
                          Badge {i}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: colors.textColor }}>
                      Store description banner text appears here. This shows how your main text content will look with your chosen colors.
                    </p>
                  </div>

                  {/* Product Cards Grid */}
                  <div className="px-6 pb-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold" style={{ color: colors.textColor }}>Products</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {[1,2,3].map(i => (
                        <div key={i} className="rounded-xl p-4 border-2 hover:shadow-lg transition-shadow" style={{ background: colors.surface, borderColor: colors.highlight }}>
                          <div className="aspect-square rounded-lg mb-3" style={{ background: colors.primary + '20' }} />
                          <div className="font-semibold mb-2" style={{ color: colors.textColor }}>Product {i}</div>
                          <div className="text-sm mb-3" style={{ color: colors.textColor + 'CC' }}>$99.99</div>
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
            </Card>

            {/* Preset Palettes */}
            <Card>
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
            </Card>

            {/* Free-pick color pickers */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Colors</CardTitle>
                <CardDescription>Fine-tune each color to match your brand — changes preview instantly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {COLOR_SLOTS.map(slot => (
                    <div key={slot.key} className="flex items-start gap-4 p-4 border-2 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary/40 transition-colors">
                      <label className="cursor-pointer flex-shrink-0 relative group" title="Click to pick color">
                        <input
                          type="color"
                          value={colors[slot.key]}
                          onChange={e => updateColor(slot.key, e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <div className="w-16 h-16 rounded-xl border-4 border-white shadow-lg ring-2 ring-border group-hover:ring-primary transition-all" style={{ background: colors[slot.key] }} />
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
                            value={colors[slot.key].replace('#', '')}
                            onChange={e => handleHexInput(slot.key, e.target.value)}
                            className="w-28 text-sm font-mono font-bold border-2 rounded-lg px-3 py-2 bg-background uppercase focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="RRGGBB"
                          />
                          <span className="text-xs text-muted-foreground">{colors[slot.key]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-6">
                  <Button variant="outline" onClick={() => {
                    const found = templates.find(t => t.id === selectedTemplate);
                    if (found) setColors(found.defaultPalette);
                  }}>
                    Reset to Template Defaults
                  </Button>
                  <Button onClick={saveColors} disabled={savingColors} className="gap-2">
                    <Save className="h-4 w-4" />{savingColors ? 'Saving…' : 'Save Colors'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══ LAYOUT TAB ══ */}
        {activeTab === 'layout' && (
          <div className="space-y-8">
            {/* Product display */}
            <Card>
              <CardHeader>
                <CardTitle>Product Display</CardTitle>
                <CardDescription>How products appear on your store — all include smooth entry animations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {PRODUCT_DISPLAY_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={productDisplayType} onSelect={setProductDisplayType} />
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
            </Card>

            {/* Product hover animation */}
            <Card>
              <CardHeader>
                <CardTitle>Product Hover Animation</CardTitle>
                <CardDescription>Choose how product cards animate when users hover over them — adds visual interest and interactivity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {PRODUCT_ANIMATION_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={productCardAnimation} onSelect={setProductCardAnimation} />
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Hover animations are subtle on mobile but create an engaging experience on desktop. Try "Parallax" or "3D Lift" for modern stores.
                </div>
              </CardContent>
            </Card>

            {/* Hero layout */}
            <Card>
              <CardHeader>
                <CardTitle>Hero / Banner Style</CardTitle>
                <CardDescription>How the top section of your home page looks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {HERO_LAYOUT_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={heroLayout} onSelect={setHeroLayout} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Menu style */}
            <Card>
              <CardHeader>
                <CardTitle>Navigation Menu Style</CardTitle>
                <CardDescription>How the top navigation bar appears to customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {MENU_STYLE_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={menuStyle} onSelect={setMenuStyle} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* About layout */}
            <Card>
              <CardHeader>
                <CardTitle>About Us Layout</CardTitle>
                <CardDescription>Control how your About / Mission / Vision section appears (when filled in Store Profile)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ABOUT_LAYOUT_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={aboutLayout} onSelect={setAboutLayout} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveLayout} disabled={savingLayout} className="gap-2">
                <Save className="h-4 w-4" />{savingLayout ? 'Saving…' : 'Save Layout'}
              </Button>
            </div>
          </div>
        )}

        {/* ══ SECTIONS TAB ══ */}
        {activeTab === 'sections' && (
          <div className="space-y-8">
            {/* Section ordering */}
            <Card>
              <CardHeader>
                <CardTitle>Section Order & Visibility</CardTitle>
                <CardDescription>Control which sections appear and their display order on your storefront</CardDescription>
              </CardHeader>
              <CardContent>
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
                        <div key={section.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          {/* Drag handle visual */}
                          <div className="text-muted-foreground cursor-move select-none">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                            </svg>
                          </div>
                          
                          {/* Position number */}
                          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                            {section.order + 1}
                          </span>
                          
                          {/* Section label */}
                          <span className="flex-1 font-medium text-sm">{label}</span>
                          
                          {/* Up/Down buttons */}
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const currentIdx = sectionOrder.findIndex(s => s.id === section.id);
                                if (currentIdx <= 0) return;
                                const newOrder = [...sectionOrder];
                                [newOrder[currentIdx], newOrder[currentIdx - 1]] = [newOrder[currentIdx - 1], newOrder[currentIdx]];
                                newOrder.forEach((s, idx) => s.order = idx);
                                setSectionOrder(newOrder);
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
                                setSectionOrder(newOrder);
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
                          
                          {/* Width controls */}
                          <div className="flex gap-1 border rounded-md overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setSectionOrder(prev =>
                                  prev.map(s => s.id === section.id ? { ...s, width: 'full' } : s)
                                );
                              }}
                              className={`px-2 py-1 text-xs font-medium transition-colors ${
                                (section.width || 'full') === 'full'
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-background hover:bg-muted'
                              }`}
                              title="Full width"
                            >
                              Full
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSectionOrder(prev =>
                                  prev.map(s => s.id === section.id ? { ...s, width: 'half' } : s)
                                );
                              }}
                              className={`px-2 py-1 text-xs font-medium transition-colors ${
                                section.width === 'half'
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-background hover:bg-muted'
                              }`}
                              title="Half width (side-by-side)"
                            >
                              Half
                            </button>
                          </div>
                          
                          {/* Toggle visibility */}
                          <button
                            type="button"
                            onClick={() => {
                              setSectionOrder(prev =>
                                prev.map(s => s.id === section.id ? { ...s, enabled: !s.enabled } : s)
                              );
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                              section.enabled
                                ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30'
                                : 'bg-gray-300/60 text-gray-600 hover:bg-gray-300/80'
                            }`}
                          >
                            {section.enabled ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                      );
                    })}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  💡 Use ↑↓ buttons to reorder sections. Toggle <strong>Full/Half</strong> width to place 2 sections side-by-side. Click Visible/Hidden to show or hide sections.
                </p>
              </CardContent>
            </Card>

            {/* Contact form */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Form Style</CardTitle>
                <CardDescription>Choose which fields and layout appear on your Contact Us page</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {CONTACT_FORM_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={contactFormStyle} onSelect={setContactFormStyle} />
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
            </Card>

            {/* Rating display */}
            <Card>
              <CardHeader>
                <CardTitle>Rating Display Style</CardTitle>
                <CardDescription>How customer ratings appear on your store — only visible to customers viewing your store</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {RATING_OPTIONS.map(opt => (
                    <OptionTile key={opt.id} option={opt} selected={ratingDisplayType} onSelect={setRatingDisplayType} />
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
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveSections} disabled={savingSections} className="gap-2">
                <Save className="h-4 w-4" />{savingSections ? 'Saving…' : 'Save Sections'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTemplates;
