// 寸法ベースの自動フィット（比率マッチング）。
// 平面図の輪郭から壁の相対長を出し、展開図の幅と一対一で近い順に割り当てる。
// 絶対寸法(mm)が無くても各列を正規化して比率でマッチするため、スケール未知でも機能する。

/**
 * 輪郭（正規化ポリゴン）のバウンディングボックスから4壁の相対長を返す。
 * 上下(背面/正面)=幅、左右(左側面/右側面)=高さ。natW/natH は平面図の実ピクセルで
 * アスペクト比を補正する。
 */
export function planWallLengths(outline, natW = 1, natH = 1) {
  if (!outline || outline.length < 3) return null
  const xs = outline.map((p) => p.x)
  const ys = outline.map((p) => p.y)
  const w = (Math.max(...xs) - Math.min(...xs)) * natW
  const h = (Math.max(...ys) - Math.min(...ys)) * natH
  return { top: w, bottom: w, left: h, right: h }
}

const FACE_LABEL = { top: 'A面', bottom: 'B面', left: 'C面', right: 'D面' }
export const faceLabel = (k) => FACE_LABEL[k] ?? k

/**
 * walls: [{ key, len }] / elevations: [{ id, width }]
 * absolute=true（両者とも実寸mm）なら相対誤差 |w-e|/max(w,e) で照合＝似寸法も区別できる。
 * absolute=false なら各列を最大値で正規化して比率照合＝スケール未知でも順序で合う。
 * 返り値: [{ wall, elevation, cost }]（cost は 0..1、小さいほど一致）
 */
export function autoMatch(walls, elevations, absolute = false) {
  const wMax = Math.max(...walls.map((w) => w.len || 0), 1e-6)
  const eMax = Math.max(...elevations.map((e) => e.width || 0), 1e-6)

  const cost = (w, e) =>
    absolute
      ? Math.abs(w.len - e.width) / Math.max(w.len, e.width, 1e-6)
      : Math.abs(w.len / wMax - e.width / eMax)

  const pairs = []
  for (const w of walls) {
    for (const e of elevations) {
      if (!(w.len > 0) || !(e.width > 0)) continue
      pairs.push({ wall: w.key, elevation: e.id, cost: cost(w, e) })
    }
  }
  pairs.sort((a, b) => a.cost - b.cost)

  const usedW = new Set()
  const usedE = new Set()
  const out = []
  for (const p of pairs) {
    if (usedW.has(p.wall) || usedE.has(p.elevation)) continue
    usedW.add(p.wall)
    usedE.add(p.elevation)
    out.push(p)
  }
  return out
}
