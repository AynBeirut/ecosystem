export type BuilderBusinessType = 'designer' | 'media_company';

export type DemoStoreStatus = 'draft' | 'preview' | 'invited' | 'converted' | 'deleted';

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
