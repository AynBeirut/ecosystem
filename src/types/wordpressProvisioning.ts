export type WordPressProvisioningStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_dns'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WordPressProvisioningRequest = {
  id: string;
  storeId: string;
  ownerUid: string;
  requestKind?: WordPressProvisioningRequestKind;
  businessName: string;
  contactEmail: string;
  preferredDomain?: string;
  stagingDomain?: string;
  notes?: string;
  status: WordPressProvisioningStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  opsNotes?: string;
  wpAdminUrl?: string;
  wpUsername?: string;
  hostingDomain?: string;
  /** @deprecated legacy FTP/Webuzo fields — no longer shown to clients */
  webuzoUsername?: string;
  ftpUsername?: string;
  ftpHost?: string;
  panelUrl?: string;
  provisionError?: string;
  accessEmailSentAt?: string;
  accessEmailRedeemedAt?: string | null;
  provisionedAt?: string;
  dnsTarget?: string;
  dnsVerifiedAt?: string;
  dnsLastCheckedAt?: string;
  dnsLastCheckMessage?: string;
};

export type WordPressProvisioningInput = {
  businessName: string;
  contactEmail: string;
  preferredDomain?: string;
  notes?: string;
  requestKind?: 'production' | 'builder_demo';
  /** Set server-side for builder_demo — client must not pass a custom go-live domain. */
  stagingDomain?: string;
};

export type WordPressProvisioningRequestKind = 'production' | 'builder_demo';
