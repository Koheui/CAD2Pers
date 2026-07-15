import { useLayoutEffect, useRef, useState } from 'react'
import { Check, CornerUpLeft, Trash2, X, Spline } from 'lucide-react'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/**
 * 平面図の上に実際の部屋の輪郭をなぞって領域を確定するエディタ。
 * 点は画像に対する正規化座標 [0..1] で保持する（色・解像度に非依存）。
 */
export default function OutlineTracer({ imageUrl, initial, initialClosed, onCancel, onSave }) {
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [pts, setPts] = useState(initial?.length ? initial : [])
  const [closed, setClosed] = useState(initialClosed ?? (initial?.length ?? 0) >= 3)
  const [dragIdx, setDragIdx] = useState(null)
  const [hover, setHover] = useState(null)
  const [category, setCategory] = useState('architecture') // 'architecture' | 'furniture'
  const [mode, setMode] = useState('interior') // 'interior' | 'exterior'

  useLayoutEffect(() => {
    const el = imgRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    if (el.complete) update()
    el.addEventListener('load', update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('load', update)
      ro.disconnect()
    }
  }, [])

  const toNorm = (clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect()
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }
  }

  const handleClick = (e) => {
    if (closed || dragIdx !== null) return
    const p = toNorm(e.clientX, e.clientY)
    // 始点付近をクリックしたら閉じる
    if (pts.length >= 3) {
      const first = pts[0]
      const dx = (first.x - p.x) * size.w
      const dy = (first.y - p.y) * size.h
      if (Math.hypot(dx, dy) < 14) {
        setClosed(true)
        return
      }
    }
    setPts((prev) => [...prev, p])
  }

  const onVertexDown = (e, i) => {
    e.stopPropagation()
    setDragIdx(i)
  }

  useLayoutEffect(() => {
    if (dragIdx === null) return
    const move = (e) => {
      const p = toNorm(e.clientX, e.clientY)
      setPts((prev) => prev.map((pt, i) => (i === dragIdx ? p : pt)))
    }
    const up = () => setDragIdx(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragIdx, size])

  const undo = () => {
    if (closed) {
      setClosed(false)
      return
    }
    setPts((prev) => prev.slice(0, -1))
  }
  const clear = () => {
    setPts([])
    setClosed(false)
  }

  const { w, h } = size
  const px = (p) => ({ x: p.x * w, y: p.y * h })
  const outer = `M0 0 H${w} V${h} H0 Z`
  const inner =
    closed && pts.length >= 3
      ? 'M ' + pts.map((p) => `${p.x * w} ${p.y * h}`).join(' L ') + ' Z'
      : ''

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-ink-950/95 backdrop-blur">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex items-center gap-2.5">
            <Spline size={17} className="text-accent-400" />
            <h2 className="text-sm font-semibold text-zinc-100">壁のラインを設定（図面をなぞる）</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 1段目：大分類（建築 or 家具・什器） */}
            <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
              {[
                { id: 'architecture', label: '建築（部屋・外壁）' },
                { id: 'furniture', label: '家具・什器（キッチン等）' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={[
                    'rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
                    category === tab.id
                      ? 'bg-accent-400 text-ink-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 2段目：詳細（建築の時のみ、内装 or 外装を表示） */}
            {category === 'architecture' && (
              <div className="flex rounded-lg bg-white/[0.03] p-0.5 ring-1 ring-white/8">
                {[
                  { id: 'interior', label: '部屋の内壁（内装）' },
                  { id: 'exterior', label: '建物の外壁（外装）' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMode(tab.id)}
                    className={[
                      'rounded-md px-2.5 py-0.5 text-[10px] font-medium transition-all',
                      mode === tab.id
                        ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ガイドテキスト */}
          <p className="text-xs text-zinc-400">
            {category === 'architecture' && mode === 'interior' && (
              <>
                平面図上の<strong className="text-accent-300">部屋の内側の角（かど）</strong>を順にクリックして、壁のラインを囲んでください。
              </>
            )}
            {category === 'architecture' && mode === 'exterior' && (
              <>
                平面図上の<strong className="text-accent-300">建物の外側の角（かど）</strong>を順にクリックして、外壁のラインを囲んでください。
              </>
            )}
            {category === 'furniture' && (
              <>
                平面図上の<strong className="text-accent-300">家具・キッチンの外周の角（かど）</strong>を順にクリックして囲んでください。
              </>
            )}
            <span className="ml-2 text-[10px] text-zinc-500 font-normal">
              ※壁の向きは確定後も1クリックで反転可能です
            </span>
          </p>
        </div>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-100" aria-label="閉じる">
          <X size={20} />
        </button>
      </div>

      {/* canvas */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div ref={wrapRef} className="relative inline-block leading-none">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="平面図"
            className="block max-h-[68vh] max-w-[86vw] select-none rounded-lg"
            draggable={false}
          />
          <svg
            width={w}
            height={h}
            className={`absolute inset-0 ${closed ? '' : 'cursor-crosshair'}`}
            onClick={handleClick}
            onMouseMove={(e) => !closed && setHover(toNorm(e.clientX, e.clientY))}
            onMouseLeave={() => setHover(null)}
          >
            {inner && (
              <path d={`${outer} ${inner}`} fillRule="evenodd" fill="rgba(8,9,11,0.6)" />
            )}
            {/* edges */}
            {pts.length > 0 && (
              <polyline
                points={pts.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
                fill="none"
                stroke="var(--color-accent-400)"
                strokeWidth="2"
              />
            )}
            {closed && pts.length >= 3 && (
              <line
                x1={pts[pts.length - 1].x * w}
                y1={pts[pts.length - 1].y * h}
                x2={pts[0].x * w}
                y2={pts[0].y * h}
                stroke="var(--color-accent-400)"
                strokeWidth="2"
              />
            )}
            {/* rubber-band to cursor */}
            {!closed && pts.length > 0 && hover && (
              <line
                x1={pts[pts.length - 1].x * w}
                y1={pts[pts.length - 1].y * h}
                x2={hover.x * w}
                y2={hover.y * h}
                stroke="var(--color-accent-400)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.6"
              />
            )}
            {/* vertices */}
            {pts.map((p, i) => {
              const c = px(p)
              const isFirst = i === 0
              return (
                <g key={i}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isFirst && !closed && pts.length >= 3 ? 8 : 6}
                    fill={isFirst ? 'var(--color-accent-400)' : '#0e0f12'}
                    stroke="var(--color-accent-400)"
                    strokeWidth="2"
                    className="cursor-grab"
                    onPointerDown={(e) => onVertexDown(e, i)}
                  />
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* footer controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span
            className={`inline-flex h-1.5 w-1.5 rounded-full ${closed ? 'bg-accent-400' : 'bg-zinc-600'}`}
          />
          {closed
            ? `${pts.length}箇所の角で壁の位置を設定`
            : pts.length === 0
              ? '平面図上の部屋の角（かど）をクリックして壁を配置してください。'
              : `平面図の角をクリックして壁を設定中（${pts.length}箇所の角を指定、始点をクリックして閉じる）`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={pts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 hover:bg-white/[0.07] disabled:opacity-40"
          >
            <CornerUpLeft size={14} /> {closed ? '開く' : '1つ戻る'}
          </button>
          <button
            onClick={clear}
            disabled={pts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 hover:bg-white/[0.07] disabled:opacity-40"
          >
            <Trash2 size={14} /> 全消し
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(pts.length >= 2 ? pts : null, category === 'furniture' ? 'furniture' : mode, closed)}
            disabled={pts.length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
          >
            <Check size={15} /> 壁の設定を確定する
          </button>
        </div>
      </div>
    </div>
  )
}
