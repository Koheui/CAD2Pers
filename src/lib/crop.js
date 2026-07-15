/**
 * 多角形（Polygon）の頂点リストを元に、Canvasクリッピングマスクを用いて画像を切り抜く
 * @param {string} imageUrl - ソース画像URL（Data/Blob/Remote）
 * @param {Array<{x: number, y: number}>} points - 正規化座標（0..1）の頂点リスト
 * @param {number} padding - 切り抜き領域の周囲に持たせる余白（ピクセル）
 * @returns {Promise<string>} - 切り抜かれた透明PNGのData URL
 */
export function cropPolygonToDataUrl(imageUrl, points, padding = 8) {
  return new Promise((resolve, reject) => {
    if (!points || points.length < 3) {
      resolve(imageUrl)
      return
    }

    const img = new Image()
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight

      // 実寸ピクセル座標に変換
      const pxPoints = points.map((p) => ({ x: p.x * w, y: p.y * h }))

      // 多角形のバウンディングボックスを求める
      const xs = pxPoints.map((p) => p.x)
      const ys = pxPoints.map((p) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)

      const boxW = maxX - minX
      const boxH = maxY - minY

      // 余裕（パディング）を考慮した切り出しキャンバスサイズ
      const startX = Math.max(0, minX - padding)
      const startY = Math.max(0, minY - padding)
      const cropW = Math.min(w - startX, boxW + padding * 2)
      const cropH = Math.min(h - startY, boxH + padding * 2)

      if (cropW <= 0 || cropH <= 0) {
        resolve(imageUrl)
        return
      }

      // 切り出し用のCanvas
      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')

      // クリッピングパスの生成
      ctx.beginPath()
      const firstX = pxPoints[0].x - startX
      const firstY = pxPoints[0].y - startY
      ctx.moveTo(firstX, firstY)

      for (let i = 1; i < pxPoints.length; i++) {
        ctx.lineTo(pxPoints[i].x - startX, pxPoints[i].y - startY)
      }
      ctx.closePath()

      // クリッピングマスクを適用！
      ctx.clip()

      // マスクの内側に画像を描画
      ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, cropW, cropH)

      // インク要素（線画）がある部分だけをさらに自動検出して余白を排除（オートクレンジング）
      try {
        const imgData = ctx.getImageData(0, 0, cropW, cropH)
        const data = imgData.data
        
        let minPX = cropW
        let maxPX = 0
        let minPY = cropH
        let maxPY = 0
        
        // 図面の背景（白や薄いグレー、ノイズ）を無視するための閾値
        const bgThreshold = 205
        
        // 境界のノイズを無視するため、外周 1.5% のみをスキャンマージンとする
        const marginX = Math.max(1, Math.floor(cropW * 0.015))
        const marginY = Math.max(1, Math.floor(cropH * 0.015))
        
        for (let y = marginY; y < cropH - marginY; y++) {
          for (let x = marginX; x < cropW - marginX; x++) {
            const idx = (y * cropW + x) * 4
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
        
        // コンテンツが検出された場合は、その領域だけで再切り出しを行う！
        if (maxPX > minPX && maxPY > minPY) {
          const finalPadding = 6
          const finalX = Math.max(0, minPX - finalPadding)
          const finalY = Math.max(0, minPY - finalPadding)
          const finalW = Math.min(cropW - finalX, (maxPX - minPX) + finalPadding * 2)
          const finalH = Math.min(cropH - finalY, (maxPY - minPY) + finalPadding * 2)
          
          if (finalW > 0 && finalH > 0) {
            const finalCanvas = document.createElement('canvas')
            finalCanvas.width = finalW
            finalCanvas.height = finalH
            const finalCtx = finalCanvas.getContext('2d')
            finalCtx.drawImage(canvas, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH)
            
            console.log(`cropPolygonToDataUrl: Auto cleaned crop from ${cropW}x${cropH} down to ${finalW}x${finalH}`)
            resolve(finalCanvas.toDataURL('image/png'))
            return
          }
        }
      } catch (e) {
        console.error('Error auto-cleaning crop contents:', e)
      }

      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = (err) => {
      console.error('cropPolygonToDataUrl load error:', err)
      resolve(imageUrl)
    }

    img.src = imageUrl
  })
}
