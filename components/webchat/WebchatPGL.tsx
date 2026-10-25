'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Contacto = {
  id: string
  nombre: string | null
  vendedor: string | null
  rol: string
  es_gestor: boolean
}

type Conversacion = {
  id: number
  destinatario: Contacto | null
  ultimo_mensaje_en: string | null
  no_leidos: number
}

type Mensaje = {
  id: number
  conversacion_id: number
  remitente_id: string
  contenido: string
  enviado_en: string
}

export default function WebchatPGL() {
  const [habilitado, setHabilitado] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionId, setConversacionId] = useState<number | null>(null)
  const [destinatario, setDestinatario] = useState<Contacto | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const finalRef = useRef<HTMLDivElement>(null)

  const cargarContactos = useCallback(async () => {
    const respuesta = await fetch('/api/webchat/usuarios', {
      cache: 'no-store',
    })

    if (!respuesta.ok) {
      setHabilitado(false)
      return
    }

    const datos = await respuesta.json()
    setContactos(datos.usuarios ?? [])
    setUsuarioId(datos.usuario_id ?? '')
    setHabilitado(true)
  }, [])

  const cargarConversaciones = useCallback(async () => {
    const respuesta = await fetch('/api/webchat/conversaciones', {
      cache: 'no-store',
    })

    if (!respuesta.ok) return

    const datos = await respuesta.json()
    setConversaciones(datos.conversaciones ?? [])
  }, [])

  const cargarMensajes = useCallback(async (id: number) => {
    const respuesta = await fetch(
      `/api/webchat/mensajes?conversacion_id=${id}`,
      { cache: 'no-store' }
    )

    if (!respuesta.ok) return

    const datos = await respuesta.json()
    setMensajes(datos.mensajes ?? [])
  }, [])

  useEffect(() => {
    void cargarContactos()
  }, [cargarContactos])

  useEffect(() => {
    if (!habilitado || abierto) return

    void cargarConversaciones()

    const intervalo = window.setInterval(() => {
      void cargarConversaciones()
    }, 10000)

    return () => window.clearInterval(intervalo)
  }, [habilitado, abierto, cargarConversaciones])

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const marcarLeida = useCallback(async (id: number) => {
    try {
      const respuesta = await fetch('/api/webchat/mensajes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: id }),
      })

      if (respuesta.ok) {
        await cargarConversaciones()
      }
    } catch (error) {
      console.error('Webchat: error al marcar lectura', error)
    }
  }, [cargarConversaciones])

  useEffect(() => {
    if (!abierto) return

    void cargarConversaciones()

    const intervalo = window.setInterval(() => {
      if (conversacionId) {
        void (async () => {
          await cargarMensajes(conversacionId)
          await marcarLeida(conversacionId)
        })()
      } else {
        void cargarConversaciones()
      }
    }, 5000)

    return () => window.clearInterval(intervalo)
  }, [abierto, conversacionId, cargarConversaciones, cargarMensajes, marcarLeida])


  async function abrirConversacion(contacto: Contacto) {
    setError('')

    const respuesta = await fetch('/api/webchat/conversaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatario_id: contacto.id }),
    })

    if (!respuesta.ok) {
      setError('No se pudo abrir la conversación.')
      return
    }

    const datos = await respuesta.json()
    setDestinatario(contacto)
    setConversacionId(datos.conversacion_id)
    await cargarMensajes(datos.conversacion_id)
    await marcarLeida(datos.conversacion_id)
  }

  async function enviarMensaje(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!conversacionId || !texto.trim() || enviando) return

    setEnviando(true)
    setError('')

    try {
      const respuesta = await fetch('/api/webchat/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionId,
          contenido: texto.trim(),
        }),
      })

      if (!respuesta.ok) throw new Error('No se pudo enviar')

      setTexto('')
      await cargarMensajes(conversacionId)
      await cargarConversaciones()
    } catch {
      setError('No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  const contactosFiltrados = contactos.filter((contacto) =>
    `${contacto.nombre ?? ''} ${contacto.vendedor ?? ''} ${contacto.rol}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  const totalNoLeidos = conversaciones.reduce(
    (total, conversacion) => total + (conversacion.no_leidos ?? 0),
    0
  )

  if (!habilitado) return null

  return (
    <div className="fixed bottom-5 right-5 z-[90] font-sans text-gray-900">
      {abierto && (
        <section className="mb-3 flex h-[min(600px,78vh)] w-[min(390px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-[#c8102e] px-4 py-3 text-white">
            <div>
              <div className="font-bold">Webchat PGL</div>
              <div className="text-xs text-white/80">
                Comunicación interna
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg px-3 py-1 text-xl hover:bg-white/20"
              aria-label="Cerrar chat"
            >
              ×
            </button>
          </header>

          {conversacionId ? (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setConversacionId(null)
                    setDestinatario(null)
                    setMensajes([])
                  }}
                  className="text-lg text-gray-500"
                  aria-label="Volver a contactos"
                >
                  ←
                </button>

                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {destinatario?.nombre ?? 'Conversación'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {destinatario?.rol ?? ''}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
                {mensajes.map((mensaje) => {
                  const propio = mensaje.remitente_id === usuarioId

                  return (
                    <div
                      key={mensaje.id}
                      className={`flex ${propio ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          propio
                            ? 'bg-[#c8102e] text-white'
                            : 'border bg-white text-gray-900'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {mensaje.contenido}
                        </div>
                        <div className="mt-1 text-right text-[10px] opacity-65">
                          {new Date(mensaje.enviado_en).toLocaleTimeString(
                            'es-AR',
                            { hour: '2-digit', minute: '2-digit' }
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={finalRef} />
              </div>

              <form
                onSubmit={enviarMensaje}
                className="flex gap-2 border-t p-3"
              >
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={4000}
                  placeholder="Escribí un mensaje..."
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={!texto.trim() || enviando}
                  className="rounded-xl bg-[#c8102e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="p-3">
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar usuarios..."
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {conversaciones.length > 0 && (
                  <>
                    <div className="mb-2 text-xs font-bold uppercase text-gray-400">
                      Conversaciones
                    </div>
                    {conversaciones.map((conversacion) => (
                      <button
                        key={conversacion.id}
                        type="button"
                        onClick={async () => {
                          setDestinatario(conversacion.destinatario)
                          setConversacionId(conversacion.id)
                          await cargarMensajes(conversacion.id)
                          await marcarLeida(conversacion.id)
                        }}
                        className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-gray-100"
                      >
                        {conversacion.destinatario?.nombre ?? 'Usuario'}
                      </button>
                    ))}
                  </>
                )}

                <div className="mb-2 mt-3 text-xs font-bold uppercase text-gray-400">
                  Contactos
                </div>

                {contactosFiltrados.map((contacto) => (
                  <button
                    key={contacto.id}
                    type="button"
                    onClick={() => void abrirConversacion(contacto)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-100"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
                      {(contacto.nombre ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {contacto.nombre ?? contacto.vendedor ?? 'Usuario'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {contacto.es_gestor ? 'Gestor' : contacto.rol}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="border-t bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </section>
      )}

      <div className="relative flex justify-end">
        {totalNoLeidos > 0 && (
          <span className="absolute -right-1 -top-2 z-10 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-700 px-1 text-xs font-bold text-white">
            {totalNoLeidos > 99 ? '99+' : totalNoLeidos}
          </span>
        )}
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c8102e] text-2xl text-white shadow-xl transition hover:scale-105"
          aria-label={abierto ? 'Cerrar Webchat' : 'Abrir Webchat'}
          title="Webchat PGL"
        >
          {abierto ? '×' : '✉'}
        </button>
      </div>
    </div>
  )
}
