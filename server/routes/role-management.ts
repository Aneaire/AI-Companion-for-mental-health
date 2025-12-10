import { Hono } from "hono";
import { superadminMiddleware } from "../middleware/superadmin";
import { createClerkClient } from "@clerk/backend";
import { db } from "../db/config";
import { users, threads } from "../db/schema";
import { count, eq, sql, desc, asc, like, or, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const roleManagementRoute = new Hono()
  .use("/*", superadminMiddleware) // Protect all role management routes
  .get("/users", async (c) => {
    try {
      // Get pagination parameters
      const page = parseInt(c.req.query("page") || "1");
      const limit = parseInt(c.req.query("limit") || "20");
      const search = c.req.query("search") || "";
      const sortBy = c.req.query("sortBy") || "createdAt";
      const sortOrder = c.req.query("sortOrder") || "desc";

      const offset = (page - 1) * limit;

      // Initialize Clerk client
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      // Build where conditions for search - show all users when searching, otherwise only user roles
      let whereClause: any;
      if (search) {
        // When searching, show all users that match search
        whereClause = or(
          like(users.email, `%${search}%`),
          like(users.firstName, `%${search}%`),
          like(users.lastName, `%${search}%`),
          like(users.nickname, `%${search}%`)
        );
      } else {
        // When not searching, only show users with user role (no special roles)
        whereClause = sql`role = 'user' OR role IS NULL`;
      }

      // Get total count for pagination based on whereClause
      const totalCountResult = await db
        .select({ total: count(users.id) })
        .from(users)
        .where(whereClause);

      const totalUsers = totalCountResult[0]?.total || 0;
      const totalPages = Math.ceil(totalUsers / limit);

      // Build order by clause
      let orderByClause;
      switch (sortBy) {
        case "email":
          orderByClause = sortOrder === "asc" ? asc(users.email) : desc(users.email);
          break;
        case "firstName":
          orderByClause = sortOrder === "asc" ? asc(users.firstName) : desc(users.firstName);
          break;
        case "lastName":
          orderByClause = sortOrder === "asc" ? asc(users.lastName) : desc(users.lastName);
          break;
        case "role":
          orderByClause = sortOrder === "asc" ? asc(users.role) : desc(users.role);
          break;
        case "createdAt":
        default:
          orderByClause = sortOrder === "asc" ? asc(users.createdAt) : desc(users.createdAt);
          break;
      }

      // Get users from database with pagination and sorting, including thread count
      const userList = await db
        .select({
          id: users.id,
          clerkId: users.clerkId,
          email: users.email,
          nickname: users.nickname,
          firstName: users.firstName,
          lastName: users.lastName,
          age: users.age,
          status: users.status,
          role: users.role,
          hobby: users.hobby,
          profileImageUrl: users.profileImageUrl,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          threadCount: count(threads.id).as('threadCount'),
        })
        .from(users)
        .leftJoin(threads, eq(users.id, threads.userId))
        .where(whereClause)
        .groupBy(users.id, users.clerkId, users.email, users.nickname, users.firstName, users.lastName, users.age, users.status, users.role, users.hobby, users.profileImageUrl, users.createdAt, users.updatedAt)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      return c.json({
        users: userList,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalUsers: totalUsers,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit: limit,
        },
        search: search,
        sortBy: sortBy,
        sortOrder: sortOrder,
      });
    } catch (error) {
      logger.error("Error fetching users for role management:", error);
      return c.json({ error: "Failed to fetch users" }, 500);
    }
  })
  .post("/users/:userId/role", async (c) => {
    try {
      const userId = c.req.param("userId");
      const { newRole } = await c.req.json();

      if (!userId || !newRole) {
        return c.json({ error: "User ID and new role are required" }, 400);
      }

      // Validate role
      const validRoles = ['user', 'admin', 'observer', 'superadmin'];
      if (!validRoles.includes(newRole)) {
        return c.json({ error: "Invalid role. Must be one of: user, admin, observer, superadmin" }, 400);
      }

      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Initialize Clerk client
      const clerkClient = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      // Get current user info to prevent self-role modification
      const currentAdminRole = (c as any).get("adminRole");
      const currentAdminId = (c as any).get("adminId");

      // Prevent superadmin from modifying their own role
      if (user.id === currentAdminId && newRole !== 'superadmin') {
        return c.json({ error: "Cannot modify your own superadmin role" }, 400);
      }

      // Update user role in Clerk (keep as source of truth)
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: {
          role: newRole
        }
      });

      // Update local database role to match Clerk
      await db
        .update(users)
        .set({ role: newRole })
        .where(eq(users.id, parseInt(userId)));

      logger.log(`Role updated for user ${userId}: ${newRole}`);

      return c.json({
        success: true,
        message: `User role updated to ${newRole} successfully`
      });

    } catch (error) {
      logger.error('Error updating user role:', error);
      return c.json({
        success: false,
        message: 'Failed to update user role'
      }, 500);
    }
  })
  .get("/roles/summary", async (c) => {
    try {
      // Count roles from database - only count user roles
      const roleCountsResult = await db
        .select({
          role: users.role,
          count: count(users.id),
        })
        .from(users)
        .where(sql`role = 'user' OR role IS NULL`)
        .groupBy(users.role);

      const roleCounts = roleCountsResult.reduce((acc, row) => {
        const role = row.role || 'user';
        acc[role] = row.count;
        return acc;
      }, {} as Record<string, number>);

      const totalUsers = Object.values(roleCounts).reduce((sum, count) => sum + count, 0);

      return c.json({
        totalUsers,
        roleCounts: {
          user: roleCounts.user || 0,
          admin: roleCounts.admin || 0,
          observer: roleCounts.observer || 0,
          superadmin: roleCounts.superadmin || 0,
        },
      });
    } catch (error) {
      logger.error('Error fetching role summary:', error);
      return c.json({ error: 'Failed to fetch role summary' }, 500);
    }
  });

export default roleManagementRoute;