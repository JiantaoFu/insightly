import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Local Supabase config
const supabaseUrl = process.env.SUPABASE_LOCAL_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.SUPABASE_LOCAL_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
