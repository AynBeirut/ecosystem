export type WordPressProvisioningStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

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
};

export type WordPressProvisioningInput = {
  businessName: string;
  contactEmail: string;
  preferredDomain?: string;
  notes?: string;
};
