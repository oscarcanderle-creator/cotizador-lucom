'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  tipoRecurso: 'VENTA' | 'CONSULTA' | 'PEDIDO'
  recursoClave: string
  idOperacion: string
  editando: boolean
  sesionToken: string | null
  bloqueado: boolean
  bloqueoPropio: boolean
  usuarioBloqueo: string | null
  bloqueadoDesde: string | null
  basePath?: string
  listPath?: string
}

export default function GestionBloqueoControls(props: Props) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const basePath = props.basePath || '/gestion-ventas'
  const listPath = props.listPath || basePath

  const volverConsulta = () => {
    router.replace(`${basePath}/${encodeURIComponent(props.idOperacion)}`)
    router.refresh()
  }

  const volverListado = () => {
    router.replace(listPath)
    router.refresh()
  }

  useEffect(() => {
    if (!props.editando || !props.sesionToken) return

    const renovar = async () => {
      try {
        const response = await fetch('/api/gestion/bloqueo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'RENOVAR',
            tipo_recurso: props.tipoRecurso,
            recurso_clave: props.recursoClave,
            sesion_token: props.sesionToken,
          }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.renovado !== true) {
          setMensaje('El bloqueo de edición ya no pertenece a esta sesión. La pantalla volverá a modo consulta.')
          window.setTimeout(volverConsulta, 1800)
        }
      } catch {
        // Una interrupción breve de red no libera inmediatamente el bloqueo.
        // El siguiente heartbeat volverá a intentarlo; el TTL protege bloqueos abandonados.
      }
    }

    const timer = window.setInterval(renovar, 60_000)
    return () => window.clearInterval(timer)
  }, [props.editando, props.sesionToken, props.tipoRecurso, props.recursoClave, props.idOperacion])

  async function gestionar() {
    if (ocupado) return
    setOcupado(true)
    setMensaje(null)

    const token = crypto.randomUUID()

    try {
      const response = await fetch('/api/gestion/bloqueo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'ADQUIRIR',
          tipo_recurso: props.tipoRecurso,
          recurso_clave: props.recursoClave,
          sesion_token: token,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setMensaje(data?.error || 'No se pudo iniciar la gestión.')
        return
      }

      if (data?.adquirido !== true) {
        setMensaje(
          data?.motivo === 'MISMO_USUARIO_OTRA_SESION'
            ? 'Esta venta ya está siendo gestionada por vos en otra sesión o pestaña.'
            : 'La venta ya está siendo gestionada por otro usuario.'
        )
        router.refresh()
        return
      }

      router.replace(
        `${basePath}/${encodeURIComponent(props.idOperacion)}?editar=1&lock=${encodeURIComponent(token)}#gestion`
      )
      router.refresh()
    } catch {
      setMensaje('No se pudo comunicar con el servidor para iniciar la gestión.')
    } finally {
      setOcupado(false)
    }
  }

  async function cancelar() {
    if (!props.sesionToken || ocupado) return
    if (!window.confirm('¿Cancelar la edición y liberar esta venta sin guardar los cambios?')) return

    setOcupado(true)
    setMensaje(null)

    try {
      const response = await fetch('/api/gestion/bloqueo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'LIBERAR',
          tipo_recurso: props.tipoRecurso,
          recurso_clave: props.recursoClave,
          sesion_token: props.sesionToken,
          motivo: 'CANCELADO',
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || data?.liberado !== true) {
        setMensaje(data?.error || 'No se pudo cancelar la edición ni liberar el bloqueo.')
        return
      }

      volverListado()
    } catch {
      setMensaje('No se pudo comunicar con el servidor para cancelar la edición.')
    } finally {
      setOcupado(false)
    }
  }

  const desde = props.bloqueadoDesde
    ? new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(props.bloqueadoDesde))
    : null

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {props.editando ? (
            <>
              <div className="font-semibold text-green-700">🔒 Estás gestionando esta venta</div>
              <div className="mt-1 text-xs text-gray-500">El bloqueo se renueva automáticamente mientras esta pantalla permanezca abierta.</div>
            </>
          ) : props.bloqueado ? (
            <>
              <div className="font-semibold text-amber-700">🔒 Venta en gestión</div>
              <div className="mt-1 text-sm text-gray-600">
                {props.bloqueoPropio ? 'La estás gestionando vos en otra sesión.' : `La está gestionando ${props.usuarioBloqueo || 'otro usuario'}`}
                {desde ? ` desde ${desde}.` : '.'} Podés consultarla, pero no editarla.
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-gray-900">Modo consulta</div>
              <div className="mt-1 text-sm text-gray-500">Ver la venta no la bloquea. Para modificarla, iniciá una gestión exclusiva.</div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {props.editando ? (
            <button type="button" onClick={cancelar} disabled={ocupado} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancelar edición
            </button>
          ) : !props.bloqueado ? (
            <button type="button" onClick={gestionar} disabled={ocupado} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {ocupado ? 'Iniciando…' : 'Gestionar'}
            </button>
          ) : null}
        </div>
      </div>
      {mensaje && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{mensaje}</div>}
    </div>
  )
}
