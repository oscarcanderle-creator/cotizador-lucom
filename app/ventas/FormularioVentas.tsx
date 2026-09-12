'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import AppHeader from '../../components/AppHeader'

type ProductoCatalogo = { id:number; producto:string; origen:string|null; plan:string; precio_lista:number; descuento_normal:number|null; precio_cliente:number|null; beneficios:string|null }
type ResultadoGuardado = { ok:boolean; mensaje:string; idOperacion?:string }
type Props = { nombreUsuario:string; vendedor:string; rol:string; puedeGestionarVentas:boolean; origenes:string[]; zonas:string[]; tiposDomicilio:string[]; productos:ProductoCatalogo[]; guardarVenta:(formData:FormData)=>Promise<ResultadoGuardado> }
type ServicioNuevo = { id:number; tipo:'BAF'|'PORTA'|'LINEA_NUEVA' }
type ServicioExistente = { id:number; tipo:'BAF'|'LINEA_MOVIL'; modalidad:string }

const companias=['PERSONAL','MOVISTAR','TUENTI']
const tiposDocumento=['DNI','CUIT','LC','LE']
const inputClass='w-full min-h-11 border border-gray-300 rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100'

function Campo({label,name,type='text',required=false,placeholder,inputMode,maxLength,pattern}:{label:string;name:string;type?:string;required?:boolean;placeholder?:string;inputMode?:'text'|'numeric'|'tel'|'email';maxLength?:number;pattern?:string}){
 return <label className="block"><span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">{label}{required?' *':''}</span><input className={inputClass} name={name} type={type} required={required} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} pattern={pattern}/></label>
}

function CampoTelefono({label,name,required=false}:{label:string;name:string;required?:boolean}){
 const permitido=/^(?:$|[1-46-9]\d{0,9})$/
 const teclasControl=new Set(['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'])

 return <label className="block">
  <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">{label}{required?' *':''}</span>
  <input
   className={inputClass}
   name={name}
   type="tel"
   required={required}
   inputMode="numeric"
   maxLength={10}
   pattern="[1-46-9][0-9]{9}"
   title="Debe contener exactamente 10 dígitos y no comenzar con 0 ni 5."
   onKeyDown={(e)=>{
    if(e.ctrlKey||e.metaKey||e.altKey||teclasControl.has(e.key)) return
    if(!/^\d$/.test(e.key)){e.preventDefault();return}
    const input=e.currentTarget
    const inicio=input.selectionStart??input.value.length
    const fin=input.selectionEnd??inicio
    const resultado=input.value.slice(0,inicio)+e.key+input.value.slice(fin)
    if(!permitido.test(resultado)) e.preventDefault()
   }}
   onPaste={(e)=>{
    const input=e.currentTarget
    const pegado=e.clipboardData.getData('text')
    const inicio=input.selectionStart??input.value.length
    const fin=input.selectionEnd??inicio
    const resultado=input.value.slice(0,inicio)+pegado+input.value.slice(fin)
    if(!permitido.test(resultado)) e.preventDefault()
   }}
   onInput={(e)=>{
    if(!permitido.test(e.currentTarget.value)) e.currentTarget.value=''
   }}
  />
 </label>
}
function Selector({label,name,opciones,required=false,defaultValue=''}:{label:string;name:string;opciones:{value:string;label:string}[];required?:boolean;defaultValue?:string}){
 return <label className="block"><span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">{label}{required?' *':''}</span><select className={inputClass} name={name} required={required} defaultValue={defaultValue}><option value="">Seleccionar</option>{opciones.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
}
const opts=(xs:string[])=>xs.map(x=>({value:x,label:x}))

