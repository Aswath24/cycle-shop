import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cycle_shop';
const pool = new Pool({ connectionString });

async function initDb() {
  try {
    console.log("Connecting to PostgreSQL at", connectionString);
    await pool.query("SELECT 1;");
    console.log("Connected successfully.");

    // Drop old tables if they exist
    await pool.query(`
      DROP TABLE IF EXISTS "sales" CASCADE;
      DROP TABLE IF EXISTS "inventory" CASCADE;
    `);
    console.log("Cleared old tables.");

    // Create inventory table
    await pool.query(`
      CREATE TABLE "inventory" (
        "id" serial PRIMARY KEY NOT NULL,
        "cycle_model" text NOT NULL,
        "cycle_size" text NOT NULL,
        "cycle_color" text NOT NULL,
        "supplier" text NOT NULL,
        "buying_price" numeric(12, 2) NOT NULL,
        "profit_margin" numeric(8, 2) NOT NULL,
        "available_stock" integer NOT NULL,
        "sold_stock" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Created inventory table.");

    // Create unique index on inventory
    await pool.query(`
      CREATE UNIQUE INDEX "inventory_item_unique" ON "inventory" ("cycle_model", "cycle_size", "cycle_color", "supplier");
    `);
    console.log("Created inventory unique index.");

    // Create sales table
    await pool.query(`
      CREATE TABLE "sales" (
        "id" serial PRIMARY KEY NOT NULL,
        "serial_no" integer NOT NULL,
        "date" date NOT NULL,
        "customer_name" text NOT NULL,
        "customer_phone" text NOT NULL,
        "customer_address" text NOT NULL,
        "cycle_model" text NOT NULL,
        "cycle_size" text NOT NULL,
        "cycle_color" text DEFAULT '' NOT NULL,
        "supplier" text NOT NULL,
        "inventory_id" integer REFERENCES "inventory"("id") ON DELETE SET NULL,
        "invoice_no" text NOT NULL,
        "buying_price" numeric(12, 2) NOT NULL,
        "profit_margin" numeric(8, 2) NOT NULL,
        "selling_price" numeric(12, 2) NOT NULL,
        "discount" numeric(8, 2) NOT NULL,
        "gst" numeric(8, 2) NOT NULL,
        "final_price" numeric(12, 2) NOT NULL,
        "profit_percent" numeric(8, 2) NOT NULL,
        "profit_amount" numeric(12, 2) NOT NULL,
        "loss_percent" numeric(8, 2) NOT NULL,
        "loss_amount" numeric(12, 2) NOT NULL,
        "mode_of_payment" text NOT NULL,
        "expenses" numeric(12, 2),
        "synced_to_sheets" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("Created sales table.");

    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Database initialization failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
