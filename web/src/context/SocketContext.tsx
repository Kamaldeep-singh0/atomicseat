'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinEvent: (eventId: string) => void;
  leaveEvent: (eventId: string) => void;
  registerReconnectHandler: (handler: () => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectCallbacks = React.useRef<Set<() => void>>(new Set());

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const s = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => {
      console.log('[Socket.io] Connected to server, id:', s.id);
      setIsConnected(true);
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected:', reason);
      setIsConnected(false);
    });

    let lastRefetch = 0;
    s.io.on('reconnect', (attempt) => {
      console.log(`[Socket.io] Reconnected after attempt #${attempt}.`);
      setIsConnected(true);
      const now = Date.now();
      if (now - lastRefetch > 3000) {
        lastRefetch = now;
        reconnectCallbacks.current.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error('[Socket.io] Reconnect handler error:', e);
          }
        });
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const joinEvent = useCallback((eventId: string) => {
    if (socket && isConnected) {
      socket.emit('join_event', eventId);
    }
  }, [socket, isConnected]);

  const leaveEvent = useCallback((eventId: string) => {
    if (socket && isConnected) {
      socket.emit('leave_event', eventId);
    }
  }, [socket, isConnected]);

  const registerReconnectHandler = useCallback((handler: () => void) => {
    reconnectCallbacks.current.add(handler);
    return () => {
      reconnectCallbacks.current.delete(handler);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinEvent,
        leaveEvent,
        registerReconnectHandler,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
