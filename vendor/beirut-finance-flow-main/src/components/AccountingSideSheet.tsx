import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** detail = voucher/activity (3xl), form = edit entry (4xl), default = 2xl */
  size?: 'default' | 'detail' | 'form';
  tall?: boolean;
};

export default function AccountingSideSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
  size = 'default',
  tall = false,
}: Props) {
  const sizeClass =
    size === 'form' ? 'sm:max-w-4xl' : size === 'detail' ? 'sm:max-w-3xl' : 'sm:max-w-2xl';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col gap-0 p-0 [&>button.absolute]:hidden',
          sizeClass,
          tall && 'h-full max-h-[100dvh]',
          className,
        )}
        onInteractOutside={() => onOpenChange(false)}
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <div className="flex items-start justify-between border-b px-6 py-4 pr-12">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-base leading-snug">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-4', bodyClassName)}>{children}</div>

        {footer ? <div className="shrink-0 border-t px-6 py-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
