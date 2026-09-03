import fs from 'node:fs'

import { google } from 'googleapis'

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const REMITENTE = 'soportesistemas@lucom.com.ar'

type CredencialesGoogle = {
  client_email: string
  private_key: string
}

function obtenerCredenciales(): CredencialesGoogle {
  const jsonEnVariable = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (jsonEnVariable) {
    const parsed = JSON.parse(jsonEnVariable) as CredencialesGoogle

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene client_email/private_key.')
    }

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (!credentialsPath) {
    throw new Error(
      'Falta GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS para Gmail.'
    )
  }

  const parsed = JSON.parse(
    fs.readFileSync(credentialsPath, 'utf8')
  ) as CredencialesGoogle

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('El archivo de credenciales no contiene client_email/private_key.')
  }

  return parsed
}

function codificarBase64Url(valor: string) {
  return Buffer.from(valor, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function enviarEmailGmail({
  destinatario,
  asunto,
  mensaje,
}: {
  destinatario: string
  asunto: string
  mensaje: string
}) {
  if (!destinatario || /[\r\n]/.test(destinatario)) {
    throw new Error('Destinatario de email inválido.')
  }

  if (!asunto || /[\r\n]/.test(asunto)) {
    throw new Error('Asunto de email inválido.')
  }

  const credentials = obtenerCredenciales()

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GMAIL_SCOPE],
    subject: REMITENTE,
  })

  const gmail = google.gmail({ version: 'v1', auth })

  const email = [
    `From: Lucom - Notificaciones <${REMITENTE}>`,
    `To: ${destinatario}`,
    `Subject: =?UTF-8?B?${Buffer.from(asunto, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    mensaje,
  ].join('\r\n')

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: codificarBase64Url(email),
    },
  })

  return {
    messageId: data.id ?? null,
  }
}
