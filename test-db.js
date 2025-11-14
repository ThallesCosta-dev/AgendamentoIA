import { initializeDatabase } from './server/db.js';

try {
  await initializeDatabase();
  console.log('✅ Database initialized successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}