/**
 * @fileoverview Server-side PumpChatClient for Next.js API routes
 * This runs in Node.js environment and can set custom headers
 */

import { io, Socket } from 'socket.io-client'
import { EventEmitter } from 'events'

export interface IMessage {
  id: string
  roomId: string
  username: string
  userAddress: string
  message: string
  profile_image: string
  timestamp: string
  messageType: string
  expiresAt: number
}

export interface PumpChatClientOptions {
  roomId: string
  username?: string
  messageHistoryLimit?: number
}

export class ServerPumpChatClient extends EventEmitter {
  private socket: Socket | null = null
  private roomId: string
  private username: string
  private messageHistory: IMessage[] = []
  private messageHistoryLimit: number
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isReconnecting: boolean = false
  private shouldReconnect: boolean = true

  constructor(options: PumpChatClientOptions) {
    super()
    this.roomId = options.roomId
    this.username = options.username || "anonymous"
    this.messageHistoryLimit = options.messageHistoryLimit || 100
  }

  public connect() {
    try {
      // Clear any existing reconnection timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }

      console.log(`🔄 Attempting to connect to pump.fun chat (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts + 1})`)
      console.log(`🔄 Environment: ${process.env.NODE_ENV}, Platform: ${process.platform}`)

      // Server-side Socket.IO connection - enhanced with CORS-friendly headers
      this.socket = io('wss://livechat.pump.fun', {
        transports: ['websocket'], // Start with websocket only since test shows it works
        timeout: 20000,
        forceNew: true,
        autoConnect: true,
        reconnection: false, // We handle reconnection manually
        extraHeaders: {
          'Origin': 'https://pump.fun',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
          'Sec-WebSocket-Version': '13'
        },
        withCredentials: false, // Important for CORS
        upgrade: true,
        rememberUpgrade: false
      })

      this.setupSocketEventHandlers()
      
    } catch (error) {
      console.error("❌ Failed to create server-side Socket.IO connection:", error)
      this.emit("error", error)
      this.scheduleReconnection()
    }
  }

