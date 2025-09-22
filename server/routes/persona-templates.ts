import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../db/config";
import { personaTemplates, persona } from "../db/schema";
import { logger } from "../lib/logger";

// Schema definitions
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  basePersonality: z.record(z.any()).optional(),
  baseBackground: z.string().optional(),
  baseAgeRange: z.string().optional(),
  baseProblemTypes: z.array(z.string()).optional(),
  isPublic: z.boolean().default(false),
});

const updateTemplateSchema = createTemplateSchema.partial();

const templateQuerySchema = z.object({
  category: z.string().optional(),
  isPublic: z.string().optional().transform(val => val === 'true'),
  limit: z.string().optional().transform(val => val ? Number(val) : 20),
  offset: z.string().optional().transform(val => val ? Number(val) : 0),
});

export const personaTemplatesRoute = new Hono();

// Get all templates with filtering
personaTemplatesRoute.get("/", async (c) => {
    const category = c.req.query("category");
    const isPublicStr = c.req.query("isPublic");
    const isPublic = isPublicStr ? isPublicStr === 'true' : undefined;
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    try {
      let whereConditions = [];

      if (category) {
        whereConditions.push(eq(personaTemplates.category, category));
      }

      if (isPublic !== undefined) {
        whereConditions.push(eq(personaTemplates.isPublic, isPublic));
      }

      const templates = await db
        .select()
        .from(personaTemplates)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(personaTemplates.usageCount), desc(personaTemplates.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(personaTemplates)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      return c.json({
        templates,
        total: totalCount[0].count,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching persona templates:", error);
      return c.json({ error: "Failed to fetch templates" }, 500);
    }
  }
);

// Get template by ID
personaTemplatesRoute.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid template ID" }, 400);
  }

  try {
    const template = await db
      .select()
      .from(personaTemplates)
      .where(eq(personaTemplates.id, id))
      .limit(1);

    if (template.length === 0) {
      return c.json({ error: "Template not found" }, 404);
    }

    return c.json(template[0]);
  } catch (error) {
    logger.error("Error fetching persona template:", error);
    return c.json({ error: "Failed to fetch template" }, 500);
  }
});

// Create new template
personaTemplatesRoute.post(
  "/",
  zValidator("json", createTemplateSchema),
  async (c) => {
    const templateData = c.req.valid("json");

    // TODO: Get user ID from authentication context
    // For now, we'll assume it's passed or use a default
    const userId = 1; // This should come from auth middleware

    try {
      const [newTemplate] = await db
        .insert(personaTemplates)
        .values({
          ...templateData,
          createdBy: userId,
        })
        .returning();

      logger.log(`Created new persona template: ${newTemplate.name}`);
      return c.json(newTemplate, 201);
    } catch (error) {
      logger.error("Error creating persona template:", error);
      return c.json({ error: "Failed to create template" }, 500);
    }
  }
);

// Update template
personaTemplatesRoute.put(
  "/:id",
  zValidator("json", updateTemplateSchema),
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const updateData = c.req.valid("json");

    if (isNaN(id)) {
      return c.json({ error: "Invalid template ID" }, 400);
    }

    try {
      // Check if template exists and user has permission to update
      const existingTemplate = await db
        .select()
        .from(personaTemplates)
        .where(eq(personaTemplates.id, id))
        .limit(1);

      if (existingTemplate.length === 0) {
        return c.json({ error: "Template not found" }, 404);
      }

      // TODO: Check if user owns the template or has admin permissions
      // For now, allow updates

      const [updatedTemplate] = await db
        .update(personaTemplates)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(personaTemplates.id, id))
        .returning();

      logger.log(`Updated persona template: ${updatedTemplate.name}`);
      return c.json(updatedTemplate);
    } catch (error) {
      logger.error("Error updating persona template:", error);
      return c.json({ error: "Failed to update template" }, 500);
    }
  }
);

// Delete template
personaTemplatesRoute.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid template ID" }, 400);
  }

  try {
    // Check if template exists and user has permission to delete
    const existingTemplate = await db
      .select()
      .from(personaTemplates)
      .where(eq(personaTemplates.id, id))
      .limit(1);

    if (existingTemplate.length === 0) {
      return c.json({ error: "Template not found" }, 404);
    }

    // Check if template is being used by any personas
    const usageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(persona)
      .where(eq(persona.templateId, id));

    if (usageCount[0].count > 0) {
      return c.json({
        error: "Cannot delete template that is being used by personas"
      }, 400);
    }

    // TODO: Check if user owns the template or has admin permissions

    await db
      .delete(personaTemplates)
      .where(eq(personaTemplates.id, id));

    logger.log(`Deleted persona template with ID: ${id}`);
    return c.json({ message: "Template deleted successfully" });
  } catch (error) {
    logger.error("Error deleting persona template:", error);
    return c.json({ error: "Failed to delete template" }, 500);
  }
});

// Increment usage count for a template
personaTemplatesRoute.post("/:id/use", async (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid template ID" }, 400);
  }

  try {
    await db
      .update(personaTemplates)
      .set({
        usageCount: sql`${personaTemplates.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(personaTemplates.id, id));

    return c.json({ message: "Usage count incremented" });
  } catch (error) {
    logger.error("Error incrementing template usage count:", error);
    return c.json({ error: "Failed to update usage count" }, 500);
  }
});

// Get template categories
personaTemplatesRoute.get("/categories/list", async (c) => {
  try {
    const categories = await db
      .select({
        category: personaTemplates.category,
        count: sql<number>`count(*)`,
      })
      .from(personaTemplates)
      .where(eq(personaTemplates.isPublic, true))
      .groupBy(personaTemplates.category)
      .orderBy(desc(sql<number>`count(*)`));

    return c.json(categories);
  } catch (error) {
    logger.error("Error fetching template categories:", error);
    return c.json({ error: "Failed to fetch categories" }, 500);
  }
});

export default personaTemplatesRoute;