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

type VentaRellamado = {
  id_operacion: string
  fecha_hora: string
  vendedor: string
  cliente: {
    dni: string | null
    nombre: string | null
    apellido: string | null
    telefono: string | null
  } | null
}

type Consulta = {
  id: number
  marca_temporal: string
  operacion_id: string | null
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
  domicilio: string | null
  entre_calles: string | null
  barrio: string | null
  telefono: string | null
  coordenadas: string | null
  acronimo_olt_proxima: string | null
  nombre_edificio: string | null
  torre: string | null
  cant_unidades_f: string | null
  administrador: string | null
  telefono_adm: string | null
  encargado: string | null
  telefono_enc: string | null
  notas_anexas: string | null
  id_venta_cargada: string | null
  observaciones_vendedor: string | null
  observaciones_gestion: string | null
  fecha_gestion: string | null
  responsable_id: string | null
  estado_pedido_id: number | null
  tipos_pedido: { nombre: string; codigo: string } | null
  estados_pedido: { id: number; nombre: string; tipo_estado: string } | null
}

type Props = {
  userId: string
  nombreUsuario: string
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
  RELLAMADO_VENTA_GESTION: 'Rellamado Venta en Gestión',
}

const ETIQUETAS_PEDIDO: Record<string, string> = {
  ACOMETIDA: 'Acometida',
  PROYECTO: 'Proyecto',
  AMPLIACION: 'Ampliación',
  AMPLIACION_CUADRA_SATURADA: 'Ampliación Cuadra Saturada',
}

