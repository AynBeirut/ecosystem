import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Generates a URL-friendly slug from text
 * Example: "Tech Gadgets Store" -> "tech-gadgets-store"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Check if a slug is available in Firestore and provide suggestions if not
 */
export async function checkSlugAvailability(
  slug: string,
  collectionName: 'storeProfiles' | 'products',
  excludeId?: string
): Promise<{ available: boolean; suggestions: string[] }> {
  const db = getFirestore();
  const slugQuery = query(
    collection(db, collectionName),
    where('slug', '==', slug)
  );
  
  const snapshot = await getDocs(slugQuery);
  
  // If no match found, slug is available
  if (snapshot.empty) {
    return { available: true, suggestions: [] };
  }
  
  // If match found but it's the same document we're editing, it's available
  if (excludeId && snapshot.docs.length === 1 && snapshot.docs[0].id === excludeId) {
    return { available: true, suggestions: [] };
  }
  
  // Slug is taken, generate suggestions
  const suggestions: string[] = [];
  for (let i = 2; i <= 5; i++) {
    const suggestion = `${slug}-${i}`;
    const suggestionQuery = query(
      collection(db, collectionName),
      where('slug', '==', suggestion)
    );
    const suggestionSnapshot = await getDocs(suggestionQuery);
    if (suggestionSnapshot.empty) {
      suggestions.push(suggestion);
    }
  }
  
  return { available: false, suggestions };
}

/**
 * Generate a unique slug by checking availability
 */
export async function generateUniqueSlug(
  text: string,
  collectionName: 'storeProfiles' | 'products',
  excludeId?: string
): Promise<string> {
  const slug = generateSlug(text);
  const { available, suggestions } = await checkSlugAvailability(slug, collectionName, excludeId);
  
  if (available) {
    return slug;
  }
  
  // Return first available suggestion
  if (suggestions.length > 0) {
    return suggestions[0];
  }
  
  // Fallback: append timestamp
  return `${slug}-${Date.now()}`;
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  // Only lowercase letters, numbers, and hyphens
  // Must start and end with alphanumeric
  // Minimum 2 characters
  const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 100;
}