  private setupSocketEventHandlers() {
    if (!this.socket) return

    console.log('🔧 Setting up Socket.IO event handlers...')

    this.socket.on('connect', () => {
      console.log('🟢 Server-side Socket.IO Connected')
      console.log('🟢 Socket ID:', this.socket?.id)
      console.log('🟢 Socket connected state:', this.socket?.connected)
      console.log('🟢 Socket transport:', this.socket?.io?.engine?.transport?.name)
      
      this.isConnected = true
      this.reconnectAttempts = 0
      this.isReconnecting = false
      this.emit('connected')
      
      // Wait a bit before joining room to ensure connection is stable
      setTimeout(() => {
        this.joinRoom()
      }, 500)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Server-side Socket.IO Disconnected:', reason)
      this.isConnected = false
      this.emit('disconnected')
      
      // Schedule reconnection if it was unexpected
      if (this.shouldReconnect && reason !== 'io client disconnect') {
        this.scheduleReconnection()
      }
    })

    this.socket.on('connect_error', (error: Error & { description?: string }) => {
      console.error('🚨 Server-side Socket.IO Connection Error:', error)
      console.error('🚨 Error message:', error.message)
      
      // Check for specific HTTP error codes
      if (error.message && error.message.includes('502')) {
        console.error('🚨 HTTP 502 Bad Gateway detected!')
        console.error('   → This indicates pump.fun server is down or blocking connections')
        console.error('   → Trying polling transport as fallback...')
      } else if (error.description && typeof error.description === 'string') {
        if (error.description.includes('502')) {
          console.error('🚨 HTTP 502 in error description - server issue detected')
        }
      }
      
      this.emit('error', error)
      
      // Schedule reconnection on connection error
      if (this.shouldReconnect) {
        this.scheduleReconnection()
      }
    })

    this.socket.on('error', (error) => {
      console.error('🚨 Server-side Socket.IO General Error:', error)
      this.emit('error', error)
    })

    // Add timeout handler - increased to 20 seconds to match socket timeout
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        console.warn('⏰ Socket.IO connection timeout after 20 seconds')
        this.socket.disconnect()
        this.scheduleReconnection()
      }
    }, 20000)

    // Listen for ALL events to debug what's actually being received
    this.socket.onAny((eventName, ...args) => {
      console.log(`🔍 DEBUG: Received event '${eventName}' with args:`, JSON.stringify(args, null, 2))
    })

    this.socket.on('newMessage', (message: IMessage) => {
      console.log('📩 Server received new message:', JSON.stringify(message, null, 2))
      this.handleNewMessage(message)
    })

    this.socket.on('messageHistory', (data: { messages: IMessage[] }) => {
      console.log('📜 Server received message history:', data.messages?.length || 0, 'messages')
      if (data.messages && data.messages.length > 0) {
        console.log('📜 First message sample:', JSON.stringify(data.messages[0], null, 2))
      }
      this.handleMessageHistory(data.messages || [])
    })

    this.socket.on('userJoined', (data: { username: string, userAddress: string }) => {
      console.log('👋 User joined:', JSON.stringify(data, null, 2))
      this.emit('userJoined', data)
    })

    this.socket.on('userLeft', (data: { userAddress: string }) => {
      console.log('👋 User left:', JSON.stringify(data, null, 2))
      this.emit('userLeft', data.userAddress)
    })

    this.socket.on('joinRoomResponse', (response: { success: boolean, message?: string }) => {
      console.log('🏠 Join room response:', JSON.stringify(response, null, 2))
      if (response.success) {
        console.log('✅ Server successfully joined room:', this.roomId)
        this.requestMessageHistory()
      } else {
        console.error('❌ Server failed to join room:', response.message)
        this.emit('serverError', response.message || 'Failed to join room')
      }
    })

    this.socket.on('serverError', (error: string) => {
      console.error('🚨 Server Error:', error)
      this.emit('serverError', error)
    })
  }

  private joinRoom() {
    if (this.socket && this.isConnected) {
      console.log('🔗 Server joining room:', this.roomId)
      console.log('🔗 With username:', this.username)
      
      // Join room with proper payload
      this.socket.emit('joinRoom', {
        roomId: this.roomId,
        username: this.username
      })
      
      // Also try alternative room joining patterns that pump.fun might expect
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          console.log('🔗 Trying alternative room join pattern...')
          this.socket.emit('join', this.roomId)
          this.socket.emit('subscribe', { room: this.roomId })
        }
      }, 1000)
    }
  }

  private requestMessageHistory() {
    if (this.socket && this.isConnected) {
      console.log('📜 Server requesting message history for room:', this.roomId)
      
      // Try multiple message history request patterns
      this.socket.emit('getMessageHistory', {
        roomId: this.roomId,
        before: null,
        limit: this.messageHistoryLimit
      })
      
      // Alternative patterns
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          console.log('📜 Trying alternative message history patterns...')
          this.socket.emit('messageHistory', { roomId: this.roomId })
          this.socket.emit('getHistory', { room: this.roomId, limit: this.messageHistoryLimit })
          this.socket.emit('fetchMessages', { roomId: this.roomId })
        }
      }, 1000)
    }
  }

  private handleNewMessage(message: IMessage) {
    this.messageHistory.push(message)
    if (this.messageHistory.length > this.messageHistoryLimit) {
      this.messageHistory.shift()
    }
    this.emit('message', message)
  }

  private handleMessageHistory(messages: IMessage[]) {
    this.messageHistory = messages.slice(-this.messageHistoryLimit)
    this.emit('messageHistory', this.messageHistory)
  }

  public sendMessage(message: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('sendMessage', {
        roomId: this.roomId,
        message: message
      })
    }
  }

  private scheduleReconnection() {
    if (this.isReconnecting || !this.shouldReconnect) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.')
      this.emit('maxReconnectsReached')
      return
    }

    this.isReconnecting = true
    this.reconnectAttempts++

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000)
    
    console.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect()
    }, delay)
  }

  public disconnect() {
    console.log('🔌 Server disconnecting from Socket.IO...')
    
    // Stop reconnection attempts
    this.shouldReconnect = false
    
    // Clear any pending reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    this.isConnected = false
    this.isReconnecting = false
  }

  public getMessages(limit?: number): IMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit)
    }
    return [...this.messageHistory]
  }

  public getLatestMessage(): IMessage | null {
    return this.messageHistory[this.messageHistory.length - 1] || null
  }

  public isActive(): boolean {
    return this.isConnected && this.socket?.connected === true
  }

  public getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      socketConnected: this.socket?.connected || false,
      roomId: this.roomId,
      username: this.username,
      messageCount: this.messageHistory.length,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      shouldReconnect: this.shouldReconnect
    }
  }
}