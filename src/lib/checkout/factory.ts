import type { CheckoutClient } from "./client"
import { openCash, currentCash, moveCash, closeCash } from "./cash"
import { createSale, readSale } from "./sales"
import { finalizeSale } from "./finalization"
import { cancelSale } from "./cancellation"

export function createCheckoutServices(client: CheckoutClient) {
  return {
    openCash: openCash.bind(null, client),
    currentCash: currentCash.bind(null, client),
    moveCash: moveCash.bind(null, client),
    closeCash: closeCash.bind(null, client),
    createSale: createSale.bind(null, client),
    readSale: readSale.bind(null, client),
    finalizeSale: finalizeSale.bind(null, client),
    cancelSale: cancelSale.bind(null, client),
  }
}
