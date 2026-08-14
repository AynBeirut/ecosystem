import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type BuilderPublishConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLive?: boolean;
};

/**
 * Shown when publishing from Theme Editor (or similar) — not when switching editors.
 */
const BuilderPublishConfirmDialog: React.FC<BuilderPublishConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isLive = true,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Publish to your live store?</AlertDialogTitle>
        <AlertDialogDescription>
          {isLive ? (
            <>
              Your store is already live. Publishing will <strong>overwrite your current website</strong>{' '}
              with these layout, theme, and content changes. Preview is safe — only publish when you are
              ready to go live.
            </>
          ) : (
            <>
              Publishing will make these changes visible on your public store. Preview first if you are
              not ready yet.
            </>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep editing</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Publish anyway</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default BuilderPublishConfirmDialog;
