import { NextRequest } from 'next/server';
import { ServerPumpChatClient, IMessage } from '../../../ServerPumpChatClient';

// Store active connections to prevent memory leaks
const activeConnections = new Map<string, ServerPumpChatClient>();

interface LogData {
  message: string;
  timestamp: string;
}

interface EventData {
  eventName: string;
  args: unknown[];
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId') || 'J2eaKn35rp82T6RFEsNK9CLRHEKV9BLXjedFM3q6pump';
  const username = searchParams.get('username') || `TestUser${Math.random().toString(36).substr(2, 5)}`;

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const connectionId = `${roomId}-${username}-${Date.now()}`;
      
      // Clean up any existing connection for this room
      const existingConnection = activeConnections.get(roomId);
      if (existingConnection) {
        existingConnection.disconnect();
        activeConnections.delete(roomId);
      }

      const client = new ServerPumpChatClient({
        roomId,
        username,
        messageHistoryLimit: 100
      });

      activeConnections.set(connectionId, client);

      // Helper function to send SSE data
      const sendEvent = (event: string, data: LogData | EventData) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
      };

      // Send initial log
      sendEvent('log', { 
        message: `🚀 Starting server-side pump.fun chat debug...`,
        timestamp: new Date().toLocaleTimeString()
      });
      
      sendEvent('log', { 
        message: `🏠 Room ID: ${roomId}`,
        timestamp: new Date().toLocaleTimeString()
      });
      
      sendEvent('log', { 
        message: `👤 Username: ${username}`,
        timestamp: new Date().toLocaleTimeString()
      });

      // Set up event listeners
      client.on('connected', () => {
        sendEvent('log', { 
          message: `✅ Server-side Socket.IO Connected! Socket ID: ${client.getConnectionInfo().socketId}`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'connected', 
          args: [client.getConnectionInfo()],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('disconnected', () => {
        sendEvent('log', { 
          message: `🔌 Server-side Socket.IO Disconnected`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'disconnected', 
          args: [],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('error', (error: Error) => {
        sendEvent('log', { 
          message: `❌ Server-side Connection error: ${error.message}`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'error', 
          args: [{ message: error.message, type: error.constructor.name }],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('message', (message: IMessage) => {
        sendEvent('log', { 
          message: `📩 New message from ${message.username}: ${message.message}`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'newMessage', 
          args: [message],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('messageHistory', (messages: IMessage[]) => {
        sendEvent('log', { 
          message: `📜 Received message history: ${messages.length} messages`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'messageHistory', 
          args: [{ messages }],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('userJoined', (data: { username: string; userAddress: string }) => {
        sendEvent('log', { 
          message: `👋 User joined: ${data.username}`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'userJoined', 
          args: [data],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('userLeft', (userAddress: string) => {
        sendEvent('log', { 
          message: `👋 User left: ${userAddress}`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'userLeft', 
          args: [userAddress],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('serverError', (error: string) => {
        sendEvent('log', { 
          message: `🚨 Server Error: ${error}`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'serverError', 
          args: [error],
          timestamp: new Date().toLocaleTimeString()
        });
      });

      client.on('maxReconnectsReached', () => {
        sendEvent('log', { 
          message: `❌ Max reconnection attempts reached. Connection failed.`,
          timestamp: new Date().toLocaleTimeString()
        });
        sendEvent('event', { 
          eventName: 'maxReconnectsReached', 
          args: [],
          timestamp: new Date().toLocaleTimeString()
        });
        
        // Clean up and close stream
        setTimeout(() => {
          activeConnections.delete(connectionId);
          controller.close();
        }, 1000);
      });

      // Start the connection
      sendEvent('log', { 
        message: `🔄 Attempting server-side WebSocket connection...`,
        timestamp: new Date().toLocaleTimeString()
      });
      
      client.connect();

      // Auto-disconnect after 30 seconds
      setTimeout(() => {
        sendEvent('log', { 
          message: `⏰ Test completed. Disconnecting...`,
          timestamp: new Date().toLocaleTimeString()
        });
        client.disconnect();
        activeConnections.delete(connectionId);
        controller.close();
      }, 30000);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        client.disconnect();
        activeConnections.delete(connectionId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, roomId, message } = body;

  if (action === 'sendMessage' && roomId && message) {
    // Find the active connection for this room
    const connection = Array.from(activeConnections.values()).find(
      conn => conn.getConnectionInfo().roomId === roomId
    );

    if (connection && connection.isActive()) {
      connection.sendMessage(message);
      return Response.json({ success: true, message: 'Message sent' });
    } else {
      return Response.json({ success: false, error: 'No active connection found' }, { status: 400 });
    }
  }

  return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
}