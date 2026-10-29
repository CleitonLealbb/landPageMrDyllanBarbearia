export const currency = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
export function comparison(current: number, previous: number) {
  return previous ? `${(((current - previous) / previous) * 100).toFixed(1)}%` : "sem base percentual"
}
