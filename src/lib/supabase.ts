// Supabase is currently not installed. Uncomment when needed.
// import { createClient } from '@supabase/supabase-js';

// Placeholder - will be configured when Supabase is installed
export const supabase: any = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for the entire app
// Uncomment when Supabase is installed
/*
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',  // Use PKCE flow for more secure authentication
    storage: localStorage
  }
});
*/

// Helper function to check if user is authenticated
export async function isAuthenticated() {
  return false; // Placeholder - will check Supabase when installed
  /*
  const { data } = await supabase.auth.getSession();
  return !!data.session;
  */
}
