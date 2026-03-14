import { login } from './actions'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* 헤더 */}
        <div className="mb-10">
          <h1 className="text-[28px] font-bold text-[#191F28] tracking-tight leading-tight">
            안녕하세요.<br />
            로그인해주세요.
          </h1>
        </div>

        {/* 폼 */}
        <form action={login} className="flex flex-col gap-3">
          {/* 이메일 */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-[#6B7684]"
            >
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="이메일을 입력하세요"
              className="w-full h-[52px] px-4 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] text-[15px] text-[#191F28] placeholder:text-[#ADB5BD] outline-none transition-all focus:border-[#3182F6] focus:bg-white focus:ring-3 focus:ring-[#3182F6]/10"
            />
          </div>

          {/* 비밀번호 */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-[#6B7684]"
            >
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              className="w-full h-[52px] px-4 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] text-[15px] text-[#191F28] placeholder:text-[#ADB5BD] outline-none transition-all focus:border-[#3182F6] focus:bg-white focus:ring-3 focus:ring-[#3182F6]/10"
            />
          </div>

          {/* 에러 메시지 */}
          {error === 'invalid' && (
            <p className="text-[13px] text-[#F04452] font-medium mt-1">
              이메일 또는 비밀번호가 올바르지 않아요.
            </p>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            className="w-full h-[52px] mt-3 rounded-xl bg-[#3182F6] text-white text-[15px] font-semibold tracking-tight transition-all hover:bg-[#1B6EF3] active:scale-[0.98] disabled:opacity-50"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  )
}
