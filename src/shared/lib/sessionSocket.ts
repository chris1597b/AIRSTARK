/**
 * services/sessionSocket.ts
 * Capa de WebSocket (Socket.IO) para la vista de estadísticas en vivo.
 *
 * RESPONSABILIDADES:
 *  - Conexión, desconexión y reconexión automática mediante socket.io-client.
 *  - Autenticación segura mediante cookies HttpOnly (withCredentials).
 *  - Manejo centralizado de eventos del Backend hacia la UI.
 *
 * EVENTOS SOPORTADOS:
 *  - session_state: Snapshot inicial de la sesión al conectarse.
 *  - student_connected: Un nuevo estudiante se une a la sesión.
 *  - student_answered: Un estudiante responde una pregunta.
 *  - student_completed: Un estudiante termina la evaluación.
 *  - session_ended: La sesión finaliza o expira.
 */

import { io, Socket } from 'socket.io-client';
import { 
  WsSessionStatePayload, 
  WsStudentConnectedPayload, 
  WsStudentAnsweredPayload, 
  WsStudentCompletedPayload, 
  WsSessionEndedPayload 
} from '../../features/quiz/types/evaluation.ts';

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

interface SocketCallbacks {
  onStateChange?: (state: ConnectionState) => void;
  onSessionState?: (data: WsSessionStatePayload) => void;
  onStudentConnected?: (data: WsStudentConnectedPayload) => void;
  onStudentAnswered?: (data: WsStudentAnsweredPayload) => void;
  onStudentCompleted?: (data: WsStudentCompletedPayload) => void;
  onSessionEnded?: (data: WsSessionEndedPayload) => void;
  onError?: (error: Error) => void;
}

export class SessionSocket {
  private socket: Socket | null = null;
  private sessionId: string;
  private callbacks: SocketCallbacks;
  private isIntentionalDisconnect = false;

  constructor(sessionId: string, callbacks: SocketCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  /**
   * Inicia la conexión Socket.IO.
   */
  public connect() {
    this.isIntentionalDisconnect = false;
    if (this.socket && this.socket.connected) {
      return;
    }

    this.notifyState('CONNECTING');

    let baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!baseUrl) {
      if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true') {
        console.warn('[AIRSTARK] ⚠️ WebSocket Mock: simulando conexión...');
        this.simulateMockWebSocket();
        return;
      }
      this.callbacks.onError?.(new Error('VITE_API_BASE_URL no está configurado.'));
      this.notifyState('DISCONNECTED');
      return;
    }

    // Configuración para Socket.IO
    this.socket = io(baseUrl, {
      path: '/ws',
      withCredentials: true, // Habilita envío de HttpOnly cookies
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.notifyState('CONNECTED');
      // Solicitar unión a la sesión específica. 
      // La autenticación ya se validó en el handshake vía Cookie.
      this.socket?.emit('join_session', { sessionId: this.sessionId });
    });

    this.socket.on('session_state', (data: WsSessionStatePayload) => {
      this.callbacks.onSessionState?.(data);
    });

    this.socket.on('student_connected', (data: WsStudentConnectedPayload) => {
      this.callbacks.onStudentConnected?.(data);
    });

    this.socket.on('student_answered', (data: WsStudentAnsweredPayload) => {
      this.callbacks.onStudentAnswered?.(data);
    });

    this.socket.on('student_completed', (data: WsStudentCompletedPayload) => {
      this.callbacks.onStudentCompleted?.(data);
    });

    this.socket.on('session_ended', (data: WsSessionEndedPayload) => {
      this.callbacks.onSessionEnded?.(data);
    });

    this.socket.on('disconnect', () => {
      this.notifyState('DISCONNECTED');
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('[AIRSTARK] Socket.IO Connection Error:', err);
      this.callbacks.onError?.(err);
      this.notifyState('DISCONNECTED');
    });
  }

  /**
   * Desconecta el Socket intencionalmente (ej. al desmontar el componente).
   */
  public disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.notifyState('DISCONNECTED');
  }

  private notifyState(state: ConnectionState) {
    this.callbacks.onStateChange?.(state);
  }

  // ── Mock ─────────────────────────────────────────────────────────────
  private simulateMockWebSocket() {
    setTimeout(() => {
      this.notifyState('CONNECTED');
      // Mock inicial
      this.callbacks.onSessionState?.({
        sessionId: this.sessionId,
        status: 'active',
        students: []
      });

      // Simular un estudiante conectándose a los 3s
      if (!this.isIntentionalDisconnect) {
        setTimeout(() => {
          this.callbacks.onStudentConnected?.({ 
            studentId: 'mock-1', 
            studentName: 'Juan Pérez (Mock)', 
            joinedAt: new Date().toISOString() 
          });
        }, 3000);
      }
    }, 1000);
  }
}
