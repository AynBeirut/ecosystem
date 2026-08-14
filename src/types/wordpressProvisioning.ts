export type WordPressProvisioningStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type WordPressProvisioningRequest = {
  id: string;
  storeId: string;
  ownerUid: string;
  businessName: string;
  contactEmail: string;
  preferredDomain?: string;
  notes?: string;
  status: WordPressProvisioningStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  opsNotes?: string;
  webuzoUsername?: string;
  hostingDomain?: string;
  ftpUsername?: string;
  ftpHost?: string;
  panelUrl?: string;
  provisionError?: string;
  accessEmailSentAt?: string;
  provisionedAt?: string;
};

export type WordPressProvisioningInput = {
  businessName: string;
  contactEmail: string;
  preferredDomain?: string;
  notes?: string;
};
