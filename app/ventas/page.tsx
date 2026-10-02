import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { createAdminClient } from '../../utils/supabase/admin'
import FormularioVentas from './FormularioVentas'

function texto(fd:FormData,c:string){return String(fd.get(c)??'').trim()}
function digitos(v:string){return v.replace(/\D/g,'')}
function marcaArgentina(){const a=new Date();const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(a);const g=(t:string)=>p.find(x=>x.type===t)?.value??'';const ms=String(a.getMilliseconds()).padStart(3,'0');return{iso:`${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}.${ms}-03:00`,id:`${g('year')}${g('month')}${g('day')}-${g('hour')}${g('minute')}${g('second')}-${ms}`}}
type Nuevo={tipo:string;productoId:number;nim:string;sim:string;compania:string;modalidadActual:string;lineaTitular:boolean;tipoDomicilio:string;modalidad:string;tv:boolean;decos:number;zona:string;observaciones:string;pagoModem:string;cuotasModem:number|null}
type Existente={tipo:string;modalidad:string;numero:string}
function nuevosDesde(fd:FormData){const n=Math.max(0,Number(texto(fd,'servicios_nuevos_count'))||0);const r:Nuevo[]=[];for(let i=0;i<n;i++)r.push({tipo:texto(fd,`nuevo_tipo_${i}`),productoId:Number(texto(fd,`nuevo_producto_${i}`)),nim:digitos(texto(fd,`nuevo_nim_${i}`)),sim:texto(fd,`nuevo_sim_${i}`),compania:texto(fd,`nuevo_compania_${i}`),modalidadActual:texto(fd,`nuevo_modalidad_actual_${i}`),lineaTitular:texto(fd,`nuevo_linea_titular_${i}`)==='SI',tipoDomicilio:texto(fd,`nuevo_tipo_domicilio_${i}`),modalidad:texto(fd,`nuevo_modalidad_${i}`),tv:texto(fd,`nuevo_tv_${i}`)==='SI',decos:Number(texto(fd,`nuevo_decos_${i}`)||0),zona:texto(fd,`nuevo_zona_${i}`),observaciones:texto(fd,`nuevo_observaciones_${i}`),pagoModem:texto(fd,`nuevo_pago_modem_${i}`),cuotasModem:texto(fd,`nuevo_cuotas_modem_${i}`)?Number(texto(fd,`nuevo_cuotas_modem_${i}`)):null});return r}
function existentesDesde(fd:FormData){const n=Math.max(0,Number(texto(fd,'servicios_existentes_count'))||0);const r:Existente[]=[];for(let i=0;i<n;i++)r.push({tipo:texto(fd,`existente_tipo_${i}`),modalidad:texto(fd,`existente_modalidad_${i}`),numero:texto(fd,`existente_numero_${i}`)});return r}

