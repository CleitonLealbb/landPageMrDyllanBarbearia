import { prisma } from "@/lib/prisma"
import { createCheckoutServices } from "./factory"

export const { openCash, currentCash, moveCash, closeCash, createSale, editSale, readSale, finalizeSale, cancelSale, voidSale, listSales, saleHistory, listCashSessions, cashHistory } = createCheckoutServices(prisma)
