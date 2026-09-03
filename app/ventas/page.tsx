import { redirect } from 'next/navigation'
import { google } from 'googleapis'
import fs from 'fs'

import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'

import FormularioVentas from './FormularioVentas'

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? '').trim()
}

function soloDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function fechaHoraArgentina() {
  const ahora = new Date()

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora)

  const get = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? ''

  const milisegundos = String(ahora.getMilliseconds()).padStart(3, '0')
  const fecha = `${get('year')}-${get('month')}-${get('day')}`
  const hora = `${get('hour')}:${get('minute')}:${get('second')}`

  return {
    isoArgentina: `${fecha}T${hora}.${milisegundos}-03:00`,
    idFecha: `${get('year')}${get('month')}${get('day')}`,
    idHora: `${get('hour')}${get('minute')}${get('second')}`,
    milisegundos,
  }
}


const PORTA_SPREADSHEET_ID =
  '1cz9I_CykAvHl_VHX4-wtKwdZsrcVRh8PPAAm2ZvaXN8'

const PORTA_SHEET = 'Respuestas de formulario 1'

const BAF_SPREADSHEET_ID =
  '1rli9ck3yi_iuy4zDgOXSxucr6khwh2vyH3aFriBnmuU'

const BAF_SHEET = 'Respuestas de formulario 1'

const FACTIBILIDAD_SPREADSHEET_ID =
  '1sWOyrucfH5N17iVkhHhOcwOiK01ILfzPBivJ-fTwS5A'

const FACTIBILIDAD_SHEET = 'Respuestas BBOO 2021'

function fechaSheetArgentina(isoArgentina: string) {
  const [fecha, resto] = isoArgentina.split('T')
  const [anio, mes, dia] = fecha.split('-')
  const hora = resto.slice(0, 8)
  return `${Number(dia)}/${Number(mes)}/${anio} ${hora}`
}

function fechaNacimientoSheet(valor: string) {
  if (!valor) return ''
  const [anio, mes, dia] = valor.split('-')
  if (!anio || !mes || !dia) return valor
  return `${Number(dia)}/${Number(mes)}/${anio}`
}

function documentoSheet(tipoDocumento: string, numero: string) {
  return tipoDocumento === 'DNI'
    ? numero
    : `${tipoDocumento} ${numero}`
}

function domicilioPortaSheet(formData: FormData) {
  return [
    texto(formData, 'domicilio'),
    texto(formData, 'piso') ? `Piso ${texto(formData, 'piso')}` : '',
    texto(formData, 'dpto') ? `Dpto ${texto(formData, 'dpto')}` : '',
    texto(formData, 'entre_calles') ? `Entre calles: ${texto(formData, 'entre_calles')}` : '',
    texto(formData, 'barrio') ? `Barrio: ${texto(formData, 'barrio')}` : '',
    texto(formData, 'localidad') ? `Localidad: ${texto(formData, 'localidad')}` : '',
    texto(formData, 'coordenadas') ? `Coordenadas: ${texto(formData, 'coordenadas')}` : '',
    texto(formData, 'datos_extras'),
  ].filter(Boolean).join(' - ')
}


function googleSheetsClient() {
  const credentialsJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  let credentials

  if (credentialsJson) {
    credentials = JSON.parse(credentialsJson)
  } else {
    const home = process.env.HOME

    if (!home) {
      throw new Error(
        'Falta configurar GOOGLE_SERVICE_ACCOUNT_JSON'
      )
    }

    const credentialsPath =
      home +
      '/.config/cotizador-lucom/google-service-account.json'

    credentials = JSON.parse(
      fs.readFileSync(credentialsPath, 'utf8')
    )
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  })

  return google.sheets({
    version: 'v4',
    auth,
  })
}

function filaActualizada(updatedRange: string) {
  const match =
    updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/)

  return match ? Number(match[1]) : null
}

