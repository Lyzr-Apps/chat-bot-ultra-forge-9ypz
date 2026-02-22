'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { callAIAgent, extractText } from '@/lib/aiAgent'
import { IoSend, IoChatbubbleEllipses, IoAdd, IoAlertCircle } from 'react-icons/io5'
import { BsRobot } from 'react-icons/bs'
import { FiMessageSquare } from 'react-icons/fi'

// ---------- Constants ----------
const AGENT_ID = '699ad366818a4b0c3ee82a77'
const AGENT_NAME = 'Chat Assistant Agent'

// ---------- Types ----------
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  error?: boolean
}

interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  sessionId: string
}

// ---------- Sample Data ----------
const SAMPLE_SESSIONS: Session[] = [
  {
    id: 'sample-1',
    title: 'Quantum Computing Basics',
    sessionId: 'sample-session-1',
    createdAt: new Date(Date.now() - 3600000),
    messages: [
      { id: 's1m1', role: 'user', content: 'Explain quantum computing in simple terms', timestamp: new Date(Date.now() - 3600000) },
      { id: 's1m2', role: 'assistant', content: '## Quantum Computing\n\nQuantum computing uses the principles of **quantum mechanics** to process information in fundamentally different ways from classical computers.\n\n### Key Concepts\n\n- **Qubits** instead of classical bits can exist in multiple states simultaneously (superposition)\n- **Entanglement** allows qubits to be correlated regardless of distance\n- **Quantum gates** manipulate qubits to perform computations\n\n### Why It Matters\n\nQuantum computers can solve certain problems **exponentially faster** than classical computers, including:\n\n1. Drug discovery and molecular simulation\n2. Cryptography and security\n3. Optimization problems\n4. Machine learning acceleration', timestamp: new Date(Date.now() - 3590000) },
    ],
  },
  {
    id: 'sample-2',
    title: 'Write a haiku about coding',
    sessionId: 'sample-session-2',
    createdAt: new Date(Date.now() - 7200000),
    messages: [
      { id: 's2m1', role: 'user', content: 'Write a haiku about coding', timestamp: new Date(Date.now() - 7200000) },
      { id: 's2m2', role: 'assistant', content: 'Here is a haiku about coding:\n\n**Lines of logic flow**\n**Bugs hide in the silent dark**\n**One fix breaks the rest**', timestamp: new Date(Date.now() - 7190000) },
    ],
  },
  {
    id: 'sample-3',
    title: 'Best practices for REST APIs',
    sessionId: 'sample-session-3',
    createdAt: new Date(Date.now() - 86400000),
    messages: [
      { id: 's3m1', role: 'user', content: 'What are best practices for REST APIs?', timestamp: new Date(Date.now() - 86400000) },
      { id: 's3m2', role: 'assistant', content: '## REST API Best Practices\n\n### 1. Use Proper HTTP Methods\n- **GET** for reading resources\n- **POST** for creating resources\n- **PUT/PATCH** for updating resources\n- **DELETE** for removing resources\n\n### 2. Consistent Naming Conventions\n- Use plural nouns for collections: `/users`, `/products`\n- Use kebab-case: `/user-profiles`\n- Nest resources logically: `/users/{id}/orders`\n\n### 3. Status Codes\n- **200** OK\n- **201** Created\n- **400** Bad Request\n- **404** Not Found\n- **500** Internal Server Error\n\n### 4. Versioning\nAlways version your API: `/api/v1/users`\n\n### 5. Pagination\nFor list endpoints, implement pagination with `limit` and `offset` parameters.', timestamp: new Date(Date.now() - 86390000) },
    ],
  },
]

const SUGGESTED_PROMPTS = [
  'Tell me a joke',
  'Explain quantum computing',
  'Write a short poem',
]

// ---------- Markdown Renderer ----------
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ---------- Error Boundary ----------
class InlineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-[0.875rem] text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------- Helper: format time ----------
function formatTime(date: Date): string {
  const d = new Date(date)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  const m = minutes < 10 ? '0' + minutes : minutes
  return `${h}:${m} ${ampm}`
}

function formatSessionDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

// ---------- Typing Indicator ----------
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 md:px-6">
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
        <BsRobot className="w-4 h-4 text-foreground" />
      </div>
      <div className="bg-card border border-border rounded-[0.875rem] rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// ---------- Message Bubble ----------
