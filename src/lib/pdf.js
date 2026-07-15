// pdf.js は重い（worker含む）ため、実際にPDFを扱うときだけ動的import で読み込む。
// isPdf は同期判定のみでpdf.jsに依存させない（初期バンドルを軽く保つ）。

export const isPdf = (file) =>
  !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''))

// 図面の縮尺プリセット（R = 分母。1/50 なら R=50）
export const SCALE_PRESETS = [
  { label: '1/20', R: 20 },
  { label: '1/30', R: 30 },
  { label: '1/50', R: 50 },
  { label: '1/100', R: 100 },
  { label: '1/150', R: 150 },
  { label: '1/200', R: 200 },
]

const MM_PER_PT = 25.4 / 72 // PDFのポイント(1/72inch)→mm

/**
 * ページの「ポイント/ピクセル」と図面縮尺Rから、1ピクセルあたりの実寸(mm)を返す。
 * mmPerPx = ptPerPx × (25.4/72) × R
 */
export const mmPerPxFrom = (ptPerPx, R) =>
  ptPerPx && R ? ptPerPx * MM_PER_PT * R : null

let pdfjsPromise = null
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjsLib
    })()
  }
  return pdfjsPromise
}

/**
 * PDFの各ページを白背景の画像に変換して返す。
 * 図面の可読性を確保しつつ、巨大キャンバスを避けるため最大辺を上限でスケールする。
 * 返り値: [{ url, ptPerPx }]（ptPerPx は縮尺→実寸換算に使う。1/scale）
 */
export async function renderPdfToImages(file, { maxDim = 2400, maxPages = 30 } = {}) {
  const pdfjsLib = await getPdfjs()
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pageCount = Math.min(pdf.numPages, maxPages)
  const pages = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(3, maxDim / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    // PDFは背景透過のことがあるため白で塗ってから描画
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    pages.push({ url: canvas.toDataURL('image/png'), ptPerPx: 1 / scale })
  }
  return pages
}
