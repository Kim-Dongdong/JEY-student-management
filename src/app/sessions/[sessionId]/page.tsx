import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SessionView from './SessionView'

export default async function SessionPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const supabase = await createClient()
  const { sessionId } = params

  const { data: session } = await supabase
    .from('sessions')
    .select('*, classes(*)')
    .eq('id', sessionId)
    .single()

  if (!session) notFound()

  const [
    { data: students },
    { data: testColumns },
    { data: studentRecords },
    { data: allSessions },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .eq('class_id', session.class_id)
      .order('order_num', { ascending: true }),
    supabase
      .from('test_columns')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_num', { ascending: true }),
    supabase
      .from('student_records')
      .select('*')
      .eq('session_id', sessionId),
    supabase
      .from('sessions')
      .select('id, date, time_range, next_homework')
      .eq('class_id', session.class_id)
      .order('date', { ascending: false }),
  ])

  const recordIds = (studentRecords ?? []).map((r) => r.id)
  const { data: testResults } =
    recordIds.length > 0
      ? await supabase
          .from('test_results')
          .select('*')
          .in('student_record_id', recordIds)
      : { data: [] }

  return (
    <SessionView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session={session as any}
      students={students ?? []}
      initialColumns={testColumns ?? []}
      initialRecords={studentRecords ?? []}
      initialResults={testResults ?? []}
      allSessions={(allSessions ?? []) as { id: string; date: string; time_range: string | null; next_homework: string | null }[]}
    />
  )
}
