/** Future client Excel / workflow intake — classification only (Slice D). */
export type VenueFeatureIntakeCategory =
  | 'daily_operation'
  | 'crm'
  | 'tenant_option'
  | 'report'
  | 'automation'
  | 'role_security'
  | 'setup_import'
  | 'optional_inventory'
  | 'optional_accounting_finance'
  | 'temporary_exception';

export type VenueSetupTrackId =
  | 'store_identity'
  | 'daily_operations'
  | 'reservations'
  | 'crm_guests'
  | 'roles_access'
  | 'optional_inventory'
  | 'optional_finance'
  | 'storefront_grow'
  | 'client_data_import';

export type VenueSetupTrackStatus = 'not_started' | 'in_progress' | 'ready' | 'blocked' | 'deferred';

export type VenueSetupTrack = {
  id: VenueSetupTrackId;
  label: string;
  status: VenueSetupTrackStatus;
  intakeCategory: VenueFeatureIntakeCategory;
  hint: string;
  /** Admin path to continue setup (ops / store admin). */
  continuePath?: string;
  continueLabel?: string;
};

/** Queued items from future Excel/workflow drafts — do not invent rows in code. */
export type VenueSetupIntakeItem = {
  id: string;
  category: VenueFeatureIntakeCategory;
  title: string;
  source?: 'excel_draft' | 'client_pain' | 'ops_manual';
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  createdAt: string;
  notes?: string;
};

export type VenueSetupIntakeMeta = {
  lastReviewedAt?: string;
  pendingItems?: VenueSetupIntakeItem[];
};
