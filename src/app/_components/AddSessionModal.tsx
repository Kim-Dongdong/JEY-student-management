'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  onAdd: (date: string, timeRange: string) => Promise<void>
}

export default function AddSessionModal({ onClose, onAdd }: Props) {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')

  const [date, setDate] = useState(`${yyyy}-${mm}-${dd}`)
  const [timeRange, setTimeRange] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return
    setLoading(true)
    await onAdd(date, timeRange.trim())
    setLoading(false)
  }

  const inputCls =
    'w-full h-[52px] px-4 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] text-[15px] text-[#191F28] placeholder:text-[#ADB5BD] outline-none transition-all focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/10'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[400px] sm:mx-4 p-6">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[#191F28]">새 수업 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B7684] hover:bg-[#F2F4F6] transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#6B7684]">수업 날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              autoFocus
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#6B7684]">
              수업 시간{' '}
              <span className="text-[#ADB5BD] font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
              placeholder="예: 18:00~20:00"
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !date}
            className="w-full h-[52px] mt-2 rounded-xl bg-[#3182F6] text-white text-[15px] font-semibold tracking-tight transition-all hover:bg-[#1B6EF3] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '추가 중…' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
