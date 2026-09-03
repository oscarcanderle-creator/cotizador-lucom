'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Catalogo = { id: number; codigo: string; nombre: string; activo: boolean; tipo_estado?: string }
type Consulta = {
  id: number; marca_temporal: string; vendedor_id: string; responsable_id: string | null;
  cliente: string | null; dni: string | null; telefono: string; observaciones: string | null;
  estado_consulta_id: number | null; fecha_estado: string | null
}
type Historial = {
  id: number; evento: string; campo: string | null; valor_anterior: string | null;
  valor_nuevo: string | null; actor_nombre: string | null; actor_rol: string; created_at: string
}
type HistorialEstado = {
  id: number; estado_anterior_nombre: string | null; estado_nuevo_nombre: string;
  tipo_estado_nuevo: string; observacion: string | null; actor_nombre: string | null;
  actor_rol: string; created_at: string
}

export default function TestConsultasPage() {
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [usuario, setUsuario] = useState('')
  const [tipos, setTipos] = useState<Catalogo[]>([])
  const [estados, setEstados] = useState<Catalogo[]>([])
  const [consultaId, setConsultaId] = useState<number | null>(null)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [historial, setHistorial] = useState<Historial[]>([])
  const [historialEstados, setHistorialEstados] = useState<HistorialEstado[]>([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const limpiar = () => { setMensaje(''); setError('') }

  const cargarConsulta = async (id: number) => {
    const r = await supabase.from('consultas').select('*').eq('id', id).single()
    if (r.error) return setError(r.error.message)
    setConsulta(r.data)
  }

  const cargarHistorial = async (id: number) => {
    const g = await supabase.from('historial_consultas')
      .select('id,evento,campo,valor_anterior,valor_nuevo,actor_nombre,actor_rol,created_at')
      .eq('consulta_id', id).order('id')
    if (g.error) return setError(g.error.message)
    setHistorial(g.data || [])

    const e = await supabase.from('historial_estados_consultas')
      .select('id,estado_anterior_nombre,estado_nuevo_nombre,tipo_estado_nuevo,observacion,actor_nombre,actor_rol,created_at')
      .eq('consulta_id', id).order('id')
    if (e.error) return setError(e.error.message)
    setHistorialEstados(e.data || [])
  }

  useEffect(() => {
    ;(async () => {
      const u = await supabase.auth.getUser()
      if (u.error || !u.data.user) return setError('No hay una sesión autenticada.')
      setUserId(u.data.user.id)

      const p = await supabase.from('profiles')
        .select('nombre,vendedor,rol,puede_gestionar_ventas')
        .eq('id', u.data.user.id).single()
      if (p.error) return setError(p.error.message)
      setUsuario(`${p.data.nombre || p.data.vendedor || u.data.user.email} | Rol: ${p.data.rol} | Gestiona ventas: ${p.data.puede_gestionar_ventas ? 'SI' : 'NO'}`)

      const t = await supabase.from('tipos_consulta').select('id,codigo,nombre,activo').eq('activo', true).order('orden')
      if (t.error) return setError(t.error.message)
      setTipos(t.data || [])

      const e = await supabase.from('estados_consulta').select('id,codigo,nombre,tipo_estado,activo').eq('activo', true).order('orden')
      if (e.error) return setError(e.error.message)
      setEstados(e.data || [])
    })()
  }, [supabase])

  const crearConsulta = async () => {
    limpiar()
    if (!userId) return setError('No hay usuario autenticado.')
    const tipo = tipos.find(x => x.codigo === 'DEUDA_CLIENTE')
    if (!tipo) return setError('No encontré el tipo DEUDA_CLIENTE.')

    const r = await supabase.from('consultas').insert({
      tipo_consulta_id: tipo.id,
      vendedor_id: userId,
      cliente: 'PRUEBA DESDE APP',
      dni: '99999999',
      telefono: '3815555555',
      observaciones: 'Consulta creada desde /test-consultas',
    }).select().single()

    if (r.error) return setError(r.error.message)
    setConsultaId(r.data.id)
    setConsulta(r.data)
    setMensaje(`Consulta creada correctamente. ID: ${r.data.id}`)
    await cargarHistorial(r.data.id)
  }

  const tomarConsulta = async () => {
    limpiar()
    if (!consultaId) return setError('Primero creá una Consulta.')
    const r = await supabase.rpc('tomar_consulta', { p_consulta_id: consultaId })
    if (r.error) return setError(r.error.message)
    setMensaje(`Consulta tomada correctamente. Responsable: ${r.data?.[0]?.responsable_id || 'OK'}`)
    await cargarConsulta(consultaId); await cargarHistorial(consultaId)
  }

  const modificarObservacion = async () => {
    limpiar()
    if (!consultaId) return setError('Primero creá una Consulta.')
    const r = await supabase.rpc('gestionar_consulta', {
      p_consulta_id: consultaId,
      p_observaciones: 'Observación modificada desde la sesión autenticada de la aplicación',
      p_estado_consulta_id: consulta?.estado_consulta_id ?? null,
    })
    if (r.error) return setError(r.error.message)
    setMensaje('Observaciones modificadas correctamente.')
    await cargarConsulta(consultaId); await cargarHistorial(consultaId)
  }

  const pasarClienteOk = async () => {
    limpiar()
    if (!consultaId) return setError('Primero creá una Consulta.')
    const estado = estados.find(x => x.codigo === 'CLIENTE_OK')
    if (!estado) return setError('No encontré el Estado CLIENTE_OK.')
    const r = await supabase.rpc('gestionar_consulta', {
      p_consulta_id: consultaId,
      p_observaciones: 'Cliente verificado correctamente desde página de prueba',
      p_estado_consulta_id: estado.id,
    })
    if (r.error) return setError(r.error.message)
    setMensaje('Estado cambiado a CLIENTE OK.')
    await cargarConsulta(consultaId); await cargarHistorial(consultaId)
  }

  const refrescar = async () => {
    limpiar()
    if (!consultaId) return setError('Todavía no hay una Consulta seleccionada.')
    await cargarConsulta(consultaId); await cargarHistorial(consultaId)
    setMensaje('Datos actualizados.')
  }

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Test Consultas</h1>
      <p>Esta página es únicamente para probar permisos, RPC y auditoría del nuevo módulo.</p>

      <div style={{ padding: 16, border: '1px solid #ccc', borderRadius: 8, marginBottom: 20 }}>
        <strong>Usuario autenticado</strong>
        <div style={{ marginTop: 8 }}>{usuario || 'Cargando...'}</div>
      </div>

      {mensaje && <div style={{ padding: 12, background: '#e7f7ea', marginBottom: 16 }}>{mensaje}</div>}
      {error && <div style={{ padding: 12, background: '#fde8e8', marginBottom: 16 }}><strong>Error:</strong> {error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 30 }}>
        <button onClick={crearConsulta}>1. Crear Consulta</button>
        <button onClick={tomarConsulta} disabled={!consultaId}>2. Tomar Consulta</button>
        <button onClick={modificarObservacion} disabled={!consultaId}>3. Modificar Observación</button>
        <button onClick={pasarClienteOk} disabled={!consultaId}>4. Pasar a CLIENTE OK</button>
        <button onClick={refrescar} disabled={!consultaId}>Refrescar</button>
      </div>

      <h2>Consulta actual</h2>
      {consulta ? <pre style={{ padding: 16, background: '#f5f5f5', overflowX: 'auto' }}>{JSON.stringify(consulta, null, 2)}</pre> : <p>Sin Consulta.</p>}

      <h2>Historial general</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Evento</th><th style={th}>Campo</th><th style={th}>Anterior</th><th style={th}>Nuevo</th><th style={th}>Actor</th><th style={th}>Rol</th><th style={th}>Fecha</th></tr></thead>
          <tbody>{historial.map(x => <tr key={x.id}><td style={td}>{x.evento}</td><td style={td}>{x.campo || '-'}</td><td style={td}>{x.valor_anterior || '-'}</td><td style={td}>{x.valor_nuevo || '-'}</td><td style={td}>{x.actor_nombre || '-'}</td><td style={td}>{x.actor_rol}</td><td style={td}>{new Date(x.created_at).toLocaleString('es-AR')}</td></tr>)}</tbody>
        </table>
      </div>

      <h2>Historial de Estados</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Anterior</th><th style={th}>Nuevo</th><th style={th}>Tipo</th><th style={th}>Observación</th><th style={th}>Actor</th><th style={th}>Rol</th><th style={th}>Fecha</th></tr></thead>
          <tbody>{historialEstados.map(x => <tr key={x.id}><td style={td}>{x.estado_anterior_nombre || 'SIN ESTADO'}</td><td style={td}>{x.estado_nuevo_nombre}</td><td style={td}>{x.tipo_estado_nuevo}</td><td style={td}>{x.observacion || '-'}</td><td style={td}>{x.actor_nombre || '-'}</td><td style={td}>{x.actor_rol}</td><td style={td}>{new Date(x.created_at).toLocaleString('es-AR')}</td></tr>)}</tbody>
        </table>
      </div>
    </main>
  )
}

const th: React.CSSProperties = { border: '1px solid #ccc', padding: 8, textAlign: 'left', background: '#f0f0f0' }
const td: React.CSSProperties = { border: '1px solid #ccc', padding: 8, verticalAlign: 'top' }
