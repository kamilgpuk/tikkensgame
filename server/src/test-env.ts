// Runs before all Jest test files (via setupFiles in jest.config.js).
// Sets env vars so db/index.ts doesn't throw at import time.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://fake-supabase.local";
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "fake-service-key";
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "test-admin-secret";
