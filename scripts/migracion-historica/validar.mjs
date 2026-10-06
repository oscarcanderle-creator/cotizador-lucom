import ExcelJS from 'exceljs';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  if (indice === -1) return null;

  const valor = process.argv[indice + 1];
  if (!valor || valor.startsWith('--')) {
    throw new Error(`Falta valor para ${nombre}`);
  }

  return valor;
}

const ARCHIVO_BAF =
  argumento('--archivo-baf') ||
  '/Users/oscarcanderle/Downloads/VENTAS LUCOM.xlsx';

const ARCHIVO_MOVIL =
  argumento('--archivo-movil') ||
  '/Users/oscarcanderle/Downloads/Portabilidad Lucom.xlsx';

function texto(cell) {
  if (!cell) return '';
  return String(cell.text ?? '').trim();
}

function clave(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function sumar(map, valor) {
  const k = String(valor || '(VACIO)').trim() || '(VACIO)';
  map.set(k, (map.get(k) || 0) + 1);
}

function mostrar(titulo, map, limite = 200) {
  console.log(`\n===== ${titulo} =====`);

  [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limite)
    .forEach(([valor, cantidad]) => {
      console.log(`${String(cantidad).padStart(6)} | ${valor}`);
    });
}

function fechaReal(cell) {
  if (!cell) return false;

  if (cell.value instanceof Date && !Number.isNaN(cell.value.getTime())) {
    return true;
  }

  const t = texto(cell);
  if (!t) return false;

  // Excel puede entregar algunas fechas como número serial.
  const serial = Number(t);
  if (Number.isFinite(serial) && serial >= 1 && serial <= 100000) {
    return true;
  }

  return (
    /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(t) ||
    /^\d{4}-\d{1,2}-\d{1,2}/.test(t)
  );
}

function extraerGB(valor) {
  const s = clave(valor);
  if (!s) return null;

  // FWA no debe confundirse con un plan móvil común.
  if (s.includes('FWA')) return 'FWA';

  const matches = [...s.matchAll(/(\d{1,3})\s*(?:GB|GIGAS?|G)\b/g)];

  if (!matches.length) return null;

  const n = Number(matches[matches.length - 1][1]);
  if (!Number.isFinite(n)) return null;

  return `${n}GB`;
}

function normalizarDocumento(valor) {
  const original = String(valor || '').trim();
  const upper = clave(original);

  const explicitoCUIT = /\bCUIT\b|\bCUIL\b/.test(upper);
  const explicitoDNI = /\bDNI\b|\bD\.?N\.?I\.?\b/.test(upper);

  const digitos = original.replace(/\D/g, '');

  let tipo = 'REVISAR';

  if (digitos.length === 11) tipo = 'CUIT';
  else if (digitos.length === 7 || digitos.length === 8) tipo = 'DNI';

  return {
    original,
    digitos,
    cantidad: digitos.length,
    tipo,
    explicitoCUIT,
    explicitoDNI,
  };
}

function clasificarMovil(spn, estado) {
  const s = clave(spn);
  const e = clave(estado);

  if (
    s === 'LINEA NUEVA' ||
    e === 'LINEA NUEVA ACTIVA' ||
    e === 'LINEA NUEVA ACTIVA S/LEGAJO'
  ) {
    return 'LINEA_NUEVA';
  }

  return 'PORTA';
}

async function cargar(ruta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);

  const ws = wb.getWorksheet('Respuestas de formulario 1');

  if (!ws) {
    throw new Error(`No existe la hoja "Respuestas de formulario 1" en ${ruta}`);
  }

  return ws;
}

async function analizarBAF() {
  const ws = await cargar(ARCHIVO_BAF);

  const estados = new Map();
  const vendedores = new Map();
  const responsables = new Map();
  const origenes = new Map();
  const planes = new Map();
  const zonas = new Map();
  const tiposDomicilio = new Map();
  const prospector = new Map();

  let reales = 0;
  let psr = 0;
  let sinDni = 0;
  let sinVendedor = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    // B = Marca temporal
    if (!fechaReal(row.getCell(2))) continue;

    reales++;

    const responsable = texto(row.getCell(1));
    const vendedor = texto(row.getCell(3));
    const dni = texto(row.getCell(4));
    const plan = texto(row.getCell(12));
    const prospectorValor = texto(row.getCell(15));
    const zona = texto(row.getCell(17));
    const origen = texto(row.getCell(19));
    const tipoDom = texto(row.getCell(22));
    const estado = texto(row.getCell(30));

    sumar(responsables, responsable);
    sumar(vendedores, vendedor);
    sumar(estados, estado);
    sumar(planes, plan);
    sumar(origenes, origen);
    sumar(zonas, zona);
    sumar(tiposDomicilio, tipoDom);
    sumar(prospector, prospectorValor);

    if (clave(vendedor).startsWith('PSR_')) psr++;
    if (!dni) sinDni++;
    if (!vendedor) sinVendedor++;
  }

  console.log('\n\n############################################');
  console.log('BAF');
  console.log('############################################');
  console.log('Registros reales:', reales);
  console.log('Vendedores PSR_:', psr);
  console.log('Sin DNI:', sinDni);
  console.log('Sin vendedor:', sinVendedor);

  mostrar('BAF - ESTADOS', estados);
  mostrar('BAF - PLANES', planes);
  mostrar('BAF - VENDEDORES', vendedores);
  mostrar('BAF - RESPONSABLES', responsables);
  mostrar('BAF - ORIGEN / DETALLE LEAD', origenes);
  mostrar('BAF - ZONAS', zonas);
  mostrar('BAF - TIPO DOMICILIO', tiposDomicilio);
}

