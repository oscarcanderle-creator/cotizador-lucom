'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

type TipoConsulta = {
  id: number
  codigo: string
  nombre: string
}

type TipoPedido = {
  id: number
  codigo: string
  nombre: string
}

type EstadoCatalogo = {
  id: number
  codigo: string
  nombre: string
  tipo_estado: 'GESTIONADO' | 'NO_GESTIONADO'
  activo: boolean
  ambito: 'DEUDA' | 'COBERTURA' | null
  tipo_pedido_id?: number | null
}

type Consulta = {
  id: number
  marca_temporal: string
  vendedor_id: string
  cliente: string | null
  dni: string | null
  telefono: string
  tipo_domicilio: string | null
  domicilio: string | null
  entrecalles: string | null
  localidad: string | null
  observaciones: string | null
  responsable_id: string | null
  estado_consulta_id: number | null
  estado_deuda_id: number | null
  estado_cobertura_id: number | null
  fecha_estado: string | null
  tipos_consulta: { nombre: string; codigo: string } | null
}

type Pedido = {
  id: number
  codigo: string | null
  marca_temporal: string
  vendedor_id: string
  tipo_pedido_id: number
  dni: string | null
  telefono: string
  domicilio: string | null
  tipo_domicilio: string | null
  nombre_edificio: string | null
  cant_unidades_f: string | null
  cant_pisos: string | null
  cant_torres: string | null
  administrador: string | null
  telefono_adm: string | null
  correo_adm: string | null
  encargado: string | null
  telefono_enc: string | null
  correo_enc: string | null
  observaciones_vendedor: string | null
  permisos_acceso: string | null
  planos: string | null
  cant_preventas: string | null
  wo: string | null
  observaciones_gestion: string | null
  fecha_ok: string | null
  fecha_gestion: string | null
  responsable_id: string | null
  estado_pedido_id: number | null
  tipos_pedido: { nombre: string; codigo: string } | null
  estados_pedido: { id: number; nombre: string; tipo_estado: string } | null
}

type Props = {
  userId: string
  rol: string
  puedeGestionarVentas: boolean
}

type TipoRegistro = 'CONSULTA' | 'PEDIDO'
type VistaListado = 'CONSULTAS' | 'PEDIDOS'
type FiltroGestion = 'PENDIENTES' | 'MIAS' | 'TODAS'

const TIPOS_DOMICILIO = [
  ['CASA', 'Casa'],
  ['EDIFICIO', 'Edificio'],
  ['BARRIO_CERRADO', 'Barrio Cerrado'],
  ['BARRIO_ABIERTO', 'Barrio Abierto'],
] as const

const ETIQUETAS_CONSULTA: Record<string, string> = {
  DEUDA_CLIENTE: 'Deuda (Cliente)',
  DOMICILIO_COBERTURA: 'Cobertura BAF (domicilio)',
  DOMICILIO_DEUDA: 'Deuda y Cobertura',
}

const ETIQUETAS_PEDIDO: Record<string, string> = {
  ACOMETIDA: 'Acometida',
  PROYECTO: 'Proyecto',
  AMPLIACION: 'Ampliación',
  RELLAMADO_VENTA_GESTION: 'Rellamado Venta en Gestión',
}

