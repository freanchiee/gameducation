'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/lib/types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'

interface ConversationFeedProps {
  messages: Message[]
  aiState: AIState
}

export default function ConversationFeed({ messages, aiState }: ConversationFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiState])

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4 bg-[#ece8c7]">
      {messages.length === 0 && aiState === 'processing' && (
        <div className="flex items-center gap-2 text-[#6d7b93] text-sm">
          <span className="inline-flex gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
          </span>
          AI is preparing your first question...
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'ai' ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              message.role === 'ai'
                ? 'bg-[#f4f4f5] border border-[#cdd2dd] text-[#2b427f] rounded-tl-sm shadow-sm'
                : 'bg-[#24408f] text-white rounded-tr-sm'
            }`}
          >
            {message.role === 'ai' && (
              <p className="text-xs font-medium text-[#24408f] mb-1">AI Examiner</p>
            )}
            {message.content}
          </div>
        </div>
      ))}

      {/* AI thinking indicator */}
      {aiState === 'processing' && messages.length > 0 && (
        <div className="flex justify-start">
          <div className="bg-[#f4f4f5] border border-[#cdd2dd] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-[#24408f] mb-2">AI Examiner</p>
            <span className="inline-flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