export default function MisConsultasClient({ userId, nombreUsuario, rol, puedeGestionarVentas }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const esAdmin = rol === 'ADMIN'
  const esSupervisor = rol === 'SUPERVISOR'
  const esBboo = rol === 'BBOO'
  const esVendedorGestor = rol === 'VENDEDOR' && puedeGestionarVentas
  const puedeGestionarConsultas = esAdmin || esSupervisor || esVendedorGestor
  const puedeGestionarPedidos = esAdmin || esSupervisor || esBboo

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
  const [ventasRellamado, setVentasRellamado] = useState<VentaRellamado[]>([])
  const [operacionRellamadoId, setOperacionRellamadoId] = useState('')
  const [busquedaVentaRellamado, setBusquedaVentaRellamado] = useState('')

  const [tipoPedidoId, setTipoPedidoId] = useState('')
  const [domicilioPedido, setDomicilioPedido] = useState('')
  const [entreCallesPedido, setEntreCallesPedido] = useState('')
  const [barrioPedido, setBarrioPedido] = useState('')
  const [telefonoPedido, setTelefonoPedido] = useState('')
  const [coordenadasPedido, setCoordenadasPedido] = useState('')
  const [acronimoOltProxima, setAcronimoOltProxima] = useState('')
  const [nombreEdificio, setNombreEdificio] = useState('')
  const [torrePedido, setTorrePedido] = useState('')
  const [cantUnidades, setCantUnidades] = useState('')
  const [administrador, setAdministrador] = useState('')
  const [telefonoAdm, setTelefonoAdm] = useState('')
  const [encargado, setEncargado] = useState('')
  const [telefonoEnc, setTelefonoEnc] = useState('')
  const [notasAnexas, setNotasAnexas] = useState('')
  const [idVentaCargada, setIdVentaCargada] = useState('')
  const [observacionesPedido, setObservacionesPedido] = useState('')
  const [estadoPedidoId, setEstadoPedidoId] = useState('')

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
          operacion_id,
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
          domicilio,
          entre_calles,
          barrio,
          coordenadas,
          acronimo_olt_proxima,
          nombre_edificio,
          torre,
          cant_unidades_f,
          administrador,
          telefono_adm,
          encargado,
          telefono_enc,
          notas_anexas,
          id_venta_cargada,
          observaciones_vendedor,
          observaciones_gestion,
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

    const { data: ventasPropias, error: ventasError } = await supabase
      .from('operaciones')
      .select(`
        id_operacion,
        fecha_hora,
        vendedor,
        cliente:clientes (
          dni,
          nombre,
          apellido,
          telefono
        )
      `)
      .eq('usuario_id', userId)
      .in('tipo', ['BAF', 'PORTA'])
      .order('fecha_hora', { ascending: false })

    if (ventasError) {
      setError(ventasError.message)
      setCargando(false)
      return
    }

    setVentasRellamado(
      (ventasPropias || []) as unknown as VentaRellamado[]
    )
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

    if (puedeGestionarConsultas || puedeGestionarPedidos) {
      const [cTodas, pTodos] = await Promise.all([
        supabase
          .from('consultas')
          .select(`
            id,
            marca_temporal,
            operacion_id,
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
          domicilio,
          entre_calles,
          barrio,
          coordenadas,
          acronimo_olt_proxima,
          nombre_edificio,
          torre,
          cant_unidades_f,
          administrador,
          telefono_adm,
          encargado,
          telefono_enc,
          notas_anexas,
          id_venta_cargada,
          observaciones_vendedor,
          observaciones_gestion,
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

      const consultasTodas = (cTodas.data || []) as unknown as Consulta[]
      const pedidosTodos = (pTodos.data || []) as unknown as Pedido[]
      const consultasPermitidas = puedeGestionarConsultas ? consultasTodas : []
      const pedidosPermitidos = puedeGestionarPedidos ? pedidosTodos : []

      setConsultasGestion(consultasPermitidas)
      setPedidosGestion(pedidosPermitidos)

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
        const actualizado = pedidosPermitidos.find(
          (x) => x.id === gestionAbierta.id
        )
        if (actualizado) setPedidoEdit(actualizado)
      }
    } else {
      setConsultasGestion([])
      setPedidosGestion([])
    }

    setCargando(false)
  }, [supabase, userId, puedeGestionarConsultas, puedeGestionarPedidos, esAdmin, gestionAbierta])

  useEffect(() => {
    if (!puedeGestionarConsultas && puedeGestionarPedidos) {
      setVistaGestion('PEDIDOS')
    }
    void cargarDatos()
    // La carga inicial debe ejecutarse al montar/cambiar de usuario.
    // gestionAbierta se refresca manualmente después de guardar o tomar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, puedeGestionarConsultas, puedeGestionarPedidos, esAdmin])

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
    setOperacionRellamadoId('')
    setBusquedaVentaRellamado('')
  }

  function limpiarPedido() {
    setTipoPedidoId('')
    setDomicilioPedido('')
    setEntreCallesPedido('')
    setBarrioPedido('')
    setTelefonoPedido('')
    setCoordenadasPedido('')
    setAcronimoOltProxima('')
    setNombreEdificio('')
    setTorrePedido('')
    setCantUnidades('')
    setAdministrador('')
    setTelefonoAdm('')
    setEncargado('')
    setTelefonoEnc('')
    setNotasAnexas('')
    setIdVentaCargada('')
    setObservacionesPedido('')
    setEstadoPedidoId('')
  }

  const consultaSeleccionada = tiposConsulta.find(
    (x) => String(x.id) === tipoConsultaId
  )

  const esConsultaRellamado =
    consultaSeleccionada?.codigo === 'RELLAMADO_VENTA_GESTION'

  const ventasRellamadoFiltradas = (() => {
    const q = busquedaVentaRellamado.trim().toLowerCase()

    if (!q) return []

    return ventasRellamado
      .filter((venta) => {
        const nombreCompleto = [
          venta.cliente?.nombre,
          venta.cliente?.apellido,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        const dni = (venta.cliente?.dni || '').toLowerCase()
        const telefono = (venta.cliente?.telefono || '').toLowerCase()
        const operacion = venta.id_operacion.toLowerCase()

        return (
          nombreCompleto.includes(q) ||
          dni.includes(q) ||
          telefono.includes(q) ||
          operacion.includes(q)
        )
      })
      .slice(0, 10)
  })()

  async function guardarConsulta(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (!tipoConsultaId) return setError('Seleccioná el tipo de Consulta.')

    if (esConsultaRellamado && !operacionRellamadoId) {
      return setError('Seleccioná la venta que necesita el Rellamado.')
    }

    const codigoConsulta = consultaSeleccionada?.codigo

    if (
      ['RELLAMADO_VENTA_GESTION', 'DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
        codigoConsulta || ''
      ) &&
      (!cliente.trim() || !dni.trim())
    ) {
      return setError('Completá los campos obligatorios: Cliente y DNI.')
    }

    if (
      ['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(
        codigoConsulta || ''
      ) &&
      (
        !tipoDomicilioConsulta.trim() ||
        !domicilioConsulta.trim() ||
        !entrecalles.trim() ||
        !localidad.trim()
      )
    ) {
      return setError(
        'Completá los campos obligatorios: Tipo Domicilio, Domicilio, Entre Calles y Localidad.'
      )
    }

    if (!validarTelefono(telefonoConsulta)) {
      return setError('El teléfono debe tener exactamente 10 dígitos y no puede comenzar con 0 ni 5.')
    }

    setGuardando(true)

    const { error: insertError } = await supabase.from('consultas').insert({
      tipo_consulta_id: Number(tipoConsultaId),
      vendedor_id: userId,
      operacion_id: esConsultaRellamado ? operacionRellamadoId : null,
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

  const esAmpliacionCuadraSaturada =
    pedidoSeleccionado?.codigo === 'AMPLIACION_CUADRA_SATURADA'

  const estadosPedidoSeleccionado = tipoPedidoId
    ? estadosPedido.filter(
        (estado) =>
          estado.tipo_pedido_id != null &&
          Number(estado.tipo_pedido_id) === Number(tipoPedidoId) &&
          estado.activo
      )
    : []

  async function guardarPedido(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (!tipoPedidoId) return setError('Seleccioná el tipo de Pedido.')

    if (esAmpliacionCuadraSaturada) {
  if (
    !domicilioPedido.trim() ||
    !entreCallesPedido.trim() ||
    !barrioPedido.trim() ||
    !acronimoOltProxima.trim() ||
    !idVentaCargada.trim()
  ) {
    return setError(
      'Completá los campos obligatorios: Domicilio, Entre Calles, Barrio, Acrónimo OLT Próxima e ID Venta Cargada.'
    )
  }
} else {
  if (
    !domicilioPedido.trim() ||
    !entreCallesPedido.trim() ||
    !barrioPedido.trim() ||
    !nombreEdificio.trim() ||
    !torrePedido.trim() ||
    !cantUnidades.trim() ||
    !administrador.trim() ||
    !telefonoAdm.trim() ||
    !encargado.trim() ||
    !telefonoEnc.trim() ||
    !idVentaCargada.trim()
  ) {
    return setError(
      'Completá todos los campos obligatorios del Pedido.'
    )
  }
}    

    if (
      esAmpliacionCuadraSaturada &&
      !validarTelefono(telefonoPedido)
    ) {
      return setError(
        'El teléfono del Cliente debe tener 10 dígitos y no comenzar con 0 ni 5.'
      )
    }

    if (
      !esAmpliacionCuadraSaturada &&
      (!validarTelefonoOpcional(telefonoAdm) ||
        !validarTelefonoOpcional(telefonoEnc))
    ) {
      return setError(
        'Los teléfonos de Administrador y Encargado, si se informan, deben tener 10 dígitos y no comenzar con 0 ni 5.'
      )
    }

    setGuardando(true)

    const datosPedido = {
      vendedor_id: userId,
      tipo_pedido_id: Number(tipoPedidoId),
      domicilio: normalizar(domicilioPedido),
      entre_calles: normalizar(entreCallesPedido),
      barrio: normalizar(barrioPedido),
      telefono: esAmpliacionCuadraSaturada ? normalizar(telefonoPedido) : null,
      coordenadas: esAmpliacionCuadraSaturada ? normalizar(coordenadasPedido) : null,
      acronimo_olt_proxima: esAmpliacionCuadraSaturada ? normalizar(acronimoOltProxima) : null,
      nombre_edificio: esAmpliacionCuadraSaturada ? null : normalizar(nombreEdificio),
      torre: esAmpliacionCuadraSaturada ? null : normalizar(torrePedido),
      cant_unidades_f: esAmpliacionCuadraSaturada ? null : normalizar(cantUnidades),
      administrador: esAmpliacionCuadraSaturada ? null : normalizar(administrador),
      telefono_adm: esAmpliacionCuadraSaturada ? null : normalizar(telefonoAdm),
      encargado: esAmpliacionCuadraSaturada ? null : normalizar(encargado),
      telefono_enc: esAmpliacionCuadraSaturada ? null : normalizar(telefonoEnc),
      notas_anexas: esAmpliacionCuadraSaturada ? null : normalizar(notasAnexas),
      id_venta_cargada: normalizar(idVentaCargada),
      observaciones_vendedor: normalizar(observacionesPedido),
      estado_pedido_id:
        puedeGestionarPedidos && estadoPedidoId ? Number(estadoPedidoId) : null,
    }

    const { error: insertError } = await supabase.from('pedidos').insert(datosPedido)

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

    try {
      const response = await fetch('/api/gestion/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consulta_id: consultaEdit.id,
          cliente: normalizar(consultaEdit.cliente || ''),
          dni: normalizar(consultaEdit.dni || ''),
          telefono: consultaEdit.telefono,
          tipo_domicilio: normalizar(consultaEdit.tipo_domicilio || ''),
          domicilio: normalizar(consultaEdit.domicilio || ''),
          entrecalles: normalizar(consultaEdit.entrecalles || ''),
          localidad: normalizar(consultaEdit.localidad || ''),
          observaciones: normalizar(consultaEdit.observaciones || ''),
          estado_consulta_id: consultaEdit.estado_consulta_id,
          estado_deuda_id: consultaEdit.estado_deuda_id,
          estado_cobertura_id: consultaEdit.estado_cobertura_id,
        }),
      })

      const resultado = await response.json().catch(() => null)

      if (!response.ok) {
        setError(resultado?.error || 'No se pudo guardar la gestión de la Consulta.')
        return
      }

      const aviso = resultado?.aviso ? ` ${resultado.aviso}` : ''

      setMensaje(
        `Gestión de Consulta #${consultaEdit.id} guardada correctamente.${aviso}`
      )
      cerrarGestion()
      await cargarDatos()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la gestión de la Consulta.'
      )
    } finally {
      setGuardandoGestion(false)
    }
  }

  async function guardarGestionPedido(e: React.FormEvent) {
    e.preventDefault()
    if (!pedidoEdit || !puedeGestionarPedidos) return

    setError('')
    setMensaje('')

    const esCuadraSaturada =
      pedidoEdit.tipos_pedido?.codigo === 'AMPLIACION_CUADRA_SATURADA'

    if (
      esCuadraSaturada &&
      !validarTelefono(pedidoEdit.telefono || '')
    ) {
      setError(
        'El teléfono del Cliente debe tener 10 dígitos y no comenzar con 0 ni 5.'
      )
      return
    }

    if (
      !esCuadraSaturada &&
      (!validarTelefonoOpcional(pedidoEdit.telefono_adm || '') ||
        !validarTelefonoOpcional(pedidoEdit.telefono_enc || ''))
    ) {
      setError(
        'Los teléfonos de Administrador y Encargado, si se informan, deben tener 10 dígitos y no comenzar con 0 ni 5.'
      )
      return
    }

    setGuardandoGestion(true)
    try {
      const response = await fetch('/api/gestion/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedidoEdit.id,
          domicilio: normalizar(pedidoEdit.domicilio || ''),
          entre_calles: normalizar(pedidoEdit.entre_calles || ''),
          barrio: normalizar(pedidoEdit.barrio || ''),
          telefono: esCuadraSaturada ? normalizar(pedidoEdit.telefono || '') : null,
          coordenadas: esCuadraSaturada ? normalizar(pedidoEdit.coordenadas || '') : null,
          acronimo_olt_proxima: esCuadraSaturada ? normalizar(pedidoEdit.acronimo_olt_proxima || '') : null,
          nombre_edificio: esCuadraSaturada ? null : normalizar(pedidoEdit.nombre_edificio || ''),
          torre: esCuadraSaturada ? null : normalizar(pedidoEdit.torre || ''),
          cant_unidades_f: esCuadraSaturada ? null : normalizar(pedidoEdit.cant_unidades_f || ''),
          administrador: esCuadraSaturada ? null : normalizar(pedidoEdit.administrador || ''),
          telefono_adm: esCuadraSaturada ? null : normalizar(pedidoEdit.telefono_adm || ''),
          encargado: esCuadraSaturada ? null : normalizar(pedidoEdit.encargado || ''),
          telefono_enc: esCuadraSaturada ? null : normalizar(pedidoEdit.telefono_enc || ''),
          notas_anexas: esCuadraSaturada ? null : normalizar(pedidoEdit.notas_anexas || ''),
          id_venta_cargada: normalizar(pedidoEdit.id_venta_cargada || ''),
          observaciones_vendedor: normalizar(pedidoEdit.observaciones_vendedor || ''),
          observaciones_gestion: normalizar(pedidoEdit.observaciones_gestion || ''),
          estado_pedido_id: pedidoEdit.estado_pedido_id,
        }),
      })

      const resultado = await response.json().catch(() => null)
      if (!response.ok) {
        setError(resultado?.error || 'No se pudo guardar la gestión del Pedido.')
        return
      }

      const aviso = resultado?.aviso ? ` ${resultado.aviso}` : ''
      setMensaje(
        `Gestión del Pedido ${pedidoEdit.codigo || `#${pedidoEdit.id}`} guardada correctamente.${aviso}`
      )
      cerrarGestion()
      await cargarDatos()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudo guardar la gestión del Pedido.'
      )
    } finally {
      setGuardandoGestion(false)
    }
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

                {esConsultaRellamado && (
                  <div className="md:col-span-2 space-y-3">
                    <Campo label="Buscar mi venta *">
                      <input
                        type="text"
                        value={busquedaVentaRellamado}
                        onChange={(e) => {
                          setBusquedaVentaRellamado(e.target.value)
                          setOperacionRellamadoId('')
                        }}
                        className={inputClass}
                        placeholder="Cliente, DNI, teléfono o N° de operación"
                      />
                    </Campo>

                    {busquedaVentaRellamado.trim() && !operacionRellamadoId && (
                      <div className="space-y-2">
                        {ventasRellamadoFiltradas.length === 0 ? (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                            No se encontraron ventas propias con ese criterio.
                          </div>
                        ) : (
                          ventasRellamadoFiltradas.map((venta) => {
                            const nombreCompleto = [
                              venta.cliente?.nombre,
                              venta.cliente?.apellido,
                            ]
                              .filter(Boolean)
                              .join(' ')

                            return (
                              <button
                                key={venta.id_operacion}
                                type="button"
                                onClick={() => {
                                  setOperacionRellamadoId(venta.id_operacion)

                                  setCliente(nombreCompleto)
                                  setDni(venta.cliente?.dni || '')
                                  setTelefonoConsulta(
                                    (venta.cliente?.telefono || '')
                                      .replace(/\D/g, '')
                                      .slice(0, 10)
                                  )
                                }}
                                className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-red-300 hover:bg-red-50"
                              >
                                <div className="font-semibold text-gray-900">
                                  {nombreCompleto || 'Sin nombre'}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                  DNI {venta.cliente?.dni || 's/d'} · Tel. {venta.cliente?.telefono || 's/d'}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Operación {venta.id_operacion}
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}

                    {operacionRellamadoId && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
                          Venta seleccionada
                        </div>
                        <div className="mt-1 font-semibold text-gray-900">
                          {cliente || 'Sin nombre'}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          DNI {dni || 's/d'} · Operación {operacionRellamadoId}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOperacionRellamadoId('')
                            setCliente('')
                            setDni('')
                            setTelefonoConsulta('')
                          }}
                          className="mt-2 text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          Cambiar venta
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <Campo label={esConsultaRellamado ? "Teléfono para el Rellamado *" : "Teléfono *"}>
                  <input required inputMode="numeric" maxLength={10} value={telefonoConsulta} onChange={(e) => setTelefonoConsulta(e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} placeholder="10 dígitos" />
                </Campo>

                <Campo
                  label={
                    ['RELLAMADO_VENTA_GESTION', 'DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
                      consultaSeleccionada?.codigo || ''
                    )
                      ? 'Cliente *'
                      : 'Cliente'
                  }
                >
                  <input
                    required={['RELLAMADO_VENTA_GESTION', 'DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
                      consultaSeleccionada?.codigo || ''
                    )}
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className={inputClass}
                  />
                </Campo>

                <Campo
                  label={
                    ['RELLAMADO_VENTA_GESTION', 'DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
                      consultaSeleccionada?.codigo || ''
                    )
                      ? 'DNI *'
                      : 'DNI'
                  }
                >
                  <input
                    required={['RELLAMADO_VENTA_GESTION', 'DEUDA_CLIENTE', 'DOMICILIO_DEUDA'].includes(
                      consultaSeleccionada?.codigo || ''
                    )}
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className={inputClass}
                  />
                </Campo>

                {!esConsultaRellamado && (
                  <>
                <Campo label={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '') ? 'Tipo de domicilio *' : 'Tipo de domicilio'}>
                  <select required={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '')} value={tipoDomicilioConsulta} onChange={(e) => setTipoDomicilioConsulta(e.target.value)} className={inputClass}>
                    <option value="">Seleccionar...</option>
                    {TIPOS_DOMICILIO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                  </select>
                </Campo>

                <Campo label={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '') ? 'Domicilio *' : 'Domicilio'}>
                  <input required={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '')} value={domicilioConsulta} onChange={(e) => setDomicilioConsulta(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '') ? 'Entre calles *' : 'Entre calles'}>
                  <input required={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '')} value={entrecalles} onChange={(e) => setEntrecalles(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '') ? 'Localidad *' : 'Localidad'}>
                  <input required={['DOMICILIO_COBERTURA', 'DOMICILIO_DEUDA'].includes(consultaSeleccionada?.codigo || '')} value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={inputClass} />
                </Campo>
                  </>
                )}
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
                  <select required value={tipoPedidoId} onChange={(e) => { setTipoPedidoId(e.target.value); setEstadoPedidoId('') }} className={inputClass}>
                    <option value="">Seleccionar...</option>
                    {tiposPedido.map((x) => <option key={x.id} value={x.id}>{ETIQUETAS_PEDIDO[x.codigo] || x.nombre}</option>)}
                  </select>
                </Campo>

                <Campo label="Fecha Ingreso">
                  <input value="Se registra automáticamente al guardar" readOnly className={`${inputClass} bg-gray-100 text-gray-600`} />
                </Campo>

                <Campo label="Solicitante">
                  <input value={nombreUsuario} readOnly className={`${inputClass} bg-gray-100 text-gray-600`} />
                </Campo>

                <Campo label={esAmpliacionCuadraSaturada ? 'Domicilio a ampliar *' : 'Domicilio *'}>
                  <input required value={domicilioPedido} onChange={(e) => setDomicilioPedido(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label="Entre Calles *">
                  <input required value={entreCallesPedido} onChange={(e) => setEntreCallesPedido(e.target.value)} className={inputClass} />
                </Campo>

                <Campo label="Barrio *">
                  <input required value={barrioPedido} onChange={(e) => setBarrioPedido(e.target.value)} className={inputClass} />
                </Campo>

                {esAmpliacionCuadraSaturada ? (
                  <>
                    <Campo label="Teléfono Cliente *">
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
                        placeholder="10 dígitos"
                      />
                    </Campo>
                    <Campo label="Coordenadas">
                      <input value={coordenadasPedido} onChange={(e) => setCoordenadasPedido(e.target.value)} className={inputClass} />
                    </Campo>
                    <Campo label="Acrónimo OLT Próxima *">
                      <input required value={acronimoOltProxima} onChange={(e) => setAcronimoOltProxima(e.target.value)} className={inputClass} />
                    </Campo>
                  </>
                ) : (
                  <>
                    <Campo label="Nombre Edificio *"><input required value={nombreEdificio} onChange={(e) => setNombreEdificio(e.target.value)} className={inputClass} /></Campo>
                    <Campo label="Torre *"><input required value={torrePedido} onChange={(e) => setTorrePedido(e.target.value)} className={inputClass} /></Campo>
                    <Campo label="Cantidad UF *"><input required value={cantUnidades} onChange={(e) => setCantUnidades(e.target.value)} className={inputClass} /></Campo>
                    <Campo label="Nombre Administrador *"><input required value={administrador} onChange={(e) => setAdministrador(e.target.value)} className={inputClass} /></Campo>
                    <Campo label="Teléfono Administrador *">
                      <input required inputMode="numeric" maxLength={10} value={telefonoAdm} onChange={(e) => setTelefonoAdm(e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} placeholder="10 dígitos" />
                    </Campo>
                    <Campo label="Nombre Encargado *"><input required value={encargado} onChange={(e) => setEncargado(e.target.value)} className={inputClass} /></Campo>
                    <Campo label="Teléfono Encargado *">
                      <input required inputMode="numeric" maxLength={10} value={telefonoEnc} onChange={(e) => setTelefonoEnc(e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} placeholder="10 dígitos" />
                    </Campo>
                    <Campo label="Notas Anexas"><textarea rows={3} value={notasAnexas} onChange={(e) => setNotasAnexas(e.target.value)} className={inputClass} /></Campo>
                  </>
                )}

                <Campo label="ID Venta Cargada *">
                  <div>
                    <input required value={idVentaCargada} onChange={(e) => setIdVentaCargada(e.target.value)} className={inputClass} />
                    <p className="mt-1 text-xs text-gray-500">pegar ID venta cargada que motiva este pedido</p>
                  </div>
                </Campo>

                <Campo label="Estado Gestión">
                  <select value={estadoPedidoId} onChange={(e) => setEstadoPedidoId(e.target.value)} disabled={!puedeGestionarPedidos || !tipoPedidoId} className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-100`}>
                    <option value="">Sin calificar</option>
                    {estadosPedidoSeleccionado.map((estado) => <option key={estado.id} value={estado.id}>{estado.nombre}</option>)}
                  </select>
                </Campo>
              </div>

              <Campo label="Observaciones">
                <textarea rows={4} value={observacionesPedido} onChange={(e) => setObservacionesPedido(e.target.value)} className={inputClass} />
              </Campo>

              <button disabled={guardando} className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar Pedido'}
              </button>
            </form>
          )}
        </section>
      )}

      {(puedeGestionarConsultas || puedeGestionarPedidos) && (
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
            {puedeGestionarConsultas && (
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
            )}
            {puedeGestionarPedidos && (
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
            )}
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
                      {consultaEdit.tipos_consulta?.codigo ===
                        'RELLAMADO_VENTA_GESTION' && (
                        <Campo label="Estado Rellamado">
                          <select
                            value={consultaEdit.estado_consulta_id ?? ''}
                            onChange={(e) =>
                              setConsultaEdit({
                                ...consultaEdit,
                                estado_consulta_id: e.target.value
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
                                  estado.ambito !== 'DEUDA' &&
                                  estado.ambito !== 'COBERTURA' &&
                                  (estado.activo ||
                                    estado.id === consultaEdit.estado_consulta_id)
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

              {gestionAbierta.tipo === 'PEDIDOS' && pedidoEdit && puedeGestionarPedidos && (
                <form onSubmit={guardarGestionPedido} className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Gestionar {pedidoEdit.codigo || `Pedido #${pedidoEdit.id}`}</h3>
                      <div className="mt-1 text-sm text-gray-500">{pedidoEdit.tipos_pedido?.nombre || 'Pedido'} · {new Date(pedidoEdit.marca_temporal).toLocaleString('es-AR')}</div>
                    </div>
                    <button type="button" onClick={cerrarGestion} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cerrar</button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Campo label="Fecha Ingreso"><input value={new Date(pedidoEdit.marca_temporal).toLocaleString('es-AR')} readOnly className={`${inputClass} bg-gray-100 text-gray-600`} /></Campo>
                    <Campo label="Domicilio"><input value={pedidoEdit.domicilio || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, domicilio: e.target.value })} className={inputClass} /></Campo>
                    <Campo label="Entre Calles"><input value={pedidoEdit.entre_calles || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, entre_calles: e.target.value })} className={inputClass} /></Campo>
                    <Campo label="Barrio"><input value={pedidoEdit.barrio || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, barrio: e.target.value })} className={inputClass} /></Campo>

                    {pedidoEdit.tipos_pedido?.codigo === 'AMPLIACION_CUADRA_SATURADA' ? (
                      <>
                        <Campo label="Teléfono Cliente *">
                          <input
                            required
                            inputMode="numeric"
                            maxLength={10}
                            value={pedidoEdit.telefono || ''}
                            onChange={(e) =>
                              setPedidoEdit({
                                ...pedidoEdit,
                                telefono: e.target.value.replace(/\D/g, '').slice(0, 10),
                              })
                            }
                            className={inputClass}
                            placeholder="10 dígitos"
                          />
                        </Campo>
                        <Campo label="Coordenadas"><input value={pedidoEdit.coordenadas || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, coordenadas: e.target.value })} className={inputClass} /></Campo>
                        <Campo label="Acrónimo OLT Próxima"><input value={pedidoEdit.acronimo_olt_proxima || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, acronimo_olt_proxima: e.target.value })} className={inputClass} /></Campo>
                      </>
                    ) : (
                      <>
                        <Campo label="Nombre Edificio"><input value={pedidoEdit.nombre_edificio || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, nombre_edificio: e.target.value })} className={inputClass} /></Campo>
                        <Campo label="Torre"><input value={pedidoEdit.torre || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, torre: e.target.value })} className={inputClass} /></Campo>
                        <Campo label="Cantidad UF"><input value={pedidoEdit.cant_unidades_f || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, cant_unidades_f: e.target.value })} className={inputClass} /></Campo>
                        <Campo label="Nombre Administrador"><input value={pedidoEdit.administrador || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, administrador: e.target.value })} className={inputClass} /></Campo>
                        <Campo label="Teléfono Administrador"><input inputMode="numeric" maxLength={10} value={pedidoEdit.telefono_adm || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, telefono_adm: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} /></Campo>
                        <Campo label="Nombre Encargado"><input value={pedidoEdit.encargado || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, encargado: e.target.value })} className={inputClass} /></Campo>
                        <Campo label="Teléfono Encargado"><input inputMode="numeric" maxLength={10} value={pedidoEdit.telefono_enc || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, telefono_enc: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} /></Campo>
                        <Campo label="Notas Anexas"><textarea rows={3} value={pedidoEdit.notas_anexas || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, notas_anexas: e.target.value })} className={inputClass} /></Campo>
                      </>
                    )}

                    <Campo label="ID Venta Cargada">
                      <div>
                        <input value={pedidoEdit.id_venta_cargada || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, id_venta_cargada: e.target.value })} className={inputClass} />
                        <p className="mt-1 text-xs text-gray-500">pegar ID venta cargada que motiva este pedido</p>
                      </div>
                    </Campo>

                    <Campo label="Estado Gestión">
                      <select value={pedidoEdit.estado_pedido_id ?? ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, estado_pedido_id: e.target.value ? Number(e.target.value) : null })} className={inputClass}>
                        <option value="">Sin calificar</option>
                        {estadosPedido.filter((estado) => estadoCorrespondeAPedido(estado, pedidoEdit) && (estado.activo || estado.id === pedidoEdit.estado_pedido_id)).map((estado) => (
                          <option key={estado.id} value={estado.id}>{estado.nombre}{!estado.activo ? ' (inactivo)' : ''}</option>
                        ))}
                      </select>
                    </Campo>
                  </div>

                  <Campo label="Observaciones"><textarea rows={4} value={pedidoEdit.observaciones_vendedor || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, observaciones_vendedor: e.target.value })} className={inputClass} /></Campo>
                  <Campo label="Observaciones Gestión"><textarea rows={4} value={pedidoEdit.observaciones_gestion || ''} onChange={(e) => setPedidoEdit({ ...pedidoEdit, observaciones_gestion: e.target.value })} className={inputClass} /></Campo>

                  {estadosPedido.filter((estado) => estadoCorrespondeAPedido(estado, pedidoEdit)).length === 0 && (
                    <p className="text-xs text-amber-700">No hay Estados configurados para este Tipo de Pedido.</p>
                  )}

                  <button disabled={guardandoGestion} className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
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
            ) : vistaGestion === 'CONSULTAS' && puedeGestionarConsultas ? (
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
                      <div><b>Domicilio:</b> {x.domicilio || '-'}</div>
                      <div><b>Barrio:</b> {x.barrio || '-'}</div>
                      <div><b>ID Venta Cargada:</b> {x.id_venta_cargada || '-'}</div>
                      <div className="md:col-span-2"><b>Observaciones:</b> {x.observaciones_vendedor || '-'}</div>
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
                  <div><b>Domicilio:</b> {x.domicilio || '-'}</div>
                  <div><b>Barrio:</b> {x.barrio || '-'}</div>
                  <div><b>ID Venta Cargada:</b> {x.id_venta_cargada || '-'}</div>
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
