interface AlertBadgeProps {
  count: number
  onClick?: () => void
}

export function AlertBadge({ count, onClick }: AlertBadgeProps) {
  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-8 h-8 bg-danger/20 rounded-full hover:bg-danger/30 transition-colors"
    >
      <svg className="w-4 h-4 text-danger" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span className="absolute -top-1 -right-1 bg-danger text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  )
}