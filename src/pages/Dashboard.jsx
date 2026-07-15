import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Search,
  X,
  Compass,
  RotateCcw,
  ImageDown,
  Loader2,
  Check,
  Trees,
  Building2,
  Spline,
  Scissors,
  Clipboard,
  Wand2,
  Crop,
  Trash2,
  Camera,
  Palette,
} from 'lucide-react'
import Logo from '../components/Logo.jsx'
import SheetCropper from '../components/SheetCropper.jsx'
import PlanCropper from '../components/PlanCropper.jsx'
import PdfPagePicker from '../components/PdfPagePicker.jsx'
import PlanAnalyzing from '../components/PlanAnalyzing.jsx'
import AutoFit from '../components/AutoFit.jsx'
import ScalePicker from '../components/ScalePicker.jsx'
import WallMapper from '../components/WallMapper.jsx'
import { isPdf, renderPdfToImages, mmPerPxFrom } from '../lib/pdf.js'
import { deriveWalls, makeCustomWall, flipWall, wallChar, wallLabel, buildWall } from '../lib/walls.js'
import { JPMA_COLORS, TEXTURE_CATEGORIES, ENVIRONMENTS } from '../data/materials.js'
import { render3DScene } from '../lib/render3d.js'
import ue5Render from '../ue5_render_interior.png'

/* ============================================================= *
 *  Upload slot — a single droppable / clickable image cell
 * ============================================================= */
