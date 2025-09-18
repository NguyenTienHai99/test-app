/**
 * Server-side PumpChatClient for Next.js API routes
 * Handles WebSocket connections to pump.fun chat in Node.js environment
 */

import io from 'socket.io-client'
import { EventEmitter } from 'events'

// Type for socket.io-client v4
type SocketIOSocket = ReturnType<typeof io>

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
  maxReconnectAttempts?: number
  enableLogging?: boolean
}

export class ServerPumpChatClient extends EventEmitter {
  private socket: SocketIOSocket | null = null
  private readonly roomId: string
  private readonly username: string
  private readonly messageHistoryLimit: number
  private readonly maxReconnectAttempts: number
  private readonly enableLogging: boolean
  
  private messageHistory: IMessage[] = []
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isReconnecting: boolean = false
  private shouldReconnect: boolean = true

  constructor(options: PumpChatClientOptions) {
    super()
    this.roomId = options.roomId
    this.username = options.username || `User${Math.random().toString(36).substr(2, 5)}`
    this.messageHistoryLimit = options.messageHistoryLimit ?? 100
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.enableLogging = options.enableLogging ?? false
  }

  private log(message: string): void {
    if (this.enableLogging) {
      console.log(message)
    }
  }

  private logError(message: string, error?: unknown): void {
    if (this.enableLogging) {
      console.error(message, error ?? '')
    }
  }

