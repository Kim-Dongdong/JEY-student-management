'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ColumnModal from './ColumnModal'
import BottomNav, { addNavSession } from '@/app/_components/BottomNav'

/* ─────────────────── Types ─────────────────── */

type Session = {
  id: string
  class_id: string
  date: string
  time_range: string | null
  next_homework: string | null
  classes: { id: string; name: string; schedule: string }
}

type SessionSummary = {
  id: string
  date: string
  time_range: string | null
  next_homework: string | null
}
type Student = {
  id: string
  name: string
  note: string | null
  order_num: number
  kakao_chat_url: string | null
}
type TestColumn = {
  id: string
  session_id: string
  name: string
  type: string
  order_num: number
}
type StudentRecord = {
  id: string
  session_id: string
  student_id: string
  attendance: 'present' | 'absent' | 'late'
  homework_status: 'done' | 'undone'
  next_homework: string | null
  note: string | null
}
type TestResult = {
  id: string
  student_record_id: string
  test_column_id: string
  result: string | null
}

interface Props {
  session: Session
  students: Student[]
  initialColumns: TestColumn[]
  initialRecords: StudentRecord[]
  initialResults: TestResult[]
  allSessions: SessionSummary[]
}

/* ─────────────────── Badge logic ─────────────────── */

type ResultType = 'pass' | 'fail' | 'score' | 'text' | 'empty'

function classifyResult(v: string | null | undefined): ResultType {
  if (!v?.trim()) return 'empty'
  const s = v.trim()
  if (s === 'P') return 'pass'
  if (s === 'X') return 'fail'
  if (s.startsWith('P(') || /^\d+\/\d+/.test(s)) return 'score'
  return 'text'
}

const BADGE_CLS: Record<Exclude<ResultType, 'empty'>, string> = {
  pass:  'bg-[#EDFDF4] text-[#0BB070] border border-[#B3EFCF]',
  fail:  'bg-[#FFF0F1] text-[#F04452] border border-[#FBBCC0]',
  score: 'bg-[#EBF3FF] text-[#3182F6] border border-[#B3CEFD]',
  text:  'bg-[#F2F4F6] text-[#6B7684] border border-[#E5E8EB]',
}

/* ─────────────────── Helpers ─────────────────── */

function formatDate(dateStr: string, timeRange?: string | null) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  const dow = weekdays[date.getDay()]
  const base = `${mm}/${dd} [${dow}]`
  return timeRange ? `${base} ${timeRange}` : base
}

const KO_WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const DAY_MAP: Record<string, string> = {
  '월': '월요일', '화': '화요일', '수': '수요일', '목': '목요일',
  '금': '금요일', '토': '토요일', '일': '일요일',
}

function formatResultForMessage(result: string | null): string | null {
  if (!result?.trim()) return null
  const s = result.trim()
  if (s === 'P') return '완료'
  const scoreMatch = s.match(/^P\((\d+\/\d+)\)$/) ?? s.match(/^(\d+\/\d+)$/)
  if (scoreMatch) return `완료(${scoreMatch[1]})`
  if (s === 'X') return '미완료'
  // 요일 단독 입력 → "미완료, {요일} 응시 예정입니다."
  if (DAY_MAP[s]) return `미완료, ${DAY_MAP[s]} 응시 예정입니다.`
  // "진행중, 금" → "진행중이며, 금요일 완료 예정입니다."
  const m = s.match(/^진행중,\s*(.+)$/)
  if (m) {
    const day = m[1].trim()
    return `진행중이며, ${DAY_MAP[day] ?? day} 완료 예정입니다.`
  }
  return s
}

function isSpecialDayComplete(s: string): boolean {
  return /^[월화수목금토일] 완료$/.test(s.trim())
}

