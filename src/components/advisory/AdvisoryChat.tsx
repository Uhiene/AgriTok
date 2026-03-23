// AdvisoryChat — Streaming SSE chat modal with Anthropic via Supabase Edge Function
// Rate limited: 10 messages per farmer per day (enforced server-side)
// Streams responses using text/event-stream

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Loader } from 'lucide-react'
import type { Farm } from '../../types'

// ── Types ─────────────────────────────────────────────────────

interface WeatherSnapshot {
  temp_c:      number
  humidity:    number
  condition:   string
  description: string
}

interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

interface Props {
  farm:      Farm
  farmerId:  string
  cropType:  string
  location?: string
  weather?:  WeatherSnapshot
  onClose:   () => void
}

// ── Constants ─────────────────────────────────────────────────

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ── Typing indicator ──────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-forest-mid/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3 py-2.5 rounded-card font-body text-sm leading-relaxed whitespace-pre-line ${
          isUser
            ? 'bg-accent-green text-forest-dark rounded-br-sm'
            : 'bg-forest-dark/[0.05] text-forest-dark rounded-bl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function AdvisoryChat({ farm, farmerId, cropType, location, weather, onClose }: Props) {
  const [messages,      setMessages]      = useState<ChatMessage[]>([])
  const [input,         setInput]         = useState('')
  const [isStreaming,   setIsStreaming]   = useState(false)
  const [rateLimited,   setRateLimited]   = useState(false)
  const [streamingText, setStreamingText] = useState('')

  const scrollRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef   = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingText])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/crop-advisor`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'apikey':        SUPABASE_ANON,
        },
        body: JSON.stringify({
          mode:         'chat',
          crop_type:    cropType,
          location:     location ?? farm.location_name,
          weather,
          message:      text,
          chat_history: messages, // exclude latest user msg (server appends it)
          farmer_id:    farmerId,
          farm_id:      farm.id,
        }),
        signal: abortRef.current.signal,
      })

      if (res.status === 429) {
        setRateLimited(true)
        setIsStreaming(false)
        return
      }

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (!payload) continue
          try {
            const evt = JSON.parse(payload) as { text?: string; done?: boolean }
            if (evt.text) {
              fullText += evt.text
              setStreamingText(fullText)
            } else if (evt.done) {
              setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
              setStreamingText('')
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setIsStreaming(false)
      setStreamingText('')
      inputRef.current?.focus()
    }
  }, [input, isStreaming, messages, cropType, location, weather, farmerId, farm])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Dismiss on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(13,43,30,0.07)] flex-shrink-0">
          <div>
            <p className="font-body text-sm font-semibold text-forest-dark">AI Crop Advisor</p>
            <p className="font-body text-xs text-text-muted">{cropType} — {location ?? farm.location_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.04] transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-8">
              <p className="font-body text-sm text-text-muted">
                Ask me anything about your {cropType} crop — weather impacts, pest control, market timing, and more.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <Bubble key={i} msg={msg} />
          ))}

          {/* Streaming assistant response */}
          {isStreaming && (
            streamingText
              ? <Bubble msg={{ role: 'assistant', content: streamingText }} />
              : <div className="flex justify-start"><div className="bg-forest-dark/[0.05] rounded-card rounded-bl-sm"><TypingDots /></div></div>
          )}

          {/* Rate limit notice */}
          {rateLimited && (
            <div className="bg-amber-50 border border-amber-200 rounded-card px-3 py-2.5">
              <p className="font-body text-xs text-amber-700">
                Daily message limit reached (10 messages/day). Come back tomorrow.
              </p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[rgba(13,43,30,0.07)] flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || rateLimited}
              placeholder="Ask about your crop..."
              rows={1}
              className="flex-1 resize-none rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-forest-dark px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-green/40 disabled:opacity-50 max-h-28 overflow-y-auto"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 112)}px`
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming || rateLimited}
              className="flex-shrink-0 w-10 h-10 rounded-card bg-accent-green flex items-center justify-center text-forest-dark hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isStreaming
                ? <Loader size={15} strokeWidth={2} className="animate-spin" />
                : <Send size={15} strokeWidth={2} />
              }
            </button>
          </div>
          <p className="font-body text-[10px] text-text-muted mt-1.5 text-right">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>

      </div>
    </div>
  )
}
