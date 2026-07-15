import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, Check, PlusSquare, RefreshCw, Ruler, Scissors } from 'lucide-react'
import { wallLengthLabel, wallChar, wallLabel } from '../lib/walls.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/**
 * 平面図の上に認識した壁を番号・視線矢印つきで表示し、
 * 各壁に展開図をアップロードする。ふかし壁/柱は線を引いて追加できる。
 */
export default function WallMapper({
  plan,
  walls,
  selected,
  onSelect,
  onWallFile,
  onWallRemove,
  onAddCustom,
  onFlip,
  onCrop,
  isAssigning = false,
  isAnalyzingPlan = false,
  planScanRect = null,
  onMaterialFile,
  draggedCrop,
}) {
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const containerRef = useRef(null) // パン・ズーム用のコンテナ参照
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [drawMode, setDrawMode] = useState(false)
  const [draftPoints, setDraftPoints] = useState([])
  const [hover, setHover] = useState(null)
  const [scanStyle, setScanStyle] = useState({ left: '0%', top: '0%', width: '100%', height: '100%' })
  const [dragOverWallId, setDragOverWallId] = useState(null)

  // ユーザーのパン＆ズーム状態
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0 })
  
  useEffect(() => {
    if (isAnalyzingPlan && planScanRect) {
      const t = setTimeout(() => {
        setScanStyle({
          left: `${planScanRect.x * 100}%`,
          top: `${planScanRect.y * 100}%`,
          width: `${planScanRect.w * 100}%`,
          height: `${planScanRect.h * 100}%`
        })
      }, 50)
      return () => clearTimeout(t)
    } else {
      setScanStyle({ left: '0%', top: '0%', width: '100%', height: '100%' })
    }
  }, [isAnalyzingPlan, planScanRect])

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
  }, [plan])

  // マウスホイールでのズーム制御 (Reactのpassiveイベント回避のためuseEffectで登録)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e) => {
      e.preventDefault()
      const factor = 1.15
      setZoom((prev) => {
        if (e.deltaY < 0) {
          return Math.min(5.0, prev * factor)
        } else {
          return Math.max(0.3, prev / factor)
        }
      })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // ドラッグ（パン）のイベントハンドラ
  const onMouseDown = (e) => {
    if (drawMode) return // トレースモード時はパンさせない
    setIsPanning(true)
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const onMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      })
    }
  }

  const onMouseUp = () => setIsPanning(false)
  const onMouseLeave = () => setIsPanning(false)

  const zoomStyle = useMemo(() => {
    if (!walls || walls.length === 0) {
      return {
        transform: 'scale(1) translate(0px, 0px)',
        transformOrigin: 'center center',
        transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
      }
    }

    const xs = walls.flatMap((w) => w.points.map((p) => p.x))
    const ys = walls.flatMap((w) => w.points.map((p) => p.y))
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const pW = maxX - minX
    const pH = maxY - minY
    const midX = minX + pW / 2
    const midY = minY + pH / 2

    // 画面の 80% 程度まで拡大率を抑え、余白を適切に確保する
    const targetScale = Math.min(3.0, Math.max(1, Math.min(0.80 / (pW || 1), 0.80 / (pH || 1))))
    
    // 中心からのズレをパーセントに換算（画像コンテナの移動用）
    const tx = (0.5 - midX) * 100
    const ty = (0.5 - midY) * 100

    return {
      transform: `scale(${targetScale}) translate(${tx}%, ${ty}%)`,
      transformOrigin: 'center center',
      transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
    }
  }, [walls])

  // ユーザーのパン＆ズームと、壁追従オートズームをマージ
  const combinedStyle = useMemo(() => {
    const scaleRegex = /scale\(([^)]+)\)/
    const translateRegex = /translate\(([^)]+)\)/
    
    const scaleMatch = zoomStyle.transform.match(scaleRegex)
    const translateMatch = zoomStyle.transform.match(translateRegex)
    
    const baseScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1.0
    const baseTranslate = translateMatch ? translateMatch[1] : '0px, 0px'
    
    const finalScale = baseScale * zoom
    
    return {
      ...zoomStyle,
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${finalScale}) translate(${baseTranslate})`,
      transition: isPanning ? 'none' : 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
    }
  }, [zoomStyle, zoom, pan, isPanning])

  const { w, h } = size
  const toNorm = (cx, cy) => {
    const r = wrapRef.current.getBoundingClientRect()
    // ズーム中は getBoundingClientRect() のサイズが変化するため、
    // マウス位置から正規化座標を計算する際は transform の影響を除外する必要がある。
    // そのため、コンテナの実際のクライアントサイズに対するオフセットから計算する。
    const wrapEl = wrapRef.current
    const rect = wrapEl.getBoundingClientRect()
    // コンテナの中心を基準にしたズーム比率から正確に逆算
    const mouseX = cx - rect.left
    const mouseY = cy - rect.top
    return { x: clamp01(mouseX / rect.width), y: clamp01(mouseY / rect.height) }
  }

  const onClick = (e) => {
    if (!drawMode) return
    const p = toNorm(e.clientX, e.clientY)
    setDraftPoints((prev) => [...prev, p])
  }

  const onDoubleClick = (e) => {
    if (!drawMode || draftPoints.length < 2) return
    e.stopPropagation()
    onAddCustom(draftPoints)
    setDraftPoints([])
    setDrawMode(false)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!drawMode) return
      if (e.key === 'Enter') {
        if (draftPoints.length >= 2) {
          onAddCustom(draftPoints)
          setDraftPoints([])
          setDrawMode(false)
        }
      } else if (e.key === 'Escape') {
        setDraftPoints([])
        setDrawMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawMode, draftPoints, onAddCustom])

  return (
    <div className="flex h-full flex-col">
      {/* plan with wall overlay */}
      <div 
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 select-none ${drawMode ? '' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div ref={wrapRef} style={combinedStyle} className="relative inline-block leading-none">
          <img
            ref={imgRef}
            src={plan}
            alt="平面図"
            className="block max-h-[52vh] max-w-full select-none rounded-lg"
            draggable={false}
          />
          
          {/* 壁追加モード時の目立つ操作指示バナー */}
          {drawMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border-2 border-accent-400 bg-ink-950/95 px-4 py-2.5 text-[11px] font-bold text-zinc-100 shadow-[0_0_20px_rgba(250,204,21,0.2)] backdrop-blur-md animate-pulse whitespace-nowrap">
              <span className="flex h-2 w-2 rounded-full bg-accent-400 animate-ping" />
              👉 平面図の上をクリックして、<strong className="text-accent-400">対象となる壁を選択（トレース）してください。</strong>完了はダブルクリックまたは確定ボタン。
            </div>
          )}
          
          {/* AIスキャン収縮・余白排除のビジュアル演出 */}
          {isAnalyzingPlan && planScanRect && (
            <div
              className="absolute border-[3px] border-[#34e2c0] bg-[#34e2c0]/5 shadow-[0_0_20px_rgba(52,226,192,0.4)] z-50 rounded transition-all duration-[1000ms] ease-out pointer-events-none"
              style={{
                ...scanStyle,
                animation: 'pulse-border 1.2s infinite'
              }}
            >
              {/* スキャンラインの走査アニメーション */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#34e2c0] shadow-[0_0_10px_#34e2c0] animate-[scan_2s_infinite]" />
              <div className="absolute top-2 left-3 bg-[#34e2c0] text-ink-950 text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                AI DETECTING CONTENT BOUNDS...
              </div>
            </div>
          )}
          <svg
            width={w}
            height={h}
            className={`absolute inset-0 ${drawMode ? 'cursor-crosshair' : ''}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseMove={(e) => drawMode && setHover(toNorm(e.clientX, e.clientY))}
          >
            <defs>
              {/* マーカー自体を大きく鋭利にして視認しやすさを劇的に向上 */}
              <marker id="arrow-in" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 6 L 0 10.5 L 3 6 z" fill="#34e2c0" />
              </marker>
              <marker id="arrow-out" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 6 L 0 10.5 L 3 6 z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-gray" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 6 L 0 10.5 L 3 6 z" fill="rgba(255,255,255,0.4)" />
              </marker>
            </defs>

            {walls.map((wall) => {
              const polyPoints = wall.points.map((p) => `${p.x * w},${p.y * h}`).join(' ')
              const mx = wall.mid.x * w
              const my = wall.mid.y * h
              const isSel = selected === wall.id
              // 展開バッジ（外から中を指す視線）の幾何オフセット計算
              // 矢印が家具に埋まって断面図のようにならないよう、バッジと矢印を外側にオフセット配置
              const bx = mx - wall.normal.x * 48 // バッジの中心（壁から外側に48px）
              const by = my - wall.normal.y * 48
              
              const ax = mx - wall.normal.x * 16 // 矢印の先端（壁から外側に16px、埋まらない）
              const ay = my - wall.normal.y * 16
              
              const sx = bx + wall.normal.x * 10 // 線の開始（バッジのフチ）
              const sy = by + wall.normal.y * 10

              const done = !!wall.image
              
              // 内装（内向き）か外観（外向き）かを幾何学的に判定（画面中央 0.5, 0.5 を向いているか）
              const isFacingIn = (wall.normal.x * (0.5 - wall.mid.x) + wall.normal.y * (0.5 - wall.mid.y)) >= 0
              
              const isBlinking = isAssigning
              const arrowColor = isBlinking
                ? 'var(--color-accent-400)' // 割り当て選択待ち時はゴールドに発光
                : isSel
                  ? 'var(--color-accent-300)'
                  : done
                    ? (isFacingIn ? '#34e2c0' : '#f59e0b')
                    : 'rgba(255,255,255,0.5)'
                  
              const markerId = isSel
                ? (isFacingIn ? 'arrow-in' : 'arrow-out')
                : done
                  ? (isFacingIn ? 'arrow-in' : 'arrow-out')
                  : 'arrow-gray'

              const p1 = wall.points[0]
              const p2 = wall.points[wall.points.length - 1]
              const wallAngle = Math.atan2((p2.y - p1.y) * h, (p2.x - p1.x) * w)

              return (
                <g
                  key={wall.id}
                  className={[
                    'cursor-pointer transition-all duration-300',
                    isBlinking || dragOverWallId === wall.id ? 'animate-pulse scale-[1.03] origin-center' : '',
                  ].join(' ')}
                  onClick={(e) => { e.stopPropagation(); onSelect(wall.id) }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOverWallId !== wall.id) {
                      setDragOverWallId(wall.id)
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverWallId === wall.id) {
                      setDragOverWallId(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverWallId(null)
                    try {
                      const data = JSON.parse(e.dataTransfer.getData('application/json'))
                      if (data && data.type === 'elevation_crop') {
                        onWallFile(wall.id, data.image)
                      }
                    } catch (err) {
                      console.error('D&D drop error:', err)
                    }
                  }}
                >
                  {/* 壁パスの描画（直線または折れ線として統一レンダリング） */}
                  <polyline 
                    points={polyPoints} 
                    fill="none" 
                    stroke={dragOverWallId === wall.id ? 'var(--color-accent-400)' : arrowColor} 
                    strokeWidth={isBlinking || dragOverWallId === wall.id ? 6.5 : isSel ? 5 : 3.5} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                  {/* facing arrow line & marker */}
                  <line 
                    x1={sx} 
                    y1={sy} 
                    x2={ax} 
                    y2={ay} 
                    stroke={dragOverWallId === wall.id ? 'var(--color-accent-400)' : arrowColor} 
                    strokeWidth={isBlinking || dragOverWallId === wall.id ? "3" : "2"} 
                    markerEnd={`url(#${markerId})`} 
                  />
                  {/* number badge */}
                  <circle cx={bx} cy={by} r={isBlinking || dragOverWallId === wall.id ? "12" : "10"} fill="#0e0f12" stroke={dragOverWallId === wall.id ? 'var(--color-accent-400)' : arrowColor} strokeWidth="2.5" className={isBlinking ? "animate-bounce" : ""} />
                  <text x={bx} y={by + (isBlinking || dragOverWallId === wall.id ? 4.5 : 3.5)} textAnchor="middle" fontSize={isBlinking || dragOverWallId === wall.id ? "13" : "11"} fontWeight="900" fill={dragOverWallId === wall.id ? 'var(--color-accent-400)' : arrowColor}>
                    {wallChar(wall.index)}
                  </text>
                  
                  {/* D&D ドラッグオーバー時の壁面角度連動回転プレビュー！ */}
                  {dragOverWallId === wall.id && draggedCrop && (
                    <g transform={`translate(${mx}, ${my}) rotate(${(wallAngle * 180) / Math.PI})`}>
                      <rect
                        x="-30"
                        y="-45"
                        width="60"
                        height="40"
                        fill="none"
                        stroke="var(--color-accent-400)"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        className="animate-pulse"
                      />
                      <image
                        href={draggedCrop.image}
                        x="-28"
                        y="-43"
                        width="56"
                        height="36"
                        opacity="0.85"
                        preserveAspectRatio="xMidYMid slice"
                      />
                      <line x1="-30" y1="-5" x2="-30" y2="-45" stroke="var(--color-accent-400)" strokeWidth="1" />
                      <line x1="30" y1="-5" x2="30" y2="-45" stroke="var(--color-accent-400)" strokeWidth="1" />
                    </g>
                  )}

                  {done && (
                    <>
                      <circle cx={mx + 9} cy={my - 9} r="4" fill="var(--color-accent-400)" />
                      {/* 壁の直近に切り出された展開図プレビューサムネイルをリアルタイム表示！ */}
                      <foreignObject
                        x={mx + 20}
                        y={my - 28}
                        width="58"
                        height="40"
                        className="pointer-events-none transition-all duration-300 transform scale-95 hover:scale-110 shadow-2xl"
                      >
                        <div className="rounded-lg border-2 border-accent-400 bg-[#0c0d12]/95 p-0.5 shadow-2xl backdrop-blur-sm overflow-hidden h-full w-full flex items-center justify-center">
                          <img
                            src={wall.image}
                            alt="preview"
                            className="max-h-full max-w-full object-contain rounded-md"
                          />
                        </div>
                      </foreignObject>
                    </>
                  )}
                  
                  {/* 平面図ダイレクト反転ボタン (バッジの斜め右上) */}
                  <g
                    className="hover:opacity-100 opacity-70 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onFlip(wall.id)
                    }}
                    title="視線の向きを反転"
                  >
                    <circle cx={mx + 13} cy={my - 13} r="6.5" fill="#18181b" stroke={arrowColor} strokeWidth="1" />
                    {/* 回転矢印を模した簡易アイコンパス */}
                    <path
                      d={`M ${mx + 11} ${my - 13} a 2.2 2.2 0 0 1 4.1 -1.1 m 0 0 L ${mx + 13.6} ${my - 16.2} M ${mx + 15.1} ${my - 14.1} L ${mx + 15.1} ${my - 11.2}`}
                      stroke={arrowColor}
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </g>
                </g>
              )
            })}
            
            {/* 描画中のドラフト折れ線 */}
            {drawMode && draftPoints.length > 0 && (
              <polyline
                points={draftPoints.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
                fill="none"
                stroke="var(--color-accent-300)"
                strokeWidth="2.5"
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            
            {/* 描画中の各ピンの描画 */}
            {drawMode && draftPoints.map((p, idx) => (
              <circle key={idx} cx={p.x * w} cy={p.y * h} r="4" fill="var(--color-accent-300)" stroke="#0e0f12" strokeWidth="1" />
            ))}

            {/* マウスガイド線（最後のピンと現在のホバー位置を結ぶ） */}
            {drawMode && draftPoints.length > 0 && hover && (
              <line
                x1={draftPoints[draftPoints.length - 1].x * w}
                y1={draftPoints[draftPoints.length - 1].y * h}
                x2={hover.x * w}
                y2={hover.y * h}
                stroke="var(--color-accent-300)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}
          </svg>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-2">
        <span className="text-xs font-semibold text-zinc-400">
          {drawMode
            ? draftPoints.length > 0
              ? '対象となる壁の形状に沿ってクリックしてください。ダブルクリック、Enterキー、または [確定する] ボタンで壁を保存します。'
              : '平面図上の壁の角（始点）をクリックして、対象となる壁を選択（パス作成）してください。'
            : `${walls.length}面を設定済み · ${walls.filter((x) => x.image).length}面が紐づけ完了`}
        </span>
        <div className="flex items-center gap-2">
          {(pan.x !== 0 || pan.y !== 0 || zoom !== 1.0) && (
            <button
              onClick={() => {
                setZoom(1.0)
                setPan({ x: 0, y: 0 })
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw size={13} /> 表示リセット
            </button>
          )}
          {drawMode && draftPoints.length >= 2 && (
            <button
              onClick={() => {
                onAddCustom(draftPoints)
                setDraftPoints([])
                setDrawMode(false)
              }}
              className="inline-flex items-center gap-1 rounded bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink-950 hover:bg-accent-300 transition-colors"
            >
              <Check size={12} /> 確定する
            </button>
          )}
          <button
            onClick={() => {
              setDrawMode((v) => !v)
              setDraftPoints([])
            }}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              drawMode
                ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                : 'border border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]',
            ].join(' ')}
          >
            <Plus size={13} /> {drawMode ? '追加をやめる' : '壁を追加する'}
          </button>
        </div>
      </div>

      {/* wall filmstrip */}
      <div className="thin-scroll flex shrink-0 gap-2.5 overflow-x-auto border-t border-white/5 bg-ink-900/30 p-3">
        {walls.length === 0 && (
          <p className="px-2 py-4 text-xs text-zinc-600">
            「壁を追加する」ボタンを押し、平面図上をクリックして壁の線を引いてください。
          </p>
        )}
        {walls.map((wall) => (
          <WallCard
            key={wall.id}
            wall={wall}
            selected={selected === wall.id}
            onSelect={() => onSelect(wall.id)}
            onFile={(f) => onWallFile(wall.id, f)}
            onRemove={() => onRemove?.(wall.id) || onWallRemove(wall.id)}
            onFlip={() => onFlip(wall.id)}
            onCrop={() => onCrop?.(wall.id)}
            onMaterialFile={(url) => onMaterialFile?.(wall.id, url)}
          />
        ))}
      </div>
    </div>
  )
}

function WallCard({ wall, selected, onSelect, onFile, onRemove, onFlip, onCrop, onMaterialFile }) {
  const inputRef = useRef(null)
  const materialInputRef = useRef(null)
  const isFacingIn = (wall.normal.x * (0.5 - wall.mid.x) + wall.normal.y * (0.5 - wall.mid.y)) >= 0
  return (
    <div
      onClick={onSelect}
      className={[
        'relative w-36 shrink-0 rounded-xl border p-3 transition-all duration-300 cursor-pointer select-none',
        selected 
          ? 'border-accent-400 bg-gradient-to-b from-accent-400/[0.08] to-accent-400/[0.01] shadow-[0_8px_25px_rgba(250,204,21,0.12)]' 
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] hover:shadow-xl',
      ].join(' ')}
    >
      <div className="mb-2 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
            <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent-400 text-[9px] font-black text-ink-950 shadow-[0_0_10px_rgba(250,204,21,0.3)]">
              {wallChar(wall.index)}
            </span>
            {wallLabel(wall.index)}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onFlip() }} title="視線の向きを反転" className="text-zinc-500 hover:text-accent-400 transition-colors p-0.5">
              <RefreshCw size={11} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove() }} title="この壁を削除" className="text-zinc-500 hover:text-red-400 transition-colors p-0.5">
              <X size={12} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black scale-90 origin-left tracking-wide ${isFacingIn ? 'bg-[#34e2c0]/10 text-[#34e2c0]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'}`}>
            {isFacingIn ? '内観' : '外観・ファサード'}
          </span>
          {wall.source === 'custom' && <span className="text-[8px] px-1.5 py-0.5 rounded font-black bg-white/5 text-zinc-400 scale-90 origin-left tracking-wide">造作/什器</span>}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {wall.image ? (
        <div className="relative overflow-hidden rounded-lg border border-white/5 bg-zinc-950/40">
          <img src={wall.image} alt={wallLabel(wall.index)} className="h-16 w-full object-contain" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-ink-950/80 text-zinc-300 hover:text-white hover:bg-ink-950 transition-colors"
          >
            <X size={11} />
          </button>
          <span className="absolute bottom-1 left-1.5 rounded bg-accent-400 px-1.5 py-0.5 text-[8px] font-black text-ink-950 shadow-sm flex items-center gap-0.5 scale-90 origin-left">
            <Check size={8} className="stroke-[3]" /> MAPPED
          </span>
        </div>
      ) : (
        <div className="flex h-16 w-full gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
            title="ファイルをアップロード"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 bg-white/[0.01] text-zinc-500 hover:border-accent-400/50 hover:bg-accent-400/[0.02] hover:text-accent-400 transition-all duration-300"
          >
            <Plus size={13} />
            <span className="text-[8px] font-semibold scale-90">UPLOAD</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCrop?.() }}
            title="展開図シートから切り出す"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 bg-white/[0.01] text-zinc-500 hover:border-accent-400/50 hover:bg-accent-400/[0.02] hover:text-accent-400 transition-all duration-300 animate-pulse-glow"
          >
            <Scissors size={13} className="animate-pulse" />
            <span className="text-[8px] font-semibold scale-90">CROP</span>
          </button>
        </div>
      )}

      {/* 仕上げ素材（テクスチャ写真）のアップローダー */}
      <div className="mt-2.5 border-t border-white/5 pt-2 flex flex-col gap-1">
        <input
          ref={materialInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              const url = URL.createObjectURL(file)
              onMaterialFile?.(url)
            }
          }}
        />
        {wall.materialImage ? (
          <div
            onClick={(e) => {
              e.stopPropagation()
              materialInputRef.current?.click()
            }}
            className="group relative flex h-7 items-center justify-between overflow-hidden rounded border border-accent-400/20 bg-zinc-950/60 px-2 text-[9px] hover:border-accent-400/40"
          >
            <div className="flex items-center gap-1 min-w-0">
              <img src={wall.materialImage} alt="素材" className="h-4 w-4 rounded object-cover shrink-0" />
              <span className="truncate text-zinc-300 scale-90 origin-left">素材写真適用済</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMaterialFile?.(null)
              }}
              className="hidden group-hover:flex h-4 w-4 items-center justify-center rounded bg-zinc-900 text-zinc-400 hover:text-zinc-100"
            >
              <X size={9} />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              materialInputRef.current?.click()
            }}
            className="flex h-7 w-full items-center justify-center gap-1 rounded border border-dashed border-white/10 bg-white/[0.01] text-[9px] font-semibold text-zinc-500 hover:border-accent-400/50 hover:bg-accent-400/[0.02] hover:text-accent-400 transition-all duration-300"
          >
            <Plus size={10} />
            <span className="scale-90 text-[8px]">仕上げ素材を追加</span>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
        <Ruler size={10} className="text-zinc-500" />
        {wallLengthLabel(wall)}
      </div>
    </div>
  )
}
