import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  useCreateSale,
  useGetSale,
  useListInventory,
  getGetSalesSummaryQueryKey,
  getListInventoryQueryKey,
  getListSalesQueryKey,
  useUpdateSale,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Calculator, Save } from "lucide-react"
import { Link, useLocation, useRoute } from "wouter"

type DiscountMode = "percent" | "amount"

const saleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  customerName: z.string().min(1, "Customer Name is required"),
  customerPhone: z.string().min(1, "Phone is required"),
  customerAddress: z.string().min(1, "Address is required"),
  cycleModel: z.string().min(1, "Model is required"),
  cycleSize: z.string().min(1, "Size is required"),
  cycleColor: z.string().min(1, "Color is required"),
  supplier: z.string().min(1, "Supplier is required"),
  inventoryId: z.coerce.number().int().positive("Inventory selection is required"),
  invoiceNo: z.string().min(1, "Invoice No is required"),
  buyingPrice: z.coerce.number().min(0, "Must be >= 0"),
  profitMargin: z.coerce.number().min(0),
  discount: z.coerce.number().min(0),
  gst: z.coerce.number().min(0),
  modeOfPayment: z.string().min(1, "Payment mode is required"),
  expenses: z.coerce.number().optional().nullable(),
})

type SaleFormValues = z.infer<typeof saleSchema>

function toDiscountPercent(
  sellingPrice: number,
  discountValue: number,
  mode: DiscountMode,
): number {
  if (sellingPrice <= 0 || discountValue <= 0) return 0
  if (mode === "percent") return Math.min(100, discountValue)
  return Math.min(100, (discountValue / sellingPrice) * 100)
}

function calculatePreview(
  buyingPrice: number,
  profitMargin: number,
  discountValue: number,
  discountMode: DiscountMode,
  gst: number,
) {
  const sellingPrice = buyingPrice * (1 + profitMargin / 100)
  const discountPercent = toDiscountPercent(sellingPrice, discountValue, discountMode)
  const afterDiscount = sellingPrice * (1 - discountPercent / 100)
  const gstAmount = afterDiscount * (gst / 100)
  const finalPrice = afterDiscount + gstAmount

  const isProfit = finalPrice >= buyingPrice
  const diff = Math.abs(finalPrice - buyingPrice)
  const percent = buyingPrice > 0 ? (diff / buyingPrice) * 100 : 0

  return {
    sellingPrice,
    discountPercent,
    discountAmount: sellingPrice - afterDiscount,
    afterDiscount,
    gstAmount,
    finalPrice,
    isProfit,
    amount: diff,
    percent: percent.toFixed(2),
  }
}

const defaultValues: SaleFormValues = {
  date: new Date().toISOString().split('T')[0],
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  cycleModel: "",
  cycleSize: "",
  cycleColor: "",
  supplier: "",
  inventoryId: 0,
  invoiceNo: "",
  buyingPrice: 0,
  profitMargin: 0,
  discount: 0,
  gst: 18,
  modeOfPayment: "UPI",
  expenses: 0,
}

