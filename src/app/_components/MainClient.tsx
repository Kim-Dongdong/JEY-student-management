'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/app/login/actions'
import AddClassModal from './AddClassModal'
import DeleteClassModal from './DeleteClassModal'
import AddSessionModal from './AddSessionModal'
import ManageStudentsModal from './ManageStudentsModal'
import BottomNav from './BottomNav'
import { type Class, type Session } from './types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  initialClasses: Class[]
}

export default function MainClient({ initialClasses }: Props) {
  const [supabase] = useState(() => createClient())
  const [classes, setClasses] = useState<Class[]>(initialClasses)
  const [selectedId, setSelectedId] = useState<string | null>(initialClasses[0]?.id ?? null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null)
  const [showAddSessionModal, setShowAddSessionModal] = useState(false)
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<Session | null>(null)
  const [showManageStudents, setShowManageStudents] = useState(false)

  const fetchSessions = useCallback(async (classId: string) => {
    setSessionsLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('id, class_id, date, time_range, created_at, student_records(attendance)')
      .eq('class_id', classId)
      .order('date', { ascending: false })
      .limit(50)
    setSessions((data as Session[]) ?? [])
    setSessionsLoading(false)
  }, [supabase])

  useEffect(() => {
    if (selectedId) fetchSessions(selectedId)
    else setSessions([])
  }, [selectedId, fetchSessions])

  async function handleAddClass(name: string, schedule: string) {
    const { data, error } = await supabase
      .from('classes')
      .insert({ name, schedule })
      .select()
      .single()
    if (!error && data) {
      const newClass = data as Class
      setClasses(prev => [...prev, newClass])
      setSelectedId(newClass.id)
    }
    setShowAddModal(false)
  }

  async function handleDeleteClass() {
    if (!deleteTarget) return
    await supabase.from('classes').delete().eq('id', deleteTarget.id)
    const next = classes.filter(c => c.id !== deleteTarget.id)
    setClasses(next)
    if (selectedId === deleteTarget.id) {
      setSelectedId(next[0]?.id ?? null)
    }
    setDeleteTarget(null)
  }

  async function handleAddSession(date: string, timeRange: string) {
    if (!selectedId) return
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({ class_id: selectedId, date, time_range: timeRange || null })
      .select()
      .single()
    if (error || !newSession) {
      alert(`수업 추가 실패: ${error?.message ?? '알 수 없는 오류'}`)
      return
    }

    // 기본 테스트 컬럼 2개 자동 생성
    await supabase.from('test_columns').insert([
      { session_id: newSession.id, name: '단어 Test', type: 'word', order_num: 0 },
      { session_id: newSession.id, name: '수업 후 Review Test', type: 'review', order_num: 1 },
    ])

    // 해당 반의 모든 학생에 대해 student_record 자동 생성
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', selectedId)
    if (students && students.length > 0) {
      await supabase.from('student_records').insert(
        students.map(s => ({
          session_id: newSession.id,
          student_id: s.id,
          attendance: 'present',
          homework_status: 'done',
        }))
      )
    }

    const sessionWithRecords: Session = {
      ...(newSession as Session),
      student_records: (students ?? []).map(() => ({ attendance: 'present' })),
    }
    setSessions(prev => [sessionWithRecords, ...prev])
    setShowAddSessionModal(false)
  }

  async function handleDeleteSession() {
    if (!deleteSessionTarget) return
    await supabase.from('sessions').delete().eq('id', deleteSessionTarget.id)
    setSessions(prev => prev.filter(s => s.id !== deleteSessionTarget.id))
    setDeleteSessionTarget(null)
  }

  const selectedClass = classes.find(c => c.id === selectedId)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleClassDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const reordered = arrayMove(classes, classes.findIndex(c => c.id === active.id), classes.findIndex(c => c.id === over.id))
    setClasses(reordered)
    await Promise.all(reordered.map((c, i) => supabase.from('classes').update({ order_num: i }).eq('id', c.id)))
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-14">

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#E5E8EB]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-[17px] font-bold tracking-tight text-[#191F28]">
            JEY 어학원
          </span>
          <div className="flex items-center gap-3">
            {selectedClass && (
              <button
                type="button"
                onClick={() => setShowManageStudents(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F4F6] text-[#4E5968] text-[13px] font-semibold hover:bg-[#E5E8EB] transition-colors"
              >
                학생 관리
              </button>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="text-[14px] text-[#6B7684] hover:text-[#191F28] transition-colors"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── 탭 바 ── */}
      <div className="bg-white border-b border-[#E5E8EB]">
        <div className="max-w-5xl mx-auto px-5">
          <DndContext id="class-tab-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleClassDragEnd}>
            <SortableContext items={classes.map(c => c.id)} strategy={horizontalListSortingStrategy}>
              <div
                className="flex items-center overflow-x-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                {classes.map(cls => (
                  <SortableClassTab
                    key={cls.id}
                    cls={cls}
                    isSelected={selectedId === cls.id}
                    onSelect={() => setSelectedId(cls.id)}
                    onDelete={() => setDeleteTarget(cls)}
                  />
                ))}

                {/* 반 추가 버튼 */}
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-4 py-[14px] whitespace-nowrap shrink-0 text-[14px] font-medium text-[#3182F6] hover:text-[#1B6EF3] border-b-2 border-transparent transition-colors"
                >
                  <span className="text-[16px] font-light leading-none mb-px">+</span>
                  반 추가
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* ── 본문 ── */}
      <main className="max-w-5xl mx-auto px-5 py-6">

        {/* 선택된 반 정보 + 새 수업 버튼 */}
        {selectedClass && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-[#6B7684]">
              {selectedClass.schedule || '수업 일정 미입력'}
            </p>
            <button
              type="button"
              onClick={() => setShowAddSessionModal(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#3182F6] text-white text-[13px] font-semibold hover:bg-[#1B6EF3] transition-colors"
            >
              <span className="text-[15px] font-light leading-none">+</span>
              새 수업
            </button>
          </div>
        )}

        {/* 수업 목록 */}
        {!selectedId ? (
          <EmptyState message="반을 선택하거나 추가해주세요." />
        ) : sessionsLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#3182F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState message="아직 수업 기록이 없어요." />
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={() => setDeleteSessionTarget(session)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── 모달 ── */}
      {showAddModal && (
        <AddClassModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddClass}
        />
      )}
      {deleteTarget && (
        <DeleteClassModal
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteClass}
        />
      )}
      {showAddSessionModal && (
        <AddSessionModal
          onClose={() => setShowAddSessionModal(false)}
          onAdd={handleAddSession}
        />
      )}
      {deleteSessionTarget && (
        <DeleteSessionModal
          session={deleteSessionTarget}
          onClose={() => setDeleteSessionTarget(null)}
          onConfirm={handleDeleteSession}
        />
      )}
      {showManageStudents && selectedClass && (
        <ManageStudentsModal
          classId={selectedClass.id}
          className={selectedClass.name}
          onClose={() => setShowManageStudents(false)}
        />
      )}
      <BottomNav />
    </div>
  )
}

