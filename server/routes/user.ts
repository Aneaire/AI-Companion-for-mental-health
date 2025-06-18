import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/config";
import { users } from "../db/schema";

// Define the schemas
const createProfileSchema = z.object({
  clerkId: z.string(),
  email: z.string().email(),
  nickname: z.string().min(2),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  age: z.number().positive(),
});

const profileResponseSchema = z.object({
  id: z.number(),
  clerkId: z.string(),
  email: z.string(),
  nickname: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  age: z.number(),
  status: z.string(),
  hobby: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const user = new Hono()
  .post("/profile", zValidator("json", createProfileSchema), async (c) => {
    try {
      const { clerkId, email, nickname, firstName, lastName, age } =
        c.req.valid("json");

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      if (existingUser.length > 0) {
        // Update existing user
        const updatedUser = await db
          .update(users)
          .set({
            email,
            nickname,
            firstName,
            lastName,
            age,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId))
          .returning();

        return c.json(profileResponseSchema.parse(updatedUser[0]));
      } else {
        // Create new user with default values
        const newUser = await db
          .insert(users)
          .values({
            clerkId,
            email,
            nickname,
            firstName,
            lastName,
            age,
            status: "active",
            hobby: "",
          })
          .returning();

        return c.json(profileResponseSchema.parse(newUser[0]));
      }
    } catch (error) {
      console.error("Error handling user profile:", error);
      return c.json({ error: "Failed to handle user profile" }, 500);
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
      console.error("Error fetching user profile:", error);
      return c.json({ error: "Failed to fetch user profile" }, 500);
    }
  });

export default user;
