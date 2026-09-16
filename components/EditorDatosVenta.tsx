"use client"

import { useEffect, useMemo, useState } from "react"

const N=(v:any)=>String(v??"").trim().toUpperCase()
const input="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"

function etiquetaPlanMovil(p:any){
  const todo=`${p.producto ?? ""} ${p.plan ?? ""}`.toUpperCase().replace(/\s+/g," ").trim()
  if(todo.includes("FWA") && todo.includes("5G") && /400\s*G/.test(todo)) return "FWA 5G 400G"

  const plan=String(p.plan ?? "").toUpperCase().trim()
  const m=plan.match(/(?:^|\D)(2|4|7|10|30|50)\s*(?:GB|GIGAS?|G)\b/)
  return m ? `${m[1]}Gb` : null
}

function catalogoVisible(lista:any[],tipo:string){
  const vistos=new Set<string>()
  const salida:{producto:any;label:string}[]=[]

  for(const p of lista){
    const prod=N(p.producto)
    const origen=N(p.origen)

    if(tipo==="BAF"){
      if(!(prod.includes("INTERNET") || origen==="BAF")) continue

      const label=String(p.plan ?? "").trim()
      if(!label) continue

      const clave=N(label)
      if(vistos.has(clave)) continue
      vistos.add(clave)

      salida.push({producto:p,label})
      continue
    }

    if(tipo==="PORTA"){
      if(prod!=="PORTABILIDAD") continue

      const label=etiquetaPlanMovil(p)
      if(!label || label==="FWA 5G 400G") continue
      if(vistos.has(label)) continue
      vistos.add(label)

      salida.push({producto:p,label})
      continue
    }

    const label=etiquetaPlanMovil(p)
    const esLineaNueva=prod.includes("LINEA NUEVA") || prod.includes("LÍNEA NUEVA")
    const esFwa=label==="FWA 5G 400G"

    if(!label || (!esLineaNueva && !esFwa)) continue
    if(vistos.has(label)) continue
    vistos.add(label)

    salida.push({producto:p,label})
  }

  const orden=new Map([
    ["2Gb",1],
    ["4Gb",2],
    ["7Gb",3],
    ["10Gb",4],
    ["30Gb",5],
    ["50Gb",6],
    ["FWA 5G 400G",7],
  ])

  if(tipo==="PORTA" || tipo==="LINEA_NUEVA"){
    salida.sort((a,b)=>(orden.get(a.label)??99)-(orden.get(b.label)??99))
  }

  return salida
}

