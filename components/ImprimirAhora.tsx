'use client'

export default function ImprimirAhora() {
  return <div className="mb-6 flex gap-3 print:hidden">
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white">Imprimir hojas</button>
    <a href="/logistica?bandeja=EN_PREPARACION" className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-semibold text-gray-800">Volver a Logística</a>
  </div>
}