async function proximaFilaReal(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  columnaMarcaTemporal: 'B' | 'C'
) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!${columnaMarcaTemporal}:${columnaMarcaTemporal}`,
  })

  const filas = response.data.values ?? []

  let ultimaFila = 1

  filas.forEach((fila, indice) => {
    const valor = String(fila?.[0] ?? '').trim()

    if (valor !== '') {
      ultimaFila = indice + 1
    }
  })

  return ultimaFila + 1
}

function planBafSheet(formData: FormData) {
  return [
    texto(formData, 'plan'),
    texto(formData, 'modalidad_plan'),
  ].filter(Boolean).join(' ')
}

async function agregarBafTesting(
  formData: FormData,
  marcaTemporal: string,
  vendedor: string
) {
  const sheets = googleSheetsClient()

  const bloquePrincipal = [
    fechaSheetArgentina(marcaTemporal),
    vendedor,
    soloDigitos(texto(formData, 'dni')),
    `${texto(formData, 'apellido')} ${texto(formData, 'nombre')}`.trim(),
    fechaNacimientoSheet(texto(formData, 'fecha_nacimiento')),
    texto(formData, 'domicilio'),
    texto(formData, 'entre_calles'),
    soloDigitos(texto(formData, 'telefono')),
    soloDigitos(texto(formData, 'telefono_alternativo')),
    texto(formData, 'email'),
    planBafSheet(formData),
    texto(formData, 'tv'),
    texto(formData, 'cantidad_decos') || '0',
  ]

  const filaSheet = await proximaFilaReal(
    sheets,
    BAF_SPREADSHEET_ID,
    BAF_SHEET,
    'B'
  )

  await sheets.spreadsheets.values.update({
    spreadsheetId: BAF_SPREADSHEET_ID,
    range: `'${BAF_SHEET}'!B${filaSheet}:N${filaSheet}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [bloquePrincipal],
    },
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: BAF_SPREADSHEET_ID,
    range: `'${BAF_SHEET}'!Q${filaSheet}:V${filaSheet}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        texto(formData, 'zona'),
        texto(formData, 'horario_contacto'),
        texto(formData, 'origen_dato'),
        texto(formData, 'convergente'),
        soloDigitos(texto(formData, 'linea_convergente')),
        texto(formData, 'tipo_domicilio'),
      ]],
    },
  })

  return {
    filaSheet,
  }
}

async function agregarFactibilidadTesting(
  formData: FormData,
  marcaTemporal: string,
  vendedor: string
) {
  const sheets = googleSheetsClient()

  // A Responsable es una columna de gestión.
  // El bloque del formulario es B:K.
  const fila = [
    fechaSheetArgentina(marcaTemporal),
    vendedor,
    texto(formData, 'tipo_domicilio'),
    texto(formData, 'domicilio'),
    texto(formData, 'entre_calles'),
    `${texto(formData, 'nombre')} ${texto(formData, 'apellido')}`.trim(),
    documentoSheet(
      texto(formData, 'tipo_documento'),
      soloDigitos(texto(formData, 'dni'))
    ),
    soloDigitos(texto(formData, 'telefono')),
    soloDigitos(texto(formData, 'linea_claro_consultar')),
    texto(formData, 'pedido_rellamado'),
  ]

  const filaSheet = await proximaFilaReal(
    sheets,
    FACTIBILIDAD_SPREADSHEET_ID,
    FACTIBILIDAD_SHEET,
    'B'
  )

  await sheets.spreadsheets.values.update({
    spreadsheetId: FACTIBILIDAD_SPREADSHEET_ID,
    range: `'${FACTIBILIDAD_SHEET}'!B${filaSheet}:K${filaSheet}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [fila],
    },
  })

  return {
    filaSheet,
  }
}