async function analizarMovil() {
  const ws = await cargar(ARCHIVO_MOVIL);

  const estados = new Map();
  const vendedores = new Map();
  const responsables = new Map();
  const bboo = new Map();
  const origenes = new Map();
  const companias = new Map();
  const medios = new Map();
  const planesOriginales = new Map();
  const gigasOriginales = new Map();
  const planesFinales = new Map();
  const documentosRevisar = new Map();

  let reales = 0;
  let porta = 0;
  let lineaNueva = 0;
  let psr = 0;

  let docDni = 0;
  let docCuit = 0;
  let docRevisar = 0;

  let planDesdePlan = 0;
  let planRecuperadoGigas = 0;
  let planIndeterminado = 0;
  let planDiferente = 0;
  let plan20 = 0;

  const ejemplosDiferencias = [];
  const ejemplosSinPlan = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    // C = Marca temporal
    if (!fechaReal(row.getCell(3))) continue;

    reales++;

    const responsable = texto(row.getCell(1));
    const vendedor = texto(row.getCell(4));
    const documento = texto(row.getCell(6));
    const gigas = texto(row.getCell(10));
    const compania = texto(row.getCell(11));
    const origen = texto(row.getCell(15));
    const plan = texto(row.getCell(18));
    const spn = texto(row.getCell(20));
    const medio = texto(row.getCell(23));
    const bbooValor = texto(row.getCell(24));
    const estado = texto(row.getCell(29));

    sumar(responsables, responsable);
    sumar(vendedores, vendedor);
    sumar(bboo, bbooValor);
    sumar(estados, estado);
    sumar(origenes, origen);
    sumar(companias, compania);
    sumar(medios, medio);
    sumar(planesOriginales, plan);
    sumar(gigasOriginales, gigas);

    if (clave(vendedor).startsWith('PSR_')) psr++;

    const tipoOperacion = clasificarMovil(spn, estado);
    if (tipoOperacion === 'LINEA_NUEVA') lineaNueva++;
    else porta++;

    const doc = normalizarDocumento(documento);

    if (doc.tipo === 'DNI') {
      docDni++;
    } else if (doc.tipo === 'CUIT') {
      docCuit++;
    } else {
      docRevisar++;
      sumar(
        documentosRevisar,
        `${doc.cantidad} DIGITOS | ${doc.original || '(VACIO)'}`
      );
    }

    const gbPlan = extraerGB(plan);
    const gbGigas = extraerGB(gigas);

    let planFinal = null;

    // Regla acordada: PLAN tiene prioridad.
    if (gbPlan) {
      planFinal = gbPlan;
      planDesdePlan++;

      if (gbGigas && gbPlan !== gbGigas) {
        planDiferente++;

        if (ejemplosDiferencias.length < 50) {
          ejemplosDiferencias.push({
            fila: r,
            vendedor,
            plan,
            gigas,
            elegido: gbPlan,
          });
        }
      }
    } else if (gbGigas) {
      planFinal = gbGigas;
      planRecuperadoGigas++;
    } else {
      planIndeterminado++;

      if (ejemplosSinPlan.length < 100) {
        ejemplosSinPlan.push({
          fila: r,
          vendedor,
          estado,
          spn,
          compania,
          plan,
          gigas,
        });
      }
    }

    if (planFinal === '20GB') plan20++;

    sumar(planesFinales, planFinal || '(INDETERMINADO)');
  }

  console.log('\n\n############################################');
  console.log('PORTA / LINEA NUEVA');
  console.log('############################################');

  console.log('Registros reales:', reales);
  console.log('PORTA:', porta);
  console.log('LINEA NUEVA:', lineaNueva);
  console.log('Vendedores PSR_:', psr);

  console.log('\n--- DOCUMENTOS ---');
  console.log('DNI / MASIVO:', docDni);
  console.log('CUIT / PYME:', docCuit);
  console.log('A REVISAR:', docRevisar);

  console.log('\n--- PLANES ---');
  console.log('Tomados de PLAN:', planDesdePlan);
  console.log('Recuperados desde Gigas:', planRecuperadoGigas);
  console.log('PLAN/GIGAS diferentes:', planDiferente);
  console.log('Indeterminados:', planIndeterminado);
  console.log('Plan histórico 20GB:', plan20);

  mostrar('MOVIL - PLAN FINAL NORMALIZADO', planesFinales);
  mostrar('MOVIL - ESTADOS', estados);
  mostrar('MOVIL - COMPAÑIAS', companias);
  mostrar('MOVIL - MEDIOS DESPACHO', medios);
  mostrar('MOVIL - ORIGEN DATO', origenes);
  mostrar('MOVIL - BBOO', bboo);
  mostrar('MOVIL - RESPONSABLES', responsables);
  mostrar('MOVIL - VENDEDORES', vendedores);

  mostrar('MOVIL - DOCUMENTOS A REVISAR', documentosRevisar, 100);

  console.log('\n===== EJEMPLOS PLAN/GIGAS DIFERENTES =====');
  console.table(ejemplosDiferencias);

  console.log('\n===== EJEMPLOS SIN PLAN DETERMINABLE =====');
  console.table(ejemplosSinPlan);
}

console.log('PREVALIDACION MIGRACION HISTORICA PGL');
console.log('No se realizan escrituras en Supabase.');

await analizarBAF();
await analizarMovil();

console.log('\n============================================');
console.log('PREVALIDACION FINALIZADA');
console.log('============================================');
