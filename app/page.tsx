'use client';

import { useState, useEffect, useRef } from "react";
import { createServerSideChatDebugger, ServerSideChatDebugger } from "../lib/server-chat-debug";

// Detect lottery plays in messages (duplicated here for UI use)
function detectCommentPlay(message: string): string | null {
  // xx-xx-xx-xx where xx are two-digit numbers (with or without curly braces)
  const commentPlayPattern = /\{?\d{2}-\d{2}-\d{2}-\d{2}\}?/;
  
  // Find the match in the message
  const match = message.match(commentPlayPattern);

  // Return the matched string or null if no match is found
  return match ? match[0] : null;
}

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [events, setEvents] = useState<Array<{eventName: string, args: unknown[]}>>([]);
  const [lotteryPlays, setLotteryPlays] = useState<Array<{play: string, username: string, timestamp: string, fullMessage: string}>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [roomId, setRoomId] = useState('V5cCiSixPLAiEDX2zZquT5VuLm4prr5t35PWmjNpump');
  const serverDebuggerRef = useRef<ServerSideChatDebugger | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Auto-start debugger when component mounts
  useEffect(() => {
    // Auto-start the server-side debugger when the app loads
    setLogs([]);
    setEvents([]);
    setIsRunning(true);

    // Use server-side debugger via API route - runs continuously
    serverDebuggerRef.current = createServerSideChatDebugger(roomId, handleLog, handleEvent);
    serverDebuggerRef.current.start();
    // Connection will stay alive until manually stopped or browser closed
  }, [roomId]); // Re-run when roomId changes

  const handleLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const handleEvent = (eventName: string, args: unknown[]) => {
    setEvents(prev => [...prev, { eventName, args }]);
    
    // Check for lottery plays in new messages
    if (eventName === 'newMessage' && args && args[0]) {
      const messageData = args[0] as { message?: string; username?: string };
      if (typeof messageData.message === 'string' && typeof messageData.username === 'string') {
        const message: string = messageData.message;
        const username: string = messageData.username;
        const lotteryPlay = detectCommentPlay(message);
        if (lotteryPlay) {
          const timestamp = new Date().toLocaleTimeString();
          setLotteryPlays(prev => [...prev, {
            play: lotteryPlay,
            username,
            timestamp,
            fullMessage: message
          }]);
        }
      }
    }
  };

  const stopDebugger = () => {
    if (serverDebuggerRef.current) {
      serverDebuggerRef.current.stop();
      serverDebuggerRef.current = null;
    }
    setIsRunning(false);
  };

  const restartDebugger = () => {
    // Stop current debugger if running
    if (serverDebuggerRef.current) {
      serverDebuggerRef.current.stop();
      serverDebuggerRef.current = null;
    }
    
    // Clear logs and restart
    setLogs([]);
    setEvents([]);
    setLotteryPlays([]);
    setIsRunning(true);

    // Use server-side debugger via API route - runs continuously
    serverDebuggerRef.current = createServerSideChatDebugger(roomId, handleLog, handleEvent);
    serverDebuggerRef.current.start();
    // Connection will stay alive until manually stopped or browser closed
  };

  const clearLogs = () => {
    setLogs([]);
    setEvents([]);
    setLotteryPlays([]);
  };

  return (
    <div className="font-sans min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pump.fun Chat Debugger
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time server-side WebSocket debugging tool for pump.fun chat functionality
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Controls
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Room ID
                  </label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={isRunning}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={restartDebugger}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Restart Debug
                  </button>
                  
                  <button
                    onClick={stopDebugger}
                    disabled={!isRunning}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Stop Debug
                  </button>
                  
                  <button
                    onClick={clearLogs}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Status: <span className={isRunning ? 'text-green-600' : 'text-gray-500'}>
                    {isRunning ? 'Active' : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>

            {/* Events Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Events ({events.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((event, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {event.eventName}
                    </span>
                    {event.args.length > 0 && (
                      <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                        {JSON.stringify(event.args, null, 2).slice(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Lottery Plays */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                🎰 Lottery Plays Detected ({lotteryPlays.length})
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {lotteryPlays.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400 text-sm">
                    No lottery plays detected yet. Watching for xx-xx-xx-xx patterns...
                  </div>
                ) : (
                  lotteryPlays.map((lottery, index) => (
                    <div key={index} className="border-l-4 border-yellow-500 pl-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-r">
                      <div className="font-mono text-lg font-bold text-yellow-700 dark:text-yellow-300">
                        {lottery.play}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        by <span className="font-semibold">{lottery.username}</span> at {lottery.timestamp}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                        Full message: &quot;{lottery.fullMessage}&quot;
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Live Logs ({logs.length})
              </h2>
              
              <div className="bg-black text-green-400 rounded-md p-4 h-96 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-gray-500">Debugger is starting automatically...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1 whitespace-pre-wrap">
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <div className="mb-2">Built with Next.js 15, TypeScript, and Socket.IO Client</div>
          <div className="text-xs">
            <strong>Server-side WebSocket Connection:</strong> This debugger runs pump.fun chat connections server-side to bypass CORS restrictions. 
            Real-time events are streamed to your browser via Server-Sent Events (SSE).
          </div>
        </footer>
      </div>
    </div>
  );
}
