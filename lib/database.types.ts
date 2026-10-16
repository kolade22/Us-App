// Hand-written to mirror supabase/migrations exactly, in supabase-cli
// codegen shape. Replace with `supabase gen types --lang typescript
// --project-id <ref> --schema public > lib/database.types.ts` once the
// project is linked, then diff to confirm parity.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          last_seen_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          last_seen_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          last_seen_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_token: string;
          platform: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_token: string;
          platform?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          expo_token?: string;
          platform?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      couples: {
        Row: {
          id: string;
          relationship_start_date: string;
          invite_code: string | null;
          invite_code_expires_at: string | null;
          status: string | null;
          created_by: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          relationship_start_date: string;
          invite_code?: string | null;
          invite_code_expires_at?: string | null;
          status?: string | null;
          created_by: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          relationship_start_date?: string;
          invite_code?: string | null;
          invite_code_expires_at?: string | null;
          status?: string | null;
          created_by?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      couple_members: {
        Row: {
          id: string;
          couple_id: string;
          user_id: string;
          role: string | null;
          joined_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          user_id: string;
          role?: string | null;
          joined_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          user_id?: string;
          role?: string | null;
          joined_at?: string | null;
        };
        Relationships: [];
      };
      couple_settings: {
        Row: {
          couple_id: string;
          timezone: string | null;
          daily_picture_reminder_time: string | null;
        };
        Insert: {
          couple_id: string;
          timezone?: string | null;
          daily_picture_reminder_time?: string | null;
        };
        Update: {
          couple_id?: string;
          timezone?: string | null;
          daily_picture_reminder_time?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          couple_id: string;
          sender_id: string;
          client_generated_id: string;
          content: string | null;
          media_path: string | null;
          reply_to_id: string | null;
          read_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          sender_id: string;
          client_generated_id: string;
          content?: string | null;
          media_path?: string | null;
          reply_to_id?: string | null;
          read_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          sender_id?: string;
          client_generated_id?: string;
          content?: string | null;
          media_path?: string | null;
          reply_to_id?: string | null;
          read_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          couple_id: string;
          created_by: string;
          target_user_id: string;
          question_text: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          created_by: string;
          target_user_id: string;
          question_text: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          created_by?: string;
          target_user_id?: string;
          question_text?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      question_instances: {
        Row: {
          id: string;
          couple_id: string;
          question_id: string;
          recipient_id: string;
          answer_text: string | null;
          issued_at: string | null;
          answered_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          question_id: string;
          recipient_id: string;
          answer_text?: string | null;
          issued_at?: string | null;
          answered_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          question_id?: string;
          recipient_id?: string;
          answer_text?: string | null;
          issued_at?: string | null;
          answered_at?: string | null;
        };
        Relationships: [];
      };
      daily_pictures: {
        Row: {
          id: string;
          couple_id: string;
          user_id: string;
          image_path: string;
          submission_date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          user_id: string;
          image_path: string;
          submission_date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          user_id?: string;
          image_path?: string;
          submission_date?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      thinking_of_you: {
        Row: {
          id: string;
          couple_id: string;
          initiator_id: string;
          responded: boolean | null;
          thought_text: string | null;
          prompt_date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          initiator_id: string;
          responded?: boolean | null;
          thought_text?: string | null;
          prompt_date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          initiator_id?: string;
          responded?: boolean | null;
          thought_text?: string | null;
          prompt_date?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      pet_state: {
        Row: {
          couple_id: string;
          health: number | null;
          hunger: number | null;
          happiness: number | null;
          energy: number | null;
          is_sick: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          couple_id: string;
          health?: number | null;
          hunger?: number | null;
          happiness?: number | null;
          energy?: number | null;
          is_sick?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          couple_id?: string;
          health?: number | null;
          hunger?: number | null;
          happiness?: number | null;
          energy?: number | null;
          is_sick?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      pet_actions: {
        Row: {
          id: string;
          couple_id: string;
          user_id: string;
          action_type: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          couple_id: string;
          user_id: string;
          action_type: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          couple_id?: string;
          user_id?: string;
          action_type?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      join_attempts: {
        Row: {
          id: string;
          user_id: string | null;
          ip: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ip?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          ip?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_couple_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      create_couple: {
        Args: { p_start_date: string; p_invite_code: string; p_expires_at: string };
        Returns: string;
      };
      join_couple: {
        Args: { p_code: string };
        Returns: string;
      };
      regenerate_invite_code: {
        Args: { p_new_code: string; p_expires_at: string };
        Returns: string;
      };
      issue_daily_question: {
        Args: { p_couple_id: string; p_recipient_id: string };
        Returns: string | null;
      };
      issue_scheduled_questions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
