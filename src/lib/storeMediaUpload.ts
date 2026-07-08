import { getFirestore } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { assertCanUploadBytes, trackStorageUsageAfterUpload } from '@/lib/subscriptionEnforcement';
import type { StoreSectionId } from '@/types/storeProfile';

function mediaRoot(storeId: string) {
  return `store-media/${storeId}`;
}

export async function uploadSectionBackgroundImage(
  storeId: string,
  sectionId: StoreSectionId,
  file: File,
): Promise<string> {
  const db = getFirestore();
  await assertCanUploadBytes(db, storeId, file.size);
  const path = `${mediaRoot(storeId)}/section-backgrounds/${sectionId}/${Date.now()}_${encodeURIComponent(file.name)}`;
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file);
  await trackStorageUsageAfterUpload(db, storeId, file.size);
  return getDownloadURL(imageRef);
}

export async function uploadStoreBannerImage(storeId: string, file: File): Promise<string> {
  const db = getFirestore();
  await assertCanUploadBytes(db, storeId, file.size);
  const path = `${mediaRoot(storeId)}/background/${Date.now()}_${encodeURIComponent(file.name)}`;
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file);
  await trackStorageUsageAfterUpload(db, storeId, file.size);
  return getDownloadURL(imageRef);
}

export async function uploadGalleryImage(storeId: string, file: File): Promise<string> {
  const db = getFirestore();
  await assertCanUploadBytes(db, storeId, file.size);
  const path = `${mediaRoot(storeId)}/gallery/${Date.now()}_${encodeURIComponent(file.name)}`;
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file);
  await trackStorageUsageAfterUpload(db, storeId, file.size);
  return getDownloadURL(imageRef);
}

export async function uploadStoreLogo(storeId: string, file: File): Promise<string> {
  const db = getFirestore();
  await assertCanUploadBytes(db, storeId, file.size);
  const path = `${mediaRoot(storeId)}/logo/${Date.now()}_${encodeURIComponent(file.name)}`;
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file);
  await trackStorageUsageAfterUpload(db, storeId, file.size);
  return getDownloadURL(imageRef);
}
