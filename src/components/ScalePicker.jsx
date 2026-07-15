import { useState } from 'react'
import { Ruler, X } from 'lucide-react'
import { SCALE_PRESETS } from '../lib/pdf.js'

/**
 * PDFアップロード時に縮尺を選ぶ小さなダイアログ。
 * 選んだ縮尺Rでページの実寸(mm)換算が可能になり、自動フィットが実寸照合になる。
 */
export default function ScalePicker({ title = 'この図面の縮尺', onCancel, onConfirm }) {
  const [custom, setCustom] = useState('')

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-ink-950/80 p-6 backdrop-blur">
      <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-ink-850 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <Ruler size={18} className="text-accent-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">実寸で自動フィットするために使います</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-100" aria-label="閉じる">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {SCALE_PRESETS.map((s) => (
            <button
              key={s.R}
              onClick={() => onConfirm(s.R)}
              className="rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:border-accent-400/50 hover:bg-accent-400/10"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-zinc-400">1/</span>
          <input
            type="number"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="カスタム"
            className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-400/50"
          />
          <button
            onClick={() => Number(custom) > 0 && onConfirm(Number(custom))}
            disabled={!(Number(custom) > 0)}
            className="shrink-0 rounded-lg bg-accent-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-300 disabled:bg-white/10 disabled:text-zinc-600"
          >
            決定
          </button>
        </div>

        <button
          onClick={() => onConfirm(null)}
          className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
        >
          縮尺を指定しない（比率のみで照合）
        </button>
      </div>
    </div>
  )
}