async function agregarPortaTesting(
  formData: FormData,
  marcaTemporal: string,
  vendedor: string
) {
  const sheets = googleSheetsClient()

  const esLineaNueva =
    formData.get('es_linea_nueva') === 'on'

  const tipoDocumento = texto(formData, 'tipo_documento')
  const dni = soloDigitos(texto(formData, 'dni'))

  const companiaSheet = esLineaNueva
    ? 'Linea Nueva'
    : [
        texto(formData, 'compania_actual'),
        texto(formData, 'prepago_pospago'),
      ].filter(Boolean).join(' ')

  // A Responsable y B Prospector APP son columnas de gestión.
  // Quedan intactas. El bloque del formulario es C:O.
  const fila = [
    fechaSheetArgentina(marcaTemporal),
    vendedor,
    `${texto(formData, 'nombre')} ${texto(formData, 'apellido')}`.trim(),
    documentoSheet(tipoDocumento, dni),
    fechaNacimientoSheet(texto(formData, 'fecha_nacimiento')),
    esLineaNueva ? '9999999999' : soloDigitos(texto(formData, 'nim')),
    texto(formData, 'email'),
    texto(formData, 'plan'),
    companiaSheet,
    soloDigitos(texto(formData, 'telefono_alternativo')),
    domicilioPortaSheet(formData),
    texto(formData, 'observaciones'),
    texto(formData, 'origen_dato'),
  ]

  const filaSheet = await proximaFilaReal(
    sheets,
    PORTA_SPREADSHEET_ID,
    PORTA_SHEET,
    'C'
  )

  await sheets.spreadsheets.values.update({
    spreadsheetId: PORTA_SPREADSHEET_ID,
    range: `'${PORTA_SHEET}'!C${filaSheet}:O${filaSheet}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [fila],
    },
  })

  return {
    filaSheet,
  }
}


type LineaPortaInput = {
  nim: string
  plan: string
  companiaActual: string
  prepagoPospago: string
}

function lineasPortaDesdeFormData(
  formData: FormData,
  esLineaNueva: boolean
): LineaPortaInput[] {
  const cantidad = Math.max(
    1,
    Number(texto(formData, 'porta_line_count')) || 1
  )

  const lineas: LineaPortaInput[] = []

  for (let i = 0; i < cantidad; i += 1) {
    const plan = texto(formData, `plan_${i}`)

    if (esLineaNueva) {
      if (plan) {
        lineas.push({
          nim: '9999999999',
          plan,
          companiaActual: '',
          prepagoPospago: '',
        })
      }

      continue
    }

    const nim = texto(formData, `nim_${i}`)
    const companiaActual = texto(formData, `compania_actual_${i}`)
    const prepagoPospago = texto(formData, `prepago_pospago_${i}`)

    if (nim || plan || companiaActual || prepagoPospago) {
      lineas.push({
        nim,
        plan,
        companiaActual,
        prepagoPospago,
      })
    }
  }

  return lineas
}

function formDataParaLineaPorta(
  formData: FormData,
  linea: LineaPortaInput,
  esLineaNueva: boolean
) {
  const copia = new FormData()

  formData.forEach((value, key) => {
    copia.append(key, value)
  })

  copia.set('plan', linea.plan)
  copia.set('nim', esLineaNueva ? '' : linea.nim)
  copia.set('compania_actual', linea.companiaActual)
  copia.set('prepago_pospago', linea.prepagoPospago)

  return copia
}

export default async function VentasPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, vendedor, rol, activo, puede_gestionar_ventas')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo) {
    redirect('/login')
  }

  const [
    { data: planesPorta },
    { data: planesBaf },
    { data: origenes },
    { data: zonas },
    { data: tiposDomicilio },
  ] = await Promise.all([
    supabase.from('catalogo_planes_porta').select('nombre').eq('activo', true).order('orden'),
    supabase.from('catalogo_planes_baf').select('nombre').eq('activo', true).order('orden'),
    supabase.from('catalogo_origenes').select('nombre').eq('activo', true).order('orden'),
    supabase.from('catalogo_zonas').select('nombre').eq('activo', true).order('orden'),
    supabase.from('catalogo_tipos_domicilio').select('nombre').eq('activo', true).order('orden'),
  ])

  const nombreUsuario = profile.nombre?.trim() || user.email || 'Usuario'
  const vendedor = profile.vendedor?.trim() || nombreUsuario

  async function guardarVenta(
    formData: FormData
  ): Promise<{ ok: boolean; mensaje: string; idOperacion?: string }> {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, mensaje: 'La sesión expiró. Volvé a iniciar sesión.' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, vendedor, rol, activo')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.activo) {
      return { ok: false, mensaje: 'El usuario no está habilitado.' }
    }

    const tipo = texto(formData, 'tipo')
    if (!['BAF', 'PORTA', 'FACTIBILIDAD'].includes(tipo)) {
      return { ok: false, mensaje: 'Tipo de operación inválido.' }
    }

    const tipoDocumento = texto(formData, 'tipo_documento')
    const dni = soloDigitos(texto(formData, 'dni'))

    if (!['DNI', 'CUIT', 'LC', 'LE'].includes(tipoDocumento) || !dni) {
      return { ok: false, mensaje: 'Completá correctamente el documento.' }
    }

    const nombre = texto(formData, 'nombre')
    const apellido = texto(formData, 'apellido')

    const telefono = texto(formData, 'telefono')
    const telefonoAlternativo =
      texto(formData, 'telefono_alternativo')
    const lineaConvergente =
      texto(formData, 'linea_convergente')

    if (!nombre || !apellido || !telefono) {
      return {
        ok: false,
        mensaje:
          'Nombre, apellido y teléfono son obligatorios.',
      }
    }

    if (!/^[1-46-9]\d{9}$/.test(telefono)) {
      return {
        ok: false,
        mensaje:
          'El teléfono debe contener exactamente 10 dígitos, sin espacios ni guiones, y no puede comenzar con 0 ni con 5.',
      }
    }

    if (
      telefonoAlternativo &&
      !/^[1-46-9]\d{9}$/.test(telefonoAlternativo)
    ) {
      return {
        ok: false,
        mensaje:
          'El contacto alternativo debe contener exactamente 10 dígitos, sin espacios ni guiones, y no puede comenzar con 0 ni con 5.',
      }
    }

    if (
      lineaConvergente &&
      !/^[1-46-9]\d{9}$/.test(lineaConvergente)
    ) {
      return {
        ok: false,
        mensaje:
          'La línea convergente debe contener exactamente 10 dígitos, sin espacios ni guiones, y no puede comenzar con 0 ni con 5.',
      }
    }

    const domicilio = texto(formData, 'domicilio')
    const entreCalles = texto(formData, 'entre_calles')
    const localidad = texto(formData, 'localidad')

    if (!domicilio) {
      return { ok: false, mensaje: 'El domicilio es obligatorio.' }
    }

    const admin = createAdminClient()
    const marca = fechaHoraArgentina()
    const idOperacionBase =
      `${marca.idFecha}-${marca.idHora}-${marca.milisegundos}-${dni}`

    let idOperacion = idOperacionBase
    let operacionCreada = false

    try {
      const {
        data: clienteExistente,
        error: errorBuscarCliente,
      } = await admin
        .from('clientes')
        .select('id')
        .eq('tipo_documento', tipoDocumento)
        .eq('dni', dni)
        .maybeSingle()

      if (errorBuscarCliente) throw errorBuscarCliente

      let clienteId: number

      if (clienteExistente) {
        clienteId = clienteExistente.id

        const { error } = await admin
          .from('clientes')
          .update({
            nombre,
            apellido,
            fecha_nacimiento: texto(formData, 'fecha_nacimiento') || null,
            email: texto(formData, 'email') || null,
            telefono,
            telefono_alternativo:
              soloDigitos(texto(formData, 'telefono_alternativo')) || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clienteId)

        if (error) throw error
      } else {
        const {
          data: nuevoCliente,
          error,
        } = await admin
          .from('clientes')
          .insert({
            tipo_documento: tipoDocumento,
            dni,
            nombre,
            apellido,
            fecha_nacimiento: texto(formData, 'fecha_nacimiento') || null,
            email: texto(formData, 'email') || null,
            telefono,
            telefono_alternativo:
              soloDigitos(texto(formData, 'telefono_alternativo')) || null,
          })
          .select('id')
          .single()

        if (error) throw error
        clienteId = nuevoCliente.id
      }

      const {
        data: nuevoDomicilio,
        error: errorDomicilio,
      } = await admin
        .from('domicilios')
        .insert({
          cliente_id: clienteId,
          calle_nro: domicilio,
          piso: texto(formData, 'piso') || null,
          dpto: texto(formData, 'dpto') || null,
          entre_calles: entreCalles || null,
          barrio: texto(formData, 'barrio') || null,
          localidad: localidad || null,
          coordenadas: texto(formData, 'coordenadas') || null,
          datos_extras: texto(formData, 'datos_extras') || null,
        })
        .select('id')
        .single()

      if (errorDomicilio) throw errorDomicilio

      const vendedor =
        profile.vendedor?.trim() ||
        profile.nombre?.trim() ||
        user.email ||
        'Vendedor'

      if (tipo === 'PORTA') {
        const esLineaNueva =
          formData.get('es_linea_nueva') === 'on'

        const lineas =
          lineasPortaDesdeFormData(formData, esLineaNueva)

        if (lineas.length === 0) {
          return {
            ok: false,
            mensaje: 'Debe ingresar al menos una línea.',
          }
        }

        if (!esLineaNueva) {
          const nims = lineas.map((linea) => linea.nim)

          const nimInvalido = nims.find(
            (nim) => !/^[1-46-9]\d{9}$/.test(nim)
          )

          if (nimInvalido) {
            return {
              ok: false,
              mensaje:
                'Cada NIM debe contener exactamente 10 dígitos, sin espacios ni guiones, y no puede comenzar con 0 ni con 5.',
            }
          }

          const vistos = new Set<string>()
          const duplicado = nims.find((nim) => {
            if (vistos.has(nim)) return true
            vistos.add(nim)
            return false
          })

          if (duplicado) {
            return {
              ok: false,
              mensaje:
                `El NIM ${duplicado} está repetido en esta carga. ` +
                'Cada línea debe tener un NIM diferente.',
            }
          }
        }

        for (const [indice, linea] of lineas.entries()) {
          if (!linea.plan) {
            return {
              ok: false,
              mensaje: `Falta seleccionar los Gigas de la línea ${indice + 1}.`,
            }
          }

          if (!esLineaNueva) {
            if (!linea.nim) {
              return {
                ok: false,
                mensaje: `Falta el NIM de la línea ${indice + 1}.`,
              }
            }

            if (!linea.companiaActual || !linea.prepagoPospago) {
              return {
                ok: false,
                mensaje:
                  `Falta Compañía o PRE/POS en la línea ${indice + 1}.`,
              }
            }
          }
        }

        const grupoOperacion =
          `${marca.idFecha}-${marca.idHora}-${dni}`

        const idsCreados: string[] = []

        for (const [indice, linea] of lineas.entries()) {
          const numeroLinea = indice + 1
          const idLinea =
            `${idOperacionBase}-${String(numeroLinea).padStart(2, '0')}`

          const { error: errorOperacionPorta } = await admin
            .from('operaciones')
            .insert({
              id_operacion: idLinea,
              tipo,
              cliente_id: clienteId,
              domicilio_id: nuevoDomicilio.id,
              usuario_id: user.id,
              vendedor,
              fecha_hora: marca.isoArgentina,
              origen_dato: texto(formData, 'origen_dato') || null,
              estado_sync: 'PENDIENTE',
              sheet_destino: tipo,
              grupo_operacion: grupoOperacion,
            })

          if (errorOperacionPorta) throw errorOperacionPorta

          idsCreados.push(idLinea)

          const { error: errorDetallePorta } = await admin
            .from('operaciones_porta')
            .insert({
              operacion_id: idLinea,
              nim: esLineaNueva ? '9999999999' : linea.nim,
              es_linea_nueva: esLineaNueva,
              gigas_acordados: linea.plan || null,
              compania_actual:
                esLineaNueva ? null : linea.companiaActual || null,
              prepago_pospago:
                esLineaNueva ? null : linea.prepagoPospago || null,
              observaciones: texto(formData, 'observaciones') || null,
              numero_linea: numeroLinea,
            })

          if (errorDetallePorta) throw errorDetallePorta

          const formDataLinea =
            formDataParaLineaPorta(
              formData,
              linea,
              esLineaNueva
            )

          try {
            const sync = await agregarPortaTesting(
              formDataLinea,
              marca.isoArgentina,
              vendedor
            )

            const { error: errorSync } = await admin
              .from('operaciones')
              .update({
                estado_sync: 'SINCRONIZADA',
                fila_sheet: sync.filaSheet,
                error_sync: null,
              })
              .eq('id_operacion', idLinea)

            if (errorSync) {
              console.error(
                'La línea PORTA se escribió en Google Sheets, pero falló la actualización del estado de sincronización:',
                errorSync
              )
            }
          } catch (errorSheet) {
            const mensajeSheet =
              errorSheet instanceof Error
                ? errorSheet.message
                : 'Error desconocido al sincronizar con Google Sheets'

            await admin
              .from('operaciones')
              .update({
                estado_sync: 'ERROR_SHEET',
                error_sync: mensajeSheet,
              })
              .eq('id_operacion', idLinea)

            return {
              ok: false,
              mensaje:
                `Se guardaron ${idsCreados.length} operación(es) en Supabase, ` +
                `pero falló la sincronización de la línea ${numeroLinea} con el Sheet PORTA: ` +
                mensajeSheet,
              idOperacion: idLinea,
            }
          }
        }

        return {
          ok: true,
          mensaje:
            lineas.length === 1
              ? 'PORTA guardada y sincronizada correctamente.'
              : `${lineas.length} líneas PORTA guardadas y sincronizadas correctamente.`,
          idOperacion: grupoOperacion,
        }
      }

      const { error: errorOperacion } = await admin
        .from('operaciones')
        .insert({
          id_operacion: idOperacion,
          tipo,
          cliente_id: clienteId,
          domicilio_id: nuevoDomicilio.id,
          usuario_id: user.id,
          vendedor,
          fecha_hora: marca.isoArgentina,
          origen_dato: texto(formData, 'origen_dato') || null,
          estado_sync: 'PENDIENTE',
          sheet_destino: tipo,
        })

      if (errorOperacion) throw errorOperacion
      operacionCreada = true

      if (tipo === 'BAF') {
        const { error } = await admin
          .from('operaciones_baf')
          .insert({
            operacion_id: idOperacion,
            tipo_domicilio: texto(formData, 'tipo_domicilio') || null,
            plan: texto(formData, 'plan') || null,
            modalidad_plan: texto(formData, 'modalidad_plan') || null,
            tv: texto(formData, 'tv') === 'SI',
            cantidad_decos: Number(texto(formData, 'cantidad_decos') || 0),
            zona: texto(formData, 'zona') || null,
            horario_contacto: texto(formData, 'horario_contacto') || null,
            convergente: texto(formData, 'convergente') || null,
            linea_convergente:
              soloDigitos(texto(formData, 'linea_convergente')) || null,
          })

        if (error) throw error

        try {
          const sync = await agregarBafTesting(
            formData,
            marca.isoArgentina,
            vendedor
          )

          await admin
            .from('operaciones')
            .update({
              estado_sync: 'SINCRONIZADA',
              fila_sheet: sync.filaSheet,
              error_sync: null,
            })
            .eq('id_operacion', idOperacion)
        } catch (errorSheet) {
          const mensajeSheet =
            errorSheet instanceof Error
              ? errorSheet.message
              : 'Error desconocido al sincronizar BAF con Google Sheets'

          await admin
            .from('operaciones')
            .update({
              estado_sync: 'ERROR_SHEET',
              error_sync: mensajeSheet,
            })
            .eq('id_operacion', idOperacion)

          return {
            ok: false,
            mensaje:
              'La operación quedó guardada en Supabase, pero no pudo sincronizarse con el Sheet BAF de testing: ' +
              mensajeSheet,
            idOperacion,
          }
        }
      }

      if (tipo === 'FACTIBILIDAD') {
        const { error } = await admin
          .from('operaciones_factibilidad')
          .insert({
            operacion_id: idOperacion,
            tipo_domicilio: texto(formData, 'tipo_domicilio') || null,
            pedido_rellamado: texto(formData, 'pedido_rellamado') || null,
            observaciones: texto(formData, 'observaciones') || null,
            linea_claro_consultar:
              soloDigitos(texto(formData, 'linea_claro_consultar')) || null,
          })

        if (error) throw error

        try {
          const sync = await agregarFactibilidadTesting(
            formData,
            marca.isoArgentina,
            vendedor
          )

          await admin
            .from('operaciones')
            .update({
              estado_sync: 'SINCRONIZADA',
              fila_sheet: sync.filaSheet,
              error_sync: null,
            })
            .eq('id_operacion', idOperacion)
        } catch (errorSheet) {
          const mensajeSheet =
            errorSheet instanceof Error
              ? errorSheet.message
              : 'Error desconocido al sincronizar Factibilidad con Google Sheets'

          await admin
            .from('operaciones')
            .update({
              estado_sync: 'ERROR_SHEET',
              error_sync: mensajeSheet,
            })
            .eq('id_operacion', idOperacion)

          return {
            ok: false,
            mensaje:
              'La operación quedó guardada en Supabase, pero no pudo sincronizarse con el Sheet FACTIBILIDAD de testing: ' +
              mensajeSheet,
            idOperacion,
          }
        }
      }

      return {
        ok: true,
        mensaje: 'Operación guardada correctamente en el entorno de pruebas.',
        idOperacion,
      }
    } catch (error) {
      console.error(error)

      if (operacionCreada) {
        await admin
          .from('operaciones')
          .delete()
          .eq('id_operacion', idOperacion)
      }

      return {
        ok: false,
        mensaje:
          error instanceof Error
            ? error.message
            : 'No se pudo guardar la operación.',
      }
    }
  }

  return (
    <FormularioVentas
      nombreUsuario={nombreUsuario}
      vendedor={vendedor}
      rol={profile.rol}
      puedeGestionarVentas={profile.puede_gestionar_ventas === true}
      planesPorta={(planesPorta ?? []).map((x) => x.nombre)}
      planesBaf={(planesBaf ?? []).map((x) => x.nombre)}
      origenes={(origenes ?? []).map((x) => x.nombre)}
      zonas={(zonas ?? []).map((x) => x.nombre)}
      tiposDomicilio={(tiposDomicilio ?? []).map((x) => x.nombre)}
      guardarVenta={guardarVenta}
    />
  )
}
