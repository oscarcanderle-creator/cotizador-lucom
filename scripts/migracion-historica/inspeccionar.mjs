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

const archivos = [
  ARCHIVO_BAF,
  ARCHIVO_MOVIL,
];

for (const archivo of archivos) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);

  console.log('\n==================================================');
  console.log('ARCHIVO:', archivo);
  console.log('==================================================');

  for (const ws of wb.worksheets) {
    console.log('\nHOJA:', ws.name);
    console.log('Filas físicas:', ws.rowCount);
    console.log('Columnas:', ws.columnCount);

    const fila1 = ws.getRow(1);

    console.log('\nENCABEZADOS:');

    for (let col = 1; col <= ws.columnCount; col++) {
      const valor = fila1.getCell(col).text.trim();
      console.log(`${col}: ${JSON.stringify(valor)}`);
    }
  }
}
