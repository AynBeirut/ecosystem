import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { CareerApplication, FreelancerTrack } from '@/types/career';

const db = getFirestore();

function nowIso(): string {
  return new Date().toISOString();
}

export type SubmitCareerApplicationInput = {
  track: FreelancerTrack;
  name: string;
  email: string;
  phone?: string;
  portfolioUrl?: string;
  message?: string;
  applicantUid?: string;
};

export async function submitCareerApplication(
  input: SubmitCareerApplicationInput,
): Promise<string> {
  const timestamp = nowIso();
  const payload = {
    track: input.track,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || '',
    portfolioUrl: input.portfolioUrl?.trim() || '',
    message: input.message?.trim() || '',
    status: 'pending' as const,
    applicantUid: input.applicantUid || '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const ref = await addDoc(collection(db, 'careerApplications'), payload);
  return ref.id;
}

export async function getCareerApplication(id: string): Promise<CareerApplication | null> {
  const snap = await getDoc(doc(db, 'careerApplications', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<CareerApplication, 'id'>) };
}

export async function listApplicationsByEmail(email: string): Promise<CareerApplication[]> {
  const normalized = email.trim().toLowerCase();
  const snap = await getDocs(
    query(collection(db, 'careerApplications'), where('email', '==', normalized)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CareerApplication, 'id'>) }));
}

export async function markApplicationApproved(id: string, applicantUid: string): Promise<void> {
  await setDoc(
    doc(db, 'careerApplications', id),
    { status: 'approved', applicantUid, updatedAt: nowIso() },
    { merge: true },
  );
}
