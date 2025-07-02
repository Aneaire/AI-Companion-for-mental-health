import {
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

export const chatSessions = pgTable("chat_sessions", {
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
  summaryContext: text("summary_context"),
  threadType: varchar("thread_type", { enum: ["chat"] })
    .default("chat")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id),
  sender: varchar("sender", {
    enum: ["user", "ai", "therapist", "impostor"],
  }).notNull(),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const impostorProfiles = pgTable("impostor_profiles", {
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
