import { supabase } from './supabase'

export interface PlatformLanguage {
  language_code: string
  language_name: string
  native_name: string
}

export async function fetchEnabledLanguages(): Promise<PlatformLanguage[]> {
  const { data, error } = await supabase
    .from('platform_languages')
    .select('language_code, language_name, native_name')
    .eq('enabled', true)
    .order('sort_order')
  if (error) throw error
  return data as PlatformLanguage[]
}