  public connect(): void {
    try {
      // Clear any existing reconnection timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }

      this.log(`🔄 Connecting to pump.fun chat (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts + 1})`)

      // Server-side Socket.IO connection with pump.fun compatible headers  
      this.socket = io('wss://livechat.pump.fun', {
        transports: ['websocket'],
        timeout: 20000,
        forceNew: true,
        autoConnect: true,
        reconnection: false, // Handle reconnection manually
        auth: {
          // Headers are passed in auth for socket.io v4
          'Origin': 'https://pump.fun',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        upgrade: true,
        rememberUpgrade: false
      })

      this.setupSocketEventHandlers()
      
    } catch (error) {
      this.logError("❌ Failed to create Socket.IO connection:", error)
      this.emit("error", error)
      this.scheduleReconnection()
    }
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return

    this.log('🔧 Setting up Socket.IO event handlers...')

    this.socket.on('connect', () => {
      this.log(`🟢 Connected! Socket ID: ${this.socket?.id}`)
      // Note: Transport info not available in socket.io v4 public API
      
      this.isConnected = true
      this.reconnectAttempts = 0
      this.isReconnecting = false
      this.emit('connected')
      
      // Wait before joining room to ensure connection stability
      setTimeout(() => this.joinRoom(), 500)
    })

    this.socket.on('disconnect', (reason: string) => {
      this.log(`🔴 Disconnected: ${reason}`)
      this.isConnected = false
      this.emit('disconnected')
      
      // Schedule reconnection if it was unexpected
      if (this.shouldReconnect && reason !== 'io client disconnect') {
        this.scheduleReconnection()
      }
    })

    this.socket.on('connect_error', (error: Error & { description?: string }) => {
      this.logError('🚨 Connection error:', error.message)
      
      // Check for specific server errors
      if (error.message?.includes('502') || error.description?.includes('502')) {
        this.logError('🚨 HTTP 502 Bad Gateway - server may be down')
      }
      
      this.emit('error', error)
      
      if (this.shouldReconnect) {
        this.scheduleReconnection()
      }
    })

    this.socket.on('error', (error: Error) => {
      this.logError('🚨 Socket error:', error)
      this.emit('error', error)
    })

    // Connection timeout handler
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        this.log('⏰ Connection timeout after 20 seconds')
        this.socket.disconnect()
        this.scheduleReconnection()
      }
    }, 20000)

    // Set up pump.fun specific event handlers
    this.setupPumpFunEventHandlers()
  }

  private setupPumpFunEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('newMessage', (message: IMessage) => {
      this.log(`📩 New message from ${message.username}: ${message.message}`)
      this.handleNewMessage(message)
    })

    this.socket.on('messageHistory', (data: { messages: IMessage[] }) => {
      this.log(`📜 Message history received: ${data.messages?.length || 0} messages`)
      this.handleMessageHistory(data.messages || [])
    })

    this.socket.on('userJoined', (data: { username: string, userAddress: string }) => {
      this.log(`👋 User joined: ${data.username}`)
      this.emit('userJoined', data)
    })

    this.socket.on('userLeft', (data: { userAddress: string }) => {
      this.log(`👋 User left: ${data.userAddress}`)
      this.emit('userLeft', data.userAddress)
    })

    this.socket.on('joinRoomResponse', (response: { success: boolean, message?: string }) => {
      if (response.success) {
        this.log(`✅ Successfully joined room: ${this.roomId}`)
        this.requestMessageHistory()
      } else {
        this.logError(`❌ Failed to join room: ${response.message}`)
        this.emit('serverError', response.message || 'Failed to join room')
      }
    })

    this.socket.on('serverError', (error: string) => {
      this.logError(`🚨 Server Error: ${error}`)
      this.emit('serverError', error)
    })
  }

  private joinRoom(): void {
    if (this.socket && this.isConnected) {
      this.log(`🔗 Joining room: ${this.roomId} as ${this.username}`)
      
      // Join room with proper payload
      this.socket.emit('joinRoom', {
        roomId: this.roomId,
        username: this.username
      })
      
      // Try alternative room joining patterns
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          this.socket.emit('join', this.roomId)
          this.socket.emit('subscribe', { room: this.roomId })
        }
      }, 1000)
    }
  }

  private requestMessageHistory(): void {
    if (this.socket && this.isConnected) {
      this.log(`📜 Requesting message history for room: ${this.roomId}`)
      
      // Try multiple message history request patterns
      this.socket.emit('getMessageHistory', {
        roomId: this.roomId,
        before: null,
        limit: this.messageHistoryLimit
      })
      
      // Alternative patterns with delay
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          this.socket.emit('messageHistory', { roomId: this.roomId })
          this.socket.emit('getHistory', { room: this.roomId, limit: this.messageHistoryLimit })
          this.socket.emit('fetchMessages', { roomId: this.roomId })
        }
      }, 1000)
    }
  }

  private handleNewMessage(message: IMessage): void {
    this.messageHistory.push(message)
    if (this.messageHistory.length > this.messageHistoryLimit) {
      this.messageHistory.shift()
    }
    this.emit('message', message)
  }

  private handleMessageHistory(messages: IMessage[]): void {
    this.messageHistory = messages.slice(-this.messageHistoryLimit)
    this.emit('messageHistory', this.messageHistory)
  }

  public sendMessage(message: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('sendMessage', {
        roomId: this.roomId,
        message: message
      })
    }
  }

  private scheduleReconnection(): void {
    if (this.isReconnecting || !this.shouldReconnect) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logError('❌ Max reconnection attempts reached')
      this.emit('maxReconnectsReached')
      return
    }

    this.isReconnecting = true
    this.reconnectAttempts++

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000)
    
    this.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect()
    }, delay)
  }

  public disconnect(): void {
    this.log('🔌 Disconnecting from Socket.IO...')
    
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

  public getConnectionInfo(): {
    isConnected: boolean
    socketConnected: boolean
    roomId: string
    username: string
    messageCount: number
    socketId: string | null
    reconnectAttempts: number
    isReconnecting: boolean
    shouldReconnect: boolean
  } {
    return {
      isConnected: this.isConnected,
      socketConnected: this.socket?.connected ?? false,
      roomId: this.roomId,
      username: this.username,
      messageCount: this.messageHistory.length,
      socketId: this.socket?.id ?? null,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      shouldReconnect: this.shouldReconnect
    }
  }
}