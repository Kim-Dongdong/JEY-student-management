'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Student = {
  id: string
  name: string
  note: string | null
  order_num: number
  kakao_chat_url: string | null
}

interface Props {
  classId: string
  className: string
  onClose: () => void
}

function SortableStudentItem({ student, onDelete, onKakaoSave }: {
  student: Student
  onDelete: () => void
  onKakaoSave: (url: string | null) => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: student.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center justify-between px-3 py-3 rounded-xl bg-[#F9FAFB] border border-[#F2F4F6]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 w-6 h-full flex items-center justify-center text-[#D1D6DB] hover:text-[#6B7684] cursor-grab active:cursor-grabbing touch-none mr-2 text-[16px]"
      >
        ⠿
      </button>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[15px] font-semibold text-[#191F28]">{student.name}</span>
        {student.note && (
          <span className="text-[12px] text-[#ADB5BD] mt-0.5 truncate">{student.note}</span>
        )}
        <input
          type="url"
          defaultValue={student.kakao_chat_url ?? ''}
          placeholder="카카오 채팅 URL"
          onBlur={async e => {
            const url = e.target.value.trim() || null
            if (url === (student.kakao_chat_url ?? null)) return
            await onKakaoSave(url)
          }}
          className="mt-1.5 h-[34px] px-3 rounded-lg border border-[#E5E8EB] bg-white text-[12px] text-[#191F28] placeholder:text-[#C5CCD6] outline-none focus:border-[#3182F6] transition-all"
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="ml-3 shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[#ADB5BD] hover:text-[#F04452] hover:bg-[#FFF0F1] text-[12px] transition-all"
      >
        ✕
      </button>
    </li>
  )
}

const inputCls =
  'w-full h-[48px] px-4 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] text-[15px] text-[#191F28] placeholder:text-[#ADB5BD] outline-none transition-all focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/10'

export default function ManageStudentsModal({ classId, className, onClose }: Props) {
  const [supabase] = useState(() => createClient())
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [kakaoChatUrl, setKakaoChatUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('order_num', { ascending: true })
    setStudents((data as Student[]) ?? [])
    setLoading(false)
  }, [supabase, classId])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)

    const maxOrder = students.reduce((max, s) => Math.max(max, s.order_num), 0)
    const { data: newStudent, error } = await supabase
      .from('students')
      .insert({ class_id: classId, name: name.trim(), note: note.trim() || null, kakao_chat_url: kakaoChatUrl.trim() || null, order_num: maxOrder + 1 })
      .select()
      .single()

    if (error || !newStudent) { setAdding(false); return }

    // 해당 반의 모든 기존 세션에 student_record 자동 생성
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('class_id', classId)

    if (sessions && sessions.length > 0) {
      await supabase.from('student_records').insert(
        sessions.map(s => ({
          session_id: s.id,
          student_id: newStudent.id,
          attendance: 'present',
          homework_status: 'done',
        }))
      )
    }

    setStudents(prev => [...prev, newStudent as Student])
    setName('')
    setNote('')
    setKakaoChatUrl('')
    setAdding(false)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleStudentDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const reordered = arrayMove(students, students.findIndex(s => s.id === active.id), students.findIndex(s => s.id === over.id))
    setStudents(reordered)
    await Promise.all(reordered.map((s, i) => supabase.from('students').update({ order_num: i + 1 }).eq('id', s.id)))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('students').delete().eq('id', deleteTarget.id)
    setStudents(prev => prev.filter(s => s.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[460px] sm:mx-4 flex flex-col max-h-[85vh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F2F4F6]">
          <div>
            <h2 className="text-[18px] font-bold text-[#191F28]">학생 관리</h2>
            <p className="text-[13px] text-[#ADB5BD] mt-0.5">{className}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B7684] hover:bg-[#F2F4F6] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 학생 목록 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#3182F6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-center text-[14px] text-[#ADB5BD] py-8">아직 등록된 학생이 없어요.</p>
          ) : (
            <DndContext id="student-manage-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStudentDragEnd}>
              <SortableContext items={students.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">
                  {students.map(student => (
                    <SortableStudentItem
                      key={student.id}
                      student={student}
                      onDelete={() => setDeleteTarget(student)}
                      onKakaoSave={async url => {
                        await supabase.from('students').update({ kakao_chat_url: url }).eq('id', student.id)
                        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, kakao_chat_url: url } : s))
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* 학생 추가 폼 */}
        <div className="px-6 pb-6 pt-3 border-t border-[#F2F4F6]">
          <form onSubmit={handleAdd} className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="이름"
                required
                className={inputCls + ' flex-1'}
              />
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="특이사항 (선택)"
                className={inputCls + ' flex-1'}
              />
            </div>
            <input
              type="url"
              value={kakaoChatUrl}
              onChange={e => setKakaoChatUrl(e.target.value)}
              placeholder="카카오 채팅 URL (선택)"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={adding || !name.trim()}
              className="w-full h-[48px] rounded-xl bg-[#3182F6] text-white text-[15px] font-semibold hover:bg-[#1B6EF3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? '추가 중…' : '+ 학생 추가'}
            </button>
          </form>
        </div>
      </div>

      {/* 삭제 확인 */}
      {deleteTarget && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[320px] mx-4 p-6">
            <div className="w-11 h-11 rounded-full bg-[#FFF0F1] flex items-center justify-center mb-4 text-[20px]">🗑</div>
            <h3 className="text-[17px] font-bold text-[#191F28] mb-2">학생을 삭제할까요?</h3>
            <p className="text-[14px] text-[#6B7684] leading-relaxed mb-5">
              <span className="font-semibold text-[#191F28]">{deleteTarget.name}</span>의 모든 수업 기록이
              함께 삭제돼요.{' '}
              <span className="text-[#F04452]">되돌릴 수 없어요.</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-[46px] rounded-xl bg-[#F2F4F6] text-[14px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-[46px] rounded-xl bg-[#F04452] text-white text-[14px] font-semibold hover:bg-[#D93A48] transition-colors disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
