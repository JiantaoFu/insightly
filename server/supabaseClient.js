import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const getSupabaseConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  const configs = {
    development: {
      url: process.env.SUPABASE_LOCAL_URL,
      key: process.env.SUPABASE_LOCAL_ANON_KEY
    },
    production: {
      url: process.env.SUPABASE_PROD_URL,
      key: process.env.SUPABASE_PROD_ANON_KEY
    }
  }

  return configs[env] || configs.development
}

export const supabase = createClient(
  getSupabaseConfig().url, 
  getSupabaseConfig().key
)