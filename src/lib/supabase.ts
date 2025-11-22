
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for the entire app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',  // Use PKCE flow for more secure authentication
    storage: localStorage
  }
});

// Helper function to check if user is authenticated
export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
