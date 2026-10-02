import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import { createClient } from '../../../utils/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'documentacion-dni'
const MAX_BYTES = 10 * 1024 * 1024

const TIPOS_DOCUMENTO = [
  'DNI_FRENTE',
  'DNI_DORSO',
  'DNI_COMPLETO',
  'CHIP_OK',
] as const

const MIME_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
])

function normalizarTipo(valor: unknown) {
  const tipo = String(valor ?? '').trim().toUpperCase()

  return TIPOS_DOCUMENTO.includes(
    tipo as (typeof TIPOS_DOCUMENTO)[number]
  )
    ? tipo
    : null
}

function extensionArchivo(file: File) {
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png') return 'png'
  return 'jpg'
}

async function contextoProducto(productoOperacionId: number) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Sesión no válida.' },
        { status: 401 }
      ),
    }
  }

  const [perfilResult, productoResult] = await Promise.all([
    admin
      .from('profiles')
      .select('rol,activo,puede_gestionar_ventas')
      .eq('id', user.id)
      .maybeSingle(),

    admin
      .from('operacion_productos')
      .select('id,operacion_id,tipo_producto,responsable_id,activo')
      .eq('id', productoOperacionId)
      .eq('activo', true)
      .maybeSingle(),
  ])

  if (perfilResult.error || !perfilResult.data?.activo) {
    return {
      error: NextResponse.json(
        { error: 'No se pudo validar el perfil del usuario.' },
        { status: 403 }
      ),
    }
  }

  if (productoResult.error || !productoResult.data) {
    return {
      error: NextResponse.json(
        { error: 'No se encontró el producto de la Venta.' },
        { status: 404 }
      ),
    }
  }

  const producto = productoResult.data
  const perfil = perfilResult.data

  const tipoProducto = String(producto.tipo_producto ?? '')
    .trim()
    .toUpperCase()

  if (!['PORTA', 'LINEA_NUEVA'].includes(tipoProducto)) {
    return {
      error: NextResponse.json(
        { error: 'La documentación DNI sólo corresponde a productos móviles.' },
        { status: 400 }
      ),
    }
  }

  const rol = String(perfil.rol ?? '').trim().toUpperCase()

  const puedeGestionar =
    ['ADMIN', 'SUPERVISOR', 'BBOO'].includes(rol) ||
    (rol === 'VENDEDOR' && perfil.puede_gestionar_ventas === true)

  /*
   * También permitimos al vendedor originante de la operación.
   * Esto será necesario para la carga inicial desde Ventas.
   */
  const { data: operacion, error: operacionError } = await admin
    .from('operaciones')
    .select('id_operacion,usuario_id')
    .eq('id_operacion', producto.operacion_id)
    .maybeSingle()

  if (operacionError || !operacion) {
    return {
      error: NextResponse.json(
        { error: 'No se encontró la Venta asociada.' },
        { status: 404 }
      ),
    }
  }

  const esVendedorOriginante = operacion.usuario_id === user.id

  if (!puedeGestionar && !esVendedorOriginante) {
    return {
      error: NextResponse.json(
        { error: 'No tiene permisos para acceder a esta documentación.' },
        { status: 403 }
      ),
    }
  }

  return {
    supabase,
    admin,
    user,
    perfil,
    producto,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const productoOperacionId = Number(
    url.searchParams.get('producto_operacion_id') ?? 0
  )

  if (
    !Number.isInteger(productoOperacionId) ||
    productoOperacionId <= 0
  ) {
    return NextResponse.json(
      { error: 'Producto inválido.' },
      { status: 400 }
    )
  }

  const contexto = await contextoProducto(productoOperacionId)

  if ('error' in contexto) return contexto.error

  const { admin, producto } = contexto

  const { data, error } = await admin
    .from('documentos_producto_movil')
    .select(
      'id,tipo_documento,nombre_original,mime_type,tamano_bytes,created_at,created_by,updated_at,eliminado_at,motivo_eliminacion'
    )
    .eq('producto_operacion_id', productoOperacionId)
    .is('eliminado_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    documentos: data ?? [],
    tipo_producto: String(producto.tipo_producto ?? '').trim().toUpperCase(),
  })
}

