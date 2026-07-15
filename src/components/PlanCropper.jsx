import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, X, Crop, Loader2, RefreshCw } from 'lucide-react'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/**
 * キャンバス内の描画要素（透過以外の部分で、かつ真っ白ではないピクセル）を自動検出し、
 * その最小のバウンディングボックスでさらにトリミングした新しいキャンバスを返します。
 */
function autoCropCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data

  // 1. 各X列、各Y行のインクピクセル密度をカウントする配列を初期化
  const colDensity = new Array(w).fill(0)
  const rowDensity = new Array(h).fill(0)

  // 全ピクセルをスキャンして密度をプロファイリング
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]

      // 透明ではなく、かつ白でもない（線画）
      const isDrawing = a > 15 && (r < 210 || g < 210 || b < 210)
      if (isDrawing) {
        colDensity[x]++
        rowDensity[y]++
      }
    }
  }

  // 2. 孤立した直線（図枠）を確実に排除する判定関数
  const isIsolatedLineX = (x) => {
    if (colDensity[x] < 3) return true
    let surroundingInk = 0
    for (let offset = -15; offset <= 15; offset++) {
      if (offset === 0) continue
      const targetX = x + offset
      if (targetX >= 0 && targetX < w) {
        surroundingInk += colDensity[targetX]
      }
    }
    return surroundingInk < (h * 0.06)
  }

  const isIsolatedLineY = (y) => {
    if (rowDensity[y] < 3) return true
    let surroundingInk = 0
    for (let offset = -15; offset <= 15; offset++) {
      if (offset === 0) continue
      const targetY = y + offset
      if (targetY >= 0 && targetY < h) {
        surroundingInk += rowDensity[targetY]
      }
    }
    return surroundingInk < (w * 0.06)
  }

  const minColInk = Math.max(3, Math.floor(h * 0.006))
  const minRowInk = Math.max(3, Math.floor(w * 0.006))

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let found = false

  for (let x = 0; x < w; x++) {
    if (colDensity[x] >= minColInk && !isIsolatedLineX(x)) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      found = true
    }
  }

  for (let y = 0; y < h; y++) {
    if (rowDensity[y] >= minRowInk && !isIsolatedLineY(y)) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      found = true
    }
  }

  // 要素が見つからなければ、安全のため元のキャンバスをそのまま返す
  if (!found || maxX <= minX || maxY <= minY) return canvas

  // 周囲に少しマージン（例：8px）を付加する
  const margin = 8
  minX = Math.max(0, minX - margin)
  minY = Math.max(0, minY - margin)
  maxX = Math.min(w - 1, maxX + margin)
  maxY = Math.min(h - 1, maxY + margin)

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1

  const newCanvas = document.createElement('canvas')
  newCanvas.width = cropW
  newCanvas.height = cropH
  const newCtx = newCanvas.getContext('2d')
  newCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

  return newCanvas
}

/**
 * 平面図の建物エリアを多角形（ピン打ち）でざっくり囲って切り抜くモーダルコンポーネント。
 * 用紙枠や余白を完全に除外し、部屋の領域を大きく拡大してトレースしやすくします。
 */