function MessageBubble({
  message,
  onRetry,
}: {
  message: Message
  onRetry?: () => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-3 px-4 md:px-6 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
          <BsRobot className="w-4 h-4 text-foreground" />
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 shadow-sm ${isUser ? 'bg-primary text-primary-foreground rounded-[0.875rem] rounded-tr-sm' : 'bg-card border border-border text-card-foreground rounded-[0.875rem] rounded-tl-sm'}`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            renderMarkdown(message.content)
          )}
        </div>
        <span className="text-[11px] text-muted-foreground px-1">
          {formatTime(message.timestamp)}
        </span>
        {message.error && (
          <div className="flex items-center gap-2 mt-1">
            <IoAlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive">Failed to send</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Welcome State ----------
function WelcomeState({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
          <IoChatbubbleEllipses className="w-8 h-8 text-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground mb-2">
          Hello! How can I help you today?
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Start a conversation by typing a message below, or try one of these suggestions.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSuggest(prompt)}
              className="px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-accent border border-border rounded-full transition-all duration-200 hover:shadow-sm"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Sidebar ----------
function SidebarPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  sidebarOpen,
  onCloseSidebar,
}: {
  sessions: Session[]
  activeSessionId: string
  onSelectSession: (id: string) => void
  onNewChat: () => void
  sidebarOpen: boolean
  onCloseSidebar: () => void
}) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onCloseSidebar}
        />
      )}
      <aside
        className={`fixed md:relative z-40 md:z-auto top-0 left-0 h-full w-[280px] bg-[hsl(216,80%,96%)] border-r border-border flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-[0.875rem] bg-primary flex items-center justify-center">
              <IoChatbubbleEllipses className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-[-0.01em] text-foreground leading-tight">Pokie</h1>
              <p className="text-[11px] text-muted-foreground">AI-powered conversations</p>
            </div>
          </div>
          <button
            onClick={() => {
              onNewChat()
              onCloseSidebar()
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-[0.875rem] text-sm font-medium hover:opacity-90 transition-opacity duration-200"
          >
            <IoAdd className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 && (
            <div className="text-center py-8 px-4">
              <FiMessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          )}
          <div className="space-y-0.5">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id)
                  onCloseSidebar()
                }}
                className={`w-full text-left px-3 py-2.5 rounded-[0.625rem] transition-all duration-200 group ${activeSessionId === session.id ? 'bg-accent' : 'hover:bg-secondary'}`}
              >
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {session.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatSessionDate(session.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{AGENT_NAME}</span>
          </div>
        </div>
      </aside>
    </>
  )
}

