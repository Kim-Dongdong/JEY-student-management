'use client'

import { useState } from 'react'

interface Props {
  name: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function DeleteClassModal({ name, onClose, onConfirm }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[380px] sm:mx-4 p-6">

        {/* 경고 아이콘 */}
        <div className="w-11 h-11 rounded-full bg-[#FFF0F1] flex items-center justify-center mb-4 text-[20px]">
          🗑
        </div>

        <h2 className="text-[18px] font-bold text-[#191F28] mb-2">
          반을 삭제할까요?
        </h2>
        <p className="text-[14px] text-[#6B7684] leading-relaxed mb-6">
          <span className="font-semibold text-[#191F28]">{name}</span>의 모든 수업 기록,
          학생 정보, 테스트 결과가 함께 삭제돼요.{' '}
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
            onClick={handleConfirm}
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
