interface ConnectionStatusProps {
  isConnected: boolean
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-success' : 'bg-amber-500'
        }`}
      />
      <span className="text-secondary">
        {isConnected ? 'Live' : 'Polling'}
      </span>
    </div>
  )
}