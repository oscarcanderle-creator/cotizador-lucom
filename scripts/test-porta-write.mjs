import { google } from 'googleapis'
import fs from 'fs'

const credentialsPath =
  process.env.HOME +
  '/.config/cotizador-lucom/google-service-account.json'

const credentials = JSON.parse(
  fs.readFileSync(credentialsPath, 'utf8')
)

console.log(
  'Cuenta de servicio:',
  credentials.client_email
)

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
})

const sheets = google.sheets({
  version: 'v4',
  auth,
})

const spreadsheetId =
  '1rli9ck3yi_iuy4zDgOXSxucr6khwh2vyH3aFriBnmuU'

const range =
  "'Respuestas de formulario 1'!A185:V195"

async function main() {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

  console.log(
    'Acceso OK. Filas leídas:',
    response.data.values?.length ?? 0
  )

  console.table(
    response.data.values ?? []
  )
}

main().catch((error) => {
  console.error(
    'ERROR:',
    error.response?.data ||
    error.message
  )
})
