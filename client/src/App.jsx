import React, { useEffect, useRef, useState } from 'react'
import { useSocket } from './socket/socket'

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem('chat_name') || '')
  const [message, setMessage] = useState('')
  const { connect, disconnect, sendMessage, messages, isConnected, users, setTyping, typingUsers } = useSocket()
  const typingRef = useRef(null)
  const messagesRef = useRef(null)

  useEffect(() => {
    // scroll to bottom when messages change
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  const join = () => {
    const trimmed = name.trim()
    if (trimmed) {
      localStorage.setItem('chat_name', trimmed)
      connect(trimmed)
    }
  }

  const leave = () => {
    disconnect()
  }

  const send = () => {
    if (!isConnected) return
    if (message.trim()) {
      sendMessage({ message: message.trim() })
      setMessage('')
      // stop typing when message is sent
      setTyping(false)
    }
  }

  // handle typing indicator with short debounce
  const handleTyping = (value) => {
    setMessage(value)
    if (!isConnected) return

    // emit typing true on first keystroke
    setTyping(true)

    if (typingRef.current) clearTimeout(typingRef.current)
    typingRef.current = setTimeout(() => {
      setTyping(false)
    }, 1200)
  }

  const onMessageKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString()
    } catch (e) {
      return ''
    }
  }

  const typingOthers = typingUsers.filter((u) => (users.find(s => s.username === name) ? u !== name : true))

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h2>Socket.io Chat (Assignment)</h2>

      <div style={{ marginBottom: 12 }}>
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={join} style={{ marginLeft: 8 }}>Join</button>
        <button onClick={leave} style={{ marginLeft: 8 }}>Leave</button>
        <div style={{ marginTop: 8 }}>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <h3>Chat</h3>
          <div ref={messagesRef} style={{ border: '1px solid #ddd', height: 300, overflow: 'auto', padding: 8 }}>
            {messages.map((m) => (
              <div key={m.id || Math.random()} style={{ marginBottom: 6 }}>
                {m.system ? (
                  <em style={{ color: '#666' }}>{m.message} <small style={{ color: '#999' }}>{m.timestamp ? formatTime(m.timestamp) : ''}</small></em>
                ) : (
                  <div>
                    <strong>{m.sender || m.senderId || 'Anonymous'}</strong>
                    <small style={{ marginLeft: 8, color: '#666' }}>{m.timestamp ? formatTime(m.timestamp) : ''}</small>
                    <div>{m.message}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8 }}>
            <input
              placeholder="Message"
              value={message}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={onMessageKeyDown}
              onBlur={() => setTyping(false)}
              style={{ width: '70%' }}
            />
            <button onClick={send} style={{ marginLeft: 8 }} disabled={!isConnected}>Send</button>
          </div>

          <div style={{ marginTop: 8, color: '#666' }}>
            {typingUsers.length > 0 && (
              <div>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</div>
            )}
          </div>
        </div>

        <div style={{ width: 240 }}>
          <h3>Users</h3>
          <ul>
            {users.map((u) => (
              <li key={u.id}>{u.username} {u.id && <small style={{ color: '#666' }}>({u.id.slice(0,6)})</small>}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