function generateMessage(
  studentName: string,
  columns: TestColumn[],
  recordId: string,
  resultMap: Record<string, TestResult>,
  homeworkText: string,
  homeworkStatus: 'done' | 'undone',
): string {
  const today = new Date()
  const m = today.getMonth() + 1
  const d = today.getDate()
  const dow = KO_WEEKDAYS[today.getDay()]

  const hasSpecialDay = columns.some(col => {
    const r = resultMap[`${recordId}:${col.id}`]?.result ?? null
    return r && isSpecialDayComplete(r)
  })

  let lineNum = 1
  const testLines = columns
    .map(col => {
      const result = resultMap[`${recordId}:${col.id}`]?.result ?? null
      if (hasSpecialDay) {
        if (!result || !isSpecialDayComplete(result)) return null
        return `${lineNum++}. ${col.name}\n: 완료`
      }
      const formatted = formatResultForMessage(result)
      if (!formatted) return null
      return `${lineNum++}. ${col.name}\n: ${formatted}`
    })
    .filter(Boolean)
    .join('\n\n')

  const homeworkLine = homeworkText
    ? `${lineNum}. 숙제:${homeworkText}\n: ${homeworkStatus === 'done' ? '완료' : '미완료'}`
    : ''

  const bodyLines = [testLines, homeworkLine].filter(Boolean).join('\n\n')

  return [
    '안녕하세요😃',
    'JEY 영어 능동관 조교 선생님입니다!',
    '',
    `금일 "${studentName}" 학생`,
    '테스트 마쳤습니다.',
    '',
    `${m}월 ${d}일 ${dow}`,
    '',
    bodyLines,
    '',
    '알차게 하루 보낸 자녀에게',
    '많은 격려 부탁드립니다!',
  ].join('\n')
}

const ATTENDANCE_CYCLE = { present: 'absent', absent: 'late', late: 'present' } as const
const ATTENDANCE_STYLE = {
  present: { label: 'O',   cls: 'text-[#0BB070] bg-[#EDFDF4] hover:bg-[#D4FAE9]' },
  absent:  { label: 'X',   cls: 'text-[#F04452] bg-[#FFF0F1] hover:bg-[#FFD9DC]' },
  late:    { label: '지각', cls: 'text-[#F59E0B] bg-[#FFFBEB] hover:bg-[#FEF3C7]' },
}

/* ─────────────────── Cell Components ─────────────────── */

function AttendanceCell({ attendance, onChange }: {
  attendance: 'present' | 'absent' | 'late'
  onChange: (v: 'present' | 'absent' | 'late') => void
}) {
  const { label, cls } = ATTENDANCE_STYLE[attendance]
  return (
    <button type="button" onClick={() => onChange(ATTENDANCE_CYCLE[attendance])}
      className={`w-full h-8 rounded-lg text-[13px] font-bold transition-colors ${cls}`}>
      {label}
    </button>
  )
}

function HomeworkCell({ status, onChange }: {
  status: 'done' | 'undone'
  onChange: (v: 'done' | 'undone') => void
}) {
  const done = status === 'done'
  return (
    <button type="button" onClick={() => onChange(done ? 'undone' : 'done')}
      className={`w-full h-8 rounded-lg text-[14px] font-bold transition-colors ${
        done ? 'text-[#0BB070] bg-[#EDFDF4] hover:bg-[#D4FAE9]'
             : 'text-[#F04452] bg-[#FFF0F1] hover:bg-[#FFD9DC]'
      }`}>
      {done ? '✓' : '✗'}
    </button>
  )
}

function EditableCell({ value, placeholder = '-', onSave }: {
  value: string; placeholder?: string; onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (editing) {
    return (
      <input autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className="w-full h-8 px-2 text-[13px] text-[#191F28] bg-white border border-[#3182F6] rounded-lg outline-none"
      />
    )
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true) }}
      className="w-full h-8 px-2 flex items-center text-[13px] cursor-pointer rounded-lg hover:bg-[#F2F4F6] transition-colors truncate">
      {value || <span className="text-[#C5CCD6]">{placeholder}</span>}
    </div>
  )
}

/* ─────────────────── Result Cell (portal popover) ─────────────────── */

