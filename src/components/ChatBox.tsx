import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import TextareaAutosize from 'react-textarea-autosize'
import { Menu, X } from 'lucide-react'
import { SERVER_URL } from './Constants';

// Add new interfaces for status
interface SearchStatus {
  type: 'rag' | 'tool' | 'thinking';
  message: string;
}

interface Message {
  id: string; // Add this new field
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  status?: SearchStatus[];
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
  value: string
}

interface ChatHistory {
  id: string;
  prompt?: string;
  messages: Message[];
  timestamp: number;
}

interface DrawerState {
  prompts: boolean;
  history: boolean;
}

export function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Add new state for tracking expanded citations
  const [citationsCollapsed, setCitationsCollapsed] = useState(true);
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

  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<SearchStatus | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<DrawerState>({
    prompts: false,
    history: false
  });

  const toggleDrawer = (drawer: keyof DrawerState) => {
    setDrawerOpen(prev => ({
      history: false,
      [drawer]: !prev[drawer]
    }));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setError(null) // Clear any previous errors
    setCurrentStatus({ type: 'thinking', message: 'Processing your request...' })

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Add unique id
      role: 'user',
      content: input
    }

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
          const parsed = JSON.parse(line) as (ChatResponse & {
            status?: SearchStatus;
          })

          if (parsed.status) {
            setCurrentStatus(parsed.status)
          }

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
                lastMessage.status = lastMessage.status || []
                if (currentStatus) {
                  lastMessage.status.push(currentStatus)
                }
              } else {
                newMessages.push({
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Add unique id
                  role: 'assistant',
                  content: parsed.chunk,
                  citations,
                  status: currentStatus ? [currentStatus] : []
                })
              }
              return newMessages
            })
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setError('An unexpected error occurred. Please try again.')

      // Remove the last user message if there was an error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setCurrentStatus(null)
      setIsLoading(false)
    }
  }

  // Add handler for key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  // Add status indicator component
  const StatusIndicator = ({ status }: { status: SearchStatus }) => (
    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
      {status.type === 'rag' && (
        <div className="animate-pulse flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>{status.message}</span>
        </div>
      )}
      {status.type === 'tool' && (
        <div className="animate-pulse flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{status.message}</span>
        </div>
      )}
      {status.type === 'thinking' && (
        <div className="animate-pulse flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>{status.message}</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-100 relative">
      {/* Mobile drawer overlays */}
      {drawerOpen.prompts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => toggleDrawer('prompts')} />
      )}
      {drawerOpen.history && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => toggleDrawer('history')} />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 h-full">
        {/* Header with mobile controls */}
        <div className="bg-white shadow">
          <div className="w-full max-w-4xl mx-auto flex items-center justify-between relative px-4 py-2">
            <div className="flex items-center space-x-4">
              <button className="md:hidden" onClick={() => toggleDrawer('prompts')}>
                <Menu className="w-6 h-6" />
              </button>
              <Link to="/" className="text-blue-500 hover:underline">
                Back
              </Link>
            </div>

            {/* Centered title */}
            <h1 className="text-lg font-semibold text-gray-800 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              Chat Assistant
            </h1>

            <button className="md:hidden" onClick={() => toggleDrawer('history')}>
              <Menu className="w-6 h-6 rotate-180" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full max-w-4xl p-4">
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="break-words">
              {/* Status indicators */}
              {msg.status?.map((status, i) => (
                <StatusIndicator key={i} status={status} />
              ))}
              {/* Message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                <div className={`
                  ${msg.role === 'user'
                    ? 'bg-blue-500 text-white ml-8 sm:ml-16'
                    : 'bg-gray-200 text-gray-900 mr-8 sm:mr-16'}
                  p-3 rounded-lg max-w-[85%] sm:max-w-[75%]
                `}>
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
                            <span className="mb-3 leading-relaxed text-gray-800">{children}</span>
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
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => setCitationsCollapsed(!citationsCollapsed)}
                            className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                          >
                            {citationsCollapsed ? `Show Citations (${msg.citations.length})` : 'Hide Citations'}
                          </button>

                          {!citationsCollapsed && (
                            <div className="mt-2 bg-gray-100 p-2 sm:p-4 rounded text-sm">
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
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {currentStatus && (
            <StatusIndicator status={currentStatus} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area - mobile optimized */}
        <form onSubmit={sendMessage} className="w-full bg-white border-t p-2 sm:p-4">
          <div className="w-full max-w-4xl mx-auto flex items-end space-x-2">
            <TextareaAutosize
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message... (Press Enter to send, Shift + Enter for new line)"
              minRows={1}
              maxRows={4}
              className="flex-1 p-2 border rounded-lg resize-none focus:outline-none focus:ring focus:ring-blue-300"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Chat history panel */}
      {/*
      <div className={`
        fixed md:static w-64 bg-white border-l shadow-md z-50 h-full transition-transform duration-300 right-0
        ${drawerOpen.history ? 'translate-x-0' : 'translate-x-full'}
        md:translate-x-0
      `}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Chat History</h2>
          <button className="md:hidden" onClick={() => toggleDrawer('history')}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {chatHistories.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChatHistory(chat)}
              className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                currentChatId === chat.id
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              <div className="text-sm font-semibold text-gray-800">
                {chat.prompt || 'Free Chat'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(chat.timestamp).toLocaleString()}
              </div>
              <div className="text-xs text-gray-600 mt-1 truncate">
                {chat.messages[chat.messages.length - 1]?.content.substring(0, 50)}...
              </div>
            </button>
          ))}
        </div>
      </div>
      */}
    </div>
  )
}
