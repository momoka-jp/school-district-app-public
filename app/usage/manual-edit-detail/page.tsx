import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit, MousePointer, Lock, Unlock, Target } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ManualEditDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/20 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <Link href="/usage">
            <Button variant="ghost" className="mb-6 group">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              使用方法に戻る
            </Button>
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Edit className="h-8 w-8 text-primary" />
            </div>
            <div>
              <Badge className="mb-3 bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
                機能詳細
              </Badge>
              <h1 className="mb-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                校区の手動編集
              </h1>
              <p className="text-pretty text-lg text-muted-foreground leading-relaxed">
                校区拡大をオンにすると，地図上の町丁目をクリックして通学先を手動で調整できる．
                町丁目には「固定」「対象外」「最適化対象」の属性を付与でき，計画上の前提条件を明示したうえで再編案を試行できる．
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 主要な特徴 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">主要な特徴</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* 直感的な編集 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MousePointer className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">直感的な編集</CardTitle>
                <CardDescription className="leading-relaxed">
                  町丁目をクリックするだけで通学先を変更でき，即座に地図に反映される．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 固定設定 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">固定設定</CardTitle>
                <CardDescription className="leading-relaxed">
                  「固定」にした町丁目は，最適化計算でも割り当てが変更されなくなる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 対象外設定 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Unlock className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">対象外設定</CardTitle>
                <CardDescription className="leading-relaxed">
                  「対象外」にした町丁目は，最適化計算の対象から除外される．検討範囲を限定する際に用いる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 最適化対象設定 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">最適化対象設定</CardTitle>
                <CardDescription className="leading-relaxed">
                  「最適化対象」にした町丁目は，距離や定員などの制約を考慮して自動で割当校が求まる．
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* 使い方 */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">使い方</h2>
          <div className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">1. 校区拡大の有効化</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  画面上部の「編集」をクリックする．その際，学校が選択中でないといけない．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_choice.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  編集中のときは校区の手動変更が可能である．完了をクリックすると編集が終了する．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_henshu.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">2. 変更先の学校を選択</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  校区拡大オンの状態で変更先の学校を選択する．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_henshu.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">3. 町丁目をクリックして変更</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  通学先を変更したい町丁目をクリックすると選択中の学校へ割当てが切り替わり，地図の配色が即時に更新される．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_henshumae.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_henshugo.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">4. 変更の保存</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  変更は自動保存される．校区拡大をオフにすると通常の表示モードに戻る．通常の表示モードでも通学先の変更以外は操作可能である．
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 属性の詳細説明 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">学校属性の詳細</h2>
          <div className="space-y-4">
            <Card className="border-l-4 border-l-blue-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-blue-500" />
                  開校
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の学校は，最適化計算時に距離や定員などの制約を考慮して，開校廃校が決まる．
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-green-500" />
                  廃校
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の学校は，最適化計算時に除外され，割り当て不可となる．
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-blue-500" />
                  強制開校
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の学校は，最適化計算時に現在の学校が維持される．
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-gray-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Unlock className="h-5 w-5 text-gray-500" />
                  対象外
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の町丁目は，最適化計算の対象から完全に除外される．一時的に計算から除外したい場合に使用する．
                </p>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* 属性の詳細説明 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">町丁目属性の詳細</h2>
          <p className="leading-relaxed text-muted-foreground">
                  町丁目をクリックすると出てくるポップアップで設定可能．
          </p>
          <div className="space-y-4">
            <Card className="border-l-4 border-l-blue-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-blue-500" />
                  固定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の町丁目は，最適化計算時に現在の通学先が維持される．赤枠で囲われる．
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-gray-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Unlock className="h-5 w-5 text-gray-500" />
                  対象外
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の町丁目は，最適化計算の対象から完全に除外される．一時的に計算から除外したい場合に使用する．透明になる．
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-green-500" />
                  最適化対象
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  この属性の町丁目は，最適化計算時に距離や定員などの制約を考慮して，最適な学校に自動的に割り当てられる．デフォルト．
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ヒントとコツ */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">ヒントとコツ</h2>
          <Card className="border-l-4 border-l-primary bg-card">
            <CardContent className="pt-6">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    学校ポップアップから町丁目単位の固定を一括で行うことができる．
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    学校ポップアップから町丁目単位の最適化対象外へとするのを一括で行うことができる．
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    左の設定パネルでは最適化範囲を全選択，全解除ができる．
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    学校の状態（運営／廃校／強制開校）と連動しており，廃校は割当不可である．
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 次のステップ */}
      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-foreground">次のステップ</h2>
          <p className="mb-8 text-muted-foreground">
            手動編集で基本的な設定を行ったら、最適化計算で効率的な校区配置を試してみましょう。
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/usage/optimization-detail">
              <Button size="lg">最適化計算について学ぶ</Button>
            </Link>
            <Link href="/usage">
              <Button size="lg" variant="outline">
                使用方法に戻る
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
