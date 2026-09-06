/**
 * Business logic calculations for cycle shop sales
 */

export interface SaleCalculations {
  sellingPrice: number;
  finalPrice: number;
  profitPercent: number;
  profitAmount: number;
  lossPercent: number;
  lossAmount: number;
}

export function calculateSaleValues(
  buyingPrice: number,
  profitMargin: number,
  discount: number,
  gst: number
): SaleCalculations {
  // SP = Buying Price * (1 + Profit Margin / 100)
  const sellingPrice = buyingPrice * (1 + profitMargin / 100);

  // Final Price = SP * (1 - Discount/100) * (1 + GST/100)
  const finalPrice = sellingPrice * (1 - discount / 100) * (1 + gst / 100);

  // Profit/Loss based on Final Price vs Buying Price
  let profitPercent = 0;
  let profitAmount = 0;
  let lossPercent = 0;
  let lossAmount = 0;

  if (finalPrice >= buyingPrice) {
    profitAmount = finalPrice - buyingPrice;
    profitPercent = buyingPrice > 0 ? (profitAmount / buyingPrice) * 100 : 0;
  } else {
    lossAmount = buyingPrice - finalPrice;
    lossPercent = buyingPrice > 0 ? (lossAmount / buyingPrice) * 100 : 0;
  }

  return {
    sellingPrice: round2(sellingPrice),
    finalPrice: round2(finalPrice),
    profitPercent: round2(profitPercent),
    profitAmount: round2(profitAmount),
    lossPercent: round2(lossPercent),
    lossAmount: round2(lossAmount),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
