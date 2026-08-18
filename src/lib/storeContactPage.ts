/** Nav + page title for the store contact / reservation tab. */
export function getStoreContactPageLabel(contactFormStyle?: number): string {
  return contactFormStyle === 11 ? 'Reserve' : 'Contact Us';
}
