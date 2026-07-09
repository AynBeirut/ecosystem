import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

/**
 * Shown in Sales CRM admin — first loads after deploy may wait on Firestore index builds.
 */
export default function CrmFirestoreIndexNotice() {
  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-950">
      <Info className="h-4 w-4" />
      <AlertTitle>First load after deploy</AlertTitle>
      <AlertDescription>
        Pipeline, activities, and maps query new Firestore indexes. Right after you deploy rules and
        indexes, lists can stay empty or show errors for a few minutes while Firebase finishes
        building them. Refresh the page — this is normal, not a broken CRM.
      </AlertDescription>
    </Alert>
  );
}