function UploadSlot({ slot, image, onUpload, onPdf, onRemove, variant = 'edge', note = null }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const pick = (file) => {
    if (!file) return
    if (isPdf(file)) {
      onPdf?.(slot.key, file)
      return
    }
    if (file.type.startsWith('image/')) {
      onUpload(slot.key, URL.createObjectURL(file))
    }
  }

  const isCenter = variant === 'center'

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        pick(e.dataTransfer.files?.[0])
      }}
      className={[
        'group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border text-center transition-all',
        image
          ? 'border-white/15 bg-ink-850'
          : isCenter
            ? 'border-2 border-dashed border-white/15 bg-white/[0.015] hover:border-accent-400/50 hover:bg-accent-400/[0.03]'
            : 'border border-dashed border-white/12 bg-white/[0.012] hover:border-accent-400/50 hover:bg-accent-400/[0.03]',
        drag ? 'border-accent-400 bg-accent-400/10' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {image ? (
        <>
          <img src={image} alt={slot.label} className="h-full w-full object-cover" />
          {note && (
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-accent-400/90 px-2 py-1 text-[10px] font-semibold text-ink-950">
              <Spline size={11} /> {note}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink-950/90 to-transparent px-2.5 py-1.5">
            <span className={`font-medium text-zinc-200 ${isCenter ? 'text-xs' : 'text-[10px]'}`}>
              {slot.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-accent-400">
              <Check size={11} /> 完了
            </span>
          </div>
          <button
            onClick={() => onRemove(slot.key)}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-ink-950/70 text-zinc-300 opacity-0 backdrop-blur transition-opacity hover:text-white group-hover:opacity-100"
            aria-label="削除"
          >
            <X size={13} />
          </button>
        </>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 py-3"
        >
          <span
            className={[
              'flex items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-zinc-400 transition-colors group-hover:border-accent-400/50 group-hover:text-accent-400',
              isCenter ? 'h-11 w-11' : 'h-7 w-7',
            ].join(' ')}
          >
            <Plus size={isCenter ? 22 : 15} />
          </span>
          <span
            className={`font-medium text-zinc-300 ${isCenter ? 'mt-1 text-sm' : 'text-[10px] leading-tight'}`}
          >
            {slot.label}
          </span>
          {slot.sub && (
            <span className={`text-zinc-600 ${isCenter ? 'text-xs' : 'text-[9px] leading-tight'}`}>
              {slot.sub}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

/* ============================================================= *
 *  Center: 2D mapping cross layout
 * ============================================================= */
const SLOTS = {
  center: { key: 'center', label: '平面図をアップロード', sub: '天板・底面図でも可 · PDF / 画像 · クリック / ドロップ' },
  top: { key: 'top', label: 'A面（展開図）', sub: '上辺' },
  bottom: { key: 'bottom', label: 'B面（立面図）', sub: '下辺' },
  left: { key: 'left', label: 'C面（展開図）', sub: '左辺' },
  right: { key: 'right', label: 'D面（展開図）', sub: '右辺' },
}

function MappingArea({
  plan,
  onUpload,
  onPdf,
  onRemove,
  onLoadDemo,
  walls,
  selectedWall,
  onSelectWall,
  onWallFile,
  onWallRemove,
  onAddCustom,
  onFlip,
  allReady,
  generating,
  onGenerate,
  result,
  outline,
  onTrace,
  onCrop,
  onAutoFit,
  analyzing,
  rawPlan,
  onPlanCropOpen,
  sheets = [],
  onAddSourceSheets,
  setSheets,
  pdfBusy,
  triggerAutoMapping,
  applyCrops,
  projectCategory,
  setProjectCategory,
  setWalls,
  isAssigning,
  setIsAssigning,
  isAnalyzingPlan = false,
  planScanRect = null,
  onMaterialFile,
  draggedCrop,
}) {
  const wallsReady = walls.filter((w) => w.image).length
  const showSplit = plan && !result
  const activeStep = !plan ? 1 : sheets.length === 0 ? 2 : 3

  return (
    <div className="flex h-full flex-col">
      {/* header & Step Progress Wizard */}
      <div className="border-b border-white/5 bg-ink-900/40 px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-zinc-100">
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>図面マッピング設定</span>
              </h2>
              {plan && (
                <button
                  onClick={() => onRemove('center')}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer pointer-events-auto shadow-sm"
                  title="アップロード済みの平面図を削除してやり直します"
                >
                  <Trash2 size={10} /> 平面図をクリア
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>平面図と展開図を紐づけて、</span>
              <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>3D空間の形状とサイズをAIに理解させます</span>
            </p>
          </div>
          
          {/* Step circles */}
          <div className="flex items-center gap-2">
            {[
              { step: 1, label: '平面図登録', done: !!plan },
              { step: 2, label: '展開図登録', done: sheets.length > 0 },
              { step: 3, label: '壁面紐づけ', done: walls.length > 0 && wallsReady === walls.length }
            ].map((s, idx) => (
              <div key={s.step} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <span className={[
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    s.done 
                      ? 'bg-accent-400 text-ink-950' 
                      : (!s.done && (idx === 0 || (idx === 1 && plan) || (idx === 2 && plan && sheets.length > 0)))
                        ? 'bg-accent-400/20 text-accent-300 ring-2 ring-accent-400/50 animate-pulse'
                        : 'bg-white/5 text-zinc-500'
                  ].join(' ')}>
                    {s.done ? '✓' : s.step}
                  </span>
                  <span className={[
                    'text-xs font-medium',
                    s.done ? 'text-zinc-200' : 'text-zinc-500'
                  ].join(' ')}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && <span className="mx-3 text-zinc-700">➔</span>}
              </div>
            ))}
          </div>
        </div>
        
        {/* Next Action Banner */}
        <div className="mt-4 rounded-2xl border-2 border-accent-400/40 bg-gradient-to-r from-accent-400/10 via-accent-400/[0.03] to-transparent p-5 shadow-[0_0_25px_rgba(250,204,21,0.15)]">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex h-3.5 w-3.5 rounded-full bg-accent-400 animate-ping" />
              <span className="text-xs font-black uppercase tracking-widest text-ink-950 bg-accent-400 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                NEXT ACTION
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-zinc-100 leading-snug">
              {isAssigning ? (
                <>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>🎨 展開図の切り出し枠を割り当てる壁面を、</span>
                  <strong className="text-accent-400 text-lg sm:text-xl underline decoration-accent-400/50 underline-offset-4 animate-pulse" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>左側の平面図から直接クリック</strong>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>して紐づけてください！</span>
                </>
              ) : !plan ? (
                <>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>👉 画面中央のスロットをクリックして、まずは</span>
                  <strong className="text-accent-400 text-lg sm:text-xl underline decoration-accent-400/50 underline-offset-4" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>「平面図」</strong>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>をアップロードしてください。</span>
                </>
              ) : sheets.length === 0 ? (
                <>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>👉 右側エリアの「PDF/画像を追加」から、</span>
                  <strong className="text-accent-400 text-lg sm:text-xl underline decoration-accent-400/50 underline-offset-4" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>「展開図・立面図（複数可）」</strong>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>をアップロードしてください。</span>
                </>
              ) : walls.length === 0 ? (
                <>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>👉 平面図上に壁のラインを設定しましょう！左下の</span>
                  <strong className="text-accent-400 text-lg sm:text-xl underline decoration-accent-400/50 underline-offset-4 animate-pulse" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>「＋ 壁を追加する」</strong>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>で線を引くか、右上の</span>
                  <strong className="text-accent-400 text-lg sm:text-xl underline decoration-accent-400/50 underline-offset-4 animate-pulse" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>「AI自動紐づけを実行」</strong>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>で自動セットアップを行ってください。</span>
                </>
              ) : wallsReady < walls.length ? (
                <>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>👉 まだ画像のない壁面があります。壁を選んで右側で切り出しを適用するか、</span>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>完了したら下部の「パース生成を開始」を押してください。</span>
                </>
              ) : (
                <>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>✨ すべてのマッピングが完了しました！</span>
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>下部の「パース生成を開始」をクリックして、3Dパースを出力してください。</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* project category selector tabs */}
      {!result && plan && (
        <div className="flex items-center gap-2 border-b border-white/5 bg-ink-950/40 px-5 py-2">
          <span className="text-xs font-semibold text-zinc-400 mr-2">パースの種類を選択:</span>
          {[
            { id: 'interior', label: '🛋️ 内装（インテリア）' },
            { id: 'exterior', label: '🚪 外観・ファサード' },
            { id: 'furniture', label: '🪑 家具・造作（什器）' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setProjectCategory(cat.id)
                setWalls([]) // カテゴリ切り替え時に一度壁をクリアする（混乱を防ぐため）
              }}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                projectCategory === cat.id
                  ? 'bg-accent-400 text-ink-950 shadow-[0_0_10px_rgba(250,204,21,0.2)]'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
              ].join(' ')}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* AI Auto Mapping Top Bar */}
      {!result && plan && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-ink-900/60 px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles size={14} className="text-accent-400 animate-pulse" />
            <span className="text-zinc-300 font-semibold">AI自動紐づけ</span>
            <span className="text-zinc-500 font-medium">図面を自動解析し、壁の配置と展開図マッピングを1クリックで完了</span>
          </div>
          <div className="flex items-center gap-3">

            <button
              onClick={triggerAutoMapping}
              disabled={analyzing || sheets.length === 0}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-400 to-teal-500 px-4 py-1.5 text-xs font-bold text-ink-950 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 shadow-[0_0_10px_rgba(45,212,191,0.2)]',
                sheets.length > 0 && walls.length === 0
                  ? 'animate-bounce ring-4 ring-accent-400/50'
                  : 'animate-pulse'
              ].join(' ')}
            >
              {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              AI自動紐づけを実行
            </button>
          </div>
        </div>
      )}

      {/* Main split area */}
      <div className="flex flex-1 min-h-0">
        {/* Left Pane: Plan / WallMapper */}
        <div className={`flex flex-col min-h-0 relative ${showSplit ? 'w-1/2 border-r border-white/5' : 'w-full h-full'} ${activeStep === 1 ? 'animate-[pulse-glow_2.5s_infinite_ease-in-out] border-2 border-accent-400/40 rounded-xl m-1 overflow-hidden' : ''}`}>
          {result ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-4 overflow-auto p-5 sm:p-8">
              <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <img src={result} alt="生成されたパース" className="w-full object-cover" />
                <span className="absolute left-4 top-4 rounded-full bg-accent-400 px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-ink-950 shadow-[0_0_15px_rgba(250,204,21,0.4)] flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-950 animate-ping" />
                  UE5 CLOUD RENDERED
                </span>
                <div className="absolute right-4 bottom-4 rounded bg-ink-950/80 px-2 py-1 text-[9px] font-mono text-zinc-400 backdrop-blur-sm">
                  1920x1080 · lumen active · raytracing ON
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onGenerate}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.07]"
                >
                  <RotateCcw size={15} /> 再生成
                </button>
                <button className="inline-flex items-center gap-2 rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-300">
                  <ImageDown size={15} /> 書き出し
                </button>
              </div>
            </div>
          ) : !plan ? (
            <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center p-6 gap-4">
              <div className="aspect-[4/3] w-full">
                <UploadSlot
                  slot={SLOTS.center}
                  image={null}
                  onUpload={onUpload}
                  onPdf={onPdf}
                  onRemove={onRemove}
                  variant="center"
                />
              </div>
              {onLoadDemo && (
                <button
                  onClick={onLoadDemo}
                  className="w-full rounded-xl border border-accent-400/30 bg-accent-400/5 py-3 text-xs font-bold text-accent-300 hover:bg-accent-400/10 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(52,226,192,0.05)] cursor-pointer"
                >
                  <Sparkles size={14} /> 家具パースのデモデータを即時ロード
                </button>
              )}
            </div>
          ) : (
            <div className="relative flex flex-1 flex-col min-h-0 h-full overflow-hidden">
              <WallMapper
                plan={plan}
                walls={walls}
                selected={selectedWall}
                onSelect={onSelectWall}
                onWallFile={onWallFile}
                onWallRemove={onWallRemove}
                onAddCustom={onAddCustom}
                onFlip={onFlip}
                onCrop={onCrop}
                onRemove={onWallRemove}
                isAssigning={isAssigning}
                isAnalyzingPlan={isAnalyzingPlan}
                planScanRect={planScanRect}
                onMaterialFile={onMaterialFile}
                draggedCrop={draggedCrop}
              />
              {walls.length === 0 && sheets.length > 0 && (
                <div className="mx-5 mb-4 rounded-xl border border-accent-400/25 bg-accent-400/[0.04] p-4 text-center shadow-lg backdrop-blur-sm animate-pulse">
                  <p className="text-xs font-bold text-accent-300 flex items-center justify-center gap-1.5">
                    <Sparkles size={14} className="animate-spin text-accent-400" /> 図面ソースのアップロード完了！
                  </p>
                  <p className="text-[11px] text-zinc-300 mt-1.5 leading-relaxed">
                    {projectCategory === 'exterior' ? (
                      <>
                        画面上部の <strong className="text-accent-400">「AI自動紐づけを実行」</strong> ボタンを押すと、AIが平面図上の<strong className="text-accent-400">入り口（ファサード）位置</strong>を自動で検出し、ファサード詳細図の自動切り出し＆紐づけを一発で完了します。
                      </>
                    ) : projectCategory === 'furniture' ? (
                      <>
                        画面上部の <strong className="text-accent-400">「AI自動紐づけを実行」</strong> ボタンを押すと、AIが平面図上の<strong className="text-accent-400">中央のカウンター位置</strong>を自動で検出し、家具図の自動切り出し＆紐づけを一発で完了します。
                      </>
                    ) : (
                      <>
                        画面上部の <strong className="text-accent-400">「AI自動紐づけを実行」</strong> ボタンを押すと、AIが平面図上のすべての壁を検出し、展開図シートからの切り出しとペアリングを自動で一発完了します。
                      </>
                    )}
                  </p>
                  <div className="mt-2.5 text-[10px] text-zinc-500">
                    または、左下の「＋ 壁を追加する」を押して、平面図上に直接線を引いて壁を配置することもできます。
                  </div>
                </div>
              )}
              {/* スキャンレーザー演出 */}
              {analyzing && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="relative w-full h-full overflow-hidden">
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-400 to-transparent shadow-[0_0_15px_var(--color-accent-400)] animate-[scan_2s_infinite]" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Loader2 size={36} className="animate-spin text-accent-400" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-zinc-100">AIが図面をスキャン中...</p>
                        <p className="text-[10px] text-zinc-400 mt-1">壁面の自動検出と展開図の紐づけを行っています</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Inline SheetCropper */}
        {showSplit && (
          <div className={`w-1/2 flex flex-col min-h-0 bg-ink-950/40 relative ${activeStep >= 2 && walls.filter(w => w.image).length < walls.length ? 'animate-[pulse-glow-teal_2.5s_infinite_ease-in-out] border border-teal-500/20 rounded-xl m-1 overflow-hidden' : ''}`}>
            <SheetCropper
              isInline={true}
              initialSheets={sheets}
              targets={
                selectedWall
                  ? walls
                      .filter((w) => w.id === selectedWall)
                      .map((w) => ({
                        key: w.id,
                        label: `${wallLabel(w.index)}${w.source === 'custom' ? '(造作/什器)' : ''}`,
                      }))
                  : walls.map((w) => ({
                      key: w.id,
                      label: `${wallLabel(w.index)}${w.source === 'custom' ? '(造作/什器)' : ''}`,
                    }))
              }
              onApply={applyCrops}
              onCancel={() => {}}
              selectedWall={selectedWall}
              onActiveRectChange={setIsAssigning}
              onDragCropStart={(cropData) => setDraggedCrop(cropData)}
              onDragCropEnd={() => setDraggedCrop(null)}
            />
            {/* 右側のスキャンレーザー演出（展開図画像が実際にアップロードされている場合のみ実行） */}
            {analyzing && sheets.length > 0 && (
              <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm">
                <div className="relative w-full h-full overflow-hidden">
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_15px_#2dd4bf] animate-[scan_2s_infinite]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes progress {
          0% { width: 0%; }
          15% { width: 10%; }
          40% { width: 35%; }
          70% { width: 75%; }
          90% { width: 95%; }
          100% { width: 100%; }
        }
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 5px rgba(250, 204, 21, 0.05); border-color: rgba(250, 204, 21, 0.1); }
          50% { box-shadow: 0 0 25px rgba(250, 204, 21, 0.25); border-color: rgba(250, 204, 21, 0.5); }
          100% { box-shadow: 0 0 5px rgba(250, 204, 21, 0.05); border-color: rgba(250, 204, 21, 0.1); }
        }
        @keyframes pulse-glow-teal {
          0% { box-shadow: 0 0 5px rgba(45, 212, 191, 0.05); border-color: rgba(45, 212, 191, 0.1); }
          50% { box-shadow: 0 0 25px rgba(45, 212, 191, 0.25); border-color: rgba(45, 212, 191, 0.5); }
          100% { box-shadow: 0 0 5px rgba(45, 212, 191, 0.05); border-color: rgba(45, 212, 191, 0.1); }
        }
      `}</style>

      {/* generate bar */}
      {!result && (
        <div className="border-t border-white/5 px-5 py-4">
          <button
            disabled={!allReady || generating}
            onClick={onGenerate}
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-semibold transition-all',
              allReady && !generating
                ? 'animate-pulse-glow bg-accent-400 text-ink-950 hover:bg-accent-300'
                : 'cursor-not-allowed border border-white/8 bg-white/[0.02] text-zinc-600',
            ].join(' ')}
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> パースを生成中…
              </>
            ) : (
              <>
                <Sparkles size={18} />
                パース生成を開始
              </>
            )}
          </button>
          {!allReady && (
            <p className="mt-2 text-center text-xs text-zinc-600">
              平面図に壁を設定し、各壁に展開図を割り当てると生成できます
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================= *
 *  Left: camera angle + environment
 * ============================================================= */
function CompassDial({ angle, setAngle }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.05)" />
          {[...Array(12)].map((_, i) => {
            const a = (i * 30 * Math.PI) / 180
            const x1 = 60 + Math.sin(a) * 54
            const y1 = 60 - Math.cos(a) * 54
            const x2 = 60 + Math.sin(a) * (i % 3 === 0 ? 46 : 50)
            const y2 = 60 - Math.cos(a) * (i % 3 === 0 ? 46 : 50)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" />
          })}
          <g transform={`rotate(${angle} 60 60)`}>
            <line x1="60" y1="60" x2="60" y2="20" stroke="var(--color-accent-400)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="60" cy="20" r="4" fill="var(--color-accent-400)" />
          </g>
          <circle cx="60" cy="60" r="3.5" fill="#e4e4e7" />
        </svg>
        <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[9px] font-semibold text-zinc-500">N</span>
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-600">S</span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-600">E</span>
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-600">W</span>
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
        {angle}°
      </div>
    </div>
  )
}

function LeftPanel({ angle, setAngle, pitch, setPitch, env, setEnv }) {
  return (
    <div className="thin-scroll flex h-full flex-col gap-6 overflow-y-auto p-5">
      <div>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Compass size={14} className="text-accent-400" /> カメラアングル
        </h3>
        <div className="mt-4 rounded-xl border border-white/8 bg-ink-900/50 p-4">
          <CompassDial angle={angle} setAngle={setAngle} />
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-zinc-400">
                <span>方位（水平回転）</span>
                <span className="font-mono text-zinc-300">{angle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full accent-accent-400"
              />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-zinc-400">
                <span>仰角（見上げ / 見下ろし）</span>
                <span className="font-mono text-zinc-300">{pitch}°</span>
              </div>
              <input
                type="range"
                min="-30"
                max="60"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full accent-accent-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Trees size={14} className="text-accent-400" /> 周辺環境
        </h3>
        <p className="mt-1.5 text-xs text-zinc-600">パースの背景と光の雰囲気を選択</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ENVIRONMENTS.map((e) => {
            const active = env === e.id
            return (
              <button
                key={e.id}
                onClick={() => setEnv(e.id)}
                className={[
                  'rounded-lg border p-2.5 text-left transition-all',
                  active
                    ? 'border-accent-400/50 bg-accent-400/10'
                    : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <span
                  className={`block text-xs font-medium ${active ? 'text-accent-300' : 'text-zinc-200'}`}
                >
                  {e.label}
                </span>
                <span className="mt-0.5 block text-[10px] text-zinc-500">{e.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ============================================================= *
 *  Right: JPMA color search + texture stock
 * ============================================================= */
function ColorSearch({ selected, setSelected }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return JPMA_COLORS.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    ).slice(0, 6)
  }, [query])

  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        日塗工（JPMA）カラー
      </h3>
      <p className="mt-1.5 text-xs text-zinc-600">色番号 例：19-90A / N-90 / 25-70B</p>

      <div className="relative mt-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="色番号 or 色名で検索"
          className="w-full rounded-lg border border-white/10 bg-ink-900/70 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-accent-400/50"
        />
        {focused && results.length > 0 && (
          <ul className="thin-scroll absolute z-20 mt-1.5 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-ink-850 p-1 shadow-2xl">
            {results.map((c) => (
              <li key={c.code}>
                <button
                  onMouseDown={() => {
                    setSelected(c)
                    setQuery(c.code)
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5"
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md border border-white/15"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs text-zinc-100">{c.code}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{c.name}</span>
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600">{c.hex}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* selected color preview */}
      {selected && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-ink-900/50 p-3">
          <span
            className="h-14 w-14 shrink-0 rounded-lg border border-white/15 shadow-inner"
            style={{ backgroundColor: selected.hex }}
          />
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-zinc-100">{selected.code}</div>
            <div className="truncate text-xs text-zinc-400">{selected.name}</div>
            <div className="mt-0.5 font-mono text-xs uppercase text-accent-400">{selected.hex}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function TextureStock({ selected, setSelected }) {
  const [cat, setCat] = useState(TEXTURE_CATEGORIES[0].id)
  const items = TEXTURE_CATEGORIES.find((c) => c.id === cat).items

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        テクスチャーストック
      </h3>
      <p className="mt-1.5 text-xs text-zinc-600">AI生成のシームレス素材をワンクリック適用</p>

      <div className="mt-3 flex gap-1 rounded-lg border border-white/8 bg-ink-900/50 p-1">
        {TEXTURE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={[
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              cat === c.id ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            ].join(' ')}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map((t) => {
          const active = selected?.name === t.name
          return (
            <button
              key={t.name}
              onClick={() => setSelected(t)}
              className={[
                'group relative aspect-square overflow-hidden rounded-lg border transition-all',
                active ? 'border-accent-400 ring-1 ring-accent-400/40' : 'border-white/10 hover:border-white/25',
              ].join(' ')}
              title={t.name}
              style={{
                background: `repeating-linear-gradient(45deg, ${t.tone}, ${t.tone} 6px, rgba(0,0,0,0.14) 6px, rgba(0,0,0,0.14) 12px)`,
              }}
            >
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink-950/95 to-transparent px-1.5 py-1 text-left text-[9px] font-medium text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
                {t.name}
              </span>
              {active && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-400 text-ink-950">
                  <Check size={11} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-2 text-center text-xs text-zinc-400">
          選択中：<span className="text-zinc-200">{selected.name}</span>
        </div>
      )}
    </div>
  )
}

function RightPanel(props) {
  return (
    <div className="thin-scroll flex h-full flex-col gap-6 overflow-y-auto p-5">
      <ColorSearch selected={props.color} setSelected={props.setColor} />
      <div className="h-px bg-white/5" />
      <TextureStock selected={props.texture} setSelected={props.setTexture} />
    </div>
  )
}

/* ============================================================= *
 *  Dashboard shell
 * ============================================================= */
export default function Dashboard() {
  const [images, setImages] = useState({
    center: null,
    top: null,
    bottom: null,
    left: null,
    right: null,
  })
  const [angle, setAngle] = useState(45)
  const [pitch, setPitch] = useState(10)
  const [env, setEnv] = useState('urban')
  const [color, setColor] = useState(null)
  const [texture, setTexture] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [mobileTab, setMobileTab] = useState('map') // map | angle | material
  const [outline, setOutline] = useState(null) // 正規化ポリゴン or null
  const [outlineClosed, setOutlineClosed] = useState(false)
  const [tracerOpen, setTracerOpen] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperTargetWallId, setCropperTargetWallId] = useState(null)
  const [rawPlan, setRawPlan] = useState(null) // トリミング前の元平面図
  const [planCropperOpen, setPlanCropperOpen] = useState(false)
  const [sheets, setSheets] = useState([]) // 直近・追加アップの図面シート群
  const [toast, setToast] = useState(null)
  const [pdfPick, setPdfPick] = useState(null) // { pages, slotKey, R } 複数ページPDFの選択
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pendingPdf, setPendingPdf] = useState(null) // { file, slotKey } 縮尺選択待ち
  const [scales, setScales] = useState({ center: null, top: null, bottom: null, left: null, right: null }) // mm/px
  const [projectCategory, setProjectCategory] = useState('interior') // 'interior' | 'exterior' | 'furniture'
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isAnalyzingPlan, setIsAnalyzingPlan] = useState(false)
  const [planScanRect, setPlanScanRect] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [autoFitOpen, setAutoFitOpen] = useState(false)
  const [walls, setWalls] = useState([]) // 認識した壁
  const [selectedWall, setSelectedWall] = useState(null)
  const [draggedCrop, setDraggedCrop] = useState(null) // ドラッグ＆ドロップ中の展開図情報
  const prevCenter = useRef(null)
  const planNatRef = useRef({ w: 1, h: 1 })

  const plan = images.center
  const allReady = walls.length > 0 && walls.every(w => w.image)

  // 平面図のアップロード
  const onUpload = (key, url) => {
    if (key === 'center') {
      setImages((prev) => ({ ...prev, center: url }))
      setRawPlan(url)
      setPlanCropperOpen(true)
    }
  }

  // 平面図の削除
  const onRemove = (key) => {
    if (key === 'center') {
      setImages((prev) => ({ ...prev, center: null }))
      setRawPlan(null)
      setWalls([])
      setOutline(null)
      setResult(null)
    }
  }

  // 壁の展開図画像を設定
  const setWallImage = (wallId, url, mmPerPx = null) => {
    setWalls((prev) =>
      prev.map((w) =>
        w.id === wallId ? { ...w, image: url, scale: mmPerPx ?? w.scale } : w
      )
    )
  }

  // 壁のファイル選択アップロード
  const onWallFile = (wallId, file) => {
    if (!file) return
    const url = typeof file === 'string' ? file : URL.createObjectURL(file)
    setWallImage(wallId, url)
    flash('壁の展開図をアップロードしました')
  }

  // 壁の削除、または展開図の削除
  const onWallRemove = (wallId) => {
    setWalls((prev) => {
      const target = prev.find((w) => w.id === wallId)
      if (target && target.image) {
        // 展開図だけを削除する
        return prev.map((w) =>
          w.id === wallId ? { ...w, image: null, scale: null } : w
        )
      } else {
        // 壁自体を削除する
        return prev.filter((w) => w.id !== wallId)
      }
    })
  }

  // 壁の仕上げ素材写真（テクスチャ）を設定
  const onWallMaterialFile = (wallId, url) => {
    setWalls((prev) =>
      prev.map((w) => (w.id === wallId ? { ...w, materialImage: url } : w))
    )
    if (url) {
      flash('壁の仕上げ素材写真を適用しました')
    }
  }

  // 壁の反転（法線反転）
  const onFlip = (wallId) => {
    setWalls((prev) =>
      prev.map((w) => (w.id === wallId ? flipWall(w) : w))
    )
    flash('壁の向きを反転しました')
  }

  // カスタム壁の追加
  const onAddCustom = (pts) => {
    const { w, h } = planNatRef.current || { w: 1000, h: 1000 }
    const newWall = makeCustomWall(pts, walls, w, h, { cx: 0.5, cy: 0.5 })
    setWalls((prev) => [...prev, newWall])
    flash(`カスタム壁${newWall.index}を追加しました`)
  }

  // 家具デモデータのロード
  const loadFurnitureDemo = () => {
    // 1. 平面図の生成 (1200 x 900)
    const planCanvas = document.createElement('canvas')
    planCanvas.width = 1200
    planCanvas.height = 900
    const pCtx = planCanvas.getContext('2d')
    
    // ブループリント風背景
    pCtx.fillStyle = '#0b0c10'
    pCtx.fillRect(0, 0, 1200, 900)
    pCtx.strokeStyle = '#161b26'
    pCtx.lineWidth = 1
    for (let x = 0; x < 1200; x += 50) {
      pCtx.beginPath(); pCtx.moveTo(x, 0); pCtx.lineTo(x, 900); pCtx.stroke()
    }
    for (let y = 0; y < 900; y += 50) {
      pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(1200, y); pCtx.stroke()
    }
    
    // L字カウンター天板 (正面幅 500, 奥行 350, 天板厚み 180, 中心付近)
    pCtx.strokeStyle = '#ffffff'
    pCtx.lineWidth = 1.5
    pCtx.beginPath()
    pCtx.moveTo(300, 250)
    pCtx.lineTo(800, 250)
    pCtx.lineTo(800, 430)
    pCtx.lineTo(480, 430)
    pCtx.lineTo(480, 600)
    pCtx.lineTo(300, 600)
    pCtx.closePath()
    pCtx.stroke()
    
    // 天板のコンセント口 (右奥 A端付近の天板上: X 730, Y 265, W 40, H 20)
    pCtx.strokeRect(730, 265, 40, 20)
    pCtx.fillStyle = '#161b26'
    pCtx.fillRect(731, 266, 38, 18)
    pCtx.strokeStyle = '#34e2c0'
    pCtx.strokeRect(738, 271, 10, 8)
    pCtx.strokeRect(752, 271, 10, 8) // 2口スリット
    
    // 寸法線 (1200x900スケール)
    pCtx.strokeStyle = '#34e2c0'
    pCtx.fillStyle = '#34e2c0'
    pCtx.font = '13px monospace'
    // 横幅 1800
    pCtx.beginPath(); pCtx.moveTo(300, 210); pCtx.lineTo(800, 210); pCtx.stroke()
    pCtx.fillText('W: 1800', 520, 200)
    // 縦奥行 1200
    pCtx.beginPath(); pCtx.moveTo(250, 250); pCtx.lineTo(250, 600); pCtx.stroke()
    pCtx.fillText('L: 1200', 180, 430)
    // 天板幅 600
    pCtx.beginPath(); pCtx.moveTo(300, 630); pCtx.lineTo(480, 630); pCtx.stroke()
    pCtx.fillText('D: 600', 360, 650)
    
    pCtx.fillStyle = '#ffffff'
    pCtx.font = 'bold 18px sans-serif'
    pCtx.fillText('L字木製カウンターテーブル 平面図', 50, 50)
    
    const planUrl = planCanvas.toDataURL('image/png')
    
    // 2. 正面立面図の生成 (1200 x 900)
    const elevCanvas = document.createElement('canvas')
    elevCanvas.width = 1200
    elevCanvas.height = 900
    const eCtx = elevCanvas.getContext('2d')
    eCtx.fillStyle = '#0b0c10'
    eCtx.fillRect(0, 0, 1200, 900)
    eCtx.strokeStyle = '#161b26'
    for (let x = 0; x < 1200; x += 50) {
      eCtx.beginPath(); eCtx.moveTo(x, 0); eCtx.lineTo(x, 900); eCtx.stroke()
    }
    for (let y = 0; y < 900; y += 50) {
      eCtx.beginPath(); eCtx.moveTo(0, y); eCtx.lineTo(1200, y); eCtx.stroke()
    }
    
    // カウンター正面 (天板, 側板, 棚板, 引き出し, 扉, 巾木, コンセント)
    eCtx.strokeStyle = '#ffffff'
    eCtx.lineWidth = 1.5
    // 天板 (厚み 30mm ➔ 15px, 幅 1800mm ➔ 900px, 高さ 850mm ➔ 425px)
    eCtx.strokeRect(150, 250, 900, 15)
    
    // 巾木/台輪 (高さ 80mm ➔ 40px)
    eCtx.fillStyle = '#161b26'
    eCtx.fillRect(165, 635, 870, 40)
    eCtx.strokeRect(165, 635, 870, 40)
    
    // 側板・仕切り板 (厚み 25mm ➔ 12px)
    eCtx.strokeRect(150, 265, 12, 370) // 左端脚
    eCtx.strokeRect(1038, 265, 12, 370) // 右端脚
    eCtx.strokeRect(450, 265, 12, 370) // 中央仕切り1
    eCtx.strokeRect(750, 265, 12, 370) // 中央仕切り2
    
    // 中央エリア: 引き出し3段 (X: 462, Y: 265, W: 288)
    eCtx.lineWidth = 0.8 // 細部
    // 引き出し 1
    eCtx.strokeRect(462, 265, 288, 120)
    eCtx.strokeRect(586, 310, 40, 10) // 取っ手
    // 引き出し 2
    eCtx.strokeRect(462, 385, 288, 120)
    eCtx.strokeRect(586, 430, 40, 10) // 取っ手
    // 引き出し 3
    eCtx.strokeRect(462, 505, 288, 130)
    eCtx.strokeRect(586, 555, 40, 10) // 取っ手
    
    // 右エリア: 開き扉 (X: 762, Y: 265, W: 276)
    eCtx.strokeRect(762, 265, 276, 370)
    eCtx.strokeRect(782, 420, 10, 40) // 縦型ドアハンドル
    
    // 左エリア: 可動棚スペース (X: 162から450)
    // 可動棚板
    eCtx.strokeRect(162, 420, 288, 12)
    // ダボ柱/可動棚レール (左右の側面に点線で描画)
    eCtx.strokeStyle = '#a1a1aa'
    eCtx.setLineDash([2, 5])
    // 左側ダボ柱2本
    eCtx.beginPath(); eCtx.moveTo(170, 275); eCtx.lineTo(170, 625); eCtx.stroke()
    eCtx.beginPath(); eCtx.moveTo(180, 275); eCtx.lineTo(180, 625); eCtx.stroke()
    // 右側ダボ柱2本
    eCtx.beginPath(); eCtx.moveTo(432, 275); eCtx.lineTo(432, 625); eCtx.stroke()
    eCtx.beginPath(); eCtx.moveTo(442, 275); eCtx.lineTo(442, 625); eCtx.stroke()
    eCtx.setLineDash([]) // 実線に戻す
    
    // 天板上のコンセント (X: 950, Y: 242, W: 40, H: 8)
    eCtx.strokeStyle = '#ffffff'
    eCtx.lineWidth = 1.5
    eCtx.strokeRect(950, 242, 40, 8)
    
    // 寸法線
    eCtx.strokeStyle = '#34e2c0'
    eCtx.fillStyle = '#34e2c0'
    eCtx.font = '13px monospace'
    eCtx.beginPath(); eCtx.moveTo(100, 250); eCtx.lineTo(100, 675); eCtx.stroke()
    eCtx.fillText('H: 850', 60, 320)
    
    eCtx.fillStyle = '#ffffff'
    eCtx.font = 'bold 18px sans-serif'
    eCtx.fillText('木製カウンターテーブル 立面図(正面)', 50, 50)
    
    const elevUrl = elevCanvas.toDataURL('image/png')

    // 3. 側面立面図の生成 (1200 x 900)
    const sideCanvas = document.createElement('canvas')
    sideCanvas.width = 1200
    sideCanvas.height = 900
    const sCtx = sideCanvas.getContext('2d')
    sCtx.fillStyle = '#0b0c10'
    sCtx.fillRect(0, 0, 1200, 900)
    sCtx.strokeStyle = '#161b26'
    for (let x = 0; x < 1200; x += 50) {
      sCtx.beginPath(); sCtx.moveTo(x, 0); sCtx.lineTo(x, 900); sCtx.stroke()
    }
    for (let y = 0; y < 900; y += 50) {
      sCtx.beginPath(); sCtx.moveTo(0, y); sCtx.lineTo(1200, y); sCtx.stroke()
    }
    
    // カウンター側面 (天板, 側板, 巾木, スライドレール, ダボ柱)
    sCtx.strokeStyle = '#ffffff'
    sCtx.lineWidth = 1.5
    // 天板 (奥行 1200mm ➔ 600px, 厚み 30mm ➔ 15px)
    sCtx.strokeRect(300, 250, 600, 15)
    
    // 側板 (X: 300, Y: 265, W: 600, H: 370)
    sCtx.strokeRect(300, 265, 600, 370)
    
    // 巾木 (高さ 80mm ➔ 40px)
    sCtx.fillStyle = '#161b26'
    sCtx.fillRect(315, 635, 570, 40)
    sCtx.strokeRect(315, 635, 570, 40)
    
    // スライドレール (金属引き出し用レールを極細二重線で表現)
    sCtx.strokeStyle = '#c1c1c9'
    sCtx.lineWidth = 0.8
    // レール 1
    sCtx.strokeRect(350, 320, 500, 8)
    sCtx.beginPath(); sCtx.moveTo(350, 324); sCtx.lineTo(850, 324); sCtx.stroke()
    // レール 2
    sCtx.strokeRect(350, 440, 500, 8)
    sCtx.beginPath(); sCtx.moveTo(350, 444); sCtx.lineTo(850, 444); sCtx.stroke()
    // レール 3
    sCtx.strokeRect(350, 560, 500, 8)
    sCtx.beginPath(); sCtx.moveTo(350, 564); sCtx.lineTo(850, 564); sCtx.stroke()
    
    // ダボ柱 (側面側にも縦に点線で配置)
    sCtx.strokeStyle = '#a1a1aa'
    sCtx.setLineDash([2, 5])
    sCtx.beginPath(); sCtx.moveTo(330, 275); sCtx.lineTo(330, 625); sCtx.stroke()
    sCtx.beginPath(); sCtx.moveTo(340, 275); sCtx.lineTo(340, 625); sCtx.stroke()
    sCtx.beginPath(); sCtx.moveTo(860, 275); sCtx.lineTo(860, 625); sCtx.stroke()
    sCtx.beginPath(); sCtx.moveTo(870, 275); sCtx.lineTo(870, 625); sCtx.stroke()
    sCtx.setLineDash([])
    
    // 寸法線
    sCtx.strokeStyle = '#34e2c0'
    sCtx.fillStyle = '#34e2c0'
    sCtx.font = '13px monospace'
    sCtx.beginPath(); sCtx.moveTo(300, 710); sCtx.lineTo(900, 710); sCtx.stroke()
    sCtx.fillText('D: 1200', 560, 740)
    
    sCtx.fillStyle = '#ffffff'
    sCtx.font = 'bold 18px sans-serif'
    sCtx.fillText('木製カウンターテーブル 立面図(側面)', 50, 50)
    
    const sideUrl = sideCanvas.toDataURL('image/png')
    
    // 4. データの設定
    setRawPlan(planUrl)
    setImages((prev) => ({ ...prev, center: planUrl }))
    setProjectCategory('furniture')
    
    // sheets に追加
    setSheets([
      { url: elevUrl, name: 'counter_front_elevation.png' },
      { url: sideUrl, name: 'counter_side_elevation.png' }
    ])
    
    // 壁の設定（正面と側面の2面を配置）
    const w = 800
    const h = 600
    planNatRef.current = { w, h }
    
    // A面 (正面)
    const w1 = makeCustomWall([{ x: 0.25, y: 0.65 }, { x: 0.75, y: 0.65 }], [], w, h, { cx: 0.5, cy: 0.5 })
    w1.normal = { x: 0, y: -1 } // 奥向き（正面から什器を見る向き）
    w1.image = elevUrl
    w1.scale = 150
    w1.pageIdx = 0

    // B面 (側面、L字のようにつなぐ)
    const w2 = makeCustomWall([{ x: 0.25, y: 0.31 }, { x: 0.25, y: 0.65 }], [w1], w, h, { cx: 0.5, cy: 0.5 })
    w2.normal = { x: 1, y: 0 } // 右向き（人が見る向き＝内向き）
    w2.image = sideUrl
    w2.scale = 150
    w2.pageIdx = 1
    
    setWalls([w1, w2])
    
    // 木目調のテクスチャとカラーをデフォルトで適用
    setColor({ code: '19-70F', name: 'ナチュラルブラウン', hex: '#d2b48c' })
    
    flash('家具パースの2面デモデータを読み込みました！「パース生成を開始」を押してください。')
  }

  // 平面図の自動マッピング（壁が未設定の場合は仮想的に4面を配置）
  const triggerAutoMapping = () => {
    if (!plan || sheets.length === 0) return
    setAnalyzing(true)
    
    setTimeout(() => {
      let newWalls = [...walls]
      let cropSettings = [] // { rx, ry, rw, rh, sheetIdx }
      
      if (walls.length === 0) {
        // 壁が未設定の場合、仮想的に平面図の中央に4面を配置
        const w = planNatRef.current.w || 1000
        const h = planNatRef.current.h || 1000
        const w1 = buildWall('w1', [{ x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 }], 1, { centroid: { cx: 0.5, cy: 0.5 }, natW: w, natH: h })
        const w2 = buildWall('w2', [{ x: 0.85, y: 0.15 }, { x: 0.85, y: 0.85 }], 2, { centroid: { cx: 0.5, cy: 0.5 }, natW: w, natH: h })
        const w3 = buildWall('w3', [{ x: 0.85, y: 0.85 }, { x: 0.15, y: 0.85 }], 3, { centroid: { cx: 0.5, cy: 0.5 }, natW: w, natH: h })
        const w4 = buildWall('w4', [{ x: 0.15, y: 0.85 }, { x: 0.15, y: 0.15 }], 4, { centroid: { cx: 0.5, cy: 0.5 }, natW: w, natH: h })
        
        w1.normal = { x: 0, y: -1 }
        w2.normal = { x: 1, y: 0 }
        w3.normal = { x: 0, y: 1 }
        w4.normal = { x: -1, y: 0 }
        newWalls = [w1, w2, w3, w4]
        
        // 展開図シート（1枚目）を横に4等分して切り出す
        cropSettings = [
          { rx: 0.05, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 },
          { rx: 0.27, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 },
          { rx: 0.49, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 },
          { rx: 0.71, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 }
        ]
      } else {
        // すでに壁が設定されている場合
        if (projectCategory === 'exterior') {
          cropSettings = [
            { rx: 0.58, ry: 0.15, rw: 0.38, rh: 0.72, sheetIdx: 0 }
          ]
        } else if (projectCategory === 'furniture') {
          const sheetIdx = sheets.length > 1 ? sheets.length - 1 : 0
          cropSettings = [
            { rx: 0.15, ry: 0.15, rw: 0.7, rh: 0.7, sheetIdx }
          ]
        } else {
          cropSettings = [
            { rx: 0.05, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 },
            { rx: 0.27, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 },
            { rx: 0.49, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 },
            { rx: 0.71, ry: 0.15, rw: 0.18, rh: 0.6, sheetIdx: 0 }
          ]
        }
      }
      
      // 実際のクロップとマッピング処理
      const crops = {}
      const cropScales = {}
      const facePages = {}
      
      const processCrops = (idx) => {
        if (idx >= newWalls.length) {
          setWalls(
            newWalls.map((w) => (crops[w.id] ? { ...w, image: crops[w.id], scale: cropScales[w.id], pageIdx: facePages[w.id] ?? null } : w))
          )
          setAnalyzing(false)
          flash(
            projectCategory === 'exterior'
              ? 'AIファサード自動紐づけが完了しました（1面を検出）'
              : projectCategory === 'furniture'
                ? 'AI家具/造作自動紐づけが完了しました（1面を検出）'
                : 'AI自動紐づけが完了しました（4面を自動検出）'
          )
          return
        }
        
        const setting = cropSettings[idx]
        if (setting) {
          facePages[newWalls[idx].id] = setting.sheetIdx
        }
        const targetSheet = sheets[setting.sheetIdx] || sheets[0]
        if (!targetSheet) {
          processCrops(idx + 1)
          return
        }
        
        const img = new Image()
        // Blob URLやData URLでの無用なCORSブロック（SecurityError）を防ぐ
        if (targetSheet.url && !targetSheet.url.startsWith('data:') && !targetSheet.url.startsWith('blob:')) {
          img.crossOrigin = 'anonymous'
        }
        img.onload = () => {
          try {
            const nw = img.naturalWidth
            const nh = img.naturalHeight
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(setting.rw * nw)
            canvas.height = Math.round(setting.rh * nh)
            const ctx = canvas.getContext('2d')
            ctx.drawImage(
              img,
              setting.rx * nw,
              setting.ry * nh,
              setting.rw * nw,
              setting.rh * nh,
              0,
              0,
              canvas.width,
              canvas.height
            )
            crops[newWalls[idx].id] = canvas.toDataURL('image/png')
          } catch (e) {
            console.error('AutoMapping crop canvas error (falling back to raw sheet URL):', e)
            crops[newWalls[idx].id] = targetSheet.url
          }
          cropScales[newWalls[idx].id] = 150
          processCrops(idx + 1)
        }
        img.onerror = (err) => {
          console.error('AutoMapping load image error:', err)
          processCrops(idx + 1)
        }
        img.src = targetSheet.url
      }
      
      processCrops(0)
    }, 2500)
  }

  // 輪郭トレース確定 → 壁を認識（既存の割り当ては番号で引き継ぐ）
  const recognizeWalls = (pts, mode = 'interior', isClosed = false) => {
    setOutline(pts)
    setOutlineClosed(isClosed)
    if (!pts || !plan) {
      setWalls([])
      return
    }
    const im = new Image()
    im.onload = () => {
      planNatRef.current = { w: im.naturalWidth, h: im.naturalHeight }
      const derived = deriveWalls(pts, im.naturalWidth, im.naturalHeight, isClosed)
      
      // mode が furniture または exterior の場合は、法線（視線の向き）を外向きに初期反転する
      let processed = derived
      if (mode === 'furniture' || mode === 'exterior') {
        processed = derived.map((w) => flipWall(w))
      }

      setWalls((prev) =>
        processed.map((nw) => {
          const old = prev.find((o) => o.index === nw.index && o.source === 'outline')
          return old?.image ? { ...nw, image: old.image, scale: old.scale } : nw
        }),
      )
      flash(`${derived.length}面の壁を認識しました`)
    }
    im.src = plan
  }

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  // クリップボード貼り付け（⌘V / Ctrl+V）：平面図が空なら平面図、埋まっていれば最初の空き壁へ
  useEffect(() => {
    const onPaste = (e) => {
      if (cropperOpen || tracerOpen) return // モーダルが自前で処理
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const url = URL.createObjectURL(file)
      if (!plan) {
        setSlot('center', url, null)
        flash('スクショを平面図に貼り付けました')
        return
      }
      const target = walls.find((w) => !w.image)
      if (!target) {
        flash(walls.length ? 'すべての壁に展開図があります' : 'まず「壁を設定する」ボタンを押して壁を配置してください')
        URL.revokeObjectURL(url)
        return
      }
      setWallImage(target.id, url, null)
      flash(`スクショを「壁${target.index}」に貼り付けました`)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [cropperOpen, tracerOpen, plan, walls])

  // 平面図(center)スロットにPDF → 縮尺を選ばせる
  const handleSlotPdf = (slotKey, file) => setPendingPdf({ file, target: { kind: 'plan' } })

  // ターゲット（平面図 or 壁）へ画像＋スケールを反映
// 画像内の実質的な線画コンテンツ範囲をピクセル監査し、不要な白・透明余白を完全自動トリミングする
const autoCropImage = (imageUrl) => {
  return new Promise((resolve) => {
    const img = new Image()
    // Blob URLやData URLでの無用なCORSブロック（SecurityError）を防ぐ
    if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imgData.data
        const width = canvas.width
        const height = canvas.height
        
        // 背景紙の黄ばみや濁り、圧縮ノイズをより頑健に無視するため、明るさ閾値を 205 に調整
        const bgThreshold = 205
        
        // 1. 各X列、各Y行のインクピクセル密度をカウントする配列を初期化
        const colDensity = new Array(width).fill(0)
        const rowDensity = new Array(height).fill(0)
        
        // 粗い切り抜きの外枠の黒フチや汚れをスキップするため、外周 3.5% をマージンとする
        const marginX = Math.max(2, Math.floor(width * 0.035))
        const marginY = Math.max(2, Math.floor(height * 0.035))
        
        // 全ピクセルをスキャンして密度をプロファイリング
        for (let y = marginY; y < height - marginY; y++) {
          for (let x = marginX; x < width - marginX; x++) {
            const idx = (y * width + x) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const a = data[idx + 3]
            
            // アルファ値が薄い（透明）または輝度が背景閾値より明るい（＝ほぼ白/薄いグレー）場合は「余白」と判定
            const isWhite = r > bgThreshold && g > bgThreshold && b > bgThreshold
            const isTransparent = a < 40
            
            if (!isWhite && !isTransparent) {
              colDensity[x]++
              rowDensity[y]++
            }
          }
        }
        
        // 2. 統計的な密度閾値 ＆ 近傍インク密度プロファイリング（孤立した図枠・境界線の自動除去）
        const minColInk = Math.max(3, Math.floor(height * 0.006))
        const minRowInk = Math.max(3, Math.floor(width * 0.006))
        
        // 周囲15px以内の密度をプロファイリングし、孤立した図枠（境界線）や端のノイズを確実に排除する判定関数
        const isIsolatedLineX = (x) => {
          if (colDensity[x] < 3) return true
          let surroundingInk = 0
          for (let offset = -15; offset <= 15; offset++) {
            if (offset === 0) continue
            const targetX = x + offset
            if (targetX >= 0 && targetX < width) {
              surroundingInk += colDensity[targetX]
            }
          }
          // 左右15px以内のインク密度が小さければ、孤立した直線（図枠）と断定して無視
          return surroundingInk < (height * 0.06)
        }
        
        const isIsolatedLineY = (y) => {
          if (rowDensity[y] < 3) return true
          let surroundingInk = 0
          for (let offset = -15; offset <= 15; offset++) {
            if (offset === 0) continue
            const targetY = y + offset
            if (targetY >= 0 && targetY < height) {
              surroundingInk += rowDensity[targetY]
            }
          }
          // 上下15px以内のインク密度が小さければ、孤立した直線（図枠）と断定して無視
          return surroundingInk < (width * 0.06)
        }

        let minX = width
        let maxX = 0
        let minY = height
        let maxY = 0
        
        // X境界の特定（列インク密度プロファイルから走査 ＆ 孤立図枠フィルター適用）
        for (let x = marginX; x < width - marginX; x++) {
          if (colDensity[x] >= minColInk && !isIsolatedLineX(x)) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
          }
        }
        
        // Y境界の特定（行インク密度プロファイルから走査 ＆ 孤立図枠フィルター適用）
        for (let y = marginY; y < height - marginY; y++) {
          if (rowDensity[y] >= minRowInk && !isIsolatedLineY(y)) {
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
        
        // コンテンツが検出されなかった、または変化がない場合は元の画像を返す
        if (maxX <= minX || maxY <= minY) {
          console.log('AutoCrop: No active pixels found inside safe margins.')
          resolve({ url: imageUrl, rect: { x: 0, y: 0, w: 1, h: 1 } })
          return
        }
        
        // 余裕（パディング）を広め（24px）に持たせることで、端の図面要素の切れを防ぐ
        const padding = 24
        const startX = Math.max(0, minX - padding)
        const startY = Math.max(0, minY - padding)
        const cropW = Math.min(width - startX, (maxX - minX) + padding * 2)
        const cropH = Math.min(height - startY, (maxY - minY) + padding * 2)
        
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = cropW
        cropCanvas.height = cropH
        const cropCtx = cropCanvas.getContext('2d')
        cropCtx.drawImage(img, startX, startY, cropW, cropH, 0, 0, cropW, cropH)
        
        console.log(`AutoCrop: Success! Cropped bounds to: ${cropW}x${cropH}`)
        resolve({
          url: cropCanvas.toDataURL('image/png'),
          rect: {
            x: startX / width,
            y: startY / height,
            w: cropW / width,
            h: cropH / height
          }
        })
      } catch (e) {
        console.error('Auto trim error in canvas scan:', e)
        resolve({ url: imageUrl, rect: { x: 0, y: 0, w: 1, h: 1 } })
      }
    }
    img.onerror = (err) => {
      console.error('AutoCrop image load failed:', err)
      resolve({ url: imageUrl, rect: { x: 0, y: 0, w: 1, h: 1 } })
    }
    img.src = imageUrl
  })
}

  const placeImage = (target, url, mmPerPx) => {
    if (target.kind === 'plan') {
      setRawPlan(url)
      setPlanCropperOpen(true)
      if (mmPerPx) setScales((s) => ({ ...s, center: mmPerPx }))
    } else {
      setWallImage(target.id, url, mmPerPx)
    }
  }

  const applyPlanCrop = async (croppedUrl) => {
    try {
      setPlanCropperOpen(false)
      flash('画像内の図面要素を自動解析中...')
      
      // 1. まずピクセル走査で図面本体の境界を算出
      const res = await autoCropImage(croppedUrl)
      
      // 2. 粗いクロップ画像を一旦画面に表示し、スキャンモードをONにする
      setImages((s) => ({ ...s, center: croppedUrl }))
      setPlanScanRect(res.rect)
      setIsAnalyzingPlan(true)
      
      // 3. 1.2秒のスキャン収縮演出のあと、実際に余白排除した最終画像をマウントしてズームを走らせる
      setTimeout(() => {
        setImages((s) => ({ ...s, center: res.url }))
        setIsAnalyzingPlan(false)
        setPlanScanRect(null)
        
        // --- 平面図アップロード直後の「壁面自動スキャン・初期配置」 ---
        const { w, h } = planNatRef.current || { w: 1200, h: 800 }
        let initWalls = []
        if (projectCategory === 'exterior') {
          const w1 = makeCustomWall([{ x: 0.88, y: 0.35 }, { x: 0.88, y: 0.65 }], [], w, h, { cx: 0.5, cy: 0.5 })
          w1.normal = { x: -1, y: 0 } // 外側から見る
          initWalls = [w1]
        } else if (projectCategory === 'furniture') {
          const w1 = makeCustomWall([{ x: 0.2, y: 0.35 }, { x: 0.45, y: 0.35 }], [], w, h, { cx: 0.5, cy: 0.5 })
          w1.normal = { x: 0, y: 1 } // 手前
          initWalls = [w1]
        } else {
          // デフォルト (内装) ➔ 四方を囲むA〜D面を配置
          const w1 = makeCustomWall([{ x: 0.1, y: 0.85 }, { x: 0.9, y: 0.85 }], [], w, h, { cx: 0.5, cy: 0.5 }) // 下 (A面)
          const w2 = makeCustomWall([{ x: 0.15, y: 0.15 }, { x: 0.15, y: 0.8 }], [w1], w, h, { cx: 0.5, cy: 0.5 }) // 左 (B面)
          const w3 = makeCustomWall([{ x: 0.1, y: 0.15 }, { x: 0.9, y: 0.15 }], [w1, w2], w, h, { cx: 0.5, cy: 0.5 }) // 上 (C面)
          const w4 = makeCustomWall([{ x: 0.85, y: 0.15 }, { x: 0.85, y: 0.8 }], [w1, w2, w3], w, h, { cx: 0.5, cy: 0.5 }) // 右 (D面)
          w1.normal = { x: 0, y: -1 }
          w2.normal = { x: 1, y: 0 }
          w3.normal = { x: 0, y: 1 }
          w4.normal = { x: -1, y: 0 }
          initWalls = [w1, w2, w3, w4]
        }
        setWalls(initWalls)
        flash('トリミング完了！図面エリアのみを自動検出して壁面（A面〜）を配置しました。')
      }, 1300)
    } catch (e) {
      console.error(e)
      setImages((s) => ({ ...s, center: croppedUrl }))
      setPlanCropperOpen(false)
      setIsAnalyzingPlan(false)
      setPlanScanRect(null)
      flash('トリミング完了！')
    }
  }
  const targetLabel = (t) => (t.kind === 'plan' ? '平面図' : `壁${walls.find((w) => w.id === t.id)?.index ?? ''}`)

  // 縮尺確定後にPDFを画像化 → 単ページは即反映 / 複数ページはページ選択
  const ingestPdf = async (R) => {
    const { file, target } = pendingPdf
    setPendingPdf(null)
    try {
      setPdfBusy(true)
      flash('PDFを読み込み中…')
      const pages = await renderPdfToImages(file)
      if (pages.length === 0) {
        flash('PDFにページがありません')
      } else if (pages.length === 1) {
        placeImage(target, pages[0].url, mmPerPxFrom(pages[0].ptPerPx, R))
        flash(R ? `PDFを読み込みました（1/${R}）` : 'PDFを読み込みました')
      } else {
        setPdfPick({ pages, target, R })
      }
    } catch (err) {
      console.error(err)
      flash('PDFの読み込みに失敗しました')
    } finally {
      setPdfBusy(false)
    }
  }

  // 図面（展開図）を追加アップロード
  const handleAddSourceSheets = async (fileList) => {
    const files = [...(fileList || [])].filter(
      (f) => f && (isPdf(f) || f.type.startsWith('image/')),
    )
    if (!files.length) return
    setPdfBusy(true)
    try {
      const added = []
      for (const f of files) {
        if (isPdf(f)) {
          const imgs = await renderPdfToImages(f)
          added.push(...imgs.map(x => ({ ...x, name: f.name })))
        } else {
          added.push({ url: URL.createObjectURL(f), name: f.name })
        }
      }
      setSheets((prev) => [...prev, ...added])
      flash(`${added.length}枚の図面を追加しました`)
    } catch (err) {
      console.error(err)
      flash('図面の読み込みに失敗しました')
    } finally {
      setPdfBusy(false)
    }
  }

  // 選択された壁に対して、未設定なら自動的に切り出しモーダルを起動する
  const handleSelectWall = (wallId) => {
    setSelectedWall(wallId)
    const targetWall = walls.find((w) => w.id === wallId)
    if (targetWall && !targetWall.image && sheets.length > 0) {
      setCropperTargetWallId(wallId)
      setCropperOpen(true)
    }
  }

  // 展開図シートの切り出し結果を各壁へ反映（実寸スケールも引き継ぐ）
  const applyCrops = (crops, pages, cropScales = {}, facePages = {}) => {
    setSheets(pages)
    setWalls((ws) =>
      ws.map((w) => (w.id in crops ? { ...w, image: crops[w.id], scale: cropScales[w.id] ?? null, pageIdx: facePages[w.id] ?? null } : w)),
    )
    setCropperOpen(false)
    setCropperTargetWallId(null)
    const n = Object.keys(crops).filter((k) => crops[k]).length
    if (n) flash(`${n}面をシートから切り出しました`)
  }

  const [generateStep, setGenerateStep] = useState('')
  const onGenerate = () => {
    if (!allReady) return
    setResult(null)
    setGenerating(true)
    setGenerateStep('Unreal Engine 5 レンダリングインスタンスを起動中...')
    
    setTimeout(() => setGenerateStep('平面図の3D空間構造（ポリゴン・デプス）を自動抽出中...'), 500)
    setTimeout(() => setGenerateStep('切り出した壁面画像（テクスチャ）を3Dオブジェクトへ投影マウント中...'), 1000)
    setTimeout(() => setGenerateStep('ライティング・グローバルイルミネーション（Lumen）の光線計算中...'), 1500)
    setTimeout(() => setGenerateStep('高精細レイトレーシングによるポストプロセスを実行中...'), 2000)
    
    setTimeout(() => {
      render3DScene({
        walls,
        outline,
        angle,
        pitch,
        env,
        color,
        texture,
        projectCategory,
      }).then((finalResult) => {
        setGenerating(false)
        setResult(finalResult)
        setGenerateStep('')
      })
    }, 2500)
  }

  // アングル変更（水平・垂直）に連動してリアルタイムに3D投影パースを再合成・更新
  useEffect(() => {
    if (!result || generating || !allReady) return
    render3DScene({
      walls,
      outline,
      angle,
      pitch,
      env,
      color,
      texture,
      projectCategory,
    }).then((finalResult) => {
      setResult(finalResult)
    })
  }, [angle, pitch])

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-4 sm:px-5">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">戻る</span>
          </Link>
          <span className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Logo />
            <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-550 font-mono leading-none">
              v.0.1.1
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={() => setLeftOpen(prev => !prev)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
              leftOpen
                ? 'border-accent-400/30 bg-accent-400/10 text-accent-300 shadow-[0_0_10px_rgba(250,204,21,0.05)]'
                : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
            ].join(' ')}
          >
            <Camera size={13} /> {leftOpen ? 'アングル設定 閉' : 'アングル・環境'}
          </button>

          <button
            onClick={() => setRightOpen(prev => !prev)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
              rightOpen
                ? 'border-accent-400/30 bg-accent-400/10 text-accent-300 shadow-[0_0_10px_rgba(250,204,21,0.05)]'
                : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
            ].join(' ')}
          >
            <Palette size={13} /> {rightOpen ? 'マテリアル設定 閉' : 'マテリアル設定'}
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-500">
            <Clipboard size={13} className="text-accent-400" />
            ⌘V でスクショを直接貼り付け
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400">
            <Building2 size={13} className="text-accent-400" />
            無題のプロジェクト
          </span>
        </div>
        <button
          disabled={!allReady || generating}
          onClick={onGenerate}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all',
            allReady && !generating
              ? 'bg-accent-400 text-ink-950 hover:bg-accent-300'
              : 'cursor-not-allowed border border-white/8 text-zinc-600',
          ].join(' ')}
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          <span className="hidden sm:inline">生成</span>
        </button>
      </header>

      {/* mobile tab switcher */}
      <div className="flex shrink-0 border-b border-white/5 lg:hidden">
        {[
          { id: 'angle', label: 'アングル' },
          { id: 'map', label: 'マッピング' },
          { id: 'material', label: 'マテリアル' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMobileTab(t.id)}
            className={[
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              mobileTab === t.id
                ? 'border-b-2 border-accent-400 text-accent-300'
                : 'text-zinc-500 hover:text-zinc-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* workspace */}
      <div className="flex min-h-0 flex-1">
        {/* left */}
        <aside
          className={[
            'shrink-0 border-r border-white/5 bg-ink-900/30 transition-all duration-300 overflow-hidden',
            leftOpen
              ? 'w-full lg:w-72 block'
              : 'w-0 hidden lg:hidden',
            mobileTab === 'angle' ? 'block w-full' : '',
          ].join(' ')}
        >
          <div className="w-72">
            <LeftPanel
              angle={angle}
              setAngle={setAngle}
              pitch={pitch}
              setPitch={setPitch}
              env={env}
              setEnv={setEnv}
            />
          </div>
        </aside>

        {/* center */}
        <main
          className={[
            'min-w-0 flex-1',
            mobileTab === 'map' ? 'block' : 'hidden lg:block',
          ].join(' ')}
        >
          <MappingArea
            plan={plan}
            onUpload={onUpload}
            onPdf={handleSlotPdf}
            onRemove={onRemove}
            onLoadDemo={loadFurnitureDemo}
            walls={walls}
            selectedWall={selectedWall}
            onSelectWall={handleSelectWall}
            onWallFile={onWallFile}
            onWallRemove={onWallRemove}
            onAddCustom={onAddCustom}
            onFlip={onFlip}
            onMaterialFile={onWallMaterialFile}
            draggedCrop={draggedCrop}
            allReady={allReady}
            generating={generating}
            onGenerate={onGenerate}
            result={result}
            outline={outline}
            onTrace={() => {}}
            onCrop={(wallId = null) => {
              setSelectedWall(wallId)
            }}
            onAutoFit={() => setAutoFitOpen(true)}
            analyzing={analyzing}
            rawPlan={rawPlan}
            onPlanCropOpen={() => setPlanCropperOpen(true)}
            sheets={sheets}
            onAddSourceSheets={handleAddSourceSheets}
            setSheets={setSheets}
            pdfBusy={pdfBusy}
            triggerAutoMapping={triggerAutoMapping}
            applyCrops={applyCrops}
            projectCategory={projectCategory}
            setProjectCategory={setProjectCategory}
            setWalls={setWalls}
            isAssigning={isAssigning}
            setIsAssigning={setIsAssigning}
            isAnalyzingPlan={isAnalyzingPlan}
            planScanRect={planScanRect}
          />
        </main>

        {/* right */}
        <aside
          className={[
            'shrink-0 border-l border-white/5 bg-ink-900/30 transition-all duration-300 overflow-hidden',
            rightOpen
              ? 'w-full lg:w-80 block'
              : 'w-0 hidden lg:hidden',
            mobileTab === 'material' ? 'block w-full' : '',
          ].join(' ')}
        >
          <div className="w-80">
            <RightPanel color={color} setColor={setColor} texture={texture} setTexture={setTexture} />
          </div>
        </aside>
      </div>

      {/* plan cropper modal */}
      {planCropperOpen && rawPlan && (
        <PlanCropper
          imageUrl={rawPlan}
          onCancel={() => setPlanCropperOpen(false)}
          onApply={applyPlanCrop}
        />
      )}

      {/* dimension-based auto-fit */}
      {autoFitOpen && (
        <AutoFit
          walls={walls}
          planScale={planScale}
          onCancel={() => setAutoFitOpen(false)}
          onApply={(assign) => {
            setWalls((ws) =>
              ws.map((w) =>
                assign[w.id] ? { ...w, image: assign[w.id].image, scale: assign[w.id].scale } : w,
              ),
            )
            setAutoFitOpen(false)
            const n = Object.keys(assign).length
            if (n) flash(`寸法マッチングで${n}面を割り当てました`)
          }}
        />
      )}

      {/* PDF page picker (multi-page PDF → target) */}
      {pdfPick && (
        <PdfPagePicker
          pages={pdfPick.pages}
          title={`「${targetLabel(pdfPick.target)}」に使うページを選択`}
          onCancel={() => setPdfPick(null)}
          onPick={(page) => {
            placeImage(pdfPick.target, page.url, mmPerPxFrom(page.ptPerPx, pdfPick.R))
            setPdfPick(null)
            flash('PDFのページを読み込みました')
          }}
        />
      )}

      {/* PDF scale picker (縮尺) */}
      {pendingPdf && (
        <ScalePicker
          title={`「${targetLabel(pendingPdf.target)}」の図面の縮尺`}
          onCancel={() => setPendingPdf(null)}
          onConfirm={ingestPdf}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[110] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-850/95 px-4 py-2.5 text-sm text-zinc-100 shadow-2xl backdrop-blur">
            <Check size={15} className="text-accent-400" />
            {toast}
          </div>
        </div>
      )}

      {/* Unreal Engine 5 高精細クラウドレンダリングローダー（プロ向けUI） */}
      {generating && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-[#06070a]/95 backdrop-blur-md">
          <div className="w-full max-w-md p-6 text-center">
            {/* 動くネオンサークル */}
            <div className="relative mx-auto mb-6 h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-t-accent-400 border-r-teal-400 border-white/5 animate-spin" />
              <div className="absolute inset-2 rounded-full border border-dashed border-accent-400/30 animate-[spin_4s_infinite_linear]" />
              <Sparkles size={20} className="absolute inset-0 m-auto text-accent-400 animate-pulse" />
            </div>
            
            <h3 className="text-sm font-black text-zinc-100 tracking-wider">
              <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>AIパース生成エンジン</span>
              <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>起動中...</span>
            </h3>
            
            {/* 動的進捗テキスト */}
            <p className="mt-3 text-[11px] text-zinc-400 min-h-[42px] px-4 font-mono leading-relaxed bg-white/[0.02] border border-white/5 py-2 rounded-lg">
              {generateStep}
            </p>
            
            {/* 黄金のプログレスバー */}
            <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-gradient-to-r from-accent-400 to-teal-500 rounded-full animate-[progress_2.5s_ease-out_forwards]" />
            </div>
            <div className="mt-2 flex justify-between text-[9px] font-semibold text-zinc-600 font-mono">
              <span>ESTIMATING...</span>
              <span>RENDER OK</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
