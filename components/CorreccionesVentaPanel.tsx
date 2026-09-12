"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"

type Solicitud = {
  id: number
  estado: "PENDIENTE" | "RESUELTA" | "RECHAZADA"
  campo_referido: string | null
  valor_actual: string | null
  valor_sugerido: string | null
  observacion: string | null
  solicitado_por_nombre: string | null
  resuelto_por_nombre: string | null
  resolucion_observacion: string | null
  created_at: string
  resolved_at: string | null
}

type HistorialCorreccion = {
  id: number
  producto_operacion_id: number | null
  solicitud_id: number | null
  tabla_origen: string
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  modificado_por_nombre: string | null
  motivo: string | null
  created_at: string
}

type CampoCorregible = {
  clave: string
  etiqueta: string
  valor_actual: string
}

type Respuesta = {
  solicitudes: Solicitud[]
  puede_solicitar: boolean
  es_gestor: boolean
  motivo_bloqueo: string | null
  campos: CampoCorregible[]
  historial: HistorialCorreccion[]
}

function fecha(valor: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor))
}

export default function CorreccionesVentaPanel({
  operacionId,
}: {
  operacionId: string
}) {
  const [data, setData] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [campoSeleccionado, setCampoSeleccionado] = useState("")
  const [solicitudActiva, setSolicitudActiva] = useState<number | null>(null)
  const [accionActiva, setAccionActiva] = useState<"RESOLVER" | "RECHAZAR" | null>(null)
  const [valorResolucion, setValorResolucion] = useState("")
  const [motivoResolucion, setMotivoResolucion] = useState("")


  const cargar = useCallback(async () => {
    setCargando(true)
    setError("")
    try {
      const r = await fetch(
        `/api/correcciones-venta?operacion_id=${encodeURIComponent(operacionId)}`,
        { cache: "no-store" }
      )
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || "No se pudieron cargar las correcciones.")
      setData(j)
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las correcciones.")
    } finally {
      setCargando(false)
    }
  }, [operacionId])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function solicitar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setError("")
    const form = new FormData(e.currentTarget)

    try {
      const r = await fetch("/api/correcciones-venta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operacion_id: operacionId,
          campo_referido: String(form.get("campo_referido") || "").trim(),
          valor_actual: String(form.get("valor_actual") || "").trim(),
          valor_sugerido: String(form.get("valor_sugerido") || "").trim(),
          observacion: String(form.get("observacion") || "").trim(),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || "No se pudo enviar la solicitud.")
      setMostrarFormulario(false)
      await cargar()
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar la solicitud.")
    } finally {
      setEnviando(false)
    }
  }

  function abrirResolucion(solicitud: Solicitud, accion: "RESOLVER" | "RECHAZAR") {
    setSolicitudActiva(solicitud.id)
    setAccionActiva(accion)
    setValorResolucion(accion === "RESOLVER" ? (solicitud.valor_sugerido || "") : "")
    setMotivoResolucion("")
    setError("")
  }

  function cerrarResolucion() {
    setSolicitudActiva(null)
    setAccionActiva(null)
    setValorResolucion("")
    setMotivoResolucion("")
    setError("")
  }

  async function procesarSolicitud(solicitud: Solicitud) {
    if (!accionActiva) return

    setEnviando(true)
    setError("")

    try {
      const accionProcesada = accionActiva

      const r = await fetch("/api/correcciones-venta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operacion_id: operacionId,
          solicitud_id: solicitud.id,
          accion: accionProcesada,
          valor_nuevo: accionProcesada === "RESOLVER" ? valorResolucion.trim() : null,
          motivo: motivoResolucion.trim(),
        }),
      })

      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || "No se pudo procesar la solicitud.")

      cerrarResolucion()

      if (accionProcesada === "RESOLVER") {
        window.location.reload()
      } else {
        await cargar()
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo procesar la solicitud.")
    } finally {
      setEnviando(false)
    }
  }

  const pendientes = data?.solicitudes.filter((s) => s.estado === "PENDIENTE") ?? []

  if (cargando) {
    return (
      <section className="mb-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
        Verificando solicitudes de corrección...
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="mb-5 space-y-3">
      {pendientes.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="font-semibold text-amber-900">
            Solicitud de corrección pendiente
          </div>
          {pendientes.map((s) => (
            <div key={s.id} className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-gray-800">
              <div><b>Campo:</b> {data.campos.find((campo) => campo.clave === s.campo_referido)?.etiqueta || s.campo_referido || "No especificado"}</div>
              {s.valor_actual && <div><b>Valor actual:</b> {s.valor_actual}</div>}
              {s.valor_sugerido && <div><b>Valor correcto:</b> {s.valor_sugerido}</div>}
              {s.observacion && <div><b>Observación:</b> {s.observacion}</div>}
              <div className="mt-1 text-xs text-gray-500">
                Solicitada por {s.solicitado_por_nombre || "Vendedor"} el {fecha(s.created_at)}
              </div>
              {data.es_gestor && (
                <div className="mt-3">
                  {solicitudActiva !== s.id ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => abrirResolucion(s, "RESOLVER")}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        Editar Venta y resolver
                      </button>
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => abrirResolucion(s, "RECHAZAR")}
                        className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Rechazar solicitud
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="mb-3 font-semibold text-gray-900">
                        {accionActiva === "RESOLVER" ? "Resolver corrección" : "Rechazar solicitud"}
                      </div>

                      {accionActiva === "RESOLVER" && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm text-gray-700">
                            Valor actual
                            <input
                              readOnly
                              value={s.valor_actual || ""}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
                            />
                          </label>
                          <label className="text-sm text-gray-700">
                            Valor corregido
                            <input
                              value={valorResolucion}
                              onChange={(e) => setValorResolucion(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                            />
                          </label>
                        </div>
                      )}

                      <label className="mt-3 block text-sm text-gray-700">
                        {accionActiva === "RECHAZAR" ? "Motivo del rechazo" : "Observación de la corrección"}
                        <textarea
                          rows={2}
                          value={motivoResolucion}
                          onChange={(e) => setMotivoResolucion(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                          placeholder={
                            accionActiva === "RECHAZAR"
                              ? "Indicá por qué no corresponde realizar la corrección"
                              : "Observación opcional"
                          }
                        />
                      </label>

                      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={enviando || (accionActiva === "RESOLVER" && !valorResolucion.trim())}
                          onClick={() => procesarSolicitud(s)}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                            accionActiva === "RECHAZAR"
                              ? "bg-red-700 hover:bg-red-800"
                              : "bg-blue-700 hover:bg-blue-800"
                          }`}
                        >
                          {enviando
                            ? "Procesando..."
                            : accionActiva === "RECHAZAR"
                              ? "Confirmar rechazo"
                              : "Guardar corrección y resolver"}
                        </button>
                        <button
                          type="button"
                          disabled={enviando}
                          onClick={cerrarResolucion}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!data.es_gestor && data.puede_solicitar && pendientes.length === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          {!mostrarFormulario ? (
            <button
              type="button"
              onClick={() => setMostrarFormulario(true)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Solicitar corrección de datos
            </button>
          ) : (
            <form onSubmit={solicitar} className="space-y-3">
              <div className="font-semibold text-blue-950">Solicitar corrección de datos de carga</div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm text-gray-700">
                  Campo a corregir
                  <select
                    name="campo_referido"
                    required
                    value={campoSeleccionado}
                    onChange={(e) => setCampoSeleccionado(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  >
                    <option value="">Seleccionar…</option>
                    {(data.campos ?? []).map((campo) => (
                      <option key={campo.clave} value={campo.clave}>
                        {campo.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-gray-700">
                  Valor actual
                  <input
                    name="valor_actual"
                    readOnly
                    value={
                      (data.campos ?? []).find(
                        (campo) => campo.clave === campoSeleccionado
                      )?.valor_actual ?? ""
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Valor correcto
                  <input name="valor_sugerido" required className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
                </label>
              </div>
              <label className="block text-sm text-gray-700">
                Observación
                <textarea name="observacion" rows={2} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" placeholder="Detalle opcional para quien realizará la corrección" />
              </label>
              {error && <div className="text-sm text-red-700">{error}</div>}
              <div className="flex gap-2">
                <button disabled={enviando} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {enviando ? "Enviando..." : "Enviar solicitud"}
                </button>
                <button type="button" onClick={() => setMostrarFormulario(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!data.es_gestor && !data.puede_solicitar && pendientes.length === 0 && data.motivo_bloqueo && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {data.motivo_bloqueo}
        </div>
      )}

      {(data.historial ?? []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 font-semibold text-gray-900">Historial de correcciones</div>
          <div className="space-y-3">
            {data.historial.map((h) => (
              <div key={h.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="font-medium text-gray-900">{h.campo}</div>
                <div className="mt-1 grid gap-1 text-gray-700 md:grid-cols-2">
                  <div><b>Anterior:</b> {h.valor_anterior || "—"}</div>
                  <div><b>Nuevo:</b> {h.valor_nuevo || "—"}</div>
                </div>
                {h.motivo && (
                  <div className="mt-1 text-gray-700"><b>Motivo:</b> {h.motivo}</div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  Modificado por {h.modificado_por_nombre || "Usuario"} el {fecha(h.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