export default function FormularioVentas({nombreUsuario,vendedor,rol,puedeGestionarVentas,origenes,zonas,tiposDomicilio,productos,guardarVenta}:Props){
 const [nuevos,setNuevos]=useState<ServicioNuevo[]>([])
 const [existentes,setExistentes]=useState<ServicioExistente[]>([])
 const [cargaItec,setCargaItec]=useState(false)
 const [guardando,iniciarGuardado]=useTransition(); const [resultado,setResultado]=useState<ResultadoGuardado|null>(null)
 const baf=useMemo(()=>productos.filter(p=>p.producto.toUpperCase().includes('INTERNET') || p.origen?.toUpperCase()==='BAF'),[productos])
 const porta=useMemo(()=>productos.filter(p=>p.producto.toUpperCase()==='PORTABILIDAD'),[productos])
 const ln=useMemo(()=>productos.filter(p=>p.producto.toUpperCase().includes('LINEA NUEVA') || p.producto.toUpperCase().includes('LÍNEA NUEVA')),[productos])
 const agregar=(tipo:ServicioNuevo['tipo'])=>{
  if(tipo==='BAF'&&nuevos.some(x=>x.tipo==='BAF')) return
  const id=Date.now()+Math.random()
  setNuevos(a=>[...a,{id,tipo}])
  window.setTimeout(()=>{
   document.getElementById(`servicio-nuevo-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'})
  },0)
 }
 const agregarExistente=()=>setExistentes(a=>[...a,{id:Date.now()+Math.random(),tipo:'BAF',modalidad:'2PLAY'}])
 async function enviar(e:FormEvent<HTMLFormElement>){e.preventDefault(); if(!nuevos.length){setResultado({ok:false,mensaje:'Agregá al menos un servicio nuevo a contratar.'});return} const form=e.currentTarget; const fd=new FormData(form); fd.set('servicios_nuevos_count',String(nuevos.length)); fd.set('servicios_existentes_count',String(existentes.length)); setResultado(null); iniciarGuardado(async()=>{const r=await guardarVenta(fd);setResultado(r);if(r.ok){form.reset();setNuevos([]);setExistentes([]);setCargaItec(false)}})}
 const tituloProducto=(p:ProductoCatalogo)=>[p.plan,p.origen].filter(Boolean).join(' · ')
 return <main className="min-h-screen bg-gray-100 text-gray-900"><AppHeader rol={rol} usuario={nombreUsuario} actual="VENTAS" puedeGestionarVentas={puedeGestionarVentas}/><form onSubmit={enviar} className="max-w-6xl mx-auto px-2.5 py-3 sm:px-5 sm:py-5 pb-24">
  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><b>PLATAFORMA LUCOM</b> · Nueva venta multiproducto. BAF y móviles se registran únicamente en Supabase.</div>
  <section className="mb-3 rounded-2xl border border-green-300 bg-green-50 p-3"><Selector label="Origen del dato" name="origen_dato" opciones={opts(origenes)} required/></section>
  <section className="mb-3 rounded-xl border bg-white px-3 py-2 text-xs text-gray-500">Usuario <b className="text-gray-800">{nombreUsuario}</b> · Vendedor <b className="text-gray-800">{vendedor}</b></section>
  <Seccion n="01" titulo="Cliente"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"><Campo label="Nombre" name="nombre" required/><Campo label="Apellido" name="apellido" required/><Selector label="Documento" name="tipo_documento" opciones={opts(tiposDocumento)} defaultValue="DNI" required/><Campo label="Número" name="dni" inputMode="numeric" required/><Campo label="Fecha nacimiento" name="fecha_nacimiento" type="date"/><CampoTelefono label="Teléfono" name="telefono" required/><CampoTelefono label="Contacto alternativo" name="telefono_alternativo"/><Campo label="Correo cliente" name="email" type="email" inputMode="email" required/></div></Seccion>
  <Seccion n="02" titulo="Domicilio"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"><div className="sm:col-span-2"><Campo label="Calle y Nro" name="domicilio" required/></div><Campo label="Entre calles" name="entre_calles"/><Campo label="Piso" name="piso"/><Campo label="Dpto" name="dpto"/><Campo label="Barrio" name="barrio"/><Campo label="Localidad" name="localidad"/><Campo label="Coordenadas" name="coordenadas"/><div className="sm:col-span-2"><Campo label="Datos extras" name="datos_extras"/></div></div></Seccion>
  <Seccion n="03" titulo="Servicios Existentes"><p className="text-sm text-gray-600 mb-3">Registrá solamente servicios Claro que el cliente ya posee. No generan una nueva venta.</p><div className="space-y-3">{existentes.map((s,i)=><div key={s.id} className="rounded-xl border bg-gray-50 p-3"><div className="flex justify-between mb-2"><b className="text-sm">Servicio existente {i+1}</b><button type="button" className="text-xs text-red-600" onClick={()=>setExistentes(a=>a.filter(x=>x.id!==s.id))}>Quitar</button></div><div className="grid sm:grid-cols-3 gap-2">
 <label className="block">
  <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1">Tipo *</span>
  <select
   className={inputClass}
   name={`existente_tipo_${i}`}
   value={s.tipo}
   required
   onChange={(e)=>{
    const tipo=e.target.value as ServicioExistente['tipo']
    setExistentes(a=>a.map(x=>x.id===s.id?{...x,tipo,modalidad:tipo==='BAF'?'2PLAY':''}:x))
   }}
  >
   <option value="BAF">Internet Claro</option>
   <option value="LINEA_MOVIL">Línea móvil Claro</option>
  </select>
 </label>
 <Selector
  key={`${s.id}-${s.tipo}`}
  label={s.tipo==='BAF'?'Modalidad':'Plan Pos Pago'}
  name={`existente_modalidad_${i}`}
  opciones={s.tipo==='BAF'?opts(['2PLAY','3PLAY']):opts(['2Gb','4Gb','7Gb','10Gb','30Gb','50Gb'])}
  defaultValue={s.modalidad}
  required
 />
 <Campo
  label={s.tipo==='BAF'?'Observaciones':'NUMERO'}
  name={`existente_numero_${i}`}
 />
</div></div>)}<button type="button" onClick={agregarExistente} className="rounded-xl border border-dashed border-gray-400 px-4 py-2 text-sm font-semibold">+ Agregar servicio existente</button></div></Seccion>
  <Seccion n="04" titulo="Servicios Nuevos a Contratar">
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4"><BotonProducto onClick={()=>agregar('BAF')} disabled={nuevos.some(x=>x.tipo==='BAF')}>+ Internet</BotonProducto><BotonProducto onClick={()=>agregar('PORTA')}>+ Portabilidad</BotonProducto><BotonProducto onClick={()=>agregar('LINEA_NUEVA')}>+ Línea Nueva</BotonProducto></div>
   {rol==='TERRENO'&&nuevos.some(x=>x.tipo==='BAF')&&(
    <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
     <div className="flex items-center justify-between gap-4">
      <div>
       <div className="text-sm font-bold text-blue-900">Carga ITEC</div>
       <div className="text-xs text-blue-700 mt-0.5">Solo para Internet / BAF. Si está apagado, la venta sigue el circuito normal.</div>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
       <input type="checkbox" name="carga_itec" value="SI" checked={cargaItec} onChange={(e)=>setCargaItec(e.target.checked)} className="peer sr-only"/>
       <span className="h-7 w-12 rounded-full bg-gray-300 transition peer-checked:bg-red-600 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"></span>
      </label>
     </div>
    </div>
   )}
   <div className="space-y-3">{nuevos.map((s,i)=>{const lista=s.tipo==='BAF'?baf:s.tipo==='PORTA'?porta:ln;return <div id={`servicio-nuevo-${s.id}`} key={s.id} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-gray-50 p-3"><div className="flex justify-between mb-3"><div><b>{s.tipo==='BAF'?'Internet / BAF':s.tipo==='PORTA'?'Portabilidad':'Línea Nueva'}</b><div className="text-[11px] text-gray-500">Servicio nuevo {i+1}</div></div><button type="button" onClick={()=>setNuevos(a=>a.filter(x=>x.id!==s.id))} className="text-xs text-red-600">Quitar</button></div><input type="hidden" name={`nuevo_tipo_${i}`} value={s.tipo}/>{s.tipo==='BAF'?<><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5"><Selector label="Plan" name={`nuevo_producto_${i}`} opciones={lista.map(p=>({value:String(p.id),label:tituloProducto(p)}))} required/><Selector label="Tipo domicilio" name={`nuevo_tipo_domicilio_${i}`} opciones={opts(tiposDomicilio)}/><Selector label="Modalidad" name={`nuevo_modalidad_${i}`} opciones={opts(['Masivo','Cuit Standard','Cuit BAFE'])} required/><Selector label="TV" name={`nuevo_tv_${i}`} opciones={opts(['NO','SI'])} defaultValue="NO" required/><Selector label="Decos adicionales" name={`nuevo_decos_${i}`} opciones={opts(['0','1','2'])} defaultValue="0"/><Selector label="Zona" name={`nuevo_zona_${i}`} opciones={opts(zonas)}/><div className="sm:col-span-2"><Campo label="Horario contacto / observaciones" name={`nuevo_observaciones_${i}`} required/></div></div>
     {rol==='TERRENO'&&cargaItec&&(
      <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3">
       <div className="mb-3">
        <div className="text-sm font-bold text-blue-900">Datos de carga ITEC</div>
        <div className="text-xs text-gray-500">Al guardar, este BAF quedará registrado directamente con estado CARGADO.</div>
       </div>
       <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Campo label="SDS" name="itec_sds" required pattern="[0-9]{8}[A-Za-z]{3}" maxLength={11} placeholder="8 números + 3 letras"/>
        <Campo label="Orden de Trabajo (OT)" name="itec_ot" required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} placeholder="8 dígitos"/>
        <Campo label="Fecha de Instalación" name="itec_fecha_instalacion" type="date" required/>
        <Selector label="CIA Celular" name="itec_cia_celular" opciones={opts(['CLARO','PERSONAL','MOVISTAR','TUENTI'])} required/>
        <Campo label="Observaciones" name="itec_observaciones" required/>
       </div>
      </div>
     )}
    </>:<div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">{s.tipo==='PORTA'&&<Campo label="NIM a portar" name={`nuevo_nim_${i}`} type="tel" inputMode="numeric" pattern="[1-46-9][0-9]{9}" maxLength={10} required/>}<Selector label="Plan" name={`nuevo_producto_${i}`} opciones={lista.map(p=>({value:String(p.id),label:tituloProducto(p)}))} required/><Selector label="SIM" name={`nuevo_sim_${i}`} opciones={opts(['ESIM','SIMCARD'])} required/>{s.tipo==='PORTA'&&<><Selector label="Compañía actual" name={`nuevo_compania_${i}`} opciones={opts(companias)} required/><Selector label="PRE / POS" name={`nuevo_modalidad_actual_${i}`} opciones={opts(['POS','PRE'])} required/></>}</div>}</div>})}</div></Seccion>
  {resultado&&<div className={`mb-3 rounded-xl border px-3 py-3 text-sm font-medium ${resultado.ok?'border-green-200 bg-green-50 text-green-700':'border-red-200 bg-red-50 text-red-700'}`}>{resultado.mensaje}{resultado.idOperacion&&<div className="font-mono text-xs mt-1">ID: {resultado.idOperacion}</div>}</div>}
  <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-2.5 sm:sticky sm:bg-gray-100/95"><button type="submit" disabled={guardando} className="mx-auto block w-full max-w-6xl sm:w-auto sm:min-w-56 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-6 py-3 disabled:opacity-50">{guardando?'Guardando...':'Guardar venta'}</button></div>
 </form></main>
}
function Seccion({n,titulo,children}:{n:string;titulo:string;children:React.ReactNode}){return <section className="mb-3"><div className="flex items-center gap-2 mb-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">{n}</span><h2 className="font-bold text-sm sm:text-base">{titulo}</h2></div><div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm">{children}</div></section>}
function BotonProducto({children,onClick,disabled=false}:{children:React.ReactNode;onClick:()=>void;disabled?:boolean}){return <button type="button" disabled={disabled} onClick={onClick} className="min-h-14 rounded-2xl border-2 border-red-200 bg-red-50 px-4 font-bold text-red-700 hover:bg-red-100 disabled:opacity-40">{children}</button>}
