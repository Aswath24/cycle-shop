import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryTable = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    cycleModel: text("cycle_model").notNull(),
    cycleSize: text("cycle_size").notNull(),
    cycleColor: text("cycle_color").notNull(),
    supplier: text("supplier").notNull(),
    buyingPrice: numeric("buying_price", { precision: 12, scale: 2 }).notNull(),
    profitMargin: numeric("profit_margin", { precision: 8, scale: 2 }).notNull(),
    availableStock: integer("available_stock").notNull(),
    soldStock: integer("sold_stock").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    inventoryItemUnique: uniqueIndex("inventory_item_unique").on(
      table.cycleModel,
      table.cycleSize,
      table.cycleColor,
      table.supplier,
    ),
  }),
);

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({
  id: true,
  soldStock: true,
  createdAt: true,
});

export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;
