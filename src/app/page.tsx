import { createClient } from '@/lib/supabase/server'
import MainClient from './_components/MainClient'
import { type Class } from './_components/types'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('order_num', { ascending: true })

  return <MainClient initialClasses={(classes ?? []) as Class[]} />
}
