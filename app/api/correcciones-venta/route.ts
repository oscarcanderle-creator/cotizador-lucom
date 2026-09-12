import { NextRequest, NextResponse } from "next/server"
import { createClient } from "../../../utils/supabase/server"
import { createAdminClient } from "../../../utils/supabase/admin"

function normalizar(v: unknown) {
  return String(v ?? "").trim().toUpperCase()
}

async function contexto(req: NextRequest, operacionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: NextResponse.json({ error: "Sesión no válida." }, { status: 401 }) }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, vendedor, rol, activo, puede_gestionar_ventas")
    .eq("id", user.id)
    .single()

  if (!profile?.activo) return { error: NextResponse.json({ error: "Usuario no habilitado." }, { status: 403 }) }

  const admin = createAdminClient()
  const { data: operacion } = await admin
    .from("operaciones")
    .select("id_operacion, usuario_id")
    .eq("id_operacion", operacionId)
    .maybeSingle()

  if (!operacion) return { error: NextResponse.json({ error: "Venta no encontrada." }, { status: 404 }) }

  const esGestor =
    profile.rol === "ADMIN" ||
    profile.rol === "SUPERVISOR" ||
    profile.rol === "BBOO" ||
    (profile.rol === "VENDEDOR" && profile.puede_gestionar_ventas === true)

  const esPropia = operacion.usuario_id === user.id
  if (!esGestor && !esPropia) return { error: NextResponse.json({ error: "No tenés acceso a esta venta." }, { status: 403 }) }

  return { user, profile, admin, operacion, esGestor, esPropia }
}

async function tieneEstadoFinal(admin: any, operacionId: string) {
  const { data: productos, error } = await admin
    .from("operacion_productos")
    .select("id, tipo_producto")
    .eq("operacion_id", operacionId)
    .eq("activo", true)

  if (error) throw error

  const ids = (productos ?? []).map((p: any) => Number(p.id)).filter(Boolean)
  if (!ids.length) return false

  const [gb, gm, eb, ep] = await Promise.all([
    admin.from("gestion_producto_baf").select("producto_operacion_id, estado_baf_id").in("producto_operacion_id", ids),
    admin.from("gestion_producto_movil").select("producto_operacion_id, estado_porta_id").in("producto_operacion_id", ids),
    admin.from("estados_baf").select("id, codigo, nombre"),
    admin.from("estados_porta").select("id, codigo, nombre"),
  ])

  if (gb.error) throw gb.error
  if (gm.error) throw gm.error
  if (eb.error) throw eb.error
  if (ep.error) throw ep.error

  const mapaBaf = new Map((eb.data ?? []).map((e: any) => [Number(e.id), normalizar(e.codigo || e.nombre)]))
  const mapaPorta = new Map((ep.data ?? []).map((e: any) => [Number(e.id), normalizar(e.codigo || e.nombre)]))
  const gestionBaf = new Map((gb.data ?? []).map((g: any) => [Number(g.producto_operacion_id), g]))
  const gestionMovil = new Map((gm.data ?? []).map((g: any) => [Number(g.producto_operacion_id), g]))

  for (const p of productos ?? []) {
    const id = Number(p.id)
    const tipo = normalizar(p.tipo_producto)

    if (tipo === "BAF") {
      const estado = mapaBaf.get(Number((gestionBaf.get(id) as any)?.estado_baf_id))
      if (estado === "CARGADO") return true
    }

    if (tipo === "PORTA") {
      const estado = mapaPorta.get(Number((gestionMovil.get(id) as any)?.estado_porta_id))
      if (estado === "VALIDADO" || estado === "ACTIVA NRO PORTADO") return true
    }

    if (tipo === "LINEA_NUEVA") {
      const estado = mapaPorta.get(Number((gestionMovil.get(id) as any)?.estado_porta_id))
      if (estado === "LINEA NUEVA ACTIVA") return true
    }
  }

  return false
}

