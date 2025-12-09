import { createClerkClient } from "@clerk/backend";
import { db } from "./server/db/config";
import { users } from "./server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./server/lib/logger";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

interface SyncResult {
  totalUsers: number;
  updatedUsers: number;
  errors: string[];
  details: string[];
}

async function syncRolesFromClerk(): Promise<SyncResult> {
  const startTime = Date.now();
  const results: SyncResult = {
    totalUsers: 0,
    updatedUsers: 0,
    errors: [],
    details: [],
  };

  try {
    logger.log("Starting role sync from Clerk metadata...");

    // Get all users from database
    const dbUsers = await db.select().from(users);
    results.totalUsers = dbUsers.length;

    if (dbUsers.length === 0) {
      results.details.push("No users found in database");
      return results;
    }

    // Get all users from Clerk with their roles
    const clerkUsers = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore) {
      const clerkUserList = await clerkClient.users.getUserList({
        limit,
        offset,
      });

      clerkUsers.push(...clerkUserList.data);
      hasMore = clerkUserList.hasNextPage;
      offset += limit;

      // Rate limiting to avoid hitting Clerk API limits
      if (clerkUserList.totalCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
      }
    }

    logger.log(`Fetched ${clerkUsers.length} users from Clerk`);

    // Sync roles from Clerk to database
    for (const dbUser of dbUsers) {
      try {
        const clerkUser = clerkUsers.find(cu => cu.id === dbUser.clerkId);
        
        if (!clerkUser) {
          results.errors.push(`Clerk user not found for database user ${dbUser.id} (${dbUser.clerkId})`);
          continue;
        }

        const clerkRole = clerkUser.publicMetadata?.role || 'user';
        const dbRole = dbUser.role || 'user';

        // Update database if role differs
        if (clerkRole !== dbRole) {
          await db
            .update(users)
            .set({ 
              role: clerkRole,
              // Also update status to match role
              status: (clerkRole === 'admin' || clerkRole === 'observer' || clerkRole === 'superadmin') ? 'admin' : 'user'
            })
            .where(eq(users.id, dbUser.id));
          
          results.updatedUsers++;
          results.details.push(`Updated user ${dbUser.email}: ${dbRole} → ${clerkRole}`);
        } else {
          results.details.push(`User ${dbUser.email}: roles already in sync (${clerkRole})`);
        }
      } catch (error) {
        const errorMsg = `Error syncing user ${dbUser.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    const duration = Date.now() - startTime;
    logger.log(`Role sync completed in ${duration}ms`);
    results.details.push(`Sync completed in ${duration}ms`);

  } catch (error) {
    const errorMsg = `Fatal error during role sync: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMsg);
    logger.error(errorMsg);
  }

  return results;
}

// Main execution
if (require.main === module) {
  syncRolesFromClerk()
    .then((result) => {
      console.log("=== Role Sync Results ===");
      console.log(`Total users processed: ${result.totalUsers}`);
      console.log(`Users updated: ${result.updatedUsers}`);
      console.log(`Errors encountered: ${result.errors.length}`);
      
      if (result.details.length > 0) {
        console.log("\nDetails:");
        result.details.forEach(detail => console.log(`  - ${detail}`));
      }
      
      if (result.errors.length > 0) {
        console.log("\nErrors:");
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      console.log("=== End Sync Results ===");
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}