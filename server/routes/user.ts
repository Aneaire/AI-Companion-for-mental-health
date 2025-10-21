import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/config";
import { users } from "../db/schema";
import { logger } from "../lib/logger";

// Define the schemas
const autoCreateProfileSchema = z.object({
  clerkId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

const profileResponseSchema = z.object({
  id: z.number(),
  clerkId: z.string(),
  email: z.string(),
  nickname: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  age: z.number().nullable(),
  status: z.string().nullable(),
  hobby: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const user = new Hono()
  .post("/auto-create-profile", zValidator("json", autoCreateProfileSchema), async (c) => {
    try {
      const { clerkId, email, firstName, lastName, profileImageUrl } =
        c.req.valid("json");

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      if (existingUser.length > 0) {
        // User already exists, return existing user
        return c.json(profileResponseSchema.parse(existingUser[0]));
      } else {
        // Create new user with Clerk data and minimal required fields
        const newUser = await db
          .insert(users)
          .values({
            clerkId,
            email,
            nickname: email.split('@')[0], // Use email prefix as nickname
            firstName: firstName || "",
            lastName: lastName || "",
            age: 0, // Default age
            status: "active",
            hobby: "",
            profileImageUrl: profileImageUrl || null,
          })
          .returning();


        return c.json(profileResponseSchema.parse(newUser[0]));
      }
    } catch (error) {
      logger.error("Error auto-creating user profile:", error);
      return c.json({ error: "Failed to create user profile" }, 500);
    }
  })
  .get("/profile/:clerkId", async (c) => {
    try {
      const clerkId = c.req.param("clerkId");
      const user = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);
      if (user.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }

      return c.json(profileResponseSchema.parse(user[0]));
    } catch (error) {
      logger.error("Error fetching user profile:", error);
      return c.json({ error: "Failed to fetch user profile" }, 500);
    }
  });

export default user;
