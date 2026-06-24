import { canUseModule } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';
import {
  CRM_PIPELINE_STAGES,
  type CrmPipelineStage,
  type CrmActivityType,
  type CrmActivityResult,
} from '@/types/crm';

export const CRM_PIPELINE_LABELS: Record<CrmPipelineStage, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  closed: 'Closed',
  lost: 'Lost',
};

export const CRM_ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  visit: 'Visit',
  call: 'Call',
  whatsapp: 'WhatsApp',
  meeting: 'Meeting',
  order: 'Sales order',
};

export const CRM_ACTIVITY_RESULT_LABELS: Record<CrmActivityResult, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  follow_up: 'Follow-up needed',
  closed: 'Closed',
  no_answer: 'No answer',
};

export const DEFAULT_CRM_SETTINGS = {
  noContactAlertDays: 7,
};

/** Whether the store is entitled to Sales CRM (`enabledModules.crm` or legacy equivalent). */
export function storeHasSalesCrmAddon(profile: StoreProfile | null | undefined): boolean {
  return canUseModule(profile, 'crm');
}

export function isValidPipelineStage(stage: string): stage is CrmPipelineStage {
  return (CRM_PIPELINE_STAGES as readonly string[]).includes(stage);
}

export function pipelineStageFromActivityResult(result: CrmActivityResult): CrmPipelineStage | null {
  if (result === 'closed') return 'closed';
  if (result === 'not_interested') return 'lost';
  if (result === 'interested') return 'interested';
  return null;
}

/** Conversion: clients in pipeline stage `closed` vs all CRM-enabled clients */
export function crmConversionRate(closedCount: number, totalCrmClients: number): number {
  if (totalCrmClients <= 0) return 0;
  return Math.round((closedCount / totalCrmClients) * 1000) / 10;
}
