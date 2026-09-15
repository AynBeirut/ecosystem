import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { getDemoBranding } from '@/lib/builderService';
import type { StoreProfile } from '@/types/storeProfile';

export function buildDemoEditorPreviewSrc(demoId: string, previewVersion = 0): string {
  return `/builder/demo/${encodeURIComponent(demoId)}/preview?editorPreview=1&v=${previewVersion}`;
}

export async function loadDemoThemeProfile(
  builderUid: string,
  demoId: string,
): Promise<Partial<StoreProfile> | null> {
  const branding = await getDemoBranding(builderUid, demoId);
  if (!branding) return null;
  const demoSnap = await getDoc(doc(getFirestore(), 'builders', builderUid, 'demoStores', demoId));
  const demoMeta = demoSnap.exists() ? demoSnap.data() : {};
  return {
    ...(branding as Partial<StoreProfile>),
    name: branding.name,
    storeName: branding.name,
    slug: branding.slug,
    template: branding.template || 'modern',
    status: demoMeta.status === 'preview' ? 'online' : 'draft',
  };
}

export async function saveDemoThemeProfile(
  builderUid: string,
  demoId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await setDoc(
    doc(getFirestore(), 'builders', builderUid, 'demoStores', demoId, 'profile', 'branding'),
    { ...patch, updatedAt: timestamp },
    { merge: true },
  );
  await setDoc(
    doc(getFirestore(), 'builders', builderUid, 'demoStores', demoId),
    { updatedAt: timestamp },
    { merge: true },
  );
}

export async function uploadDemoMedia(
  builderUid: string,
  demoId: string,
  folder: string,
  file: File,
): Promise<string> {
  const path = `builder-demos/${builderUid}/${demoId}/${folder}/${Date.now()}_${encodeURIComponent(file.name)}`;
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}
