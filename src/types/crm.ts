/** Sales CRM add-on — types and enums */

export const SALES_CRM_ADDON_KEY = 'salesCrm' as const;

export const CRM_PIPELINE_STAGES = [
  'new_lead',
  'contacted',
  'interested',
  'proposal_sent',
  'negotiation',
  'closed',
  'lost',
] as const;

export type CrmPipelineStage = (typeof CRM_PIPELINE_STAGES)[number];

export const CRM_ACTIVITY_TYPES = ['visit', 'call', 'whatsapp', 'meeting', 'order'] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export const CRM_ACTIVITY_RESULTS = [
  'interested',
  'not_interested',
  'follow_up',
  'closed',
  'no_answer',
] as const;
export type CrmActivityResult = (typeof CRM_ACTIVITY_RESULTS)[number];

export type CrmActivitySource = 'mobile' | 'web' | 'order';

export interface CrmGeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Fields added to `customers` when managed in Sales CRM */
export interface CrmCustomerFields {
  pipelineStage?: CrmPipelineStage;
  assignedRepId?: string | null;
  nextFollowUpAt?: string | null;
  dealValue?: number | null;
  dealCurrency?: string;
  lastActivityAt?: string | null;
  lastActivityResult?: CrmActivityResult | null;
  crmEnabled?: boolean;
}

export interface CrmRep {
  id: string;
  storeId: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'suspended' | 'inactive';
  firebaseUid?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastLogin?: string;
}

export interface CrmActivity {
  id: string;
  storeId: string;
  customerId: string;
  repId: string;
  repName: string;
  type: CrmActivityType;
  loggedAt: string;
  location?: CrmGeoLocation | null;
  result: CrmActivityResult;
  notes?: string;
  followUpAt?: string | null;
  pipelineStageAfter?: CrmPipelineStage | null;
  orderId?: string;
  orderTotal?: number;
  invoiceNumber?: string | null;
  repKind?: string;
  createdBy: string;
  source: CrmActivitySource;
  createdAt: string;
}

export interface CrmStoreSettings {
  noContactAlertDays?: number;
}