export default function MisConsultasClient({ userId, rol, puedeGestionarVentas }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const esAdmin = rol === 'ADMIN'

  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistro>('CONSULTA')
  const [vistaListado, setVistaListado] = useState<VistaListado>('CONSULTAS')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [tiposConsulta, setTiposConsulta] = useState<TipoConsulta[]>([])
  const [tiposPedido, setTiposPedido] = useState<TipoPedido[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [consultasGestion, setConsultasGestion] = useState<Consulta[]>([])
  const [pedidosGestion, setPedidosGestion] = useState<Pedido[]>([])
  const [vistaGestion, setVistaGestion] = useState<VistaListado>('CONSULTAS')
  const [filtroGestion, setFiltroGestion] = useState<FiltroGestion>('PENDIENTES')
  const [tomandoId, setTomandoId] = useState<number | null>(null)

  const [estadosConsulta, setEstadosConsulta] = useState<EstadoCatalogo[]>([])
  const [estadosPedido, setEstadosPedido] = useState<EstadoCatalogo[]>([])
  const [gestionAbierta, setGestionAbierta] = useState<{ tipo: VistaListado; id: number } | null>(null)
  const [consultaEdit, setConsultaEdit] = useState<Consulta | null>(null)
  const [pedidoEdit, setPedidoEdit] = useState<Pedido | null>(null)
  const [guardandoGestion, setGuardandoGestion] = useState(false)

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const [tipoConsultaId, setTipoConsultaId] = useState('')
  const [cliente, setCliente] = useState('')
  const [dni, setDni] = useState('')
  const [telefonoConsulta, setTelefonoConsulta] = useState('')
  const [tipoDomicilioConsulta, setTipoDomicilioConsulta] = useState('')
  const [domicilioConsulta, setDomicilioConsulta] = useState('')
  const [entrecalles, setEntrecalles] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [observacionesConsulta, setObservacionesConsulta] = useState('')

  const [tipoPedidoId, setTipoPedidoId] = useState('')
  const [dniPedido, setDniPedido] = useState('')
  const [telefonoPedido, setTelefonoPedido] = useState('')
  const [domicilioPedido, setDomicilioPedido] = useState('')
  const [tipoDomicilioPedido, setTipoDomicilioPedido] = useState('')
  const [nombreEdificio, setNombreEdificio] = useState('')
  const [cantUnidades, setCantUnidades] = useState('')
  const [cantPisos, setCantPisos] = useState('')
  const [cantTorres, setCantTorres] = useState('')
  const [administrador, setAdministrador] = useState('')
  const [telefonoAdm, setTelefonoAdm] = useState('')
  const [correoAdm, setCorreoAdm] = useState('')
  const [encargado, setEncargado] = useState('')
  const [telefonoEnc, setTelefonoEnc] = useState('')
  const [correoEnc, setCorreoEnc] = useState('')
  const [observacionesPedido, setObservacionesPedido] = useState('')
  const [permisosAcceso, setPermisosAcceso] = useState('')
  const [planos, setPlanos] = useState('')
  const [cantPreventas, setCantPreventas] = useState('')

  const validarTelefono = (valor: string) => /^[1-46-9][0-9]{9}$/.test(valor)
  const validarTelefonoOpcional = (valor: string) => !valor || validarTelefono(valor)
  const normalizar = (valor: string) => valor.trim() || null

  const estadoCorrespondeAPedido = (estado: EstadoCatalogo, pedido: Pedido) => {
    const coincidePorTipoId =
      estado.tipo_pedido_id != null &&
      pedido.tipo_pedido_id != null &&
      Number(estado.tipo_pedido_id) === Number(pedido.tipo_pedido_id)

    const prefijoPorTipo: Record<string, string> = {
      ACOMETIDA: 'ACOM_',
      PROYECTO: 'PROY_',
      AMPLIACION: 'AMPL_',
      RELLAMADO_VENTA_GESTION: 'REL_',
    }

    const codigoTipo = pedido.tipos_pedido?.codigo || ''
    const prefijoEsperado = prefijoPorTipo[codigoTipo] || ''
    const coincidePorCodigo =
      !!prefijoEsperado && estado.codigo.startsWith(prefijoEsperado)

    return coincidePorTipoId || coincidePorCodigo
  }

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError('')

    const [tc, tp, ec, ep, cPropias, pPropios] = await Promise.all([
      supabase
        .from('tipos_consulta')
        .select('id,codigo,nombre')
        .eq('activo', true)
        .order('orden'),
      supabase
        .from('tipos_pedido')
        .select('id,codigo,nombre')
        .eq('activo', true)
        .order('orden'),
      supabase
        .from('estados_consulta')
        .select('id,codigo,nombre,tipo_estado,activo,ambito')
        .order('orden'),
      supabase
        .from('estados_pedido')
        .select('id,codigo,nombre,tipo_estado,activo,tipo_pedido_id')
        .order('orden'),
      supabase
        .from('consultas')
        .select(`
          id,
          marca_temporal,
          vendedor_id,
          cliente,
          dni,
          telefono,
          tipo_domicilio,
          domicilio,
          entrecalles,
          localidad,
          observaciones,
          responsable_id,
          estado_consulta_id,
          estado_deuda_id,
          estado_cobertura_id,
          fecha_estado,
          tipos_consulta(nombre,codigo)
        `)
        .eq('vendedor_id', userId)
        .order('marca_temporal', { ascending: false }),
      supabase
        .from('pedidos')
        .select(`
          id,
          codigo,
          marca_temporal,
          vendedor_id,
          tipo_pedido_id,
          dni,
          telefono,
          domicilio,
          tipo_domicilio,
          nombre_edificio,
          cant_unidades_f,
          cant_pisos,
          cant_torres,
          administrador,
          telefono_adm,
          correo_adm,
          encargado,
          telefono_enc,
          correo_enc,
          observaciones_vendedor,
          permisos_acceso,
          planos,
          cant_preventas,
          wo,
          observaciones_gestion,
          fecha_ok,
          fecha_gestion,
          responsable_id,
          estado_pedido_id,
          tipos_pedido(nombre,codigo),
          estados_pedido(id,nombre,tipo_estado)
        `)
        .eq('vendedor_id', userId)
        .order('marca_temporal', { ascending: false }),
    ])

    // Cargamos los catálogos de forma independiente de los listados.
    const errorCatalogo = tc.error || tp.error || ec.error || ep.error
    if (errorCatalogo) {
      setError(errorCatalogo.message)
      setCargando(false)
      return
    }

    setTiposConsulta(tc.data || [])
    setTiposPedido(tp.data || [])
    setEstadosConsulta((ec.data || []) as EstadoCatalogo[])
    setEstadosPedido((ep.data || []) as EstadoCatalogo[])

    const errorPropios = cPropias.error || pPropios.error
    if (errorPropios) {
      setError(errorPropios.message)
      setCargando(false)
      return
    }

    setConsultas((cPropias.data || []) as unknown as Consulta[])
    setPedidos((pPropios.data || []) as unknown as Pedido[])

    if (puedeGestionarVentas || esAdmin) {
      const [cTodas, pTodos] = await Promise.all([
        supabase
          .from('consultas')
          .select(`
            id,
            marca_temporal,
            vendedor_id,
            cliente,
            dni,
            telefono,
            tipo_domicilio,
            domicilio,
            entrecalles,
            localidad,
            observaciones,
            responsable_id,
            estado_consulta_id,
            estado_deuda_id,
            estado_cobertura_id,
            fecha_estado,
            tipos_consulta(nombre,codigo)
          `)
          .order('marca_temporal', { ascending: false }),
        supabase
          .from('pedidos')
          .select(`
            id,
            codigo,
            marca_temporal,
            vendedor_id,
            tipo_pedido_id,
            dni,
            telefono,
            domicilio,
            tipo_domicilio,
            nombre_edificio,
            cant_unidades_f,
            cant_pisos,
            cant_torres,
            administrador,
            telefono_adm,
            correo_adm,
            encargado,
            telefono_enc,
            correo_enc,
            observaciones_vendedor,
            permisos_acceso,
            planos,
            cant_preventas,
            wo,
            observaciones_gestion,
            fecha_ok,
            fecha_gestion,
            responsable_id,
            estado_pedido_id,
            tipos_pedido(nombre,codigo),
            estados_pedido(id,nombre,tipo_estado)
          `)
          .order('marca_temporal', { ascending: false }),
      ])

      const errorGestion = cTodas.error || pTodos.error
      if (errorGestion) {
        setError(errorGestion.message)
        setCargando(false)
        return
      }

      setConsultasGestion((cTodas.data || []) as unknown as Consulta[])
      setPedidosGestion((pTodos.data || []) as unknown as Pedido[])

      // ADMIN debe poder ver todos los registros aunque no tenga
      // puede_gestionar_ventas. Esto amplía solo la visibilidad del listado
      // principal; la sección operativa de gestión sigue dependiendo del permiso.
      if (esAdmin) {
        setConsultas((cTodas.data || []) as unknown as Consulta[])
        setPedidos((pTodos.data || []) as unknown as Pedido[])
      }

      // Si había un formulario de gestión abierto, refrescamos sus datos
      // sin cerrarlo.
      if (gestionAbierta?.tipo === 'CONSULTAS') {
        const actualizada = (cTodas.data || []).find(
          (x: any) => x.id === gestionAbierta.id
        )
        if (actualizada) setConsultaEdit(actualizada as unknown as Consulta)
      }

      if (gestionAbierta?.tipo === 'PEDIDOS') {
        const actualizado = (pTodos.data || []).find(
          (x: any) => x.id === gestionAbierta.id
        )
        if (actualizado) setPedidoEdit(actualizado as unknown as Pedido)
      }
    } else {
      setConsultasGestion([])
      setPedidosGestion([])
    }

    setCargando(false)
  }, [supabase, userId, puedeGestionarVentas, esAdmin, gestionAbierta])

  useEffect(() => {
    void cargarDatos()
    // La carga inicial debe ejecutarse al montar/cambiar de usuario.
    // gestionAbierta se refresca manualmente después de guardar o tomar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, puedeGestionarVentas, esAdmin])

  function limpiarConsulta() {
    setTipoConsultaId('')
    setCliente('')
    setDni('')
    setTelefonoConsulta('')
    setTipoDomicilioConsulta('')
    setDomicilioConsulta('')
    setEntrecalles('')
    setLocalidad('')
    setObservacionesConsulta('')
  }

  function limpiarPedido() {
    setTipoPedidoId('')
    setDniPedido('')
    setTelefonoPedido('')
    setDomicilioPedido('')
    setTipoDomicilioPedido('')
    setNombreEdificio('')
    setCantUnidades('')
    setCantPisos('')
    setCantTorres('')
    setAdministrador('')
    setTelefonoAdm('')
    setCorreoAdm('')
    setEncargado('')
    setTelefonoEnc('')
    setCorreoEnc('')
    setObservacionesPedido('')
    setPermisosAcceso('')
    setPlanos('')
    setCantPreventas('')
  }

  async function guardarConsulta(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (!tipoConsultaId) return setError('Seleccioná el tipo de Consulta.')
    if (!validarTelefono(telefonoConsulta)) {
      return setError('El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.')
    }

    setGuardando(true)

    const { error: insertError } = await supabase.from('consultas').insert({
      tipo_consulta_id: Number(tipoConsultaId),
      vendedor_id: userId,
      cliente: normalizar(cliente),
      dni: normalizar(dni),
      telefono: telefonoConsulta,
      tipo_domicilio: normalizar(tipoDomicilioConsulta),
      domicilio: normalizar(domicilioConsulta),
      entrecalles: normalizar(entrecalles),
      localidad: normalizar(localidad),
      observaciones: normalizar(observacionesConsulta),
    })

    setGuardando(false)

    if (insertError) return setError(insertError.message)

    limpiarConsulta()
    setMostrarFormulario(false)
    setMensaje('Consulta registrada correctamente.')
    setVistaListado('CONSULTAS')
    await cargarDatos()
  }

  const pedidoSeleccionado = tiposPedido.find(
    (x) => String(x.id) === tipoPedidoId
  )

  const esRellamado =
    pedidoSeleccionado?.codigo === 'RELLAMADO_VENTA_GESTION'

  async function guardarPedido(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (!tipoPedidoId) return setError('Seleccioná el tipo de Pedido.')
    if (!validarTelefono(telefonoPedido)) {
      return setError('El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.')
    }
    if (
      !esRellamado &&
      (!validarTelefonoOpcional(telefonoAdm) || !validarTelefonoOpcional(telefonoEnc))
    ) {
      return setError(
        'Los teléfonos de Administrador y Encargado, si se informan, deben tener 10 dígitos y no comenzar con 0 ni 5.'
      )
    }

    setGuardando(true)

    const datosPedido = {
      vendedor_id: userId,
      tipo_pedido_id: Number(tipoPedidoId),
      dni: esRellamado ? normalizar(dniPedido) : null,
      telefono: telefonoPedido,
      domicilio: esRellamado ? null : normalizar(domicilioPedido),
      tipo_domicilio: esRellamado ? null : normalizar(tipoDomicilioPedido),
      nombre_edificio: esRellamado ? null : normalizar(nombreEdificio),
      cant_unidades_f: esRellamado ? null : normalizar(cantUnidades),
      cant_pisos: esRellamado ? null : normalizar(cantPisos),
      cant_torres: esRellamado ? null : normalizar(cantTorres),
      administrador: esRellamado ? null : normalizar(administrador),
      telefono_adm: esRellamado ? null : normalizar(telefonoAdm),
      correo_adm: esRellamado ? null : normalizar(correoAdm),
      encargado: esRellamado ? null : normalizar(encargado),
      telefono_enc: esRellamado ? null : normalizar(telefonoEnc),
      correo_enc: esRellamado ? null : normalizar(correoEnc),
      observaciones_vendedor: normalizar(observacionesPedido),
      permisos_acceso: esRellamado ? null : normalizar(permisosAcceso),
      planos: esRellamado ? null : normalizar(planos),
      cant_preventas: esRellamado ? null : normalizar(cantPreventas),
    }

    const { error: insertError } = await supabase
      .from('pedidos')
      .insert(datosPedido)

    setGuardando(false)

    if (insertError) return setError(insertError.message)

    limpiarPedido()
    setMostrarFormulario(false)
    setMensaje('Pedido registrado correctamente.')
    setVistaListado('PEDIDOS')
    await cargarDatos()
  }

  function abrirGestionConsulta(x: Consulta) {
    setError('')
    setMensaje('')
    setVistaGestion('CONSULTAS')
    setVistaListado('CONSULTAS')
    setGestionAbierta({ tipo: 'CONSULTAS', id: x.id })

    const consultaPreparada: Consulta = {
      ...x,
      estado_deuda_id:
        x.estado_deuda_id ??
        (['DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
          x.tipos_consulta?.codigo || ''
        )
          ? x.estado_consulta_id
          : null),
    }

    setConsultaEdit(consultaPreparada)
    setPedidoEdit(null)
  }

  function abrirGestionPedido(x: Pedido) {
    setError('')
    setMensaje('')
    setVistaGestion('PEDIDOS')
    setVistaListado('PEDIDOS')
    setGestionAbierta({ tipo: 'PEDIDOS', id: x.id })
    setPedidoEdit({ ...x })
    setConsultaEdit(null)
  }

  function cerrarGestion() {
    setGestionAbierta(null)
    setConsultaEdit(null)
    setPedidoEdit(null)
  }

  async function tomarConsulta(x: Consulta) {
    setError('')
    setMensaje('')
    setTomandoId(x.id)

    const { error: rpcError } = await supabase.rpc('tomar_consulta', {
      p_consulta_id: x.id,
    })

    setTomandoId(null)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const tomada = { ...x, responsable_id: userId }
    setConsultasGestion((actuales) =>
      actuales.map((item) => (item.id === x.id ? tomada : item))
    )
    setFiltroGestion('MIAS')
    abrirGestionConsulta(tomada)
    setMensaje(`Consulta #${x.id} asignada. Ya podés gestionarla.`)
  }

  async function tomarPedido(x: Pedido) {
    setError('')
    setMensaje('')
    setTomandoId(x.id)

    const { error: rpcError } = await supabase.rpc('tomar_pedido', {
      p_pedido_id: x.id,
    })

    setTomandoId(null)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const tomado = { ...x, responsable_id: userId }
    setPedidosGestion((actuales) =>
      actuales.map((item) => (item.id === x.id ? tomado : item))
    )
    setFiltroGestion('MIAS')
    abrirGestionPedido(tomado)
    setMensaje(`Pedido #${x.id} asignado. Ya podés gestionarlo.`)
  }

  async function guardarGestionConsulta(e: React.FormEvent) {
    e.preventDefault()
    if (!consultaEdit) return

    setError('')
    setMensaje('')

    if (!validarTelefono(consultaEdit.telefono)) {
      setError('El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.')
      return
    }

    setGuardandoGestion(true)

    const { error: rpcError } = await supabase.rpc('gestionar_consulta_completa', {
      p_consulta_id: consultaEdit.id,
      p_cliente: normalizar(consultaEdit.cliente || ''),
      p_dni: normalizar(consultaEdit.dni || ''),
      p_telefono: consultaEdit.telefono,
      p_tipo_domicilio: normalizar(consultaEdit.tipo_domicilio || ''),
      p_domicilio: normalizar(consultaEdit.domicilio || ''),
      p_entrecalles: normalizar(consultaEdit.entrecalles || ''),
      p_localidad: normalizar(consultaEdit.localidad || ''),
      p_observaciones: normalizar(consultaEdit.observaciones || ''),
      p_estado_deuda_id: consultaEdit.estado_deuda_id,
      p_estado_cobertura_id: consultaEdit.estado_cobertura_id,
    })

    setGuardandoGestion(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setMensaje(`Gestión de Consulta #${consultaEdit.id} guardada correctamente.`)
    cerrarGestion()
    await cargarDatos()
  }

  async function guardarGestionPedido(e: React.FormEvent) {
    e.preventDefault()
    if (!pedidoEdit) return

    setError('')
    setMensaje('')

    if (!validarTelefono(pedidoEdit.telefono)) {
      setError('El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.')
      return
    }

    if (
      !validarTelefonoOpcional(pedidoEdit.telefono_adm || '') ||
      !validarTelefonoOpcional(pedidoEdit.telefono_enc || '')
    ) {
      setError(
        'Los teléfonos de Administrador y Encargado, si se informan, deben tener 10 dígitos y no comenzar con 0 ni 5.'
      )
      return
    }

    setGuardandoGestion(true)

    const { error: rpcError } = await supabase.rpc('gestionar_pedido_completo', {
      p_pedido_id: pedidoEdit.id,
      p_dni: normalizar(pedidoEdit.dni || ''),
      p_telefono: pedidoEdit.telefono,
      p_domicilio: normalizar(pedidoEdit.domicilio || ''),
      p_tipo_domicilio: normalizar(pedidoEdit.tipo_domicilio || ''),
      p_nombre_edificio: normalizar(pedidoEdit.nombre_edificio || ''),
      p_cant_unidades_f: normalizar(pedidoEdit.cant_unidades_f || ''),
      p_cant_pisos: normalizar(pedidoEdit.cant_pisos || ''),
      p_cant_torres: normalizar(pedidoEdit.cant_torres || ''),
      p_administrador: normalizar(pedidoEdit.administrador || ''),
      p_telefono_adm: normalizar(pedidoEdit.telefono_adm || ''),
      p_correo_adm: normalizar(pedidoEdit.correo_adm || ''),
      p_encargado: normalizar(pedidoEdit.encargado || ''),
      p_telefono_enc: normalizar(pedidoEdit.telefono_enc || ''),
      p_correo_enc: normalizar(pedidoEdit.correo_enc || ''),
      p_observaciones_vendedor: normalizar(pedidoEdit.observaciones_vendedor || ''),
      p_permisos_acceso: normalizar(pedidoEdit.permisos_acceso || ''),
      p_planos: normalizar(pedidoEdit.planos || ''),
      p_cant_preventas: normalizar(pedidoEdit.cant_preventas || ''),
      p_wo: normalizar(pedidoEdit.wo || ''),
      p_observaciones_gestion: normalizar(pedidoEdit.observaciones_gestion || ''),
      p_fecha_ok: pedidoEdit.fecha_ok || null,
      p_estado_pedido_id: pedidoEdit.estado_pedido_id,
    })

    setGuardandoGestion(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setMensaje(`Gestión del Pedido ${pedidoEdit.codigo || `#${pedidoEdit.id}`} guardada correctamente.`)
    cerrarGestion()
    await cargarDatos()
  }

  const consultasGestionFiltradas = consultasGestion.filter((x) => {
    if (filtroGestion === 'PENDIENTES') return !x.responsable_id
    if (filtroGestion === 'MIAS') return x.responsable_id === userId
    return true
  })

  const pedidosGestionFiltrados = pedidosGestion.filter((x) => {
    if (filtroGestion === 'PENDIENTES') return !x.responsable_id
    if (filtroGestion === 'MIAS') return x.responsable_id === userId
    return true
  })

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-red-500'
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Consultas</h1>
          <p className="mt-1 text-gray-500">
            {esAdmin
              ? 'Registrá una nueva Consulta o Pedido y consultá todos los registros ingresados.'
              : <>Registrá una nueva Consulta o Pedido y consultá los que ingresaste.{puedeGestionarVentas ? ' También podés gestionar los ingresos del equipo.' : ''}</>}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMostrarFormulario(!mostrarFormulario)
            setError('')
            setMensaje('')
          }}
          className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
        >
          {mostrarFormulario ? 'Cerrar carga' : 'Nueva Consulta / Pedido'}
        </button>
      </div>

      <div className="mt-4 text-xs text-gray-400">Rol: {rol}{puedeGestionarVentas ? ' · Gestiona Ventas: Sí' : ''}</div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {mensaje}
        </div>
      )}

      {mostrarFormulario && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6">
            <label className={labelClass}>¿Qué querés registrar?</label>
            <select
              value={tipoRegistro}
              onChange={(e) => {
                setTipoRegistro(e.target.value as TipoRegistro)
                setError('')
              }}
              className={inputClass}
            >
              <option value="CONSULTA">Consulta</option>
              <option value="PEDIDO">Pedido</option>
            </select>
          </div>

          {tipoRegistro === 'CONSULTA' ? (
            <form onSubmit={guardarConsulta} className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Nueva Consulta</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <Campo label="Tipo de Consulta *">
                  <select required value={tipoConsultaId} onChange={(e) => setTipoConsultaId(e.target.value)} className={inputClass}>
                    <option value="">Seleccionar...</option>
                    {tiposConsulta.map((x) => (
                      <option key={x.id} value={x.id}>
                        {ETIQUETAS_CONSULTA[x.codigo] || x.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo label="Teléfono *">
                  <input required inputMode="numeric" maxLength={10} value={telefonoConsulta} onChange={(e) => setTelefonoConsulta(e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} placeholder="10 dígitos" />
                </Campo>

                <Campo label="Cliente">
                  <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label="DNI">
                  <input value={dni} onChange={(e) => setDni(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label="Tipo de domicilio">
                  <select value={tipoDomicilioConsulta} onChange={(e) => setTipoDomicilioConsulta(e.target.value)} className={inputClass}>
                    <option value="">Seleccionar...</option>
                    {TIPOS_DOMICILIO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                  </select>
                </Campo>

                <Campo label="Domicilio">
                  <input value={domicilioConsulta} onChange={(e) => setDomicilioConsulta(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label="Entre calles">
                  <input value={entrecalles} onChange={(e) => setEntrecalles(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label="Localidad">
                  <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={inputClass} />
                </Campo>
              </div>

              <Campo label="Observaciones">
                <textarea rows={4} value={observacionesConsulta} onChange={(e) => setObservacionesConsulta(e.target.value)} className={inputClass} />
              </Campo>

              <button disabled={guardando} className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar Consulta'}
              </button>
            </form>
          ) : (
            <form onSubmit={guardarPedido} className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Nuevo Pedido</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <Campo label="Tipo de Pedido *">
                  <select
                    required
                    value={tipoPedidoId}
                    onChange={(e) => setTipoPedidoId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Seleccionar...</option>
                    {tiposPedido.map((x) => (
                      <option key={x.id} value={x.id}>
                        {ETIQUETAS_PEDIDO[x.codigo] || x.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>

                {esRellamado && (
                  <Campo label="DNI">
                    <input
                      value={dniPedido}
                      onChange={(e) =>
                        setDniPedido(e.target.value.replace(/\D/g, ''))
                      }
                      inputMode="numeric"
                      className={inputClass}
                      placeholder="DNI establecido en la venta"
                    />
                  </Campo>
                )}

                <Campo label="Teléfono *">
                  <input
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={telefonoPedido}
                    onChange={(e) =>
                      setTelefonoPedido(
                        e.target.value.replace(/\D/g, '').slice(0, 10)
                      )
                    }
                    className={inputClass}
                    placeholder={
                      esRellamado
                        ? 'Teléfono de la venta o alternativo'
                        : '10 dígitos'
                    }
                  />
                </Campo>

                {!esRellamado && (
                  <>
                    <Campo label="Tipo de domicilio">
                      <select
                        value={tipoDomicilioPedido}
                        onChange={(e) => setTipoDomicilioPedido(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Seleccionar...</option>
                        {TIPOS_DOMICILIO.map(([v, n]) => (
                          <option key={v} value={v}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo label="Domicilio">
                      <input
                        value={domicilioPedido}
                        onChange={(e) => setDomicilioPedido(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Nombre edificio">
                      <input
                        value={nombreEdificio}
                        onChange={(e) => setNombreEdificio(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Cant. unidades F">
                      <input
                        value={cantUnidades}
                        onChange={(e) => setCantUnidades(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Cant. pisos">
                      <input
                        value={cantPisos}
                        onChange={(e) => setCantPisos(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Cant. torres">
                      <input
                        value={cantTorres}
                        onChange={(e) => setCantTorres(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Administrador">
                      <input
                        value={administrador}
                        onChange={(e) => setAdministrador(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Teléfono administrador">
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={telefonoAdm}
                        onChange={(e) =>
                          setTelefonoAdm(
                            e.target.value.replace(/\D/g, '').slice(0, 10)
                          )
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Correo administrador">
                      <input
                        type="email"
                        value={correoAdm}
                        onChange={(e) => setCorreoAdm(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Encargado">
                      <input
                        value={encargado}
                        onChange={(e) => setEncargado(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Teléfono encargado">
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={telefonoEnc}
                        onChange={(e) =>
                          setTelefonoEnc(
                            e.target.value.replace(/\D/g, '').slice(0, 10)
                          )
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Correo encargado">
                      <input
                        type="email"
                        value={correoEnc}
                        onChange={(e) => setCorreoEnc(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Permisos de acceso">
                      <select
                        value={permisosAcceso}
                        onChange={(e) => setPermisosAcceso(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="ADM">Administrador</option>
                        <option value="ENC">Encargado</option>
                        <option value="NOREQ">No requiere</option>
                      </select>
                    </Campo>

                    <Campo label="Planos">
                      <select
                        value={planos}
                        onChange={(e) => setPlanos(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="SI">Sí</option>
                        <option value="NO">No</option>
                      </select>
                    </Campo>

                    <Campo label="Cant. preventas">
                      <input
                        value={cantPreventas}
                        onChange={(e) => setCantPreventas(e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                  </>
                )}
              </div>

              <Campo label={esRellamado ? 'Observaciones' : 'Observaciones vendedor'}>
                <textarea rows={4} value={observacionesPedido} onChange={(e) => setObservacionesPedido(e.target.value)} className={inputClass} />
              </Campo>

              <button disabled={guardando} className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar Pedido'}
              </button>
            </form>
          )}
        </section>
      )}

      {puedeGestionarVentas && (
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Gestión de Consultas y Pedidos</h2>
              <p className="mt-1 text-sm text-gray-500">
                Tomar un caso sin Responsable lo asigna a tu usuario y abre la gestión automáticamente.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              disabled={cargando}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Actualizar
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setVistaGestion('CONSULTAS')
                setVistaListado('CONSULTAS')
                cerrarGestion()
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${vistaGestion === 'CONSULTAS' ? 'bg-gray-900 text-white' : 'border bg-white text-gray-700'}`}
            >
              Consultas
            </button>
            <button
              type="button"
              onClick={() => {
                setVistaGestion('PEDIDOS')
                setVistaListado('PEDIDOS')
                cerrarGestion()
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${vistaGestion === 'PEDIDOS' ? 'bg-gray-900 text-white' : 'border bg-white text-gray-700'}`}
            >
              Pedidos
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(['PENDIENTES', 'MIAS', 'TODAS'] as FiltroGestion[]).map((filtro) => {
              const etiqueta =
                filtro === 'PENDIENTES'
                  ? 'Sin Responsable'
                  : filtro === 'MIAS'
                    ? 'Asignadas a mí'
                    : 'Todas'

              return (
                <button
                  key={filtro}
                  type="button"
                  onClick={() => {
                    setFiltroGestion(filtro)
                    cerrarGestion()
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${filtroGestion === filtro ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {etiqueta}
                </button>
              )
            })}
          </div>

          {gestionAbierta && (
            <div className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50/40 p-4 sm:p-6">
              {gestionAbierta.tipo === 'CONSULTAS' && consultaEdit && (
                <form onSubmit={guardarGestionConsulta} className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Gestionar Consulta #{consultaEdit.id}
                      </h3>
                      <div className="mt-1 text-sm text-gray-500">
                        {consultaEdit.tipos_consulta?.nombre || 'Consulta'} ·{' '}
                        {new Date(consultaEdit.marca_temporal).toLocaleString('es-AR')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={cerrarGestion}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Campo label="Cliente">
                      <input
                        value={consultaEdit.cliente || ''}
                        onChange={(e) =>
                          setConsultaEdit({ ...consultaEdit, cliente: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="DNI">
                      <input
                        value={consultaEdit.dni || ''}
                        onChange={(e) =>
                          setConsultaEdit({
                            ...consultaEdit,
                            dni: e.target.value.replace(/\D/g, ''),
                          })
                        }
                        inputMode="numeric"
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Teléfono *">
                      <input
                        required
                        inputMode="numeric"
                        maxLength={10}
                        value={consultaEdit.telefono}
                        onChange={(e) =>
                          setConsultaEdit({
                            ...consultaEdit,
                            telefono: e.target.value.replace(/\D/g, '').slice(0, 10),
                          })
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Tipo de domicilio">
                      <select
                        value={consultaEdit.tipo_domicilio || ''}
                        onChange={(e) =>
                          setConsultaEdit({
                            ...consultaEdit,
                            tipo_domicilio: e.target.value || null,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">Seleccionar...</option>
                        {TIPOS_DOMICILIO.map(([v, n]) => (
                          <option key={v} value={v}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo label="Domicilio">
                      <input
                        value={consultaEdit.domicilio || ''}
                        onChange={(e) =>
                          setConsultaEdit({ ...consultaEdit, domicilio: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Entre calles">
                      <input
                        value={consultaEdit.entrecalles || ''}
                        onChange={(e) =>
                          setConsultaEdit({ ...consultaEdit, entrecalles: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Campo>

                    <Campo label="Localidad">
                      <input
                        value={consultaEdit.localidad || ''}
                        onChange={(e) =>
                          setConsultaEdit({ ...consultaEdit, localidad: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Campo>
                  </div>

                  <Campo label="Observaciones">
                    <textarea
                      rows={4}
                      value={consultaEdit.observaciones || ''}
                      onChange={(e) =>
                        setConsultaEdit({ ...consultaEdit, observaciones: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Campo>

                  <div className="border-t border-red-100 pt-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      {['DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
                        consultaEdit.tipos_consulta?.codigo || ''
                      ) && (
                        <Campo label="Estado Deuda">
                          <select
                            value={consultaEdit.estado_deuda_id ?? ''}
                            onChange={(e) =>
                              setConsultaEdit({
                                ...consultaEdit,
                                estado_deuda_id: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="">Sin calificar</option>
                            {estadosConsulta
                              .filter(
                                (estado) =>
                                  estado.ambito === 'DEUDA' &&
                                  (estado.activo ||
                                    estado.id === consultaEdit.estado_deuda_id)
                              )
                              .map((estado) => (
                                <option key={estado.id} value={estado.id}>
                                  {estado.nombre}
                                  {!estado.activo ? ' (inactivo)' : ''}
                                </option>
                              ))}
                          </select>
                        </Campo>
                      )}

                      {['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(
                        consultaEdit.tipos_consulta?.codigo || ''
                      ) && (
                        <Campo label="Estado Cobertura">
                          <select
                            value={consultaEdit.estado_cobertura_id ?? ''}
                            onChange={(e) =>
                              setConsultaEdit({
                                ...consultaEdit,
                                estado_cobertura_id: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="">Sin calificar</option>
                            {estadosConsulta
                              .filter(
                                (estado) =>
                                  estado.ambito === 'COBERTURA' &&
                                  (estado.activo ||
                                    estado.id === consultaEdit.estado_cobertura_id)
                              )
                              .map((estado) => (
                                <option key={estado.id} value={estado.id}>
                                  {estado.nombre}
                                  {!estado.activo ? ' (inactivo)' : ''}
                                </option>
                              ))}
                          </select>
                        </Campo>
                      )}
                    </div>

                    {consultaEdit.tipos_consulta?.codigo === 'DOMICILIO_DEUDA' && (
                      <p className="mt-2 text-xs text-gray-500">
                        Deuda y Cobertura se califican de forma independiente.
                      </p>
                    )}
                  </div>

                  <button
                    disabled={guardandoGestion}
                    className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {guardandoGestion ? 'Guardando gestión...' : 'Guardar gestión'}
                  </button>
                </form>
              )}

              {gestionAbierta.tipo === 'PEDIDOS' && pedidoEdit && (
                <form onSubmit={guardarGestionPedido} className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Gestionar {pedidoEdit.codigo || `Pedido #${pedidoEdit.id}`}
                      </h3>
                      <div className="mt-1 text-sm text-gray-500">
                        {pedidoEdit.tipos_pedido?.nombre || 'Pedido'} ·{' '}
                        {new Date(pedidoEdit.marca_temporal).toLocaleString('es-AR')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={cerrarGestion}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                  </div>

                  {pedidoEdit.tipos_pedido?.codigo === 'RELLAMADO_VENTA_GESTION' ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Campo label="DNI">
                          <input
                            value={pedidoEdit.dni || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                dni: e.target.value.replace(/\D/g, ''),
                              })
                            }
                            inputMode="numeric"
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Teléfono *">
                          <input
                            required
                            inputMode="numeric"
                            maxLength={10}
                            value={pedidoEdit.telefono}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                telefono: e.target.value.replace(/\D/g, '').slice(0, 10),
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>
                      </div>

                      <Campo label="Observaciones">
                        <textarea
                          rows={4}
                          value={pedidoEdit.observaciones_vendedor || ''}
                          onChange={(e) =>
                            setPedidoEdit({
                              ...pedidoEdit,
                              observaciones_vendedor: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </Campo>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Campo label="DNI">
                          <input
                            value={pedidoEdit.dni || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                dni: e.target.value.replace(/\D/g, ''),
                              })
                            }
                            inputMode="numeric"
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Teléfono *">
                          <input
                            required
                            inputMode="numeric"
                            maxLength={10}
                            value={pedidoEdit.telefono}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                telefono: e.target.value.replace(/\D/g, '').slice(0, 10),
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Tipo de domicilio">
                          <select
                            value={pedidoEdit.tipo_domicilio || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                tipo_domicilio: e.target.value || null,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="">Seleccionar...</option>
                            {TIPOS_DOMICILIO.map(([v, n]) => (
                              <option key={v} value={v}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </Campo>

                        <Campo label="Domicilio">
                          <input
                            value={pedidoEdit.domicilio || ''}
                            onChange={(e) =>
                              setPedidoEdit({ ...pedidoEdit, domicilio: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Nombre edificio">
                          <input
                            value={pedidoEdit.nombre_edificio || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                nombre_edificio: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Cant. unidades F">
                          <input
                            value={pedidoEdit.cant_unidades_f || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                cant_unidades_f: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Cant. pisos">
                          <input
                            value={pedidoEdit.cant_pisos || ''}
                            onChange={(e) =>
                              setPedidoEdit({ ...pedidoEdit, cant_pisos: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Cant. torres">
                          <input
                            value={pedidoEdit.cant_torres || ''}
                            onChange={(e) =>
                              setPedidoEdit({ ...pedidoEdit, cant_torres: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Administrador">
                          <input
                            value={pedidoEdit.administrador || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                administrador: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Teléfono administrador">
                          <input
                            inputMode="numeric"
                            maxLength={10}
                            value={pedidoEdit.telefono_adm || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                telefono_adm: e.target.value
                                  .replace(/\D/g, '')
                                  .slice(0, 10),
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Correo administrador">
                          <input
                            type="email"
                            value={pedidoEdit.correo_adm || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                correo_adm: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Encargado">
                          <input
                            value={pedidoEdit.encargado || ''}
                            onChange={(e) =>
                              setPedidoEdit({ ...pedidoEdit, encargado: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Teléfono encargado">
                          <input
                            inputMode="numeric"
                            maxLength={10}
                            value={pedidoEdit.telefono_enc || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                telefono_enc: e.target.value
                                  .replace(/\D/g, '')
                                  .slice(0, 10),
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Correo encargado">
                          <input
                            type="email"
                            value={pedidoEdit.correo_enc || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                correo_enc: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>

                        <Campo label="Permisos de acceso">
                          <select
                            value={pedidoEdit.permisos_acceso || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                permisos_acceso: e.target.value || null,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="">Seleccionar...</option>
                            <option value="ADM">Administrador</option>
                            <option value="ENC">Encargado</option>
                            <option value="NOREQ">No requiere</option>
                          </select>
                        </Campo>

                        <Campo label="Planos">
                          <select
                            value={pedidoEdit.planos || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                planos: e.target.value || null,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="">Seleccionar...</option>
                            <option value="SI">Sí</option>
                            <option value="NO">No</option>
                          </select>
                        </Campo>

                        <Campo label="Cant. preventas">
                          <input
                            value={pedidoEdit.cant_preventas || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                cant_preventas: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </Campo>
                      </div>

                      <Campo label="Observaciones vendedor">
                        <textarea
                          rows={4}
                          value={pedidoEdit.observaciones_vendedor || ''}
                          onChange={(e) =>
                            setPedidoEdit({
                              ...pedidoEdit,
                              observaciones_vendedor: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </Campo>
                    </>
                  )}

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h4 className="mb-4 font-semibold text-gray-900">Datos de gestión</h4>

                    <div className="grid gap-4 md:grid-cols-2">
                      {pedidoEdit.tipos_pedido?.codigo === 'RELLAMADO_VENTA_GESTION' ? (
                        <Campo label="Fecha Gestión">
                          <input
                            type="text"
                            value={
                              pedidoEdit.fecha_gestion
                                ? new Intl.DateTimeFormat('es-AR', {
                                    timeZone: 'America/Argentina/Buenos_Aires',
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false,
                                  }).format(new Date(pedidoEdit.fecha_gestion))
                                : 'Sin gestión'
                            }
                            readOnly
                            className={`${inputClass} bg-gray-50`}
                          />
                        </Campo>
                      ) : (
                        <>
                          <Campo label="WO">
                            <input
                              value={pedidoEdit.wo || ''}
                              onChange={(e) =>
                                setPedidoEdit({
                                  ...pedidoEdit,
                                  wo: e.target.value,
                                })
                              }
                              className={inputClass}
                            />
                          </Campo>

                          <Campo label="Fecha OK">
                            <input
                              type="date"
                              value={pedidoEdit.fecha_ok || ''}
                              onChange={(e) =>
                                setPedidoEdit({
                                  ...pedidoEdit,
                                  fecha_ok: e.target.value || null,
                                })
                              }
                              className={inputClass}
                            />
                          </Campo>
                        </>
                      )}
                    </div>

                    <div className="mt-4">
                      <Campo label="Observaciones Gestión">
                        <textarea
                          rows={4}
                          value={pedidoEdit.observaciones_gestion || ''}
                          onChange={(e) =>
                            setPedidoEdit({
                              ...pedidoEdit,
                              observaciones_gestion: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </Campo>
                    </div>
                  </div>

                  <div className="border-t border-red-100 pt-5">
                    <Campo label="Estado">
                      <select
                        value={pedidoEdit.estado_pedido_id ?? ''}
                        onChange={(e) =>
                          setPedidoEdit({
                            ...pedidoEdit,
                            estado_pedido_id: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">Sin calificar</option>
                        {estadosPedido
                          .filter(
                            (estado) =>
                              estadoCorrespondeAPedido(estado, pedidoEdit) &&
                              (estado.activo || estado.id === pedidoEdit.estado_pedido_id)
                          )
                          .map((estado) => (
                            <option key={estado.id} value={estado.id}>
                              {estado.nombre}
                              {!estado.activo ? ' (inactivo)' : ''}
                            </option>
                          ))}
                      </select>
                    </Campo>

                    {estadosPedido.filter((estado) =>
                      estadoCorrespondeAPedido(estado, pedidoEdit)
                    ).length === 0 && (
                      <p className="mt-2 text-xs text-amber-700">
                        No hay Estados configurados para este Tipo de Pedido.
                      </p>
                    )}
                  </div>

                  <button
                    disabled={guardandoGestion}
                    className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {guardandoGestion ? 'Guardando gestión...' : 'Guardar gestión'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="mt-6">
            {cargando ? (
              <div className="rounded-xl border bg-gray-50 p-6 text-gray-500">
                Cargando gestión...
              </div>
            ) : vistaGestion === 'CONSULTAS' ? (
              <div className="space-y-3">
                {consultasGestionFiltradas.length === 0 && (
                  <Vacio texto="No hay Consultas para este filtro." />
                )}

                {consultasGestionFiltradas.map((x) => (
                  <article
                    key={`gestion-consulta-${x.id}`}
                    className={`rounded-xl border p-5 ${
                      gestionAbierta?.tipo === 'CONSULTAS' &&
                      gestionAbierta.id === x.id
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">
                          Consulta #{x.id} · {x.tipos_consulta?.nombre || 'Consulta'}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {new Date(x.marca_temporal).toLocaleString('es-AR')}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <ResponsableBadge
                          responsableId={x.responsable_id}
                          userId={userId}
                        />
                        <EstadosConsultaResumen consulta={x} estados={estadosConsulta} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                      <div>
                        <b>Cliente:</b> {x.cliente || '-'}
                      </div>
                      <div>
                        <b>DNI:</b> {x.dni || '-'}
                      </div>
                      <div>
                        <b>Teléfono:</b> {x.telefono}
                      </div>
                      <div>
                        <b>Localidad:</b> {x.localidad || '-'}
                      </div>
                      <div className="md:col-span-2">
                        <b>Domicilio:</b> {x.domicilio || '-'}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!x.responsable_id ? (
                        <button
                          type="button"
                          onClick={() => void tomarConsulta(x)}
                          disabled={tomandoId === x.id}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {tomandoId === x.id
                            ? 'Tomando...'
                            : 'Tomar y gestionar'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirGestionConsulta(x)}
                          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                        >
                          Gestionar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {pedidosGestionFiltrados.length === 0 && (
                  <Vacio texto="No hay Pedidos para este filtro." />
                )}

                {pedidosGestionFiltrados.map((x) => (
                  <article
                    key={`gestion-pedido-${x.id}`}
                    className={`rounded-xl border p-5 ${
                      gestionAbierta?.tipo === 'PEDIDOS' &&
                      gestionAbierta.id === x.id
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {x.codigo || `Pedido #${x.id}`} ·{' '}
                          {x.tipos_pedido?.nombre || 'Pedido'}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {new Date(x.marca_temporal).toLocaleString('es-AR')}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <ResponsableBadge
                          responsableId={x.responsable_id}
                          userId={userId}
                        />
                        <Estado nombre={x.estados_pedido?.nombre} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                      {x.dni && (
                        <div>
                          <b>DNI:</b> {x.dni}
                        </div>
                      )}
                      <div>
                        <b>Teléfono:</b> {x.telefono}
                      </div>
                      <div>
                        <b>Domicilio:</b> {x.domicilio || '-'}
                      </div>
                      <div className="md:col-span-2">
                        <b>Observaciones:</b> {x.observaciones_vendedor || '-'}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!x.responsable_id ? (
                        <button
                          type="button"
                          onClick={() => void tomarPedido(x)}
                          disabled={tomandoId === x.id}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {tomandoId === x.id
                            ? 'Tomando...'
                            : 'Tomar y gestionar'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirGestionPedido(x)}
                          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                        >
                          Gestionar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">{esAdmin ? 'Todos los registros' : 'Mis registros'}</h2>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setVistaListado('CONSULTAS')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${vistaListado === 'CONSULTAS' ? 'bg-gray-900 text-white' : 'border bg-white text-gray-700'}`}
          >
            Consultas ({consultas.length})
          </button>
          <button
            type="button"
            onClick={() => setVistaListado('PEDIDOS')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${vistaListado === 'PEDIDOS' ? 'bg-gray-900 text-white' : 'border bg-white text-gray-700'}`}
          >
            Pedidos ({pedidos.length})
          </button>
        </div>

        {cargando ? (
          <div className="rounded-xl border bg-white p-6 text-gray-500">Cargando...</div>
        ) : vistaListado === 'CONSULTAS' ? (
          <div className="space-y-3">
            {consultas.length === 0 && <Vacio texto={esAdmin ? "No hay Consultas registradas." : "Todavía no ingresaste Consultas."} />}
            {consultas.map((x) => (
              <article key={x.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      Consulta #{x.id} · {x.tipos_consulta?.nombre || 'Consulta'}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {new Date(x.marca_temporal).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <EstadosConsultaResumen consulta={x} estados={estadosConsulta} />
                </div>

                <div className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                  <div><b>Cliente:</b> {x.cliente || '-'}</div>
                  <div><b>DNI:</b> {x.dni || '-'}</div>
                  <div><b>Teléfono:</b> {x.telefono}</div>
                  <div><b>Localidad:</b> {x.localidad || '-'}</div>
                  <div className="md:col-span-2"><b>Domicilio:</b> {x.domicilio || '-'}</div>
                  <div className="md:col-span-2"><b>Observaciones:</b> {x.observaciones || '-'}</div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.length === 0 && <Vacio texto={esAdmin ? "No hay Pedidos registrados." : "Todavía no ingresaste Pedidos."} />}
            {pedidos.map((x) => (
              <article key={x.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {x.codigo || `Pedido #${x.id}`} · {x.tipos_pedido?.nombre || 'Pedido'}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {new Date(x.marca_temporal).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <Estado nombre={x.estados_pedido?.nombre} />
                </div>

                <div className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                  {x.dni && <div><b>DNI:</b> {x.dni}</div>}
                  <div><b>Teléfono:</b> {x.telefono}</div>
                  <div><b>Domicilio:</b> {x.domicilio || '-'}</div>
                  <div className="md:col-span-2"><b>Observaciones:</b> {x.observaciones_vendedor || '-'}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function EstadosConsultaResumen({
  consulta,
  estados,
}: {
  consulta: Consulta
  estados: EstadoCatalogo[]
}) {
  const tipo = consulta.tipos_consulta?.codigo

  const nombrePorId = (id: number | null | undefined) =>
    id == null ? null : estados.find((estado) => estado.id === id)?.nombre || null

  const estadoLegado = nombrePorId(consulta.estado_consulta_id)

  const estadoDeuda =
    nombrePorId(consulta.estado_deuda_id) ||
    (['DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(tipo || '')
      ? estadoLegado
      : null)

  const estadoCobertura =
    nombrePorId(consulta.estado_cobertura_id) ||
    (tipo === 'DOMICILIO_COBERTURA' ? estadoLegado : null)

  if (tipo === 'DEUDA_CLIENTE') {
    return (
      <div className="flex flex-wrap gap-2">
        <Estado nombre={estadoDeuda} />
      </div>
    )
  }

  if (tipo === 'DOMICILIO_COBERTURA') {
    return (
      <div className="flex flex-wrap gap-2">
        <Estado nombre={estadoCobertura} />
      </div>
    )
  }

  if (tipo === 'DOMICILIO_DEUDA') {
    return (
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-500">Deuda:</span>
          <Estado nombre={estadoDeuda} />
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-500">Cobertura:</span>
          <Estado nombre={estadoCobertura} />
        </span>
      </div>
    )
  }

  return <Estado nombre={estadoLegado} />
}

function Estado({ nombre }: { nombre?: string | null }) {
  return (
    <span className={`inline-flex h-fit rounded-full px-3 py-1 text-xs font-semibold ${nombre ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
      {nombre || 'Pendiente'}
    </span>
  )
}

function ResponsableBadge({
  responsableId,
  userId,
}: {
  responsableId: string | null
  userId: string
}) {
  const propio = responsableId === userId
  const texto = !responsableId ? 'Sin Responsable' : propio ? 'Responsable: Yo' : 'Asignada'
  const clase = !responsableId
    ? 'bg-yellow-100 text-yellow-800'
    : propio
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-200 text-gray-700'

  return (
    <span className={`inline-flex h-fit rounded-full px-3 py-1 text-xs font-semibold ${clase}`}>
      {texto}
    </span>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
      {texto}
    </div>
  )
}
