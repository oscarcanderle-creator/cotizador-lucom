import { google } from 'googleapis'
import fs from 'fs'

const credentialsPath =
  process.env.HOME +
  '/.config/cotizador-lucom/google-service-account.json'

const credentials = JSON.parse(
  fs.readFileSync(credentialsPath, 'utf8')
)

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

const sheets = google.sheets({
  version: 'v4',
  auth,
})

const spreadsheetId =
  '1-Yzx6jGICgeX8T_Ne06fSCsPaXeVZ5yxv9NB5YOJat4'

const range = 'Tablas!A1:J38'

async function main() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })

  const rows = response.data.values || []

  console.log(`Filas leídas: ${rows.length}`)
  console.table(rows.slice(0, 10))
}

main().catch((error) => {
  console.error('ERROR:', error.message)
})
