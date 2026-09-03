// YNC Association — Supabase client + shared app config
// The anon/publishable key below is safe to expose in client-side code by design;
// all access control is enforced server-side via Postgres Row Level Security (RLS).

const YNC_CONFIG = {
  supabaseUrl: "https://dhdgghzwabfdpgbcueyk.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZGdnaHp3YWJmZHBnYmN1ZXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjA3OTUsImV4cCI6MjEwMzk5Njc5NX0.lWwCIJUrH6FS6obhtQpinUKuOCv-KpUHE8DKATO82qc",
  currentYear: 2026,
};

const supabaseClient = supabase.createClient(YNC_CONFIG.supabaseUrl, YNC_CONFIG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
