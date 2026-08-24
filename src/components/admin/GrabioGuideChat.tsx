import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/useAuth';
import { waitForAuthToken } from '@/lib/waitForAuthToken';
import { getActualStoreId } from '@/lib/storeUtils';
import { useStoreEntitlements, peekCachedStoreProfile } from '@/hooks/useStoreEntitlements';
import { queryGrabioGuide, type GrabioGuideMessage } from '@/lib/grabioGuideApi';
import { storeLabelFromProfile } from '@/lib/sallyHumanHandoff';
import SallyAvatar from '@/components/admin/SallyAvatar';
import SallyMessageBody, { sanitizeSallyContent } from '@/components/admin/SallyMessageBody';
import { cn } from '@/lib/utils';

const STARTER_PROMPTS = [
  'What Grabio package fits my business?',
  'What should I set up first?',
  'Classic template or AI Builder?',
];

type GuideChatMessage = GrabioGuideMessage & {
  redirectTo?: string;
  toolLabel?: string;
  humanHandoffUrl?: string;
};

function SallyWhatsAppButton({ url }: { url: string }) {
  return (
    <Button
      asChild
      size="sm"
      className="mt-2 bg-[#25D366] hover:bg-[#20bd5a] text-white border-0"
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4 mr-1.5" />
        Continue on WhatsApp
      </a>
    </Button>
  );
}

type Props = {
  className?: string;
  compact?: boolean;
};

const GrabioGuideChat: React.FC<Props> = ({ className, compact = false }) => {
  const location = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { profile } = useStoreEntitlements();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<GuideChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi, I'm Sally. Ask me about setup, packages, modules, or where to go in admin.\n\nFor SEO copy or campaigns, use AI Tools under /admin/ai/* (uses credits).",
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || loading) return;

      if (authLoading) {
        toast({ title: 'Sally', description: 'Still loading your session…', variant: 'destructive' });
        return;
      }

      const firebaseUser = await waitForAuthToken();
      if (!firebaseUser || !user?.id) {
        toast({ title: 'Sign in required', description: 'Refresh the page and try again.', variant: 'destructive' });
        return;
      }

      const token = await firebaseUser.getIdToken();
      const storeId = getActualStoreId(user) || firebaseUser.uid;
      const cachedProfile = profile ?? peekCachedStoreProfile(storeId);
      const storeName =
        storeLabelFromProfile(cachedProfile) ||
        storeLabelFromProfile(user as Record<string, unknown> | null) ||
        user.email?.split('@')[0] ||
        null;
      const history = messagesRef.current
        .slice(1)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8);

      setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
      setDraft('');
      setLoading(true);

      try {
        const data = await queryGrabioGuide({
          token,
          storeId,
          prompt,
          page: location.pathname,
          storeName,
          history,
        });

        if (!data.content) {
          throw new Error(data.message || 'Grabio Guide could not respond');
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: sanitizeSallyContent(data.content!),
            redirectTo: data.redirectTo,
            toolLabel: data.toolLabel,
            humanHandoffUrl: data.humanHandoff?.whatsappUrl,
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast({ title: 'Sally', description: message, variant: 'destructive' });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "Sorry — I couldn't reach Sally right now. Try again in a moment.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [authLoading, loading, location.pathname, profile, toast, user],
  );

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto space-y-3',
          compact ? 'max-h-[50vh] p-3' : 'max-h-[min(60vh,520px)] p-4',
        )}
      >
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' ? (
              <SallyAvatar size="xs" className="mt-1 shrink-0 ring-1 ring-teal-200" />
            ) : null}
            <div className={cn('min-w-0 max-w-[85%]', msg.role === 'user' ? 'ml-4' : 'mr-2')}>
              <div
                className={cn(
                  'rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white'
                    : 'bg-muted text-foreground border border-border/60',
                )}
              >
                {msg.role === 'assistant' ? (
                  <SallyMessageBody content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            {msg.redirectTo && msg.toolLabel ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-2 border-teal-500/40 text-teal-700 dark:text-teal-300"
              >
                <Link to={msg.redirectTo}>Open {msg.toolLabel} (uses credits)</Link>
              </Button>
            ) : null}
            {msg.humanHandoffUrl ? <SallyWhatsAppButton url={msg.humanHandoffUrl} /> : null}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <SallyAvatar size="xs" className="ring-1 ring-teal-200" />
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            One moment…
          </div>
        ) : null}
      </div>

      {messages.length <= 1 ? (
        <div className={cn('flex flex-wrap gap-2 border-t border-border/50', compact ? 'p-3 pt-2' : 'p-4 pt-2')}>
          {STARTER_PROMPTS.map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition"
              onClick={() => void sendMessage(label)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className={cn('border-t border-border/50 flex gap-2 items-end', compact ? 'p-3' : 'p-4')}
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(draft);
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about setup, modules, pricing…"
          rows={compact ? 2 : 3}
          className="min-h-0 resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(draft);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          className="shrink-0 bg-teal-600 hover:bg-teal-700"
          disabled={loading || !draft.trim()}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default GrabioGuideChat;