export default async function VentasPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const {data:profile}=await supabase.from('profiles').select('nombre,vendedor,rol,activo,puede_gestionar_ventas').eq('id',user.id).single();if(!profile||!profile.activo)redirect('/login')
 const [{data:origenes},{data:zonas},{data:tiposDomicilio},{data:productos}]=await Promise.all([
  supabase.from('catalogo_origenes').select('nombre').eq('activo',true).order('orden'),supabase.from('catalogo_zonas').select('nombre').eq('activo',true).order('orden'),supabase.from('catalogo_tipos_domicilio').select('nombre').eq('activo',true).order('orden'),supabase.from('productos').select('id,producto,origen,plan,precio_lista,descuento_normal,precio_cliente,beneficios').eq('activo',true).order('orden')])
 const nombreUsuario=profile.nombre?.trim()||user.email||'Usuario';const vendedor=profile.vendedor?.trim()||nombreUsuario
 async function guardarVenta(fd:FormData):Promise<{ok:boolean;mensaje:string;idOperacion?:string}>{'use server'
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return{ok:false,mensaje:'La sesión expiró. Volvé a iniciar sesión.'}
  const {data:perfil}=await sb.from('profiles').select('nombre,vendedor,rol,activo').eq('id',user.id).single();if(!perfil||!perfil.activo)return{ok:false,mensaje:'El usuario no está habilitado.'}
  const cargaItecSolicitada=texto(fd,'carga_itec')==='SI'
  if(cargaItecSolicitada&&perfil.rol!=='TERRENO')return{ok:false,mensaje:'La carga ITEC está habilitada únicamente para usuarios con rol TERRENO.'}
  const itec={
   sds:texto(fd,'itec_sds').toUpperCase(),
   ot:digitos(texto(fd,'itec_ot')),
   fechaInstalacion:texto(fd,'itec_fecha_instalacion'),
   turno:texto(fd,'itec_turno'),
   ciaCelular:texto(fd,'itec_cia_celular').toUpperCase(),
  }
  const tipoDoc=texto(fd,'tipo_documento'),dni=digitos(texto(fd,'dni')),nombre=texto(fd,'nombre'),apellido=texto(fd,'apellido'),telefono=texto(fd,'telefono'),telefonoAlternativo=texto(fd,'telefono_alternativo'),email=texto(fd,'email')
  const emailValido=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if(!['DNI','CUIT','LC','LE'].includes(tipoDoc)||!dni)return{ok:false,mensaje:'Completá correctamente el documento.'};if(!nombre||!apellido||!/^[1-46-9]\d{9}$/.test(telefono))return{ok:false,mensaje:'Completá nombre, apellido y un teléfono válido de 10 dígitos que no comience con 0 ni 5.'};if(telefonoAlternativo&&!/^[1-46-9]\d{9}$/.test(telefonoAlternativo))return{ok:false,mensaje:'El contacto alternativo debe tener 10 dígitos y no comenzar con 0 ni 5.'};if(!emailValido)return{ok:false,mensaje:'Completá Correo Cliente con un email válido.'}
  const domicilio=texto(fd,'domicilio')
  const origenDato=texto(fd,'origen_dato')
 const obs=origenDato.toUpperCase()==='PSR' ? texto(fd,'obs') : ''
  if(!domicilio)return{ok:false,mensaje:'Completá Calle y Nro en la sección Domicilio.'}
  if(!origenDato)return{ok:false,mensaje:'Seleccioná Origen del dato.'}
 if(origenDato.toUpperCase()==='PSR'&&!obs)return{ok:false,mensaje:'Completá OBS con el ID del prospecto de Mis Referidos.'}
  const nuevos=nuevosDesde(fd),existentes=existentesDesde(fd);if(!nuevos.length)return{ok:false,mensaje:'Agregá al menos un servicio nuevo a contratar.'};if(nuevos.filter(x=>x.tipo==='BAF').length>1)return{ok:false,mensaje:'Una venta puede contener como máximo un Internet/BAF nuevo.'}
  const tieneBafNuevo=nuevos.some(x=>x.tipo==='BAF')
  const habilitaAnadirTv=existentes.some(x=>x.tipo==='BAF'&&x.modalidad==='2PLAY')
  if(cargaItecSolicitada&&!tieneBafNuevo)return{ok:false,mensaje:'La carga ITEC solo puede utilizarse cuando la venta incluye Internet / BAF.'}
  if(cargaItecSolicitada){
   if(!/^[0-9]{8}[A-Z]{3}$/.test(itec.sds))return{ok:false,mensaje:'El SDS de ITEC debe contener exactamente 8 números y 3 letras.'}
   if(!/^[0-9]{8}$/.test(itec.ot))return{ok:false,mensaje:'La Orden de Trabajo de ITEC debe contener exactamente 8 dígitos.'}
   if(!/^\d{4}-\d{2}-\d{2}$/.test(itec.fechaInstalacion))return{ok:false,mensaje:'Completá Fecha de Instalación para la carga ITEC.'}
   if(!['Turno Mañana','Turno Tarde'].includes(itec.turno))return{ok:false,mensaje:'Seleccioná Turno Mañana o Turno Tarde para la carga ITEC.'}
   if(!['CLARO','PERSONAL','MOVISTAR','TUENTI'].includes(itec.ciaCelular))return{ok:false,mensaje:'Seleccioná una CIA Celular válida para la carga ITEC.'}
  }
  for(const [i,s] of nuevos.entries()){
   if(!['BAF','PORTA','LINEA_NUEVA'].includes(s.tipo)||!s.productoId)return{ok:false,mensaje:`Servicio nuevo ${i+1} incompleto.`}
   if(s.tipo==='BAF'){
    if((!habilitaAnadirTv&&!s.tipoDomicilio)||!s.modalidad||!s.observaciones)return{ok:false,mensaje:'Completá todos los campos obligatorios de Internet / BAF.'}
    if(!['0','1','2'].includes(String(s.decos)))return{ok:false,mensaje:'La cantidad de decos adicionales no es válida.'}
    if(!s.tv&&s.decos!==0)return{ok:false,mensaje:'Si TV está en NO, Decos adicionales debe ser 0.'}
   }
   if(s.tipo==='PORTA'){
    if(!/^[1-46-9]\d{9}$/.test(s.nim))return{ok:false,mensaje:`El NIM de la Portabilidad ${i+1} debe tener 10 dígitos y no comenzar con 0 ni 5.`}
    if(!s.compania||!s.modalidadActual)return{ok:false,mensaje:`Completá Compañía actual y PRE / POS de la Portabilidad ${i+1}.`}
   }
  }
  for(const [i,s] of existentes.entries()){
   if(s.tipo==='LINEA_MOVIL'&&!/^[1-46-9]\d{9}$/.test(s.numero))return{ok:false,mensaje:`El Número del servicio existente ${i+1} debe tener exactamente 10 dígitos y no comenzar con 0 ni 5.`}
  }
  const portas=nuevos.filter(x=>x.tipo==='PORTA')
  const nims=portas.map(x=>x.nim);if(new Set(nims).size!==nims.length)return{ok:false,mensaje:'Hay NIM repetidos en las portabilidades.'}
  if(portas.length===1) portas[0].lineaTitular=true
  if(portas.length>1 && portas.filter(x=>x.lineaTitular).length!==1)return{ok:false,mensaje:'En una Portabilidad de líneas múltiples debés marcar una y solo una Línea Titular.'}
  const admin=createAdminClient(),m=marcaArgentina(),idOperacion=`${m.id}-${dni}`;let operacionCreada=false;const serviciosCreados:number[]=[]

  let caminante:string|null=null

  if(origenDato.toUpperCase()==='PSR'){
   caminante='ALERTA! SUPERVISOR'

   const coincidenciaObs=obs.match(/PSR1?_\s*([^_\s]+)/i)
   const idMisReferidos=coincidenciaObs?.[1]?.trim()??''

   if(idMisReferidos){
    const {data:coincidenciasItec,error:errorItec}=await admin
     .from('reporte_itec')
     .select('caminante,tipo_psr,telefono,nro_pos')
     .or(`telefono.eq.${idMisReferidos},nro_pos.eq.${idMisReferidos}`)

    if(errorItec){
     return{
      ok:false,
      mensaje:`No se pudo consultar el padrón ITEC: ${errorItec.message}`
     }
    }

    const coincidenciaValida=(coincidenciasItec??[]).find((registro:any)=>
     String(registro.tipo_psr??'').trim().toUpperCase()!=='4X4' &&
     String(registro.caminante??'').trim()!==''
    )

    if(coincidenciaValida){
     caminante=String(coincidenciaValida.caminante).trim()
    }
   }
  }

  let estadoBafCargadoId:number|null=null
  if(cargaItecSolicitada){
   const {data:estadosBaf,error:estadosBafError}=await admin.from('estados_baf').select('id,codigo,nombre').eq('activo',true)
   if(estadosBafError)return{ok:false,mensaje:`No se pudo consultar el estado CARGADO de BAF: ${estadosBafError.message}`}
   const estadoCargado=(estadosBaf??[]).find((estado:any)=>{
    const codigo=String(estado.codigo??'').trim().toUpperCase()
    const nombreEstado=String(estado.nombre??'').trim().toUpperCase()
    return codigo==='CARGADO'||nombreEstado==='CARGADO'
   })
   if(!estadoCargado)return{ok:false,mensaje:'No se encontró un estado BAF activo llamado CARGADO. Revisá Administración > Estados BAF.'}
   estadoBafCargadoId=Number(estadoCargado.id)
  }
  try{
   const {data:ce,error:eb}=await admin.from('clientes').select('id').eq('tipo_documento',tipoDoc).eq('dni',dni).maybeSingle();if(eb)throw eb;let clienteId:number
   const datosCliente={nombre,apellido,fecha_nacimiento:texto(fd,'fecha_nacimiento')||null,email,telefono,telefono_alternativo:telefonoAlternativo||null,updated_at:new Date().toISOString()}
   if(ce){clienteId=ce.id;const {error}=await admin.from('clientes').update(datosCliente).eq('id',clienteId);if(error)throw error}else{const {data:nc,error}=await admin.from('clientes').insert({tipo_documento:tipoDoc,dni,...datosCliente}).select('id').single();if(error)throw error;clienteId=nc.id}
   const {data:dom,error:ed}=await admin.from('domicilios').insert({cliente_id:clienteId,calle_nro:domicilio,piso:texto(fd,'piso')||null,dpto:texto(fd,'dpto')||null,entre_calles:texto(fd,'entre_calles')||null,barrio:texto(fd,'barrio')||null,localidad:texto(fd,'localidad')||null,coordenadas:texto(fd,'coordenadas')||null,datos_extras:texto(fd,'datos_extras')||null}).select('id').single();if(ed)throw ed
   const moviles=nuevos.filter(x=>x.tipo==='PORTA'||x.tipo==='LINEA_NUEVA'),tipoLegacy=tieneBafNuevo?'BAF':'PORTA'
   const {error:eo}=await admin.from('operaciones').insert({id_operacion:idOperacion,tipo:tipoLegacy,cliente_id:clienteId,domicilio_id:dom.id,usuario_id:user.id,vendedor:perfil.vendedor?.trim()||perfil.nombre?.trim()||user.email||'Vendedor',fecha_hora:m.iso,origen_dato:origenDato,obs:obs||null,caminante,estado_sync:'PENDIENTE',sheet_destino:null,grupo_operacion:idOperacion});if(eo)throw eo;operacionCreada=true
   let servicioBafExistenteId:number|null=null
   for(const s of existentes){const {data:cs,error}=await admin.from('cliente_servicios').insert({cliente_id:clienteId,domicilio_id:dom.id,tipo_servicio:s.tipo,modalidad:s.modalidad||null,numero_servicio:s.numero||null,origen:'DECLARADO_CLIENTE',estado_verificacion:'DECLARADO',operacion_origen_id:idOperacion,created_by:user.id,updated_by:user.id}).select('id').single();if(error)throw error;serviciosCreados.push(cs.id);if(s.tipo==='BAF'&&!servicioBafExistenteId)servicioBafExistenteId=cs.id}
   const idsProductos=nuevos.map(x=>x.productoId);const {data:catalogo,error:ec}=await admin.from('productos').select('id,producto,origen,plan,precio_lista,descuento_normal,precio_cliente,beneficios').in('id',idsProductos);if(ec)throw ec;const mapa=new Map((catalogo??[]).map(p=>[Number(p.id),p]))
   const bafNuevo=nuevos.find(x=>x.tipo==='BAF')
   if(bafNuevo){
    const productoBafSeleccionado=mapa.get(bafNuevo.productoId)
    const esClaroTv=String(productoBafSeleccionado?.producto??'').trim().toUpperCase()==='CLARO TV'
    if(habilitaAnadirTv&&!esClaroTv)throw new Error('Con Internet Claro 2PLAY existente, el único producto Internet habilitado es AÑADIR TV.')
    if(!habilitaAnadirTv&&esClaroTv)throw new Error('AÑADIR TV requiere un servicio existente Internet Claro con modalidad 2PLAY.')
   }
   const {data:modemsFwa,error:modemsFwaError}=await admin.from('catalogo_modems_fwa').select('id,nombre,precio,max_cuotas_factura').eq('activo',true).order('orden',{ascending:true}).order('id',{ascending:true}).limit(1);if(modemsFwaError)throw modemsFwaError
   const modemFwa=modemsFwa?.[0]??null
   const precioModemActual=Number(modemFwa?.precio??0)
   const maxCuotasFactura=Number(modemFwa?.max_cuotas_factura??24)
   let productoBafId:number|null=null
   let productoMovilDocumentalId:number|null=null
   const productosMovilesCreados:{indice:number;productoOperacionId:number;tipo:string}[]=[]
   for(const [i,s] of nuevos.entries()){const p=mapa.get(s.productoId);if(!p)throw new Error(`El producto seleccionado en el servicio ${i+1} no existe o ya no está disponible.`);const {data:op,error:eop}=await admin.from('operacion_productos').insert({operacion_id:idOperacion,producto_id:p.id,tipo_producto:s.tipo,responsable_id:null,orden:i+1,activo:true,producto_snapshot:p.producto,origen_snapshot:p.origen,plan_snapshot:p.plan,precio_lista_snapshot:p.precio_lista,descuento_snapshot:p.descuento_normal,precio_cliente_snapshot:p.precio_cliente,beneficios_snapshot:p.beneficios,created_by:user.id,updated_by:user.id}).select('id').single();if(eop)throw eop
    if(s.tipo==='BAF'){productoBafId=op.id;let tipoDomId:null|number=null,zonaId:null|number=null;if(s.tipoDomicilio){const {data:x}=await admin.from('catalogo_tipos_domicilio').select('id').eq('nombre',s.tipoDomicilio).maybeSingle();tipoDomId=x?.id??null}if(s.zona){const {data:x}=await admin.from('catalogo_zonas').select('id').eq('nombre',s.zona).maybeSingle();zonaId=x?.id??null}const {error}=await admin.from('operacion_producto_baf').insert({producto_operacion_id:op.id,tipo_domicilio_id:tipoDomId,zona_id:zonaId,modalidad_plan:s.modalidad||null,tv:s.tv,cantidad_decos:s.decos,horario_contacto:s.observaciones||null});if(error)throw error;const ahoraGestion=new Date().toISOString();if(cargaItecSolicitada){const {error:eg}=await admin.from('gestion_producto_baf').insert({producto_operacion_id:op.id,responsable_id:user.id,estado_baf_id:estadoBafCargadoId,cia_celular:itec.ciaCelular,sds:itec.sds,orden_trabajo:itec.ot,fecha_instalacion:`${itec.fechaInstalacion} - ${itec.turno}`,fecha_gestion:ahoraGestion,updated_at:ahoraGestion,updated_by:user.id});if(eg)throw eg}else{const {error:eg}=await admin.from('gestion_producto_baf').insert({producto_operacion_id:op.id,responsable_id:null});if(eg)throw eg}}
    else{
     const textoFwa=`${p.producto??''} ${p.plan??''}`.toUpperCase()
     const esFwa=s.tipo==='LINEA_NUEVA'&&textoFwa.includes('FWA')&&textoFwa.includes('5G')&&textoFwa.includes('400')
     if(esFwa){
      if(!modemFwa)throw new Error('No hay un Módem FWA 5G activo en Administración.')
      if(!['CONTRA_FACTURA','EFECTIVO','TARJETA'].includes(s.pagoModem))throw new Error('Seleccioná la forma de pago del Módem FWA 5G.')
      if(!Number.isInteger(s.cuotasModem)||Number(s.cuotasModem)<1)throw new Error('Indicá correctamente la cantidad de cuotas del Módem FWA 5G.')
      if(s.pagoModem==='CONTRA_FACTURA'&&Number(s.cuotasModem)>maxCuotasFactura)throw new Error(`Contra Factura admite hasta ${maxCuotasFactura} cuotas.`)
      if(s.pagoModem==='EFECTIVO'&&Number(s.cuotasModem)!==1)throw new Error('El pago en efectivo del Módem FWA 5G debe registrarse en un solo pago.')
      if(s.pagoModem==='TARJETA'&&Number(s.cuotasModem)>60)throw new Error('La cantidad de cuotas con tarjeta no es válida.')
     }
     const {error}=await admin.from('operacion_producto_movil').insert({producto_operacion_id:op.id,numero_linea:s.tipo==='PORTA'?s.nim:null,nim:s.tipo==='PORTA'?s.nim:null,compania_actual:s.tipo==='PORTA'?s.compania:null,modalidad_actual:s.tipo==='PORTA'?s.modalidadActual:null,tipo_sim:s.sim||null,linea_titular:s.tipo==='PORTA'?s.lineaTitular:false,es_fwa:esFwa,forma_pago_modem:esFwa?s.pagoModem:null,cuotas_modem:esFwa?s.cuotasModem:null,precio_modem_snapshot:esFwa?precioModemActual:null});if(error)throw error;const {error:eg}=await admin.from('gestion_producto_movil').insert({producto_operacion_id:op.id,responsable_id:null});if(eg)throw eg

     productosMovilesCreados.push({
       indice:i,
       productoOperacionId:Number(op.id),
       tipo:s.tipo,
     })

     // Una única documentación DNI por titular/operación.
     // PORTA titular tiene prioridad; si sólo hay LN se usa el primer móvil.
     if(
       productoMovilDocumentalId===null ||
       (s.tipo==='PORTA' && s.lineaTitular)
     ){
       productoMovilDocumentalId=Number(op.id)
     }
    }
   }
   const esFull=moviles.length>0&&(!!productoBafId||!!servicioBafExistenteId);if(esFull){const modalidad=productoBafId?'BAF_NUEVO':'BAF_EXISTENTE';const cantidad=1+moviles.length;const {error}=await admin.from('operacion_contexto_comercial').insert({operacion_id:idOperacion,es_conexion_full:true,modalidad_conexion_full:modalidad,servicio_existente_id:productoBafId?null:servicioBafExistenteId,producto_baf_id:productoBafId,tipo_referencia_habilitante:productoBafId?'OT':'COMBO',referencia_habilitante:productoBafId?null:'COMBO',cantidad_servicios:cantidad,descuento_convergencia:cantidad>=3?5000:4000,created_by:user.id,updated_by:user.id});if(error)throw error}
   const esVentaMultiproducto=!!productoBafId&&moviles.length>0
   const esLineasMultiples=!productoBafId&&moviles.length>=2

   // La Venta ya quedó creada correctamente.
   // A partir de aquí la documentación DNI es complementaria:
   // un error documental NO debe provocar rollback de la Venta.
   const avisosDocumentacion:string[]=[]
   const documentosCargados:string[]=[]

   if(productoMovilDocumentalId!==null){
    const documentosIniciales=[
     {archivo:fd.get('dni_frente'),tipo:'DNI_FRENTE',sufijo:'F',carpeta:'frente',etiqueta:'Frente',mimePermitidos:['image/jpeg','image/png']},
     {archivo:fd.get('dni_dorso'),tipo:'DNI_DORSO',sufijo:'D',carpeta:'dorso',etiqueta:'Dorso',mimePermitidos:['image/jpeg','image/png']},
     {archivo:fd.get('dni_completo'),tipo:'DNI_COMPLETO',sufijo:'',carpeta:'completo',etiqueta:'DNI completo',mimePermitidos:['application/pdf']},
    ]

    for(const doc of documentosIniciales){
     if(!(doc.archivo instanceof File) || doc.archivo.size===0)continue

     try{
      const archivo=doc.archivo

      if(archivo.size>10*1024*1024){
       avisosDocumentacion.push(`${doc.etiqueta} supera los 10 MB`)
       continue
      }

      const extensiones:Record<string,string>={
       'image/jpeg':'jpg',
       'image/png':'png',
       'application/pdf':'pdf',
      }

      const extension=extensiones[archivo.type]

      if(!extension || !doc.mimePermitidos.includes(archivo.type)){
       avisosDocumentacion.push(`${doc.etiqueta} tiene un formato no permitido`)
       continue
      }

      const nombreVisible=`${dni}${doc.sufijo}.${extension}`
      const nombreInterno=`${crypto.randomUUID()}.${extension}`
      const storagePath=`${productoMovilDocumentalId}/dni/${doc.carpeta}/${nombreInterno}`
      const bytes=Buffer.from(await archivo.arrayBuffer())

      const {error:uploadError}=await admin.storage
       .from('documentacion-dni')
       .upload(storagePath,bytes,{
        contentType:archivo.type,
        upsert:false,
        cacheControl:'3600',
       })

      if(uploadError){
       avisosDocumentacion.push(`No se pudo subir ${doc.etiqueta}: ${uploadError.message}`)
       continue
      }

      const {error:insertDocumentoError}=await admin
       .from('documentos_producto_movil')
       .insert({
        producto_operacion_id:productoMovilDocumentalId,
        tipo_documento:doc.tipo,
        storage_path:storagePath,
        nombre_original:nombreVisible,
        mime_type:archivo.type,
        tamano_bytes:archivo.size,
        created_by:user.id,
       })

      if(insertDocumentoError){
       await admin.storage.from('documentacion-dni').remove([storagePath])
       avisosDocumentacion.push(`No se pudo registrar ${doc.etiqueta}: ${insertDocumentoError.message}`)
      }else{
       documentosCargados.push(doc.etiqueta)
      }
     }catch(errorDocumento){
      console.error('Error cargando documentación DNI inicial:',errorDocumento)
      avisosDocumentacion.push(
       `No se pudo cargar ${doc.etiqueta}`
      )
     }
    }
   }

   // CHIP-OK pertenece a cada producto móvil individual.
   // Se relaciona directamente con operacion_productos.id.
   for(const movil of productosMovilesCreados){
     const archivoChip=fd.get(`chip_ok_${movil.indice}`)

     if(!(archivoChip instanceof File) || archivoChip.size===0)continue

     const etiquetaChip=`CHIP-OK ${movil.tipo==='PORTA'?'Portabilidad':'Línea Nueva'}`

     try{
       if(archivoChip.size>10*1024*1024){
         avisosDocumentacion.push(`${etiquetaChip} supera los 10 MB`)
         continue
       }

       const extensionesChip:Record<string,string>={
         'image/jpeg':'jpg',
         'image/png':'png',
       }

       const extensionChip=extensionesChip[archivoChip.type]

       if(!extensionChip){
         avisosDocumentacion.push(`${etiquetaChip} tiene un formato no permitido`)
         continue
       }

       const nombreVisibleChip=`CHIP-OK-${movil.productoOperacionId}.${extensionChip}`
       const nombreInternoChip=`${crypto.randomUUID()}.${extensionChip}`
       const storagePathChip=`${movil.productoOperacionId}/chip-ok/${nombreInternoChip}`
       const bytesChip=Buffer.from(await archivoChip.arrayBuffer())

       const {error:uploadChipError}=await admin.storage
         .from('documentacion-dni')
         .upload(storagePathChip,bytesChip,{
           contentType:archivoChip.type,
           upsert:false,
           cacheControl:'3600',
         })

       if(uploadChipError){
         avisosDocumentacion.push(
           `No se pudo subir ${etiquetaChip}: ${uploadChipError.message}`
         )
         continue
       }

       const {error:insertChipError}=await admin
         .from('documentos_producto_movil')
         .insert({
           producto_operacion_id:movil.productoOperacionId,
           tipo_documento:'CHIP_OK',
           storage_path:storagePathChip,
           nombre_original:nombreVisibleChip,
           mime_type:archivoChip.type,
           tamano_bytes:archivoChip.size,
           created_by:user.id,
         })

       if(insertChipError){
         await admin.storage
           .from('documentacion-dni')
           .remove([storagePathChip])

         avisosDocumentacion.push(
           `No se pudo registrar ${etiquetaChip}: ${insertChipError.message}`
         )
       }else{
         documentosCargados.push(etiquetaChip)
       }
     }catch(errorChip){
       console.error('Error cargando CHIP-OK inicial:',errorChip)
       avisosDocumentacion.push(`No se pudo cargar ${etiquetaChip}`)
     }
   }

   const mensajeSimple=esVentaMultiproducto
    ? 'Venta multiproducto guardada correctamente.'
    : esLineasMultiples
      ? 'Líneas múltiples guardadas correctamente.'
      : 'Venta guardada correctamente.'

   const mensajeGuardado=cargaItecSolicitada
    ? (esFull?'Venta guardada por ITEC. BAF registrado con estado CARGADO y OT disponible para el circuito de Conexión Full.':'Venta guardada por ITEC. BAF registrado directamente con estado CARGADO.')
    : (esFull?(productoBafId?'Venta guardada. Conexión Full detectada: la gestión móvil quedará pendiente hasta contar con OT.':'Venta guardada. Conexión Full con BAF existente: referencia COMBO.'):mensajeSimple)
   const detallesDocumentacion:string[]=[]

   if(documentosCargados.length){
    detallesDocumentacion.push(
     `Documentación DNI: ${documentosCargados.join(' y ')} ${documentosCargados.length===1?'cargado':'cargados'}.`
    )
   }

   if(avisosDocumentacion.length){
    detallesDocumentacion.push(
     `ADVERTENCIA: ${avisosDocumentacion.join(' · ')}. Puede completar la documentación desde Gestión de Ventas.`
    )
   }

   const mensajeFinal=detallesDocumentacion.length
    ? `${mensajeGuardado} ${detallesDocumentacion.join(' ')}`
    : mensajeGuardado

   return{ok:true,mensaje:mensajeFinal,idOperacion}
  }catch(error){console.error(error);if(operacionCreada)await admin.from('operaciones').delete().eq('id_operacion',idOperacion);else if(serviciosCreados.length)await admin.from('cliente_servicios').delete().in('id',serviciosCreados);return{ok:false,mensaje:error instanceof Error?error.message:'No se pudo guardar la venta.'}}
 }
 return <FormularioVentas nombreUsuario={nombreUsuario} vendedor={vendedor} rol={profile.rol} puedeGestionarVentas={profile.puede_gestionar_ventas===true} origenes={(origenes??[]).map(x=>x.nombre)} zonas={(zonas??[]).map(x=>x.nombre)} tiposDomicilio={(tiposDomicilio??[]).map(x=>x.nombre)} productos={(productos??[]).map(p=>({...p,precio_lista:Number(p.precio_lista??0),descuento_normal:p.descuento_normal==null?null:Number(p.descuento_normal),precio_cliente:p.precio_cliente==null?null:Number(p.precio_cliente)}))} guardarVenta={guardarVenta}/>
}
