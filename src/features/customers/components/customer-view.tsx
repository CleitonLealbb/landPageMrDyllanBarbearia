"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Edit,
  FileText,
  History,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SidebarTrigger } from "@/components/ui/sidebar"

// Types
type CustomerStatus = "ACTIVE" | "INACTIVE"

type CustomerAppointment = {
  id: string
  date: string
  service: string
  professional: string
  amount: number
  status: "COMPLETED" | "SCHEDULED" | "CANCELED"
}

type Customer = {
  id: string
  name: string
  phone: string
  email?: string
  birthDate?: string
  notes?: string
  status: CustomerStatus
  totalRevenue: number
  revenueShare: number
  averageTicket: number
  appointmentCount: number
  nextAppointment?: CustomerAppointment
  recentAppointments: CustomerAppointment[]
}

type CustomerForm = Pick<
  Customer,
  "name" | "phone" | "email" | "birthDate" | "notes" | "status"
>

type FormErrors = Partial<Record<"name" | "phone", string>>

// Mock data
const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  birthDate: "",
  notes: "",
  status: "ACTIVE",
}

const initialCustomers: Customer[] = [
  {
    id: "customer-1",
    name: "João Henrique",
    phone: "(66) 99912-3456",
    email: "joao.henrique@example.com",
    birthDate: "1990-04-18",
    notes: "Prefere atendimento no período da manhã.",
    status: "ACTIVE",
    totalRevenue: 1280,
    revenueShare: 8.4,
    averageTicket: 80,
    appointmentCount: 16,
    nextAppointment: {
      id: "appointment-1-next",
      date: "2026-07-24T09:30:00",
      service: "Corte e barba",
      professional: "Cleiton Leal",
      amount: 95,
      status: "SCHEDULED",
    },
    recentAppointments: [
      { id: "appointment-1", date: "2026-07-12T09:00:00", service: "Corte degradê", professional: "Cleiton Leal", amount: 70, status: "COMPLETED" },
      { id: "appointment-2", date: "2026-06-28T10:30:00", service: "Corte e barba", professional: "Cleiton Leal", amount: 95, status: "COMPLETED" },
      { id: "appointment-3", date: "2026-06-14T08:30:00", service: "Barba", professional: "Fabrício B.", amount: 50, status: "COMPLETED" },
    ],
  },
  {
    id: "customer-2",
    name: "Marcos Vinícius",
    phone: "(66) 98456-7890",
    email: "marcos.vinicius@example.com",
    status: "ACTIVE",
    totalRevenue: 720,
    revenueShare: 4.7,
    averageTicket: 72,
    appointmentCount: 10,
    recentAppointments: [
      { id: "appointment-4", date: "2026-07-08T15:00:00", service: "Corte social", professional: "Fabrício B.", amount: 65, status: "COMPLETED" },
      { id: "appointment-5", date: "2026-06-20T14:30:00", service: "Corte e barba", professional: "Fabrício B.", amount: 95, status: "COMPLETED" },
    ],
  },
  {
    id: "customer-3",
    name: "Rafael Oliveira",
    phone: "(66) 99234-5678",
    birthDate: "1985-11-03",
    notes: "Cliente temporariamente inativo.",
    status: "INACTIVE",
    totalRevenue: 460,
    revenueShare: 3,
    averageTicket: 76.67,
    appointmentCount: 6,
    recentAppointments: [
      { id: "appointment-6", date: "2026-04-22T11:00:00", service: "Corte tradicional", professional: "Cleiton Leal", amount: 65, status: "COMPLETED" },
      { id: "appointment-7", date: "2026-04-05T10:00:00", service: "Barba", professional: "Cleiton Leal", amount: 50, status: "CANCELED" },
    ],
  },
]

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

