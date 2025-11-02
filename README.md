[//]: # (README rewritten by coding assistant)

# Real-Time Chat — Socket.io + React (Week 5 Assignment)

Clean, focused README for the project you are working on in this workspace.

## Project summary

This repository implements a real-time chat application using Socket.io on a Node/Express server and a React (Vite) front-end. It demonstrates core real-time features and several advanced capabilities required by the Week 5 assignment.

Implemented highlights
- Username-based connection and presence (online/offline)
- Global chat and multiple chat rooms
- Private messaging between users
- Typing indicators and online user list
- File / image sharing (client-side preview and binary transfer)
- Message read receipts and delivery acknowledgements
- Message reactions (like/love/etc.)
- Browser notifications and optional sound notifications
- Unread message counters per room and global
- Optimistic send UI with server acknowledgements
- Message pagination (server API + client loader) and simple search endpoint
- Basic reconnection handling and reconnect attempt counter

Notes: messages are stored in-memory on the server for this assignment. For production use switch to a database (MongoDB/Postgres/etc.).

## Project structure

Top-level layout (key files):

```
<project root>
├── client/                 # React + Vite front-end (src/, public/)
│   ├── index.html          # Vite entry (has <!DOCTYPE html>)
│   ├── package.json
│   └── src/
│       ├── App.jsx         # Main UI and pages
│       └── socket/socket.js# Socket client (hook) and API
├── server/                 # Express + Socket.io server
│   ├── server.js           # Main server and socket event handlers
│   └── package.json
├── Week5-Assignment.md     # Assignment brief and requirements
└── README.md               # (this file)
```

## Quick start (development)

Prerequisites
- Node.js (v18+ recommended)
- npm (or yarn)

Open two terminals (one for server, one for client) and run:

PowerShell commands (copy/paste usable in the workspace on Windows):

```powershell
# from repo root
cd server
npm install
npm run dev    # starts Express + Socket.io (nodemon)

# open second terminal
cd client
npm install
npm run dev    # starts Vite dev server (default http://localhost:5173)
```

Default ports
- Server: 5000 (configurable via environment variable PORT)
- Client (Vite): 5173

If port 5000 is already in use you can find and kill it on Windows:

```powershell
netstat -ano | findstr :5000
# then stop the process with the returned PID
Stop-Process -Id <PID>
```

## How to use (manual test)

1. Open the Vite URL (http://localhost:5173) in two browser windows or separate browsers.
2. Enter a username in each window to connect.
3. Send messages in the global chat and verify real-time delivery.
4. Create/join a room and test room-scoped messages.
5. Test private messaging by selecting a user and sending a direct message.
6. Upload an image/file and confirm other clients can view/download it.
7. Check typing indicators, read receipts, reactions, and browser notifications.

## Socket events (high level)

Client -> Server (examples)
- `send_message` (global) — payload: { text, clientTempId } with callback ack (server id)
- `send_room_message` — payload: { room, text, clientTempId }
- `private_message` — payload: { to, text }
- `join_room` / `leave_room` — payload: { room }
- `typing` — payload: { room?, isTyping }
- `message_read` — payload: { messageId }
- `react_message` — payload: { messageId, reaction }

Server -> Client (examples)
- `receive_message`, `room_message`, `private_message`
- `user_list`, `user_joined`, `user_left`
- `typing_users`, `message_read`, `message_reaction`, `message_delivered`

HTTP endpoints added for helper features
- `GET /api/messages?limit=<n>&before=<timestamp|id>` — simple pagination for older messages
- `GET /api/messages/search?q=<term>` — simple search over in-memory messages

## Known limitations & recommendations

- Persistence: messages are currently stored in server memory. Restarting the server clears all messages. For real applications, add a database (MongoDB, PostgreSQL, etc.).
- Browser autoplay/audio: the WebAudio beep may require a user gesture to play on some browsers.
- Notifications: browsers require permission for the Notifications API — the client requests permission at first use.
- Scalability: with in-memory store and a single server, the app does not support horizontal scaling. Use a shared DB and a socket adapter (Redis adapter for Socket.io) in production.

## Troubleshooting

- Blank page / Quirks mode: ensure `client/index.html` includes the `<!DOCTYPE html>` declaration (this repo includes it).
- EADDRINUSE on port 5000: find the process with `netstat -ano | findstr :5000` and stop it.
- Client import errors during manual node runs: client code uses modern ESM + Vite — do not run `client/src` files directly with Node; use `npm run dev` in `client`.

## Next steps / Ideas (optional)

- Add persistent storage (messages, users) and authentication (JWT + sessions).
- Add end-to-end tests for socket flows.
- Improve file storage (S3 or server disk with cleanup), add image resizing.
- Add per-user message encryption or access control for private chats.

## Credits & License

This project was built to satisfy the Week 5 Socket.io assignment. Use this repository as a learning exercise. No license is declared — add one if you plan to publish.

---

If you want, I can also:

- add example `.env.example` and document the variables
- add a short troubleshooting script to free port 5000 on Windows
- create a sample Postgres/Mongo migration and update server storage to persist messages

Tell me which of those you'd like next and I'll implement it.
