import AiToolPage, { AiToolConfig } from '@/components/AiToolPage';

const config: AiToolConfig = {
  moduleId: 'campaign_writer',
  tool: 'campaign_writer',
  icon: '📣',
  title: 'Campaign & Promo Writer',
  description: 'Generate promotional campaigns, announcements, and offer copy.',
  outputLabel: 'Campaign Copy',
  fields: [
    { id: 'campaign_type', label: 'Campaign type', type: 'select', required: true, options: ['Flash sale', 'Seasonal promotion', 'New product launch', 'Loyalty reward', 'Referral program', 'Back-in-stock alert', 'Event / celebration', 'Clearance sale'] },
    { id: 'offer', label: 'The offer / discount', type: 'text', placeholder: 'e.g. 25% off all bakery items, Buy 2 get 1 free', required: true },
    { id: 'product', label: 'Product or category', type: 'text', placeholder: 'e.g. all handmade soaps, summer collection', required: true },
    { id: 'audience', label: 'Target audience', type: 'text', placeholder: 'e.g. existing customers, new visitors, women 25-40' },
    { id: 'deadline', label: 'Offer deadline / urgency', type: 'text', placeholder: 'e.g. Ends Sunday midnight, 48 hours only' },
    { id: 'channel', label: 'Channels to write for', type: 'select', required: true, options: ['WhatsApp broadcast', 'Instagram + Facebook', 'Email campaign', 'SMS message', 'All channels (separate versions)'] },
    { id: 'language', label: 'Language', type: 'select', options: ['English', 'Arabic', 'French', 'English + Arabic'] },
  ],
  buildPrompt: (v) =>
    `You are an expert marketing copywriter. Write a high-converting promotional campaign.

Campaign Type: ${v.campaign_type}
Offer: ${v.offer}
Product/Category: ${v.product}
Target Audience: ${v.audience || 'General customers'}
Deadline / Urgency: ${v.deadline || 'Limited time'}
Channel(s): ${v.channel}
Language: ${v.language || 'English'}

Write compelling, action-driving copy for each requested channel. Include:
- A strong headline/hook
- The core offer clearly stated
- Urgency/scarcity element
- Clear call to action
${v.channel === 'All channels (separate versions)' ? 'Write separate versions optimized for: WhatsApp, Instagram caption, and Email subject + body.' : ''}
Use emojis where appropriate for the channel.`,
};

export default function CampaignWriterPage() {
  return <AiToolPage config={config} />;
}
