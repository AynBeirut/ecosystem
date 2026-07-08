import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, authReady } from '@/lib/firebase';

/** Ensure Firebase Auth persistence + ID token are ready before Firestore reads/writes. */
export async function waitForAuthToken(forceRefresh = false): Promise<User | null> {
  await authReady;
  if (auth.currentUser) {
    await auth.currentUser.getIdToken(forceRefresh);
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        resolve(null);
        return;
      }
      await user.getIdToken(forceRefresh);
      resolve(user);
    });
  });
}
