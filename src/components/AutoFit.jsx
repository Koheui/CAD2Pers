import { useEffect, useMemo, useState } from 'react'
import { Ruler, Sparkles, Wand2, X, ArrowRight, Check } from 'lucide-react'
import { autoMatch } from '../lib/autofit.js'

/**
 * 寸法ベースの自動フィット（β）— 壁モデル版。
 * 各壁の長さ（平面図の輪郭から算出）と、各展開図の幅を照合して割り当てを入れ替える。
 * planScale と各展開図の scale が揃えば実寸(mm)照合、無ければ比率照合にフォールバック。
 */
export default function AutoFit({ walls, planScale, onCancel, onApply }) {
  const withImg = useMemo(() => walls.filter((w) => w.image), [walls])
  const absolute = !!planScale && withImg.length > 0 && withImg.every((w) => w.scale)
  const unit = absolute ? 'mm' : '相対'

  // 壁の長さ（平面図由来）
  const [wallLens, setWallLens] = useState(() =>
    walls.map((w) => ({ key: w.id, index: w.index, len: Math.round(w.length * (planScale || 1)) })),
  )
  // 展開図プール（現在いずれかの壁に載っている画像）
  const [elevs, setElevs] = useState(() =>
    withImg.map((w, i) => ({ id: w.id, letter: String.fromCharCode(65 + i), url: w.image, scale: w.scale, width: 0 })),
  )
  const [matches, setMatches] = useState([])
  const [ran, setRan] = useState(false)

  // 展開図の自然幅を計測（scale があれば mm 換算）
  useEffect(() => {
    elevs.forEach((e) => {
      if (e.width) return
      const im = new Image()
      im.onload = () =>
        setElevs((prev) =>
          prev.map((x) => (x.id === e.id ? { ...x, width: Math.round(im.naturalWidth * (e.scale || 1)) } : x)),
        )
      im.src = e.url
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = () => {
    setMatches(
      autoMatch(
        wallLens.map((w) => ({ key: w.key, len: w.len })),
        elevs.map((e) => ({ id: e.id, width: e.width })),
        absolute,
      ),
    )
    setRan(true)
  }

  const ready = elevs.length > 0 && elevs.every((e) => e.width > 0) && wallLens.some((w) => w.len > 0)
  useEffect(() => {
    if (ready && !ran) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const wallOf = useMemo(() => {
    const m = {}
    matches.forEach((p) => (m[p.wall] = p.elevation))
    return m
  }, [matches])

  const apply = () => {
    const assign = {}
    for (const w of wallLens) {
      const elevId = wallOf[w.key]
      if (!elevId) continue
      const src = elevs.find((e) => e.id === elevId)
      if (src) assign[w.key] = { image: src.url, scale: src.scale ?? null }
    }
    onApply(assign)
  }

  const setWallLen = (key, v) =>
    setWallLens((prev) => prev.map((w) => (w.key === key ? { ...w, len: Number(v) || 0 } : w)))
  const setElevWidth = (id, v) =>
    setElevs((prev) => prev.map((e) => (e.id === id ? { ...e, width: Number(v) || 0 } : e)))
  const idxOfElev = (id) => elevs.find((e) => e.id === id)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-ink-950/95 backdrop-blur">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Wand2 size={17} className="text-accent-400" />
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              寸法で自動フィット
              <span className="rounded-full border border-accent-400/30 bg-accent-400/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-300">β</span>
            </h2>
            <p className="text-xs text-zinc-500">壁の長さと展開図の幅を照合して割り当てを入れ替えます</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-100" aria-label="閉じる">
          <X size={20} />
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-6">
        {elevs.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-ink-900/40 p-8 text-center text-sm text-zinc-400">
            展開図がまだありません。先に各壁へ展開図を割り当ててから自動フィットを実行してください。
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            <div
              className={[
                'mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                absolute ? 'border-accent-400/30 bg-accent-400/10 text-accent-200' : 'border-white/10 bg-white/[0.02] text-zinc-400',
              ].join(' ')}
            >
              <Ruler size={13} className={absolute ? 'text-accent-400' : 'text-zinc-500'} />
              {absolute
                ? '実寸(mm)で照合中 — 縮尺入力あり。似た長さの壁も区別できます'
                : '相対比率で照合中 — 縮尺未入力。PDF＋縮尺で読み込むと実寸照合になります'}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  <Ruler size={14} className="text-accent-400" /> 壁の長さ（平面図由来）
                </h3>
                <div className="mt-3 space-y-2">
                  {wallLens.map((w) => (
                    <div key={w.key} className="flex items-center gap-3">
                      <span className="flex w-14 shrink-0 items-center gap-1 text-sm text-zinc-300">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-400 text-[9px] text-ink-950">{w.index}</span>
                        壁{w.index}
                      </span>
                      <input
                        type="number"
                        value={w.len || ''}
                        onChange={(e) => setWallLen(w.key, e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-400/50"
                      />
                      <span className="shrink-0 text-xs text-zinc-600">{unit}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  <Ruler size={14} className="text-accent-400" /> 展開図の幅
                </h3>
                <div className="mt-3 space-y-2">
                  {elevs.map((e) => (
                    <div key={e.id} className="flex items-center gap-3">
                      <img src={e.url} alt="" className="h-9 w-12 shrink-0 rounded border border-white/10 object-cover" />
                      <span className="w-10 shrink-0 text-sm text-zinc-300">図{e.letter}</span>
                      <input
                        type="number"
                        value={e.width || ''}
                        onChange={(ev) => setElevWidth(e.id, ev.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-400/50"
                      />
                      <span className="shrink-0 text-xs text-zinc-600">{unit}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="lg:col-span-2">
                <button
                  onClick={run}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-400 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300"
                >
                  <Sparkles size={16} /> 寸法でマッチング
                </button>

                {ran && matches.length > 0 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-ink-900/40 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">割り当て結果</h4>
                    <ul className="mt-3 space-y-2">
                      {wallLens
                        .filter((w) => wallOf[w.key])
                        .map((w) => {
                          const e = idxOfElev(wallOf[w.key])
                          const cost = matches.find((p) => p.wall === w.key)?.cost ?? 0
                          const fit = Math.round((1 - cost) * 100)
                          return (
                            <li key={w.key} className="flex items-center gap-3 rounded-lg bg-white/[0.02] p-2">
                              <span className="w-14 shrink-0 text-sm font-medium text-zinc-200">壁{w.index}</span>
                              <ArrowRight size={14} className="shrink-0 text-zinc-600" />
                              <img src={e?.url} alt="" className="h-8 w-11 shrink-0 rounded border border-white/10 object-cover" />
                              <span className="text-sm text-zinc-400">図{e?.letter}</span>
                              <span className="ml-auto flex items-center gap-1.5 text-xs">
                                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                                  <span className="block h-full rounded-full bg-accent-400" style={{ width: `${fit}%` }} />
                                </span>
                                <span className="w-9 text-right font-mono text-zinc-400">{fit}%</span>
                              </span>
                            </li>
                          )
                        })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
        <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200">キャンセル</button>
        <button
          onClick={apply}
          disabled={!ran || matches.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
        >
          <Check size={15} /> この割り当てを適用
        </button>
      </div>
    </div>
  )
}
