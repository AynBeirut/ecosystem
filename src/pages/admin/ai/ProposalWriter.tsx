import AiToolPage, { AiToolConfig } from '@/components/AiToolPage';

const config: AiToolConfig = {
  moduleId: 'proposal_writer',
  tool: 'proposal_writer',
  icon: '📝',
  title: 'Proposal Writer',
  description: 'Generate professional client proposals and scope of work documents.',
  outputLabel: 'Generated Proposal',
  fields: [
    { id: 'client', label: 'Client name / company', type: 'text', placeholder: 'e.g. Horizon Café', required: true },
    { id: 'project', label: 'Project type', type: 'select', required: true, options: ['Website design', 'Software development', 'Marketing campaign', 'Consulting / advisory', 'E-commerce setup', 'Branding', 'Social media management', 'Other'] },
    { id: 'scope', label: 'Project scope / what will be delivered', type: 'textarea', placeholder: 'Describe what you will build or deliver', required: true, rows: 4 },
    { id: 'timeline', label: 'Estimated timeline', type: 'text', placeholder: 'e.g. 6 weeks, 3 months' },
    { id: 'budget', label: 'Proposed budget', type: 'text', placeholder: 'e.g. $2,500 or $500/mo' },
    { id: 'extras', label: 'Any special terms or notes', type: 'textarea', placeholder: 'Payment terms, revisions policy, etc.', rows: 2 },
  ],
  buildPrompt: (v) =>
    `You are a professional business consultant. Write a formal client proposal document.

Client: ${v.client}
Project Type: ${v.project}
Scope / Deliverables: ${v.scope}
Timeline: ${v.timeline || 'To be discussed'}
Budget: ${v.budget || 'To be discussed'}
Special Notes: ${v.extras || 'None'}

Write a professional proposal with these sections:
- Executive Summary
- Scope of Work
- Timeline
- Investment (pricing)
- Terms & Next Steps

Use a confident, professional tone. Keep it concise but complete.`,
};

export default function ProposalWriterPage() {
  return <AiToolPage config={config} />;
}
