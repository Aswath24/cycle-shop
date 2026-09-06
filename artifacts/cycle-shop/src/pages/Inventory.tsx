import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  useCreateInventory,
  useDeleteInventory,
  useGetInventory,
  useListInventory,
  getListInventoryQueryKey,
  useUpdateInventory,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2 } from "lucide-react"
import { Link, useLocation, useRoute } from "wouter"

const inventorySchema = z.object({
  cycleModel: z.string().min(1, "Cycle model is required"),
  cycleSize: z.string().min(1, "Size is required"),
  cycleColor: z.string().min(1, "Color is required"),
  supplier: z.string().min(1, "Supplier is required"),
  buyingPrice: z.coerce.number().min(0, "Must be >= 0"),
  profitMargin: z.coerce.number().min(0, "Must be >= 0"),
  availableStock: z.coerce.number().int().min(0, "Must be >= 0"),
})

type InventoryFormValues = z.infer<typeof inventorySchema>

const defaultValues: InventoryFormValues = {
  cycleModel: "",
  cycleSize: "",
  cycleColor: "",
  supplier: "",
  buyingPrice: 0,
  profitMargin: 10,
  availableStock: 0,
}

export default function Inventory() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const createInventory = useCreateInventory()
  const updateInventory = useUpdateInventory()
  const deleteInventory = useDeleteInventory()
  const [match, params] = useRoute("/inventory/:id/edit")
  const isEditMode = Boolean(match)
  const inventoryId = match ? Number(params.id) : 0
  const [, setLocation] = useLocation()

  const { data, isLoading } = useListInventory({
    query: {
      queryKey: getListInventoryQueryKey(),
    },
  })

  const { data: inventoryItem } = useGetInventory(inventoryId, {
    query: {
      enabled: isEditMode,
      queryKey: ["/api/inventory", inventoryId],
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues,
  })

  useEffect(() => {
    if (!isEditMode || !inventoryItem) return
    reset({
      cycleModel: inventoryItem.cycleModel,
      cycleSize: inventoryItem.cycleSize,
      cycleColor: inventoryItem.cycleColor,
      supplier: inventoryItem.supplier,
      buyingPrice: inventoryItem.buyingPrice,
      profitMargin: inventoryItem.profitMargin,
      availableStock: inventoryItem.availableStock,
    })
  }, [isEditMode, inventoryItem, reset])

  const onSubmit = (values: InventoryFormValues) => {
    const onSuccess = () => {
      toast({
        title: isEditMode ? "Inventory updated" : "Inventory added",
        description: "Cycle stock has been saved successfully.",
      })
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() })
      if (isEditMode) {
        setLocation("/inventory")
        return
      }
      reset(defaultValues)
    }

    const onError = (err: any) => {
      toast({
        title: isEditMode ? "Failed to update inventory" : "Failed to add inventory",
        description: err?.data?.error || err?.message || err?.error || "Unknown error occurred",
        variant: "destructive",
      })
    }

    if (isEditMode) {
      updateInventory.mutate({ id: inventoryId, data: values }, { onSuccess, onError })
      return
    }

    createInventory.mutate({ data: values }, { onSuccess, onError })
  }

  const handleDelete = (id: number) => {
    if (!confirm("Delete this inventory item? This will only work when no stock has been sold.")) return

    deleteInventory.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Inventory deleted",
            description: `Inventory #${id} has been removed.`,
          })
          queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() })
          setLocation("/inventory")
        },
        onError: (err: any) => {
          toast({
            title: "Failed to delete inventory",
            description: err?.data?.error || err?.message || err?.error || "Unknown error occurred",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {isEditMode ? "Edit Inventory" : "Inventory"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditMode
            ? "Update the stock record and keep the balance count accurate."
            : "Add cycle stock with buying price, profit margin, and track quantities."}
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{isEditMode ? "Edit Inventory Item" : "Add Inventory"}</CardTitle>
          <CardDescription>Buying price and profit margin auto-populate on the sale entry page.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="cycleModel">Cycle Model</Label>
              <Input id="cycleModel" placeholder="e.g. Firefox Rapid" {...register("cycleModel")} />
              {errors.cycleModel && <p className="text-xs text-destructive">{errors.cycleModel.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycleSize">Size</Label>
              <Input id="cycleSize" placeholder="e.g. 27.5T" {...register("cycleSize")} />
              {errors.cycleSize && <p className="text-xs text-destructive">{errors.cycleSize.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycleColor">Color</Label>
              <Input id="cycleColor" placeholder="e.g. Black" {...register("cycleColor")} />
              {errors.cycleColor && <p className="text-xs text-destructive">{errors.cycleColor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" placeholder="Supplier Name" {...register("supplier")} />
              {errors.supplier && <p className="text-xs text-destructive">{errors.supplier.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyingPrice">Buying Price (₹)</Label>
              <Input type="number" step="0.01" id="buyingPrice" placeholder="0.00" {...register("buyingPrice")} />
              {errors.buyingPrice && <p className="text-xs text-destructive">{errors.buyingPrice.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profitMargin">Profit Margin (%)</Label>
              <Input type="number" step="0.1" id="profitMargin" {...register("profitMargin")} />
              {errors.profitMargin && <p className="text-xs text-destructive">{errors.profitMargin.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="availableStock">Available Stock</Label>
              <Input type="number" step="1" id="availableStock" {...register("availableStock")} />
              {errors.availableStock && <p className="text-xs text-destructive">{errors.availableStock.message}</p>}
            </div>
            <div className="md:col-span-3 lg:col-span-4 flex justify-end">
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={(isEditMode ? updateInventory.isPending : createInventory.isPending)}
                >
                  {(isEditMode ? updateInventory.isPending : createInventory.isPending)
                    ? "Saving..."
                    : isEditMode
                      ? "Update Inventory"
                      : "Add Inventory"}
                </Button>
                {isEditMode && (
                  <Link href="/inventory" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                    Cancel
                  </Link>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Inventory Stocks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 whitespace-nowrap">
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Buying Price</TableHead>
                  <TableHead className="text-right">Profit %</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.inventory && data.inventory.length > 0 ? (
                  data.inventory.map((item) => (
                    <TableRow key={item.id} className="whitespace-nowrap">
                      <TableCell className="font-medium">{item.cycleModel}</TableCell>
                      <TableCell>{item.cycleSize}</TableCell>
                      <TableCell>{item.cycleColor}</TableCell>
                      <TableCell>{item.supplier}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.buyingPrice)}</TableCell>
                      <TableCell className="text-right">{item.profitMargin.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{item.availableStock}</TableCell>
                      <TableCell className="text-right">{item.soldStock}</TableCell>
                      <TableCell className="text-right font-semibold">{item.balanceStock}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/inventory/${item.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteInventory.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      No inventory records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
