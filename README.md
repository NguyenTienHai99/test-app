# Pump.fun Chat Debugger

A real-time WebSocket debugging tool for pump.fun chat functionality, built with Next.js 15, TypeScript, and Socket.IO.

## Overview

This application provides a **server-side solution** for debugging pump.fun chat connections, bypassing CORS restrictions that prevent direct browser connections. It streams real-time chat events to your browser via Server-Sent Events (SSE).

## Features

- **Server-side WebSocket connection** to pump.fun chat servers
- **Real-time event streaming** via SSE to the browser
- **Message history** retrieval and display
- **Automatic reconnection** with exponential backoff
- **Live event monitoring** with detailed logging
- **Room-based chat** debugging for specific pump.fun tokens
- **Continuous connection** - runs until manually stopped

## Architecture

### Core Components

1. **`ServerPumpChatClient.ts`** - Server-side WebSocket client
   - Handles connection to `wss://livechat.pump.fun`
   - Manages reconnection logic and message history
   - Runs in Node.js environment to avoid browser CORS issues

2. **`app/api/chat-debug/route.ts`** - Next.js API route
   - Creates ServerPumpChatClient instances
   - Streams events to browser via SSE
   - Manages connection lifecycle

3. **`lib/server-chat-debug.ts`** - Browser SSE client
   - Handles Server-Sent Events from API route
   - Provides browser-friendly interface

4. **`app/page.tsx`** - React UI
   - Real-time log display
   - Event monitoring
   - Connection controls

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Development

```bash
npm run dev
# or
yarn dev
# or 
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the debugger.

### Usage

1. **Enter Room ID**: Use a pump.fun token contract address (default provided)
2. **Auto-connect**: The debugger automatically starts when the page loads
3. **Monitor Events**: View real-time chat messages, user joins/leaves, errors
4. **Connection Controls**: Restart, stop, or clear logs as needed

## Configuration

### Room ID Format
Room IDs are typically pump.fun token contract addresses, e.g.:
```
V5cCiSixPLAiEDX2zZquT5VuLm4prr5t35PWmjNpump
```

### Environment Variables
- `NODE_ENV=development` - Enables detailed logging in ServerPumpChatClient

## Technical Details

### Why Server-side?
Browser-based WebSocket connections to pump.fun fail due to CORS restrictions. This server-side approach:
- Runs WebSocket connection in Node.js (no CORS issues)
- Streams events to browser via SSE
- Maintains full functionality without browser limitations

### Event Types Monitored
- `connected` / `disconnected` - Connection state
- `newMessage` - New chat messages
- `messageHistory` - Historical messages
- `userJoined` / `userLeft` - User activity
- `serverError` - Server-side errors
- `maxReconnectsReached` - Connection failure

### Reconnection Strategy
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Maximum 5 reconnection attempts
- Automatic retry on unexpected disconnects

## Production Build

```bash
npm run build
npm start
```

## Development

### Project Structure
```
├── app/
│   ├── api/chat-debug/route.ts    # SSE API endpoint
│   ├── page.tsx                   # Main UI
│   └── layout.tsx                 # Root layout
├── lib/
│   └── server-chat-debug.ts       # SSE client wrapper  
├── ServerPumpChatClient.ts        # Core WebSocket client
└── package.json                   # Dependencies
```

### Key Dependencies
- **Next.js 15** - React framework
- **socket.io-client** - WebSocket client
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## Troubleshooting

### Common Issues

**No messages appearing**: 
- Verify the room ID is a valid pump.fun token address
- Check browser console for SSE connection errors
- Ensure the token has active chat activity

**Connection errors**:
- pump.fun servers may be temporarily down (502 errors)
- Check server console logs for detailed error information
- Automatic reconnection will retry failed connections

**Performance**:
- Message history is limited to 100 messages by default
- Logging can be disabled in production by setting `enableLogging: false`

## License

This project is for educational and debugging purposes. Respect pump.fun's terms of service when using this tool.
