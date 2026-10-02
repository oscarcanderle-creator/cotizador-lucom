'use client'

import { ChangeEvent, useCallback, useEffect, useState } from 'react'

type TipoDocumento = 'DNI_FRENTE' | 'DNI_DORSO' | 'DNI_COMPLETO' | 'CHIP_OK'

type Documento = {
  id: number
  tipo_documento: TipoDocumento
  nombre_original: string
  mime_type: string
  tamano_bytes: number
  created_at: string
  created_by?: string
}

function etiquetaTipo(tipo: TipoDocumento) {
  if (tipo === 'DNI_FRENTE') return 'Frente'
  if (tipo === 'DNI_DORSO') return 'Dorso'
  if (tipo === 'CHIP_OK') return 'CHIP-OK'
  return 'DNI completo'
}

function tamano(bytes: number) {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fechaArgentina(fecha: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(fecha))
  } catch {
    return fecha
  }
}

export default function DocumentacionDni({
  productoOperacionId,
  puedeSubir = true,
}: {
  productoOperacionId: number
  puedeSubir?: boolean
}) {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState<TipoDocumento | null>(null)
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [tipoProducto, setTipoProducto] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const respuesta = await fetch(
        `/api/documentacion-dni?producto_operacion_id=${productoOperacionId}`,
        { cache: 'no-store' }
      )

      const data = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(data?.error || 'No se pudo consultar la documentación.')
      }

      setDocumentos(Array.isArray(data?.documentos) ? data.documentos : [])
      setTipoProducto(String(data?.tipo_producto ?? '').trim().toUpperCase())
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo consultar la documentación.'
      )
    } finally {
      setCargando(false)
    }
  }, [productoOperacionId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function subir(
    tipoDocumento: TipoDocumento,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const archivo = event.target.files?.[0]
    event.target.value = ''

    if (!archivo) return

    setSubiendo(tipoDocumento)
    setError('')

    try {
      const formData = new FormData()
      formData.append('producto_operacion_id', String(productoOperacionId))
      formData.append('tipo_documento', tipoDocumento)
      formData.append('archivo', archivo)

      const respuesta = await fetch('/api/documentacion-dni', {
        method: 'POST',
        body: formData,
      })

      const data = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(data?.error || 'No se pudo subir el documento.')
      }

      await cargar()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo subir el documento.'
      )
    } finally {
      setSubiendo(null)
    }
  }

  async function abrir(documento: Documento) {
    setAbriendo(documento.id)
    setError('')

    try {
      const respuesta = await fetch('/api/documentacion-dni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento_id: documento.id,
          producto_operacion_id: productoOperacionId,
        }),
      })

      const data = await respuesta.json()

      if (!respuesta.ok || !data?.url) {
        throw new Error(data?.error || 'No se pudo abrir el documento.')
      }

      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo abrir el documento.'
      )
    } finally {
      setAbriendo(null)
    }
  }

  const frente = documentos.some((d) => d.tipo_documento === 'DNI_FRENTE')
  const dorso = documentos.some((d) => d.tipo_documento === 'DNI_DORSO')
  const completo = documentos.some((d) => d.tipo_documento === 'DNI_COMPLETO')
  const documentacionCompleta = completo || (frente && dorso)

  return (
    <section className="border-t border-gray-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">
            Documentación DNI
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Archivos privados asociados a esta línea.
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            documentacionCompleta
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {documentacionCompleta ? 'Completa' : 'Pendiente'}
        </span>
      </div>

      {cargando ? (
        <p className="mt-4 text-sm text-gray-500">
          Consultando documentación...
        </p>
      ) : documentos.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
          Todavía no hay documentación DNI cargada.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {documentos.map((documento) => (
            <div
              key={documento.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">
                  {etiquetaTipo(documento.tipo_documento)}
                </div>
                <div className="mt-0.5 break-all text-xs text-gray-500">
                  {documento.nombre_original} · {tamano(documento.tamano_bytes)} ·{' '}
                  {fechaArgentina(documento.created_at)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void abrir(documento)}
                disabled={abriendo === documento.id}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
              >
                {abriendo === documento.id ? 'Abriendo...' : 'Ver'}
              </button>
            </div>
          ))}
        </div>
      )}

      {puedeSubir && (
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">
            {subiendo === 'DNI_FRENTE' ? 'Subiendo...' : '+ Frente'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={subiendo !== null}
              onChange={(e) => void subir('DNI_FRENTE', e)}
              className="hidden"
            />
          </label>

          <label className="cursor-pointer rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">
            {subiendo === 'DNI_DORSO' ? 'Subiendo...' : '+ Dorso'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={subiendo !== null}
              onChange={(e) => void subir('DNI_DORSO', e)}
              className="hidden"
            />
          </label>

          <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            {subiendo === 'DNI_COMPLETO' ? 'Subiendo...' : '+ PDF completo'}
            <input
              type="file"
              accept="application/pdf"
              disabled={subiendo !== null}
              onChange={(e) => void subir('DNI_COMPLETO', e)}
              className="hidden"
            />
          </label>

          {['PORTA', 'LINEA_NUEVA'].includes(tipoProducto) && (
            <label className="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900">
              {subiendo === 'CHIP_OK' ? 'Subiendo...' : '+ CHIP-OK'}
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={subiendo !== null}
                onChange={(e) => void subir('CHIP_OK', e)}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </section>
  )
}
