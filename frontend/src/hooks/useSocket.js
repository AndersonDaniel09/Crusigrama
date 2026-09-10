import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook que encapsula toda la lógica de Socket.io para una partida.
 *
 * @param {string|null} gameId   - ID de la partida. null = no conecta.
 * @param {string|null} token    - Token de sesión del jugador.
 * @param {object}      handlers - Callbacks para cada evento del servidor.
 */
export function useSocket(gameId, token, handlers = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Guardar los handlers en un ref para evitar re-renders innecesarios
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    if (!gameId || !token) return;

    // Crear conexión (el proxy de Vite redirige /socket.io al backend)
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Unirse a la room de la partida automáticamente al conectar
      socket.emit('game:join', { gameId, token });
    });

    socket.on('disconnect', () => setConnected(false));

    // Registrar todos los eventos del servidor
    const events = [
      'game:state',
      'player:joined',
      'player:left',
      'cell:updated',
      'stats:update',
      'chat:message',
      'game:ended',
      'timer:sync',
      'error',
    ];

    events.forEach((event) => {
      socket.on(event, (data) => {
        const handler = handlersRef.current[event];
        if (handler) handler(data);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [gameId, token]);

  /** Envía la actualización de una celda al servidor */
  const sendCell = useCallback(
    (row, col, letter) => {
      socketRef.current?.emit('cell:update', { gameId, token, row, col, letter });
    },
    [gameId, token]
  );

  /** Envía un mensaje de chat */
  const sendChat = useCallback(
    (text) => {
      socketRef.current?.emit('chat:message', { gameId, token, text });
    },
    [gameId, token]
  );

  return { connected, sendCell, sendChat };
}
