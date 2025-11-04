import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.log("No authorization header or invalid format");
      return c.json({ error: "Unauthorized - Admin access required" }, 403);
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    
    // For development: Check if token exists and has valid format
    // In production, implement proper Clerk JWT verification
    try {
      // Simple JWT format check
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.log("Invalid JWT format");
        return c.json({ error: "Unauthorized - Invalid token" }, 401);
      }
      
      // Decode JWT payload (without verification for development)
      const payload = JSON.parse(atob(parts[1]));
      
      if (!payload.sub) {
        logger.log("Invalid token payload");
        return c.json({ error: "Unauthorized - Invalid token" }, 401);
      }

      // Extract user info from token payload
      const userId = payload.sub;
      // Check for admin role in metadata (Clerk stores it here)
      const userRole = payload.public_metadata?.role || payload.metadata?.role || payload.role;
      
      // For development: Allow access if token is valid and has admin role
      // You can adjust this logic based on your Clerk metadata structure
      if (userRole !== 'admin') {
        logger.log(`Access denied for user ${userId} with role: ${userRole}`);
        return c.json({ error: "Unauthorized - Admin access required" }, 403);
      }

      logger.log(`Admin access granted for user ${userId} with role: ${userRole}`);
      
      await next();
    } catch (tokenError) {
      logger.error("Token verification failed:", tokenError);
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
  } catch (error) {
    logger.error("Admin middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};