function formatBirthDate(value?: string) {
  if (!value) return "Não informado"

  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function statusLabel(status: CustomerStatus) {
  return status === "ACTIVE" ? "Ativo" : "Inativo"
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function CustomerView() {
  // Component state
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomers[0]?.id ?? null
  )
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  // Derived data and filters
  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR")
    const phoneSearch = normalizePhone(search)

    if (!normalizedSearch) return customers

    return customers.filter((customer) => {
      const matchesName = customer.name
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch)
      const matchesPhone = phoneSearch
        ? normalizePhone(customer.phone).includes(phoneSearch)
        : false

      return matchesName || matchesPhone
    })
  }, [customers, search])

  // Form helpers
  function resetForm() {
    setEditingCustomer(null)
    setForm(emptyForm)
    setFormErrors({})
    setIsSaving(false)
  }

  function handleDialogOpenChange(open: boolean) {
    setIsDialogOpen(open)

    if (!open) resetForm()
  }

  function openNewCustomerDialog() {
    resetForm()
    setIsDialogOpen(true)
  }

  function openEditCustomerDialog(customer: Customer) {
    setEditingCustomer(customer)
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      birthDate: customer.birthDate ?? "",
      notes: customer.notes ?? "",
      status: customer.status,
    })
    setFormErrors({})
    setIsDialogOpen(true)
  }

  function updateForm<Field extends keyof CustomerForm>(
    field: Field,
    value: CustomerForm[Field]
  ) {
    setForm((current) => ({ ...current, [field]: value }))

    if (field === "name" || field === "phone") {
      setFormErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  function validateForm() {
    const errors: FormErrors = {}

    if (!form.name.trim()) errors.name = "Informe o nome do cliente."
    if (!form.phone.trim()) errors.phone = "Informe o telefone do cliente."

    // Compare only phone digits to prevent formatted duplicates.
    const normalizedPhone = normalizePhone(form.phone)
    const phoneAlreadyExists = customers.some(
      (customer) =>
        // Keep the currently edited customer out of the duplicate check.
        customer.id !== editingCustomer?.id &&
        normalizePhone(customer.phone) === normalizedPhone
    )

    if (form.phone.trim() && phoneAlreadyExists) {
      errors.phone = "Já existe um cliente com este telefone."
    }

    setFormErrors(errors)

    if (errors.name) toast.warning(errors.name)
    else if (errors.phone) toast.warning(errors.phone)

    return Object.keys(errors).length === 0
  }

  // Customer creation and editing
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)

    try {
      await Promise.resolve()

      const customerData: CustomerForm = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || undefined,
        birthDate: form.birthDate || undefined,
        notes: form.notes?.trim() || undefined,
        status: form.status,
      }

      if (editingCustomer) {
        setCustomers((current) =>
          current.map((customer) =>
            customer.id === editingCustomer.id
              ? { ...customer, ...customerData }
              : customer
          )
        )
        setSelectedCustomerId(editingCustomer.id)
        toast.success("Cliente atualizado com sucesso.")
      } else {
        const newCustomer: Customer = {
          ...customerData,
          id: crypto.randomUUID(),
          totalRevenue: 0,
          revenueShare: 0,
          averageTicket: 0,
          appointmentCount: 0,
          recentAppointments: [],
        }

        setCustomers((current) => [
          newCustomer,
          ...current,
        ])
        setSearch("")
        setSelectedCustomerId(newCustomer.id)
        toast.success("Cliente cadastrado com sucesso.")
      }

      setIsDialogOpen(false)
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  // Customer deletion
  function handleDeleteCustomer() {
    if (!customerToDelete) return

    const remainingCustomers = customers.filter(
      (customer) => customer.id !== customerToDelete.id
    )

    setCustomers(remainingCustomers)

    if (selectedCustomerId === customerToDelete.id) {
      // Select another available customer after deletion.
      setSelectedCustomerId(remainingCustomers[0]?.id ?? null)
    }

    toast.success("Cliente excluído com sucesso.")
    setCustomerToDelete(null)
  }

  const hasCustomers = customers.length > 0
  const hasSearchResults = filteredCustomers.length > 0
  const selectedCustomer =
    filteredCustomers.find((customer) => customer.id === selectedCustomerId) ??
    filteredCustomers[0] ??
    null
  const activeCustomers = customers.filter(
    (customer) => customer.status === "ACTIVE"
  ).length
  const inactiveCustomers = customers.length - activeCustomers

  return (
    <div >


     <SidebarTrigger className="mt-5 ml-5"/>
    <div className="flex w-full min-w-0 max-w-full flex-col gap-7 overflow-x-hidden p-4 text-foreground md:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight"> Clientes</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Consulte e gerencie os clientes da sua barbearia.
          </p>
        </div>

        <Button
          type="button"
          onClick={openNewCustomerDialog}
          variant="ghost"
          className="w-full gap-2 bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </header>

      {/* Summary cards */}
      <section className="flex min-w-0 flex-col gap-4 xl:flex-row">
        <div className="w-full xl:w-[clamp(360px,28vw,430px)] xl:shrink-0">
          <SummaryCard label="Clientes cadastrados" value={customers.length} icon={Users} />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          <SummaryCard label="Clientes ativos" value={activeCustomers} icon={UserRound} tone="active" />
          <SummaryCard label="Clientes inativos" value={inactiveCustomers} icon={UserRound} tone="inactive" />
        </div>
      </section>

      {/* Customers master-detail area */}
      {!hasCustomers ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Nenhum cliente cadastrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre o primeiro cliente para começar.
              </p>
            </div>
            <Button type="button" onClick={openNewCustomerDialog} className="gap-2 bg-primary">
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="flex w-full min-w-0 flex-col gap-4 xl:flex-row xl:items-stretch">
          {/* Customer list */}
          <Card className="w-full min-w-0 overflow-hidden border-border bg-card shadow-none xl:w-[clamp(360px,28vw,430px)] xl:shrink-0">
            <div className="border-b border-border/50 p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Buscar por nome ou telefone..."
                  className="h-11 rounded-xl border-border bg-background pl-11 shadow-none focus-visible:border-primary/60"
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {filteredCustomers.length} de {customers.length} clientes
              </p>
            </div>

            <CardContent className="p-0">
              {!hasSearchResults ? (
                <div className="flex min-h-52 flex-col items-center justify-center gap-2 p-6 text-center">
                  <Search className="h-7 w-7 text-muted-foreground" />
                  <p className="font-medium">Nenhum cliente encontrado</p>
                  <p className="text-sm text-muted-foreground">
                    Tente outro nome ou telefone.
                  </p>
                </div>
              ) : (
                <div className="max-h-[29rem] overflow-y-auto overscroll-contain py-2">
                  {filteredCustomers.map((customer) => {
                    const isSelected = selectedCustomer?.id === customer.id

                    return (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`group relative grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset ${isSelected
                            ? "bg-primary/[0.07] shadow-[inset_3px_0_0_hsl(var(--primary))]"
                            : ""
                          }`}
                      >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold tracking-wide transition-colors ${isSelected
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-foreground"
                          }`}>
                          {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">
                            {customer.name}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {customer.phone}
                          </p>
                        </div>
                        <StatusBadge status={customer.status} />
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected customer details */}
          <div className="min-w-0 flex-1">
            {selectedCustomer ? (
              <CustomerDetails
                customer={selectedCustomer}
                onEdit={openEditCustomerDialog}
                onDelete={setCustomerToDelete}
              />
            ) : (
              <Card className="h-full w-full">
                <CardContent className="flex min-h-72 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Selecione um cliente para visualizar seus detalhes.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Customer form dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Atualize os dados do cliente selecionado."
                : "Preencha os dados para cadastrar um cliente."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-name">Nome *</Label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.currentTarget.value)}
                  aria-invalid={Boolean(formErrors.name)}
                  placeholder="Nome completo"
                />
                {formErrors.name ? (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Telefone *</Label>
                <Input
                  id="customer-phone"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.currentTarget.value)}
                  aria-invalid={Boolean(formErrors.phone)}
                  placeholder="(66) 99999-9999"
                />
                {formErrors.phone ? (
                  <p className="text-sm text-destructive">{formErrors.phone}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-email">E-mail</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.currentTarget.value)}
                  placeholder="cliente@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-birth-date">Data de nascimento</Label>
                <Input
                  id="customer-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => updateForm("birthDate", event.currentTarget.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: CustomerStatus) => updateForm("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                    <SelectItem value="INACTIVE">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-notes">Observações</Label>
                <Textarea
                  id="customer-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.currentTarget.value)}
                  placeholder="Preferências, informações importantes ou observações..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => handleDialogOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSaving
                  ? "Salvando..."
                  : editingCustomer
                    ? "Salvar alterações"
                    : "Cadastrar cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={Boolean(customerToDelete)}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá {customerToDelete?.name ?? "este cliente"} da lista local.
              Não será possível desfazer esta ação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={handleDeleteCustomer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  )
}

// Summary cards
function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: "default" | "active" | "inactive"
}) {
  const iconClassName =
    tone === "active"
      ? "bg-primary/10 text-primary"
      : tone === "inactive"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary"

  return (
    <Card className="h-full min-h-36 w-full min-w-0 border-border/30 bg-card text-card-foreground shadow-none">
      <CardContent className="flex h-full min-h-36 min-w-0 items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          <p className="text-base text-muted-foreground">{label}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className={`rounded-2xl p-3.5 ${iconClassName}`}>
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </div>
      </CardContent>
    </Card>
  )
}

// Selected customer details
function CustomerDetails({
  customer,
  onEdit,
  onDelete,
}: {
  customer: Customer
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}) {
  return (
    <Card className="h-full w-full min-w-0 overflow-x-hidden border-border bg-card shadow-none">
      <CardContent className="p-0">
        <div className="border-b border-border/50 p-5 sm:p-6 md:p-8">
          <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted text-2xl font-bold tracking-wide text-foreground">
                {getInitials(customer.name)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
                  {customer.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <StatusBadge status={customer.status} />
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.phone}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 gap-2 sm:justify-self-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 gap-2 border-transparent bg-muted/50 shadow-none hover:bg-muted/50 sm:flex-none"
                onClick={() => onEdit(customer)}
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 gap-2 border-transparent bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90 sm:flex-none"
                onClick={() => onDelete(customer)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-8 p-5 sm:p-6 md:p-8">
          <section>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Visão geral</h4>
            <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
              <OperationalCard icon={CircleDollarSign} label="Receita gerada">
                <p className="text-xl font-bold">{formatCurrency(customer.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">
                  {customer.revenueShare.toLocaleString("pt-BR")}% da receita total
                </p>
              </OperationalCard>

              <OperationalCard icon={History} label="Histórico">
                <p className="text-xl font-bold">{customer.appointmentCount} atendimentos</p>
                <p className="text-xs text-muted-foreground">
                  Ticket médio de {formatCurrency(customer.averageTicket)}
                </p>
              </OperationalCard>

              <OperationalCard icon={CalendarClock} label="Próximo atendimento">
                {customer.nextAppointment ? (
                  <>
                    <p className="text-sm font-semibold">
                      {formatAppointmentDate(customer.nextAppointment.date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {customer.nextAppointment.service}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">Não agendado</p>
                )}
              </OperationalCard>
            </div>
          </section>

          <section>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Histórico recente</h4>
            <div className="divide-y divide-border/20 rounded-xl border border-border/30 bg-muted/10 px-4">
              {customer.recentAppointments.length > 0 ? (
                customer.recentAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{appointment.service}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatAppointmentDate(appointment.date)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{appointment.professional}</p>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(appointment.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum atendimento registrado.
                </p>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-5 text-sm font-semibold text-foreground">Informações pessoais</h4>
            <div className="grid min-w-0 grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <DetailItem icon={Phone} label="Telefone" value={customer.phone} />
              <DetailItem icon={Mail} label="E-mail" value={customer.email ?? "Não informado"} />
              <DetailItem icon={CalendarDays} label="Nascimento" value={formatBirthDate(customer.birthDate)} />
              <DetailItem icon={UserRound} label="Status" value={statusLabel(customer.status)} />
            </div>
          </section>

          <section className="border-t border-border/30 pt-6">
            <DetailItem
              icon={FileText}
              label="Observações"
              value={customer.notes ?? "Nenhuma observação registrada."}
            />
          </section>
        </div>
      </CardContent>
    </Card>
  )
}

function OperationalCard({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/30 bg-muted/10 p-4">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function AppointmentStatusBadge({
  status,
}: {
  status: CustomerAppointment["status"]
}) {
  const labels = {
    COMPLETED: "Concluído",
    SCHEDULED: "Agendado",
    CANCELED: "Cancelado",
  } satisfies Record<CustomerAppointment["status"], string>

  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      {labels[status]}
    </span>
  )
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex w-full min-w-0 gap-4 overflow-hidden">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 min-w-0 break-words text-base font-medium leading-relaxed [overflow-wrap:anywhere]">{value}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "ACTIVE"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/50 bg-muted text-muted-foreground"
      }
    >
      {statusLabel(status)}
    </Badge>
  )
}
