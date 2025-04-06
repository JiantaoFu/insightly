import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import TextareaAutosize from 'react-textarea-autosize'

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

interface Prompt {
  id: string
  label: string
  description: string
}

export function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'

  // Add new state for tracking expanded citations
  const [expandedCitations, setExpandedCitations] = useState<{[key: string]: boolean}>({});
  const [expandedMatches, setExpandedMatches] = useState<{[key: string]: boolean}>({});

  // Add toggle functions
  const toggleDescription = (citationId: string) => {
    setExpandedCitations(prev => ({
      ...prev,
      [citationId]: !prev[citationId]
    }));
  };

  const toggleMatches = (citationId: string) => {
    setExpandedMatches(prev => ({
      ...prev,
      [citationId]: !prev[citationId]
    }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Fetch available prompts from the server
    const fetchPrompts = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/prompts`)
        const data = await response.json()
        setPrompts(data.prompts || [])
      } catch (error) {
        console.error('Failed to fetch prompts:', error)
      }
    }

    fetchPrompts()
  }, [])

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
    <div className="flex h-screen bg-gray-100">
      {/* Left-side panel for prompts */}
      <div className="w-64 bg-white border-r shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Available Prompts</h2>
        </div>
        <ul className="p-4 space-y-2">
          {prompts.map(prompt => (
            <li
              key={prompt.id}
              className="p-3 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
              onClick={() => setInput(prompt.label)}
            >
              <h3 className="text-sm font-medium text-gray-800">{prompt.label}</h3>
              <p className="text-xs text-gray-600">{prompt.description}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 items-center">
        {/* Header */}
        <div className="w-full max-w-4xl flex items-center justify-between bg-white shadow px-4 py-2">
          <Link to="/" className="text-blue-500 hover:underline">
            Back
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Chat Assistant</h1>
          <div />
        </div>

        {/* Chat Area */}
        <div className="flex-1 w-full max-w-4xl overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end w-full' : 'w-full'}`}
            >
              <div
                className={`${
                  msg.role === 'user'
                    ? 'max-w-[75%] bg-blue-500 text-white text-right self-end'
                    : 'w-full bg-gray-200 text-gray-900 text-left self-start'
                } p-3 rounded-lg break-words overflow-hidden`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 overflow-auto">
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
                            <div className="text-sm text-gray-600 mb-2">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {expandedCitations[`${msg.content}-${index}`]
                                  ? citation.description
                                  : citation.description?.substring(0, 150) + '...'}
                              </ReactMarkdown>
                              {citation.description?.length > 150 && (
                                <button
                                  onClick={() => toggleDescription(`${msg.content}-${index}`)}
                                  className="text-blue-500 hover:text-blue-600 text-sm font-medium mt-1"
                                >
                                  {expandedCitations[`${msg.content}-${index}`] ? 'Show less' : 'Show more'}
                                </button>
                              )}
                            </div>
                            {citation.matches?.length > 0 && (
                              <>
                                <button
                                  onClick={() => toggleMatches(`${msg.content}-${index}`)}
                                  className="text-blue-500 hover:text-blue-600 text-sm font-medium mb-2"
                                >
                                  {expandedMatches[`${msg.content}-${index}`] ? 'Hide matches' : `Show matches (${citation.matches.length})`}
                                </button>
                                {expandedMatches[`${msg.content}-${index}`] && (
                                  <ul className="list-disc list-inside text-gray-600">
                                    {citation.matches.map((match, matchIndex) => (
                                      <li key={matchIndex} className="mb-1">
                                        <span className="text-gray-800 font-medium">
                                          {`Score: ${(match.similarity * 100).toFixed(1)}%`}
                                        </span>
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          className="text-sm text-gray-700"
                                        >
                                          {match.content?.length > 200
                                            ? match.content.substring(0, 200) + '...'
                                            : match.content}
                                        </ReactMarkdown>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            )}
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

        {/* Input Area */}
        <form
          onSubmit={sendMessage}
          className="w-full max-w-4xl bg-white border-t p-4 flex items-center space-x-2"
        >
          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            minRows={2}
            maxRows={6}
            className="flex-1 p-2 border rounded-lg resize-none focus:outline-none focus:ring focus:ring-blue-300"
            disabled={isLoading}
            style={{ overflow: 'hidden', wordWrap: 'break-word' }} // Ensure proper resizing
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
