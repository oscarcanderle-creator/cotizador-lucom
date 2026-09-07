import { redirect } from 'next/navigation'

import { revalidatePath } from 'next/cache'

import { createClient } from '../../../utils/supabase/server'

import AppHeader from '../../../components/AppHeader'

import SincronizarGoogleSheets from '../../../components/SincronizarGoogleSheets'

type Producto = {

  id: number

  catalogo_plan_id: number | null

  producto: string

  origen: string

  plan: string

  precio_lista: number | null

  descuento_normal: number | null

  precio_cliente: number | null

  beneficios: string | null

  activo: boolean

  orden: number | null

}

type CatalogoPlanMovil = {

  id: number

  nombre: string

  precio_lista: number | null

  activo: boolean

  orden: number | null

}

function n(value: FormDataEntryValue | null, fallback = 0) {

  if (value === null || value === '') return fallback

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback

}

function texto(value: FormDataEntryValue | null) {

  const v = String(value ?? '').trim()

  return v || null

}

function dinero(valor: number | null) {

  return new Intl.NumberFormat('es-AR', {

    style: 'currency',

    currency: 'ARS',

    maximumFractionDigits: 0,

  }).format(Number(valor ?? 0))

}

async function validarAdmin() {

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase

    .from('profiles')

    .select('nombre, rol, activo')

    .eq('id', user.id)

    .single()

  if (!profile || !profile.activo || profile.rol !== 'ADMIN') {

    redirect('/cotizador')

  }

  return { supabase, user, profile }

}

