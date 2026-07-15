// 日塗工（JPMA）カラーのサンプルデータ。
// 実運用では正式なマンセル→HEX変換テーブルに置き換える想定のダミー値。
export const JPMA_COLORS = [
  { code: 'N-90', hex: '#E4E4E2', name: 'ライトグレー' },
  { code: 'N-70', hex: '#B0B1AE', name: 'ミディアムグレー' },
  { code: 'N-50', hex: '#7C7D7A', name: 'ニュートラルグレー' },
  { code: 'N-30', hex: '#4A4B49', name: 'ダークグレー' },
  { code: '19-90A', hex: '#EDE6D6', name: 'オフホワイト' },
  { code: '19-80D', hex: '#DAC9A2', name: 'ベージュ' },
  { code: '19-70F', hex: '#C4A76A', name: 'サンドオーカー' },
  { code: '19-50H', hex: '#9A7A3C', name: 'マスタード' },
  { code: '22-70B', hex: '#B7A98C', name: 'グレージュ' },
  { code: '25-70B', hex: '#A7A98F', name: 'セージグレー' },
  { code: '25-60D', hex: '#8C9166', name: 'オリーブ' },
  { code: '25-40H', hex: '#5A6136', name: 'モスグリーン' },
  { code: '45-70B', hex: '#93A6A0', name: 'ミストブルーグリーン' },
  { code: '65-60B', hex: '#8497A8', name: 'スモークブルー' },
  { code: '69-40D', hex: '#3F5468', name: 'インディゴグレー' },
  { code: '09-60H', hex: '#B75B45', name: 'テラコッタ' },
  { code: '07-40F', hex: '#7A3A32', name: 'ブリックレッド' },
  { code: '15-90A', hex: '#F0E7D2', name: 'クリーム' },
  { code: '17-85B', hex: '#E8D6B0', name: 'ライトウッド' },
  { code: '02-30B', hex: '#2E2724', name: 'チャコールブラウン' },
]

export const TEXTURE_CATEGORIES = [
  {
    id: 'wood',
    label: '木目',
    items: [
      { name: 'オーク（柾目）', tone: '#b98d54' },
      { name: 'ウォルナット', tone: '#5a3d29' },
      { name: 'メープル', tone: '#d8b483' },
      { name: 'チーク', tone: '#9a6a3c' },
      { name: 'アッシュ', tone: '#c9b291' },
      { name: 'ブラックオーク', tone: '#3f3126' },
    ],
  },
  {
    id: 'stone',
    label: '石材',
    items: [
      { name: 'カラーラ大理石', tone: '#e6e6e2' },
      { name: 'トラバーチン', tone: '#d8cbb2' },
      { name: 'グレー御影石', tone: '#8f9195' },
      { name: 'ブラックマーブル', tone: '#2b2b2f' },
      { name: 'ライムストーン', tone: '#cbc2ac' },
      { name: 'テラゾー', tone: '#c4bcae' },
    ],
  },
  {
    id: 'cloth',
    label: 'クロス',
    items: [
      { name: 'リネン（生成）', tone: '#d9d2c2' },
      { name: '塗り壁調', tone: '#e2ddd3' },
      { name: 'コンクリート打放し', tone: '#9c9c9a' },
      { name: 'グレーファブリック', tone: '#8a8a86' },
      { name: 'モルタル', tone: '#b3b0a8' },
      { name: 'ダークウォール', tone: '#33322f' },
    ],
  },
  {
    id: 'metal',
    label: '金属',
    items: [
      { name: 'ヘアラインSUS', tone: '#b7babd' },
      { name: 'ブラックスチール', tone: '#38393c' },
      { name: '真鍮（ブラス）', tone: '#b08d3f' },
      { name: 'アルミアノダイズ', tone: '#a9adb1' },
      { name: 'コッパー', tone: '#a5623c' },
      { name: 'ブロンズ', tone: '#6e5637' },
    ],
  },
]

export const ENVIRONMENTS = [
  { id: 'urban', label: '都会の街並み', hint: 'ビル群・都市の光' },
  { id: 'forest', label: '緑豊かな森', hint: '自然光・植栽' },
  { id: 'studio', label: 'スタジオ（無地）', hint: '白背景・均一光' },
  { id: 'coast', label: '海辺・リゾート', hint: '明るい自然光' },
  { id: 'night', label: '夜景・ムード', hint: '間接照明・暗所' },
  { id: 'gallery', label: 'ギャラリー', hint: '美術館的な均質光' },
]
