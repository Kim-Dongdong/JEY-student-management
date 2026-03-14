export type Class = {
  id: string
  name: string
  schedule: string
  order_num: number
  created_at: string
}

export type Session = {
  id: string
  class_id: string
  date: string
  time_range: string | null
  created_at: string
  student_records: Array<{ attendance: string }>
}
