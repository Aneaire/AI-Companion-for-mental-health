// Manual setup for analytics tables
import { db } from './server/db/config.js';
import { personaAnalytics, personaSelectionCache } from './server/db/schema.js';
import { eq } from 'drizzle-orm';

async function setupAnalyticsTables() {
  try {
    console.log('Setting up analytics tables...');
    
    // Test if we can create a simple cache entry
    const now = new Date();
    const cachePeriodStart = new Date(now.getTime() - (10 * 60 * 60 * 1000));
    
    // Try to insert a test record to see if table exists
    try {
      await db.insert(personaSelectionCache).values({
        personaId: 999, // Test ID that shouldn't exist
        selectionCount: 1,
        cachePeriodStart,
        cachePeriodEnd: now,
        createdAt: now,
      });
      
      // If successful, clean up the test record
      await db.delete(personaSelectionCache).where(eq(personaSelectionCache.personaId, 999));
      console.log('✓ persona_selection_cache table exists and is working');
    } catch (error) {
      console.log('❌ persona_selection_cache table does not exist:', error.message);
    }
    
    // Try analytics table
    try {
      await db.insert(personaAnalytics).values({
        personaId: 999, // Test ID that shouldn't exist
        selectionCount: 1,
        lastSelectedAt: now,
        periodStart: cachePeriodStart,
        periodEnd: now,
        createdAt: now,
        updatedAt: now,
      });
      
      // If successful, clean up the test record
      await db.delete(personaAnalytics).where(eq(personaAnalytics.personaId, 999));
      console.log('✓ persona_analytics table exists and is working');
    } catch (error) {
      console.log('❌ persona_analytics table does not exist:', error.message);
    }
    
    console.log('Setup test completed');
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupAnalyticsTables().then(() => {
  process.exit(0);
});