import { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.log("No authorization header or invalid format");
      return c.json({ error: "Unauthorized - Admin access required" }, 403);
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    
    // Temporary: Just check that a token is present
    // TODO: Add proper Clerk JWT verification once environment variables are configured
    if (!token) {
      logger.log("No token provided");
      return c.json({ error: "Invalid token" }, 401);
    }

    logger.log("Admin middleware: Token present, allowing access");

    await next();
  } catch (error) {
    logger.error("Admin middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};