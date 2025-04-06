import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

interface Citation {
  appTitle: string
  description: string
  shareLink: string
  matches: {
    content: string
    similarity: number
  }[]
}

interface ChatResponse {
  chunk: string
  citations?: Citation[]
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
      let citations: Citation[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          const parsed = JSON.parse(line) as ChatResponse
          if (parsed.citations) {
            citations = parsed.citations // Update citations when received
          }
          if (parsed.chunk) {
            assistantResponse += parsed.chunk
            setMessages(prev => {
              const newMessages = [...prev]
              const lastMessage = newMessages[newMessages.length - 1]
              if (lastMessage?.role === 'assistant') {
                lastMessage.content += parsed.chunk
                lastMessage.citations = citations // Ensure citations are updated
              } else {
                newMessages.push({ role: 'assistant', content: parsed.chunk, citations })
              }
              return newMessages
            })
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] w-full max-w-4xl mx-auto mt-4">
      {/* Back button */}
      <div className="absolute top-4 left-4">
        <Link to="/" className="flex items-center text-gray-600 hover:text-gray-900">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      <div className="flex flex-col flex-1 border rounded-lg">
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
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-800">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mb-3 space-y-1 text-gray-800">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-800">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="ml-4 text-gray-800">{children}</li>
                        ),
                        p: ({ children }) => (
                          <p className="mb-3 leading-relaxed text-gray-800">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-900">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-gray-700">{children}</em>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-700">
                            {children}
                          </blockquote>
                        ),
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline ? (
                            <div className="relative">
                              <pre className="rounded-md bg-gray-800 p-4 overflow-x-auto">
                                <code
                                  className={`${match ? `language-${match[1]}` : ''} text-sm text-gray-100`}
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </code>
                              </pre>
                            </div>
                          ) : (
                            <code className="px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-800 text-sm">
                              {children}
                            </code>
                          );
                        },
                        a: ({ children, href }) => (
                          <a
                            href={href}
                            className="text-blue-600 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.citations && (
                      <div className="mt-4 bg-gray-100 p-4 rounded">
                        <h4 className="text-sm font-semibold text-gray-700">Citations:</h4>
                        {msg.citations.map((citation, index) => (
                          <div key={index} className="mb-4">
                            <h5 className="text-base font-semibold text-gray-800">
                              <a
                                href={citation.shareLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {citation.appTitle}
                              </a>
                            </h5>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              className="text-sm text-gray-600 mb-2"
                            >
                              {citation.description}
                            </ReactMarkdown>
                            <ul className="list-disc list-inside text-gray-600">
                              {(citation.matches || []).map((match, matchIndex) => (
                                <li key={matchIndex} className="mb-1">
                                  <span className="text-gray-800 font-medium">
                                    {`Score: ${(match.similarity * 100).toFixed(1)}%`}
                                  </span>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    className="text-sm text-gray-700"
                                  >
                                    {match.content}
                                  </ReactMarkdown>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
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
    </div>
  )
}
