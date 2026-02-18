import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import { config } from "@fortawesome/fontawesome-svg-core"
import "@fortawesome/fontawesome-svg-core/styles.css"
config.autoAddCss = false // CSSの自動適用を無効化
import 'leaflet/dist/leaflet.css'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "学校区最適化・可視化アプリ",
  description: "学校区の最適化と可視化を目的としたWebアプリケーション",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // <html>タグから手動の<head>タグを削除
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  )
}