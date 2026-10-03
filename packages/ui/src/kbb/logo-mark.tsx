export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="10" fill="var(--primary)" />
      <path
        d="M9 21.5c3-6.5 7.5-10 14-11"
        stroke="var(--primary-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9.5" cy="21.5" r="3" fill="var(--blush)" />
      <circle cx="23" cy="10.5" r="3" fill="var(--primary-foreground)" />
    </svg>
  );
}
