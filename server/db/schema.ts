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

// Example table - you can modify this according to your needs
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id").notNull().unique(),
  email: varchar("email").notNull(),
  nickname: varchar("nickname").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  age: integer("age").notNull(),
  status: varchar("status").default("active"),
  hobby: text("hobby").default(""),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionForms = pgTable("session_forms", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});