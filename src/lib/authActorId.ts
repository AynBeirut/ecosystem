import type { User } from '@/types/product';
import { auth } from '@/lib/firebase';

/** Firebase UID for audit fields — never rely on context user.id alone (seller merge can drop it). */
export function resolveAuthActorId(user: Pick<User, 'id'> | null | undefined): string {
  const fromProfile = typeof user?.id === 'string' ? user.id.trim() : '';
  if (fromProfile) return fromProfile;
  const fromAuth = auth.currentUser?.uid?.trim() || '';
  return fromAuth;
}
