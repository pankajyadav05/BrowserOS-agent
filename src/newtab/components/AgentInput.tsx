import React, { useState, useRef, useEffect } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { cn } from '@/sidepanel/lib/utils'

interface AgentInputProps {
  className?: string
}

export function AgentInput({ className }: AgentInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [input])

  // Focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return

    const query = input.trim()

    // Clear input immediately for better UX
    setInput('')

    // Send execution request directly to background script
    chrome.runtime.sendMessage({
      type: MessageType.EXECUTE_QUERY,
      payload: {
        query,
        chatMode: false,
        metadata: {
          source: 'newtab'
        }
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to execute query:', chrome.runtime.lastError)
      } else {
        console.log('Query execution started:', response)
      }
    })

    // Open sidepanel to show execution progress
    try {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    } catch (error) {
      console.error('Failed to open sidepanel:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-end w-full">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className={cn(
                'min-h-[120px] max-h-[400px] resize-none pr-16 text-base w-full',
                'bg-background/80 backdrop-blur-sm border-2 border-brand/30',
                'focus-visible:outline-none focus-visible:border-brand/60 focus-visible:shadow-lg focus-visible:shadow-brand/10',
                'focus:outline-none focus:border-brand/60 focus:shadow-lg focus:shadow-brand/10',
                'hover:border-brand/50 hover:bg-background/90 hover:shadow-md',
                'rounded-2xl shadow-sm',
                'px-6 py-4',
                'transition-all duration-300 ease-out'
              )}
              rows={3}
              aria-label="AI agent input"
              aria-describedby="input-hint"
            />

            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-4 bottom-4 h-10 w-10 p-0 rounded-full bg-brand hover:bg-brand/90 text-white shadow-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </form>

      <p
        id="input-hint"
        className="mt-3 text-center text-sm text-muted-foreground"
      >
        Press Enter to send • Shift + Enter for new line
      </p>
    </div>
  )
}
