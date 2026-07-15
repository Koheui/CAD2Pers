// 平面図の輪郭ポリゴンから壁セグメントを認識する幾何エンジン。
// 折れ線（マルチポイント）をサポートし、凹凸のある柱型や什器パスを壁として定義可能にします。

let CUSTOM_SEQ = 0

/**
 * 壁を構築。points は正規化座標の配列 [ {x, y}, ... ]。natW/natH で長さのアスペクトを補正。
 * centroid（正規化重心）があれば法線を内向きに揃える。
 */
export function buildWall(id, points, index, { centroid, natW = 1, natH = 1, source = 'outline' } = {}) {
  if (!points || points.length < 2) return null

  // 1. 中点（全頂点の平均値）の計算
  const mid = {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  }

  // 2. 折れ線の総延長（長さ）の計算
  let length = 0
  for (let i = 0; i < points.length - 1; i++) {
    length += Math.hypot((points[i+1].x - points[i].x) * natW, (points[i+1].y - points[i].y) * natH)
  }

  // 3. 法線ベクトルの計算（始点と終点を結ぶ線に直交する向き）
  const start = points[0]
  const end = points[points.length - 1]
  let nx = -(end.y - start.y)
  let ny = end.x - start.x
  const nlen = Math.hypot(nx, ny) || 1
  nx /= nlen
  ny /= nlen

  if (centroid) {
    const dot = nx * (centroid.cx - mid.x) + ny * (centroid.cy - mid.y)
    if (dot < 0) {
      nx = -nx
      ny = -ny
    }
  }

  return {
    id,
    points, // 折れ線パス頂点のリスト [{x, y}, ...]
    a: points[0], // 後方互換性のため、始点をaとする
    b: points[points.length - 1], // 後方互換性のため、終点をbとする
    mid,
    index,
    length, // px（natW/natH補正済み）。実寸mmは length × scale
    normal: { x: nx, y: ny },
    source, // 'outline' | 'custom'
    image: null,
    scale: null, // mm/px
    flip: false,
  }
}

/**
 * 輪郭（正規化ポリゴン）から壁配列を生成。閉多角形として N 辺を返す。
 */
export function deriveWalls(outline, natW = 1, natH = 1, isClosed = false) {
  if (!outline || outline.length < 2) return []
  const n = outline.length
  const closed = n >= 3 && isClosed
  const cx = outline.reduce((s, p) => s + p.x, 0) / n
  const cy = outline.reduce((s, p) => s + p.y, 0) / n
  const count = closed ? n : n - 1
  const walls = []
  for (let i = 0; i < count; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % n]
    const w = buildWall(`w${i + 1}`, [a, b], i + 1, { centroid: { cx, cy }, natW, natH, source: 'outline' })
    if (w) walls.push(w)
  }
  return walls
}

/**
 * 任意の折れ線パス（ふかし壁・柱型など）を壁として作る。
 */
export function makeCustomWall(points, existing, natW = 1, natH = 1, centroid = null) {
  const index = (existing.reduce((m, w) => Math.max(m, w.index), 0) || 0) + 1
  const wall = buildWall(`c${++CUSTOM_SEQ}`, points, index, { centroid, natW, natH, source: 'custom' })
  return wall
}

/** 法線を反転 */
export function flipWall(wall) {
  return { ...wall, flip: !wall.flip, normal: { x: -wall.normal.x, y: -wall.normal.y } }
}

/** 表示用の壁長ラベル。 */
export function wallLengthLabel(wall) {
  if (wall.scale) return `${Math.round(wall.length * wall.scale)} mm`
  return `${Math.round(wall.length)} rel`
}

export function wallChar(index) {
  if (index < 1) return '?'
  let label = ''
  let temp = index - 1
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label
    temp = Math.floor(temp / 26) - 1
  }
  return label
}

export function wallLabel(index) {
  return `${wallChar(index)}面`
}
