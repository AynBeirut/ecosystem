import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
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
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import {
  BUILD_METHOD_LABELS,
  type BuildMethod,
  isGrabioEditorMethod,
} from '@/lib/buildMethod';

type BuilderMethodGuardProps = {
  /** Editor the user is trying to open */
  targetMethod: 'classic' | 'theme_editor';
  children: React.ReactNode;
};

/**
 * Warns when opening the non-primary Grabio editor after choosing a build method in Store Builder.
 */
const BuilderMethodGuard: React.FC<BuilderMethodGuardProps> = ({ targetMethod, children }) => {
  const navigate = useNavigate();
  const { profile, storeId } = useStoreEntitlements();
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const savedMethod = profile?.builderWizard?.buildMethod;
  const needsPrompt =
    Boolean(storeId) &&
    isGrabioEditorMethod(savedMethod) &&
    savedMethod !== targetMethod;

  useEffect(() => {
    if (!needsPrompt) {
      setAllowed(true);
      setOpen(false);
      return;
    }
    setAllowed(false);
    setOpen(true);
  }, [needsPrompt, savedMethod, targetMethod]);

  const handleCancel = () => {
    setOpen(false);
    const fallback =
      savedMethod === 'classic' ? '/admin/templates' : '/admin/theme-editor';
    if (isGrabioEditorMethod(savedMethod)) {
      navigate(fallback, { replace: true });
    } else {
      navigate('/admin/dashboard', { replace: true });
    }
  };

  const handleContinue = async () => {
    if (!storeId) {
      setAllowed(true);
      setOpen(false);
      return;
    }
    const timestamp = new Date().toISOString();
    await setDoc(
      doc(getFirestore(), 'storeProfiles', storeId),
      {
        builderWizard: {
          ...profile?.builderWizard,
          buildMethod: targetMethod as BuildMethod,
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      },
      { merge: true },
    );
    setAllowed(true);
    setOpen(false);
  };

  const fromLabel = isGrabioEditorMethod(savedMethod)
    ? BUILD_METHOD_LABELS[savedMethod]
    : 'your previous method';
  const toLabel = BUILD_METHOD_LABELS[targetMethod];

  return (
    <>
      <AlertDialog open={open} onOpenChange={(v) => !v && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch build method?</AlertDialogTitle>
            <AlertDialogDescription>
              You started with <strong>{fromLabel}</strong>. Opening <strong>{toLabel}</strong> can
              overwrite layout, colors, and section settings from your current setup. Both editors
              update the same live store — the last save wins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleContinue()}>
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {allowed || !needsPrompt ? children : null}
    </>
  );
};

export default BuilderMethodGuard;
