import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;`;
  console.log("✓ password_hash column added to users table");
}

main().catch(console.error);
