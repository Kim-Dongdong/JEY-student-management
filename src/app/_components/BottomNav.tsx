'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NavSession = {
  id: string
  date: string
  class_id: string
  classes: { name: string }
}

interface Props {
  currentSessionId?: string
}

const NAV_KEY = 'bottomnav_ids'

export function addNavSession(id: string) {
  try {
    const stored = localStorage.getItem(NAV_KEY)
    const ids: string[] = stored ? JSON.parse(stored) : []
    if (!ids.includes(id)) {
      localStorage.setItem(NAV_KEY, JSON.stringify([id, ...ids]))
    }
  } catch { /* ignore */ }
}

function getNavIds(): string[] {
  try {
    const stored = localStorage.getItem(NAV_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

function removeNavId(id: string) {
  try {
    const ids = getNavIds().filter(i => i !== id)
    localStorage.setItem(NAV_KEY, JSON.stringify(ids))
  } catch { /* ignore */ }
}

function formatShortDate(dateStr: string) {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}.${d}`
}

function SessionChip({
  session,
  isActive,
  navRef,
  onNavigate,
  onDelete,
}: {
  session: NavSession
  isActive: boolean
  navRef?: React.Ref<HTMLDivElement>
  onNavigate: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const label = `${session.classes.name}(${formatShortDate(session.date)})`

  if (confirming) {
    return (
      <div
        ref={navRef}
        className="shrink-0 flex items-center gap-1 h-8 px-2 rounded-full bg-[#FFF0F1] border border-[#FBBCC0]"
      >
        <span className="text-[12px] font-medium text-[#F04452] px-1 whitespace-nowrap">{label}</span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="h-5 px-1.5 rounded-full bg-[#F04452] text-white text-[11px] font-bold hover:bg-[#D93A48] transition-colors"
        >
          삭제
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setConfirming(false) }}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[#ADB5BD] hover:bg-[#F2F4F6] text-[11px] transition-colors"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div ref={navRef} className="shrink-0 group relative flex items-center">
      <button
        type="button"
        onClick={onNavigate}
        className={`
          h-8 pl-3 pr-7 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors
          ${isActive
            ? 'bg-[#3182F6] text-white'
            : 'bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]'
          }
        `}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setConfirming(true) }}
        className={`
          absolute right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px]
          opacity-0 group-hover:opacity-100 transition-all
          ${isActive
            ? 'text-white/70 hover:text-white hover:bg-white/20'
            : 'text-[#ADB5BD] hover:text-[#F04452] hover:bg-[#FFF0F1]'
          }
        `}
      >
        ✕
      </button>
    </div>
  )
}

export default function BottomNav({ currentSessionId }: Props) {
  const [supabase] = useState(() => createClient())
  const [sessions, setSessions] = useState<NavSession[]>([])
  const [ids, setIds] = useState<string[]>([])
  const router = useRouter()
  const activeRef = useRef<HTMLDivElement>(null)

  // localStorage에서 ID 목록 로드
  useEffect(() => {
    setIds(getNavIds())
  }, [currentSessionId])

  // ID 목록이 바뀌면 해당 세션들만 fetch
  useEffect(() => {
    if (ids.length === 0) { setSessions([]); return }
    supabase
      .from('sessions')
      .select('id, date, class_id, classes(name)')
      .in('id', ids)
      .then(({ data }) => {
        const map = new Map(((data ?? []) as unknown as NavSession[]).map(s => [s.id, s]))
        setSessions(ids.map(id => map.get(id)).filter(Boolean) as NavSession[])
      })
  }, [ids, supabase])

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }
  }, [sessions, currentSessionId])

  function handleDelete(sessionId: string) {
    removeNavId(sessionId)
    setIds(prev => prev.filter(id => id !== sessionId))
    if (sessionId === currentSessionId) router.push('/')
  }

  if (sessions.length === 0) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E8EB] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div
        className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {sessions.map(s => (
          <SessionChip
            key={s.id}
            session={s}
            isActive={s.id === currentSessionId}
            navRef={s.id === currentSessionId ? activeRef : undefined}
            onNavigate={() => router.push(`/sessions/${s.id}`)}
            onDelete={() => handleDelete(s.id)}
          />
        ))}
      </div>
    </nav>
  )
}
