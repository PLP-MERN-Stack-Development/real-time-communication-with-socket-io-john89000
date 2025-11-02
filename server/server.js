// server.js - Main server file for Socket.io chat application

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and messages
const users = {};
const messages = [];
const typingUsers = {};
const rooms = {}; // roomName -> { members: Set(socketId) }

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user_join', (username) => {
    users[socket.id] = { username, id: socket.id };
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined the chat`);
  });

  // Handle chat messages
  socket.on('send_message', (messageData) => {
    const message = {
      ...messageData,
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room: messageData.room || 'global',
      reactions: {},
      readBy: [],
    };

    messages.push(message);

    // Limit stored messages to prevent memory issues
    if (messages.length > 1000) {
      messages.shift();
    }

    // Broadcast to room or global
    if (message.room && message.room !== 'global') {
      io.to(message.room).emit('room_message', message);
    } else {
      io.emit('receive_message', message);
    }
  });

  // Send a message to a specific room
  socket.on('send_room_message', ({ room, message }) => {
    const messageObj = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      room,
      reactions: {},
      readBy: [],
    };

    messages.push(messageObj);
    if (!rooms[room]) rooms[room] = { members: new Set() };
    io.to(room).emit('room_message', messageObj);
  });

  // Join a room
  socket.on('join_room', (room) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = { members: new Set() };
    rooms[room].members.add(socket.id);
    io.to(room).emit('room_user_joined', { room, user: users[socket.id] });
  });

  // Leave a room
  socket.on('leave_room', (room) => {
    socket.leave(room);
    if (rooms[room]) rooms[room].members.delete(socket.id);
    io.to(room).emit('room_user_left', { room, user: users[socket.id] });
  });

  // Handle image/file message (base64 payload)
  socket.on('send_image', ({ imageBase64, filename, room }) => {
    const messageObj = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message: filename || 'image',
      image: imageBase64,
      timestamp: new Date().toISOString(),
      room: room || 'global',
      reactions: {},
      readBy: [],
    };
    messages.push(messageObj);
    if (messageObj.room && messageObj.room !== 'global') {
      io.to(messageObj.room).emit('room_message', messageObj);
    } else {
      io.emit('receive_message', messageObj);
    }
  });

  // Read receipts
  socket.on('message_read', (messageId) => {
    const msg = messages.find((m) => m.id === messageId);
    if (msg && !msg.readBy.includes(socket.id)) {
      msg.readBy.push(socket.id);
      // notify original sender and room/global
      const payload = { messageId, reader: users[socket.id], readBy: msg.readBy };
      if (msg.room && msg.room !== 'global') {
        io.to(msg.room).emit('message_read', payload);
      } else {
        io.emit('message_read', payload);
      }
    }
  });

  // Reactions
  socket.on('react_message', ({ messageId, reaction }) => {
    const msg = messages.find((m) => m.id === messageId);
    if (msg) {
      msg.reactions[reaction] = (msg.reactions[reaction] || 0) + 1;
      const payload = { messageId, reactions: msg.reactions };
      if (msg.room && msg.room !== 'global') {
        io.to(msg.room).emit('message_reaction', payload);
      } else {
        io.emit('message_reaction', payload);
      }
    }
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      
      if (isTyping) {
        typingUsers[socket.id] = username;
      } else {
        delete typingUsers[socket.id];
      }
      
      io.emit('typing_users', Object.values(typingUsers));
    }
  });

  // Handle private messages
  socket.on('private_message', ({ to, message }) => {
    const messageData = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };
    
    socket.to(to).emit('private_message', messageData);
    socket.emit('private_message', messageData);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.emit('user_left', { username, id: socket.id });
      console.log(`${username} left the chat`);
    }
    
    delete users[socket.id];
    delete typingUsers[socket.id];
    
    io.emit('user_list', Object.values(users));
    io.emit('typing_users', Object.values(typingUsers));
  });
});

// API routes
app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io }; 