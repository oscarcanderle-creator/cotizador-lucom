'use client'

import { useState } from 'react'

type Tema = 'ejecutivo' | 'oscuro' | 'compacto'

const indicadores = [
  { titulo: 'Ventas totales', descripcion: 'Resultado comercial del período' },
  { titulo: 'CALL Lucom', descripcion: 'Ventas de los grupos CALL' },
  { titulo: 'PAC', descripcion: 'Ventas de puntos de atención' },
  { titulo: 'Cumplimiento', descripcion: 'Resultado frente al objetivo' },
]

export default function DashboardClient() {
  const [tema, setTema] = useState<Tema>('ejecutivo')
  const [periodo, setPeriodo] = useState('mes')
  const [canal, setCanal] = useState('todos')

  const oscuro = tema === 'oscuro'
  const compacto = tema === 'compacto'

  const fondo = oscuro ? 'bg-[#101827] text-white' : 'bg-gray-50 text-gray-900'
  const tarjeta = oscuro
    ? 'border-slate-700 bg-[#1b2638] text-white'
    : 'border-gray-200 bg-white text-gray-900'
  const secundario = oscuro ? 'text-slate-300' : 'text-gray-500'
  const control = oscuro
    ? 'border-slate-600 bg-slate-800 text-white'
    : 'border-gray-300 bg-white text-gray-900'

  const canales = [
    { valor: 'todos', etiqueta: 'Todos los canales' },
    { valor: 'call', etiqueta: 'CALL Lucom' },
    { valor: 'pac', etiqueta: 'PAC' },
  ]

  return (
    <section className={`${fondo} rounded-2xl p-4 sm:p-6`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Panel de resultados</h2>
          <p className={`mt-1 text-sm ${secundario}`}>
            Indicadores comerciales y evolución de ventas.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${tarjeta}`}>
          Estructura inicial
        </span>
      </div>

      <div className={`mb-6 grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4 ${tarjeta}`}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Período
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className={`rounded-lg border px-3 py-2 ${control}`}
          >
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="anterior">Mes anterior</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Canal
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className={`rounded-lg border px-3 py-2 ${control}`}
          >
            {canales.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Grupo / Punto de venta
          <select
            disabled
            className={`rounded-lg border px-3 py-2 opacity-60 ${control}`}
          >
            <option>Disponible al conectar datos</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tema visual
          <select
            value={tema}
            onChange={(e) => setTema(e.target.value as Tema)}
            className={`rounded-lg border px-3 py-2 ${control}`}
          >
            <option value="ejecutivo">Ejecutivo</option>
            <option value="oscuro">Oscuro</option>
            <option value="compacto">Compacto</option>
          </select>
        </label>
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${compacto ? 'mb-4' : 'mb-6'}`}>
        {indicadores.map((indicador) => (
          <div
            key={indicador.titulo}
            className={`rounded-xl border ${compacto ? 'p-3' : 'p-5'} ${tarjeta}`}
          >
            <div className={`text-sm font-semibold ${secundario}`}>
              {indicador.titulo}
            </div>
            <div className={`font-bold ${compacto ? 'my-2 text-3xl' : 'my-4 text-4xl'}`}>
              —
            </div>
            <p className={`text-xs ${secundario}`}>
              {indicador.descripcion}
            </p>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-1 gap-4 lg:grid-cols-3 ${compacto ? 'mb-4' : 'mb-6'}`}>
        <div className={`rounded-xl border p-5 lg:col-span-2 ${tarjeta}`}>
          <h3 className="font-bold">Evolución de ventas</h3>
          <div className={`mt-4 flex ${compacto ? 'h-40' : 'h-64'} items-center justify-center rounded-lg border border-dashed ${oscuro ? 'border-slate-600' : 'border-gray-200'}`}>
            <span className={`text-sm ${secundario}`}>
              Gráfico pendiente de conexión
            </span>
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${tarjeta}`}>
          <h3 className="font-bold">Distribución por canal</h3>
          <div className={`mt-4 flex ${compacto ? 'h-40' : 'h-64'} items-center justify-center rounded-lg border border-dashed ${oscuro ? 'border-slate-600' : 'border-gray-200'}`}>
            <span className={`text-center text-sm ${secundario}`}>
              Distribución pendiente de conexión
            </span>
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${tarjeta}`}>
        <h3 className="font-bold">Análisis detallado</h3>
        <p className={`mt-2 text-sm ${secundario}`}>
          Aquí incorporaremos la navegación desde los resultados generales
          de la agencia hasta cada canal, grupo, punto de venta y vendedor.
        </p>
        <div className={`mt-4 rounded-lg border border-dashed p-5 text-center text-sm ${oscuro ? 'border-slate-600' : 'border-gray-200'} ${secundario}`}>
          Información pendiente de conexión
        </div>
      </div>

      <p className={`mt-4 text-xs ${secundario}`}>
        Los filtros son visuales en esta etapa. Todavía no se consultan
        ni calculan resultados comerciales.
      </p>
    </section>
  )
}
