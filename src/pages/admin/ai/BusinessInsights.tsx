import AiToolPage, { AiToolConfig } from '@/components/AiToolPage';

const config: AiToolConfig = {
  moduleId: 'analytics_insights',
  tool: 'analytics_insights',
  icon: '💡',
  title: 'Business Insights',
  description: 'Plain-language analysis and action recommendations based on your business metrics.',
  outputLabel: 'AI Insights & Recommendations',
  fields: [
    { id: 'business', label: 'Business type', type: 'text', placeholder: 'e.g. Retail clothing store, Restaurant, Freelance agency', required: true },
    { id: 'revenue', label: 'Monthly revenue (approximate)', type: 'text', placeholder: 'e.g. $3,000/mo or 5,000,000 LBP', required: true },
    { id: 'orders', label: 'Number of orders/transactions per month', type: 'text', placeholder: 'e.g. 85 orders' },
    { id: 'top_products', label: 'Top 3 selling products or services', type: 'textarea', placeholder: 'List your best sellers and rough sales numbers', rows: 2 },
    { id: 'problem', label: 'Biggest current issue', type: 'select', required: true, options: ['Revenue is flat / not growing', 'High cart abandonment', 'Customers not returning', 'Too many returns / refunds', 'Low profit margins', 'Operational bottlenecks', 'Inventory problems', 'Other'] },
    { id: 'extra', label: 'Additional context (optional)', type: 'textarea', placeholder: 'Any other numbers, seasonality, recent changes…', rows: 2 },
  ],
  buildPrompt: (v) =>
    `You are a business analyst. Based on the following business data, provide clear, actionable insights.

Business Type: ${v.business}
Monthly Revenue: ${v.revenue}
Monthly Orders: ${v.orders || 'Not specified'}
Top Products: ${v.top_products || 'Not specified'}
Main Problem: ${v.problem}
Additional Context: ${v.extra || 'None'}

Provide:
1. Diagnosis — what does the data likely indicate?
2. Root cause analysis of the main problem
3. Three specific actions to take this month
4. One KPI to track for the next 30 days
5. Warning signs to watch out for

Be direct, specific, and practical. Avoid generic advice.`,
};

export default function BusinessInsightsPage() {
  return <AiToolPage config={config} />;
}