export async function POST(request: Request) {
  const formData = await request.formData()

  const productoOperacionId = Number(
    formData.get('producto_operacion_id') ?? 0
  )

  const tipoDocumento = normalizarTipo(
    formData.get('tipo_documento')
  )

  const archivo = formData.get('archivo')

  if (
    !Number.isInteger(productoOperacionId) ||
    productoOperacionId <= 0
  ) {
    return NextResponse.json(
      { error: 'Producto inválido.' },
      { status: 400 }
    )
  }

  if (!tipoDocumento) {
    return NextResponse.json(
      { error: 'Tipo de documento inválido.' },
      { status: 400 }
    )
  }

  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { error: 'Debe seleccionar un archivo.' },
      { status: 400 }
    )
  }

  if (!archivo.size || archivo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'El archivo debe pesar como máximo 10 MB.' },
      { status: 400 }
    )
  }

  if (!MIME_PERMITIDOS.has(archivo.type)) {
    return NextResponse.json(
      { error: 'Formato no permitido. Utilice JPG, PNG o PDF.' },
      { status: 400 }
    )
  }

  if (
    tipoDocumento === 'DNI_COMPLETO' &&
    archivo.type !== 'application/pdf'
  ) {
    return NextResponse.json(
      { error: 'DNI completo debe cargarse como PDF.' },
      { status: 400 }
    )
  }

  if (
    ['DNI_FRENTE', 'DNI_DORSO', 'CHIP_OK'].includes(tipoDocumento) &&
    archivo.type === 'application/pdf'
  ) {
    return NextResponse.json(
      { error: 'Frente, Dorso y CHIP-OK deben cargarse como imagen.' },
      { status: 400 }
    )
  }

  const contexto = await contextoProducto(productoOperacionId)

  if ('error' in contexto) return contexto.error

  const { admin, user, producto } = contexto

  // CHIP-OK está habilitado para PORTA y LINEA_NUEVA.
  // contextoProducto() ya valida que se trate de un producto móvil.

  // El nombre del archivo se genera desde el DNI registrado en la Venta.
  // El navegador no decide el número de documento.
  const { data: operacion, error: operacionError } = await admin
    .from('operaciones')
    .select('cliente_id')
    .eq('id_operacion', producto.operacion_id)
    .maybeSingle()

  if (operacionError || !operacion?.cliente_id) {
    return NextResponse.json(
      { error: 'No se pudo identificar el Cliente de la Venta.' },
      { status: 400 }
    )
  }

  const { data: cliente, error: clienteError } = await admin
    .from('clientes')
    .select('dni')
    .eq('id', operacion.cliente_id)
    .maybeSingle()

  if (clienteError || !cliente) {
    return NextResponse.json(
      { error: 'No se pudo obtener el DNI del Cliente.' },
      { status: 400 }
    )
  }

  const dni = String(cliente.dni ?? '').replace(/\D/g, '')

  if (!dni) {
    return NextResponse.json(
      { error: 'El Cliente no tiene un número de documento válido.' },
      { status: 400 }
    )
  }

  const extension = extensionArchivo(archivo)

  const sufijo =
    tipoDocumento === 'DNI_FRENTE'
      ? 'F'
      : tipoDocumento === 'DNI_DORSO'
        ? 'D'
        : tipoDocumento === 'CHIP_OK'
          ? '-CHIP-OK'
          : ''

  const nombreStorage = `${dni}${sufijo}.${extension}`

  const carpeta =
    tipoDocumento === 'DNI_FRENTE'
      ? 'frente'
      : tipoDocumento === 'DNI_DORSO'
        ? 'dorso'
        : tipoDocumento === 'CHIP_OK'
          ? 'chip-ok'
          : 'completo'

  // Storage utiliza un nombre interno opaco para evitar colisiones
  // y permitir reemplazos seguros.
  const nombreInterno = `${crypto.randomUUID()}.${extension}`

  const storagePath =
    tipoDocumento === 'CHIP_OK'
      ? `${productoOperacionId}/chip-ok/${nombreInterno}`
      : `${productoOperacionId}/dni/${carpeta}/${nombreInterno}`

  // Documento vigente anterior del mismo tipo, si existe.
  const { data: documentosAnteriores, error: anterioresError } = await admin
    .from('documentos_producto_movil')
    .select('id,storage_path')
    .eq('producto_operacion_id', productoOperacionId)
    .eq('tipo_documento', tipoDocumento)
    .is('eliminado_at', null)

  if (anterioresError) {
    return NextResponse.json(
      { error: `No se pudo validar la documentación existente: ${anterioresError.message}` },
      { status: 400 }
    )
  }

  const bytes = Buffer.from(await archivo.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: archivo.type,
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo subir el documento: ${uploadError.message}` },
      { status: 400 }
    )
  }

  const { data: documento, error: insertError } = await admin
    .from('documentos_producto_movil')
    .insert({
      producto_operacion_id: productoOperacionId,
      tipo_documento: tipoDocumento,
      storage_path: storagePath,
      nombre_original: nombreStorage,
      mime_type: archivo.type,
      tamano_bytes: archivo.size,
      created_by: user.id,
    })
    .select(
      'id,tipo_documento,nombre_original,mime_type,tamano_bytes,created_at'
    )
    .single()

  if (insertError) {
    await admin.storage
      .from(BUCKET)
      .remove([storagePath])

    return NextResponse.json(
      { error: `No se pudo registrar el documento: ${insertError.message}` },
      { status: 400 }
    )
  }

  // El nuevo documento ya está almacenado y registrado.
  // Ahora retiramos las versiones anteriores del mismo tipo.
  const ahora = new Date().toISOString()

  for (const anterior of documentosAnteriores ?? []) {
    const rutaAnterior = String(anterior.storage_path ?? '')

    const { error: marcarError } = await admin
      .from('documentos_producto_movil')
      .update({
        eliminado_at: ahora,
        motivo_eliminacion: 'REEMPLAZADO',
      })
      .eq('id', anterior.id)

    if (marcarError) {
      console.error(
        'El nuevo DNI fue guardado, pero no se pudo marcar como reemplazada una versión anterior:',
        marcarError
      )
      continue
    }

    if (rutaAnterior) {
      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove([rutaAnterior])

      if (removeError) {
        console.error(
          'No se pudo eliminar del Storage una versión reemplazada del DNI:',
          removeError
        )
      }
    }
  }

  return NextResponse.json({
    ok: true,
    documento,
  })
}

export async function PUT(request: Request) {
  let body: {
    documento_id?: number
    producto_operacion_id?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Solicitud inválida.' },
      { status: 400 }
    )
  }

  const documentoId = Number(body.documento_id ?? 0)
  const productoOperacionId = Number(
    body.producto_operacion_id ?? 0
  )

  if (
    !Number.isInteger(documentoId) ||
    documentoId <= 0 ||
    !Number.isInteger(productoOperacionId) ||
    productoOperacionId <= 0
  ) {
    return NextResponse.json(
      { error: 'Documento inválido.' },
      { status: 400 }
    )
  }

  const contexto = await contextoProducto(productoOperacionId)

  if ('error' in contexto) return contexto.error

  const { admin } = contexto

  const { data: documento, error: documentoError } = await admin
    .from('documentos_producto_movil')
    .select('id,producto_operacion_id,storage_path,eliminado_at')
    .eq('id', documentoId)
    .eq('producto_operacion_id', productoOperacionId)
    .maybeSingle()

  if (documentoError || !documento) {
    return NextResponse.json(
      { error: 'No se encontró el documento.' },
      { status: 404 }
    )
  }

  if (documento.eliminado_at) {
    return NextResponse.json(
      { error: 'Este documento ya fue eliminado.' },
      { status: 410 }
    )
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(documento.storage_path, 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          'No se pudo generar el acceso al documento.',
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    url: data.signedUrl,
    expires_in: 60,
  })
}
