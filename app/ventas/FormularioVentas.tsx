'use client'

import { FormEvent, useState, useTransition } from 'react'

import AppHeader from '../../components/AppHeader'

type TipoOperacion = 'PORTA' | 'BAF' | 'FACTIBILIDAD'

type PortaLine = {
  id: number
  esLineaNueva: boolean
}

type ResultadoGuardado = {
  ok: boolean
  mensaje: string
  idOperacion?: string
}

type Props = {
  nombreUsuario: string
  vendedor: string
  rol: string
  puedeGestionarVentas: boolean
  planesPorta: string[]
  planesBaf: string[]
  origenes: string[]
  zonas: string[]
  tiposDomicilio: string[]
  guardarVenta: (formData: FormData) => Promise<ResultadoGuardado>
}

const companias = ['PERSONAL', 'MOVISTAR', 'TUENTI']
const tiposDocumento = ['DNI', 'CUIT', 'LC', 'LE']

const opcionesConvergente = [
  'Convergente Full',
  'No Aplica',
  'Tiene Linea Claro POS',
  'Aplica y Gestiona Porta',
]

function Input({
  label,
  name,
  type = 'text',
  required = false,
  inputMode,
  placeholder,
  pattern,
  maxLength,
  title,
  telefonoNacional = false,
  defaultValue,
  readOnly = false,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  placeholder?: string
  pattern?: string
  maxLength?: number
  title?: string
  telefonoNacional?: boolean
  defaultValue?: string
  readOnly?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">
        {label}
        {required && ' *'}
      </span>

      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        pattern={pattern}
        maxLength={maxLength}
        title={title}
        defaultValue={defaultValue}
        readOnly={readOnly}
        onInput={
          telefonoNacional
            ? (e) => {
                const input = e.currentTarget
                let valor = input.value.replace(/\D/g, '').slice(0, 10)

                if (valor.startsWith('0') || valor.startsWith('5')) {
                  valor = ''
                }

                input.value = valor
              }
            : undefined
        }
        className="w-full min-h-11 border border-green-300 rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-gray-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
      />
    </label>
  )
}

