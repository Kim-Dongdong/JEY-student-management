'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type AttendanceType = 'present' | 'absent' | 'late'
type HomeworkStatusType = 'done' | 'undone'

type TestResult = {
  result: string | null
  test_columns: {
    name: string
    type: string
    order_num: number
  } | null
}

type SessionRecord = {
  id: string
  attendance: AttendanceType
  homework_status: HomeworkStatusType
  next_homework: string | null
  note: string | null
  sessions: {
    id: string
    date: string
    time_range: string | null
  }
  test_results: TestResult[]
}

interface Props {
  studentId: string
  studentName: string
  onClose: () => void
}

const ATTENDANCE_LABEL: Record<AttendanceType, string> = {
  present: '출석', absent: '결석', late: '지각',
}
const ATTENDANCE_COLOR: Record<AttendanceType, string> = {
  present: 'bg-[#E8F5E9] text-[#2E7D32]',
  absent: 'bg-[#FFF0F1] text-[#F04452]',
  late: 'bg-[#FFF8E1] text-[#E65100]',
}
const ATTENDANCE_DOT: Record<AttendanceType, string> = {
  present: 'bg-[#4CAF50]', absent: 'bg-[#F04452]', late: 'bg-[#FFA726]',
}

// 결과값 파싱
function parseResult(result: string) {
  const r = result.trim()
  // "P(74/80)", "X(30/80)" 형태
  const fracMatch = r.match(/\((\d+)\/(\d+)\)/)
  if (fracMatch) {
    const pct = (parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100
    const isPass = r.startsWith('P') || r.startsWith('O') ? true : r.startsWith('X') ? false : null
    return { pct, isPass }
  }
  // 순수 숫자
  const numMatch = r.match(/^(\d+)$/)
  if (numMatch) return { pct: parseInt(numMatch[1]), isPass: null }
  // 분수 "74/80"
  const rawFrac = r.match(/^(\d+)\/(\d+)$/)
  if (rawFrac) return { pct: (parseInt(rawFrac[1]) / parseInt(rawFrac[2])) * 100, isPass: null }
  // P/O/X
  if (r === 'P' || r === 'O') return { pct: null, isPass: true }
  if (r === 'X') return { pct: null, isPass: false }
  return { pct: null, isPass: null }
}

// ──────────────────────────────────────────
// 테스트 결과 타일
// ──────────────────────────────────────────
function TestResultTile({ name, result }: { name: string; result: string }) {
  const { pct, isPass } = parseResult(result)

  // 점수형 (분수/숫자)
  if (pct !== null) {
    const good = isPass === false ? false : pct >= 80
    const mid  = pct >= 60 && pct < 80 && isPass !== false

    const bg    = isPass === false ? '#FFF0F1' : good ? '#E8F5E9' : mid ? '#FFF8E1' : '#FFF0F1'
    const color = isPass === false ? '#F04452' : good ? '#2E7D32' : mid ? '#E65100' : '#F04452'
    const bar   = isPass === false ? '#F04452' : good ? '#4CAF50' : mid ? '#FFA726' : '#F04452'

    // 점수 부분만 추출해서 표시 (예: "P(74/80)" → "74/80")
    const fracMatch = result.match(/\((\d+\/\d+)\)/)
    const displayScore = fracMatch ? fracMatch[1] : `${Math.round(pct)}%`
    const prefix = isPass === true ? 'P · ' : isPass === false ? 'X · ' : ''

    return (
      <div
        className="flex flex-col rounded-xl px-3 pt-2.5 pb-2 min-w-[72px] flex-1"
        style={{ background: bg }}
      >
        <span className="text-[10px] font-medium mb-1.5 truncate" style={{ color }}>
          {name}
        </span>
        <span className="text-[13px] font-bold leading-none" style={{ color }}>
          {prefix}{displayScore}
        </span>
        {/* 점수 바 */}
        <div className="mt-2 h-1 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(pct, 100)}%`, background: bar }}
          />
        </div>
      </div>
    )
  }

  // P/O 통과
  if (isPass === true) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 min-w-[64px] flex-1 bg-[#E8F5E9]">
        <span className="text-[10px] font-medium text-[#4CAF50] mb-1 truncate w-full text-center">{name}</span>
        <span className="text-[18px] leading-none">✅</span>
      </div>
    )
  }

  // X 불통과
  if (isPass === false) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 min-w-[64px] flex-1 bg-[#FFF0F1]">
        <span className="text-[10px] font-medium text-[#F04452] mb-1 truncate w-full text-center">{name}</span>
        <span className="text-[18px] leading-none">❌</span>
      </div>
    )
  }

  // 텍스트 결과 (수요일 등)
  return (
    <div className="flex flex-col rounded-xl px-3 pt-2.5 pb-2 min-w-[64px] flex-1 bg-[#F2F4F6]">
      <span className="text-[10px] font-medium text-[#6B7684] mb-1 truncate">{name}</span>
      <span className="text-[13px] font-semibold text-[#4E5968]">{result}</span>
    </div>
  )
}

