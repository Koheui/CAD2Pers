import { ScanSearch } from 'lucide-react'

/**
 * 平面図アップロード直後に流れる「空間解析」演出。
 * 平面図を3Dに傾けてゆっくりターンテーブル回転させ、スキャンラインを走らせる。
 */
export default function PlanAnalyzing({ image }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-ink-950/80 backdrop-blur-sm">
      <div className="plan-stage" style={{ perspective: '1100px' }}>
        <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
          <div
            className="plan-rotor relative h-52 w-72 sm:h-60 sm:w-80"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* base glow / shadow */}
            <div
              className="absolute -inset-6 rounded-2xl opacity-60 blur-2xl"
              style={{ background: 'radial-gradient(ellipse at center, rgba(52,226,192,0.35), transparent 70%)' }}
            />
            {/* the plan itself */}
            <img
              src={image}
              alt="平面図"
              className="absolute inset-0 h-full w-full rounded-lg object-cover opacity-90"
            />
            <div className="absolute inset-0 rounded-lg bg-ink-950/20" />
            <div className="bp-grid-fine absolute inset-0 rounded-lg opacity-70" />
            <div className="absolute inset-0 rounded-lg ring-1 ring-accent-400/60" />
            {/* corner ticks */}
            {[
              'left-1 top-1 border-l-2 border-t-2',
              'right-1 top-1 border-r-2 border-t-2',
              'left-1 bottom-1 border-l-2 border-b-2',
              'right-1 bottom-1 border-r-2 border-b-2',
            ].map((c) => (
              <span key={c} className={`absolute h-4 w-4 border-accent-400 ${c}`} />
            ))}
            {/* scan line */}
            <div
              className="plan-scan absolute inset-x-0 h-10"
              style={{
                background:
                  'linear-gradient(to bottom, transparent, rgba(52,226,192,0.55), transparent)',
                boxShadow: '0 0 24px 4px rgba(52,226,192,0.45)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="w-64 text-center sm:w-72">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-100">
          <ScanSearch size={16} className="text-accent-400" />
          空間を解析中<span className="animate-pulse">…</span>
        </p>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="plan-progress h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-300" />
        </div>
        <p className="mt-2.5 text-xs text-zinc-500">平面図から空間を立体認識しています</p>
      </div>
    </div>
  )
}
