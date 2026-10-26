'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

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
  const pathname = usePathname()
  const [sonidoActivo, setSonidoActivo] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
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
  const [usuariosConectados, setUsuariosConectados] =
    useState<string[]>([])
  const finalRef = useRef<HTMLDivElement>(null)
  const mensajesContenedorRef = useRef<HTMLDivElement>(null)
  const ultimoMensajeIdRef = useRef<number | null>(null)
  const conversacionAnteriorRef = useRef<number | null>(null)
  const cercaDelFinalRef = useRef(true)
  const chatAbiertoRef = useRef(false)
  const conversacionActivaRef = useRef<number | null>(null)
  const solicitudMensajesRef = useRef(0)
  const lecturasConfirmadasRef = useRef<Map<number, number>>(new Map())
  const lecturasPendientesRef = useRef<Set<number>>(new Set())
  const solicitudConversacionesRef = useRef(0)
  const noLeidosAnterioresRef = useRef<Map<number, number> | null>(null)
  const notificacionPendienteRef = useRef(false)

  useEffect(() => {
    setSonidoActivo(
      window.localStorage.getItem('webchat-pgl-sonido') !== 'false'
    )
  }, [])

  useEffect(() => {
    if (!sonidoActivo || !habilitado) return

    const habilitarAudio = () => {
      try {
        const contexto = audioContextRef.current ?? new AudioContext()
        audioContextRef.current = contexto

        if (contexto.state === 'suspended') {
          void contexto.resume().catch((error) => {
            console.error('Webchat: no se pudo habilitar audio', error)
          })
        }
      } catch (error) {
        console.error('Webchat: audio no disponible', error)
      }
    }

    document.addEventListener('pointerdown', habilitarAudio)
    document.addEventListener('keydown', habilitarAudio)

    return () => {
      document.removeEventListener('pointerdown', habilitarAudio)
      document.removeEventListener('keydown', habilitarAudio)
    }
  }, [sonidoActivo, habilitado])

  const reproducirSonido = useCallback(() => {
    try {
      const contexto = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = contexto

      if (contexto.state !== 'running') return

      const inicio = contexto.currentTime

      const tocarNota = (frecuencia: number, demora: number) => {
        const oscilador = contexto.createOscillator()
        const volumen = contexto.createGain()
        const tiempo = inicio + demora

        oscilador.type = 'sine'
        oscilador.frequency.setValueAtTime(frecuencia, tiempo)

        volumen.gain.setValueAtTime(0.0001, tiempo)
        volumen.gain.exponentialRampToValueAtTime(
          0.30, tiempo + 0.025
        )
        volumen.gain.setValueAtTime(0.30, tiempo + 0.15)
        volumen.gain.exponentialRampToValueAtTime(
          0.0001, tiempo + 0.25
        )

        oscilador.connect(volumen)
        volumen.connect(contexto.destination)

        oscilador.start(tiempo)
        oscilador.stop(tiempo + 0.26)
      }

      tocarNota(740, 0)
      tocarNota(988, 0.30)
    } catch (error) {
      console.error('Webchat: no se pudo reproducir sonido', error)
    }
  }, [])

  useEffect(() => {
    if (!notificacionPendienteRef.current) return

    notificacionPendienteRef.current = false

    if (sonidoActivo) reproducirSonido()
  }, [conversaciones, sonidoActivo, reproducirSonido])

  const cambiarSonido = () => {
    const nuevoEstado = !sonidoActivo
    setSonidoActivo(nuevoEstado)
    window.localStorage.setItem(
      'webchat-pgl-sonido',
      String(nuevoEstado)
    )

    if (nuevoEstado) {
      const contexto = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = contexto
      void contexto.resume()
    }
  }

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
    const solicitud = ++solicitudConversacionesRef.current

    const respuesta = await fetch('/api/webchat/conversaciones', {
      cache: 'no-store',
    })

    if (!respuesta.ok) return

    const datos = await respuesta.json()

    if (solicitud !== solicitudConversacionesRef.current) return

    const nuevas: Conversacion[] = datos.conversaciones ?? []

    const anteriores = noLeidosAnterioresRef.current
    const actuales = new Map(
      nuevas.map((c) => [c.id, c.no_leidos ?? 0])
    )

    if (anteriores !== null) {
      const hayNuevos = nuevas.some((c) => {
        const anterior = anteriores.get(c.id) ?? 0
        return (
          (c.no_leidos ?? 0) > anterior &&
          !(chatAbiertoRef.current &&
            conversacionActivaRef.current === c.id)
        )
      })

      if (hayNuevos) {
        notificacionPendienteRef.current = true
      }
    }

    noLeidosAnterioresRef.current = actuales
    setConversaciones(nuevas)
  }, [])

  const cargarMensajes = useCallback(async (id: number) => {
    const solicitud = ++solicitudMensajesRef.current

    const respuesta = await fetch(
      `/api/webchat/mensajes?conversacion_id=${id}`,
      { cache: 'no-store' }
    )

    if (!respuesta.ok) return false

    const datos = await respuesta.json()

    if (
      !chatAbiertoRef.current ||
      conversacionActivaRef.current !== id ||
      solicitud !== solicitudMensajesRef.current
    ) return false

    const recibidos: Mensaje[] = datos.mensajes ?? []
    setMensajes(recibidos)

    return {
      ultimoMensajeId: recibidos.at(-1)?.id ?? null,
    }
  }, [])

  useEffect(() => {
    if (pathname === '/login') {
      setHabilitado(false)
      return
    }
    void cargarContactos()
  }, [pathname, cargarContactos])

  useEffect(() => {
    if (!habilitado || !usuarioId) return

    let cancelado = false

    async function actualizarPresencia() {
      if (document.visibilityState !== 'visible') return

      try {
        await fetch('/api/webchat/presencia', {
          method: 'POST',
          cache: 'no-store',
        })

        const respuesta = await fetch('/api/webchat/presencia', {
          cache: 'no-store',
        })

        if (!respuesta.ok) return

        const datos = await respuesta.json()

        if (!cancelado) {
          setUsuariosConectados(datos.conectados ?? [])
        }
      } catch (error) {
        console.error('Webchat: error de presencia', error)
      }
    }

    void actualizarPresencia()

    const intervalo = window.setInterval(() => {
      void actualizarPresencia()
    }, 20000)

    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        void actualizarPresencia()
      }
    }

    document.addEventListener('visibilitychange', alVolver)

    return () => {
      cancelado = true
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [habilitado, usuarioId])

  useEffect(() => {
    if (!habilitado || abierto) return

    void cargarConversaciones()

    const intervalo = window.setInterval(() => {
      void cargarConversaciones()
    }, 10000)

    return () => window.clearInterval(intervalo)
  }, [habilitado, abierto, cargarConversaciones])

  useEffect(() => {
    if (!abierto || !conversacionId) return

    const contenedor = mensajesContenedorRef.current
    if (!contenedor) return

    const ultimoId = mensajes.at(-1)?.id ?? null
    const cambioConversacion =
      conversacionAnteriorRef.current !== conversacionId

    if (cambioConversacion) {
      conversacionAnteriorRef.current = conversacionId
      ultimoMensajeIdRef.current = ultimoId
      contenedor.scrollTop = contenedor.scrollHeight
      return
    }

    if (ultimoId === ultimoMensajeIdRef.current) return

    ultimoMensajeIdRef.current = ultimoId

    if (cercaDelFinalRef.current) {
      contenedor.scrollTop = contenedor.scrollHeight
    }
  }, [mensajes, conversacionId, abierto])
  const marcarLeida = useCallback(async (
    id: number,
    ultimoMensajeId: number | null
  ) => {
    if (
      !chatAbiertoRef.current ||
      conversacionActivaRef.current !== id ||
      ultimoMensajeId === null
    ) return

    const confirmado = lecturasConfirmadasRef.current.get(id) ?? 0

    if (
      ultimoMensajeId <= confirmado ||
      lecturasPendientesRef.current.has(id)
    ) return

    lecturasPendientesRef.current.add(id)

    try {
      const respuesta = await fetch('/api/webchat/mensajes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: id,
          ultimo_mensaje_id: ultimoMensajeId,
        }),
      })

      if (respuesta.ok) {
        lecturasConfirmadasRef.current.set(
          id,
          Math.max(
            lecturasConfirmadasRef.current.get(id) ?? 0,
            ultimoMensajeId
          )
        )

        await cargarConversaciones()
      }
    } catch (error) {
      console.error('Webchat: error al marcar lectura', error)
    } finally {
      lecturasPendientesRef.current.delete(id)
    }
  }, [cargarConversaciones])

  useEffect(() => {
    if (!abierto) return

    void cargarConversaciones()

    if (conversacionId) {
      void cargarMensajes(conversacionId)
    }

    const intervalo = window.setInterval(() => {
      if (conversacionId) {
        void (async () => {
          const cargada = await cargarMensajes(conversacionId)

          if (
            cargada &&
            conversacionActivaRef.current === conversacionId
          ) {
            await marcarLeida(
              conversacionId,
              cargada.ultimoMensajeId
            )
          }
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
    conversacionActivaRef.current = datos.conversacion_id
    conversacionAnteriorRef.current = null
    cercaDelFinalRef.current = true
    setMensajes([])
    setDestinatario(contacto)
    setConversacionId(datos.conversacion_id)
    const cargada = await cargarMensajes(datos.conversacion_id)

    if (
      cargada &&
      chatAbiertoRef.current &&
      conversacionActivaRef.current === datos.conversacion_id
    ) {
      await marcarLeida(
        datos.conversacion_id,
        cargada.ultimoMensajeId
      )
    }
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

  const contactosFiltrados = contactos
    .filter((contacto) =>
      `${contacto.nombre ?? ''} ${contacto.vendedor ?? ''} ${contacto.rol}`
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    )
    .sort((a, b) => {
      const aConectado = usuariosConectados.includes(a.id)
      const bConectado = usuariosConectados.includes(b.id)

      if (aConectado !== bConectado) {
        return aConectado ? -1 : 1
      }

      const nombreA = a.nombre ?? a.vendedor ?? ''
      const nombreB = b.nombre ?? b.vendedor ?? ''

      return nombreA.localeCompare(nombreB, 'es', {
        sensitivity: 'base',
      })
    })

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

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cambiarSonido}
                className="rounded-lg px-2 py-1 text-lg hover:bg-white/20"
                title={sonidoActivo ? 'Silenciar notificaciones' : 'Activar sonido'}
                aria-label={sonidoActivo ? 'Silenciar notificaciones' : 'Activar sonido'}
              >
                {sonidoActivo ? '🔊' : '🔇'}
              </button>
            <button
              type="button"
              onClick={() => {
                chatAbiertoRef.current = false
                solicitudMensajesRef.current += 1
                setAbierto(false)
              }}
              className="rounded-lg px-3 py-1 text-xl hover:bg-white/20"
              aria-label="Cerrar chat"
            >
              ×
            </button>
            </div>
          </header>

          {conversacionId ? (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    conversacionActivaRef.current = null
                    solicitudMensajesRef.current += 1
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
                    <span className={
                      destinatario &&
                      usuariosConectados.includes(destinatario.id)
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }>
                      {destinatario &&
                      usuariosConectados.includes(destinatario.id)
                        ? '● En línea'
                        : '● Desconectado'}
                    </span>
                    {' · '}{destinatario?.rol ?? ''}
                  </div>
                </div>
              </div>

              <div
                  ref={mensajesContenedorRef}
                  onScroll={(evento) => {
                    const elemento = evento.currentTarget
                    const distancia =
                      elemento.scrollHeight -
                      elemento.scrollTop -
                      elemento.clientHeight
                    cercaDelFinalRef.current = distancia < 180
                  }}
                  className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4"
                >
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
                          conversacionActivaRef.current = conversacion.id
                          conversacionAnteriorRef.current = null
                          cercaDelFinalRef.current = true
                          solicitudMensajesRef.current += 1
                          setMensajes([])
                          setConversacionId(conversacion.id)
                          const cargada = await cargarMensajes(conversacion.id)

                          if (
                            cargada &&
                            chatAbiertoRef.current &&
                            conversacionActivaRef.current === conversacion.id
                          ) {
                            await marcarLeida(
                              conversacion.id,
                              cargada.ultimoMensajeId
                            )
                          }
                        }}
                        className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-gray-100"
                      >
                        <div>
                          {conversacion.destinatario?.nombre ?? 'Usuario'}
                        </div>
                        <div className={
                          conversacion.destinatario &&
                          usuariosConectados.includes(
                            conversacion.destinatario.id
                          )
                            ? 'text-xs text-green-600'
                            : 'text-xs text-gray-500'
                        }>
                          {conversacion.destinatario &&
                          usuariosConectados.includes(
                            conversacion.destinatario.id
                          )
                            ? '● En línea'
                            : '● Desconectado'}
                        </div>
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
                      <div className={
                        usuariosConectados.includes(contacto.id)
                          ? 'text-xs text-green-600'
                          : 'text-xs text-gray-500'
                      }>
                        {usuariosConectados.includes(contacto.id)
                          ? '● En línea'
                          : '● Desconectado'}
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
          onClick={() => {
            const nuevoEstado = !abierto
            chatAbiertoRef.current = nuevoEstado

            if (!nuevoEstado) {
              solicitudMensajesRef.current += 1
            }

            setAbierto(nuevoEstado)
          }}
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
