import {
  pgTable,
  serial,
  text,
  numeric,
  boolean,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { inventoryTable } from "./inventory";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  serialNo: integer("serial_no").notNull(),
  date: date("date").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  cycleModel: text("cycle_model").notNull(),
  cycleSize: text("cycle_size").notNull(),
  cycleColor: text("cycle_color").default("").notNull(),
  supplier: text("supplier").notNull(),
  inventoryId: integer("inventory_id").references(() => inventoryTable.id, {
    onDelete: "set null",
  }),
  invoiceNo: text("invoice_no").notNull(),
  buyingPrice: numeric("buying_price", { precision: 12, scale: 2 }).notNull(),
  profitMargin: numeric("profit_margin", { precision: 8, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 8, scale: 2 }).notNull(),
  gst: numeric("gst", { precision: 8, scale: 2 }).notNull(),
  finalPrice: numeric("final_price", { precision: 12, scale: 2 }).notNull(),
  profitPercent: numeric("profit_percent", { precision: 8, scale: 2 }).notNull(),
  profitAmount: numeric("profit_amount", { precision: 12, scale: 2 }).notNull(),
  lossPercent: numeric("loss_percent", { precision: 8, scale: 2 }).notNull(),
  lossAmount: numeric("loss_amount", { precision: 12, scale: 2 }).notNull(),
  modeOfPayment: text("mode_of_payment").notNull(),
  expenses: numeric("expenses", { precision: 12, scale: 2 }),
  syncedToSheets: boolean("synced_to_sheets").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({
  id: true,
  serialNo: true,
  sellingPrice: true,
  finalPrice: true,
  profitPercent: true,
  profitAmount: true,
  lossPercent: true,
  lossAmount: true,
  syncedToSheets: true,
  createdAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
