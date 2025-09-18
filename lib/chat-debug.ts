import io from 'socket.io-client';

// Types for pump.fun chat debugging
interface JoinRoomData {
  roomId: string;
  username: string;
}

interface SendMessageData {
  roomId: string;
  message: string;
  username: string;
}

interface AlternativeMessageData {
  room: string;
  text: string;
  user: string;
}

interface MessageHistoryRequest {
  roomId: string;
  before?: string | null;
  limit: number;
}

interface ChatDebugConfig {
  roomId: string;
  username: string;
  onLog: (message: string) => void;
  onEvent: (eventName: string, args: unknown[]) => void;
}

type SocketType = ReturnType<typeof io>;

export class PumpFunChatDebugger {
  private socket: SocketType | null = null;
  private config: ChatDebugConfig;
  private isConnected = false;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(config: ChatDebugConfig) {
    this.config = config;
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.config.onLog(`[${timestamp}] ${message}`);
  }

  public start(): void {
    this.log('🚀 Starting pump.fun chat debug test...');
    this.log(`🏠 Room ID: ${this.config.roomId}`);
    this.log(`👤 Username: ${this.config.username}`);
    
    // Add diagnostic information
    this.log(`🌐 Browser: ${navigator.userAgent}`);
    this.log(`🔒 Protocol: ${window.location.protocol}`);
    this.log(`📍 Origin: ${window.location.origin}`);

    // Initialize socket connection with fallback options
    this.socket = io('wss://livechat.pump.fun', {
      transports: ['websocket', 'polling'], // Add polling as fallback
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      upgrade: true,
      rememberUpgrade: false
    });

    this.setupEventListeners();
  }

  private tryAlternativeConnection(): void {
    this.log(`🔄 Trying HTTP polling connection...`);
    
    // Try with different transports and endpoints
    const alternativeUrls = [
      'https://livechat.pump.fun',
      'wss://livechat.pump.fun/socket.io/',
      'https://livechat.pump.fun/socket.io/'
    ];

    let attemptIndex = 0;
    const tryNext = () => {
      if (attemptIndex >= alternativeUrls.length) {
        this.log(`❌ All connection attempts failed. The server might be down or require authentication.`);
        return;
      }

      const url = alternativeUrls[attemptIndex];
      this.log(`🔄 Attempting connection to: ${url}`);
      
      this.socket = io(url, {
        transports: ['polling', 'websocket'],
        timeout: 10000,
        forceNew: true,
        autoConnect: true,
        reconnection: false
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.log(`✅ Connected via alternative method! Socket ID: ${this.socket?.id}`);
        this.tryJoinRoom();
      });

      this.socket.on('connect_error', () => {
        attemptIndex++;
        setTimeout(tryNext, 2000);
      });
    };

    tryNext();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Listen to specific events that pump.fun might send
    const commonEvents = [
      'connect', 'disconnect', 'connect_error', 
      'message', 'newMessage', 'messageHistory', 
      'joinRoom', 'leaveRoom', 'userJoined', 'userLeft',
      'roomJoined', 'roomLeft', 'error'
    ];

    commonEvents.forEach(eventName => {
      this.socket?.on(eventName, (...args: unknown[]) => {
        this.log(`📡 EVENT: '${eventName}'`);
        this.log(`📡 ARGS: ${JSON.stringify(args, null, 2)}`);
        this.log('---');
        this.config.onEvent(eventName, args);
      });
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.log(`✅ Connected! Socket ID: ${this.socket?.id}`);
      this.tryJoinRoom();
    });

    this.socket.on('connect_error', (error: Error) => {
      this.log(`❌ Connection error: ${error.message}`);
      this.log(`🔄 Trying alternative connection methods...`);
      
      // Try alternative endpoints or connection methods
      setTimeout(() => {
        if (!this.isConnected && this.socket) {
          this.log(`🔄 Attempting HTTP polling connection...`);
          this.socket.disconnect();
          this.tryAlternativeConnection();
        }
      }, 2000);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      this.log(`🔌 Disconnected: ${reason}`);
    });

    // Set auto-stop timer
    this.timeoutId = setTimeout(() => {
      this.stop();
    }, 30000);
  }

  private tryJoinRoom(): void {
    if (!this.socket || !this.isConnected) return;

    this.log('🔗 Trying to join room...');

    // Strategy 1: Standard joinRoom
    const joinRoomData: JoinRoomData = {
      roomId: this.config.roomId,
      username: this.config.username
    };
    this.socket.emit('joinRoom', joinRoomData);

    // Strategy 2: Alternative patterns
    setTimeout(() => {
      if (!this.socket) return;
      this.socket.emit('join', this.config.roomId);
      this.socket.emit('subscribe', { room: this.config.roomId });
      this.socket.emit('enterRoom', this.config.roomId);
    }, 1000);

    // Strategy 3: Request message history
    setTimeout(() => {
      this.requestMessageHistory();
    }, 2000);

    // Strategy 4: Try to send a test message
    setTimeout(() => {
      this.sendTestMessages();
    }, 3000);
  }

  private requestMessageHistory(): void {
    if (!this.socket || !this.isConnected) return;

    this.log('📜 Requesting message history...');

    const historyRequest: MessageHistoryRequest = {
      roomId: this.config.roomId,
      before: null,
      limit: 50
    };

    this.socket.emit('getMessageHistory', historyRequest);
    this.socket.emit('messageHistory', { roomId: this.config.roomId });
    this.socket.emit('getHistory', { room: this.config.roomId, limit: 50 });
    this.socket.emit('fetchMessages', { roomId: this.config.roomId });
  }

  private sendTestMessages(): void {
    if (!this.socket || !this.isConnected) return;

    this.log('💬 Sending test message...');

    const messageData: SendMessageData = {
      roomId: this.config.roomId,
      message: 'Hello from TypeScript test! 🚀',
      username: this.config.username
    };

    this.socket.emit('sendMessage', messageData);

    // Try alternative message sending
    const altMessageData: AlternativeMessageData = {
      room: this.config.roomId,
      text: 'Test message 2 from TypeScript',
      user: this.config.username
    };

    this.socket.emit('message', altMessageData);
  }

  public stop(): void {
    this.log('⏰ Test completed. Disconnecting...');
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
  }

  public isRunning(): boolean {
    return this.isConnected && this.socket !== null;
  }
}

// Factory function for creating debugger instances
export function createChatDebugger(
  roomId: string,
  onLog: (message: string) => void,
  onEvent: (eventName: string, args: unknown[]) => void
): PumpFunChatDebugger {
  const username = 'TestUser' + Math.random().toString(36).substr(2, 5);
  
  return new PumpFunChatDebugger({
    roomId,
    username,
    onLog,
    onEvent
  });
}