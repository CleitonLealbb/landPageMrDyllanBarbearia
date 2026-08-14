"use client"
import { ProfissionaisTop } from "@/features/professionals/components/professionals-top"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast, Toaster } from "sonner"
import Cropper from "react-easy-crop"
import { canAccess } from "@/lib/permissions"

import {
  Edit,
  Trash2,
  UserPlus,
  Users,
  Scissors,
  Banknote,
  Star,
  Camera,
  User,
  type LucideIcon,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
import { useEffect, useState } from "react"


const PROFESSIONAL_PERMISSION_LEVELS = [
  "BARBER",
  "ASSISTANT",
] as const

const PROFESSIONAL_ROLES = [
  "Barbeiro Proprietário",
  "Barber Master",
  "Barber",
  "Assistente",
] as const

type ProfessionalPermissionLevel =
  (typeof PROFESSIONAL_PERMISSION_LEVELS)[number]

function isProfessionalPermissionLevel(
  value: unknown
): value is ProfessionalPermissionLevel {
  return PROFESSIONAL_PERMISSION_LEVELS.some(
    (permissionLevel) => permissionLevel === value
  )
}

type TenantRole = "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT"

type StoredUser = {
  id: string
  name: string
  email: string
  photoUrl: string
} & (
  | {
      type: "USER"
      globalRole: "SUPER_ADMIN"
      tenantRole: null
    }
  | {
      type: "USER"
      globalRole: null
      tenantRole: TenantRole
    }
  | {
      type: "PROFESSIONAL"
      globalRole: null
      tenantRole: "BARBER" | "ASSISTANT"
    }
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTenantRole(value: unknown): value is TenantRole {
  return (
    value === "BARBERSHOP_OWNER" ||
    value === "BARBER" ||
    value === "ASSISTANT"
  )
}

function isStoredUser(value: unknown): value is StoredUser {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.email !== "string" ||
    typeof value.photoUrl !== "string" ||
    "role" in value ||
    "sessionVersion" in value ||
    "barbershopId" in value
  ) {
    return false
  }

  if (value.type === "USER") {
    return (
      (value.globalRole === "SUPER_ADMIN" &&
        value.tenantRole === null) ||
      (value.globalRole === null &&
        isTenantRole(value.tenantRole))
    )
  }

  if (value.type === "PROFESSIONAL") {
    return (
      value.globalRole === null &&
      (value.tenantRole === "BARBER" ||
        value.tenantRole === "ASSISTANT")
    )
  }

  return false
}

type Profissional = {
  id: string
  name: string
  email: string | null
  accessEmail: string | null
  identityType: "LINKED_USER" | "INDEPENDENT_PROFESSIONAL"
  role: string
  permissionLevel?: string
  commission: number
  specialties: string[]
  photoUrl?: string
  status: string

}


export function ProfissionaisView() {


  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [photoUrl, setPhotoUrl] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  const [professionalName, setProfessionalName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [commission, setCommission] = useState("")

  const [specialties, setSpecialties] = useState<string[]>([])
  const [specialtyInput, setSpecialtyInput] = useState("")
  const [open, setOpen] = useState(false)
  const [editingProfessional, setEditingProfessional] =
    useState<Profissional | null>(null)

  const [permissionLevel, setPermissionLevel] =
    useState<ProfessionalPermissionLevel | "">("")
  /*{ carregar os profissionais}*/
  const [effectiveRole, setEffectiveRole] =
    useState<"BARBERSHOP_OWNER" | null>(null)

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user")

      if (storedUser) {
        const parsedUser: unknown = JSON.parse(storedUser)

        setEffectiveRole(
          isStoredUser(parsedUser) &&
            parsedUser.type === "USER" &&
            parsedUser.globalRole === null &&
            parsedUser.tenantRole === "BARBERSHOP_OWNER"
            ? parsedUser.tenantRole
            : null
        )
      } else {
        setEffectiveRole(null)
      }
    } catch {
      setEffectiveRole(null)
    }

    async function carregarProfissionais() {
      const response = await fetch("/api/professionals")
  
      if (!response.ok) {
        toast.error("Erro ao carregar profissionais.")
        return
      }
  
      const data = await response.json()
  
      setProfissionais(data)
    }
  
    carregarProfissionais()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    const linkedProfile = editingProfessional?.identityType === "LINKED_USER"

    if (!linkedProfile && !emailRegex.test(email.trim())) {
      toast.warning("Informe um e-mail válido.")
      return
    }

    if (!professionalName.trim()) {
      toast.warning("Informe o nome do profissional.")
      return
    }

    if (!linkedProfile && !email.trim()) {
      toast.warning("Informe o e-mail do profissional.")
      return
    }

    if (!role.trim()) {
      toast.warning("Selecione o cargo do profissional.")
      return
    }
    if (!linkedProfile && !isProfessionalPermissionLevel(permissionLevel)) {
      toast.warning("Selecione um nível de permissão válido.")
      return
    }

    if (specialties.length === 0) {
      toast.warning("Adicione pelo menos uma especialidade.")
      return
    }
    if (!commission.trim()) {
      toast.warning("Informe a comissão do profissional.")
      return
    }

    if (Number(commission) < 0 || Number(commission) > 100) {
      toast.warning("A comissão deve estar entre 0 e 100%.")
      return
    }

    const url = editingProfessional
      ? `/api/professionals/${editingProfessional.id}`
      : "/api/professionals"

    const method = editingProfessional ? "PUT" : "POST"

    const finalPhotoUrl = imageSrc || photoUrl

    let uploadedPhotoUrl = photoUrl

    if (photoFile) {
      const formData = new FormData()
      formData.append("file", photoFile)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        toast.error("Erro ao enviar imagem.")
        return
      }

      const uploadData = await uploadResponse.json()
      uploadedPhotoUrl = uploadData.url
    }

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: professionalName.trim(),
        ...(!linkedProfile ? { email: email.trim() } : {}),
        role,
        ...(!linkedProfile ? { permissionLevel } : {}),
        commission: Number(commission),
        specialties,
        photoUrl: uploadedPhotoUrl,
      }),
    })

    if (!response.ok) {
      const error = await response.json()

      if (response.status === 409) {

        toast.error(
          "Profissional já cadastrado."
        )

      } else if (response.status === 400) {

        toast.warning(
          error.message
        )

      } else {

        toast.error(
          "Erro ao cadastrar profissional."
        )
      }

      return
    }

    const novoProfissional = await response.json()
    if (editingProfessional) {
      setProfissionais((prev) =>
        prev.map((item) =>
          item.id === novoProfissional.id ? novoProfissional : item
        )
      )

      toast.success("Profissional atualizado com sucesso.")
    } else {
      setProfissionais((prev) => [novoProfissional, ...prev])

      toast.success("Profissional cadastrado com sucesso.")
    }

    setOpen(false)
    setEditingProfessional(null)
    setProfessionalName("")
    setEmail("")
    setRole("")
    setCommission("")
    setSpecialties([])
    setProfessionalName("")
    setEmail("")
    setRole("")
    setCommission("")
    setSpecialties([])
    setPermissionLevel("")
    setPhotoUrl("")
    setImageSrc("")
    setPhotoFile(null)
  }


  async function handleDelete(id: string) {
    const response = await fetch(`/api/professionals/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      toast.error("Erro ao excluir profissional.")
      return
    }

    setProfissionais((prev) =>
      prev.filter((item) => item.id !== id)
    )

    toast.success("Profissional excluído com sucesso.")
  }

  function toggleSpecialty(value: string) {
    setSpecialties((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    )
  }

  function addCustomSpecialty() {
    const value = specialtyInput.trim()

    if (!value) return

    if (specialties.includes(value)) {
      alert("Essa especialidade já foi adicionada.")
      return
    }

    setSpecialties((prev) => [...prev, value])
    setSpecialtyInput("")
  }

  function handleEdit(item: Profissional) {
    setEditingProfessional(item)

    setProfessionalName(item.name)
    setEmail(item.accessEmail ?? "")
    setRole(item.role)
    setPermissionLevel(
      isProfessionalPermissionLevel(item.permissionLevel)
        ? item.permissionLevel
        : ""
    )
    setCommission(String(item.commission))
    setSpecialties(item.specialties ?? [])
    setPhotoUrl(item.photoUrl ?? "")
    setImageSrc(item.photoUrl ?? "")
    setOpen(true)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden  ">
      <div className="flex flex-1 flex-col ">
        {/* Topo fixo */}
        <div className="shrink-0 justify-center">
          <ProfissionaisTop />
        </div>
        <Card className="flex items-center bg-[var(--bg)] justify-between rounded-none border-0 border-b border-white/10 px-6 py-6 shadow-sm mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">
              Equipe de Barbeiros
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie sua equipe, comissões e disponibilidade.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen} >

            <DialogTrigger asChild>
              <DialogTrigger asChild>
              { canAccess(effectiveRole, "professionals:create")  && (
                <Button
                  onClick={() => {
                    setEditingProfessional(null)

                    setProfessionalName("")
                    setEmail("")
                    setRole("")
                    setPermissionLevel("")
                    setCommission("")
                    setSpecialties([])
                    setOpen(true)
                  }}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4" />
                  Adicionar Novo Profissional
                </Button>)}
              </DialogTrigger>
            </DialogTrigger>
            <DialogContent className="max-w-7xl border-white/10 bg-[#171717] text-white max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-row gap-2 border-white/10 ml-6 mt-6 mr-6">
                <UserPlus className="h-6 w-6" />
                <DialogTitle>
                  {editingProfessional
                    ? "Editar Profissional"
                    : "Adicionar Novo Profissional"}
                </DialogTitle>
                {editingProfessional?.identityType === "LINKED_USER" && (
                  <Badge className="bg-primary text-primary-foreground">Proprietário</Badge>
                )}
                <DialogDescription className="sr-only">
                  {editingProfessional
                    ? "Formulário para editar profissional."
                    : "Formulário para cadastrar um novo profissional."}
                </DialogDescription>
              </DialogHeader>
              <div className="border-b border-white/10" />

              <form
                onSubmit={handleSubmit}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {/* DADOS BÁSICOS */}
                <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
                  <h3 className="border-l-4 border-yellow-500 pl-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Dados Básicos
                  </h3>

                  <div className="grid grid-cols-[360px_1fr] gap-6">
                    {/* Foto */}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="space-y-4">
                        <div className="relative h-[260px] w-full overflow-hidden rounded-3xl border border-yellow-500/30 bg-zinc-950">
                          {imageSrc ? (
                            <Cropper
                              image={imageSrc}
                              crop={crop}
                              zoom={zoom}
                              aspect={1}
                              cropShape="round"
                              showGrid={false}
                              onCropChange={setCrop}
                              onZoomChange={setZoom}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-500">
                              <Camera className="h-12 w-12" />
                              <span className="text-sm">Nenhuma foto selecionada</span>
                            </div>
                          )}
                        </div>

                        {imageSrc && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                              <span>Zoom</span>
                              <span>{zoom.toFixed(1)}x</span>
                            </div>

                            <input
                              type="range"
                              min={1}
                              max={5}
                              step={0.1}
                              value={zoom}
                              onChange={(e) => setZoom(Number(e.currentTarget.value))}
                              className="w-full accent-yellow-500"
                            />
                          </div>
                        )}

                        <label className="block w-full cursor-pointer rounded-xl bg-yellow-500 px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-yellow-400">
                          Escolher foto

                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const file = e.currentTarget.files?.[0]
                              if (!file) return

                              setPhotoFile(file)
                              setImageSrc(URL.createObjectURL(file))
                            }}
                          />
                        </label>

                        {imageSrc && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => {
                              setPhotoFile(null)
                              setImageSrc("")
                              setPhotoUrl("")
                              setZoom(1)
                              setCrop({ x: 0, y: 0 })
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover foto
                          </Button>
                        )}

                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
                          <span className="text-yellow-400">Dica:</span>{" "}
                          use o zoom e arraste a imagem para enquadrar o rosto.
                        </div>
                      </div>
                    </div>

                    {/* Campos */}
                    <div className="space-y-4">
                      <div className="space-y-2">

                        <Label>Nome Completo</Label>
                        <Input
                          placeholder="Ex: Ricardo Silva"
                          value={professionalName}
                          onChange={(e) => setProfessionalName(e.currentTarget.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="professional-email">
                            {editingProfessional?.identityType === "LINKED_USER"
                              ? "E-mail de acesso"
                              : "E-mail profissional"}
                          </Label>
                          <Input
                            id="professional-email"
                            value={email}
                            readOnly={editingProfessional?.identityType === "LINKED_USER"}
                            aria-readonly={editingProfessional?.identityType === "LINKED_USER"}
                            onChange={(e) => setEmail(e.currentTarget.value)}
                          />
                          {editingProfessional?.identityType === "LINKED_USER" && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Este e-mail pertence à conta administrativa.
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toast.info("A alteração segura do e-mail da conta ainda não está disponível. Use a área de Perfil/Conta quando ela for liberada.")}
                              >
                                Alterar e-mail da conta
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Cargo / Função</Label>
                          <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cargo" />
                            </SelectTrigger>

                            <SelectContent>
                              {!PROFESSIONAL_ROLES.includes(role as (typeof PROFESSIONAL_ROLES)[number]) && role && (
                                <SelectItem value={role}>{role}</SelectItem>
                              )}
                              {PROFESSIONAL_ROLES.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          {editingProfessional?.identityType === "LINKED_USER" ? (
                            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                              <div>
                                <Label>Atuação operacional</Label>
                                <p className="mt-1 text-sm font-medium">Barbeiro</p>
                              </div>
                              <div>
                                <Label>Acesso administrativo</Label>
                                <p className="mt-1 text-sm font-medium">Proprietário da barbearia</p>
                              </div>
                              <p className="text-xs leading-5 text-muted-foreground">
                                O acesso administrativo vem da conta proprietária e não pode ser alterado neste formulário.
                              </p>
                            </div>
                          ) : (
                            <>
                              <Label>Acesso profissional</Label>
                              <Select
                                value={permissionLevel}
                                onValueChange={(value) => {
                                  if (isProfessionalPermissionLevel(value)) setPermissionLevel(value)
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o acesso" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BARBER">Barbeiro</SelectItem>
                                  <SelectItem value="ASSISTANT">Assistente</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Comissão (%)</Label>
                          <Input
                            placeholder="Ex: 40"
                            value={commission}
                            onChange={(e) => setCommission(e.currentTarget.value)}
                          />
                        </div>

                        {/* ESPECIALIDADES */}
                        <div className="space-y-2 ">
                          <Label>Adicionar especialidade</Label>
                          <div className="flex flex-wrap gap-2">

                            {specialties.map((item) => (
                              <Badge key={item} onClick={() => toggleSpecialty(item)} className="cursor-pointer rounded-full border border-yellow-500/30 bg-yellow-500/20 px-2 py-1 text-yellow-300 hover:bg-yellow-500/20">
                                {item}
                              </Badge>
                            ))}




                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Ex: Luzes, Platinado, Design de barba..."
                              value={specialtyInput}
                              onChange={(e) => setSpecialtyInput(e.currentTarget.value)}
                            />


                            <Button type="button" onClick={addCustomSpecialty}>
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>





                {/* BOTÕES */}
                <div className="border-t border-white/10 px-8 py-4">
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>

                    <Button
                      type="submit"
                      className="bg-yellow-500 text-black hover:bg-yellow-400"
                    >
                      {editingProfessional
                        ? "Salvar Alterações"
                        : "Cadastrar Profissional"}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>

        </Card>
        <div className="flex-1 overflow-y-auto p-6">



          <Card className=" overflow-hidden border-white/10 bg-[#171717] text-white p-0">
            <Table >
              <TableHeader>
                <TableRow className=" border-white/10 bg-white/[0.03] hover:bg-white/[0.03]">
                  <TableHead>Profissional</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Especialidades</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {profissionais.map((item) => (
                  <TableRow key={item.id} className=" h-36 border-white/10 hover:bg-white/[0.03]">
                    <TableCell>
                      <div className="flex items-center gap-4 ">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.name}
                            className="h-16 w-16 shrink-0 rounded-full border-2 object-cover object-top border-yellow-500/20 bg-zinc-900  shadow-md"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-yellow-500/20 bg-zinc-900 text-zinc-500 shadow-md">
                            <User className="h-7 w-7" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {item.name}
                          </p>

                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge className="rounded-full bg-zinc-700 text-white border-white/10">
                        <span>{item.role}</span>
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.specialties?.map((esp: string) => (
                          <Badge key={esp} className="rounded-full border border-yellow-500/30 bg-yellow-500/20 px-2 py-1 text-yellow-300 hover:bg-yellow-500/20">
                            <span>{esp}</span>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>{item.commission}%</TableCell>

                    <TableCell>{item.status ?? "Ativo"}</TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        {canAccess(effectiveRole, "professionals:update") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canAccess(effectiveRole, "professionals:delete") && item.identityType !== "LINKED_USER" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>

          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mt-4">
            <MetricCard title="Total Equipe" value="12" icon={Users} />
            <MetricCard title="Em Serviço" value="08" icon={Scissors} />
            <MetricCard title="Média Comis." value="38%" icon={Banknote} />
            <MetricCard title="NPS Equipe" value="4" icon={Star} />
          </div>
        </div>


      </div>

    </div>




  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon: LucideIcon
}) {
  return (
    <Card className="border-white/10 bg-[#171717] text-white">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>

          <h3 className="mt-2 text-2xl font-bold">{value}</h3>
        </div>

        <div className="rounded-md bg-primary/30 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}
