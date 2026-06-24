import AiToolPage, { AiToolConfig } from '@/components/AiToolPage';

const config: AiToolConfig = {
  moduleId: 'market_strategy',
  tool: 'market_strategy',
  icon: '📈',
  title: 'Market Strategy',
  description: 'AI-powered growth and positioning insights for your business.',
  outputLabel: 'Strategy Recommendations',
  fields: [
    { id: 'business', label: 'Business name & type', type: 'text', placeholder: 'e.g. Al Nour Grocery Store', required: true },
    { id: 'market', label: 'Target market / location', type: 'text', placeholder: 'e.g. Beirut, Lebanon — households', required: true },
    { id: 'challenge', label: 'Current main challenge', type: 'textarea', placeholder: 'e.g. Low repeat customers, struggling against big supermarkets', required: true, rows: 3 },
    { id: 'goal', label: 'Goal for next 3 months', type: 'text', placeholder: 'e.g. Increase monthly revenue by 30%' },
    { id: 'budget', label: 'Marketing budget range', type: 'select', options: ['Under $100/mo', '$100–500/mo', '$500–2000/mo', '$2000+/mo', 'No budget yet'] },
  ],
  buildPrompt: (v) =>
    `You are a seasoned business strategist with experience in emerging markets. Analyze this business and provide actionable growth strategy.

Business: ${v.business}
Target Market: ${v.market}
Current Challenge: ${v.challenge}
90-day Goal: ${v.goal || 'General growth'}
Marketing Budget: ${v.budget || 'Not specified'}

Provide:
1. Quick wins (actionable in the next 2 weeks)
2. Positioning strategy vs competitors
3. Top 3 marketing channels to focus on
4. One key metric to track
Keep it practical and specific to this business context.`,
};

export default function MarketStrategyPage() {
  return <AiToolPage config={config} />;
}
