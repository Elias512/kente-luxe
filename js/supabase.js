import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://csajcdvwmmumhpuzpmuk.supabase.co/rest/v1/'
const SUPABASE_ANON_KEY = 'sb_publishable_EfsEsZVbM7Cn0VVsKl5BCQ_jvkcgjCV'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)