
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
                },"badges": {
                  Row: {
                    "code": string,"description": string,"emoji": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description": string,"emoji": string,"name": string,"sort"?: number
                  }
                  Update: {
                    "code"?: string,"description"?: string,"emoji"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
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
                },"challenge_submissions": {
                  Row: {
                    "challenge_id": string,"created_at": string,"id": string,"image_path": string | null,"note": string,"profile_id": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"note": string,"profile_id": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"status"?: string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"note"?: string,"profile_id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_submissions_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "challenge_submissions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "challenge_submissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "challenge_submissions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"challenges": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"emoji": string,"ends_at": string,"id": string,"points": number,"school_id": string,"starts_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"emoji"?: string,"ends_at": string,"id"?: string,"points"?: number,"school_id": string,"starts_at": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"emoji"?: string,"ends_at"?: string,"id"?: string,"points"?: number,"school_id"?: string,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenges_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "challenges_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
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
                },"council_members": {
                  Row: {
                    "added_at": string,"position": string,"profile_id": string,"school_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"position": string,"profile_id": string,"school_id": string,"sort"?: number
                  }
                  Update: {
                    "added_at"?: string,"position"?: string,"profile_id"?: string,"school_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "council_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "council_members_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"counselor_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"request_id": string,"school_id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"request_id": string,"school_id": string,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"request_id"?: string,"school_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "counselor_messages_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "counselor_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "counselor_messages_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "counselor_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"counselor_requests": {
                  Row: {
                    "created_at": string,"id": string,"last_message_at": string,"school_id": string,"status": string,"student_id": string,"topic": string,"urgent": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string,"school_id": string,"status"?: string,"student_id": string,"topic"?: string,"urgent"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string,"school_id"?: string,"status"?: string,"student_id"?: string,"topic"?: string,"urgent"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "counselor_requests_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "counselor_requests_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"election_candidates": {
                  Row: {
                    "election_id": string,"id": string,"profile_id": string,"statement": string
                  }
                  ComputedFields: never
                  Insert: {
                    "election_id": string,"id"?: string,"profile_id": string,"statement"?: string
                  }
                  Update: {
                    "election_id"?: string,"id"?: string,"profile_id"?: string,"statement"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "election_candidates_election_id_fkey"
      columns: ["election_id"]
isOneToOne: false
      referencedRelation: "elections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "election_candidates_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"election_votes": {
                  Row: {
                    "candidate_id": string,"created_at": string,"election_id": string,"school_id": string,"voter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"election_id": string,"school_id": string,"voter_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"election_id"?: string,"school_id"?: string,"voter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "election_votes_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "election_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "election_votes_election_id_fkey"
      columns: ["election_id"]
isOneToOne: false
      referencedRelation: "elections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "election_votes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "election_votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"elections": {
                  Row: {
                    "closes_at": string,"created_at": string,"created_by": string | null,"description": string,"eligible_grades": (number)[] | null,"id": string,"opens_at": string,"school_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closes_at": string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"eligible_grades"?: (number)[] | null,"id"?: string,"opens_at": string,"school_id": string,"title": string
                  }
                  Update: {
                    "closes_at"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"eligible_grades"?: (number)[] | null,"id"?: string,"opens_at"?: string,"school_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "elections_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "elections_school_id_fkey"
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
                },"listings": {
                  Row: {
                    "category": string,"condition": string,"created_at": string,"description": string,"id": string,"image_path": string | null,"kind": string,"price": number | null,"school_id": string,"seller_id": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"condition"?: string,"created_at"?: string,"description"?: string,"id"?: string,"image_path"?: string | null,"kind": string,"price"?: number | null,"school_id": string,"seller_id": string,"status"?: string,"title": string
                  }
                  Update: {
                    "category"?: string,"condition"?: string,"created_at"?: string,"description"?: string,"id"?: string,"image_path"?: string | null,"kind"?: string,"price"?: number | null,"school_id"?: string,"seller_id"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"points_ledger": {
                  Row: {
                    "created_at": string,"id": number,"points": number,"profile_id": string,"reason": string,"school_id": string,"source_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"points": number,"profile_id": string,"reason": string,"school_id": string,"source_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"points"?: number,"profile_id"?: string,"reason"?: string,"school_id"?: string,"source_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "points_ledger_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "points_ledger_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "created_at": string,"option_index": number,"poll_id": string,"profile_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"option_index": number,"poll_id": string,"profile_id": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"option_index"?: number,"poll_id"?: string,"profile_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "closes_at": string,"club_id": string | null,"created_at": string,"created_by": string | null,"id": string,"options": (string)[],"question": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closes_at": string,"club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"options": (string)[],"question": string,"school_id": string
                  }
                  Update: {
                    "closes_at"?: string,"club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"options"?: (string)[],"question"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "polls_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "polls_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "polls_school_id_fkey"
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
                },"profile_badges": {
                  Row: {
                    "badge_code": string,"earned_at": string,"profile_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_code": string,"earned_at"?: string,"profile_id": string,"school_id": string
                  }
                  Update: {
                    "badge_code"?: string,"earned_at"?: string,"profile_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_badges_badge_code_fkey"
      columns: ["badge_code"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "profile_badges_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_badges_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
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
                    "alumni_year": number | null,"avatar": string,"bio": string,"created_at": string,"deactivated_at": string | null,"full_name": string,"grade": number | null,"id": string,"major": string,"onboarded_at": string | null,"role": string,"school_id": string,"suspended_until": string | null,"suspension_reason": string | null,"university": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alumni_year"?: number | null,"avatar"?: string,"bio"?: string,"created_at"?: string,"deactivated_at"?: string | null,"full_name": string,"grade"?: number | null,"id": string,"major"?: string,"onboarded_at"?: string | null,"role"?: string,"school_id": string,"suspended_until"?: string | null,"suspension_reason"?: string | null,"university"?: string
                  }
                  Update: {
                    "alumni_year"?: number | null,"avatar"?: string,"bio"?: string,"created_at"?: string,"deactivated_at"?: string | null,"full_name"?: string,"grade"?: number | null,"id"?: string,"major"?: string,"onboarded_at"?: string | null,"role"?: string,"school_id"?: string,"suspended_until"?: string | null,"suspension_reason"?: string | null,"university"?: string
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
                    "added_by": string | null,"alumni_year": number | null,"created_at": string,"email": string,"grade": number | null,"role": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"alumni_year"?: number | null,"created_at"?: string,"email": string,"grade"?: number | null,"role"?: string,"school_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"alumni_year"?: number | null,"created_at"?: string,"email"?: string,"grade"?: number | null,"role"?: string,"school_id"?: string
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
                },"study_buddy_posts": {
                  Row: {
                    "active": boolean,"author_id": string,"created_at": string,"id": string,"note": string,"school_id": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"author_id": string,"created_at"?: string,"id"?: string,"note": string,"school_id": string,"subject": string
                  }
                  Update: {
                    "active"?: boolean,"author_id"?: string,"created_at"?: string,"id"?: string,"note"?: string,"school_id"?: string,"subject"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_buddy_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_buddy_posts_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"suggestions": {
                  Row: {
                    "author_id": string,"body": string,"category": string,"created_at": string,"id": string,"responded_at": string | null,"responded_by": string | null,"response": string | null,"school_id": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string,"category"?: string,"created_at"?: string,"id"?: string,"responded_at"?: string | null,"responded_by"?: string | null,"response"?: string | null,"school_id": string,"status"?: string,"title": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"category"?: string,"created_at"?: string,"id"?: string,"responded_at"?: string | null,"responded_by"?: string | null,"response"?: string | null,"school_id"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suggestions_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestions_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suggestions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"tawjihi_answers": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"question_id": string,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"question_id": string,"school_id": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"question_id"?: string,"school_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tawjihi_answers_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tawjihi_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "tawjihi_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tawjihi_answers_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"tawjihi_questions": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"school_id": string,"status": string,"subject": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string,"created_at"?: string,"id"?: string,"school_id": string,"status"?: string,"subject": string,"title": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"status"?: string,"subject"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tawjihi_questions_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tawjihi_questions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"tutor_profiles": {
                  Row: {
                    "about": string,"active": boolean,"availability": string,"created_at": string,"profile_id": string,"school_id": string,"subjects": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string,"active"?: boolean,"availability"?: string,"created_at"?: string,"profile_id": string,"school_id": string,"subjects": (string)[]
                  }
                  Update: {
                    "about"?: string,"active"?: boolean,"availability"?: string,"created_at"?: string,"profile_id"?: string,"school_id"?: string,"subjects"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "tutor_profiles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutor_profiles_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"tutoring_requests": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"learner_id": string,"message": string,"responded_at": string | null,"school_id": string,"status": string,"subject": string,"tutor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"learner_id": string,"message"?: string,"responded_at"?: string | null,"school_id": string,"status"?: string,"subject": string,"tutor_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"learner_id"?: string,"message"?: string,"responded_at"?: string | null,"school_id"?: string,"status"?: string,"subject"?: string,"tutor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tutoring_requests_learner_id_fkey"
      columns: ["learner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutoring_requests_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutoring_requests_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"volunteer_entries": {
                  Row: {
                    "activity_date": string,"created_at": string,"description": string,"hours": number,"id": string,"organization": string,"profile_id": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"status": string,"supervisor_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_date": string,"created_at"?: string,"description"?: string,"hours": number,"id"?: string,"organization": string,"profile_id": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"status"?: string,"supervisor_name"?: string
                  }
                  Update: {
                    "activity_date"?: string,"created_at"?: string,"description"?: string,"hours"?: number,"id"?: string,"organization"?: string,"profile_id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"status"?: string,"supervisor_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "volunteer_entries_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteer_entries_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteer_entries_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_set_alumni":
{ Args: { "p_user": string,"p_year": number }; Returns: undefined
                           },
"admin_set_deactivated":
{ Args: { "p_deactivated": boolean,"p_user": string }; Returns: undefined
                           },
"admin_update_member":
{ Args: { "p_grade": number,"p_role": string,"p_user": string }; Returns: undefined
                           },
"archive_club":
{ Args: { "p_club": string,"p_reason": string }; Returns: undefined
                           },
"award_badges":
{ Args: { "p_profile": string }; Returns: undefined
                           },
"award_points":
{ Args: { "p_at"?: string,"p_points": number,"p_profile": string,"p_reason": string,"p_source": string }; Returns: undefined
                           },
"can_manage_event":
{ Args: { "e": Omit<Database["public"]['Tables']["events"]['Row'], Database["public"]['Tables']["events"]['ComputedFields']> }; Returns: boolean
                           },
"cancel_event":
{ Args: { "p_event": string,"p_reason": string }; Returns: undefined
                           },
"challenge_completions":
{ Args: { "p_challenge": string }; Returns: number
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
"election_summary":
{ Args: { "p_election": string }; Returns: Json
                           },
"finish_tutoring":
{ Args: { "p_completed": boolean,"p_request": string }; Returns: undefined
                           },
"grade_leaderboard":
{ Args: { "p_period": string }; Returns: {
              "avg_points": number,"grade": number,"points": number,"students": number
            }[]
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
"is_council_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_counselor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_current_student":
{ Args: { "p_profile": string }; Returns: boolean
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
"points_today":
{ Args: { "p_profile": string,"p_reason": string }; Returns: number
                           },
"poll_results":
{ Args: { "p_poll": string }; Returns: Json
                           },
"reject_blocked":
{ Args: { "p_school": string,"p_text": string }; Returns: undefined
                           },
"request_tutoring":
{ Args: { "p_message": string,"p_subject": string,"p_tutor": string }; Returns: string
                           },
"reschedule_event":
{ Args: { "p_ends": string,"p_event": string,"p_starts": string }; Returns: undefined
                           },
"respond_suggestion":
{ Args: { "p_response": string,"p_status": string,"p_suggestion": string }; Returns: undefined
                           },
"respond_tutoring":
{ Args: { "p_accept": boolean,"p_request": string }; Returns: string
                           },
"review_challenge_submission":
{ Args: { "p_approve": boolean,"p_note": string,"p_submission": string }; Returns: undefined
                           },
"review_club":
{ Args: { "p_approve": boolean,"p_club": string,"p_note": string }; Returns: undefined
                           },
"review_event":
{ Args: { "p_approve": boolean,"p_event": string,"p_note": string }; Returns: undefined
                           },
"review_volunteer":
{ Args: { "p_approve": boolean,"p_entry": string,"p_note": string }; Returns: undefined
                           },
"school_has_counselor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"school_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"school_stats_phase2":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"send_event_reminders":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_counselor_status":
{ Args: { "p_request": string,"p_status": string }; Returns: undefined
                           },
"set_my_interests":
{ Args: { "p_interests": (number)[] }; Returns: undefined
                           },
"start_counselor_request":
{ Args: { "p_message": string,"p_topic": string,"p_urgent": boolean }; Returns: string
                           },
"start_direct_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"suspend_user":
{ Args: { "p_days": number,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"unsuspend_user":
{ Args: { "p_user": string }; Returns: undefined
                           },
"week_start":
{ Args: Record<PropertyKey, never>; Returns: string
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