export default async function AdminPreciosPage({

  searchParams,

}: {

  searchParams: Promise<{ negocio?: string }>

}) {

  const { supabase, user, profile } = await validarAdmin()

  const params = await searchParams

  const negocio = params.negocio?.toUpperCase() === 'PYME'

    ? 'PYME'

    : 'MASIVO'

  const { data, error } = await supabase

    .from('productos')

    .select('id, catalogo_plan_id, producto, origen, plan, precio_lista, descuento_normal, precio_cliente, beneficios, activo, orden')

    .eq('negocio', negocio)

    .order('orden', { ascending: true })

    .order('id', { ascending: true })

  if (error) throw new Error(error.message)

  const productos = (data ?? []) as Producto[]

  const { data: catalogoMovilData, error: catalogoMovilError } = await supabase

    .from('catalogo_planes_porta')

    .select('id, nombre, precio_lista, activo, orden')

    .eq('negocio', negocio)

    .order('orden', { ascending: true })

    .order('id', { ascending: true })

  if (catalogoMovilError) throw new Error(catalogoMovilError.message)

  const catalogoMovil = (catalogoMovilData ?? []) as CatalogoPlanMovil[]

  const movilesPorCatalogo = new Map<number, Producto[]>()

  for (const p of productos) {

    if (

      (p.producto === 'PORTABILIDAD' || p.producto === 'LINEA NUEVA') &&

      p.catalogo_plan_id !== null

    ) {

      movilesPorCatalogo.set(

        p.catalogo_plan_id,

        [...(movilesPorCatalogo.get(p.catalogo_plan_id) ?? []), p]

      )

    }

  }

  const internet = productos.filter(

    (p) => p.origen?.toUpperCase() === 'BAF' && p.producto === 'Internet Fibra optica'

  )

  const iptv = productos.filter((p) => p.producto === 'CLARO TV')

  const decos = productos.filter((p) => p.producto === 'DECODIFICADOR TV ADICIONAL')

  const packsTv = productos.filter((p) => p.producto === 'PACK TV')

  const packsDatos = productos.filter((p) => p.producto === 'PACK DATOS')

  const otros = productos.filter(

    (p) =>

      !['PORTABILIDAD', 'LINEA NUEVA', 'Internet Fibra optica', 'CLARO TV',

        'DECODIFICADOR TV ADICIONAL', 'PACK TV', 'PACK DATOS'].includes(p.producto)

  )

  async function guardarProducto(formData: FormData) {

    'use server'

    const { supabase } = await validarAdmin()

    const { error } = await supabase.rpc('admin_guardar_producto_precio', {

      p_id: n(formData.get('id')),

      p_precio_lista: n(formData.get('precio_lista')),

      p_descuento_normal:

        formData.get('descuento_normal') === '' ? null : n(formData.get('descuento_normal')),

      p_beneficios: texto(formData.get('beneficios')),

      p_activo: formData.get('activo') === 'on',

      p_orden: n(formData.get('orden')),

    })

    if (error) throw new Error(error.message)

    revalidatePath('/admin/precios')

    revalidatePath('/cotizador')

  }

  async function guardarPlanMovil(formData: FormData) {

    'use server'

    const { supabase } = await validarAdmin()

    const { error } = await supabase.rpc('admin_guardar_plan_movil_negocio', {

      p_catalogo_plan_id: n(formData.get('catalogo_plan_id')),

      p_precio_lista: n(formData.get('precio_lista')),

      p_desc_movistar: n(formData.get('movistar')),

      p_desc_personal: n(formData.get('personal')),

      p_desc_tuenti: n(formData.get('tuenti')),

      p_desc_linea_nueva: n(formData.get('linea_nueva')),

    })

    if (error) throw new Error(error.message)

    revalidatePath('/admin/precios')

    revalidatePath('/cotizador')

  }

  async function crearPlanMovil(formData: FormData) {

    'use server'

    const { supabase } = await validarAdmin()

    const nombreCatalogo = String(formData.get('nombre') ?? '').trim()

    const nombreProducto = nombreCatalogo.replace(/GB$/i, ' Gigas')

    const { error } = await supabase.rpc('admin_crear_plan_movil_negocio', {

      p_negocio: negocio,

      p_nombre_catalogo: nombreCatalogo,

      p_nombre_producto: nombreProducto,

      p_precio_lista: n(formData.get('precio_lista')),

      p_desc_movistar: n(formData.get('movistar')),

      p_desc_personal: n(formData.get('personal')),

      p_desc_tuenti: n(formData.get('tuenti')),

      p_desc_linea_nueva: n(formData.get('linea_nueva')),

      p_beneficio_movistar: null,

      p_beneficio_personal: null,

      p_beneficio_tuenti: null,

      p_beneficio_linea_nueva: null,

    })

    if (error) throw new Error(error.message)

    revalidatePath('/admin/precios')

    revalidatePath('/admin/planes-porta')

    revalidatePath('/cotizador')

  }

  async function crearPlanBaf(formData: FormData) {

    'use server'

    const { supabase } = await validarAdmin()

    const nombre = String(formData.get('nombre') ?? '').trim()

    const { error } = await supabase.rpc('admin_crear_plan_baf_negocio', {

      p_negocio: negocio,

      p_nombre_catalogo: nombre,

      p_nombre_producto: nombre,

      p_precio_lista: n(formData.get('precio_lista')),

      p_beneficios: texto(formData.get('beneficios')),

    })

    if (error) throw new Error(error.message)

    revalidatePath('/admin/precios')

    revalidatePath('/cotizador')

  }

  async function crearGeneral(formData: FormData) {

    'use server'

    const { supabase } = await validarAdmin()

    const { error } = await supabase.rpc('admin_crear_producto_precio_negocio', {

      p_negocio: negocio,

      p_producto: String(formData.get('producto') ?? '').trim(),

      p_origen: String(formData.get('origen') ?? '').trim(),

      p_plan: String(formData.get('plan') ?? '').trim(),

      p_precio_lista: n(formData.get('precio_lista')),

      p_descuento_normal:

        formData.get('descuento_normal') === '' ? null : n(formData.get('descuento_normal')),

      p_beneficios: texto(formData.get('beneficios')),

      p_activo: true,

      p_orden: null,

    })

    if (error) throw new Error(error.message)

    revalidatePath('/admin/precios')

    revalidatePath('/cotizador')

  }

  const seccion = (titulo: string, items: Producto[]) => (

    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      <div className="px-5 py-4 border-b border-gray-200">

        <h3 className="font-semibold text-gray-900">{titulo}</h3>

      </div>

      <div className="divide-y divide-gray-100">

        {items.length === 0 && (

          <div className="p-5 text-sm text-gray-500">Sin productos cargados.</div>

        )}

        {items.map((p) => (

          <form key={p.id} action={guardarProducto} className="p-4">

            <input type="hidden" name="id" value={p.id} />

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_150px_120px_90px_1.5fr_auto] gap-3 items-end">

              <div>

                <div className="text-xs text-gray-500">

                  {p.producto === 'DECODIFICADOR TV ADICIONAL'

                    ? 'DECODIFICADOR TV ADICIONAL (hasta 2)'

                    : `${p.producto} · ${p.origen}`}

                </div>

                <div className="font-semibold text-gray-900">

                  {p.producto === 'DECODIFICADOR TV ADICIONAL' && p.plan === 'NA'

                    ? 'DECO ADIC'

                    : p.plan}

                </div>

                <div className="text-xs text-gray-400 mt-1">Cliente: {dinero(p.precio_cliente)}</div>

              </div>

              <label className="text-xs text-gray-500">

                Precio lista

                <input name="precio_lista" type="number" min="0" step="1"

                  defaultValue={p.precio_lista ?? 0}

                  className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-900" />

              </label>

              <label className="text-xs text-gray-500">

                Descuento %

                <input name="descuento_normal" type="number" min="0" max="100" step="0.01"

                  defaultValue={p.descuento_normal ?? ''}

                  className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-900" />

              </label>

              <label className="text-xs text-gray-500">

                Orden

                <input name="orden" type="number" min="0" step="1"

                  defaultValue={p.orden ?? 0}

                  className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-900" />

              </label>

              <label className="text-xs text-gray-500">

                Beneficios

                <input name="beneficios" defaultValue={p.beneficios ?? ''}

                  className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-900" />

              </label>

              <div className="flex items-center gap-3">

                <label className="flex items-center gap-2 text-sm text-gray-700">

                  <input name="activo" type="checkbox" defaultChecked={p.activo} />

                  Activo

                </label>

                <button className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg">

                  Guardar

                </button>

              </div>

            </div>

          </form>

        ))}

      </div>

    </section>

  )

  return (

    <main className="min-h-screen bg-gray-50">

      <AppHeader

        rol={profile.rol}

        usuario={profile.nombre?.trim() || user.email || 'Administrador'}

        actual="ADMIN"

      />

      <div className="max-w-7xl mx-auto px-4 py-6 sm:p-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

          <div>

            <h2 className="text-2xl font-semibold text-gray-900">Lista de Precios</h2>

            <p className="text-sm text-gray-500 mt-1">

              Fuente maestra interna de precios, descuentos y beneficios.

            </p>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            {negocio === 'MASIVO' && <SincronizarGoogleSheets />}

            <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">

              Volver al administrador

            </a>

          </div>

        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">

          <a

            href="/admin/precios?negocio=MASIVO"

            className={`rounded-lg px-4 py-2 text-sm font-semibold ${

              negocio === 'MASIVO'

                ? 'bg-red-600 text-white'

                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

            }`}

          >

            MASIVO

          </a>

          <a

            href="/admin/precios?negocio=PYME"

            className={`rounded-lg px-4 py-2 text-sm font-semibold ${

              negocio === 'PYME'

                ? 'bg-red-600 text-white'

                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

            }`}

          >

            PYME

          </a>

          <span className="ml-2 text-sm text-gray-500">

            Negocio actual: <strong className="text-gray-800">{negocio}</strong>

          </span>

        </div>

        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">

          <div className="px-5 py-4 border-b border-gray-200">

            <h3 className="font-semibold text-gray-900">Planes Móvil</h3>

            <p className="text-xs text-gray-500 mt-1">

              Un único precio de lista por plan. Los descuentos se administran por modalidad y compañía.

            </p>

          </div>

          <div className="divide-y divide-gray-100">

            {catalogoMovil.length === 0 && (

              <div className="p-5 text-sm text-gray-500">Sin planes móviles cargados.</div>

            )}

            {catalogoMovil.map((plan) => {

              const filas = movilesPorCatalogo.get(plan.id) ?? []

              const movistar = filas.find(

                (p) => p.producto === 'PORTABILIDAD' && p.origen === 'MOVISTAR'

              )

              const personal = filas.find(

                (p) => p.producto === 'PORTABILIDAD' && p.origen === 'PERSONAL'

              )

              const tuenti = filas.find(

                (p) => p.producto === 'PORTABILIDAD' && p.origen === 'TUENTI'

              )

              const linea = filas.find((p) => p.producto === 'LINEA NUEVA')

              const completo = Boolean(movistar && personal && tuenti && linea)

              return (

                <form key={plan.id} action={guardarPlanMovil} className="p-5">

                  <input type="hidden" name="catalogo_plan_id" value={plan.id} />

                  <div className="flex flex-col xl:flex-row xl:items-end gap-4">

                    <div className="xl:w-28">

                      <div className="text-xs text-gray-500">Plan</div>

                      <div className="text-lg font-semibold text-gray-900">{plan.nombre}</div>

                      {!plan.activo && (

                        <div className="text-xs text-amber-700 mt-1">Plan inactivo</div>

                      )}

                    </div>

                    <label className="text-xs text-gray-500 xl:w-40">

                      Precio lista

                      <input

                        name="precio_lista"

                        type="number"

                        min="0"

                        step="1"

                        required

                        defaultValue={plan.precio_lista ?? 0}

                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"

                      />

                    </label>

                    <label className="text-xs text-gray-500 xl:w-32">

                      Movistar %

                      <input

                        name="movistar"

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        required

                        defaultValue={movistar?.descuento_normal ?? 0}

                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"

                      />

                    </label>

                    <label className="text-xs text-gray-500 xl:w-32">

                      Personal %

                      <input

                        name="personal"

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        required

                        defaultValue={personal?.descuento_normal ?? 0}

                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"

                      />

                    </label>

                    <label className="text-xs text-gray-500 xl:w-32">

                      Tuenti %

                      <input

                        name="tuenti"

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        required

                        defaultValue={tuenti?.descuento_normal ?? 0}

                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"

                      />

                    </label>

                    <label className="text-xs text-gray-500 xl:w-36">

                      Línea Nueva %

                      <input

                        name="linea_nueva"

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        required

                        defaultValue={linea?.descuento_normal ?? 0}

                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"

                      />

                    </label>

                    <button

                      disabled={!completo}

                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg whitespace-nowrap"

                    >

                      Guardar plan

                    </button>

                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">

                    <span>Movistar: {dinero(movistar?.precio_cliente ?? null)}</span>

                    <span>Personal: {dinero(personal?.precio_cliente ?? null)}</span>

                    <span>Tuenti: {dinero(tuenti?.precio_cliente ?? null)}</span>

                    <span>Línea Nueva: {dinero(linea?.precio_cliente ?? null)}</span>

                  </div>

                  {!completo && (

                    <div className="mt-2 text-xs text-red-700">

                      Este plan no tiene las cuatro variantes móviles vinculadas y no puede guardarse.

                    </div>

                  )}

                </form>

              )

            })}

          </div>

          <details className="border-t border-gray-200 p-4">

            <summary className="cursor-pointer font-medium text-red-700">+ Agregar plan móvil</summary>

            <form action={crearPlanMovil} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3 mt-4">

              <input name="nombre" required placeholder="Ej. 15GB" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

              <input name="precio_lista" required type="number" min="0" placeholder="Precio lista" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

              <input name="movistar" required type="number" min="0" max="100" placeholder="Movistar %" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

              <input name="personal" required type="number" min="0" max="100" placeholder="Personal %" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

              <input name="tuenti" required type="number" min="0" max="100" placeholder="Tuenti %" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

              <input name="linea_nueva" required type="number" min="0" max="100" placeholder="Línea Nueva %" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

              <button className="bg-red-600 text-white font-semibold rounded-lg px-4 py-2">Agregar</button>

            </form>

          </details>

        </section>

        <div className="space-y-5">

          {seccion('Internet', internet)}

          {seccion('IPTV', iptv)}

          {seccion('Decos adicionales', decos)}

          {seccion('Packs TV', packsTv)}

          {seccion('Packs Datos', packsDatos)}

          {otros.length > 0 && seccion('Otros productos', otros)}

        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-5 mt-5">

          <h3 className="font-semibold text-gray-900">Agregar producto / pack</h3>

          <p className="text-xs text-gray-500 mt-1 mb-4">

            Para IPTV, Deco, Packs TV, Packs Datos y Pack Datos FWA 5G.

          </p>

          <form action={crearGeneral} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

            <input name="producto" required placeholder="Producto / categoría" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="origen" required placeholder="Origen" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="plan" required placeholder="Plan / nombre" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="precio_lista" required type="number" min="0" placeholder="Precio lista" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="descuento_normal" type="number" min="0" max="100" placeholder="Descuento % (opcional)" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="beneficios" placeholder="Beneficios (opcional)" className="border rounded-lg px-3 py-2 lg:col-span-2" />

            <button className="bg-red-600 text-white font-semibold rounded-lg px-4 py-2">Agregar producto</button>

          </form>

        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 mt-5">

          <h3 className="font-semibold text-gray-900">Agregar plan Internet</h3>

          <form action={crearPlanBaf} className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">

            <input name="nombre" required placeholder="Ej. 1000Mb" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="precio_lista" required type="number" min="0" placeholder="Precio lista" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <input name="beneficios" placeholder="Beneficios" className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400" />

            <button className="bg-red-600 text-white font-semibold rounded-lg px-4 py-2">Agregar Internet</button>

          </form>

        </section>

      </div>

    </main>

  )

}
