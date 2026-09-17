import type { User } from '@/types/product';
import { auth } from '@/lib/firebase';

type AuthActor = Pick<User, 'id' | 'uid'> | null | undefined;

/** Firebase UID for audit fields (`id` and `uid` on profile, else Auth session). */
export function resolveAuthActorId(user: AuthActor): string {
  const fromUid = typeof user?.uid === 'string' ? user.uid.trim() : '';
  if (fromUid) return fromUid;
  const fromId = typeof user?.id === 'string' ? user.id.trim() : '';
  if (fromId) return fromId;
  return auth.currentUser?.uid?.trim() || '';
}

export function withFirebaseUid<T extends User>(user: T): T & { id: string; uid: string } {
  const firebaseUid = auth.currentUser?.uid?.trim() || '';
  const resolved = user.id?.trim() || user.uid?.trim() || firebaseUid;
  return { ...user, id: resolved, uid: resolved };
}