function Select({
  label,
  name,
  opciones,
  required = false,
  defaultValue = '',
}: {
  label: string
  name: string
  opciones: string[]
  required?: boolean
  defaultValue?: string
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">
        {label}
        {required && ' *'}
      </span>

      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full min-h-11 border border-gray-300 rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
      >
        <option value="">Seleccionar</option>

        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function FormularioVentas({
  nombreUsuario,
  vendedor,
  rol,
  puedeGestionarVentas,
  planesPorta,
  planesBaf,
  origenes,
  zonas,
  tiposDomicilio,
  guardarVenta,
}: Props) {
  const [tipo, setTipo] = useState<TipoOperacion>('PORTA')
  const [lineasPorta, setLineasPorta] = useState<PortaLine[]>([{ id: 1, esLineaNueva: false }])
  const [guardando, iniciarGuardado] = useTransition()
  const [resultado, setResultado] =
    useState<ResultadoGuardado | null>(null)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const form = evento.currentTarget
    const formData = new FormData(form)

    formData.set('tipo', tipo)
    setResultado(null)

    iniciarGuardado(async () => {
      const respuesta = await guardarVenta(formData)
      setResultado(respuesta)

      if (respuesta.ok) {
        form.reset()
        setLineasPorta([{ id: 1, esLineaNueva: false }])
      }
    })
  }

  const planes = tipo === 'PORTA' ? planesPorta : planesBaf

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">

      <AppHeader
        rol={rol}
        usuario={nombreUsuario}
        actual="VENTAS"
        puedeGestionarVentas={puedeGestionarVentas}
      />

      <form
        onSubmit={enviar}
        className="max-w-6xl mx-auto px-2.5 py-3 sm:px-5 sm:py-5 pb-24 sm:pb-6"
      >

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span><strong>AMBIENTE DE PRUEBAS</strong> · Los registros se sincronizan con los Sheets de testing.</span>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white border border-gray-200 p-2 mb-3 shadow-sm">
          {(['BAF', 'PORTA'] as TipoOperacion[]).map((opcion) => {
            const seleccionado = tipo === opcion
            const esBaf = opcion === 'BAF'

            return (
              <button
                key={opcion}
                type="button"
                onClick={() => {
                  setTipo(opcion)
                  setResultado(null)
                          }}
                className={[
                  'min-h-16 rounded-2xl px-4 py-3 text-sm sm:text-base font-extrabold transition-all duration-150',
                  'border-4 shadow-sm active:scale-[0.99]',
                  esBaf
                    ? 'bg-yellow-300 text-red-700 hover:bg-yellow-200'
                    : 'bg-red-600 text-white hover:bg-red-700',
                  seleccionado
                    ? esBaf
                      ? 'border-red-600 ring-2 ring-red-100 shadow-md'
                      : 'border-yellow-300 ring-2 ring-yellow-100 shadow-md'
                    : 'border-transparent opacity-90 hover:opacity-100',
                ].join(' ')}
                aria-pressed={seleccionado}
              >
                {esBaf ? 'Internet Fija BAF' : 'Portabilidad y LN'}
              </button>
            )
          })}
        </div>

        <section className="mb-3 rounded-2xl border border-green-300 bg-green-50 p-3 sm:p-4 shadow-sm">
          <label className="block">
            <span className="block text-base sm:text-lg font-extrabold text-gray-900 mb-2">
              ORIGEN DEL DATO <span className="text-green-700">(IMPORTANTE!)</span>
            </span>

            <select
              name="origen_dato"
              required
              defaultValue=""
              className="w-full min-h-11 border border-gray-300 rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="VENTA TERRENO">VENTA TERRENO</option>
              <option value="BASE ITX">BASE ITX</option>
              <option value="PSR">PSR</option>
              <option value="LLAMADA IN">LLAMADA IN</option>
              <option value="BOT DRIVE LC">BOT DRIVE LC</option>
              <option value="CHATBOT 360">CHATBOT 360</option>
              <option value="BOT TREBLE">BOT TREBLE</option>
              <option value="GOOGLE">GOOGLE</option>
              <option value="BOT BIRCLE">BOT BIRCLE</option>
              <option value="CLIENTE POTENCIALES QR">CLIENTE POTENCIALES QR</option>
            </select>
          </label>
        </section>

        <section className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-500">
              Usuario <strong className="text-gray-800">{nombreUsuario}</strong>
            </span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="text-gray-500 truncate">
              Vendedor <strong className="text-gray-800">{vendedor}</strong>
            </span>
          </div>
        </section>

        <section className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">01</span>
            <h2 className="font-bold text-sm sm:text-base">Cliente</h2>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">

              <Input label="Nombre" name="nombre" required />
              <Input label="Apellido" name="apellido" required />

              <div className="grid grid-cols-[105px_1fr] gap-2.5 sm:col-span-2">
                <Select
                  label="Documento"
                  name="tipo_documento"
                  opciones={tiposDocumento}
                  defaultValue="DNI"
                  required
                />

                <Input
                  label="Número"
                  name="dni"
                  inputMode="numeric"
                  required
                />
              </div>

              <Input
                label="Fecha nacimiento"
                name="fecha_nacimiento"
                type="date"
              />

              <Input
                label={tipo === 'PORTA' ? 'Contacto' : 'Teléfono'}
                name="telefono"
                type="tel"
                inputMode="numeric"
                pattern="[1-46-9][0-9]{9}"
                maxLength={10}
                telefonoNacional
                title="Ingrese exactamente 10 dígitos. Solo números, sin +, espacios ni guiones. No puede comenzar con 0 ni con 5."
                required
              />

              {tipo !== 'FACTIBILIDAD' && (
                <Input
                  label="Contacto alternativo"
                  name="telefono_alternativo"
                  type="tel"
                  inputMode="numeric"
                  pattern="[1-46-9][0-9]{9}"
                  maxLength={10}
                  title="Ingrese exactamente 10 dígitos. Solo números, sin +, espacios ni guiones. No puede comenzar con 0 ni con 5."
                  required
                />
              )}

              {tipo !== 'FACTIBILIDAD' && (
                <Input
                  label="Correo cliente"
                  name="email"
                  type="email"
                  inputMode="email"
                  required
                />
              )}

            </div>
          </div>
        </section>

        <section className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">02</span>
            <h2 className="font-bold text-sm sm:text-base">Domicilio</h2>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">

              {(tipo === 'BAF' || tipo === 'FACTIBILIDAD') && (
                <Select
                  label="Tipo domicilio"
                  name="tipo_domicilio"
                  opciones={[
                    'Casa (- 7 unidades)',
                    'Edificio (Acometido o + 7 UF o + 3 Pisos)',
                    'FWA 5G',
                  ]}
                  required
                />
              )}

              <div className="sm:col-span-2">
                <Input
                  label="Calle y Nro"
                  name="domicilio"
                  required
                />
              </div>

              <Input
                label="Entre calles"
                name="entre_calles"
                required
              />

              {tipo === 'PORTA' && (
                <>
                  <Input label="Piso" name="piso" />
                  <Input label="Dpto" name="dpto" />
                  <Input label="Barrio" name="barrio" />
                  <Input label="Localidad" name="localidad" />
                  <Input label="Coordenadas" name="coordenadas" />

                  <div className="sm:col-span-2">
                    <Input label="Datos extras" name="datos_extras" />
                  </div>
                </>
              )}

            </div>
          </div>
        </section>

        {tipo === 'PORTA' && (
          <section className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">03</span>
              <h2 className="font-bold text-sm sm:text-base">
                Portabilidad / Línea Nueva
              </h2>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm">

              <input
                type="hidden"
                name="porta_line_count"
                value={lineasPorta.length}
              />

              <div className="space-y-3">
                {lineasPorta.map((linea, index) => (
                  <div
                    key={linea.id}
                    className="border border-gray-200 rounded-2xl p-3 bg-gray-50/80"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-bold text-gray-800">
                          Línea {index + 1}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {linea.esLineaNueva ? 'Línea Nueva' : 'Portabilidad'}
                        </div>
                      </div>

                      {lineasPorta.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLineasPorta((actuales) =>
                              actuales.filter((item) => item.id !== linea.id)
                            )
                          }
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="block">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                          Tipo de línea *
                        </span>
                        <select
                          name={`tipo_linea_${index}`}
                          value={linea.esLineaNueva ? 'LN' : 'PORTA'}
                          onChange={(e) => {
                            const esLN = e.target.value === 'LN'
                            setLineasPorta((actuales) =>
                              actuales.map((item) =>
                                item.id === linea.id
                                  ? { ...item, esLineaNueva: esLN }
                                  : item
                              )
                            )
                          }}
                          required
                          className="w-full min-h-11 border border-gray-300 rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        >
                          <option value="PORTA">Portabilidad</option>
                          <option value="LN">Línea Nueva</option>
                        </select>
                      </label>
                    </div>

                    <div
                      className={
                        linea.esLineaNueva
                          ? 'grid grid-cols-1 sm:grid-cols-3 gap-2'
                          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2'
                      }
                    >
                      {linea.esLineaNueva ? (
                        <Input
                          label="NIM"
                          name={`nim_${index}`}
                          type="text"
                          inputMode="numeric"
                          defaultValue="9999999999"
                          readOnly
                          required
                        />
                      ) : (
                        <Input
                          label="NIM a portar"
                          name={`nim_${index}`}
                          type="tel"
                          inputMode="numeric"
                          pattern="[1-46-9][0-9]{9}"
                          maxLength={10}
                          telefonoNacional
                          title="Ingrese exactamente 10 dígitos. Solo números, sin +, espacios ni guiones. No puede comenzar con 0 ni con 5."
                          required
                        />
                      )}

                      <Select
                        label="Gigas acordados"
                        name={`plan_${index}`}
                        opciones={planesPorta}
                        required
                      />

                      <Select
                        label="SIM"
                        name={`tipo_sim_${index}`}
                        opciones={['eSIM', 'SIMCARD']}
                        required
                      />

                      {!linea.esLineaNueva && (
                        <>
                          <Select
                            label="Compañía actual"
                            name={`compania_actual_${index}`}
                            opciones={companias}
                            required
                          />

                          <Select
                            label="PRE / POS"
                            name={`prepago_pospago_${index}`}
                            opciones={['POS', 'PRE']}
                            required
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setLineasPorta((actuales) => [
                      ...actuales,
                      {
                        id:
                          Math.max(
                            0,
                            ...actuales.map((item) => item.id)
                          ) + 1,
                        esLineaNueva: false,
                      },
                    ])
                  }
                  className="w-full sm:w-auto border border-dashed border-red-300 bg-red-50/50 text-red-600 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-red-50"
                >
                  + Agregar línea
                </button>
              </div>
            </div>
          </section>
        )}

        {tipo === 'BAF' && (
          <section className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">03</span>
              <h2 className="font-bold text-sm sm:text-base">Servicio BAF</h2>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">

                <Select
                  label="Plan"
                  name="plan"
                  opciones={planes}
                  required
                />

                <Select
                  label="Servicio BAF"
                  name="modalidad_plan"
                  opciones={[
                    'Masivo',
                    'Cuit Standard',
                    'Cuit BAFE',
                  ]}
                  required
                />

                <Select
                  label="TV"
                  name="tv"
                  opciones={['NO', 'SI']}
                  defaultValue="NO"
                  required
                />

                <Select
                  label="Cant. decos adicionales"
                  name="cantidad_decos"
                  opciones={['0', '1', '2']}
                  defaultValue="0"
                />

                <Select
                  label="Zona"
                  name="zona"
                  opciones={zonas}
                />

                <Select
                  label="Convergente"
                  name="convergente"
                  opciones={opcionesConvergente}
                  required
                />

                <Input
                  label="Línea convergente"
                  name="linea_convergente"
                  type="tel"
                  inputMode="numeric"
                  pattern="[1-46-9][0-9]{9}"
                  maxLength={10}
                  title="Ingrese exactamente 10 dígitos. Solo números, sin +, espacios ni guiones. No puede comenzar con 0 ni con 5."
                />

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                      Horario Contacto / Observaciones *
                    </span>

                    <textarea
                      name="horario_contacto"
                      required
                      rows={2}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                </div>

              </div>
            </div>
          </section>
        )}

        {tipo === 'FACTIBILIDAD' && (
          <section className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">03</span>
              <h2 className="font-bold text-sm sm:text-base">Factibilidad</h2>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">

                <Input
                  label="Línea Claro a consultar"
                  name="linea_claro_consultar"
                  type="tel"
                  inputMode="numeric"
                  required
                />

                <Input
                  label="Pedido rellamado"
                  name="pedido_rellamado"
                  placeholder="DNI / detalle del pedido"
                />

                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">
                      Observaciones
                    </span>

                    <textarea
                      name="observaciones"
                      rows={2}
                      disabled
                      placeholder="Campo no disponible por el momento"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                    />
                  </label>
                </div>

              </div>
            </div>
          </section>
        )}

        {resultado && (
          <div
            className={
              resultado.ok
                ? 'mb-3 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-medium text-green-700 shadow-sm'
                : 'mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700 shadow-sm'
            }
          >
            <div>{resultado.mensaje}</div>

            {resultado.idOperacion && (
              <div className="font-mono text-xs mt-1">
                ID: {resultado.idOperacion}
              </div>
            )}
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur sm:sticky sm:bg-gray-100/95 sm:px-0 sm:shadow-none sm:mt-3">
          <button
            type="submit"
            disabled={guardando}
            className="mx-auto block w-full max-w-6xl sm:w-auto sm:min-w-56 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl px-6 py-3 text-base sm:text-sm shadow-sm disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : `Guardar ${tipo}`}
          </button>
        </div>

      </form>
    </main>
  )
}
