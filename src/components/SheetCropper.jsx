import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cropPolygonToDataUrl } from '../lib/crop.js'
import {
  Check,
  Clipboard,
  FileText,
  ImageUp,
  Loader2,
  Plus,
  Scissors,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react'
import { isPdf, renderPdfToImages, mmPerPxFrom, SCALE_PRESETS } from '../lib/pdf.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// 割り当て先の既定（壁が未認識のときのフォールバック）
const DEFAULT_FACES = [
  { key: 'center', label: '平面図' },
  { key: 'top', label: 'A面' },
  { key: 'bottom', label: 'B面' },
  { key: 'left', label: 'C面' },
  { key: 'right', label: 'D面' },
]

/**
 * 展開図シート（PDF / 画像・複数ページ可）を読み込み、各面をドラッグで囲って割り当てるツール。
 * targets で割り当て先（認識した壁）を渡す。縮尺はページごとに指定できる。
 * 切り出しは canvas でクライアント完結（元解像度を保持）。CAD不要。
 */
export default function SheetCropper({
  initialSheets,
  targets,
  onCancel,
  onApply,
  isInline = false,
  selectedWall = null,
  onActiveRectChange = null,
  onDragCropStart,
  onDragCropEnd,
}) {
  const FACES = targets?.length ? targets : DEFAULT_FACES
  const [pages, setPages] = useState(initialSheets?.length ? initialSheets : [])
  const [active, setActive] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [naturals, setNaturals] = useState({}) // page index -> HTMLImageElement（元解像度）
  const [busy, setBusy] = useState(false)
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [rects, setRects] = useState([]) // {id, points, face, page}
  const [draft, setDraft] = useState(null) // {points}
  const [draftImgUrl, setDraftImgUrl] = useState(null) // ドラッグマッピング用プレビュー
  const [points, setPoints] = useState([]) // 現在描画中の多角形頂点
  const [closed, setClosed] = useState(false)
  const [hover, setHover] = useState(null)
  const [isHoveringStart, setIsHoveringStart] = useState(false)
  const [pageScales, setPageScales] = useState({}) // pageIndex -> 縮尺の分母（ページごと）

  // selectedWall または draft が変化した際、双方に値があるなら即座に自動割り当て（ペアリング）
  useEffect(() => {
    if (!selectedWall || !draft) return
    
    // 現在の draft 座標を selectedWall (faceKey) に割り当てる
    assign(selectedWall)
    
    // 割り当て後、親に割り当て完了（アクティブ枠クリア）を伝える
    if (onActiveRectChange) {
      onActiveRectChange(false)
    }
  }, [selectedWall, draft])

  // draft状態（切り出し枠のアクティブ状態）が変化したときに親に通知
  useEffect(() => {
    if (onActiveRectChange) {
      onActiveRectChange(!!draft)
    }
  }, [draft, onActiveRectChange])

  // initialSheets の変更を pages 状態へ同期
  useEffect(() => {
    if (initialSheets?.length) {
      setPages(initialSheets)
    } else {
      setPages([])
    }
  }, [initialSheets])

  const inlineMode = isInline && !isExpanded
  const page = pages[active] ?? null
  const sheet = page?.url ?? null

  // 元解像度の画像を（切り出し用に）ロード
  useEffect(() => {
    pages.forEach((p, i) => {
      if (naturals[i]) return
      const im = new Image()
      im.onload = () => setNaturals((n) => ({ ...n, [i]: im }))
      im.src = p.url
    })
  }, [pages]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [sheet, active])

  const applyWithData = async (nextPages, nextRects) => {
    setBusy(true)
    try {
      const out = {}
      const scales = {}
      const facePages = {}
      FACES.forEach((f) => {
        out[f.key] = null
        scales[f.key] = null
        facePages[f.key] = null
      })
      for (const r of nextRects) {
        const pageObj = nextPages[r.page]
        if (!pageObj) continue
        const url = await cropPolygonToDataUrl(pageObj.url, r.points, 12)
        if (!url) continue
        out[r.face] = url
        scales[r.face] = mmPerPxFrom(pageObj?.ptPerPx, pageScales[r.page] ?? null)
        facePages[r.face] = r.page
      }
      onApply(out, nextPages, scales, facePages)
    } catch (e) {
      console.error('Error in applyWithData:', e)
    } finally {
      setBusy(false)
    }
  }

  const removePage = (idx) => {
    const newPages = pages.filter((_, i) => i !== idx)
    const newRects = rects
      .filter((r) => r.page !== idx)
      .map((r) => {
        if (r.page > idx) {
          return { ...r, page: r.page - 1 }
        }
        return r
      })
    let newActive = active
    if (active >= newPages.length) {
      newActive = Math.max(0, newPages.length - 1)
    }
    
    // Shift naturals keys to align with new indices
    setNaturals((prev) => {
      const next = {}
      let nextIdx = 0
      for (let i = 0; i < pages.length; i++) {
        if (i !== idx) {
          if (prev[i]) {
            next[nextIdx] = prev[i]
          }
          nextIdx++
        }
      }
      return next
    })

    setPages(newPages)
    setRects(newRects)
    setActive(newActive)
    applyWithData(newPages, newRects)
  }

  // ファイル/PDFを読み込んでページとして追加
  const loadFiles = async (fileList) => {
    const files = [...(fileList || [])].filter(
      (f) => f && (isPdf(f) || f.type.startsWith('image/')),
    )
    if (!files.length) return
    setBusy(true)
    try {
      const added = []
      for (const f of files) {
        if (isPdf(f)) {
          const imgs = await renderPdfToImages(f)
          added.push(...imgs)
        } else {
          added.push({ url: URL.createObjectURL(f) })
        }
      }
      setPages((prev) => {
        const next = [...prev, ...added]
        if (prev.length === 0) setActive(0)
        else setActive(prev.length) // 追加した先頭ページへ
        
        // 親の sheets 状態を即時リアルタイム同期し、自動紐づけボタンの無効化を解除！
        setTimeout(() => {
          onApply({}, next, {}, {})
        }, 10)
        
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  // クリップボード貼り付け（画像 / PDF）
  useEffect(() => {
    const onPaste = (e) => {
      const items = [...(e.clipboardData?.items || [])]
      const file = items.map((i) => i.getAsFile?.()).find((f) => f && (isPdf(f) || f.type.startsWith('image/')))
      if (file) loadFiles([file])
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toNorm = (clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect()
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }
  }

  const checkStartHover = (p) => {
    if (points.length < 3) return false
    const start = points[0]
    const dx = (start.x - p.x) * size.w
    const dy = (start.y - p.y) * size.h
    return Math.hypot(dx, dy) < 14
  }

  const fitPointsToContent = (pts) => {
    return new Promise((resolve) => {
      const nat = naturals[active]
      if (!nat || !pts || pts.length < 3) {
        resolve(pts)
        return
      }
      
      try {
        const w = nat.naturalWidth
        const h = nat.naturalHeight
        
        // ユーザーが囲んだ多角形のバウンディングボックス（ピクセル単位）
        const pxPoints = pts.map((p) => ({ x: p.x * w, y: p.y * h }))
        const xs = pxPoints.map((p) => p.x)
        const ys = pxPoints.map((p) => p.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        
        const boxW = Math.max(1, maxX - minX)
        const boxH = Math.max(1, maxY - minY)
        
        // 一時的にその領域を描描してピクセル監査するための Canvas
        const canvas = document.createElement('canvas')
        canvas.width = boxW
        canvas.height = boxH
        const ctx = canvas.getContext('2d')
        
        // 多角形クリップで描画
        ctx.beginPath()
        ctx.moveTo(pxPoints[0].x - minX, pxPoints[0].y - minY)
        for (let i = 1; i < pxPoints.length; i++) {
          ctx.lineTo(pxPoints[i].x - minX, pxPoints[i].y - minY)
        }
        ctx.closePath()
        ctx.clip()
        
        ctx.drawImage(nat, minX, minY, boxW, boxH, 0, 0, boxW, boxH)
        
        const imgData = ctx.getImageData(0, 0, boxW, boxH)
        const data = imgData.data
        
        let minPX = boxW
        let maxPX = 0
        let minPY = boxH
        let maxPY = 0
        
        const bgThreshold = 205
        const marginX = Math.max(1, Math.floor(boxW * 0.015))
        const marginY = Math.max(1, Math.floor(boxH * 0.015))
        
        for (let y = marginY; y < boxH - marginY; y++) {
          for (let x = marginX; x < boxW - marginX; x++) {
            const idx = (y * boxW + x) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const a = data[idx + 3]
            
            const isWhite = r > bgThreshold && g > bgThreshold && b > bgThreshold
            const isTransparent = a < 40
            
            if (!isWhite && !isTransparent) {
              if (x < minPX) minPX = x
              if (x > maxPX) maxPX = x
              if (y < minPY) minPY = y
              if (y > maxPY) maxPY = y
            }
          }
        }
        
        // インク（コンテンツ）が正常に検出できた場合は、囲みパス自体をその矩形（4点）に収縮して置換！！！
        if (maxPX > minPX && maxPY > minPY) {
          const finalPadding = 6
          
          // 元画像のピクセル座標系での最終コンテンツ矩形
          const finalMinX = Math.max(0, minX + minPX - finalPadding)
          const finalMaxX = Math.min(w, minX + maxPX + finalPadding)
          const finalMinY = Math.max(0, minY + minPY - finalPadding)
          const finalMaxY = Math.min(h, minY + maxPY + finalPadding)
          
          // 正規化された (0..1) 座標系の 4頂点 (左上, 右上, 右下, 左下)
          const fittedPts = [
            { x: finalMinX / w, y: finalMinY / h }, // 左上
            { x: finalMaxX / w, y: finalMinY / h }, // 右上
            { x: finalMaxX / w, y: finalMaxY / h }, // 右下
            { x: finalMinX / w, y: finalMaxY / h }  // 左下
          ]
          
          console.log("points snapped to detected content bounds on UI!")
          resolve(fittedPts)
          return
        }
      } catch (e) {
        console.error("Error fitting points on client side:", e)
      }
      
      resolve(pts)
    })
  }

  const onPointerDown = (e) => {
    if (closed) return
    const p = toNorm(e.clientX, e.clientY)

    if (checkStartHover(p)) {
      setClosed(true)
      setIsHoveringStart(false)
      
      // ユーザーが閉じた多角形パス（points）を、インク要素に合わせて自動で矩形スナップ変形！
      fitPointsToContent(points).then(async (fittedPoints) => {
        const draftData = { points: fittedPoints }
        
        if (FACES.length === 1) {
          const faceKey = FACES[0].key
          const rect = { id: Date.now(), points: fittedPoints, face: faceKey, page: active }
          setRects((prev) => [...prev.filter((r) => r.face !== faceKey), rect])
          setPoints([])
          setClosed(false)
          setHover(null)
          
          // リアルタイム自動適用も実行
          const nextRects = [...rects.filter((r) => r.face !== faceKey), rect]
          autoApplyCrops(nextRects)
        } else {
          setDraft(draftData)
          // ドラッグマッピング用に、切り出し矩形のプレビューデータURLを先行生成
          const nat = naturals[active]
          if (nat) {
            const url = await cropPolygonToDataUrl(nat.src, fittedPoints, 12)
            setDraftImgUrl(url)
          }
        }
      })
    } else {
      setPoints((prev) => [...prev, p])
    }
  }

  const onPointerMove = (e) => {
    if (closed) return
    const p = toNorm(e.clientX, e.clientY)
    setHover(p)
    setIsHoveringStart(checkStartHover(p))
  }

  const autoApplyCrops = async (currentRects) => {
    setBusy(true)
    try {
      const out = {}
      const scales = {}
      const facePages = {}
      for (const r of currentRects) {
        const nat = naturals[r.page]
        if (!nat) continue
        const dataUrl = await cropPolygonToDataUrl(nat.src, r.points, 12)
        out[r.face] = dataUrl
        scales[r.face] = mmPerPxFrom(pages[r.page]?.ptPerPx, pageScales[r.page])
        facePages[r.face] = r.page
      }
      onApply(out, pages, scales, facePages)
    } catch (e) {
      console.error('Error auto applying crops:', e)
    } finally {
      setBusy(false)
    }
  }

  const assign = (faceKey) => {
    if (!draft) return
    const rect = { id: Date.now(), points: draft.points, face: faceKey, page: active }
    const nextRects = [...rects.filter((r) => r.face !== faceKey), rect]
    setRects(nextRects)
    setDraft(null)
    setDraftImgUrl(null)
    setPoints([])
    setClosed(false)
    setHover(null)
    
    // 切り出しと割り当て完了時に即座に親へリアルタイム自動反映！
    autoApplyCrops(nextRects)
  }
  
  const resetDraft = () => {
    setDraft(null)
    setDraftImgUrl(null)
    setPoints([])
    setClosed(false)
    setHover(null)
  }

  const removeRect = (id) => {
    const nextRects = rects.filter((r) => r.id !== id)
    setRects(nextRects)
    
    // 削除時も即座に親へリアルタイム自動反映！
    autoApplyCrops(nextRects)
  }

  const cropToDataUrl = async (r) => {
    const nat = naturals[r.page]
    if (!nat) return null
    return await cropPolygonToDataUrl(nat.src, r.points, 12)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const out = {}
      const scales = {}
      const facePages = {}
      for (const r of rects) {
        const url = await cropToDataUrl(r)
        if (!url) continue
        out[r.face] = url
        scales[r.face] = mmPerPxFrom(pages[r.page]?.ptPerPx, pageScales[r.page])
        facePages[r.face] = r.page
      }
      onApply(out, pages, scales, facePages)
      setIsExpanded(false)
    } catch (e) {
      console.error('Error applying crops:', e)
    } finally {
      setBusy(false)
    }
  }

  const { w, h } = size
  const assignedFaces = new Set(rects.map((r) => r.face))
  const pageRects = rects.filter((r) => r.page === active)

  return (
    <div className={inlineMode ? "flex flex-col h-full w-full bg-ink-950/20 rounded-xl overflow-hidden border border-white/5 min-h-[500px]" : "fixed inset-0 z-[100] flex flex-col bg-ink-950/95 backdrop-blur"}>
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Scissors size={17} className="text-accent-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">展開図シートから切り出し</h2>
            <p className="text-xs text-zinc-500">
              PDF / 画像を読み込み、各面を点クリック（多角形パス）で囲って割り当て（CADでバラす必要なし）
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {page?.ptPerPx && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              縮尺{pages.length > 1 ? `(P.${active + 1})` : ''}
              <select
                value={pageScales[active] ?? ''}
                onChange={(e) =>
                  setPageScales((s) => ({ ...s, [active]: e.target.value ? Number(e.target.value) : null }))
                }
                className="rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-accent-400/50"
              >
                <option value="">未指定</option>
                {SCALE_PRESETS.map((s) => (
                  <option key={s.R} value={s.R}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {pages.length > 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.07]"
            >
              <Plus size={13} /> PDF/画像を追加
            </button>
          )}
          {isInline && (
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              title={isExpanded ? "通常表示に戻す" : "全画面に拡大して切り出す"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.07]"
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {isExpanded ? "通常表示" : "全画面で切り出し"}
            </button>
          )}
          {!inlineMode && (
            <button
              onClick={() => {
                if (isExpanded) setIsExpanded(false)
                else onCancel()
              }}
              className="text-zinc-400 hover:text-zinc-100"
              aria-label="閉じる"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => loadFiles(e.target.files)}
      />

      {/* body */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        {!sheet ? (
          /* ---- シート読み込み ---- */
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              loadFiles(e.dataTransfer.files)
            }}
            className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.015] px-8 py-16 text-center"
          >
            {busy ? (
              <Loader2 size={40} className="animate-spin text-accent-400" strokeWidth={1.4} />
            ) : (
              <ImageUp size={40} className="text-zinc-500" strokeWidth={1.4} />
            )}
            <div>
              <p className="text-base font-medium text-zinc-200">
                {busy ? 'PDFを読み込み中…' : '展開図シートを読み込む'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                PDF・画像をドラッグ＆ドロップ、またはクリックして選択
              </p>
            </div>
            {!busy && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-300"
                >
                  <FileText size={15} /> PDF / 画像を選択
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-300">
                  <Clipboard size={15} /> ⌘V / Ctrl+V で貼り付け
                </span>
              </div>
            )}
          </div>
        ) : (
          /* ---- 切り出しキャンバス ---- */
          <div ref={wrapRef} className="relative inline-block leading-none">
            <img
              ref={imgRef}
              src={sheet}
              alt="展開図シート"
              className="block max-h-[58vh] max-w-[62vw] select-none rounded-lg bg-white"
              draggable={false}
            />
            <svg
              width={w}
              height={h}
              className="absolute inset-0 cursor-crosshair z-10"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onMouseLeave={() => setHover(null)}
            >
              {/* 描画済みの確定した多角形 */}
              {pageRects.map((r) => {
                const polyPoints = r.points.map((p) => `${p.x * w},${p.y * h}`).join(' ')
                const xs = r.points.map((p) => p.x)
                const ys = r.points.map((p) => p.y)
                const minX = Math.min(...xs)
                const minY = Math.min(...ys)
                const maxX = Math.max(...xs)
                const maxY = Math.max(...ys)
                const mx = minX + (maxX - minX) / 2
                const my = minY + (maxY - minY) / 2
                
                const label = FACES.find((f) => f.key === r.face)?.label
                return (
                  <g key={r.id}>
                    <polygon
                      points={polyPoints}
                      className="stroke-accent-400 stroke-2 fill-accent-400/20"
                    />
                    <foreignObject
                      x={mx * w - 30}
                      y={my * h - 14}
                      width="60"
                      height="28"
                      className="overflow-visible"
                    >
                      <div className="flex items-center gap-1 bg-ink-950 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-350 ring-1 ring-white/15 rounded shadow-lg">
                        <span>{label}</span>
                        <button
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            removeRect(r.id)
                          }}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </foreignObject>
                  </g>
                )
              })}

              {/* 描画中のドラフト多角形 */}
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

              {/* 多角形を閉じる線 */}
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

              {/* マウスガイド線 */}
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
                      style={{
                        transform: showHoverHighlight ? 'scale(1.4)' : 'scale(1)',
                        transformOrigin: `${p.x * w}px ${p.y * h}px`,
                      }}
                    />
                  </g>
                )
              })}
            </svg>

            {/* 平面図直接選択ガイダンスピッカー */}
            {draft && (
              (() => {
                const xs = draft.points.map(p => p.x)
                const ys = draft.points.map(p => p.y)
                const minX = Math.min(...xs)
                const minY = Math.min(...ys)
                const maxX = Math.max(...xs)
                const maxY = Math.max(...ys)
                const midX = minX + (maxX - minX) / 2
                
                return (
                  <div
                    className="absolute z-50 flex flex-col gap-2 rounded-lg border border-accent-400/40 bg-ink-950/95 px-3 py-2 shadow-2xl animate-pulse"
                    style={{
                      left: Math.min(midX * w - 120, Math.max(0, w - 250)),
                      top: Math.min(maxY * h + 10, Math.max(0, h - 90)),
                      width: '240px'
                    }}
                  >
                    <span className="text-[10px] text-accent-300 font-bold flex items-center gap-1">
                      <Sparkles size={10} className="animate-spin text-accent-400" /> 切り出し枠が確定しました！
                    </span>

                    {/* ドラッグ可能な切り出しサムネイル */}
                    {draftImgUrl && (
                      <div className="flex flex-col items-center justify-center p-1.5 border border-white/10 rounded-md bg-black/45 shadow-inner">
                        <img
                          src={draftImgUrl}
                          alt="Drag to map"
                          draggable="true"
                          onDragStart={(e) => {
                            const dragData = {
                              type: 'elevation_crop',
                              image: draftImgUrl,
                              points: draft.points,
                              page: active
                            }
                            e.dataTransfer.setData('application/json', JSON.stringify(dragData))
                            e.dataTransfer.effectAllowed = 'copy'
                            onDragCropStart?.(dragData)
                          }}
                          onDragEnd={() => {
                            onDragCropEnd?.()
                          }}
                          className="h-14 max-w-full object-contain rounded border border-accent-400/50 cursor-grab active:cursor-grabbing hover:border-accent-400 transition-all transform hover:scale-105"
                        />
                        <span className="text-[8px] text-accent-400 mt-1 font-semibold animate-pulse">
                          👆 この画像を壁バッジへドラッグ＆ドロップ！
                        </span>
                      </div>
                    )}

                    <span className="text-[9px] text-zinc-355 leading-tight">
                      または、左側の平面図の<strong className="text-accent-400">「A面〜D面の壁（バッジ）」を直接クリック</strong>して紐づけます。
                    </span>
                    <button
                      onClick={resetDraft}
                      className="mt-1 self-end text-[9px] text-zinc-500 hover:text-zinc-300 underline pointer-events-auto"
                    >
                      キャンセル
                    </button>
                  </div>
                )
              })()
            )}
          </div>
        )}
      </div>

      {/* page strip (multi-page) */}
      {pages.length > 0 && (
        <div className="thin-scroll flex shrink-0 items-center gap-2 overflow-x-auto border-t border-white/10 px-5 py-2.5">
          <span className="shrink-0 text-xs text-zinc-500">ページ:</span>
          {pages.map((p, i) => {
            const count = rects.filter((r) => r.page === i).length
            return (
              <div key={i} className="relative group shrink-0">
                <button
                  onClick={() => setActive(i)}
                  className={[
                    'relative h-14 w-11 shrink-0 overflow-hidden rounded-md border bg-white transition-all block',
                    i === active ? 'border-accent-400 ring-2 ring-accent-400/40' : 'border-white/15 hover:border-white/35',
                  ].join(' ')}
                  title={`ページ ${i + 1}`}
                >
                  <img src={p.url} alt={`P${i + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 bg-ink-950/80 px-1 text-[9px] text-zinc-100">
                    {i + 1}
                  </span>
                  {count > 0 && (
                    <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl-md bg-accent-400 text-[9px] font-bold text-ink-950">
                      {count}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removePage(i)
                  }}
                  className="absolute -top-1.5 -right-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-colors pointer-events-auto cursor-pointer"
                  title="ページを削除"
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* footer */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Scissors size={13} className="text-accent-400" />
          {sheet
            ? `${rects.length}面を割り当て済み（${
                FACES.filter((f) => assignedFaces.has(f.key)).map((f) => f.label).join('・') || 'なし'
              }）`
            : 'シート未読み込み'}
        </div>
        <div className="flex items-center gap-2">
          {sheet && (
            <button
              onClick={() => {
                setRects([])
                setDraft(null)
              }}
              disabled={rects.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 hover:bg-white/[0.07] disabled:opacity-40"
            >
              <Trash2 size={14} /> クリア
            </button>
          )}
          {!inlineMode && (
            <button
              onClick={() => {
                if (isExpanded) setIsExpanded(false)
                else onCancel()
              }}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              {isExpanded ? '閉じる' : 'キャンセル'}
            </button>
          )}
          <button
            onClick={apply}
            disabled={rects.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
          >
            <Check size={15} /> {isInline ? '切り出しを壁に適用' : '各面に割り当てて適用'}
          </button>
        </div>
      </div>
    </div>
  )
}
