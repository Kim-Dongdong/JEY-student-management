'use client'

import { useState } from 'react'

type TestColumn = {
  id: string
  name: string
  type: string
}

interface Props {
  editColumn: TestColumn | null
  onClose: () => void
  onSave: (name: string, type: string, editId?: string) => Promise<void>
}

const TYPE_OPTIONS = [
  { value: 'word', label: '단어 테스트' },
  { value: 'review', label: '복습 테스트' },
  { value: 'custom', label: '자유 입력' },
]

export default function ColumnModal({ editColumn, onClose, onSave }: Props) {
  const [name, setName] = useState(editColumn?.name ?? '')
  const [type, setType] = useState(editColumn?.type ?? 'word')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSave(name.trim(), type, editColumn?.id)
    setLoading(false)
  }

  const isEdit = !!editColumn

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[400px] sm:mx-4 p-6">

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[#191F28]">
            {isEdit ? '테스트 컬럼 수정' : '테스트 컬럼 추가'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B7684] hover:bg-[#F2F4F6] transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 컬럼 이름 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#6B7684]">테스트 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 단어 TEST, 7대 영역 7~10"
              required
              autoFocus
              className="w-full h-[52px] px-4 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] text-[15px] text-[#191F28] placeholder:text-[#ADB5BD] outline-none transition-all focus:border-[#3182F6] focus:bg-white focus:ring-2 focus:ring-[#3182F6]/10"
            />
          </div>

          {/* 타입 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#6B7684]">유형</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex-1 h-10 rounded-xl text-[13px] font-medium border transition-all ${
                    type === opt.value
                      ? 'bg-[#EBF3FF] border-[#3182F6] text-[#3182F6]'
                      : 'bg-[#F9FAFB] border-[#E5E8EB] text-[#6B7684] hover:border-[#ADB5BD]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full h-[52px] mt-2 rounded-xl bg-[#3182F6] text-white text-[15px] font-semibold tracking-tight transition-all hover:bg-[#1B6EF3] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (isEdit ? '수정 중…' : '추가 중…') : isEdit ? '수정하기' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
