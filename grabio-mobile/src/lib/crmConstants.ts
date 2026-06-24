export const CRM_PIPELINE_STAGES = [
  'new_lead',
  'contacted',
  'interested',
  'proposal_sent',
  'negotiation',
  'closed',
  'lost',
] as const;

export const CRM_ACTIVITY_TYPES = ['visit', 'call', 'whatsapp', 'meeting', 'order'] as const;
export const CRM_ACTIVITY_RESULTS = [
  'interested',
  'not_interested',
  'follow_up',
  'closed',
  'no_answer',
] as const;

export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];
export type CrmActivityResult = (typeof CRM_ACTIVITY_RESULTS)[number];

export const ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  visit: 'Visit',
  call: 'Call',
  whatsapp: 'WhatsApp',
  meeting: 'Meeting',
  order: 'Sales order',
};

export const ACTIVITY_RESULT_LABELS: Record<CrmActivityResult, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  follow_up: 'Follow-up needed',
  closed: 'Closed',
  no_answer: 'No answer',
};

export function pipelineFromResult(result: CrmActivityResult): string | null {
  if (result === 'closed') return 'closed';
  if (result === 'not_interested') return 'lost';
  if (result === 'interested') return 'interested';
  return null;
}