export async function GET(req: NextRequest) {
  try {
    const operacionId = String(req.nextUrl.searchParams.get("operacion_id") ?? "").trim()
    if (!operacionId) return NextResponse.json({ error: "Falta la operación." }, { status: 400 })

    const ctx: any = await contexto(req, operacionId)
    if (ctx.error) return ctx.error

    const { data: solicitudes, error } = await ctx.admin
      .from("solicitudes_correccion_venta")
      .select("*")
      .eq("operacion_id", operacionId)
      .order("created_at", { ascending: false })

    if (error) throw error

    const pendiente = (solicitudes ?? []).some((s: any) => s.estado === "PENDIENTE")
    let puedeSolicitar = false
    let motivoBloqueo: string | null = null

    if (!ctx.esGestor) {
      const final = await tieneEstadoFinal(ctx.admin, operacionId)
      if (final) motivoBloqueo = "Esta venta ya alcanzó un estado final y ya no admite nuevas solicitudes de corrección."
      else if (pendiente) motivoBloqueo = "Ya existe una solicitud de corrección pendiente."
      else puedeSolicitar = true
    }

    const { data: opDetalle, error: opDetalleError } = await ctx.admin
      .from("operaciones")
      .select(`
        id_operacion, origen_dato,
        cliente:clientes (
          tipo_documento, dni, nombre, apellido, fecha_nacimiento,
          email, telefono, telefono_alternativo
        ),
        domicilio:domicilios (
          calle_nro, piso, dpto, entre_calles, barrio, localidad,
          coordenadas, datos_extras
        )
      `)
      .eq("id_operacion", operacionId)
      .maybeSingle()

    if (opDetalleError) throw opDetalleError

    const { data: productosDetalle, error: productosDetalleError } = await ctx.admin
      .from("operacion_productos")
      .select(`
        id, tipo_producto, orden, plan_snapshot,
        baf:operacion_producto_baf (
          modalidad_plan, tv, cantidad_decos, horario_contacto
        ),
        movil:operacion_producto_movil (
          numero_linea, nim, compania_actual, modalidad_actual, tipo_sim
        )
      `)
      .eq("operacion_id", operacionId)
      .eq("activo", true)
      .order("orden", { ascending: true })

    if (productosDetalleError) throw productosDetalleError

    const campos: Array<{ clave: string; etiqueta: string; valor_actual: string }> = []
    const agregar = (clave: string, etiqueta: string, valor: unknown) => {
      campos.push({ clave, etiqueta, valor_actual: valor == null ? "" : String(valor) })
    }

    const od: any = opDetalle
    const cliente: any = Array.isArray(od?.cliente) ? od.cliente[0] : od?.cliente
    const domicilio: any = Array.isArray(od?.domicilio) ? od.domicilio[0] : od?.domicilio

    agregar("cliente.tipo_documento", "Cliente — Tipo de documento", cliente?.tipo_documento)
    agregar("cliente.dni", "Cliente — DNI", cliente?.dni)
    agregar("cliente.nombre", "Cliente — Nombre", cliente?.nombre)
    agregar("cliente.apellido", "Cliente — Apellido", cliente?.apellido)
    agregar("cliente.fecha_nacimiento", "Cliente — Fecha de nacimiento", cliente?.fecha_nacimiento)
    agregar("cliente.email", "Cliente — Correo electrónico", cliente?.email)
    agregar("cliente.telefono", "Cliente — Teléfono", cliente?.telefono)
    agregar("cliente.telefono_alternativo", "Cliente — Teléfono alternativo", cliente?.telefono_alternativo)
    agregar("domicilio.calle_nro", "Domicilio — Calle / número", domicilio?.calle_nro)
    agregar("domicilio.piso", "Domicilio — Piso", domicilio?.piso)
    agregar("domicilio.dpto", "Domicilio — Departamento", domicilio?.dpto)
    agregar("domicilio.entre_calles", "Domicilio — Entre calles", domicilio?.entre_calles)
    agregar("domicilio.barrio", "Domicilio — Barrio", domicilio?.barrio)
    agregar("domicilio.localidad", "Domicilio — Localidad", domicilio?.localidad)
    agregar("domicilio.coordenadas", "Domicilio — Coordenadas", domicilio?.coordenadas)
    agregar("domicilio.datos_extras", "Domicilio — Datos adicionales", domicilio?.datos_extras)
    agregar("operacion.origen_dato", "Operación — Origen del dato", od?.origen_dato)

    for (const prod of productosDetalle ?? []) {
      const x: any = prod
      const tipo = normalizar(x.tipo_producto)
      const nro = Number(x.orden) || 1
      const prefijo =
        tipo === "BAF" ? `Internet #${nro}` :
        tipo === "PORTA" ? `Portabilidad #${nro}` : `Línea Nueva #${nro}`

      agregar(`producto.${x.id}.plan_snapshot`, `${prefijo} — Plan`, x.plan_snapshot)

      if (tipo === "BAF") {
        const b: any = Array.isArray(x.baf) ? x.baf[0] : x.baf
        agregar(`baf.${x.id}.modalidad_plan`, `${prefijo} — Modalidad`, b?.modalidad_plan)
        agregar(`baf.${x.id}.tv`, `${prefijo} — TV`, b?.tv)
        agregar(`baf.${x.id}.cantidad_decos`, `${prefijo} — Cantidad de decos`, b?.cantidad_decos)
        agregar(`baf.${x.id}.horario_contacto`, `${prefijo} — Horario de contacto`, b?.horario_contacto)
      }

      if (tipo === "PORTA" || tipo === "LINEA_NUEVA") {
        const m: any = Array.isArray(x.movil) ? x.movil[0] : x.movil
        agregar(`movil.${x.id}.numero_linea`, `${prefijo} — Número de línea`, m?.numero_linea)
        agregar(`movil.${x.id}.nim`, `${prefijo} — NIM`, m?.nim)
        agregar(`movil.${x.id}.compania_actual`, `${prefijo} — Compañía actual`, m?.compania_actual)
        agregar(`movil.${x.id}.modalidad_actual`, `${prefijo} — Modalidad actual`, m?.modalidad_actual)
        agregar(`movil.${x.id}.tipo_sim`, `${prefijo} — Tipo SIM`, m?.tipo_sim)
      }
    }

    const { data: historial, error: historialError } = await ctx.admin
      .from("historial_correcciones_venta")
      .select("*")
      .eq("operacion_id", operacionId)
      .order("created_at", { ascending: false })

    if (historialError) throw historialError

    return NextResponse.json({
      solicitudes: solicitudes ?? [],
      puede_solicitar: puedeSolicitar,
      es_gestor: ctx.esGestor,
      motivo_bloqueo: motivoBloqueo,
      campos,
      historial: historial ?? [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudieron consultar las correcciones." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const operacionId = String(body?.operacion_id ?? "").trim()
    const solicitudId = Number(body?.solicitud_id)
    const accion = String(body?.accion ?? "").trim().toUpperCase()
    const motivo = String(body?.motivo ?? "").trim()
    if (!operacionId || !solicitudId || !["RESOLVER", "RECHAZAR"].includes(accion))
      return NextResponse.json({ error: "Solicitud o acción inválida." }, { status: 400 })

    const ctx: any = await contexto(req, operacionId)
    if (ctx.error) return ctx.error
    if (!ctx.esGestor) return NextResponse.json({ error: "No tenés permiso para resolver correcciones." }, { status: 403 })

    const { data: solicitud, error: solError } = await ctx.admin.from("solicitudes_correccion_venta").select("*").eq("id", solicitudId).eq("operacion_id", operacionId).maybeSingle()
    if (solError) throw solError
    if (!solicitud) return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 })
    if (solicitud.estado !== "PENDIENTE") return NextResponse.json({ error: "La solicitud ya fue procesada." }, { status: 409 })

    const nombre = String(ctx.profile?.vendedor ?? "").trim() || String(ctx.profile?.nombre ?? "").trim() || ctx.user.email || "Usuario"
    if (accion === "RECHAZAR") {
      const { error } = await ctx.admin.from("solicitudes_correccion_venta").update({
        estado: "RECHAZADA", resuelto_por: ctx.user.id, resuelto_por_nombre: nombre,
        resolucion_observacion: motivo || null, resolved_at: new Date().toISOString(),
      }).eq("id", solicitudId).eq("estado", "PENDIENTE")
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    const valorNuevo = String(body?.valor_nuevo ?? solicitud.valor_sugerido ?? "").trim()
    if (!valorNuevo) return NextResponse.json({ error: "Falta el valor corregido." }, { status: 400 })

    let campo = String(solicitud.campo_referido ?? "").trim()
    const etiquetas: Record<string,string> = {
      "Cliente — Tipo de documento":"cliente.tipo_documento", "Cliente — DNI":"cliente.dni",
      "Cliente — Nombre":"cliente.nombre", "Cliente — Apellido":"cliente.apellido",
      "Cliente — Fecha de nacimiento":"cliente.fecha_nacimiento", "Cliente — Correo electrónico":"cliente.email",
      "Cliente — Teléfono":"cliente.telefono", "Cliente — Teléfono alternativo":"cliente.telefono_alternativo",
      "Domicilio — Calle / número":"domicilio.calle_nro", "Domicilio — Piso":"domicilio.piso",
      "Domicilio — Departamento":"domicilio.dpto", "Domicilio — Entre calles":"domicilio.entre_calles",
      "Domicilio — Barrio":"domicilio.barrio", "Domicilio — Localidad":"domicilio.localidad",
      "Domicilio — Coordenadas":"domicilio.coordenadas", "Domicilio — Datos adicionales":"domicilio.datos_extras",
      "Operación — Origen del dato":"operacion.origen_dato",
    }
    campo = etiquetas[campo] || campo

    const simples: Record<string,{tabla:string,columna:string}> = {
      "cliente.tipo_documento":{tabla:"clientes",columna:"tipo_documento"}, "cliente.dni":{tabla:"clientes",columna:"dni"},
      "cliente.nombre":{tabla:"clientes",columna:"nombre"}, "cliente.apellido":{tabla:"clientes",columna:"apellido"},
      "cliente.fecha_nacimiento":{tabla:"clientes",columna:"fecha_nacimiento"}, "cliente.email":{tabla:"clientes",columna:"email"},
      "cliente.telefono":{tabla:"clientes",columna:"telefono"}, "cliente.telefono_alternativo":{tabla:"clientes",columna:"telefono_alternativo"},
      "domicilio.calle_nro":{tabla:"domicilios",columna:"calle_nro"}, "domicilio.piso":{tabla:"domicilios",columna:"piso"},
      "domicilio.dpto":{tabla:"domicilios",columna:"dpto"}, "domicilio.entre_calles":{tabla:"domicilios",columna:"entre_calles"},
      "domicilio.barrio":{tabla:"domicilios",columna:"barrio"}, "domicilio.localidad":{tabla:"domicilios",columna:"localidad"},
      "domicilio.coordenadas":{tabla:"domicilios",columna:"coordenadas"}, "domicilio.datos_extras":{tabla:"domicilios",columna:"datos_extras"},
      "operacion.origen_dato":{tabla:"operaciones",columna:"origen_dato"},
    }

    let tabla="", columna="", filtroColumna="", filtroValor:string|number=""
    let productoId:number|null=null
    if (simples[campo]) {
      tabla=simples[campo].tabla; columna=simples[campo].columna
      if (tabla === "operaciones") { filtroColumna="id_operacion"; filtroValor=operacionId }
      else {
        const { data: op, error: opError } = await ctx.admin.from("operaciones").select("cliente_id, domicilio_id").eq("id_operacion", operacionId).single()
        if (opError) throw opError
        filtroColumna="id"; filtroValor=tabla === "clientes" ? op.cliente_id : op.domicilio_id
      }
    } else {
      const partes=campo.split(".")
      if (partes.length !== 3) return NextResponse.json({ error:"El campo solicitado no es editable por este circuito." },{status:400})
      const [grupo,idTxt,col]=partes; productoId=Number(idTxt)
      const permitidos:Record<string,string[]>={baf:["modalidad_plan","tv","cantidad_decos","horario_contacto"],movil:["numero_linea","nim","compania_actual","modalidad_actual","tipo_sim"]}
      if (!productoId || !permitidos[grupo]?.includes(col)) return NextResponse.json({ error:"Ese campo todavía no está habilitado para edición directa." },{status:400})
      const { data: prod, error: prodError } = await ctx.admin.from("operacion_productos").select("id").eq("id",productoId).eq("operacion_id",operacionId).eq("activo",true).maybeSingle()
      if (prodError) throw prodError
      if (!prod) return NextResponse.json({ error:"El producto no pertenece a esta venta." },{status:403})
      tabla=grupo === "baf" ? "operacion_producto_baf" : "operacion_producto_movil"; columna=col; filtroColumna="producto_operacion_id"; filtroValor=productoId
    }

    const { data: actual, error: actualError } = await ctx.admin.from(tabla).select(columna).eq(filtroColumna,filtroValor).maybeSingle()
    if (actualError) throw actualError
    if (!actual) return NextResponse.json({ error:"No se encontró el registro a corregir." },{status:404})
    const valorAnterior=(actual as any)[columna]
    if (String(valorAnterior ?? "") === valorNuevo) return NextResponse.json({ error:"El valor nuevo es igual al valor actual." },{status:409})

    const { error: updateError } = await ctx.admin.from(tabla).update({[columna]:valorNuevo}).eq(filtroColumna,filtroValor)
    if (updateError) throw updateError
    const { error: histError } = await ctx.admin.from("historial_correcciones_venta").insert({
      operacion_id:operacionId, producto_operacion_id:productoId, solicitud_id:solicitudId,
      tabla_origen:tabla, campo:columna, valor_anterior:valorAnterior == null ? null : String(valorAnterior), valor_nuevo:valorNuevo,
      modificado_por:ctx.user.id, modificado_por_nombre:nombre, motivo:motivo || solicitud.observacion || "Corrección solicitada por vendedor",
    })
    if (histError) { await ctx.admin.from(tabla).update({[columna]:valorAnterior}).eq(filtroColumna,filtroValor); throw histError }

    const { error: resolverError } = await ctx.admin.from("solicitudes_correccion_venta").update({
      estado:"RESUELTA", resuelto_por:ctx.user.id, resuelto_por_nombre:nombre,
      resolucion_observacion:motivo || null, resolved_at:new Date().toISOString(),
    }).eq("id",solicitudId).eq("estado","PENDIENTE")
    if (resolverError) throw resolverError
    return NextResponse.json({ok:true})
  } catch(e:any) {
    return NextResponse.json({error:e?.message || "No se pudo procesar la corrección."},{status:500})
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const operacionId = String(body?.operacion_id ?? "").trim()
    const campo = String(body?.campo_referido ?? "").trim()
    const valorActual = String(body?.valor_actual ?? "").trim()
    const valorSugerido = String(body?.valor_sugerido ?? "").trim()
    const observacion = String(body?.observacion ?? "").trim()

    if (!operacionId || !campo || !valorSugerido) {
      return NextResponse.json({ error: "Completá el campo a corregir y el valor correcto." }, { status: 400 })
    }

    const ctx: any = await contexto(req, operacionId)
    if (ctx.error) return ctx.error

    if (ctx.esGestor) {
      return NextResponse.json({ error: "Los usuarios con edición habilitada deben corregir la venta directamente." }, { status: 403 })
    }

    if (!ctx.esPropia) return NextResponse.json({ error: "Solo podés solicitar correcciones de tus ventas." }, { status: 403 })

    if (await tieneEstadoFinal(ctx.admin, operacionId)) {
      return NextResponse.json({ error: "La venta ya alcanzó un estado final y no admite nuevas solicitudes." }, { status: 409 })
    }

    const { data: yaPendiente, error: errorPendiente } = await ctx.admin
      .from("solicitudes_correccion_venta")
      .select("id")
      .eq("operacion_id", operacionId)
      .eq("estado", "PENDIENTE")
      .limit(1)

    if (errorPendiente) throw errorPendiente
    if ((yaPendiente ?? []).length) {
      return NextResponse.json({ error: "Ya existe una solicitud pendiente para esta venta." }, { status: 409 })
    }

    const nombre = String(ctx.profile?.vendedor ?? "").trim() || String(ctx.profile?.nombre ?? "").trim() || ctx.user.email || "Vendedor"

    const { error } = await ctx.admin.from("solicitudes_correccion_venta").insert({
      operacion_id: operacionId,
      solicitado_por: ctx.user.id,
      solicitado_por_nombre: nombre,
      estado: "PENDIENTE",
      campo_referido: campo,
      valor_actual: valorActual || null,
      valor_sugerido: valorSugerido,
      observacion: observacion || null,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo crear la solicitud." }, { status: 500 })
  }
}
