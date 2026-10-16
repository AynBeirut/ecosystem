export const TRAVEL_PIPELINE_STAGES = [
  'inquiry',
  'quoted',
  'deposit_received',
  'booked',
  'traveled',
  'closed',
  'lost',
] as const;

export type TravelPipelineStage = (typeof TRAVEL_PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<TravelPipelineStage, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  deposit_received: 'Deposit received',
  booked: 'Booked',
  traveled: 'Traveled',
  closed: 'Closed',
  lost: 'Lost',
};

export const ACTIVITY_TYPES = ['call', 'whatsapp', 'meeting', 'email', 'note'] as const;
export type TravelActivityType = (typeof ACTIVITY_TYPES)[number];
