import { POST as preview } from '../preview/route'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  return preview(new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({ ...body, modo: 'opciones', filtros: [] }),
  }))
}