export default function EditorDatosVenta({operacionId,sesionToken}:{operacionId:string;sesionToken:string}) {
  const [habilitado,setHabilitado]=useState(false)
  const [data,setData]=useState<any>(null)
  const [mensaje,setMensaje]=useState("")
  const [guardando,setGuardando]=useState(false)

  useEffect(()=>{
    if(!habilitado || data) return
    setMensaje("Cargando datos...")
    fetch(`/api/gestion/datos-venta?operacion_id=${encodeURIComponent(operacionId)}&sesion_token=${encodeURIComponent(sesionToken)}`,{cache:"no-store"})
      .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);setMensaje("")})
      .catch(e=>setMensaje(e.message))
  },[habilitado,data,operacionId,sesionToken])

  const bafMap=useMemo(()=>new Map((data?.baf??[]).map((x:any)=>[Number(x.producto_operacion_id),x])),[data])
  const movMap=useMemo(()=>new Map((data?.movil??[]).map((x:any)=>[Number(x.producto_operacion_id),x])),[data])

  const setZona=(zona:string,campo:string,valor:any)=>setData((d:any)=>({...d,[zona]:{...d[zona],[campo]:valor}}))
  const setProd=(id:number,campo:string,valor:any)=>setData((d:any)=>({...d,productos:d.productos.map((p:any)=>Number(p.id)===id?{...p,[campo]:valor}:p)}))
  const setDetalle=(tipo:string,id:number,campo:string,valor:any)=>setData((d:any)=>{
    const zona=tipo==="BAF"?"baf":"movil"
    return {...d,[zona]:d[zona].map((x:any)=>Number(x.producto_operacion_id)===id?{...x,[campo]:valor}:x)}
  })

  async function guardar(){
    setGuardando(true);setMensaje("")
    try{
      const productos=(data.productos??[]).map((p:any)=>{
        const tipo=N(p.tipo_producto),id=Number(p.id)
        return {id,producto_id:p.producto_id,detalle:tipo==="BAF"?bafMap.get(id):movMap.get(id)}
      })
      const r=await fetch("/api/gestion/datos-venta",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({operacion_id:operacionId,sesion_token:sesionToken,cliente:data.cliente,domicilio:data.domicilio,productos})})
      const j=await r.json();if(!r.ok)throw new Error(j.error)
      setMensaje(`Cambios guardados correctamente: ${j.cambios}.`)
      window.setTimeout(()=>window.location.reload(),700)
    }catch(e:any){setMensaje(e.message)}finally{setGuardando(false)}
  }


  if(!habilitado) return <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-0.5 h-5 w-5 accent-red-600" checked={false} onChange={()=>setHabilitado(true)}/>
      <span><b className="block text-sm">Habilitar edición de datos de la venta</b>
      <small className="mt-1 block text-gray-600">Cliente, Domicilio y servicios originalmente contratados.</small></span>
    </label>
  </div>

  return <div className="space-y-4 rounded-2xl border border-blue-300 bg-blue-50 p-4">
    <label className="flex cursor-pointer gap-3"><input type="checkbox" checked onChange={()=>{setHabilitado(false);setData(null);setMensaje("")}} className="h-5 w-5 accent-red-600"/><b>Edición de datos de la venta habilitada</b></label>
    {mensaje&&<div className="rounded-lg bg-white p-3 text-sm">{mensaje}</div>}
    {data&&<>
      <section className="rounded-xl bg-white p-4"><h3 className="mb-3 font-semibold">Cliente</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Nombre","nombre","text"],
          ["Apellido","apellido","text"],
          ["Documento","tipo_documento","text"],
          ["DNI","dni","text"],
          ["Fecha nacimiento","fecha_nacimiento","date"],
          ["Teléfono","telefono","text"],
          ["Contacto alternativo","telefono_alternativo","text"],
          ["Correo","email","email"],
        ].map(([label,campo,type])=>
          <label key={campo}>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
            <input type={type} className={input} value={data.cliente?.[campo]??""}
              onChange={e=>setZona("cliente",campo,e.target.value)}/>
          </label>
        )}
      </div></section>

      <section className="rounded-xl bg-white p-4"><h3 className="mb-3 font-semibold">Domicilio</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Calle / número","calle_nro"],
          ["Entre calles","entre_calles"],
          ["Piso","piso"],
          ["Dpto","dpto"],
          ["Barrio","barrio"],
          ["Localidad","localidad"],
          ["Coordenadas","coordenadas"],
          ["Datos extras","datos_extras"],
        ].map(([label,campo])=>
          <label key={campo}>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
            <input className={input} value={data.domicilio?.[campo]??""}
              onChange={e=>setZona("domicilio",campo,e.target.value)}/>
          </label>
        )}
      </div></section>

      {(data.productos??[]).map((p:any)=>{
        const id=Number(p.id),tipo=N(p.tipo_producto),detalle:any=tipo==="BAF"?bafMap.get(id):movMap.get(id)
        const catalogo=catalogoVisible(data.catalogo??[],tipo)
        return <section key={id} className="rounded-xl bg-white p-4">
          <h3 className="mb-3 font-semibold">{tipo==="BAF"?"Internet":tipo==="PORTA"?"Portabilidad":"Línea Nueva"} #{p.orden}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Producto / Plan contratado</span>
              <select className={input} value={p.producto_id??""} onChange={e=>setProd(id,"producto_id",Number(e.target.value))}>
                {catalogo.map((c:any)=><option key={c.producto.id} value={c.producto.id}>{c.label}</option>)}
              </select></label>
            {(tipo==="BAF"
              ? [
                  ["Modalidad","modalidad_plan"],
                  ["TV","tv"],
                  ["Cantidad decos","cantidad_decos"],
                  ["Horario contacto","horario_contacto"],
                ]
              : [
                  ["Número línea","numero_linea"],
                  ["NIM","nim"],
                  ["Compañía actual","compania_actual"],
                  ["Modalidad actual","modalidad_actual"],
                  ["Tipo SIM","tipo_sim"],
                  ...(tipo==="PORTA" ? [["Línea Titular (SI/NO)","linea_titular"]] : []),
                ]
            ).map(([label,campo])=>
              <label key={campo}>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                {(campo==="tv" || campo==="linea_titular") ? (
                  <select
                    className={input}
                    value={
                      detalle?.[campo] === true ||
                      N(detalle?.[campo]) === "SI" ||
                      N(detalle?.[campo]) === "TRUE"
                        ? "SI"
                        : "NO"
                    }
                    onChange={e=>
                      setDetalle(
                        tipo,
                        id,
                        campo,
                        campo==="linea_titular"
                          ? e.target.value==="SI"
                          : e.target.value
                      )
                    }
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>
                ) : (
                  <input
                    className={input}
                    value={detalle?.[campo]??""}
                    onChange={e=>setDetalle(tipo,id,campo,e.target.value)}
                  />
                )}
              </label>
            )}
          </div>
        </section>
      })}
      <div className="flex justify-end"><button type="button" onClick={guardar} disabled={guardando} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{guardando?"Guardando...":"Guardar corrección de datos"}</button></div>
    </>}
  </div>
}
