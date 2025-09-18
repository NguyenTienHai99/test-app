// Server-side chat debugger that uses Next.js API routes with Server-Sent Events
export interface ServerChatDebugConfig {
  roomId: string;
  username?: string;
  onLog: (message: string) => void;
  onEvent: (eventName: string, args: unknown[]) => void;
}

export class ServerSideChatDebugger {
  private config: ServerChatDebugConfig;
  private eventSource: EventSource | null = null;
  private isConnected = false;

  constructor(config: ServerChatDebugConfig) {
    this.config = config;
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.config.onLog(`[${timestamp}] ${message}`);
  }

  public start(): void {
    this.log('🚀 Starting server-side pump.fun chat debug...');
    
    const username = this.config.username || `TestUser${Math.random().toString(36).substr(2, 5)}`;
    const url = `/api/chat-debug?roomId=${encodeURIComponent(this.config.roomId)}&username=${encodeURIComponent(username)}`;
    
    this.log(`🔄 Connecting to server-side API: ${url}`);
    
    try {
      this.eventSource = new EventSource(url);
      
      this.eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.config.onLog(`[${data.timestamp}] ${data.message}`);
        } catch (error) {
          this.log(`❌ Error parsing log data: ${error}`);
        }
      });

      this.eventSource.addEventListener('event', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.config.onEvent(data.eventName, data.args);
        } catch (error) {
          this.log(`❌ Error parsing event data: ${error}`);
        }
      });

      this.eventSource.addEventListener('open', () => {
        this.isConnected = true;
        this.log('✅ Server-Sent Events connection established');
      });

      this.eventSource.addEventListener('error', (event) => {
        this.log(`❌ Server-Sent Events error: ${JSON.stringify(event)}`);
        this.isConnected = false;
      });

    } catch (error) {
      this.log(`❌ Failed to create EventSource: ${error}`);
    }
  }

  public stop(): void {
    this.log('⏰ Stopping server-side chat debugger...');
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isConnected = false;
  }

  public isRunning(): boolean {
    return this.isConnected && this.eventSource !== null;
  }

  public async sendMessage(message: string): Promise<boolean> {
    try {
      const response = await fetch('/api/chat-debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          roomId: this.config.roomId,
          message: message
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.log(`✅ Message sent: ${message}`);
        return true;
      } else {
        this.log(`❌ Failed to send message: ${result.error}`);
        return false;
      }
    } catch (error) {
      this.log(`❌ Error sending message: ${error}`);
      return false;
    }
  }
}

// Factory function for creating server-side debugger instances
export function createServerSideChatDebugger(
  roomId: string,
  onLog: (message: string) => void,
  onEvent: (eventName: string, args: unknown[]) => void,
  username?: string
): ServerSideChatDebugger {
  return new ServerSideChatDebugger({
    roomId,
    username,
    onLog,
    onEvent
  });
}