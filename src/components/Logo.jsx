export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        className="shrink-0"
        aria-hidden
      >
        <rect x="1.5" y="1.5" width="29" height="29" rx="6" stroke="currentColor" strokeOpacity="0.25" />
        <path d="M6 22V10l10-4 10 4v12" stroke="var(--color-accent-400)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6 10l10 4 10-4M16 14v12" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      <div className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight text-zinc-50">
          スマートパース<span className="text-accent-400"> AI</span>
        </span>
        <span className="block text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500">
          Smart Parse
        </span>
      </div>
    </div>
  )
}
