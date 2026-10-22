type Props = {
  fecha: string | null
  fotoUrl: string | null
  tieneFoto: boolean
}

export default function ComprobanteEntregaVenta({
  fecha,
  fotoUrl,
  tieneFoto,
}: Props) {
  if (!fecha) return null

  const fechaFormateada = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha))

  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-current/15 pt-3">
      <div>
        <p className="text-xs font-semibold uppercase opacity-70">
          Fecha de entrega
        </p>
        <p className="mt-1 text-sm font-bold">{fechaFormateada}</p>
      </div>

      {fotoUrl ? (
        <a
          href={fotoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-current/20 bg-white/70 p-2 text-sm font-semibold text-red-700 hover:bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoUrl}
            alt="Comprobante fotográfico de entrega"
            className="h-14 w-14 rounded-md object-cover"
          />
          <span>Ver fotografía completa ↗</span>
        </a>
      ) : (
        <p className="text-xs opacity-70">
          {tieneFoto
            ? 'No se pudo cargar el comprobante fotográfico.'
            : 'Sin comprobante fotográfico registrado.'}
        </p>
      )}
    </div>
  )
}
