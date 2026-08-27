'use client'

import { FormEvent, useState, useTransition } from 'react'

import CerrarSesion from '../CerrarSesion'

type TipoOperacion = 'PORTA' | 'BAF' | 'FACTIBILIDAD'

type PortaLine = {
  id: number
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
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">
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
        className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white text-gray-900"
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
      <span className="block text-xs text-gray-500 mb-1">
        {label}
        {required && ' *'}
      </span>

      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white text-gray-900"
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
  planesPorta,
  planesBaf,
  origenes,
  zonas,
  tiposDomicilio,
  guardarVenta,
}: Props) {
  const [tipo, setTipo] = useState<TipoOperacion>('PORTA')
  const [esLineaNueva, setEsLineaNueva] = useState(false)
  const [lineasPorta, setLineasPorta] = useState<PortaLine[]>([{ id: 1 }])
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
        setEsLineaNueva(false)
        setLineasPorta([{ id: 1 }])
      }
    })
  }

  const planes = tipo === 'PORTA' ? planesPorta : planesBaf

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

      <header className="bg-white border-b border-gray-200 px-3 sm:px-5 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

          <div>
            <div className="text-2xl font-bold text-red-600">
              Claro
            </div>
            <div className="text-sm text-gray-500">
              Carga de Operaciones
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href="/cotizador" className="text-gray-500 hover:text-red-600">
              Cotizador
            </a>

            {rol === 'ADMIN' && (
              <a href="/admin" className="text-gray-500 hover:text-red-600">
                Admin
              </a>
            )}

            <span className="text-gray-300">·</span>
            <span className="text-gray-500">{nombreUsuario}</span>
            <CerrarSesion />
          </div>

        </div>
      </header>

      <form
        onSubmit={enviar}
        className="max-w-7xl mx-auto px-3 py-3 sm:px-5 sm:py-4"
      >

        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          AMBIENTE DE PRUEBAS · Esta primera versión guarda únicamente en Supabase. Todavía no escribe en Google Sheets.
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['PORTA', 'BAF', 'FACTIBILIDAD'] as TipoOperacion[]).map(
            (opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => {
                  setTipo(opcion)
                  setResultado(null)
                  setEsLineaNueva(false)
                }}
                className={
                  tipo === opcion
                    ? 'rounded-lg bg-red-600 text-white font-semibold py-2 text-sm'
                    : 'rounded-lg bg-white border border-gray-300 text-gray-600 font-semibold py-2 text-sm'
                }
              >
                {opcion}
              </button>
            )
          )}
        </div>

        <section className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Usuario</div>
              <div className="font-semibold text-sm">{nombreUsuario}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Vendedor</div>
              <div className="font-semibold text-sm">{vendedor}</div>
            </div>
          </div>
        </section>

        <section className="mb-3">
          <h2 className="font-semibold mb-2">Cliente</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

              <Input label="Nombre" name="nombre" required />
              <Input label="Apellido" name="apellido" required />

              <div className="grid grid-cols-[120px_1fr] gap-2 sm:col-span-2">
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

              {tipo !== 'FACTIBILIDAD' && (
                <Input
                  label="Fecha nacimiento"
                  name="fecha_nacimiento"
                  type="date"
                  required
                />
              )}

              <Input
                label={tipo === 'PORTA' ? 'Contacto' : 'Teléfono'}
                name="telefono"
                type="tel"
                inputMode="tel"
                required
              />

              {tipo !== 'FACTIBILIDAD' && (
                <Input
                  label="Contacto alternativo"
                  name="telefono_alternativo"
                  type="tel"
                  inputMode="tel"
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
          <h2 className="font-semibold mb-2">Domicilio</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

              {(tipo === 'BAF' || tipo === 'FACTIBILIDAD') && (
                <Select
                  label="Tipo domicilio"
                  name="tipo_domicilio"
                  opciones={tiposDomicilio}
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
            <h2 className="font-semibold mb-2">
              Portabilidad / Línea Nueva
            </h2>

            <div className="bg-white border border-gray-200 rounded-xl p-3">

              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  name="es_linea_nueva"
                  checked={esLineaNueva}
                  onChange={(e) => {
                    setEsLineaNueva(e.target.checked)
                    setLineasPorta([{ id: 1 }])
                  }}
                />
                Línea Nueva (registra LNUEVA)
              </label>

              <input
                type="hidden"
                name="porta_line_count"
                value={lineasPorta.length}
              />

              <div className="space-y-3">
                {lineasPorta.map((linea, index) => (
                  <div
                    key={linea.id}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-700">
                        {esLineaNueva
                          ? `Línea Nueva ${index + 1}`
                          : `Línea ${index + 1}`}
                      </div>

                      {lineasPorta.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLineasPorta((actuales) =>
                              actuales.filter((item) => item.id !== linea.id)
                            )
                          }
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    <div
                      className={
                        esLineaNueva
                          ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
                          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2'
                      }
                    >
                      {!esLineaNueva && (
                        <Input
                          label="NIM a portar"
                          name={`nim_${index}`}
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]{10}"
                          maxLength={10}
                          title="Ingrese exactamente 10 dígitos, sin espacios ni guiones"
                          required
                        />
                      )}

                      <Select
                        label="Gigas acordados"
                        name={`plan_${index}`}
                        opciones={planes}
                        required
                      />

                      {!esLineaNueva && (
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
                      },
                    ])
                  }
                  className="w-full sm:w-auto border border-red-600 text-red-600 rounded-md px-4 py-2 text-sm font-medium hover:bg-red-50"
                >
                  {esLineaNueva
                    ? '+ Agregar Línea Nueva'
                    : '+ Agregar línea'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">
                      Observaciones
                    </span>

                    <textarea
                      name="observaciones"
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white text-gray-900"
                    />
                  </label>
                </div>

                <Select
                  label="Origen del dato"
                  name="origen_dato"
                  opciones={origenes}
                  required
                />
              </div>
            </div>
          </section>
        )}

        {tipo === 'BAF' && (
          <section className="mb-3">
            <h2 className="font-semibold mb-2">Servicio BAF</h2>

            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

                <Select
                  label="Plan"
                  name="plan"
                  opciones={planes}
                  required
                />

                <Select
                  label="Modalidad"
                  name="modalidad_plan"
                  opciones={['DNI', 'CUIT', 'BAFE']}
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
                  label="Detalle Lead"
                  name="origen_dato"
                  opciones={origenes}
                  required
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
                />

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">
                      Horario Contacto / Observaciones *
                    </span>

                    <textarea
                      name="horario_contacto"
                      required
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white text-gray-900"
                    />
                  </label>
                </div>

              </div>
            </div>
          </section>
        )}

        {tipo === 'FACTIBILIDAD' && (
          <section className="mb-3">
            <h2 className="font-semibold mb-2">Factibilidad</h2>

            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

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
                    <span className="block text-xs text-gray-500 mb-1">
                      Observaciones
                    </span>

                    <textarea
                      name="observaciones"
                      rows={2}
                      disabled
                      placeholder="Campo no disponible por el momento"
                      className="w-full border border-gray-200 rounded-md px-2.5 py-2 text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
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
                ? 'mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'
                : 'mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
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

        <div className="sticky bottom-0 bg-gray-50/95 border-t border-gray-200 py-3 mt-3">
          <button
            type="submit"
            disabled={guardando}
            className="w-full sm:w-auto sm:min-w-52 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-6 py-2.5 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : `Guardar ${tipo}`}
          </button>
        </div>

      </form>
    </main>
  )
}
