/**
 * services/supabaseClient.ts
 * Cliente centralizado de Supabase para AIRSTARK.
 *
 * REGLAS DE SEGURIDAD:
 *   - Solo usa VITE_SUPABASE_ANON_KEY (publishable key pública)
 *   - NUNCA usar service_role key en el frontend
 *   - VITE_* son visibles en el navegador — no colocar secretos
 *   - El RLS de Supabase protege los datos según auth.uid()
 *
 * AUTENTICACIÓN:
 *   - Usa Supabase Auth con Google OAuth
 *   - auth.uid() se usa automáticamente en las políticas RLS
 *   - El cliente maneja sesiones automáticamente via cookies
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Exportadas SOLO para consultas públicas a /auth/v1/settings (preflight de
// providers en supabaseAuth.ts). La anon key es pública por diseño; NUNCA
// colocar aquí una service_role key.
export { supabaseUrl, supabaseAnonKey };

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[AIRSTARK] Supabase no configurado.\n' +
    'Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persistir la sesión en localStorage (compatible con recarga de página)
    persistSession: true,
    // Detectar y restaurar sesión desde la URL (necesario para OAuth callback)
    detectSessionInUrl: true,
    // Usar PKCE flow para mayor seguridad con Google OAuth
    flowType: 'pkce',
  },
});

// ── Tipos de base de datos (generados conceptualmente — se actualizarán con generate_typescript_types) ──

export type Database = {
  public: {
    Tables: {
      models_3d: {
        Row: {
          id: string;
          name: string;
          asset_key: string;
          asset_url: string | null;
          thumbnail_url: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['models_3d']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['models_3d']['Insert']>;
      };
      evaluations: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['evaluations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['evaluations']['Insert']>;
      };
      questions: {
        Row: {
          id: string;
          evaluation_id: string;
          question_text: string;
          question_order: number;
          feedback_text: string;
          target_element_id: string | null;
          ar_placement: unknown;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['questions']['Row'], 'id' | 'created_at' | 'feedback_text' | 'target_element_id' | 'ar_placement'> & Partial<Pick<Database['public']['Tables']['questions']['Row'], 'feedback_text' | 'target_element_id' | 'ar_placement'>>;
        Update: Partial<Database['public']['Tables']['questions']['Insert']>;
      };
      options: {
        Row: {
          id: string;
          question_id: string;
          option_text: string;
          option_order: number;
          is_correct: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['options']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['options']['Insert']>;
      };
      sessions: {
        Row: {
          id: string;            // sessionId — generado por PostgreSQL
          evaluation_id: string | null;
          name: string;
          description: string | null;
          activation_date: string;
          duration_minutes: number;
          status: 'waiting' | 'active' | 'completed' | 'expired' | 'cancelled';
          model_3d_id: string | null;
          created_by: string;
          teacher_name: string | null;   // nombre visible del profesor (payload Unity)
          version: string;
          allow_offline: boolean;
          objectives: unknown;           // [{ Id, Description, IsOptional }]
          idempotency_key: string;
          created_at: string;
          updated_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'created_at' | 'updated_at' | 'expires_at' | 'teacher_name' | 'version' | 'allow_offline' | 'objectives'> & Partial<Pick<Database['public']['Tables']['sessions']['Row'], 'teacher_name' | 'version' | 'allow_offline' | 'objectives'>>;
        Update: Partial<Pick<Database['public']['Tables']['sessions']['Row'], 'status' | 'updated_at'>>;
      };
      session_configs: {
        Row: {
          session_id: string;
          accent_color_hex: string;
          required_accuracy_percentage: number;
          enable_certificate_generation: boolean;
          quiz_time_limit_seconds: number;
          quiz_allow_backtrack: boolean;
          quiz_shuffle_questions: boolean;
          quiz_enable_immediate_feedback: boolean;
          ar_detection_mode: string;
          ar_initial_model_scale: number;
          ar_enable_depth_sensing: boolean;
          ar_show_plane_markers: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['session_configs']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['session_configs']['Insert']>;
      };
    };
  };
};
