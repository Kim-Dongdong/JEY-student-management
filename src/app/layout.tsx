import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '학생 관리 시스템',
  description: '수업 출결 및 테스트 관리',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
