import type { BuilderBusinessType, BuilderDemoBuildMethod } from '@/types/builder';

export const BUILDER_MAX_DEMO_SLOTS = 3;

export const BUILDER_DEMO_BUILD_METHODS: Array<{
  id: BuilderDemoBuildMethod;
  label: string;
  description: string;
}> = [
  {
    id: 'classic',
    label: 'Classic templates',
    description: 'Preset storefront templates, colors, and layout.',
  },
  {
    id: 'theme_editor',
    label: 'Theme editor',
    description: 'Visual section builder with live preview.',
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    description: 'Staging WordPress site on demo.grabio.online.',
  },
];

export type BuilderDemoWorkspaceTab = 'classic' | 'theme-editor' | 'wordpress' | 'products';

export function buildMethodToWorkspaceTab(
  method?: BuilderDemoBuildMethod,
): Exclude<BuilderDemoWorkspaceTab, 'products'> {
  if (method === 'theme_editor') return 'theme-editor';
  if (method === 'wordpress') return 'wordpress';
  return 'classic';
}

export const BUILDER_BUSINESS_TYPES: Array<{
  id: BuilderBusinessType;
  label: string;
  description: string;
}> = [
  {
    id: 'designer',
    label: 'Designer',
    description: 'Build branded demo stores for design clients — catalog, look & feel, content.',
  },
  {
    id: 'media_company',
    label: 'Media Company',
    description: 'Agency demos for campaigns, multi-brand previews, and client handoff.',
  },
];
