import { Platform } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export type DocumentImageKind = 'logo' | 'signature';

async function ensureGalleryPermission(): Promise<void> {
  if (Platform.OS === 'android') return;
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Gallery access is required to choose images.');
  }
}

export async function pickDocumentImageFromGallery(
  kind: DocumentImageKind,
): Promise<string | null> {
  await ensureGalleryPermission();
  const aspect: [number, number] = kind === 'logo' ? [4, 3] : [3, 1];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'] as any,
    allowsEditing: true,
    aspect,
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function uploadFinanceDocumentImage(
  localUri: string,
  kind: DocumentImageKind,
): Promise<string> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('You must be signed in to upload images.');

  const lower = localUri.toLowerCase();
  const ext = lower.includes('.png') ? 'png' : 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const filename = `finance-${kind}-${Date.now()}.${ext}`;
  const ref = storage().ref(`stores/${uid}/${filename}`);

  await ref.putFile(localUri, { contentType });
  return ref.getDownloadURL();
}

export async function pickAndUploadDocumentImage(kind: DocumentImageKind): Promise<string | null> {
  const localUri = await pickDocumentImageFromGallery(kind);
  if (!localUri) return null;
  return uploadFinanceDocumentImage(localUri, kind);
}

function parseDataUrl(dataUrl: string): { base64: string; contentType: string; ext: string } {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
  if (match) {
    const ext = match[1].toLowerCase() === 'jpeg' || match[1].toLowerCase() === 'jpg' ? 'jpg' : 'png';
    return {
      base64: match[2],
      contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png',
      ext,
    };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return { base64: trimmed.replace(/\s/g, ''), contentType: 'image/png', ext: 'png' };
  }
  throw new Error('Invalid signature image data.');
}

export async function uploadSignatureDataUrl(dataUrl: string): Promise<string> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('You must be signed in to upload images.');

  const { base64, contentType, ext } = parseDataUrl(dataUrl);
  const filename = `finance-signature-drawn-${Date.now()}.${ext}`;
  const ref = storage().ref(`stores/${uid}/${filename}`);

  await ref.putString(base64, 'base64', { contentType });
  return ref.getDownloadURL();
}
