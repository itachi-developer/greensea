import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bllilwqhadmvuptgokbf.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sariMRwMvC_O_DXhFdvKfA_JYYiHFQq';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
