'use client';

import { useState, useEffect, useRef } from "react";
import { createChatDebugger, PumpFunChatDebugger } from "../lib/chat-debug";
import { createServerSideChatDebugger, ServerSideChatDebugger } from "../lib/server-chat-debug";

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [events, setEvents] = useState<Array<{eventName: string, args: unknown[]}>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [roomId, setRoomId] = useState('J2eaKn35rp82T6RFEsNK9CLRHEKV9BLXjedFM3q6pump');
  const [testMode, setTestMode] = useState(false);
  const [useServerSide, setUseServerSide] = useState(true);
  const debuggerRef = useRef<PumpFunChatDebugger | null>(null);
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
    // Auto-start the debugger when the app loads
    setLogs([]);
    setEvents([]);
    setIsRunning(true);

    if (testMode) {
      // Test mode - simulate logs without actual connection
      handleLog('🧪 Test mode enabled - simulating connection...');
      handleLog('🚀 Starting pump.fun chat debug test...');
      handleLog(`🏠 Room ID: ${roomId}`);
      handleLog(`👤 Username: TestUser12345`);
      
      setTimeout(() => handleLog('🔄 Attempting WebSocket connection...'), 1000);
      setTimeout(() => handleLog('❌ Connection error: websocket error'), 2000);
      setTimeout(() => handleLog('🔄 Trying alternative connection methods...'), 3000);
      setTimeout(() => handleLog('✅ Connected via HTTP polling! Socket ID: abc123'), 4000);
      setTimeout(() => handleLog('🔗 Trying to join room...'), 5000);
      setTimeout(() => {
        handleEvent('connect', []);
        handleLog('📡 EVENT: connect');
      }, 6000);
      
      setTimeout(() => {
        setIsRunning(false);
        handleLog('⏰ Test completed.');
      }, 10000);
    } else if (useServerSide) {
      // Use server-side debugger via API route - runs indefinitely
      serverDebuggerRef.current = createServerSideChatDebugger(roomId, handleLog, handleEvent);
      serverDebuggerRef.current.start();
      // Connection will stay alive until manually stopped or browser closed
    } else {
      // Use client-side debugger (will likely fail due to CORS)
      debuggerRef.current = createChatDebugger(roomId, handleLog, handleEvent);
      debuggerRef.current.start();
      // Connection will stay alive until manually stopped or browser closed
    }
  }, [testMode, roomId, useServerSide]); // Re-run when testMode, roomId, or useServerSide changes

  const handleLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const handleEvent = (eventName: string, args: unknown[]) => {
    setEvents(prev => [...prev, { eventName, args }]);
  };

  const stopDebugger = () => {
    if (debuggerRef.current) {
      debuggerRef.current.stop();
      debuggerRef.current = null;
    }
    if (serverDebuggerRef.current) {
      serverDebuggerRef.current.stop();
      serverDebuggerRef.current = null;
    }
    setIsRunning(false);
  };

  const restartDebugger = () => {
    // Stop current debuggers if running
    if (debuggerRef.current) {
      debuggerRef.current.stop();
      debuggerRef.current = null;
    }
    if (serverDebuggerRef.current) {
      serverDebuggerRef.current.stop();
      serverDebuggerRef.current = null;
    }
    
    // Clear logs and restart
    setLogs([]);
    setEvents([]);
    setIsRunning(true);

    if (testMode) {
      // Test mode - simulate logs without actual connection
      handleLog('🧪 Test mode enabled - simulating connection...');
      handleLog('🚀 Starting pump.fun chat debug test...');
      handleLog(`🏠 Room ID: ${roomId}`);
      handleLog(`👤 Username: TestUser12345`);
      
      setTimeout(() => handleLog('🔄 Attempting WebSocket connection...'), 1000);
      setTimeout(() => handleLog('❌ Connection error: websocket error'), 2000);
      setTimeout(() => handleLog('🔄 Trying alternative connection methods...'), 3000);
      setTimeout(() => handleLog('✅ Connected via HTTP polling! Socket ID: abc123'), 4000);
      setTimeout(() => handleLog('🔗 Trying to join room...'), 5000);
      setTimeout(() => {
        handleEvent('connect', []);
        handleLog('📡 EVENT: connect');
      }, 6000);
      
      setTimeout(() => {
        setIsRunning(false);
        handleLog('⏰ Test completed.');
      }, 10000);
    } else if (useServerSide) {
      // Use server-side debugger via API route - runs indefinitely
      serverDebuggerRef.current = createServerSideChatDebugger(roomId, handleLog, handleEvent);
      serverDebuggerRef.current.start();
      // Connection will stay alive until manually stopped or browser closed
    } else {
      // Use client-side debugger (will likely fail due to CORS)
      debuggerRef.current = createChatDebugger(roomId, handleLog, handleEvent);
      debuggerRef.current.start();
      // Connection will stay alive until manually stopped or browser closed
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setEvents([]);
  };

  return (
    <div className="font-sans min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pump.fun Chat Debugger
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time WebSocket debugging tool for pump.fun chat functionality - Auto-starts on page load
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

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="testMode"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="mr-2"
                    disabled={isRunning}
                  />
                  <label htmlFor="testMode" className="text-sm text-gray-700 dark:text-gray-300">
                    Test Mode (simulate connection)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useServerSide"
                    checked={useServerSide}
                    onChange={(e) => setUseServerSide(e.target.checked)}
                    className="mr-2"
                    disabled={isRunning || testMode}
                  />
                  <label htmlFor="useServerSide" className="text-sm text-gray-700 dark:text-gray-300">
                    Server-side Connection (recommended)
                  </label>
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
            <strong>Note:</strong> If you&apos;re seeing WebSocket connection errors, this is normal when testing pump.fun&apos;s chat server from localhost. 
            The server may have CORS restrictions or require specific authentication. Use Test Mode to see the interface functionality.
          </div>
        </footer>
      </div>
    </div>
  );
}
