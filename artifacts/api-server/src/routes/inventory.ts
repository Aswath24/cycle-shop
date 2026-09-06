import { Router } from "express";
import { db, inventoryTable } from "@workspace/db";
import { CreateInventoryBody } from "@workspace/api-zod";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

function n(v: unknown): number {
  return v != null ? Number(v) : 0;
}

function mapInventory(row: typeof inventoryTable.$inferSelect) {
  const availableStock = row.availableStock;
  const soldStock = row.soldStock;
  return {
    id: row.id,
    cycleModel: row.cycleModel,
    cycleSize: row.cycleSize,
    cycleColor: row.cycleColor,
    supplier: row.supplier,
    buyingPrice: n(row.buyingPrice),
    profitMargin: n(row.profitMargin),
    availableStock,
    soldStock,
    balanceStock: availableStock - soldStock,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/inventory
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(inventoryTable)
    .orderBy(desc(inventoryTable.createdAt));

  res.json({ inventory: rows.map(mapInventory) });
});

// GET /api/inventory/:id
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return void res.status(400).json({ error: "Invalid inventory ID" });
  }

  const [row] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id)).limit(1);
  if (!row) {
    return void res.status(404).json({ error: "Inventory item not found" });
  }

  res.json(mapInventory(row));
});

// POST /api/inventory
router.post("/", async (req, res) => {
  const parsed = CreateInventoryBody.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.message });
  }

  const data = parsed.data;
  const [existing] = await db
    .select({ id: inventoryTable.id })
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.cycleModel, data.cycleModel),
        eq(inventoryTable.cycleSize, data.cycleSize),
        eq(inventoryTable.cycleColor, data.cycleColor),
        eq(inventoryTable.supplier, data.supplier),
      ),
    )
    .limit(1);

  if (existing) {
    return void res.status(409).json({
      error:
        "Inventory item already exists for this cycle model, size, color, and supplier.",
    });
  }

  const [created] = await db
    .insert(inventoryTable)
    .values({
      cycleModel: data.cycleModel,
      cycleSize: data.cycleSize,
      cycleColor: data.cycleColor,
      supplier: data.supplier,
      buyingPrice: String(data.buyingPrice),
      profitMargin: String(data.profitMargin),
      availableStock: data.availableStock,
    })
    .returning();

  res.status(201).json(mapInventory(created));
});

// PUT /api/inventory/:id
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return void res.status(400).json({ error: "Invalid inventory ID" });
  }

  const parsed = CreateInventoryBody.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.message });
  }

  const data = parsed.data;
  const [current] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id)).limit(1);
  if (!current) {
    return void res.status(404).json({ error: "Inventory item not found" });
  }

  const [duplicate] = await db
    .select({ id: inventoryTable.id })
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.cycleModel, data.cycleModel),
        eq(inventoryTable.cycleSize, data.cycleSize),
        eq(inventoryTable.cycleColor, data.cycleColor),
        eq(inventoryTable.supplier, data.supplier),
      ),
    )
    .limit(1);

  if (duplicate && duplicate.id !== id) {
    return void res.status(409).json({
      error:
        "Inventory item already exists for this cycle model, size, color, and supplier.",
    });
  }

  if (data.availableStock < current.soldStock) {
    return void res.status(400).json({
      error: "Available stock cannot be less than sold stock.",
    });
  }

  const [updated] = await db
    .update(inventoryTable)
    .set({
      cycleModel: data.cycleModel,
      cycleSize: data.cycleSize,
      cycleColor: data.cycleColor,
      supplier: data.supplier,
      buyingPrice: String(data.buyingPrice),
      profitMargin: String(data.profitMargin),
      availableStock: data.availableStock,
    })
    .where(eq(inventoryTable.id, id))
    .returning();

  res.json(mapInventory(updated));
});

// DELETE /api/inventory/:id
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return void res.status(400).json({ error: "Invalid inventory ID" });
  }

  const [current] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id)).limit(1);
  if (!current) {
    return void res.status(404).json({ error: "Inventory item not found" });
  }

  if (current.soldStock > 0) {
    return void res.status(409).json({
      error: "Inventory item has linked sales and cannot be deleted.",
    });
  }

  const [deleted] = await db.delete(inventoryTable).where(eq(inventoryTable.id, id)).returning();
  res.json({ success: true, message: "Inventory item deleted", id: deleted.id });
});

export default router;
