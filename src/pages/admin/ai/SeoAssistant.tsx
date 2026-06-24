import AiToolPage, { AiToolConfig } from '@/components/AiToolPage';

const config: AiToolConfig = {
  moduleId: 'seo_assistant',
  tool: 'seo_assistant',
  icon: '🔍',
  title: 'SEO Assistant',
  description: 'Generate meta titles, meta descriptions, FAQ schema, and keyword suggestions.',
  outputLabel: 'SEO Output',
  fields: [
    { id: 'page', label: 'Page / product title', type: 'text', placeholder: 'e.g. Lebanese Za\'atar Blend — 500g', required: true },
    { id: 'content', label: 'Page content summary', type: 'textarea', placeholder: 'What is this page about? What does it sell or explain?', required: true, rows: 3 },
    { id: 'keywords', label: 'Target keywords (comma-separated)', type: 'text', placeholder: 'e.g. buy zaatar online, Lebanese spices, Lebanese grocery' },
    { id: 'type', label: 'Output type', type: 'select', required: true, options: ['Meta title + Meta description', 'FAQ schema (5 questions)', 'Full SEO pack (meta + keywords + FAQ)', 'Blog title ideas (5 options)'] },
    { id: 'location', label: 'Target location (optional)', type: 'text', placeholder: 'e.g. Lebanon, UAE, worldwide' },
  ],
  buildPrompt: (v) =>
    `You are an expert SEO specialist. Generate SEO content for the following page.

Page/Product: ${v.page}
Content Summary: ${v.content}
Target Keywords: ${v.keywords || 'Not specified'}
Target Location: ${v.location || 'Global'}
Output Requested: ${v.type}

${v.type.includes('Meta') ? 'Write a compelling meta title (under 60 chars) and meta description (under 160 chars) that includes the main keyword naturally.' : ''}
${v.type.includes('FAQ') ? 'Write 5 FAQ questions and answers in JSON-LD schema format, targeting common search queries.' : ''}
${v.type.includes('Full') ? 'Provide: meta title, meta description, 10 relevant long-tail keywords, and 5 FAQ items in plain text.' : ''}
${v.type.includes('Blog') ? 'Write 5 SEO-optimized blog post title ideas targeting the keywords above.' : ''}`,
};

export default function SeoAssistantPage() {
  return <AiToolPage config={config} />;
}
