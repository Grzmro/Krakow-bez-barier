import { createDb } from "./client";
import { seedDemoData } from "./seed-demo";

const { db, close } = createDb();
try {
  const { places, newFacts } = await seedDemoData(db);
  console.log(`seeded ${places} places, ${newFacts} new facts`);
} finally {
  await close();
}