export default function PlanCropper({ imageUrl, onCancel, onApply }) {
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [points, setPoints] = useState([]) // [{x, y}] 正規化座標リスト
  const [closed, setClosed] = useState(false)
  const [hover, setHover] = useState(null) // {x, y} ホバー中の正規化座標
  const [isHoveringStart, setIsHoveringStart] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showGuide, setShowGuide] = useState(true)

  // 表示サイズ追従
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
  }, [imageUrl])

  const { w, h } = size

  const toNorm = (clientX, clientY) => {
    const r = wrapRef.current.getBoundingClientRect()
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    }
  }

  // 最初のピン（始点）の近くか判定（判定距離：14px）
  const checkStartHover = (p) => {
    if (points.length < 3) return false
    const start = points[0]
    const dx = (start.x - p.x) * w
    const dy = (start.y - p.y) * h
    return Math.hypot(dx, dy) < 14
  }

  const onMouseMove = (e) => {
    if (closed) return
    const p = toNorm(e.clientX, e.clientY)
    setHover(p)
    setIsHoveringStart(checkStartHover(p))
  }

  const onClick = (e) => {
    if (closed) return
    const p = toNorm(e.clientX, e.clientY)

    if (checkStartHover(p)) {
      setClosed(true)
      setIsHoveringStart(false)
    } else {
      setPoints((prev) => [...prev, p])
    }
  }

  const handleApply = () => {
    if (points.length < 3) return
    const imgEl = imgRef.current
    if (!imgEl) return
    setBusy(true)

    try {
      const nw = imgEl.naturalWidth
      const nh = imgEl.naturalHeight

      if (!nw || !nh) {
        throw new Error('画像の元サイズが取得できません。画像の読み込みが完了するまでお待ちください。')
      }

      // バウンディングボックスの計算
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)

      const pw = maxX - minX
      const ph = maxY - minY

      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(pw * nw))
      c.height = Math.max(1, Math.round(ph * nh))

      const ctx = c.getContext('2d')

      // 多角形パスでクリッピングを設定
      ctx.beginPath()
      ctx.moveTo((points[0].x - minX) * nw, (points[0].y - minY) * nh)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo((points[i].x - minX) * nw, (points[i].y - minY) * nh)
      }
      ctx.closePath()
      ctx.clip()

      // 切り抜いた領域の画像を描画
      ctx.drawImage(imgEl, minX * nw, minY * nh, pw * nw, ph * nh, 0, 0, c.width, c.height)

      // 自動余白カットを適用
      const croppedCanvas = autoCropCanvas(c)

      const dataUrl = croppedCanvas.toDataURL('image/png')
      onApply(dataUrl)
      setBusy(false)
    } catch (err) {
      console.error('PlanCropper error:', err)
      alert('トリミング処理中にエラーが発生しました: ' + err.message)
      setBusy(false)
    }
  }

  const handleReset = () => {
    setPoints([])
    setClosed(false)
    setHover(null)
    setIsHoveringStart(false)
  }

  const canApply = points.length >= 3

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-ink-950/95 backdrop-blur">
      {/* 部屋のざっくり切り出しガイダンスモーダル */}
      {showGuide && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-ink-950/80 p-5 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-400/10 text-accent-400">
                <Crop size={24} />
              </div>
              <h3 className="mb-2 text-base font-bold text-zinc-100">
                📐 平面図の有効エリアを指定してください
              </h3>
              <p className="mb-6 text-xs leading-relaxed text-zinc-400 text-left">
                図面の余白や用紙の枠線などを除外し、AIの立体パース生成を正確に行うための重要なトリミング手順です。
                <br /><br />
                <span className="font-bold text-accent-300">【操作手順】</span>
                <br />
                1. 実際の建物（部屋）の角を順にクリックしてピンを置いていきます。
                <br />
                2. 始点（最初のピン）をクリックすると、パスが閉じて確定されます。
                <br />
                3. パスを閉じた後、右上の「確定して進む」をクリックします。
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full rounded-lg bg-accent-400 py-2.5 text-xs font-semibold text-ink-950 hover:bg-accent-300 transition-colors shadow-lg shadow-accent-400/10"
              >
                操作手順を理解しました
              </button>
            </div>
          </div>
        </div>
      )}
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Crop size={18} className="text-accent-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">図面部分をざっくり指定（多角形パス）</h2>
            <p className="text-xs text-zinc-500">
              用紙枠や周囲の余白を省くため、実際の建物（部屋）の角を順にクリックしてピンを置き、始点（最初のピン）をクリックして閉じてください
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.07] transition-colors"
          >
            キャンセル
          </button>
          <button
            disabled={!canApply || busy}
            onClick={handleApply}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
              canApply && !busy
                ? 'bg-accent-400 text-ink-950 hover:bg-accent-300'
                : 'cursor-not-allowed border border-white/8 bg-white/[0.01] text-zinc-600',
            ].join(' ')}
          >
            {busy ? (
              <>
                <Loader2 size={13} className="animate-spin" /> 切り抜き中…
              </>
            ) : (
              <>
                <Check size={13} /> 確定して進む
              </>
            )}
          </button>
        </div>
      </div>

      {/* canvas body */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div ref={wrapRef} className="relative inline-block leading-none">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="平面図トリミング元画像"
            className="block max-h-[70vh] max-w-[75vw] select-none rounded-lg bg-white shadow-2xl"
            draggable={false}
          />
          <svg
            width={w}
            height={h}
            className="absolute inset-0 cursor-crosshair"
            onClick={onClick}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHover(null)}
          >
            {/* 描画済みの線 */}
            {points.length > 1 && (
              <polyline
                points={points.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
                fill="none"
                stroke="var(--color-accent-400)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 閉多角形時の最初の点と最後の点を結ぶ線 */}
            {closed && points.length > 2 && (
              <line
                x1={points[points.length - 1].x * w}
                y1={points[points.length - 1].y * h}
                x2={points[0].x * w}
                y2={points[0].y * h}
                stroke="var(--color-accent-400)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* ガイド線（ホバー位置と最後のピンを結ぶ） */}
            {!closed && points.length > 0 && hover && (
              <line
                x1={points[points.length - 1].x * w}
                y1={points[points.length - 1].y * h}
                x2={hover.x * w}
                y2={hover.y * h}
                stroke="var(--color-accent-300)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}

            {/* 各ピンの描画 */}
            {points.map((p, idx) => {
              const isStart = idx === 0
              const showHoverHighlight = isStart && isHoveringStart
              return (
                <g key={idx}>
                  <circle
                    cx={p.x * w}
                    cy={p.y * h}
                    r={isStart ? 6 : 4}
                    fill={isStart ? 'var(--color-accent-400)' : '#0e0f12'}
                    stroke="var(--color-accent-400)"
                    strokeWidth="1.5"
                    className="transition-transform duration-150"
                    style={{ transform: showHoverHighlight ? 'scale(1.4)' : 'scale(1)', transformOrigin: `${p.x * w}px ${p.y * h}px` }}
                  />
                  {isStart && (
                    <circle
                      cx={p.x * w}
                      cy={p.y * h}
                      r="10"
                      fill="transparent"
                      stroke={showHoverHighlight ? 'var(--color-accent-300)' : 'transparent'}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      className="animate-spin-slow"
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* footer status & reset */}
      <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-ink-950/60 px-5 py-3 text-xs">
        <span className="text-zinc-500">
          {closed
            ? 'パスが閉じました。[確定して進む] を押して切り抜いてください。'
            : points.length === 0
              ? '平面図上の建物の角をクリックしてピンを打ってください。'
              : points.length < 3
                ? `あと ${3 - points.length} 点以上ピンを打つと多角形として切り出せます。`
                : '始点（最初のピン）をクリックして閉じるか、[確定して進む] をクリックします。'}
        </span>
        {points.length > 0 && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <RefreshCw size={12} /> ピンを引き直す
          </button>
        )}
      </div>
    </div>
  )
}
