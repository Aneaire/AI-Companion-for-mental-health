// Simple test script to verify analytics integration
import { db } from './server/db/config.js';
import { personaSelectionCache, personaAnalytics } from './server/db/schema.js';
import { eq } from 'drizzle-orm';

async function testAnalytics() {
  try {
    console.log('Testing persona analytics integration...');
    
    // Test 1: Check if tables exist by attempting to query them
    console.log('1. Checking if analytics tables exist...');
    
    const cacheCount = await db.select().from(personaSelectionCache).limit(1);
    console.log('✓ persona_selection_cache table accessible');
    
    const analyticsCount = await db.select().from(personaAnalytics).limit(1);
    console.log('✓ persona_analytics table accessible');
    
    // Test 2: Test cache insertion
    console.log('2. Testing cache insertion...');
    
    const testPersonaId = 1; // Assuming persona with ID 1 exists
    const now = new Date();
    const cachePeriodStart = new Date(now.getTime() - (10 * 60 * 60 * 1000));
    
    await db.insert(personaSelectionCache).values({
      personaId: testPersonaId,
      selectionCount: 1,
      cachePeriodStart,
      cachePeriodEnd: now,
      createdAt: now,
    });
    
    console.log('✓ Cache insertion successful');
    
    // Test 3: Test cache retrieval
    console.log('3. Testing cache retrieval...');
    
    const cacheEntries = await db
      .select()
      .from(personaSelectionCache)
      .where(eq(personaSelectionCache.personaId, testPersonaId));
    
    console.log(`✓ Retrieved ${cacheEntries.length} cache entries`);
    
    // Test 4: Test cache update
    console.log('4. Testing cache update...');
    
    if (cacheEntries.length > 0) {
      await db
        .update(personaSelectionCache)
        .set({
          selectionCount: (cacheEntries[0].selectionCount || 0) + 1,
        })
        .where(eq(personaSelectionCache.id, cacheEntries[0].id));
      
      console.log('✓ Cache update successful');
    }
    
    // Test 5: Test analytics insertion
    console.log('5. Testing analytics insertion...');
    
    await db.insert(personaAnalytics).values({
      personaId: testPersonaId,
      selectionCount: 5,
      lastSelectedAt: now,
      periodStart: cachePeriodStart,
      periodEnd: now,
      createdAt: now,
      updatedAt: now,
    });
    
    console.log('✓ Analytics insertion successful');
    
    // Test 6: Test analytics retrieval
    console.log('6. Testing analytics retrieval...');
    
    const analyticsEntries = await db
      .select()
      .from(personaAnalytics)
      .where(eq(personaAnalytics.personaId, testPersonaId));
    
    console.log(`✓ Retrieved ${analyticsEntries.length} analytics entries`);
    
    // Cleanup test data
    console.log('7. Cleaning up test data...');
    
    await db.delete(personaSelectionCache).where(eq(personaSelectionCache.personaId, testPersonaId));
    await db.delete(personaAnalytics).where(eq(personaAnalytics.personaId, testPersonaId));
    
    console.log('✓ Cleanup completed');
    console.log('\n🎉 All analytics tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAnalytics().then(() => {
  process.exit(0);
});