// ---------- Main Page ----------
export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef<string>('')

  const displaySessions = sampleDataOn ? SAMPLE_SESSIONS : sessions
  const currentSession = displaySessions.find((s) => s.id === activeSessionId)
  const currentMessages = Array.isArray(currentSession?.messages) ? currentSession.messages : []

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages.length, loading])

  // Create new session
  const createNewSession = useCallback(() => {
    const newId = crypto.randomUUID()
    const newSessionId = crypto.randomUUID()
    sessionIdRef.current = newSessionId
    setActiveSessionId(newId)
    setInputValue('')
    return { id: newId, sessionId: newSessionId }
  }, [])

  const handleNewChat = useCallback(() => {
    createNewSession()
  }, [createNewSession])

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return

      const trimmedText = text.trim()
      setInputValue('')

      let currentId = activeSessionId
      let currentSid = sessionIdRef.current

      // If no active session or viewing sample data, create one
      if (!currentId || sampleDataOn) {
        const newSession = createNewSession()
        currentId = newSession.id
        currentSid = newSession.sessionId
        if (sampleDataOn) {
          setSampleDataOn(false)
        }
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmedText,
        timestamp: new Date(),
      }

      setSessions((prev) => {
        const existing = prev.find((s) => s.id === currentId)
        if (existing) {
          return prev.map((s) =>
            s.id === currentId
              ? {
                  ...s,
                  messages: [...s.messages, userMessage],
                  title: s.messages.length === 0 ? trimmedText.slice(0, 30) : s.title,
                }
              : s
          )
        }
        return [
          {
            id: currentId,
            title: trimmedText.slice(0, 30),
            messages: [userMessage],
            createdAt: new Date(),
            sessionId: currentSid,
          },
          ...prev,
        ]
      })

      setActiveSessionId(currentId)
      setLoading(true)
      setActiveAgentId(AGENT_ID)

      try {
        const result = await callAIAgent(trimmedText, AGENT_ID, {
          session_id: currentSid,
        })

        let responseText = ''
        if (result.success) {
          responseText = extractText(result.response)
          if (!responseText) {
            responseText = result?.response?.result?.response ?? ''
          }
          if (!responseText && typeof result?.response?.result === 'string') {
            responseText = result.response.result
          }
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseText || (result.success ? 'I received your message but have no content to display.' : 'An error occurred while processing your request.'),
          timestamp: new Date(),
          error: !result.success,
        }

        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentId
              ? { ...s, messages: [...s.messages, assistantMessage] }
              : s
          )
        )
      } catch {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'An error occurred while processing your request. Please try again.',
          timestamp: new Date(),
          error: true,
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentId
              ? { ...s, messages: [...s.messages, errorMessage] }
              : s
          )
        )
      } finally {
        setLoading(false)
        setActiveAgentId(null)
      }
    },
    [activeSessionId, loading, sampleDataOn, createNewSession]
  )

  // Retry failed message
  const retryMessage = useCallback(
    (messageIndex: number) => {
      if (!currentSession) return
      const msgs = Array.isArray(currentSession?.messages) ? currentSession.messages : []
      const userMsg = msgs[messageIndex - 1]
      if (userMsg?.role === 'user') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: s.messages.filter((_, idx) => idx !== messageIndex) }
              : s
          )
        )
        sendMessage(userMsg.content)
      }
    },
    [currentSession, activeSessionId, sendMessage]
  )

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(inputValue)
      }
    },
    [inputValue, sendMessage]
  )

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [inputValue])

  return (
    <InlineErrorBoundary>
      <div className="min-h-screen h-screen flex bg-background text-foreground overflow-hidden font-sans">
        {/* Sidebar */}
        <SidebarPanel
          sessions={displaySessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id)
            const session = displaySessions.find((s) => s.id === id)
            if (session?.sessionId) {
              sessionIdRef.current = session.sessionId
            }
          }}
          onNewChat={handleNewChat}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full" style={{ background: 'linear-gradient(135deg, hsl(214, 100%, 97%) 0%, hsl(216, 90%, 95%) 35%, hsl(220, 80%, 96%) 70%, hsl(214, 100%, 97%) 100%)' }}>
          {/* Header */}
          <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-[hsl(214,100%,97%)]/80 backdrop-blur-[16px]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <FiMessageSquare className="w-5 h-5 text-foreground" />
              </button>
              <div>
                <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
                  {currentSession?.title ?? 'New Chat'}
                </h2>
                {activeAgentId && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    Processing...
                  </p>
                )}
              </div>
            </div>

            {/* Sample Data Toggle */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground select-none">Sample Data</span>
              <button
                onClick={() => {
                  const next = !sampleDataOn
                  setSampleDataOn(next)
                  if (next) {
                    setActiveSessionId(SAMPLE_SESSIONS[0]?.id ?? '')
                  } else {
                    setActiveSessionId(sessions.length > 0 ? sessions[0].id : '')
                  }
                }}
                className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${sampleDataOn ? 'bg-primary' : 'bg-muted'}`}
                role="switch"
                aria-checked={sampleDataOn}
              >
                <span
                  className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${sampleDataOn ? 'translate-x-[18px]' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto">
            {currentMessages.length === 0 && !loading ? (
              <WelcomeState onSuggest={(text) => sendMessage(text)} />
            ) : (
              <div className="py-4 space-y-4 max-w-3xl mx-auto w-full">
                {currentMessages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onRetry={msg.error ? () => retryMessage(idx) : undefined}
                  />
                ))}
                {loading && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="border-t border-border bg-[hsl(214,100%,97%)]/80 backdrop-blur-[16px] px-4 md:px-6 py-3">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 bg-secondary border border-border rounded-[0.875rem] px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/20 transition-shadow duration-200">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  disabled={loading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed py-1 max-h-[120px]"
                />
                <button
                  onClick={() => sendMessage(inputValue)}
                  disabled={loading || !inputValue.trim()}
                  className="p-2 rounded-[0.625rem] bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 transition-all duration-200 flex-shrink-0"
                >
                  <IoSend className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </main>
      </div>
    </InlineErrorBoundary>
  )
}
