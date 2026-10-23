import { prisma } from "@/lib/prisma"
import { createCheckoutServices } from "./factory"

export const { openCash, currentCash, moveCash, closeCash, createSale, readSale, finalizeSale, cancelSale } = createCheckoutServices(prisma)
