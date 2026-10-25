import type { CheckoutClient } from "./client"
import { openCash, currentCash, moveCash, closeCash } from "./cash"
import { createSale, readSale } from "./sales"
import { finalizeSale } from "./finalization"
import { cancelSale } from "./cancellation"
import { voidSale } from "./voiding"
import { editSale } from "./editing"
import { listSales, saleHistory, listCashSessions, cashHistory } from "./history"

export function createCheckoutServices(client: CheckoutClient) {
  return {
    editSale: editSale.bind(null, client),
    listSales: listSales.bind(null, client),
    saleHistory: saleHistory.bind(null, client),
    listCashSessions: listCashSessions.bind(null, client),
    cashHistory: cashHistory.bind(null, client),
    openCash: openCash.bind(null, client),
    currentCash: currentCash.bind(null, client),
    moveCash: moveCash.bind(null, client),
    closeCash: closeCash.bind(null, client),
    createSale: createSale.bind(null, client),
    readSale: readSale.bind(null, client),
    finalizeSale: finalizeSale.bind(null, client),
    cancelSale: cancelSale.bind(null, client),
    voidSale: voidSale.bind(null, client),
  }
}
