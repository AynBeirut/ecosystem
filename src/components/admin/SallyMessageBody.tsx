import React from 'react';
import { Link } from 'react-router-dom';

/** Hide internal fallback / API errors — never show to store owners. */
export function sanitizeSallyContent(raw: string): string {
  return raw
    .replace(/\n\n_?\(AI temporarily unavailable[\s\S]*$/i, '')
    .replace(/\n\n_?\(.*missing API key[\s\S]*$/i, '')
    .trim();
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${partIdx++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const inner = token.slice(1, -1);
      const path = inner.replace(/\*+$/, '').trim();
      if (path.startsWith('/admin') || path.startsWith('/subscription')) {
        nodes.push(
          <Link
            key={`${keyPrefix}-l-${partIdx++}`}
            to={path}
            className="text-teal-700 dark:text-teal-300 underline underline-offset-2 font-medium"
          >
            {inner}
          </Link>,
        );
      } else {
        nodes.push(
          <span key={`${keyPrefix}-c-${partIdx++}`} className="font-mono text-[0.92em] opacity-90">
            {inner}
          </span>,
        );
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

const SallyMessageBody: React.FC<{ content: string }> = ({ content }) => {
  const clean = sanitizeSallyContent(content);
  const lines = clean.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`sp-${idx}`} className="h-1" />;
        const isNumbered = /^\d+\.\s/.test(trimmed);
        return (
          <p key={`ln-${idx}`} className={isNumbered ? 'pl-0.5' : undefined}>
            {renderInline(trimmed, `ln-${idx}`)}
          </p>
        );
      })}
    </div>
  );
};

export default SallyMessageBody;
