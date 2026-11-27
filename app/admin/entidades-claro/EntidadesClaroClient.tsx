'use client'

import { useMemo, useState } from 'react'
import NuevaEntidadClaro, { type UsuarioDisponible } from './NuevaEntidadClaro'
import BajaReactivarEntidad from './BajaReactivarEntidad'

type Codigo = {
  id: string
  tipo_codigo: string
  codigo: string
  activo: boolean
  vigente_desde: string | null
  vigente_hasta: string | null
}

type Entidad = {
  id: string
  nombre: string
  tipo: string
  dni: string | null
  activo: boolean
  profile_id: string | null
  punto_venta_id: string | null
  asesor_pdv_id: string | null
  usuario_pgl: string
  punto_venta_nombre: string
  fecha_alta: string | null
  fecha_baja: string | null
  observaciones: string | null
  entidades_claro_codigos: Codigo[]
}

export default function EntidadesClaroClient({
  entidades,
  usuarios,
  usuariosEdicion,
}: {
  entidades: Entidad[]
  usuarios: UsuarioDisponible[]
  usuariosEdicion: (UsuarioDisponible & { activo: boolean })[]
}) {
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState('TODOS')
  const [estado, setEstado] = useState('TODOS')
  const [vinculo, setVinculo] = useState('TODOS')

  const normalizar = (valor: string) =>
    valor.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()

  const clasificarVista = (e: Entidad) => {
    if (e.tipo === 'PDV') {
      return e.asesor_pdv_id ? 'ASESORES_PDV' : 'PDV'
    }
    return e.tipo
  }

  const vistas = [
    { valor: 'TODOS', nombre: 'Todos' },
    { valor: 'PDV', nombre: 'PDV' },
    { valor: 'ASESORES_PDV', nombre: 'Asesores PDV' },
    { valor: 'CALL', nombre: 'CALL' },
    { valor: 'TERRENO', nombre: 'TERRENO' },
    { valor: 'BBOO', nombre: 'BBOO' },
    { valor: 'AGENCIA', nombre: 'AGENCIA' },
  ]

  const filtradas = useMemo(() => {
    const texto = normalizar(buscar)

    return entidades.filter(e => {
      if (tipo !== 'TODOS' && clasificarVista(e) !== tipo) return false
      if (estado === 'ACTIVOS' && !e.activo) return false
      if (estado === 'INACTIVOS' && e.activo) return false
      if (vinculo === 'CON_PGL' && !e.profile_id) return false
      if (vinculo === 'SIN_PGL' && e.profile_id) return false

      const contenido = [
        e.nombre,
        e.dni ?? '',
        e.usuario_pgl,
        e.punto_venta_nombre,
        ...e.entidades_claro_codigos.map(c => c.codigo)
      ].join(' ')

      return normalizar(contenido).includes(texto)
    })
  }, [entidades, buscar, tipo, estado, vinculo])

  const totalCodigos = entidades.reduce(
    (total, e) => total + e.entidades_claro_codigos.length, 0
  )

  const indicadores = [
    ['Titulares', entidades.length],
    ['Códigos Claro', totalCodigos],
    ['Activos', entidades.filter(e => e.activo).length],
    ['Inactivos', entidades.filter(e => !e.activo).length],
    ['Vinculados a PGL', entidades.filter(e => e.profile_id).length],
  ] as const

  const campo = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white'

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-red-600">
          ← Volver a Administración
        </a>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">
          Entidades Claro
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Maestro de titulares y códigos comerciales.
        </p>
        </div>

        <NuevaEntidadClaro usuarios={usuarios} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {indicadores.map(([titulo, valor]) => (
          <div key={titulo} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500">{titulo}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {valor}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex flex-wrap gap-2">
          {vistas.map(v => {
            const cantidad = v.valor === 'TODOS'
              ? entidades.length
              : entidades.filter(e => clasificarVista(e) === v.valor).length

            const seleccionada = tipo === v.valor

            return (
              <button
                key={v.valor}
                type="button"
                aria-pressed={seleccionada}
                onClick={() => setTipo(v.valor)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  seleccionada
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {v.nombre}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  seleccionada
                    ? 'bg-white/20 text-white'
                    : 'bg-white text-gray-600'
                }`}>
                  {cantidad}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className={`${campo} md:col-span-2`}
            placeholder="Buscar nombre, entidad, DNI o usuario..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
          />



          <select className={campo} value={estado}
            onChange={e => setEstado(e.target.value)}>
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>

          <select className={campo} value={vinculo}
            onChange={e => setVinculo(e.target.value)}>
            <option value="TODOS">Todos los vínculos</option>
            <option value="CON_PGL">Con usuario PGL</option>
            <option value="SIN_PGL">Sin usuario PGL</option>
          </select>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Mostrando {filtradas.length} de {entidades.length} titulares
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-100 text-xs text-gray-600">
            <tr>
              {['Titular', 'Tipo', 'DNI', 'Códigos Claro', 'Usuario PGL', 'Estado', 'Acciones'].map(t => (
                <th key={t} className="px-4 py-3 whitespace-nowrap">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{e.nombre}</div>
                  {e.asesor_pdv_id ? (
                    <div className="text-xs text-gray-500">
                      {e.punto_venta_nombre || 'Asesor PDV'}
                    </div>
                  ) : e.punto_venta_id ? (
                    <div className="text-xs text-gray-500">Punto de Venta</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{e.tipo}</td>
                <td className="px-4 py-3">{e.dni || '—'}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {e.entidades_claro_codigos.map(c => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {c.tipo_codigo}
                        </span>
                        <span className={`font-mono ${c.activo ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {c.codigo}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{e.usuario_pgl || '—'}</td>
                <td className="px-4 py-3">
                  <span className={e.activo ? 'text-green-700' : 'text-gray-500'}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {e.tipo !== 'PDV' &&
                   !e.punto_venta_id &&
                   !e.asesor_pdv_id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <NuevaEntidadClaro
                        entidad={e}
                        usuarios={usuariosEdicion.filter(u =>
                          u.id === e.profile_id ||
                          usuarios.some(disponible => disponible.id === u.id)
                        )}
                      />
                      <BajaReactivarEntidad
                        entidad={{
                          id: e.id,
                          nombre: e.nombre,
                          activo: e.activo,
                          fecha_alta: e.fecha_alta,
                          fecha_baja: e.fecha_baja,
                          codigos: e.entidades_claro_codigos.map(c => ({
                            id: c.id,
                            tipo_codigo: c.tipo_codigo,
                            codigo: c.codigo,
                            activo: c.activo,
                            vigente_hasta: c.vigente_hasta,
                          }))
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      Solo lectura
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No se encontraron entidades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
