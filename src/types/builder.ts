export type BuilderBusinessType = 'designer' | 'media_company';

export type DemoStoreStatus = 'draft' | 'preview' | 'invited' | 'converted' | 'deleted';

export type BuilderDemoBuildMethod = 'classic' | 'theme_editor' | 'wordpress';

export type BuilderAccount = {
  businessType: BuilderBusinessType;
  demoSlotCount: number;
  grantedExtras?: string[];
  createdAt: string;
  updatedAt: string;
};

export type BuilderDemoStore = {
  id: string;
  name: string;
  status: DemoStoreStatus;
  previewTokenHash?: string;
  previewExpiresAt?: string;
  transferredStoreId?: string;
  convertedAt?: string;
  wordpressRequestId?: string;
  buildMethod?: BuilderDemoBuildMethod;
  createdAt: string;
  updatedAt: string;
};

export type BuilderDemoBranding = {
  name: string;
  slug: string;
  template?: string;
  description?: string;
  slogan?: string;
  logo?: string;
  templateColors?: Record<string, string>;
  sectionOrder?: unknown[];
  menuStyle?: string;
  storeCardStyle?: string;
  storeBackgroundImage?: string;
  galleryImages?: string[];
};

export type BuilderDemoProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
};

export type BuilderTransferResult = {
  storeId: string;
  productCount: number;
};
