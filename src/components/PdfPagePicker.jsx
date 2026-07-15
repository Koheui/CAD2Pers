import { FileText, X } from 'lucide-react'

/**
 * 複数ページPDFから使用するページを1枚選ぶモーダル。
 * pages は各ページの画像(dataURL)の配列。
 */
export default function PdfPagePicker({ pages, title = 'ページを選択', onPick, onCancel }) {
  return (
    <div className="fixed inset-0 z-[105] flex flex-col bg-ink-950/95 backdrop-blur">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <FileText size={17} className="text-accent-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            <p className="text-xs text-zinc-500">全 {pages.length} ページ — サムネイルをクリックで選択</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-100" aria-label="閉じる">
          <X size={20} />
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map((page, i) => (
            <button
              key={i}
              onClick={() => onPick(page)}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white transition-all hover:border-accent-400 hover:ring-2 hover:ring-accent-400/40"
            >
              <img src={page.url} alt={`ページ ${i + 1}`} className="aspect-[3/4] w-full object-contain" />
              <span className="absolute left-2 top-2 rounded-md bg-ink-950/80 px-2 py-0.5 text-[11px] font-medium text-zinc-100 backdrop-blur">
                P.{i + 1}
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-accent-400 py-1.5 text-center text-xs font-semibold text-ink-950 opacity-0 transition-opacity group-hover:opacity-100">
                このページを使う
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
