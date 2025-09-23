// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a more robust mock client for development
const createMockClient = () => {
  console.warn('Using mock Supabase client - authentication will not work');
  
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ 
        data: { user: null, session: null }, 
        error: new Error('Supabase not configured') 
      }),
      signUp: () => Promise.resolve({ 
        data: { user: null, session: null }, 
        error: new Error('Supabase not configured') 
      }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: (callback) => {
        // Simulate immediate null session
        setTimeout(() => callback('INITIAL_SESSION', null), 100);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getUser: () => Promise.resolve({ data: { user: null }, error: null })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
        })
      })
    })
  };
};

// Create real or mock client based on environment variables
let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  supabase = createMockClient();
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    console.log('Supabase client initialized successfully');
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    supabase = createMockClient();
  }
}

export { supabase };