function ResultCellEditor({ anchor, value, onSave, onClose }: {
  anchor: { top: number; left: number }
  value: string | null
  onSave: (v: string) => void
  onClose: () => void
}) {
  const [customMode, setCustomMode] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCloseRef.current()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [])

  const POPUP_W = 196
  const safeLeft = Math.min(anchor.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - POPUP_W - 8)

  function pick(v: string) { onSave(v); onClose() }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div ref={ref}
      style={{ position: 'fixed', top: anchor.top + 6, left: safeLeft, width: POPUP_W, zIndex: 9999 }}
      className="bg-white rounded-2xl shadow-2xl border border-[#E5E8EB] overflow-hidden">
      <div className="p-2.5 flex flex-col gap-2">
        {/* 빠른 선택 */}
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => pick('P')}
            className="h-10 rounded-xl bg-[#EDFDF4] text-[#0BB070] text-[16px] font-extrabold border border-[#B3EFCF] hover:bg-[#D4FAE9] transition-colors">P</button>
          <button type="button" onClick={() => pick('X')}
            className="h-10 rounded-xl bg-[#FFF0F1] text-[#F04452] text-[16px] font-extrabold border border-[#FBBCC0] hover:bg-[#FFD9DC] transition-colors">X</button>
        </div>
        {/* 구분선 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-[#F2F4F6]" />
          {!customMode && (
            <button type="button" onClick={() => setCustomMode(true)}
              className="text-[11px] text-[#ADB5BD] hover:text-[#3182F6] font-medium transition-colors px-1">
              직접 입력
            </button>
          )}
          <div className="flex-1 h-px bg-[#F2F4F6]" />
        </div>
        {/* 직접 입력 */}
        {customMode && (
          <div className="flex gap-1">
            <input autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="P(74/80), 수요일…"
              onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) pick(draft.trim()); if (e.key === 'Escape') onClose() }}
              className="flex-1 h-9 px-3 text-[13px] border border-[#E5E8EB] rounded-xl bg-[#F9FAFB] outline-none focus:border-[#3182F6] focus:bg-white transition-all"
            />
            {draft.trim() && (
              <button type="button" onClick={() => pick(draft.trim())}
                className="h-9 px-3 rounded-xl bg-[#3182F6] text-white text-[13px] font-bold hover:bg-[#1B6EF3] transition-colors">↵</button>
            )}
          </div>
        )}
        {/* 지우기 */}
        {value && (
          <button type="button" onClick={() => pick('')}
            className="text-[12px] text-[#ADB5BD] hover:text-[#F04452] py-0.5 transition-colors">
            지우기
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

function ResultCell({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, left: 0 })
  const cellRef = useRef<HTMLDivElement>(null)
  const type = classifyResult(value)

  function handleOpen() {
    const rect = cellRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.bottom, left: rect.left })
    setOpen(true)
  }

  const handleSave = useCallback((v: string) => onSave(v), [onSave])

  return (
    <div ref={cellRef} className="relative w-full">
      {type === 'empty' ? (
        <div onClick={handleOpen}
          className="w-full h-8 flex items-center justify-center cursor-pointer rounded-lg hover:bg-[#F2F4F6] transition-colors">
          <span className="text-[#E5E8EB] text-[12px] select-none">—</span>
        </div>
      ) : (
        <div onClick={handleOpen} className="w-full h-8 flex items-center justify-center cursor-pointer">
          <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${BADGE_CLS[type]}`}>
            {value}
          </span>
        </div>
      )}
      {open && <ResultCellEditor anchor={anchor} value={value} onSave={handleSave} onClose={() => setOpen(false)} />}
    </div>
  )
}

/* ─────────────────── Sortable Column Header ─────────────────── */

function SortableColumnHeader({ column, onEdit, onDelete }: {
  column: TestColumn; onEdit: () => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id })
  return (
    <th ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      className="min-w-[128px] w-[128px] px-2 py-2 bg-[#F9FAFB] border-b border-r border-[#E5E8EB]">
      <div className="flex items-center gap-0.5">
        <button type="button"
          className="shrink-0 w-5 h-5 flex items-center justify-center text-[#C5CCD6] hover:text-[#6B7684] cursor-grab active:cursor-grabbing touch-none rounded transition-colors"
          {...attributes} {...listeners}>⠿</button>
        <span className="flex-1 text-[12px] font-semibold text-[#4E5968] truncate px-0.5">{column.name}</span>
        <button type="button" onClick={onEdit} title="수정"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#ADB5BD] hover:text-[#3182F6] hover:bg-[#EBF3FF] transition-colors text-[11px]">✏</button>
        <button type="button" onClick={onDelete} title="삭제"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#ADB5BD] hover:text-[#F04452] hover:bg-[#FFF0F1] transition-colors text-[11px]">🗑</button>
      </div>
    </th>
  )
}

/* ─────────────────── Sortable Student Row ─────────────────── */

function SortableStudentRow({ student, children }: {
  student: Student; children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: student.id })
  return (
    <tr ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      className="group">
      {/* 드래그 핸들 셀 */}
      <td className="sticky left-0 z-10 bg-white group-hover:bg-[#FAFAFA] border-b border-r border-[#E5E8EB] w-9 min-w-[36px] px-0 py-1.5 transition-colors">
        <div className="flex items-center justify-center">
          <button type="button"
            className="w-7 h-8 flex items-center justify-center text-[#D1D6DB] hover:text-[#6B7684] cursor-grab active:cursor-grabbing touch-none transition-colors"
            {...attributes} {...listeners}>
            ⠿
          </button>
        </div>
      </td>
      {children}
    </tr>
  )
}

/* ─────────────────── Modals ─────────────────── */

function DeleteModal({ title, description, onClose, onConfirm }: {
  title: string; description: React.ReactNode; onClose: () => void; onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  async function handle() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[360px] sm:mx-4 p-6">
        <div className="w-11 h-11 rounded-full bg-[#FFF0F1] flex items-center justify-center mb-4 text-[20px]">🗑</div>
        <h2 className="text-[18px] font-bold text-[#191F28] mb-2">{title}</h2>
        <p className="text-[14px] text-[#6B7684] leading-relaxed mb-6">{description}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-[50px] rounded-xl bg-[#F2F4F6] text-[15px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] transition-colors">취소</button>
          <button type="button" onClick={handle} disabled={loading}
            className="flex-1 h-[50px] rounded-xl bg-[#F04452] text-white text-[15px] font-semibold hover:bg-[#D93A48] transition-colors disabled:opacity-50">
            {loading ? '삭제 중…' : '삭제하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Main Component ─────────────────── */

export default function SessionView({ session, students: initialStudents, initialColumns, initialRecords, initialResults, allSessions }: Props) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  /* ── State ── */
  const [students, setStudents] = useState<Student[]>(initialStudents)
  const [columns, setColumns] = useState<TestColumn[]>(initialColumns)
  const [recordMap, setRecordMap] = useState<Record<string, StudentRecord>>(
    Object.fromEntries(initialRecords.map(r => [r.student_id, r]))
  )
  const [resultMap, setResultMap] = useState<Record<string, TestResult>>(
    Object.fromEntries(initialResults.map(r => [`${r.student_record_id}:${r.test_column_id}`, r]))
  )

  // DnD
  const [activeColumn, setActiveColumn] = useState<TestColumn | null>(null)
  const [activeStudent, setActiveStudent] = useState<Student | null>(null)

  // 공통 이전 숙제 (이전 세션의 next_homework를 초기값으로, 수정 가능)
  const [prevHomework, setPrevHomework] = useState(() => {
    const idx = allSessions.findIndex(s => s.id === session.id)
    return idx >= 0 ? (allSessions[idx + 1]?.next_homework ?? '') : ''
  })

  // 공통 다음 숙제
  const [nextHomework, setNextHomework] = useState(session.next_homework ?? '')

  // 수업 입장 시 하단 네비에 추가
  useEffect(() => { addNavSession(session.id) }, [session.id])

  // 문자 발송 체크 (localStorage 유지)
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`sent_${session.id}`)
      if (stored) setSentSet(new Set(JSON.parse(stored)))
    } catch { /* ignore */ }
  }, [session.id])

  // 모달
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<Student | null>(null)
  const [deleteColumnTarget, setDeleteColumnTarget] = useState<TestColumn | null>(null)
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [editingColumn, setEditingColumn] = useState<TestColumn | null>(null)

  // async 핸들러에서 최신 상태 안정적 접근
  const recordMapRef = useRef(recordMap)
  recordMapRef.current = recordMap
  const resultMapRef = useRef(resultMap)
  resultMapRef.current = resultMap
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  /* ── ensureRecord ── */
  async function ensureRecord(studentId: string): Promise<StudentRecord | null> {
    const existing = recordMapRef.current[studentId]
    if (existing?.id) return existing
    const { data, error } = await supabase
      .from('student_records')
      .upsert(
        { session_id: session.id, student_id: studentId, attendance: 'present', homework_status: 'done' },
        { onConflict: 'session_id,student_id' }
      )
      .select().single()
    if (error || !data) return null
    const record = data as StudentRecord
    recordMapRef.current[studentId] = record
    setRecordMap(prev => ({ ...prev, [studentId]: record }))
    return record
  }

  /* ── 출결 / 숙제 / 텍스트 셀 ── */
  async function handleAttendanceChange(student: Student, value: 'present' | 'absent' | 'late') {
    const record = await ensureRecord(student.id)
    if (!record) return
    setRecordMap(prev => ({ ...prev, [student.id]: { ...record, attendance: value } }))
    await supabase.from('student_records').update({ attendance: value }).eq('id', record.id)
  }

  async function handleHomeworkStatusChange(student: Student, value: 'done' | 'undone') {
    const record = await ensureRecord(student.id)
    if (!record) return
    setRecordMap(prev => ({ ...prev, [student.id]: { ...record, homework_status: value } }))
    await supabase.from('student_records').update({ homework_status: value }).eq('id', record.id)
  }

  async function handleRecordTextChange(student: Student, field: 'next_homework' | 'note', value: string) {
    const record = await ensureRecord(student.id)
    if (!record) return
    setRecordMap(prev => ({ ...prev, [student.id]: { ...record, [field]: value } }))
    await supabase.from('student_records').update({ [field]: value }).eq('id', record.id)
  }

  /* ── 테스트 결과 ── */
  async function handleResultChange(student: Student, column: TestColumn, value: string) {
    const record = await ensureRecord(student.id)
    if (!record?.id) return
    const key = `${record.id}:${column.id}`
    const existing = resultMapRef.current[key]
    if (!value.trim()) {
      if (existing?.id) {
        setResultMap(prev => { const n = { ...prev }; delete n[key]; return n })
        await supabase.from('test_results').delete().eq('id', existing.id)
      }
      return
    }
    setResultMap(prev => ({
      ...prev,
      [key]: existing
        ? { ...existing, result: value }
        : { id: '', student_record_id: record.id, test_column_id: column.id, result: value },
    }))
    if (existing?.id) {
      await supabase.from('test_results').update({ result: value }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('test_results')
        .upsert({ student_record_id: record.id, test_column_id: column.id, result: value }, { onConflict: 'student_record_id,test_column_id' })
        .select().single()
      if (data) {
        const result = data as TestResult
        resultMapRef.current[key] = result
        setResultMap(prev => ({ ...prev, [key]: result }))
      }
    }
  }

  /* ── 학생 삭제 ── */
  async function handleDeleteStudent() {
    if (!deleteStudentTarget) return
    await supabase.from('students').delete().eq('id', deleteStudentTarget.id)
    const record = recordMapRef.current[deleteStudentTarget.id]
    setStudents(prev => prev.filter(s => s.id !== deleteStudentTarget.id))
    if (record?.id) {
      setResultMap(prev => {
        const n = { ...prev }
        Object.keys(n).forEach(k => { if (k.startsWith(`${record.id}:`)) delete n[k] })
        return n
      })
    }
    setRecordMap(prev => { const n = { ...prev }; delete n[deleteStudentTarget.id]; return n })
    setDeleteStudentTarget(null)
  }

  /* ── 컬럼 추가/수정 ── */
  async function handleColumnSave(name: string, type: string, editId?: string) {
    if (editId) {
      const { data } = await supabase.from('test_columns').update({ name, type }).eq('id', editId).select().single()
      if (data) setColumns(prev => prev.map(c => c.id === editId ? data as TestColumn : c))
    } else {
      const maxOrder = columns.reduce((max, c) => Math.max(max, c.order_num), -1)
      const { data: newCol } = await supabase
        .from('test_columns')
        .insert({ session_id: session.id, name, type, order_num: maxOrder + 1 })
        .select().single()
      if (!newCol) { setShowColumnModal(false); return }
      setColumns(prev => [...prev, newCol as TestColumn])

      // 모든 학생 record 확보 후 빈 test_result 생성
      const { data: existingRecords } = await supabase.from('student_records').select('*').eq('session_id', session.id)
      const existingIds = new Set((existingRecords ?? []).map(r => r.student_id))
      const missing = students.filter(s => !existingIds.has(s.id))
      let allRecords = [...(existingRecords ?? [])]

      if (missing.length > 0) {
        const { data: created } = await supabase.from('student_records')
          .insert(missing.map(s => ({ session_id: session.id, student_id: s.id, attendance: 'present', homework_status: 'done' })))
          .select()
        if (created) allRecords = [...allRecords, ...created]
      }

      const newRecordMap = { ...recordMapRef.current }
      allRecords.forEach(r => { newRecordMap[r.student_id] = r as StudentRecord })
      recordMapRef.current = newRecordMap
      setRecordMap(newRecordMap)

      const colId = (newCol as TestColumn).id
      const toInsert = allRecords.filter(r => r.id).map(r => ({ student_record_id: r.id, test_column_id: colId, result: null }))
      if (toInsert.length > 0) {
        const { data: newResults } = await supabase.from('test_results')
          .upsert(toInsert, { onConflict: 'student_record_id,test_column_id' }).select()
        if (newResults) {
          const next = { ...resultMapRef.current }
          newResults.forEach(r => { next[`${r.student_record_id}:${r.test_column_id}`] = r as TestResult })
          resultMapRef.current = next
          setResultMap(next)
        }
      }
    }
    setShowColumnModal(false)
    setEditingColumn(null)
  }

  /* ── 컬럼 삭제 ── */
  async function handleColumnDelete() {
    if (!deleteColumnTarget) return
    await supabase.from('test_columns').delete().eq('id', deleteColumnTarget.id)
    setColumns(prev => prev.filter(c => c.id !== deleteColumnTarget.id))
    setResultMap(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(k => { if (k.endsWith(`:${deleteColumnTarget.id}`)) delete n[k] })
      return n
    })
    setDeleteColumnTarget(null)
  }

  /* ── 컬럼 DnD ── */
  function handleColDragStart(e: DragStartEvent) {
    setActiveColumn(columns.find(c => c.id === e.active.id) ?? null)
  }
  async function handleColDragEnd(e: DragEndEvent) {
    setActiveColumn(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const reordered = arrayMove(columns, columns.findIndex(c => c.id === active.id), columns.findIndex(c => c.id === over.id))
    setColumns(reordered)
    await Promise.all(reordered.map((col, i) => supabase.from('test_columns').update({ order_num: i }).eq('id', col.id)))
  }

  /* ── 행(학생) DnD ── */
  function handleRowDragStart(e: DragStartEvent) {
    setActiveStudent(students.find(s => s.id === e.active.id) ?? null)
  }
  async function handleRowDragEnd(e: DragEndEvent) {
    setActiveStudent(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const reordered = arrayMove(students, students.findIndex(s => s.id === active.id), students.findIndex(s => s.id === over.id))
    setStudents(reordered)
    await Promise.all(reordered.map((s, i) => supabase.from('students').update({ order_num: i + 1 }).eq('id', s.id)))
  }

  /* ── 공통 다음 숙제 저장 ── */
  async function handleNextHomeworkSave(value: string) {
    setNextHomework(value)
    await supabase.from('sessions').update({ next_homework: value }).eq('id', session.id)
  }

  /* ── 문자 복사 + 발송 체크 토글 ── */
  async function handleCopyMessage(student: Student) {
    const record = getRecord(student.id)
    const firstName = student.name.length > 1 ? student.name.slice(1) : student.name
    const msg = generateMessage(firstName, columnsRef.current, record.id, resultMapRef.current, prevHomework, record.homework_status)
    await navigator.clipboard.writeText(msg)
    if (student.kakao_chat_url) {
      window.open(student.kakao_chat_url, '_blank')
    }
    setSentSet(prev => {
      const next = new Set(prev)
      if (next.has(student.id)) next.delete(student.id)
      else next.add(student.id)
      localStorage.setItem(`sent_${session.id}`, JSON.stringify([...next]))
      return next
    })
  }

  /* ── Helpers ── */
  function getRecord(studentId: string): StudentRecord {
    return recordMap[studentId] ?? {
      id: '', session_id: session.id, student_id: studentId,
      attendance: 'present', homework_status: 'done', next_homework: null, note: null,
    }
  }
  function getResult(recordId: string, colId: string): TestResult | undefined {
    if (!recordId) return undefined
    return resultMap[`${recordId}:${colId}`]
  }

  /* ─────────────────── Render ─────────────────── */
  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col pb-14">

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E8EB]">
        <div className="px-5 h-14 flex items-center gap-3">
          <Link href="/"
            className="flex items-center gap-1 text-[14px] text-[#6B7684] hover:text-[#191F28] transition-colors shrink-0">
            ← 목록
          </Link>
          <div className="w-px h-4 bg-[#E5E8EB]" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#ADB5BD] leading-none mb-0.5">{session.classes.name}</p>
            {allSessions.length > 1 ? (
              <select
                value={session.id}
                onChange={e => router.push(`/sessions/${e.target.value}`)}
                className="text-[15px] font-bold text-[#191F28] bg-transparent outline-none cursor-pointer max-w-full truncate"
              >
                {allSessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.date, s.time_range)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[15px] font-bold text-[#191F28] leading-tight truncate">
                {formatDate(session.date, session.time_range)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button"
              onClick={() => { setEditingColumn(null); setShowColumnModal(true) }}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#3182F6] text-white text-[13px] font-semibold hover:bg-[#1B6EF3] transition-colors">
              <span className="text-[15px] font-light leading-none">+</span> 테스트 추가
            </button>
          </div>
        </div>
      </header>

      {/* ── 공통 이전 숙제 ── */}
      <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-5 py-2 flex items-center gap-3">
        <span className="text-[12px] font-semibold text-[#92400E] shrink-0">이전 숙제</span>
        <EditableCell
          value={prevHomework}
          placeholder="이전 수업 숙제가 없습니다"
          onSave={setPrevHomework}
        />
      </div>

      {/* ── 공통 다음 숙제 ── */}
      <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-5 py-2 flex items-center gap-3">
        <span className="text-[12px] font-semibold text-[#92400E] shrink-0">다음 숙제</span>
        <EditableCell
          value={nextHomework}
          placeholder="공통 숙제를 입력하세요"
          onSave={handleNextHomeworkSave}
        />
      </div>

      {/* ── 테이블 (행 DnD 외부 컨텍스트) ── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <DndContext id="row-dnd" sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleRowDragStart} onDragEnd={handleRowDragEnd}>
          <SortableContext items={students.map(s => s.id)} strategy={verticalListSortingStrategy}>

            {/* 열 DnD 내부 컨텍스트 */}
            <DndContext id="col-dnd" sensors={sensors} collisionDetection={closestCenter}
              onDragStart={handleColDragStart} onDragEnd={handleColDragEnd}>
              <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>

                <table className="border-collapse bg-white"
                  style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr>
                      {/* 드래그 핸들 헤더 */}
                      <th className="sticky left-0 z-20 w-9 min-w-[36px] bg-[#F9FAFB] border-b border-r border-[#E5E8EB]" />
                      {/* 이름 */}
                      <th className="sticky left-9 z-20 w-[108px] min-w-[108px] bg-[#F9FAFB] border-b border-r border-[#E5E8EB] px-3 py-2.5 text-[12px] font-semibold text-[#6B7684] text-left">이름</th>
                      <th className="w-32 min-w-[128px] bg-[#F9FAFB] border-b border-r border-[#E5E8EB] px-3 py-2.5 text-[12px] font-semibold text-[#6B7684] text-left">특이사항</th>
                      <th className="w-20 min-w-[80px] bg-[#F9FAFB] border-b border-r border-[#E5E8EB] px-2 py-2.5 text-[12px] font-semibold text-[#6B7684] text-center">출결</th>
                      <th className="w-24 min-w-[96px] bg-[#F9FAFB] border-b border-r border-[#E5E8EB] px-2 py-2.5 text-[12px] font-semibold text-[#6B7684] text-center">이전 숙제</th>
                      {/* 동적 컬럼 헤더 */}
                      {columns.map(col => (
                        <SortableColumnHeader key={col.id} column={col}
                          onEdit={() => { setEditingColumn(col); setShowColumnModal(true) }}
                          onDelete={() => setDeleteColumnTarget(col)} />
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={5 + columns.length}
                          className="py-16 text-center text-[14px] text-[#ADB5BD]">
                          학생을 추가해주세요.
                        </td>
                      </tr>
                    )}
                    {students.map(student => {
                      const record = getRecord(student.id)
                      return (
                        <SortableStudentRow key={student.id} student={student}>
                          {/* 이름 + 복사/삭제 버튼 */}
                          <td className="sticky left-9 z-10 bg-white group-hover:bg-[#FAFAFA] border-b border-r border-[#E5E8EB] px-2 py-1.5 w-[136px] min-w-[136px] transition-colors">
                            <div className="flex items-center gap-0.5 min-w-0">
                              <span className="text-[14px] font-bold text-[#191F28] truncate flex-1">{student.name}</span>
                              {/* 문자 복사 + 발송 체크 */}
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(student)}
                                className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[15px] font-bold transition-all ${
                                  sentSet.has(student.id)
                                    ? 'text-[#0BB070] bg-[#EDFDF4] hover:bg-[#C6F6E0]'
                                    : 'text-[#ADB5BD] hover:text-[#3182F6] hover:bg-[#EBF3FF]'
                                }`}
                                title={sentSet.has(student.id) ? '발송 완료 (재클릭 시 해제)' : '문자 복사 및 발송 체크'}>
                                {sentSet.has(student.id) ? '✓' : '📋'}
                              </button>
                              {/* 삭제 */}
                              <button
                                type="button"
                                onClick={() => setDeleteStudentTarget(student)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[#ADB5BD] hover:text-[#F04452] hover:bg-[#FFF0F1] text-[11px] transition-all">
                                ✕
                              </button>
                            </div>
                          </td>
                          {/* 특이사항 */}
                          <td className="border-b border-r border-[#E5E8EB] px-1.5 py-1.5">
                            <EditableCell value={record.note ?? ''} placeholder="메모"
                              onSave={v => handleRecordTextChange(student, 'note', v)} />
                          </td>
                          {/* 출결 */}
                          <td className="border-b border-r border-[#E5E8EB] px-2 py-1.5">
                            <AttendanceCell attendance={record.attendance}
                              onChange={v => handleAttendanceChange(student, v)} />
                          </td>
                          {/* 이전 숙제 */}
                          <td className="border-b border-r border-[#E5E8EB] px-2 py-1.5">
                            <HomeworkCell status={record.homework_status}
                              onChange={v => handleHomeworkStatusChange(student, v)} />
                          </td>
                          {/* 테스트 결과 */}
                          {columns.map(col => (
                            <td key={col.id} className="min-w-[128px] w-[128px] border-b border-r border-[#E5E8EB] px-2 py-1.5">
                              <ResultCell
                                value={getResult(record.id, col.id)?.result ?? null}
                                onSave={v => handleResultChange(student, col, v)} />
                            </td>
                          ))}
                        </SortableStudentRow>
                      )
                    })}
                  </tbody>
                </table>

              </SortableContext>

              {/* 컬럼 드래그 오버레이 */}
              <DragOverlay>
                {activeColumn && (
                  <div className="bg-white border-2 border-[#3182F6] rounded-xl px-3 py-2 shadow-lg text-[12px] font-semibold text-[#3182F6] whitespace-nowrap">
                    ⠿ {activeColumn.name}
                  </div>
                )}
              </DragOverlay>
            </DndContext>

          </SortableContext>

          {/* 행 드래그 오버레이 */}
          <DragOverlay>
            {activeStudent && (
              <div className="bg-white border-2 border-[#3182F6] rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2">
                <span className="text-[#3182F6] text-[12px]">⠿</span>
                <span className="text-[14px] font-bold text-[#191F28]">{activeStudent.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── 모달 ── */}
      {deleteStudentTarget && (
        <DeleteModal
          title="학생을 삭제할까요?"
          description={
            <>
              <span className="font-semibold text-[#191F28]">{deleteStudentTarget.name}</span>의 모든 수업 기록과
              테스트 결과가 함께 삭제돼요.{' '}
              <span className="text-[#F04452]">이 작업은 되돌릴 수 없어요.</span>
            </>
          }
          onClose={() => setDeleteStudentTarget(null)}
          onConfirm={handleDeleteStudent}
        />
      )}
      {showColumnModal && (
        <ColumnModal
          editColumn={editingColumn}
          onClose={() => { setShowColumnModal(false); setEditingColumn(null) }}
          onSave={handleColumnSave}
        />
      )}
      {deleteColumnTarget && (
        <DeleteModal
          title="테스트 컬럼을 삭제할까요?"
          description={
            <>
              <span className="font-semibold text-[#191F28]">{deleteColumnTarget.name}</span>의 모든 학생 결과가
              함께 삭제돼요.{' '}
              <span className="text-[#F04452]">이 작업은 되돌릴 수 없어요.</span>
            </>
          }
          onClose={() => setDeleteColumnTarget(null)}
          onConfirm={handleColumnDelete}
        />
      )}
      <BottomNav currentSessionId={session.id} />
    </div>
  )
}
