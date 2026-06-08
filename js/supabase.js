import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://csajcdvwmmumhpuzpmuk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYWpjZHZ3bW11bWhwdXpwbXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjA3NjIsImV4cCI6MjA5NjMzNjc2Mn0.A1e_7yMdgm9Yfs4LoZvMH6MAGo_dtxTkRisePjOPl5k'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)