export default function NewSale() {
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent")
  const [saleRouteMatch, saleRouteParams] = useRoute("/sales/:id/edit")
  const isEditMode = Boolean(saleRouteMatch)
  const saleId = saleRouteMatch ? Number(saleRouteParams.id) : 0
  const [, setLocation] = useLocation()
  const hydratingRef = useRef(false)

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues
  })

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const createSale = useCreateSale()
  const updateSale = useUpdateSale()
  const { data: saleData } = useGetSale(saleId, {
    query: {
      enabled: isEditMode,
      queryKey: ["/api/sales", saleId],
    },
  })
  const { data: inventoryResponse } = useListInventory({
    query: {
      queryKey: getListInventoryQueryKey(),
    },
  })

  const inventoryItems = inventoryResponse?.inventory ?? []

  const watchAllFields = watch()
  const selectedModel = watch("cycleModel")
  const selectedSize = watch("cycleSize")
  const selectedColor = watch("cycleColor")
  const selectedSupplier = watch("supplier")

  const modelOptions = useMemo(
    () => Array.from(new Set(inventoryItems.map((item) => item.cycleModel))),
    [inventoryItems]
  )

  const sizeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inventoryItems
            .filter((item) => item.cycleModel === selectedModel)
            .map((item) => item.cycleSize)
        )
      ),
    [inventoryItems, selectedModel]
  )

  const colorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inventoryItems
            .filter((item) => item.cycleModel === selectedModel && item.cycleSize === selectedSize)
            .map((item) => item.cycleColor)
        )
      ),
    [inventoryItems, selectedModel, selectedSize]
  )

  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inventoryItems
            .filter(
              (item) =>
                item.cycleModel === selectedModel &&
                item.cycleSize === selectedSize &&
                item.cycleColor === selectedColor
            )
            .map((item) => item.supplier)
        )
      ),
    [inventoryItems, selectedModel, selectedSize, selectedColor]
  )

  const selectedInventory = useMemo(
    () =>
      inventoryItems.find(
        (item) =>
          item.cycleModel === selectedModel &&
          item.cycleSize === selectedSize &&
          item.cycleColor === selectedColor &&
          item.supplier === selectedSupplier
      ),
    [inventoryItems, selectedModel, selectedSize, selectedColor, selectedSupplier]
  )

  useEffect(() => {
    if (hydratingRef.current) return
    setValue("cycleSize", "")
    setValue("cycleColor", "")
    setValue("supplier", "")
  }, [selectedModel, setValue])

  useEffect(() => {
    if (hydratingRef.current) return
    setValue("cycleColor", "")
    setValue("supplier", "")
  }, [selectedSize, setValue])

  useEffect(() => {
    if (hydratingRef.current) return
    setValue("supplier", "")
  }, [selectedColor, setValue])

  useEffect(() => {
    if (hydratingRef.current) return
    if (selectedInventory) {
      setValue("inventoryId", selectedInventory.id)
      setValue("buyingPrice", selectedInventory.buyingPrice)
      setValue("profitMargin", selectedInventory.profitMargin)
      return
    }

    setValue("inventoryId", 0)
    setValue("buyingPrice", 0)
    setValue("profitMargin", 0)
  }, [selectedInventory, setValue])

  useEffect(() => {
    if (!isEditMode || !saleData) return
    hydratingRef.current = true
    reset({
      date: saleData.date,
      customerName: saleData.customerName,
      customerPhone: saleData.customerPhone,
      customerAddress: saleData.customerAddress,
      cycleModel: saleData.cycleModel,
      cycleSize: saleData.cycleSize,
      cycleColor: saleData.cycleColor,
      supplier: saleData.supplier,
      inventoryId: saleData.inventoryId ?? 0,
      invoiceNo: saleData.invoiceNo,
      buyingPrice: saleData.buyingPrice,
      profitMargin: saleData.profitMargin,
      discount: saleData.discount,
      gst: saleData.gst,
      modeOfPayment: saleData.modeOfPayment,
      expenses: saleData.expenses ?? 0,
    })
    const timer = setTimeout(() => {
      hydratingRef.current = false
    }, 0)
    return () => clearTimeout(timer)
  }, [isEditMode, saleData, reset])

  const calculated = useMemo(() => {
    return calculatePreview(
      Number(watchAllFields.buyingPrice) || 0,
      Number(watchAllFields.profitMargin) || 0,
      Number(watchAllFields.discount) || 0,
      discountMode,
      Number(watchAllFields.gst) || 0,
    )
  }, [watchAllFields, discountMode])

  const onSubmit = (data: SaleFormValues) => {
    const discountPercent = calculated.discountPercent

    if (!selectedInventory) {
      toast({
        title: "Select inventory item",
        description: "Please select model, size, color, and supplier from inventory.",
        variant: "destructive",
      })
      return
    }

    if (selectedInventory.balanceStock <= 0 && !(isEditMode && saleData?.inventoryId === selectedInventory.id)) {
      toast({
        title: "Out of stock",
        description: "The selected inventory item has no balance stock.",
        variant: "destructive",
      })
      return
    }

    if (discountMode === "percent" && discountPercent > 100) {
      toast({
        title: "Invalid discount",
        description: "Discount percentage cannot exceed 100%.",
        variant: "destructive",
      })
      return
    }

    if (discountMode === "amount" && calculated.discountAmount > calculated.sellingPrice) {
      toast({
        title: "Invalid discount",
        description: "Discount amount cannot exceed the selling price.",
        variant: "destructive",
      })
      return
    }

    const payload = {
      ...data,
      cycleModel: selectedInventory.cycleModel,
      cycleSize: selectedInventory.cycleSize,
      cycleColor: selectedInventory.cycleColor,
      supplier: selectedInventory.supplier,
      inventoryId: selectedInventory.id,
      profitMargin: selectedInventory.profitMargin,
      discount: discountPercent,
    }

    const afterSuccess = () => {
        toast({
          title: isEditMode ? "Sale updated successfully!" : "Sale recorded successfully!",
          description: `Final price: ${formatCurrency(calculated.finalPrice)}`
        })
        queryClient.invalidateQueries({ queryKey: getGetSalesSummaryQueryKey() })
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() })
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() })
        if (isEditMode) {
          setLocation("/sales")
          return
        }
        reset(defaultValues)
      }

    const afterError = (err: any) => {
        toast({
          title: isEditMode ? "Failed to update sale" : "Failed to record sale",
          description: err?.data?.error || err?.message || err?.error || "Unknown error occurred",
          variant: "destructive"
        })
      }

    if (isEditMode) {
      updateSale.mutate({ id: saleId, data: payload }, {
        onSuccess: afterSuccess,
        onError: afterError,
      })
      return
    }

    createSale.mutate({ data: payload }, {
      onSuccess: afterSuccess,
      onError: afterError,
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {isEditMode ? "Edit Sale" : "New Sale Entry"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditMode
            ? "Update the existing sale and keep stock in sync."
            : "Record a new cycle sale with real-time margin calculations."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form id="sale-form" onSubmit={handleSubmit(onSubmit)}>
            <Card className="border-border shadow-sm">
              <CardContent className="p-6 space-y-6">
                <input type="hidden" {...register("inventoryId")} />
                
                {/* Customer Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Customer Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input type="date" id="date" {...register("date")} />
                      {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input id="customerName" placeholder="John Doe" {...register("customerName")} />
                      {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone Number</Label>
                      <Input id="customerPhone" placeholder="9876543210" {...register("customerPhone")} />
                      {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerAddress">Address</Label>
                      <Input id="customerAddress" placeholder="City, State" {...register("customerAddress")} />
                      {errors.customerAddress && <p className="text-xs text-destructive">{errors.customerAddress.message}</p>}
                    </div>
                  </div>
                </div>

                {/* Cycle Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Cycle & Invoice Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cycleModel">Cycle Model</Label>
                      <NativeSelect id="cycleModel" {...register("cycleModel")}>
                        <option value="">Select model</option>
                        {modelOptions.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </NativeSelect>
                      {errors.cycleModel && <p className="text-xs text-destructive">{errors.cycleModel.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cycleSize">Size</Label>
                      <NativeSelect id="cycleSize" {...register("cycleSize")} disabled={!selectedModel}>
                        <option value="">Select size</option>
                        {sizeOptions.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </NativeSelect>
                      {errors.cycleSize && <p className="text-xs text-destructive">{errors.cycleSize.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cycleColor">Color</Label>
                      <NativeSelect id="cycleColor" {...register("cycleColor")} disabled={!selectedSize}>
                        <option value="">Select color</option>
                        {colorOptions.map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </NativeSelect>
                      {errors.cycleColor && <p className="text-xs text-destructive">{errors.cycleColor.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <NativeSelect id="supplier" {...register("supplier")} disabled={!selectedColor}>
                        <option value="">Select supplier</option>
                        {supplierOptions.map((supplier) => (
                          <option key={supplier} value={supplier}>{supplier}</option>
                        ))}
                      </NativeSelect>
                      {errors.supplier && <p className="text-xs text-destructive">{errors.supplier.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceNo">Invoice No.</Label>
                      <Input id="invoiceNo" placeholder="INV-001" {...register("invoiceNo")} />
                      {errors.invoiceNo && <p className="text-xs text-destructive">{errors.invoiceNo.message}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">
                        {selectedInventory
                          ? `Available: ${selectedInventory.availableStock}, Sold: ${selectedInventory.soldStock}, Balance: ${selectedInventory.balanceStock}`
                          : "Select model, size, color, and supplier to load stock and profit margin."}
                      </p>
                    </div>
                    {errors.inventoryId && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-destructive">{errors.inventoryId.message}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
                  <h3 className="text-lg font-semibold pb-2 flex items-center">
                    <Calculator className="w-5 h-5 mr-2 text-primary" /> Pricing Data
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buyingPrice">Buying Price (₹)</Label>
                      <Input type="number" step="0.01" id="buyingPrice" {...register("buyingPrice")} />
                      <p className="text-xs text-muted-foreground">Auto-populated from selected inventory (editable).</p>
                      {errors.buyingPrice && <p className="text-xs text-destructive">{errors.buyingPrice.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profitMargin">Profit Margin (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        id="profitMargin"
                        readOnly
                        className="bg-muted"
                        {...register("profitMargin")}
                      />
                      <p className="text-xs text-muted-foreground">Auto-fetched from selected inventory.</p>
                      {errors.profitMargin && <p className="text-xs text-destructive">{errors.profitMargin.message}</p>}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="discount">Discount</Label>
                      <div className="flex gap-2">
                        <div className="w-28 shrink-0">
                          <NativeSelect
                            id="discountMode"
                            value={discountMode}
                            onChange={(e) => setDiscountMode(e.target.value as DiscountMode)}
                          >
                            <option value="percent">%</option>
                            <option value="amount">₹</option>
                          </NativeSelect>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          id="discount"
                          placeholder={discountMode === "percent" ? "e.g. 10" : "e.g. 200"}
                          {...register("discount")}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {discountMode === "percent"
                          ? "Enter discount as a percentage (e.g. 10 for 10%)."
                          : "Enter discount as a fixed amount in rupees (e.g. 200)."}
                        {calculated.discountPercent > 0 && (
                          <> Applied: {calculated.discountPercent.toFixed(2)}% ({formatCurrency(calculated.discountAmount)} off)</>
                        )}
                      </p>
                      {errors.discount && <p className="text-xs text-destructive">{errors.discount.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gst">GST (%)</Label>
                      <Input type="number" step="0.1" id="gst" {...register("gst")} />
                      {errors.gst && <p className="text-xs text-destructive">{errors.gst.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expenses">Additional Expenses (₹)</Label>
                      <Input type="number" step="0.01" id="expenses" {...register("expenses")} />
                      {errors.expenses && <p className="text-xs text-destructive">{errors.expenses.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modeOfPayment">Payment Mode</Label>
                      <NativeSelect id="modeOfPayment" {...register("modeOfPayment")}>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="EMI">EMI</option>
                      </NativeSelect>
                      {errors.modeOfPayment && <p className="text-xs text-destructive">{errors.modeOfPayment.message}</p>}
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </form>
        </div>

        {/* Live Calculation Panel */}
        <div className="lg:col-span-1">
          <Card className="border-border shadow-md sticky top-6 bg-sidebar text-sidebar-foreground">
            <CardHeader className="pb-4 border-b border-sidebar-border">
              <CardTitle className="text-xl text-sidebar-primary">Live Preview</CardTitle>
              <CardDescription className="text-sidebar-foreground/70">Calculates as you type</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-sidebar-foreground/70">Base Selling Price</p>
                <p className="text-xl font-semibold">{formatCurrency(calculated.sellingPrice)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-sidebar-foreground/70">Price After Discount</p>
                <p className="text-xl font-semibold">{formatCurrency(calculated.afterDiscount)}</p>
                {calculated.discountAmount > 0 && (
                  <p className="text-xs text-sidebar-foreground/50">
                    −{formatCurrency(calculated.discountAmount)} discount applied
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-sidebar-foreground/70">GST Amount</p>
                <p className="text-xl font-semibold">{formatCurrency(calculated.gstAmount)}</p>
                <p className="text-xs text-sidebar-foreground/50">
                  {Number(watchAllFields.gst) || 0}% on discounted price
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-sidebar-border">
                <p className="text-sm font-medium text-sidebar-foreground/70">Final Price to Customer</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(calculated.finalPrice)}</p>
                <p className="text-xs text-sidebar-foreground/50">Discounted price + GST</p>
              </div>

              <div className="pt-4 border-t border-sidebar-border">
                <p className="text-sm font-medium text-sidebar-foreground/70 mb-2">Outcome</p>
                {calculated.isProfit ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                    <p className="text-sm text-emerald-400 font-medium">Profit</p>
                    <p className="text-2xl font-bold text-emerald-400">+{formatCurrency(calculated.amount)}</p>
                    <p className="text-xs text-emerald-400/80 mt-1">{calculated.percent}% margin on final</p>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                    <p className="text-sm text-red-400 font-medium">Loss</p>
                    <p className="text-2xl font-bold text-red-400">-{formatCurrency(calculated.amount)}</p>
                    <p className="text-xs text-red-400/80 mt-1">{calculated.percent}% loss on final</p>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                form="sale-form" 
                className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 h-12 text-lg shadow-lg shadow-sidebar-primary/20"
                disabled={(isEditMode ? updateSale.isPending : createSale.isPending) || !selectedInventory || selectedInventory.balanceStock <= 0}
              >
                <Save className={`w-5 h-5 mr-2 ${(isEditMode ? updateSale.isPending : createSale.isPending) ? "animate-pulse" : ""}`} />
                {(isEditMode ? updateSale.isPending : createSale.isPending) ? "Saving..." : isEditMode ? "Update Entry" : "Save Entry"}
              </Button>
              {isEditMode && (
                <Link href="/sales" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                  Cancel
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
