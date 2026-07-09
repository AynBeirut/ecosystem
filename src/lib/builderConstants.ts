import type { BuilderBusinessType } from '@/types/builder';

export const BUILDER_MAX_DEMO_SLOTS = 2;

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