/* ── 정렬 가능한 반 탭 ── */
function SortableClassTab({ cls, isSelected, onSelect, onDelete }: {
  cls: Class; isSelected: boolean; onSelect: () => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cls.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="relative flex items-center shrink-0 group"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className={`
          flex items-center pl-0 pr-7 py-[14px] whitespace-nowrap
          text-[14px] font-medium border-b-2 transition-colors cursor-grab active:cursor-grabbing
          ${isSelected
            ? 'border-[#3182F6] text-[#3182F6]'
            : 'border-transparent text-[#6B7684] hover:text-[#191F28]'
          }
        `}
      >
        <span className="px-4">{cls.name}</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="
          absolute right-1 top-1/2 -translate-y-1/2
          w-[18px] h-[18px] rounded-full flex items-center justify-center
          text-[11px] text-[#ADB5BD]
          opacity-0 group-hover:opacity-100
          hover:bg-[#F2F4F6] hover:text-[#6B7684]
          transition-all
        "
        title={`${cls.name} 삭제`}
      >
        ✕
      </button>
    </div>
  )
}

/* ── 빈 상태 ── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-[#ADB5BD]">
      <div className="w-14 h-14 rounded-full bg-[#F2F4F6] flex items-center justify-center mb-3 text-[24px]">
        📋
      </div>
      <p className="text-[14px]">{message}</p>
    </div>
  )
}

/* ── 날짜 포맷: "03/09 [월] 18:00~20:00" ── */
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

/* ── 수업 카드 ── */
function SessionCard({ session, onDelete }: { session: Session; onDelete: () => void }) {
  const records = session.student_records ?? []
  const present = records.filter(r => r.attendance === 'present').length
  const absent  = records.filter(r => r.attendance === 'absent').length
  const late    = records.filter(r => r.attendance === 'late').length
  const total   = records.length

  return (
    <div className="relative group">
      <Link
        href={`/sessions/${session.id}`}
        className="bg-white rounded-2xl shadow-sm border border-[#F2F4F6] px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow block"
      >
        <div>
          <p className="text-[15px] font-semibold text-[#191F28]">
            {formatDate(session.date, session.time_range)}
          </p>
          {total > 0 ? (
            <div className="flex items-center gap-3 mt-1.5">
              <Badge color="blue" label={`출석 ${present}명`} />
              {absent > 0 && <Badge color="red" label={`결석 ${absent}명`} />}
              {late > 0   && <Badge color="orange" label={`지각 ${late}명`} />}
            </div>
          ) : (
            <p className="text-[13px] text-[#ADB5BD] mt-1">기록 없음</p>
          )}
        </div>
        <span className="text-[20px] text-[#C5CCD6] ml-3">›</span>
      </Link>
      {/* 삭제 버튼 */}
      <button
        type="button"
        onClick={e => { e.preventDefault(); onDelete() }}
        className="
          absolute top-3 right-10
          w-7 h-7 rounded-full flex items-center justify-center
          text-[12px] text-[#ADB5BD]
          opacity-0 group-hover:opacity-100
          hover:bg-[#FFF0F1] hover:text-[#F04452]
          transition-all
        "
        title="수업 삭제"
      >
        🗑
      </button>
    </div>
  )
}

/* ── 수업 삭제 확인 모달 ── */
function DeleteSessionModal({
  session,
  onClose,
  onConfirm,
}: {
  session: Session
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  async function handle() { setLoading(true); await onConfirm(); setLoading(false) }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[360px] sm:mx-4 p-6">
        <div className="w-11 h-11 rounded-full bg-[#FFF0F1] flex items-center justify-center mb-4 text-[20px]">🗑</div>
        <h2 className="text-[18px] font-bold text-[#191F28] mb-2">수업을 삭제할까요?</h2>
        <p className="text-[14px] text-[#6B7684] leading-relaxed mb-6">
          <span className="font-semibold text-[#191F28]">{formatDate(session.date, session.time_range)}</span> 수업의
          모든 출결·테스트 기록이 함께 삭제돼요.{' '}
          <span className="text-[#F04452]">이 작업은 되돌릴 수 없어요.</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[50px] rounded-xl bg-[#F2F4F6] text-[15px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handle}
            disabled={loading}
            className="flex-1 h-[50px] rounded-xl bg-[#F04452] text-white text-[15px] font-semibold hover:bg-[#D93A48] transition-colors disabled:opacity-50"
          >
            {loading ? '삭제 중…' : '삭제하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

const badgeColors = {
  blue:   'text-[#3182F6] bg-[#EBF3FF]',
  red:    'text-[#F04452] bg-[#FFF0F1]',
  orange: 'text-[#F59E0B] bg-[#FFFBEB]',
}

function Badge({ color, label }: { color: keyof typeof badgeColors; label: string }) {
  return (
    <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${badgeColors[color]}`}>
      {label}
    </span>
  )
}
