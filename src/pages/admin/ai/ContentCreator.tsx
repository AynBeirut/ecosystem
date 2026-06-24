import AiToolPage, { AiToolConfig } from '@/components/AiToolPage';

const config: AiToolConfig = {
  moduleId: 'content_creator',
  tool: 'content_creator',
  icon: '✍️',
  title: 'Content Creator',
  description: 'Generate product copy, social media posts, and blog drafts.',
  outputLabel: 'Generated Content',
  fields: [
    { id: 'product', label: 'Product or service name', type: 'text', placeholder: 'e.g. Handmade Olive Oil Soap', required: true },
    { id: 'description', label: 'Brief description', type: 'textarea', placeholder: 'What makes it special?', required: true, rows: 3 },
    { id: 'platform', label: 'Platform / format', type: 'select', required: true, options: ['Instagram caption', 'Facebook post', 'Product page description', 'Email newsletter', 'Blog intro', 'WhatsApp message'] },
    { id: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Casual & friendly', 'Urgent / promotional', 'Storytelling', 'Minimalist'] },
    { id: 'language', label: 'Language', type: 'select', options: ['English', 'Arabic', 'French', 'English + Arabic'] },
  ],
  buildPrompt: (v) =>
    `You are a professional copywriter. Write ${v.platform} content for the following product.

Product: ${v.product}
Description: ${v.description}
Tone: ${v.tone || 'Professional'}
Language: ${v.language || 'English'}

Write engaging, conversion-focused content suitable for ${v.platform}. Include relevant emojis if appropriate for the platform. Keep it concise and punchy.`,
};

export default function ContentCreatorPage() {
  return <AiToolPage config={config} />;
}
