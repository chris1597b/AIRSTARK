/**
 * services/sessionSocket.ts
 * Capa de WebSocket independiente para la vista de estadísticas en vivo.
 *
 * RESPONSABILIDADES:
 *  - Conexión, desconexión y reconexión automática.
 *  - Envío del evento inicial `join_session` con el JWT de AIRSTARK.
 *  - Manejo centralizado de eventos del Backend hacia la UI.
 *
 * EVENTOS SOPORTADOS:
 *  - session_state: Snapshot inicial de la sesión al conectarse.
 *  - student_connected: Un nuevo estudiante se une a la sesión.
 *  - student_answered: Un estudiante responde una pregunta.
 *  - student_completed: Un estudiante termina la evaluación.
 *  - session_ended: La sesión finaliza o expira.
 */

import { WsEventPayload, WsSessionStatePayload, WsStudentConnectedPayload, WsStudentAnsweredPayload, WsStudentCompletedPayload, WsSessionEndedPayload } from '../types/evaluation';
import { getStoredToken } from './googleAuth';

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
  private socket: WebSocket | null = null;
  private sessionId: string;
  private callbacks: SocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private isIntentionalDisconnect = false;

  constructor(sessionId: string, callbacks: SocketCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  /**
   * Inicia la conexión WebSocket.
   * Utiliza la misma URL base que el API pero con esquema ws:// o wss://.
   */
  public connect() {
    this.isIntentionalDisconnect = false;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      this.callbacks.onError?.(new Error('No hay token AIRSTARK disponible para la conexión WebSocket.'));
      return;
    }

    this.notifyState('CONNECTING');

    // Mapear http:// a ws:// y https:// a wss://
    let baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!baseUrl) {
      if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true') {
        console.warn('[AIRSTARK] ⚠️ WebSocket Mock: simulando conexión...');
        this.simulateMockWebSocket();
        return;
      }
      this.callbacks.onError?.(new Error('VITE_API_BASE_URL no está configurado.'));
      return;
    }

    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyState('CONNECTED');
        
        // Enviar evento de unión a la sesión
        this.sendEvent('join_session', {
          sessionId: this.sessionId,
          token: token,
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WsEventPayload;
          this.handleEvent(payload);
        } catch (e) {
          console.error('[AIRSTARK] Error parseando mensaje WebSocket:', e);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        this.notifyState('DISCONNECTED');
        this.handleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error('[AIRSTARK] WebSocket Error:', err);
        // onclose will fire and handle reconnect
      };
    } catch (e: any) {
      this.callbacks.onError?.(e);
      this.notifyState('DISCONNECTED');
      this.handleReconnect();
    }
  }

  /**
   * Desconecta el WebSocket intencionalmente (ej. al desmontar el componente).
   */
  public disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.notifyState('DISCONNECTED');
  }

  private sendEvent(event: string, data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, data }));
    }
  }

  private handleEvent(payload: WsEventPayload) {
    switch (payload.event) {
      case 'session_state':
        this.callbacks.onSessionState?.(payload.data);
        break;
      case 'student_connected':
        this.callbacks.onStudentConnected?.(payload.data);
        break;
      case 'student_answered':
        this.callbacks.onStudentAnswered?.(payload.data);
        break;
      case 'student_completed':
        this.callbacks.onStudentCompleted?.(payload.data);
        break;
      case 'session_ended':
        this.callbacks.onSessionEnded?.(payload.data);
        break;
    }
  }

  private handleReconnect() {
    if (this.isIntentionalDisconnect) return;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[AIRSTARK] Reconectando WebSocket... (Intento ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.callbacks.onError?.(new Error('No se pudo establecer conexión en tiempo real con el servidor.'));
    }
  }

  private notifyState(state: ConnectionState) {
    this.callbacks.onStateChange?.(state);
  }

  // ── Mock ─────────────────────────────────────────────────────────────
  private simulateMockWebSocket() {
    setTimeout(() => {
      this.notifyState('CONNECTED');
      // Mock inicial
      this.handleEvent({
        event: 'session_state',
        data: {
          sessionId: this.sessionId,
          status: 'active',
          students: []
        }
      });

      // Simular un estudiante conectándose a los 3s
      if (!this.isIntentionalDisconnect) {
        setTimeout(() => {
          this.handleEvent({
            event: 'student_connected',
            data: { studentId: 'mock-1', studentName: 'Juan Pérez (Mock)', joinedAt: new Date().toISOString() }
          });
        }, 3000);
      }
    }, 1000);
  }
}
