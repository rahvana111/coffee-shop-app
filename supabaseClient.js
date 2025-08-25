import { createClient } from '@supabase/supabase-js';

// Initialise a Supabase client for the browser. We rely on the public
// anonymous key here which is safe to expose. The URL and key are
// provided at runtime via environment variables. When deployed the
// variables must be set in Vercel.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;