// ──────────────────────────────────────────
// 메인 모달
// ──────────────────────────────────────────
export default function StudentHistoryModal({ studentId, studentName, onClose }: Props) {
  const [supabase] = useState(() => createClient())
  const [records, setRecords] = useState<SessionRecord[]>([])
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [memoSaving, setMemoSaving] = useState(false)
  const memoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function fetchAll() {
      const [{ data: studentData }, { data: recordsData }] = await Promise.all([
        supabase.from('students').select('memo').eq('id', studentId).single(),
        supabase
          .from('student_records')
          .select(`
            id, attendance, homework_status, next_homework, note,
            sessions!inner ( id, date, time_range ),
            test_results (
              result,
              test_columns ( name, type, order_num )
            )
          `)
          .eq('student_id', studentId),
      ])
      if (studentData) setMemo(studentData.memo ?? '')
      if (recordsData) {
        const sorted = (recordsData as unknown as SessionRecord[]).sort(
          (a, b) => new Date(b.sessions.date).getTime() - new Date(a.sessions.date).getTime()
        )
        setRecords(sorted)
      }
      setLoading(false)
    }
    fetchAll()
  }, [supabase, studentId])

  function handleMemoChange(value: string) {
    setMemo(value)
    if (memoTimerRef.current) clearTimeout(memoTimerRef.current)
    memoTimerRef.current = setTimeout(async () => {
      setMemoSaving(true)
      await supabase.from('students').update({ memo: value || null }).eq('id', studentId)
      setMemoSaving(false)
    }, 800)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`
  }

  const totalSessions = records.length
  const presentCount  = records.filter(r => r.attendance === 'present').length
  const absentCount   = records.filter(r => r.attendance === 'absent').length
  const lateCount     = records.filter(r => r.attendance === 'late').length
  const homeworkDoneCount = records.filter(r => r.homework_status === 'done').length
  const recentDots = [...records].slice(0, 10).reverse()

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[500px] sm:mx-4 flex flex-col max-h-[90vh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F2F4F6]">
          <div>
            <h2 className="text-[18px] font-bold text-[#191F28]">{studentName}</h2>
            <p className="text-[13px] text-[#ADB5BD] mt-0.5">수업 기록 히스토리</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B7684] hover:bg-[#F2F4F6] transition-colors">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#3182F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* 학생 메모 */}
            <div className="px-6 pt-5 pb-4 border-b border-[#F2F4F6]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[#4E5968]">학생 메모</span>
                {memoSaving && <span className="text-[11px] text-[#ADB5BD]">저장 중…</span>}
              </div>
              <textarea
                value={memo}
                onChange={e => handleMemoChange(e.target.value)}
                placeholder={"학생에 대한 메모를 자유롭게 남겨보세요.\n예) 수학 기초 약함, 어휘력 우수, 3월부터 다음 단계로 이동 예정"}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] text-[13px] text-[#191F28] placeholder:text-[#C5CCD6] outline-none focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/10 resize-none transition-all leading-relaxed"
              />
            </div>

            {records.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-[14px] text-[#ADB5BD]">아직 수업 기록이 없어요.</p>
              </div>
            ) : (
              <>
                {/* 출결 현황 */}
                <div className="px-6 pt-5 pb-4 border-b border-[#F2F4F6]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-semibold text-[#4E5968]">출결 현황</span>
                    <span className="text-[12px] text-[#ADB5BD]">총 {totalSessions}회</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    {recentDots.map((r, i) => (
                      <div key={i}
                        title={`${formatDate(r.sessions.date)} · ${ATTENDANCE_LABEL[r.attendance]}`}
                        className={`w-3 h-3 rounded-full ${ATTENDANCE_DOT[r.attendance]}`}
                      />
                    ))}
                    {totalSessions > 10 && <span className="text-[11px] text-[#ADB5BD] ml-1">최근 10회</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center bg-[#E8F5E9] rounded-xl py-2.5">
                      <span className="text-[16px] font-bold text-[#2E7D32]">{presentCount}</span>
                      <span className="text-[11px] text-[#66BB6A] mt-0.5">출석</span>
                    </div>
                    <div className="flex flex-col items-center bg-[#FFF0F1] rounded-xl py-2.5">
                      <span className="text-[16px] font-bold text-[#F04452]">{absentCount}</span>
                      <span className="text-[11px] text-[#F04452] mt-0.5">결석</span>
                    </div>
                    <div className="flex flex-col items-center bg-[#FFF8E1] rounded-xl py-2.5">
                      <span className="text-[16px] font-bold text-[#E65100]">{lateCount}</span>
                      <span className="text-[11px] text-[#FFA726] mt-0.5">지각</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-[#6B7684]">숙제 완료율</span>
                      <span className="text-[12px] font-semibold text-[#191F28]">
                        {homeworkDoneCount}/{totalSessions}회 ({Math.round((homeworkDoneCount / totalSessions) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3182F6] rounded-full"
                        style={{ width: `${(homeworkDoneCount / totalSessions) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* 수업별 기록 */}
                <div className="px-6 pt-5 pb-6">
                  <span className="text-[13px] font-semibold text-[#4E5968]">수업별 기록</span>
                  <ul className="mt-3 flex flex-col gap-3">
                    {records.map(record => {
                      const sortedTests = [...record.test_results]
                        .filter(tr => tr.test_columns !== null && tr.result)
                        .sort((a, b) => a.test_columns!.order_num - b.test_columns!.order_num)

                      return (
                        <li key={record.id} className="rounded-xl border border-[#F2F4F6] bg-[#F9FAFB] px-4 py-3">

                          {/* 날짜 + 출결 */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-[14px] font-semibold text-[#191F28]">
                                {formatDate(record.sessions.date)}
                              </span>
                              {record.sessions.time_range && (
                                <span className="text-[12px] text-[#ADB5BD] ml-2">
                                  {record.sessions.time_range}
                                </span>
                              )}
                            </div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ATTENDANCE_COLOR[record.attendance]}`}>
                              {ATTENDANCE_LABEL[record.attendance]}
                            </span>
                          </div>

                          {/* 숙제 + 테스트 타일 */}
                          {(sortedTests.length > 0 || record.homework_status) && (
                            <div className="flex gap-2 flex-wrap">
                              {/* 숙제 타일 */}
                              {record.homework_status === 'done' ? (
                                <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 min-w-[64px] flex-1 bg-[#E8F5E9]">
                                  <span className="text-[10px] font-medium text-[#4CAF50] mb-1 w-full text-center">숙제</span>
                                  <span className="text-[18px] leading-none">✅</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 min-w-[64px] flex-1 bg-[#FFF0F1]">
                                  <span className="text-[10px] font-medium text-[#F04452] mb-1 w-full text-center">숙제</span>
                                  <span className="text-[18px] leading-none">❌</span>
                                </div>
                              )}

                              {/* 테스트 결과 타일들 */}
                              {sortedTests.map((tr, i) => (
                                <TestResultTile
                                  key={i}
                                  name={tr.test_columns!.name}
                                  result={tr.result!}
                                />
                              ))}
                            </div>
                          )}

                          {/* 메모 */}
                          {record.note && (
                            <p className="mt-2.5 text-[12px] text-[#6B7684] leading-relaxed border-t border-[#EAECEF] pt-2.5">
                              {record.note}
                            </p>
                          )}

                          {/* 다음 숙제 */}
                          {record.next_homework && (
                            <p className="mt-2 text-[12px] text-[#3182F6] leading-relaxed">
                              다음 숙제: {record.next_homework}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
