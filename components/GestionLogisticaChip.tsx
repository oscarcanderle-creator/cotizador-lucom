'use client'

import { useMemo, useState } from 'react'

type Medio={id:number;nombre:string}

function normalizar(v:string){
 return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()
}

export default function GestionLogisticaChip({
 medios,
 medioInicial,
 seguimientoInicial,
 idEnvio,
 legajoEnviado,
 esBboo,
 puedeEditar,
}:{
 medios:Medio[]
 medioInicial:number|string|null
 seguimientoInicial:string|null
 idEnvio:string|null
 legajoEnviado:boolean
 esBboo:boolean
 puedeEditar:boolean
}){
 const [medio,setMedio]=useState(String(medioInicial??''))
 const [legajo,setLegajo]=useState(Boolean(legajoEnviado))
 const nombre=useMemo(()=>normalizar(medios.find(m=>String(m.id)===medio)?.nombre??''),[medio,medios])
 const permiteSeguimiento=esBboo && ['ANDREANI','CADETERIA','TERRENO'].includes(nombre)
 const generaId=esBboo && ['CADETERIA','TERRENO'].includes(nombre)

 return <div className="contents">
  <div>
   <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Medio de despacho CHIP</label>
   <select name="medio_despacho_chip_id" value={medio} onChange={e=>setMedio(e.target.value)}
    disabled={!puedeEditar}
    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100">
    <option value="">Sin informar</option>
    {medios.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
   </select>
  </div>
  <div>
   <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Seguimiento</label>
   <input name="numero_seguimiento" defaultValue={seguimientoInicial??''}
    disabled={!puedeEditar || !permiteSeguimiento}
    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 opacity-100 disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-100"/>
   {!esBboo && <p className="mt-1 text-xs text-gray-500">Editable únicamente por BBOO.</p>}
  </div>
  {esBboo && <div>
   <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">ID Envío</label>
   <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">
    {generaId ? (idEnvio || 'Se generará cuando exista SDS y el estado sea CARGADO STL') : '-'}
   </div>
  </div>}
  <div>
   <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Legajo Enviado</label>
   <label className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 ${esBboo&&puedeEditar?'border-gray-300 bg-white':'border-gray-200 bg-gray-100'}`}>
    <input type="checkbox" name="legajo_enviado" value="SI" checked={legajo}
     onChange={e=>setLegajo(e.target.checked)}
     disabled={!esBboo || !puedeEditar} className="h-5 w-5 accent-red-600"/>
    <span className="text-sm font-semibold text-gray-700">SI</span>
   </label>
   {(!esBboo) && <p className="mt-1 text-xs text-gray-500">Editable únicamente por BBOO.</p>}
  </div>
 </div>
}
