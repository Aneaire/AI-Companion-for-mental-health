import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// User table - will be simplified in future migration
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id").notNull().unique(),
  email: varchar("email").notNull(),
  nickname: varchar("nickname"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  age: integer("age"),
  status: varchar("status"),
  hobby: text("hobby"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Main threads table (for main page)
export const threads = pgTable("threads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  sessionName: varchar("session_name"),
  preferredName: varchar("preferred_name"),
  currentEmotions: jsonb("current_emotions").$type<string[]>(),
  reasonForVisit: text("reason_for_visit").notNull(),
  supportType: jsonb("support_type").$type<string[]>(),
  supportTypeOther: text("support_type_other"),
  additionalContext: text("additional_context"),
  responseTone: varchar("response_tone"),
  imageResponse: text("image_response"),
  responseCharacter: varchar("response_character"),
  responseDescription: text("response_description"),
  summaryContext: text("summary_context"),
  archived: timestamp("archived"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sessions table (for organizing conversations within threads)
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(), // 1-5
  sessionName: varchar("session_name"),
  summary: text("summary"),
  status: varchar("status", {
    enum: ["active", "finished"],
  }).default("active"),
  crisisDetected: boolean("crisis_detected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Impersonate threads table (for impersonate page)
export const impersonateThread = pgTable("impersonate_thread", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  personaId: integer("persona_id").references(() => persona.id),
  sessionName: varchar("session_name"),
  preferredName: varchar("preferred_name"),
  reasonForVisit: text("reason_for_visit").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Main messages table (now references sessions instead of threads)
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => sessions.id, {
    onDelete: "cascade",
  }), // Optional for impersonate threads
  threadId: integer("thread_id").references(() => impersonateThread.id, {
    onDelete: "cascade",
  }), // For impersonate threads
  threadType: varchar("thread_type", {
    enum: ["main", "impersonate"],
  }).notNull(),
  sender: varchar("sender", {
    enum: ["user", "ai", "therapist", "impostor"],
  }).notNull(),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const persona = pgTable("persona", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  fullName: varchar("full_name").notNull(),
  age: varchar("age").notNull(),
  problemDescription: text("problem_description").notNull(),
  background: text("background"),
  personality: varchar("personality"),
  // Advanced persona management fields
  templateId: integer("template_id").references(() => personaTemplates.id),
  category: varchar("category"),
  complexityLevel: varchar("complexity_level").default("basic"), // 'basic', 'intermediate', 'advanced'
  emotionalProfile: jsonb("emotional_profile").$type<Record<string, any>>(),
  behavioralPatterns: jsonb("behavioral_patterns").$type<Record<string, any>>(),
  culturalBackground: varchar("cultural_background"),
  socioeconomicStatus: varchar("socioeconomic_status"),
  educationLevel: varchar("education_level"),
  relationshipStatus: varchar("relationship_status"),
  copingMechanisms: jsonb("coping_mechanisms").$type<string[]>(),
  triggers: jsonb("triggers").$type<string[]>(),
  goals: jsonb("goals").$type<string[]>(),
  fears: jsonb("fears").$type<string[]>(),
  strengths: jsonb("strengths").$type<string[]>(),
  weaknesses: jsonb("weaknesses").$type<string[]>(),
  communicationStyle: varchar("communication_style"),
  attachmentStyle: varchar("attachment_style"),
  isTemplate: boolean("is_template").default(false),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  evolutionStage: varchar("evolution_stage").default("initial"), // 'initial', 'developing', 'mature'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionForms = pgTable("session_forms", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  questions: jsonb("questions").$type<any[]>(), // Store the generated questions
  answers: jsonb("answers").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Advanced Persona Management Tables

// Pre-built persona archetypes and templates
export const personaTemplates = pgTable("persona_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // 'anxiety', 'depression', 'trauma', 'relationship', 'career', etc.
  description: text("description"),
  basePersonality: jsonb("base_personality").$type<Record<string, any>>(),
  baseBackground: text("base_background"),
  baseAgeRange: varchar("base_age_range"),
  baseProblemTypes: jsonb("base_problem_types").$type<string[]>(),
  isPublic: boolean("is_public").default(false),
  createdBy: integer("created_by").references(() => users.id),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Version control for persona evolution
export const personaVersions = pgTable("persona_versions", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id")
    .notNull()
    .references(() => persona.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  changes: jsonb("changes").$type<Record<string, any>>(), // What changed from previous version
  createdAt: timestamp("created_at").defaultNow(),
});

// Advanced customization options for personas
export const personaCustomizations = pgTable("persona_customizations", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id")
    .notNull()
    .references(() => persona.id, { onDelete: "cascade" }),
  customizationType: varchar("customization_type").notNull(), // 'personality', 'background', 'behaviors', etc.
  customizationData: jsonb("customization_data").$type<Record<string, any>>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Track persona usage and evolution in sessions
export const personaSessions = pgTable("persona_sessions", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id")
    .notNull()
    .references(() => persona.id, { onDelete: "cascade" }),
  threadId: integer("thread_id").references(() => impersonateThread.id, { onDelete: "cascade" }),
  sessionDuration: integer("session_duration"), // in minutes
  conversationQualityScore: integer("conversation_quality_score"), // 1-100
  therapeuticTechniquesUsed: jsonb("therapeutic_techniques_used").$type<string[]>(),
  personaAdaptations: jsonb("persona_adaptations").$type<Record<string, any>>(), // How persona evolved during session
  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics tables for persona selection tracking
export const personaAnalytics = pgTable("persona_analytics", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id")
    .notNull()
    .references(() => persona.id, { onDelete: "cascade" }),
  selectionCount: integer("selection_count").default(1),
  lastSelectedAt: timestamp("last_selected_at").defaultNow(),
  periodStart: timestamp("period_start").notNull(), // Start of the tracking period
  periodEnd: timestamp("period_end").notNull(), // End of the tracking period
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cache table for frequent persona selections (10-hour cache)
export const personaSelectionCache = pgTable("persona_selection_cache", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id")
    .notNull()
    .references(() => persona.id, { onDelete: "cascade" }),
  selectionCount: integer("selection_count").default(1),
  cachePeriodStart: timestamp("cache_period_start").notNull(),
  cachePeriodEnd: timestamp("cache_period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Counselor Chat System Tables

// Counselor chat requests from users
export const counselorRequests = pgTable("counselor_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adminId: integer("admin_id")
    .references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", {
    enum: ["pending", "accepted", "declined", "completed", "cancelled"],
  }).default("pending"),
  requestReason: text("request_reason").notNull(),
  urgencyLevel: varchar("urgency_level", {
    enum: ["low", "medium", "high", "urgent"],
  }).default("medium"),
  userContext: jsonb("user_context").$type<Record<string, any>>(), // Additional context from current session
  requestedAt: timestamp("requested_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  completedAt: timestamp("completed_at"),
  adminNotes: text("admin_notes"),
  satisfactionRating: integer("satisfaction_rating"), // 1-5 rating from user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Counselor chat sessions
export const counselorChats = pgTable("counselor_chats", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => counselorRequests.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adminId: integer("admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", {
    enum: ["active", "ended", "transferred"],
  }).default("active"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  messageCount: integer("message_count").default(0),
  sessionDuration: integer("session_duration"), // in minutes
  transferReason: text("transfer_reason"),
  adminSummary: text("admin_summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Counselor chat messages
export const counselorMessages = pgTable("counselor_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id")
    .notNull()
    .references(() => counselorChats.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  senderType: varchar("sender_type", {
    enum: ["user", "counselor"],
  }).notNull(),
  message: text("message").notNull(),
  messageType: varchar("message_type", {
    enum: ["text", "system", "file"],
  }).default("text"),
  isRead: boolean("is_read").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily request limits tracking
export const dailyRequestLimits = pgTable("daily_request_limits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requestCount: integer("request_count").default(0),
  date: timestamp("date").notNull(), // Date without time for daily tracking
  lastRequestAt: timestamp("last_request_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});