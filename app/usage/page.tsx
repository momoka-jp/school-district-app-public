import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight, Sparkles, Map, Edit, Sigma } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function UsagePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ヒーローセクション */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-background to-muted/20 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
            <Sparkles className="mr-1 h-3 w-3" />
            校区再編最適化ツール
          </Badge>
          <h1 className="mb-6 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            学校区最適化・可視化システム
            <br className="hidden sm:inline" />
            の使用方法
          </h1>
          <div className="mt-12 rounded-lg overflow-hidden border border-border shadow-2xl">
            <Image
              src="/images/ikoma_map.png"
              alt="校区最適化・可視化システムの地図画面"
              width={1200}
              height={700}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>
      </section>

      {/* 主要機能セクション */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              主要機能
            </h2>
            <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
              本システムの中核となる3機能を示す
            </p>
          </div>

          {/* ⭐️ FlexboxとGridの併��を明示的にし、カード全体をFlexで囲み縦方向の均一化を補助 ⭐️ */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* カード1: 可視化 */}
            <Card className="border-border bg-card transition-all hover:shadow-lg flex flex-col justify-between">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Map className="h-6 w-6 text-primary" /> {/* アイコンをMapに変更 */}
                </div>
                <CardTitle className="text-card-foreground">学校区の可視化</CardTitle>
                <CardDescription>
                  小学校区・中学校区を色分けして表示する．町丁目を最小単位とし，学校との対応関係を可視化する．
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/usage/visualization-detail">
                  <Button variant="link" className="px-0 group">
                    詳細を見る <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* カード2: 手動編集 */}
            <Card className="border-border bg-card transition-all hover:shadow-lg flex flex-col justify-between">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Edit className="h-6 w-6 text-primary" /> {/* アイコンをEditに変更 */}
                </div>
                <CardTitle className="text-card-foreground">校区の手動編集</CardTitle>
                <CardDescription>
                  校区拡大をオンにすると，地図上の町丁目をクリックして校区を変更できる．
                  学校ごと，町丁目ごとに検討条件を柔軟に指定もできる．
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/usage/manual-edit-detail">
                  <Button variant="link" className="px-0 group">
                    詳細を見る <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* カード3: 最適化計算 */}
            <Card className="border-border bg-card transition-all hover:shadow-lg flex flex-col justify-between">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Sigma className="h-6 w-6 text-primary" /> {/* アイコンをSigma（数理最適化の象徴）に変更 */}
                </div>
                <CardTitle className="text-card-foreground">校区再編の最適化計算</CardTitle>
                <CardDescription>
                  現在の校区と制約（距離・定員など）を考慮し, 数理最適化で自動配置する.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/usage/optimization-detail">
                  <Button variant="link" className="px-0 group">
                    詳細を見る <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ステップバイステップガイド */}
      <section className="bg-muted/30 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">始め方</h2>
            <p className="text-pretty text-muted-foreground">3つの簡単なステップで今すぐ始められます</p>
          </div>

          {/* ⭐️ ステップガイドの視覚的連続性を強化 ⭐️ */}
          <div className="relative space-y-8 before:absolute before:inset-y-0 before:left-5 before:w-0.5 before:bg-border md:before:left-6">
            {/* ステップ1 */}
            <Card className="relative border-border bg-card ml-12 md:ml-16 shadow-md">
              <CardHeader>
                <div className="absolute -left-10 md:-left-12 top-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold border-4 border-muted/30">
                  1
                </div>
                <div className="flex-1">
                  <CardTitle className="mb-2 text-card-foreground">条件設定．</CardTitle>
                  <CardDescription className="leading-relaxed">
                    校区拡大をオンにし，町丁目をクリックして通学先・属性（固定/対象外/最適化対象）を設定する．
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    変更は即時に地図へ反映される．
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    学校状態（運営/廃校/強制開校）と連動する．
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* ステップ2 */}
            <Card className="relative border-border bg-card ml-12 md:ml-16 shadow-md">
              <CardHeader>
                <div className="absolute -left-10 md:-left-12 top-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold border-4 border-muted/30">
                  2
                </div>
                <div className="flex-1">
                  <CardTitle className="mb-2 text-card-foreground">最適化実行</CardTitle>
                  <CardDescription className="leading-relaxed">
                    「最適化計算」を押下する．制約・重みはパネルで調整し，結果は地図に反映される．
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    距離・定員・隣接などの制約を考慮する．
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    変更不可とした町丁目は最適化から除外される．
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* ステップ3 */}
            <Card className="relative border-border bg-card ml-12 md:ml-16 shadow-md">
              <CardHeader>
                <div className="absolute -left-10 md:-left-12 top-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold border-4 border-muted/30">
                  3
                </div>
                <div className="flex-1">
                  <CardTitle className="mb-2 text-card-foreground">結果比較</CardTitle>
                  <CardDescription className="leading-relaxed">
                    最適化前後の開校/廃校などを比較する．
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    最適化がもたらす平均通学距離の変化を定量的に確認できる．
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    CSV, geojson, PNG保存が可能である．
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>


      {/* CTA セクション */}
      <section className="border-t border-border bg-muted/30 px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/">
              <Button size="lg" className="group shadow-lg transition-shadow hover:shadow-xl">
                アプリを始める
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              デモを見る
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
