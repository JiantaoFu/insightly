import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  chunk: string
}

export function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages
        })
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Failed to get response reader')

      const decoder = new TextDecoder()
      let assistantResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          const { chunk: text } = JSON.parse(line) as ChatResponse
          assistantResponse += text
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMessage = newMessages[newMessages.length - 1]
            if (lastMessage?.role === 'assistant') {
              lastMessage.content += text
            } else {
              newMessages.push({ role: 'assistant', content: text })
            }
            return newMessages
          })
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto border rounded-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-lg p-3 break-words ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // This is the key change:
                    // We are now rendering code blocks directly,
                    // and not wrapping them in <p> tags.
                    code({ node, inline, className, children, ...props }) {
                      const codeContent = String(children);
                      return !inline ? (
                        <pre className="bg-gray-800 text-white p-3 rounded-md overflow-x-auto">
                          <code {...props}>{codeContent}</code>
                        </pre>
                      ) : (
                        <code className="bg-gray-200 px-1 rounded" {...props}>
                          {codeContent}
                        </code>
                      );
                    },
                    // This is the key change:
                    // We are now rendering paragraphs directly,
                    // and not wrapping them in <p> tags.
                    p: ({ node, children }) => {
                      return <>{children}</>;
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
