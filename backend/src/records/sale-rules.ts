export function jakartaBusinessDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function saleConditionError(sale: {
  businessDate: string;
  quantity: number;
  closed?: boolean;
  stockout?: boolean;
}, today: string) {
  if (sale.businessDate > today) return "Penjualan tidak boleh dicatat untuk tanggal masa depan.";
  if (sale.closed && sale.stockout) return "Hari tutup tidak dapat ditandai kehabisan stok.";
  if (sale.closed && sale.quantity !== 0) return "Hari tutup harus memiliki 0 porsi terjual.";
}
