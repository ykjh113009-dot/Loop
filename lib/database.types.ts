
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "announcements": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"school_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"school_id": string,"title": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"blocked_words": {
                  Row: {
                    "created_at": string,"id": number,"normalized": string | null,"school_id": string | null,"word": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"normalized"?: never,"school_id"?: string | null,"word": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"normalized"?: never,"school_id"?: string | null,"word"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocked_words_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"club_members": {
                  Row: {
                    "club_id": string,"joined_at": string,"profile_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"joined_at"?: string,"profile_id": string,"role"?: string
                  }
                  Update: {
                    "club_id"?: string,"joined_at"?: string,"profile_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_members_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "created_at": string,"description": string,"emoji": string,"id": string,"name": string,"requested_by": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"emoji"?: string,"id"?: string,"name": string,"requested_by"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"emoji"?: string,"id"?: string,"name"?: string,"requested_by"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clubs_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clubs_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"last_read_at": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"last_read_at"?: string,"profile_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"last_read_at"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "club_id": string | null,"created_at": string,"id": string,"kind": string,"last_message_at": string | null,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"last_message_at"?: string | null,"school_id": string
                  }
                  Update: {
                    "club_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"last_message_at"?: string | null,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_club_id_fkey"
      columns: ["club_id"]
isOneToOne: true
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"event_rsvps": {
                  Row: {
                    "created_at": string,"event_id": string,"profile_id": string,"reminded_day": boolean,"reminded_hour": boolean,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"profile_id": string,"reminded_day"?: boolean,"reminded_hour"?: boolean,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"profile_id"?: string,"reminded_day"?: boolean,"reminded_hour"?: boolean,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_rsvps_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_rsvps_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_rsvps_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "cancel_reason": string | null,"club_id": string | null,"created_at": string,"created_by": string | null,"description": string,"ends_at": string | null,"id": string,"location": string,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"starts_at": string,"status": string,"title": string,"can_manage_event": boolean | null
                  }
                  ComputedFields: "can_manage_event"
                  Insert: {
                    "cancel_reason"?: string | null,"club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"ends_at"?: string | null,"id"?: string,"location"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"starts_at": string,"status"?: string,"title": string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"ends_at"?: string | null,"id"?: string,"location"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"starts_at"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"interests": {
                  Row: {
                    "emoji": string,"id": number,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "emoji": string,"id"?: never,"name": string,"slug": string
                  }
                  Update: {
                    "emoji"?: string,"id"?: never,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"school_id": string,"sender_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"school_id": string,"sender_id": string,"status"?: string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"sender_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": string,"id": number,"school_id": string,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: string,"id"?: never,"school_id": string,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: string,"id"?: never,"school_id"?: string,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_log_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"kind": string,"link": string | null,"pushed_at": string | null,"read_at": string | null,"recipient_id": string,"school_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_id": string,"school_id": string,"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"school_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"body": string,"club_id": string,"created_at": string,"id": string,"image_path": string | null,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"club_id": string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"school_id": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"club_id"?: string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"school_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"private_profiles": {
                  Row: {
                    "email": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"id": string
                  }
                  Update: {
                    "email"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "private_profiles_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_interests": {
                  Row: {
                    "interest_id": number,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "interest_id": number,"profile_id": string
                  }
                  Update: {
                    "interest_id"?: number,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_interests_interest_id_fkey"
      columns: ["interest_id"]
isOneToOne: false
      referencedRelation: "interests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_interests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar": string,"bio": string,"created_at": string,"deactivated_at": string | null,"full_name": string,"grade": number | null,"id": string,"onboarded_at": string | null,"role": string,"school_id": string,"suspended_until": string | null,"suspension_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar"?: string,"bio"?: string,"created_at"?: string,"deactivated_at"?: string | null,"full_name": string,"grade"?: number | null,"id": string,"onboarded_at"?: string | null,"role"?: string,"school_id": string,"suspended_until"?: string | null,"suspension_reason"?: string | null
                  }
                  Update: {
                    "avatar"?: string,"bio"?: string,"created_at"?: string,"deactivated_at"?: string | null,"full_name"?: string,"grade"?: number | null,"id"?: string,"onboarded_at"?: string | null,"role"?: string,"school_id"?: string,"suspended_until"?: string | null,"suspension_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"profile_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "admin_only": boolean,"created_at": string,"details": string,"id": string,"reason": string,"reporter_id": string | null,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"school_id": string,"snapshot": string,"status": string,"target_author_id": string | null,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_only"?: boolean,"created_at"?: string,"details"?: string,"id"?: string,"reason": string,"reporter_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"school_id": string,"snapshot"?: string,"status"?: string,"target_author_id"?: string | null,"target_id": string,"target_type": string
                  }
                  Update: {
                    "admin_only"?: boolean,"created_at"?: string,"details"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"school_id"?: string,"snapshot"?: string,"status"?: string,"target_author_id"?: string | null,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_author_id_fkey"
      columns: ["target_author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"roster": {
                  Row: {
                    "added_by": string | null,"created_at": string,"email": string,"grade": number | null,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"email": string,"grade"?: number | null,"school_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"email"?: string,"grade"?: number | null,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "created_at": string,"email_domain": string,"grades": (number)[],"id": string,"name": string,"roster_required": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email_domain": string,"grades"?: (number)[],"id"?: string,"name": string,"roster_required"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"email_domain"?: string,"grades"?: (number)[],"id"?: string,"name"?: string,"roster_required"?: boolean
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_set_deactivated":
{ Args: { "p_deactivated": boolean,"p_user": string }; Returns: undefined
                           },
"admin_update_member":
{ Args: { "p_grade": number,"p_role": string,"p_user": string }; Returns: undefined
                           },
"archive_club":
{ Args: { "p_club": string,"p_reason": string }; Returns: undefined
                           },
"can_manage_event":
{ Args: { "e": Omit<Database["public"]['Tables']["events"]['Row'], Database["public"]['Tables']["events"]['ComputedFields']> }; Returns: boolean
                           },
"cancel_event":
{ Args: { "p_event": string,"p_reason": string }; Returns: undefined
                           },
"claim_push_batch":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"id": string,"link": string,"recipient_id": string,"title": string
            }[]
                           },
"complete_onboarding":
{ Args: { "p_avatar": string,"p_bio": string,"p_grade": number,"p_interests": (number)[] }; Returns: undefined
                           },
"contains_blocked_word":
{ Args: { "p_school": string,"p_text": string }; Returns: boolean
                           },
"is_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_between":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"is_club_leader":
{ Args: { "p_club": string }; Returns: boolean
                           },
"is_club_member":
{ Args: { "p_club": string }; Returns: boolean
                           },
"is_conversation_member":
{ Args: { "p_conversation": string }; Returns: boolean
                           },
"is_reader":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"local_time":
{ Args: { "t": string }; Returns: string
                           },
"log_action":
{ Args: { "p_action": string,"p_details": string,"p_school": string,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"moderate_report":
{ Args: { "p_action": string,"p_note": string,"p_report": string }; Returns: undefined
                           },
"my_badges":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_school_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"normalize_text":
{ Args: { "t": string }; Returns: string
                           },
"notify":
{ Args: { "p_body": string,"p_kind": string,"p_link": string,"p_recipient": string,"p_title": string }; Returns: undefined
                           },
"notify_club_about_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"reschedule_event":
{ Args: { "p_ends": string,"p_event": string,"p_starts": string }; Returns: undefined
                           },
"review_club":
{ Args: { "p_approve": boolean,"p_club": string,"p_note": string }; Returns: undefined
                           },
"review_event":
{ Args: { "p_approve": boolean,"p_event": string,"p_note": string }; Returns: undefined
                           },
"school_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"send_event_reminders":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_my_interests":
{ Args: { "p_interests": (number)[] }; Returns: undefined
                           },
"start_direct_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"suspend_user":
{ Args: { "p_days": number,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"unsuspend_user":
{ Args: { "p_user": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
