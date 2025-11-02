// socket.js - Socket.io client setup

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [localUsername, setLocalUsername] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByRoom, setUnreadByRoom] = useState({});
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Connect to socket server
  const connect = (username) => {
    socket.connect();
    if (username) {
      socket.emit('user_join', username);
      setLocalUsername(username);
    }
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
  };

  // Send a message (optimistic UI with clientTempId and server ack)
  const sendMessage = (message) => {
    const clientTempId = `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const pending = {
      id: clientTempId,
      clientTempId,
      sender: localUsername || 'Me',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, pending]);

    socket.emit('send_message', { message, clientTempId }, (ack) => {
      if (ack && ack.id) {
        setMessages((prev) => prev.map((m) => (m.clientTempId && m.clientTempId === ack.clientTempId ? { ...m, id: ack.id, pending: false } : m)));
      }
    });
  };

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    socket.emit('private_message', { to, message });
  };

  const sendRoomMessage = (room, message) => {
    const clientTempId = `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const pending = {
      id: clientTempId,
      clientTempId,
      sender: localUsername || 'Me',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      room,
      pending: true,
    };
    setMessages((prev) => [...prev, pending]);
    socket.emit('send_room_message', { room, message, clientTempId }, (ack) => {
      if (ack && ack.id) {
        setMessages((prev) => prev.map((m) => (m.clientTempId && m.clientTempId === ack.clientTempId ? { ...m, id: ack.id, pending: false } : m)));
      }
    });
  };

  const joinRoom = (room) => {
    socket.emit('join_room', room);
    setCurrentRoom(room);
    if (!rooms.includes(room)) setRooms((r) => [...r, room]);
  };

  const leaveRoom = (room) => {
    socket.emit('leave_room', room);
    setCurrentRoom(null);
  };

  const sendImage = ({ file, room }) => {
    const reader = new FileReader();
    const clientTempId = `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    reader.onload = () => {
      const imageBase64 = reader.result;
      const pending = {
        id: clientTempId,
        clientTempId,
        sender: localUsername || 'Me',
        senderId: socket.id,
        message: file.name,
        image: imageBase64,
        timestamp: new Date().toISOString(),
        room,
        pending: true,
      };
      setMessages((prev) => [...prev, pending]);
      socket.emit('send_image', { imageBase64, filename: file.name, room, clientTempId }, (ack) => {
        if (ack && ack.id) {
          setMessages((prev) => prev.map((m) => (m.clientTempId && m.clientTempId === ack.clientTempId ? { ...m, id: ack.id, pending: false } : m)));
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const markRead = (messageId) => {
    socket.emit('message_read', messageId);
  };

  const reactMessage = (messageId, reaction) => {
    socket.emit('react_message', { messageId, reaction });
  };

  // Set typing status
  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  // Socket event listeners
  useEffect(() => {
    // request notification permission proactively
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().catch(() => {})
    }

    // simple sound via WebAudio
    const playSound = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = 720
        g.gain.value = 0.02
        o.connect(g)
        g.connect(ctx.destination)
        o.start()
        setTimeout(() => { o.stop(); ctx.close() }, 120)
      } catch (e) {
        // ignore audio errors
      }
    }

    const showBrowserNotification = (title, body) => {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body })
        }
      } catch (e) {
        // ignore
      }
    }
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
      setReconnectAttempts(0);
      // re-announce username on reconnect
      if (localUsername) socket.emit('user_join', localUsername);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onReconnectAttempt = (attempt) => {
      setReconnectAttempts(attempt);
    };

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      // replace pending message created by this client if clientTempId present
      if (message.clientTempId) {
        setMessages((prev) => prev.map((m) => (m.clientTempId && m.clientTempId === message.clientTempId ? { ...message, pending: false } : m)));
      } else {
        setMessages((prev) => [...prev, message]);
      }
      // notifications & unread
      if (message.senderId !== socket.id) {
        const pageHidden = typeof document !== 'undefined' ? document.hidden : false;
        const notInSameRoom = message.room && currentRoom !== message.room;
        if (pageHidden || notInSameRoom) {
          setUnreadCount((c) => c + 1);
          if (message.room) setUnreadByRoom((r) => ({ ...r, [message.room]: (r[message.room] || 0) + 1 }));
        }
        try { playSound(); } catch (e) {}
        try { showBrowserNotification(`${message.sender || 'New message'}`, message.message || 'New message'); } catch (e) {}
      }
      // send delivered ack back to server
      if (message.id) socket.emit('delivered', message.id);
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
      if (message.senderId !== socket.id) {
        setUnreadCount((c) => c + 1);
        try { playSound(); } catch (e) {}
        try { showBrowserNotification(`Private: ${message.sender}`, message.message || 'New private message'); } catch (e) {}
      }
    };

    const onRoomMessage = (message) => {
      setLastMessage(message);
      if (message.clientTempId) {
        setMessages((prev) => prev.map((m) => (m.clientTempId && m.clientTempId === message.clientTempId ? { ...message, pending: false } : m)));
      } else {
        setMessages((prev) => [...prev, message]);
      }
      if (message.room && !rooms.includes(message.room)) setRooms((r) => [...r, message.room]);
      if (message.senderId !== socket.id) {
        const pageHidden = typeof document !== 'undefined' ? document.hidden : false;
        const notInSameRoom = currentRoom !== message.room;
        if (pageHidden || notInSameRoom) {
          setUnreadCount((c) => c + 1);
          setUnreadByRoom((r) => ({ ...r, [message.room]: (r[message.room] || 0) + 1 }));
        }
        try { playSound(); } catch (e) {}
        try { showBrowserNotification(`${message.sender || 'Room message'}`, message.message || `New message in ${message.room}`); } catch (e) {}
      }
      if (message.id) socket.emit('delivered', message.id);
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
      if (user && user.username !== localUsername) {
        try { playSound(); } catch (e) {}
        try { showBrowserNotification('User joined', `${user.username} joined`); } catch (e) {}
      }
    };

    const onUserLeft = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
      if (user && user.username !== localUsername) {
        try { playSound(); } catch (e) {}
        try { showBrowserNotification('User left', `${user.username} left`); } catch (e) {}
      }
    };

    // Typing events
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    const onMessageRead = ({ messageId, reader, readBy }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, readBy } : m)));
      // decrement unread if reader is current user
      if (reader && reader.id === socket.id) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    };

    const onMessageReaction = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    };

    const onMessageDelivered = ({ messageId, deliveredBy }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deliveredBy } : m)));
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
  socket.on('room_message', onRoomMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.on('message_read', onMessageRead);
  socket.on('message_reaction', onMessageReaction);
  socket.on('message_delivered', onMessageDelivered);

    // Clean up event listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('room_message', onRoomMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('message_read', onMessageRead);
      socket.off('message_reaction', onMessageReaction);
      socket.off('message_delivered', onMessageDelivered);
    };
  }, []);

  // Pagination: load older messages from server
  const loadOlderMessages = async (limit = 50) => {
    const before = messages.length ? messages[0].timestamp : new Date().toISOString();
    try {
      const res = await fetch(`${SOCKET_URL}/api/messages?limit=${limit}&before=${encodeURIComponent(before)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        // prepend older messages
        setMessages((prev) => [...data, ...prev]);
      }
      return data;
    } catch (e) {
      return [];
    }
  };

  const searchMessages = async (q) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/messages/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      return data || [];
    } catch (e) {
      return [];
    }
  };

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    sendRoomMessage,
    joinRoom,
    leaveRoom,
    sendImage,
    markRead,
    reactMessage,
    setTyping,
    rooms,
    currentRoom,
    unreadCount,
    unreadByRoom,
    loadOlderMessages,
    searchMessages,
    reconnectAttempts,
  };
};

export default socket; 