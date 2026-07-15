import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  RefreshCcw,
  Boxes,
  MousePointerClick,
  Palette,
  Layers,
  Check,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import Logo from '../components/Logo.jsx'

/* ---------- Navigation ---------- */
function Nav() {
  const [open, setOpen] = useState(false)
  const links = [
    { label: '課題', href: '#pain' },
    { label: '機能', href: '#features' },
    { label: '料金', href: '#pricing' },
  ]
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/app"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-ink-950 transition-all hover:bg-accent-300"
          >
            無料で使ってみる
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </nav>
        <button
          className="md:hidden text-zinc-300"
          onClick={() => setOpen((v) => !v)}
          aria-label="メニュー"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/5 bg-ink-950 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/app"
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950"
            >
              無料で使ってみる <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="bp-grid absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(52,226,192,0.5), transparent 70%)' }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
            日塗工（JPMA）カラー指定に対応
          </div>
          <h1 className="text-balance text-4xl font-bold leading-[1.12] tracking-tight text-zinc-50 sm:text-6xl">
            2D図面のスクショから、
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-accent-300 to-accent-500 bg-clip-text text-transparent">
              10秒
            </span>
            でプロ品質のパースを。
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
            平面図と立面図をマッピングするだけ。日本の現場に合わせた日塗工（JPMA）カラー指定にも対応した、建築・家具デザイナーのためのAIプレゼンツール。
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/app"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-400 px-7 py-3.5 text-base font-semibold text-ink-950 transition-all hover:bg-accent-300 hover:shadow-[0_0_40px_-6px_rgba(52,226,192,0.6)] sm:w-auto"
            >
              無料で使ってみる
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-7 py-3.5 text-base font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] sm:w-auto"
            >
              機能を見る
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-600">クレジットカード不要・登録なしで試せます</p>
        </div>

        {/* Before / After showcase */}
        <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-2 shadow-2xl backdrop-blur">
            <div className="grid gap-2 sm:grid-cols-2">
              <figure className="relative overflow-hidden rounded-xl border border-white/5">
                <img
                  src="https://placehold.co/800x560/0e0f12/3f434d/png?text=2D+Floor+Plan+%2B+Elevations&font=montserrat"
                  alt="2D図面のスクリーンショット"
                  className="aspect-[10/7] w-full object-cover"
                />
                <figcaption className="absolute left-3 top-3 rounded-md bg-ink-950/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-zinc-300 backdrop-blur">
                  INPUT · 2D図面
                </figcaption>
              </figure>
              <figure className="relative overflow-hidden rounded-xl border border-accent-400/20">
                <img
                  src="https://placehold.co/800x560/12332c/34e2c0/png?text=AI+Rendered+Perspective&font=montserrat"
                  alt="生成された3Dパース"
                  className="aspect-[10/7] w-full object-cover"
                />
                <figcaption className="absolute left-3 top-3 rounded-md bg-accent-400/90 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink-950">
                  OUTPUT · AIパース
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Pain points ---------- */
function Pain() {
  const items = [
    {
      icon: Clock,
      title: 'レンダリングの待ち時間が長すぎる',
      body: '1枚のパースに数十分〜数時間。試行錯誤のたびにレンダー待ちで、思考が止まってしまう。',
    },
    {
      icon: RefreshCcw,
      title: '施主への急な提案変更に追われている',
      body: '「壁の色を変えたい」の一言で、また作り直し。打ち合わせのスピードにツールが追いつかない。',
    },
    {
      icon: Boxes,
      title: '3D CADの操作が複雑',
      body: '高機能ゆえに学習コストが高く、ちょっとしたイメージ共有のために立ち上げるには重すぎる。',
    },
  ]
  return (
    <section id="pain" className="relative border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
            The Problem
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            プレゼンの前に、
            <br className="sm:hidden" />
            疲れていませんか。
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="group rounded-2xl border border-white/8 bg-ink-900/40 p-6 transition-colors hover:border-white/15 hover:bg-ink-900/70"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors group-hover:text-accent-400">
                <it.icon size={20} strokeWidth={1.6} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100">{it.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- Features ---------- */
function Features() {
  const features = [
    {
      no: '01',
      icon: MousePointerClick,
      title: '直感的な2Dマッピング',
      body: '平面図に立面図のスクショを貼り付けるだけで、AIが空間を立体認識。CADの座標入力もモデリングも不要です。',
      img: 'https://placehold.co/900x620/0e0f12/34e2c0/png?text=2D+Mapping&font=montserrat',
      tags: ['ドラッグ＆ドロップ', '座標入力不要'],
    },
    {
      no: '02',
      icon: Palette,
      title: '日塗工（JPMA）番号指定',
      body: '日本の現場の共通言語に対応。「19-90A」などの色番号を入力すれば、カラーコードへ自動変換して正確なトーンを再現します。',
      img: 'https://placehold.co/900x620/12332c/7ff2dc/png?text=JPMA+Color&font=montserrat',
      tags: ['HEX自動変換', '現場の共通言語'],
    },
    {
      no: '03',
      icon: Layers,
      title: '高品質テクスチャーストック',
      body: '事前にAI生成されたシームレスな素材（木目・大理石・コンクリート等）を、ワンクリックで面に適用。質感の検討が一瞬で完了します。',
      img: 'https://placehold.co/900x620/0e0f12/a1a1aa/png?text=Texture+Stock&font=montserrat',
      tags: ['シームレス', 'ワンクリック適用'],
    },
  ]
  return (
    <section id="features" className="relative border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
            Features
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            設計者の思考を、止めない。
          </h2>
        </div>
        <div className="mt-14 flex flex-col gap-16 sm:gap-24">
          {features.map((f, i) => (
            <div
              key={f.no}
              className="grid items-center gap-8 sm:gap-12 lg:grid-cols-2"
            >
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-accent-400">FEATURE {f.no}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-accent-400/40 to-transparent" />
                </div>
                <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-accent-400/20 bg-accent-400/10 text-accent-400">
                  <f.icon size={22} strokeWidth={1.6} />
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                  {f.title}
                </h3>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-zinc-400">{f.body}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300"
                    >
                      <Check size={12} className="text-accent-400" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
                <div className="relative rounded-2xl border border-white/10 bg-ink-900/60 p-2">
                  <div className="bp-grid-fine absolute inset-2 rounded-xl opacity-40" />
                  <img
                    src={f.img}
                    alt={f.title}
                    className="relative aspect-[9/6] w-full rounded-xl object-cover"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- CTA band ---------- */
function CtaBand() {
  return (
    <section className="relative border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-ink-850 to-ink-900 px-6 py-14 text-center sm:px-16 sm:py-20">
          <div className="bp-grid absolute inset-0 opacity-60" />
          <div
            className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full opacity-40 blur-[100px]"
            style={{ background: 'radial-gradient(circle, rgba(52,226,192,0.6), transparent 70%)' }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              次の打ち合わせに、パースを間に合わせよう。
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              登録もインストールも不要。ブラウザを開いたその場で、最初の1枚を生成できます。
            </p>
            <Link
              to="/app"
              className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-accent-400 px-8 py-4 text-base font-semibold text-ink-950 transition-all hover:bg-accent-300 hover:shadow-[0_0_50px_-8px_rgba(52,226,192,0.7)]"
            >
              無料で使ってみる
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer id="pricing" className="border-t border-white/5 py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              建築・家具デザイナーのための、2D図面からのAIパース自動生成ツール。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
                <li><a href="#features" className="hover:text-zinc-100">機能</a></li>
                <li>
                  <Link to="/app" className="hover:text-zinc-100">ツールを開く</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pricing</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
                <li>
                  <span className="inline-flex items-center gap-2">
                    料金プラン
                    <span className="rounded-full border border-accent-400/30 bg-accent-400/10 px-2 py-0.5 text-[10px] font-medium text-accent-300">
                      Coming Soon
                    </span>
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Company</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-zinc-100">お問い合わせ</a></li>
                <li><a href="#" className="hover:text-zinc-100">利用規約</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/5 pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} スマートパース AI. All rights reserved.</p>
          <p>Made for architects &amp; furniture designers in Japan.</p>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <Nav />
      <main>
        <Hero />
        <Pain />
        <Features />
        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
