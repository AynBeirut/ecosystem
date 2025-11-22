export interface StoreProfile {
  name: string;
  description: string;
  location: string;
  website: string;
  slogan: string;
  phone: string;
  email: string;
  facebook: string;
  instagram: string;
  twitter: string;
  logo: string;
  status: 'online' | 'offline'; // Store visibility status
}
