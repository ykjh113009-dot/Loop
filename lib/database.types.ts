
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_restrictions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"kind": string,"profile_id": string,"reason": string,"school_id": string,"until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"kind": string,"profile_id": string,"reason": string,"school_id": string,"until": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"kind"?: string,"profile_id"?: string,"reason"?: string,"school_id"?: string,"until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_restrictions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_restrictions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_restrictions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_applications": {
                  Row: {
                    "applicant_id": string,"assigned_role": string | null,"contribution": string,"created_at": string,"experience": string,"id": string,"motivation": string,"position": string,"requested_role": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_id": string,"assigned_role"?: string | null,"contribution": string,"created_at"?: string,"experience"?: string,"id"?: string,"motivation": string,"position"?: string,"requested_role": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"status"?: string
                  }
                  Update: {
                    "applicant_id"?: string,"assigned_role"?: string | null,"contribution"?: string,"created_at"?: string,"experience"?: string,"id"?: string,"motivation"?: string,"position"?: string,"requested_role"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_applications_applicant_id_fkey"
      columns: ["applicant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_applications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_applications_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_emails": {
                  Row: {
                    "created_at": string,"email": string,"is_owner": boolean,"role": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"is_owner"?: boolean,"role"?: string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"is_owner"?: boolean,"role"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_emails_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
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
                    "accepted_at": string | null,"conversation_id": string,"last_read_at": string,"profile_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"conversation_id": string,"last_read_at"?: string,"profile_id": string,"role"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"conversation_id"?: string,"last_read_at"?: string,"profile_id"?: string,"role"?: string
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
                    "club_id": string | null,"created_at": string,"created_by": string | null,"id": string,"kind": string,"last_message_at": string | null,"school_id": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind": string,"last_message_at"?: string | null,"school_id": string,"title"?: string | null
                  }
                  Update: {
                    "club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"last_message_at"?: string | null,"school_id"?: string,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_club_id_fkey"
      columns: ["club_id"]
isOneToOne: true
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"follows": {
                  Row: {
                    "created_at": string,"followed_id": string,"follower_id": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followed_id": string,"follower_id": string,"school_id": string
                  }
                  Update: {
                    "created_at"?: string,"followed_id"?: string,"follower_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followed_id_fkey"
      columns: ["followed_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"friend_requests": {
                  Row: {
                    "created_at": string,"from_id": string,"id": string,"responded_at": string | null,"school_id": string,"status": string,"to_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_id": string,"id"?: string,"responded_at"?: string | null,"school_id": string,"status"?: string,"to_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_id"?: string,"id"?: string,"responded_at"?: string | null,"school_id"?: string,"status"?: string,"to_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friend_requests_from_id_fkey"
      columns: ["from_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friend_requests_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friend_requests_to_id_fkey"
      columns: ["to_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friendships": {
                  Row: {
                    "a_id": string,"b_id": string,"created_at": string,"school_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "a_id": string,"b_id": string,"created_at"?: string,"school_id": string
                  }
                  Update: {
                    "a_id"?: string,"b_id"?: string,"created_at"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_a_id_fkey"
      columns: ["a_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_b_id_fkey"
      columns: ["b_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_school_id_fkey"
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
                },"leadership_requests": {
                  Row: {
                    "club_id": string | null,"created_at": string,"id": string,"kind": string,"profile_id": string,"reason": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"school_id": string,"scope": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"profile_id": string,"reason": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id": string,"scope"?: string,"status"?: string
                  }
                  Update: {
                    "club_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"profile_id"?: string,"reason"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_id"?: string,"scope"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leadership_requests_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leadership_requests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leadership_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leadership_requests_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"leadership_roles": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"club_id": string | null,"id": string,"kind": string,"profile_id": string,"school_id": string,"scope": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"club_id"?: string | null,"id"?: string,"kind": string,"profile_id": string,"school_id": string,"scope"?: string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"club_id"?: string | null,"id"?: string,"kind"?: string,"profile_id"?: string,"school_id"?: string,"scope"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leadership_roles_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leadership_roles_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leadership_roles_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leadership_roles_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
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
                },"message_reactions": {
                  Row: {
                    "conversation_id": string,"created_at": string,"emoji": string,"message_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"emoji": string,"message_id": string,"profile_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"emoji"?: string,"message_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_reactions_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reactions_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reactions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_kind": string | null,"attachment_name": string | null,"attachment_path": string | null,"body": string,"conversation_id": string,"created_at": string,"id": string,"school_id": string,"sender_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_kind"?: string | null,"attachment_name"?: string | null,"attachment_path"?: string | null,"body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"school_id": string,"sender_id": string,"status"?: string
                  }
                  Update: {
                    "attachment_kind"?: string | null,"attachment_name"?: string | null,"attachment_path"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"school_id"?: string,"sender_id"?: string,"status"?: string
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
                    "body": string,"created_at": string,"id": string,"kind": string,"link": string | null,"pushed_at": string | null,"read_at": string | null,"recipient_id": string,"school_id": string,"silent": boolean,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_id": string,"school_id": string,"silent"?: boolean,"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"school_id"?: string,"silent"?: boolean,"title"?: string
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
                },"post_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"parent_id": string | null,"post_id": string,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"parent_id"?: string | null,"post_id": string,"school_id": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"parent_id"?: string | null,"post_id"?: string,"school_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "post_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_comments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"post_poll_options": {
                  Row: {
                    "idx": number,"label": string,"post_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "idx": number,"label": string,"post_id": string
                  }
                  Update: {
                    "idx"?: number,"label"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_poll_options_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_poll_votes": {
                  Row: {
                    "created_at": string,"idx": number,"post_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"idx": number,"post_id": string,"profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"idx"?: number,"post_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_poll_votes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_poll_votes_post_id_idx_fkey"
      columns: ["post_id","idx"]
isOneToOne: false
      referencedRelation: "post_poll_options"
      referencedColumns: ["post_id","idx"]
    },{
      foreignKeyName: "post_poll_votes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_reactions": {
                  Row: {
                    "created_at": string,"kind": string,"post_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"kind"?: string,"post_id": string,"profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"kind"?: string,"post_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_reactions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_reactions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_saves": {
                  Row: {
                    "created_at": string,"post_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_saves_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_saves_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_tags": {
                  Row: {
                    "created_at": string,"post_id": string,"school_id": string,"tag": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"school_id": string,"tag": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"school_id"?: string,"tag"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_tags_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_tags_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"body": string,"club_id": string | null,"comment_count": number,"created_at": string,"id": string,"image_path": string | null,"kind": string,"reaction_count": number,"repost_of": string | null,"school_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"club_id"?: string | null,"comment_count"?: number,"created_at"?: string,"id"?: string,"image_path"?: string | null,"kind"?: string,"reaction_count"?: number,"repost_of"?: string | null,"school_id": string,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"club_id"?: string | null,"comment_count"?: number,"created_at"?: string,"id"?: string,"image_path"?: string | null,"kind"?: string,"reaction_count"?: number,"repost_of"?: string | null,"school_id"?: string,"status"?: string
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
      foreignKeyName: "posts_repost_of_fkey"
      columns: ["repost_of"]
isOneToOne: false
      referencedRelation: "posts"
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
                },"profile_settings": {
                  Row: {
                    "large_text": boolean,"locale": string,"notifications_enabled": boolean,"profile_id": string,"reduce_motion": boolean,"updated_at": string,"who_can_message": string
                  }
                  ComputedFields: never
                  Insert: {
                    "large_text"?: boolean,"locale"?: string,"notifications_enabled"?: boolean,"profile_id": string,"reduce_motion"?: boolean,"updated_at"?: string,"who_can_message"?: string
                  }
                  Update: {
                    "large_text"?: boolean,"locale"?: string,"notifications_enabled"?: boolean,"profile_id"?: string,"reduce_motion"?: boolean,"updated_at"?: string,"who_can_message"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_settings_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "accent": string,"alumni_year": number | null,"avatar": string,"bio": string,"cover_path": string | null,"created_at": string,"deactivated_at": string | null,"favorite_subjects": (string)[],"full_name": string,"grade": number | null,"handle": string | null,"id": string,"is_owner": boolean,"major": string,"onboarded_at": string | null,"photo_path": string | null,"role": string,"school_id": string,"section": string | null,"self_deactivated": boolean,"skills": (string)[],"suspended_until": string | null,"suspension_reason": string | null,"university": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent"?: string,"alumni_year"?: number | null,"avatar"?: string,"bio"?: string,"cover_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"favorite_subjects"?: (string)[],"full_name": string,"grade"?: number | null,"handle"?: string | null,"id": string,"is_owner"?: boolean,"major"?: string,"onboarded_at"?: string | null,"photo_path"?: string | null,"role"?: string,"school_id": string,"section"?: string | null,"self_deactivated"?: boolean,"skills"?: (string)[],"suspended_until"?: string | null,"suspension_reason"?: string | null,"university"?: string
                  }
                  Update: {
                    "accent"?: string,"alumni_year"?: number | null,"avatar"?: string,"bio"?: string,"cover_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"favorite_subjects"?: (string)[],"full_name"?: string,"grade"?: number | null,"handle"?: string | null,"id"?: string,"is_owner"?: boolean,"major"?: string,"onboarded_at"?: string | null,"photo_path"?: string | null,"role"?: string,"school_id"?: string,"section"?: string | null,"self_deactivated"?: boolean,"skills"?: (string)[],"suspended_until"?: string | null,"suspension_reason"?: string | null,"university"?: string
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
                },"rate_events": {
                  Row: {
                    "action": string,"created_at": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"profile_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rate_events_profile_id_fkey"
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
                    "admin_mfa_required": boolean,"created_at": string,"email_domain": string,"google_only": boolean,"grades": (number)[],"id": string,"name": string,"roster_required": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_mfa_required"?: boolean,"created_at"?: string,"email_domain": string,"google_only"?: boolean,"grades"?: (number)[],"id"?: string,"name": string,"roster_required"?: boolean
                  }
                  Update: {
                    "admin_mfa_required"?: boolean,"created_at"?: string,"email_domain"?: string,"google_only"?: boolean,"grades"?: (number)[],"id"?: string,"name"?: string,"roster_required"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"security_events": {
                  Row: {
                    "created_at": string,"details": string,"id": number,"ip": string | null,"kind": string,"profile_id": string,"school_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string,"id"?: never,"ip"?: string | null,"kind": string,"profile_id": string,"school_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: string,"id"?: never,"ip"?: string | null,"kind"?: string,"profile_id"?: string,"school_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "security_events_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "security_events_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
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
            "add_group_members":
{ Args: { "p_conversation": string,"p_members": (string)[] }; Returns: number
                           },
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
"are_friends":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"assign_leadership_role":
{ Args: { "p_club": string,"p_kind": string,"p_scope": string,"p_user": string }; Returns: undefined
                           },
"award_badges":
{ Args: { "p_profile": string }; Returns: undefined
                           },
"award_points":
{ Args: { "p_at"?: string,"p_points": number,"p_profile": string,"p_reason": string,"p_source": string }; Returns: undefined
                           },
"can_manage_account":
{ Args: { "p_user": string }; Returns: boolean
                           },
"can_manage_event":
{ Args: { "e": Omit<Database["public"]['Tables']["events"]['Row'], Database["public"]['Tables']["events"]['ComputedFields']> }; Returns: boolean
                           },
"cancel_event":
{ Args: { "p_event": string,"p_reason": string }; Returns: undefined
                           },
"cancel_friend_request":
{ Args: { "p_request": string }; Returns: undefined
                           },
"challenge_completions":
{ Args: { "p_challenge": string }; Returns: number
                           },
"check_rate":
{ Args: { "p_action": string,"p_max": number,"p_seconds": number }; Returns: undefined
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
"create_group_conversation":
{ Args: { "p_members": (string)[],"p_title": string }; Returns: string
                           },
"create_post":
{ Args: { "p_body": string,"p_club": string,"p_image": string,"p_kind": string,"p_options": (string)[],"p_repost_of": string }; Returns: string
                           },
"deactivate_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"delete_my_account":
{ Args: { "p_confirm": string }; Returns: undefined
                           },
"election_summary":
{ Args: { "p_election": string }; Returns: Json
                           },
"feed_posts":
{ Args: { "p_limit": number,"p_offset": number,"p_tag"?: string }; Returns: {
              "author_id": string,
"body": string,
"club_id": string | null,
"comment_count": number,
"created_at": string,
"id": string,
"image_path": string | null,
"kind": string,
"reaction_count": number,
"repost_of": string | null,
"school_id": string,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "posts"
        isOneToOne: false
        isSetofReturn: true
      } },
"finish_tutoring":
{ Args: { "p_completed": boolean,"p_request": string }; Returns: undefined
                           },
"grade_leaderboard":
{ Args: { "p_period": string }; Returns: {
              "avg_points": number,"grade": number,"points": number,"students": number
            }[]
                           },
"grant_leadership":
{ Args: { "p_club": string,"p_kind": string,"p_profile": string,"p_scope": string }; Returns: undefined
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
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_reader":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_restricted":
{ Args: { "p_kind": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"leave_conversation":
{ Args: { "p_conversation": string }; Returns: undefined
                           },
"local_time":
{ Args: { "t": string }; Returns: string
                           },
"log_action":
{ Args: { "p_action": string,"p_details": string,"p_school": string,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"make_handle":
{ Args: { "p_email": string,"p_id": string,"p_school": string }; Returns: string
                           },
"mfa_ok":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
"notify_mentions":
{ Args: { "p_author": string,"p_link": string,"p_school": string,"p_text": string }; Returns: undefined
                           },
"points_today":
{ Args: { "p_profile": string,"p_reason": string }; Returns: number
                           },
"poll_results":
{ Args: { "p_poll": string }; Returns: Json
                           },
"post_poll_results":
{ Args: { "p_posts": (string)[] }; Returns: {
              "idx": number,"label": string,"mine": boolean,"post_id": string,"votes": number
            }[]
                           },
"reactivate_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"record_security_event":
{ Args: { "p_ip": string,"p_kind": string,"p_user_agent": string }; Returns: undefined
                           },
"reject_blocked":
{ Args: { "p_school": string,"p_text": string }; Returns: undefined
                           },
"remove_leadership_role":
{ Args: { "p_role": string }; Returns: undefined
                           },
"request_leadership_role":
{ Args: { "p_club": string,"p_kind": string,"p_reason": string,"p_scope": string }; Returns: string
                           },
"request_tutoring":
{ Args: { "p_message": string,"p_subject": string,"p_tutor": string }; Returns: string
                           },
"reschedule_event":
{ Args: { "p_ends": string,"p_event": string,"p_starts": string }; Returns: undefined
                           },
"reset_account_mfa":
{ Args: { "p_user": string }; Returns: undefined
                           },
"respond_friend_request":
{ Args: { "p_accept": boolean,"p_request": string }; Returns: undefined
                           },
"respond_message_request":
{ Args: { "p_accept": boolean,"p_conversation": string }; Returns: undefined
                           },
"respond_suggestion":
{ Args: { "p_response": string,"p_status": string,"p_suggestion": string }; Returns: undefined
                           },
"respond_tutoring":
{ Args: { "p_accept": boolean,"p_request": string }; Returns: string
                           },
"review_admin_application":
{ Args: { "p_application": string,"p_approve": boolean,"p_note": string,"p_role": string }; Returns: undefined
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
"review_leadership_request":
{ Args: { "p_approve": boolean,"p_note": string,"p_request": string }; Returns: undefined
                           },
"review_volunteer":
{ Args: { "p_approve": boolean,"p_entry": string,"p_note": string }; Returns: undefined
                           },
"role_rank":
{ Args: { "p_role": string }; Returns: number
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
"send_friend_request":
{ Args: { "p_to": string }; Returns: undefined
                           },
"set_counselor_status":
{ Args: { "p_request": string,"p_status": string }; Returns: undefined
                           },
"set_my_interests":
{ Args: { "p_interests": (number)[] }; Returns: undefined
                           },
"set_restriction":
{ Args: { "p_days": number,"p_kind": string,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"start_counselor_request":
{ Args: { "p_message": string,"p_topic": string,"p_urgent": boolean }; Returns: string
                           },
"start_direct_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"submit_admin_application":
{ Args: { "p_contribution": string,"p_experience": string,"p_motivation": string,"p_position": string,"p_role": string }; Returns: string
                           },
"suspend_user":
{ Args: { "p_days": number,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"trending_tags":
{ Args: { "p_limit"?: number }; Returns: {
              "posts": number,"tag": string
            }[]
                           },
"unfriend":
{ Args: { "p_other": string }; Returns: undefined
                           },
"unsuspend_user":
{ Args: { "p_user": string }; Returns: undefined
                           },
"vote_post_poll":
{ Args: { "p_idx": number,"p_post": string }; Returns: undefined
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
