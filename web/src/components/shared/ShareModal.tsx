/**
 * ShareModal — overlay showing a shareable creature URL with copy button.
 *
 * Displays the encoded chromosome URL, a "Copy" button,
 * and an "Open in Playground" link.
 */

import { useState, useCallback, useEffect } from 'react'

interface ShareModalProps {
  url: string
  onClose: () => void
}

export default function ShareModal({ url, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
      const input = document.querySelector<HTMLInputElement>('[data-share-url]')
      if (input) {
        input.select()
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }, [url])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative bg-bg border border-border p-6 max-w-lg w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-text-primary">
            Share Creature
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* URL field */}
        <div className="flex gap-2 mb-4">
          <input
            data-share-url
            type="text"
            value={url}
            readOnly
            className="flex-1 bg-bg-surface border border-border px-3 py-2 font-mono text-[11px] text-text-secondary
                       focus:outline-none focus:border-accent select-all"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopy}
            className={`px-4 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors cursor-pointer border
              ${copied
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'bg-accent/10 border-accent text-accent hover:bg-accent/20'}`}
          >
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>

        {/* Info */}
        <p className="font-mono text-[10px] text-text-dim">
          This URL contains the creature's full chromosome. Anyone with the link
          can view and modify it in the Playground.
        </p>
      </div>
    </div>
  )
}
