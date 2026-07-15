import * as THREE from 'three'

let renderer = null
let scene = null
let camera = null

// 画像の読み込みヘルパー
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// テクスチャ用のキャンバス合成 (マテリアル背景 + CAD展開図線画の乗算)
async function createWallTexture(wall, selectedColor, selectedTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  // 1. 背景の描画 (個別壁の素材画像 > 全体テクスチャ > 全体カラー)
  let bgImgSrc = wall.materialImage
  
  // テクスチャストックが選択されている場合はその色/パターンを適用
  const bgImg = await loadImage(bgImgSrc)
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)
  } else if (selectedTexture && selectedTexture.tone) {
    // 擬似テクスチャパターン
    ctx.fillStyle = selectedTexture.tone
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 斜め線などで簡易テクスチャ感を表現
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
    ctx.lineWidth = 4
    for (let i = -canvas.width; i < canvas.width; i += 32) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + canvas.height, canvas.height)
      ctx.stroke()
    }
  } else {
    // カラー適用
    ctx.fillStyle = selectedColor?.hex || '#18181b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // 2. 展開図（CAD線画）を乗算合成
  const lineImg = await loadImage(wall.image)
  if (lineImg) {
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.9
    ctx.drawImage(lineImg, 0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1.0
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

/**
 * 3Dシーンを構築しレンダリング結果(Data URL)を返す
 */
export async function render3DScene({
  walls = [],
  outline = null,
  angle = 45,
  pitch = 10,
  env = 'urban',
  color = null,
  texture = null,
  projectCategory = 'interior',
  width = 1920,
  height = 1080,
}) {
  if (typeof window === 'undefined') return ''

  // 1. レンダラーの初期化（シングルトン）
  if (!renderer) {
    const canvas = document.createElement('canvas')
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
  }
  renderer.setSize(width, height)

  // 2. シーンとライトの構築
  scene = new THREE.Scene()
  
  // 周辺環境に応じた背景と環境光の設定
  let bgColor = 0x0a0b10
  let ambientIntensity = 0.5
  let dirIntensity = 0.8
  let lightColor = 0xffffff

  if (env === 'natural') {
    bgColor = 0x141a24 // 朝・夕方の自然光
    ambientIntensity = 0.6
    dirIntensity = 0.9
    lightColor = 0xfff3e0 // 暖かい太陽光
  } else if (env === 'abstract') {
    bgColor = 0x020205 // 暗めのギャラリー風
    ambientIntensity = 0.3
    dirIntensity = 1.2
    lightColor = 0xe0f2f1 // 冷たいスタジオ光
  }

  scene.background = new THREE.Color(bgColor)

  const ambientLight = new THREE.AmbientLight(lightColor, ambientIntensity)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(lightColor, dirIntensity)
  dirLight.position.set(10, 15, 8)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.bias = -0.001
  scene.add(dirLight)

  // 補助のソフトライト
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
  fillLight.position.set(-10, 5, -8)
  scene.add(fillLight)

  // 3. 部屋の寸法と重心の計算
  // 座標系: 2D平面図上の (0..1) を、3Dの X-Z 平面（-5..5）にマッピング
  const scaleXZ = 10.0
  const wallHeight = 2.8 // 壁の高さ（ユニット）

  // 重心の計算
  let cx = 0
  let cz = 0
  let ptsCount = 0

  if (outline && outline.length >= 3) {
    outline.forEach(p => {
      cx += p.x
      cz += p.y
    })
    ptsCount = outline.length
  } else if (walls.length > 0) {
    // outlineがない場合はwallsのポイントから算出
    const allPts = []
    walls.forEach(w => {
      if (w.points) {
        w.points.forEach(p => allPts.push(p))
      } else {
        allPts.push(w.a, w.b)
      }
    })
    const uniquePts = Array.from(new Set(allPts.map(p => `${p.x},${p.y}`))).map(s => {
      const [x, y] = s.split(',').map(Number)
      return { x, y }
    })
    uniquePts.forEach(p => {
      cx += p.x
      cz += p.y
    })
    ptsCount = uniquePts.length
  }

  cx = ptsCount > 0 ? (cx / ptsCount - 0.5) * scaleXZ : 0
  cz = ptsCount > 0 ? (cz / ptsCount - 0.5) * scaleXZ : 0

  // 4. 床と天井の生成 (ShapeGeometry)
  let shapePoints = []
  if (outline && outline.length >= 3) {
    shapePoints = outline.map(p => new THREE.Vector2((p.x - 0.5) * scaleXZ, (p.y - 0.5) * scaleXZ))
  } else if (walls.length > 0) {
    // 簡易的に walls をつなげて外郭を構築
    shapePoints = walls.map(w => new THREE.Vector2((w.a.x - 0.5) * scaleXZ, (w.a.y - 0.5) * scaleXZ))
  }

  if (shapePoints.length >= 3) {
    const shape = new THREE.Shape(shapePoints)
    
    // 床
    const floorGeo = new THREE.ShapeGeometry(shape)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x24252a,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    })
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.rotation.x = Math.PI / 2 // 水平に
    floorMesh.position.y = 0
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    // 天井 (内装モードの場合のみ天井を生成し、かつカリングされないように裏面も描画)
    if (projectCategory === 'interior') {
      const ceilGeo = new THREE.ShapeGeometry(shape)
      const ceilMat = new THREE.MeshStandardMaterial({
        color: 0x1c1d22,
        roughness: 0.9,
        side: THREE.DoubleSide
      })
      const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat)
      ceilMesh.rotation.x = Math.PI / 2
      ceilMesh.position.y = wallHeight
      ceilMesh.receiveShadow = true
      scene.add(ceilMesh)
    }
  }

  // 5. 各壁の生成とテクスチャマッピング
  if (projectCategory !== 'furniture') {
    for (const w of walls) {
      const pts = w.points || [w.a, w.b]
      if (pts.length < 2) continue

      // 各セグメントごとに壁を組み立て
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i]
        const p2 = pts[i+1]

        const x1 = (p1.x - 0.5) * scaleXZ
        const z1 = (p1.y - 0.5) * scaleXZ
        const x2 = (p2.x - 0.5) * scaleXZ
        const z2 = (p2.y - 0.5) * scaleXZ

        const dx = x2 - x1
        const dz = z2 - z1
        const wallLen = Math.hypot(dx, dz)
        
        const wallGeo = new THREE.PlaneGeometry(wallLen, wallHeight)
        
        // 壁のテクスチャを Canvas 合成で作成
        const tex = await createWallTexture(w, color, texture)
        
        const wallMat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.8,
          metalness: 0.05,
          side: THREE.DoubleSide, // 表裏両方描画
        })

        const wallMesh = new THREE.Mesh(wallGeo, wallMat)
        
        // 位置と回転の設定
        const mx = (x1 + x2) / 2
        const mz = (z1 + z2) / 2
        wallMesh.position.set(mx, wallHeight / 2, mz)
        
        const angleY = -Math.atan2(dz, dx)
        wallMesh.rotation.y = angleY

        wallMesh.castShadow = true
        wallMesh.receiveShadow = true
        scene.add(wallMesh)
      }
    }
  }

  // 家具モード用に、中央にシンプルな家具（カウンターテーブルなど）の3Dモックを精密に構築
  if (projectCategory === 'furniture' && walls.length > 0) {
    const tableGroup = new THREE.Group()

    // 2方向の壁（展開図）から幅、奥行、高さを動的に適用
    const W = 1.8  // 幅 1800mm (メートル単位)
    const H = 0.85 // 高さ 850mm (メートル単位)
    
    // B面（側面壁、インデックス2）の長さから実際のテーブルの奥行き（D）を算出
    const sideWall = walls.find(w => w.index === 2)
    let D = 1.2    // デフォルトの奥行き 1200mm (L字の奥行きサイズ)
    if (sideWall) {
      const pts = sideWall.points || [sideWall.a, sideWall.b]
      if (pts.length >= 2) {
        const dx = (pts[1].x - pts[0].x) * scaleXZ
        const dz = (pts[1].y - pts[0].y) * scaleXZ
        D = Math.hypot(dx, dz)
      }
    }

    const T_top = 0.03   // 天板厚み 30mm
    const T_shelf = 0.02 // 中棚厚み 20mm
    const Y_shelf = 0.42 // 可動棚の初期高さ
    const D_panel = 0.6  // カウンターの天板パネル単体の奥行き 600mm
    const legHeight = H - T_top - 0.08 // キャビネット側板の高さ (巾木高 80mm を除く)

    // マテリアル定義
    const woodColor = color?.hex || 0xd2b48c
    const woodMat = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.6,
      metalness: 0.1,
    })
    
    // 側板・仕切り板用 (黒いマット塗装風)
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7,
    })

    // 1. L字天板の動的押し出し (ExtrudeGeometry)
    const shape = new THREE.Shape()
    shape.moveTo(-W/2, -D/2)
    shape.lineTo(W/2, -D/2)
    shape.lineTo(W/2, -D/2 + D_panel)
    shape.lineTo(-W/2 + D_panel, -D/2 + D_panel)
    shape.lineTo(-W/2 + D_panel, D/2)
    shape.lineTo(-W/2, D/2)
    
    const extrudeSettings = {
      depth: T_top,
      bevelEnabled: false
    }
    const topGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    const topMesh = new THREE.Mesh(topGeo, woodMat)
    topMesh.rotation.x = -Math.PI / 2 // 水平に回転
    topMesh.position.y = H // 天板の上面を高さHに合わせる
    topMesh.castShadow = true
    topMesh.receiveShadow = true
    tableGroup.add(topMesh)

    // 2. 巾木 / 台輪 (高さ 80mm, 奥まり 15mm の黒いベースプレート)
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.8 })
    // 正面側巾木
    const p1Geo = new THREE.BoxGeometry(W - 0.03, 0.08, D_panel - 0.03)
    const p1Mesh = new THREE.Mesh(p1Geo, plinthMat)
    p1Mesh.position.set(0.015, 0.04, -D/2 + (D_panel - 0.015))
    p1Mesh.castShadow = true
    p1Mesh.receiveShadow = true
    tableGroup.add(p1Mesh)

    // 側面側巾木 (正面側とL字結合するように配置)
    const p2Geo = new THREE.BoxGeometry(D_panel - 0.03, 0.08, D - D_panel)
    const p2Mesh = new THREE.Mesh(p2Geo, plinthMat)
    p2Mesh.position.set(-W/2 + (D_panel - 0.015), 0.04, D/2 - (D - D_panel)/2)
    p2Mesh.castShadow = true
    p2Mesh.receiveShadow = true
    tableGroup.add(p2Mesh)

    // 3. 側板および縦の仕切り板 (厚み 25mm)
    const panelGeo = new THREE.BoxGeometry(0.025, legHeight, D_panel)
    const pX = [-W/2 + 0.0125, -W/2 + 0.6, -W/2 + 1.2, W/2 - 0.0125]
    pX.forEach(x => {
      const panel = new THREE.Mesh(panelGeo, legMat)
      panel.position.set(x, 0.08 + legHeight / 2, -D/2 + D_panel/2)
      panel.castShadow = true
      panel.receiveShadow = true
      tableGroup.add(panel)
    })

    // 4. 中央エリア: 引き出し 3段 (X: -W/2 + 0.6 〜 -W/2 + 1.2 の間)
    const dFrontGeo = new THREE.BoxGeometry(0.57, 0.22, 0.02)
    const dY = [0.08 + 0.11, 0.08 + 0.35, 0.08 + 0.59]
    
    // 金属金物用マテリアル (取っ手、スライドレール)
    const hardwareMat = new THREE.MeshStandardMaterial({
      color: 0xc1c1c9,
      metalness: 0.9,
      roughness: 0.15,
    })

    dY.forEach((y) => {
      // 引き出し前板 (3mmの隙間(目地)が生じるように配置)
      const dFront = new THREE.Mesh(dFrontGeo, woodMat)
      dFront.position.set(-W/2 + 0.9, y, -D/2 + D_panel - 0.01)
      dFront.castShadow = true
      dFront.receiveShadow = true
      tableGroup.add(dFront)
      
      // 取っ手 (ステンレス円柱つまみ)
      const pullGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 16)
      const pull = new THREE.Mesh(pullGeo, hardwareMat)
      pull.rotation.x = Math.PI / 2
      pull.position.set(-W/2 + 0.9, y, -D/2 + D_panel + 0.01)
      pull.castShadow = true
      tableGroup.add(pull)

      // 金属スライドレール (引き出しの側板部分に左右対で配置。隙間からきらりと見せる)
      const railGeo = new THREE.BoxGeometry(0.005, 0.025, 0.5)
      const leftRail = new THREE.Mesh(railGeo, hardwareMat)
      leftRail.position.set(-W/2 + 0.6 + 0.015, y, -D/2 + D_panel/2)
      tableGroup.add(leftRail)
      
      const rightRail = leftRail.clone()
      rightRail.position.set(-W/2 + 1.2 - 0.015, y, -D/2 + D_panel/2)
      tableGroup.add(rightRail)
    })

    // 5. 右エリア: 開き扉 (X: -W/2 + 1.2 〜 W/2 の間)
    const doorGeo = new THREE.BoxGeometry(0.57, legHeight - 0.01, 0.02)
    const door = new THREE.Mesh(doorGeo, woodMat)
    door.position.set(W/2 - 0.3, 0.08 + legHeight / 2, -D/2 + D_panel - 0.01)
    door.castShadow = true
    door.receiveShadow = true
    tableGroup.add(door)

    // ドアハンドル (縦型ステンレスプル)
    const doorPullGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 16)
    const doorPull = new THREE.Mesh(doorPullGeo, hardwareMat)
    doorPull.position.set(W/2 - 0.52, 0.08 + legHeight / 2, -D/2 + D_panel + 0.01)
    doorPull.castShadow = true
    tableGroup.add(doorPull)

    // 6. 左エリア: 可動棚とダボ柱レール (X: -W/2 〜 -W/2 + 0.6 の間)
    const shelfGeo = new THREE.BoxGeometry(0.56, 0.02, D_panel - 0.04)
    const shelf = new THREE.Mesh(shelfGeo, woodMat)
    shelf.position.set(-W/2 + 0.3, Y_shelf, -D/2 + D_panel/2)
    shelf.castShadow = true
    shelf.receiveShadow = true
    tableGroup.add(shelf)

    // 可動棚用ダボ柱 (縦に長い金属レール)
    const trackGeo = new THREE.BoxGeometry(0.002, legHeight - 0.05, 0.01)
    const tracksPos = [
      [-W/2 + 0.026, -D/2 + 0.05],
      [-W/2 + 0.026, -D/2 + D_panel - 0.05],
      [-W/2 + 0.6 - 0.026, -D/2 + 0.05],
      [-W/2 + 0.6 - 0.026, -D/2 + D_panel - 0.05]
    ]
    
    tracksPos.forEach(([x, z]) => {
      const track = new THREE.Mesh(trackGeo, hardwareMat)
      track.position.set(x, 0.08 + legHeight / 2, z)
      tableGroup.add(track)

      // 棚受けのダボピン (ダボ柱と中棚の接点に配置)
      const pinGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.015, 8)
      const pin = new THREE.Mesh(pinGeo, hardwareMat)
      pin.rotation.x = Math.PI / 2
      pin.position.set(x, Y_shelf, z)
      tableGroup.add(pin)
    })

    // 7. 天板コンセントプレート (右奥に配置)
    const plateGeo = new THREE.BoxGeometry(0.12, 0.002, 0.06)
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.7 })
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.position.set(W/2 - 0.15, H, -D/2 + 0.15)
    plate.castShadow = true
    plate.receiveShadow = true
    tableGroup.add(plate)

    // 2口コンセント差し込み口のモールド
    const plugGeo = new THREE.BoxGeometry(0.025, 0.003, 0.015)
    const plugMat = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.9 })
    
    const plug1 = new THREE.Mesh(plugGeo, plugMat)
    plug1.position.set(W/2 - 0.17, H + 0.0005, -D/2 + 0.15)
    tableGroup.add(plug1)

    const plug2 = plug1.clone()
    plug2.position.set(W/2 - 0.13, H + 0.0005, -D/2 + 0.15)
    tableGroup.add(plug2)

    tableGroup.position.set(cx, 0, cz)
    scene.add(tableGroup)
  }

  // 6. カメラの設定
  const angleRad = (angle * Math.PI) / 180
  const pitchRad = (pitch * Math.PI) / 180

  if (!camera) {
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
  }
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  if (projectCategory === 'interior') {
    // 内観（インサイドアウト）: カメラは重心に立ち、首を回す
    camera.position.set(cx, 1.3, cz)
    // カメラのターゲット方向ベクトル
    const tx = cx + Math.sin(angleRad) * Math.cos(pitchRad)
    const ty = 1.3 + Math.sin(pitchRad)
    const tz = cz - Math.cos(angleRad) * Math.cos(pitchRad)
    camera.lookAt(new THREE.Vector3(tx, ty, tz))
  } else {
    // 外観・家具（アウトサイドイン）: 中心を見つめてカメラが周りを回る
    const r = projectCategory === 'furniture' ? 6.5 : 12.0
    const px = cx + r * Math.sin(angleRad) * Math.cos(pitchRad)
    const py = 1.3 + r * Math.sin(pitchRad)
    const pz = cz + r * Math.cos(angleRad) * Math.cos(pitchRad)
    camera.position.set(px, py, pz)
    camera.lookAt(new THREE.Vector3(cx, 1.0, cz))
  }

  // 7. レンダリングの実行と画像の取得
  renderer.render(scene, camera)
  const dataUrl = renderer.domElement.toDataURL('image/png')

  // メモリリーク防止のためシーンオブジェクトを破棄
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })

  return dataUrl
}
