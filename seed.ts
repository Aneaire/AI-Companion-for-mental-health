#!/usr/bin/env bun
import { seedPersonaTemplatesData } from "./server/db/seed-persona-templates";

async function main() {
  try {
    console.log("🚀 Starting database seeding...");
    await seedPersonaTemplatesData();
    console.log("🎉 Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Database seeding failed:", error);
    process.exit(1);
  }
}

main();