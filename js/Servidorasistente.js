// Servidor de WhatsApp y lectura de comprobantes para Hospedaje Nissi

function Evitarmensajerepetido(Idmensaje) {
  if (!Idmensaje) { return false; }
  try {
    const Cache = CacheService.getScriptCache();
    const Clave = `MSG_${Idmensaje}`;
    if (Cache.get(Clave)) { return true; }
    Cache.put(Clave, '1', 21600);
  } catch (E) {}
  return false;
}

function Extraertextointeraccion(Datosinteraccion) {
  if (!Datosinteraccion || !Datosinteraccion.steps) { return ''; }
  const Textos = [];
  Datosinteraccion.steps.forEach(function(Paso) {
    if (Paso.type === 'model_output' && Array.isArray(Paso.content)) {
      Paso.content.forEach(function(Bloque) {
        if (Bloque.type === 'text' && Bloque.text) { Textos.push(Bloque.text); }
      });
    }
  });
  return Textos.join('\n').trim();
}

function Crearherramientaia(Nombre, Descripcion, Propiedades, Requeridos) {
  const Obj = { type: 'function', name: Nombre, description: Descripcion, parameters: { type: 'object', properties: Propiedades } };
  if (Requeridos && Requeridos.length) { Obj.parameters.required = Requeridos; }
  return Obj;
}

function Obtenerherramientasia() {
  return [
    Crearherramientaia('Guardarnombrecliente', 'Guarda el nombre (o nombre y apellido) del cliente apenas se presente para recordarlo en toda la conversación.', {
      nombre: { type: 'string', description: 'Nombre o nombre y apellido tal como lo indicó el cliente' }
    }, ['nombre']),
    Crearherramientaia('Consultardisponibilidad', 'Lee qué habitaciones están libres en Google Sheets y calcula la tarifa por cantidad de personas.', {
      fechallegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' },
      fechasalida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
      cantidadhuespedes: { type: 'integer', description: 'Número de personas (1 a 3)' },
      camasseparadas: { type: 'boolean', description: 'True si son 2 personas y desean camas separadas' }
    }, ['fechallegada', 'fechasalida']),
    Crearherramientaia('Apartarhabitacion', 'Aparta automáticamente la habitación elegida con su tarifa calculada por persona y uso de camas.', {
      habitacion: { type: 'string', description: 'Número de habitación disponible (01, 02, 04, 05 o 06)' },
      fechallegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' }, fechasalida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
      cantidadhuespedes: { type: 'integer', description: 'Cantidad de huéspedes (1 a 3)' }, camasseparadas: { type: 'boolean', description: 'True si son 2 personas en camas individuales' }
    }, ['habitacion', 'fechallegada', 'fechasalida']),
    Crearherramientaia('Registrarenesperahabitacion', 'Anota al huésped en espera si decide esperar unos minutos por una habitación recién apartada por otro cliente.', {
      habitacion: { type: 'string', description: 'Número de habitación' }, fechallegada: { type: 'string', description: 'Fecha llegada YYYY-MM-DD' },
      fechasalida: { type: 'string', description: 'Fecha salida YYYY-MM-DD' }, cantidadhuespedes: { type: 'integer', description: 'Número de personas' },
      camasseparadas: { type: 'boolean', description: 'True si camas individuales' }
    }, ['habitacion', 'fechallegada', 'fechasalida']),
    Crearherramientaia('Liberarapartado', 'Libera la habitación apartada si el cliente desiste o cancela.', {
      codigo: { type: 'string', description: 'Código de la reserva (ej. NS-4K9A2B)' },
      motivo: { type: 'string', description: 'Motivo por el que libera' }
    }),
    Crearherramientaia('Guardardatoshuesped', 'Guarda nombre y apellido, cédula colombiana válida, celular colombiano de 10 dígitos, hora de llegada y parqueadero en columnas separadas.', {
      codigo: { type: 'string', description: 'Código de reserva' },
      nombre: { type: 'string', description: 'Nombre y apellido completos (o solo el apellido si el primer nombre ya estaba guardado)' },
      cedula: { type: 'string', description: 'Cédula colombiana numérica: 6 a 8 dígitos, o 10 dígitos iniciando en 1' },
      horallegada: { type: 'string', description: 'Hora estimada de llegada (ej. 8:00 p. m.)' },
      celularcontacto: { type: 'string', description: 'Celular colombiano de 10 dígitos iniciando en 3 (ej. 3001234567)' },
      parqueadero: { type: 'string', description: 'No, o detalle de vehículos incluyendo pesados (ej. "Sí, 1 mula", "Sí, 1 carro")' }
    }, ['nombre', 'cedula']),
    Crearherramientaia('Enviardatospago', 'Devuelve la cuenta de Nequi y el valor exacto a transferir para Nequi o pago Mixto.', {
      codigo: { type: 'string', description: 'Código de la reserva apartada' },
      mediopago: { type: 'string', description: '"Nequi" o "Mixto"' },
      montonequi: { type: 'number', description: 'Si es Mixto, pesos por Nequi' },
      montoefectivo: { type: 'number', description: 'Si es Mixto, pesos en efectivo al llegar' },
      montobillete: { type: 'number', description: 'Si es Mixto, billete en efectivo (opcional)' }
    }),
    Crearherramientaia('Registrarcomprobante', 'Registra los datos de la captura de Nequi para confirmar la reserva y enviar el soporte al administrador.', {
      codigo: { type: 'string', description: 'Código de reserva' }, monto: { type: 'number', description: 'Monto en COP' },
      referencia: { type: 'string', description: 'Referencia o número de comprobante' }, entidad: { type: 'string', description: 'Nequi' }, fecha: { type: 'string', description: 'Fecha y hora' }
    }, ['monto', 'referencia']),
    Crearherramientaia('Confirmarreservaefectivo', 'Confirma una reserva 100% en efectivo tras validar el monto/billete y confirmación del resumen.', {
      codigo: { type: 'string', description: 'Código de la reserva apartada' }, montobillete: { type: 'number', description: 'Monto o billete con el que pagará en efectivo' }
    }, ['montobillete']),
    Crearherramientaia('Confirmarllegadahabitacion', 'Registra si el huésped confirmó que ya está en la habitación o informa un cambio en su hora de llegada.', {
      codigo: { type: 'string', description: 'Código de la reserva confirmada' }, yaenhabitacion: { type: 'boolean', description: 'True si ya llegó o está en la habitación' },
      nuevahorallegada: { type: 'string', description: 'Nueva hora estimada de llegada si informó retraso' }
    }, ['yaenhabitacion']),
    Crearherramientaia('Solicitaradministrador', 'Solicita conexión con un administrador cuando pide persona, más de 3 huéspedes o caso especial.', {
      codigo: { type: 'string', description: 'Código de reserva si existe' }, motivo: { type: 'string', description: 'Motivo' }, resumen: { type: 'string', description: 'Resumen breve del chat' }
    }),
    Crearherramientaia('Solicitarampliacioncheckout', 'Cotiza o registra ampliación de hora de salida después de las 11:00 a. m. ($10.000 COP/hora).', {
      codigo: { type: 'string', description: 'Código de reserva' }, horasalida: { type: 'string', description: 'Hora solicitada' }, mediopago: { type: 'string', description: 'Vacío, "transferencia" o "efectivo"' }
    }, ['horasalida']),
    Crearherramientaia('Emitirrecibocaja', 'Genera el Recibo de Caja en PDF con número único y lo envía por WhatsApp, correo o ambos al huésped.', {
      codigoreserva: { type: 'string', description: 'Código de la reserva confirmada' },
      nombretitular: { type: 'string', description: 'Nombre completo o Razón social del titular' },
      documentotitular: { type: 'string', description: 'C.C. o NIT con dígito de verificación si aplica' },
      direcciontitular: { type: 'string', description: 'Dirección completa' },
      ciudadtitular: { type: 'string', description: 'Ciudad y departamento' },
      telefonotitular: { type: 'string', description: 'Teléfono de contacto' },
      correocliente: { type: 'string', description: 'Correo electrónico confirmado expresamente por el huésped' },
      canalenvio: { type: 'string', description: '"whatsapp", "correo" o "ambos"' }
    }, ['nombretitular', 'documentotitular', 'direcciontitular', 'ciudadtitular', 'telefonotitular', 'correocliente', 'canalenvio'])
  ];
}

function Ejecutarherramientaia(Nombre, Argumentos, Celularcliente) {
  if (Nombre === 'Guardarnombrecliente') {
    const Previo = Obtenerestadoconversacion(Celularcliente).nombre || '';
    const Nom = Combinarnombreyapellido(Previo, Argumentos.nombre);
    if (Nom) { Actualizarconversacion(Celularcliente, { nombre: Nom }); }
    return { exito: Boolean(Nom), nombre: Nom, tieneapellido: Tieneapellidonombre(Nom) };
  }
  if (Nombre === 'Consultardisponibilidad') { return Consultardisponibilidad(Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes, Argumentos.camasseparadas); }
  if (Nombre === 'Apartarhabitacion') { return Apartarhabitacion(Celularcliente, Argumentos.habitacion, Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes, 'WhatsApp', Argumentos.camasseparadas); }
  if (Nombre === 'Registrarenesperahabitacion') { return Registrarenesperahabitacion(Celularcliente, Argumentos.habitacion, Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes, Argumentos.camasseparadas); }
  if (Nombre === 'Liberarapartado') { return Liberarapartado(Celularcliente, Argumentos.codigo, Argumentos.motivo); }
  if (Nombre === 'Guardardatoshuesped') { return Guardardatoshuesped(Celularcliente, Argumentos.codigo, Argumentos.nombre, Argumentos.cedula, Argumentos.horallegada, Argumentos.celularcontacto, Argumentos.parqueadero); }
  if (Nombre === 'Enviardatospago') { return Enviardatospago(Celularcliente, Argumentos.codigo, Argumentos.mediopago, Argumentos.montonequi, Argumentos.montoefectivo, Argumentos.montobillete); }
  if (Nombre === 'Registrarcomprobante') { return Registrarcomprobante(Celularcliente, Argumentos.codigo, Argumentos); }
  if (Nombre === 'Confirmarreservaefectivo') { return Confirmarreservaefectivo(Celularcliente, Argumentos.codigo, Argumentos.montobillete); }
  if (Nombre === 'Confirmarllegadahabitacion') { return Confirmarllegadahabitacion(Celularcliente, Argumentos.codigo, Argumentos.yaenhabitacion, Argumentos.nuevahorallegada); }
  if (Nombre === 'Solicitaradministrador') { return Solicitaradministrador(Celularcliente, Argumentos.codigo, Argumentos.motivo, Argumentos.resumen); }
  if (Nombre === 'Solicitarampliacioncheckout') { return Solicitarampliacioncheckout(Celularcliente, Argumentos.codigo, Argumentos.horasalida, Argumentos.mediopago); }
  if (Nombre === 'Emitirrecibocaja') { return Emitirrecibocaja(Celularcliente, Argumentos); }
  return { exito: false, mensaje: 'Herramienta no reconocida' };
}

function Procesarmensajecongemini(Celularcliente, Textomensaje, Contexto) {
  const Credenciales = Obtenercredenciales();
  const Estadoconv = Obtenerestadoconversacion(Celularcliente);
  const Ctx = Contexto || {};
  const Modoprevio = Ctx.modoprevio || Estadoconv.modo;
  const Nombrerecordado = Ctx.nombrerecordado !== undefined ? Ctx.nombrerecordado : (Estadoconv.nombre || '');
  const Nombrevalido = Nombrerecordado && !/^(cliente|viajero|por confirmar)$/i.test(Nombrerecordado.trim()) ? Nombrerecordado.trim() : '';
  const Yaapellido = Tieneapellidonombre(Nombrevalido);
  const Celularconocido = Normalizarcelularcolombiano(Celularcliente) || Normalizarcelularcolombiano(Estadoconv.telefonocontacto);
  const Sesionnueva = Ctx.sesionnueva !== undefined ? Ctx.sesionnueva : !Estadoconv.idinteraccionia;
  const Hoy = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');

  let Reglacontexto = '';
  const Llegadapend = typeof Obtenerllegadapendientecliente === 'function' ? Obtenerllegadapendientecliente(Celularcliente) : null;
  if (Modoprevio === 'PostCanal') {
    Reglacontexto = `\nATENCIÓN POST-CANAL: El canal con el administrador acaba de cerrarse por inactividad y se preguntó a ${Nombrevalido || 'el cliente'} si concretó reserva con el administrador. Procesa su respuesta: si confirmó que sí reservó, felicítalo y pregunta si requiere indicaciones de llegada o algo adicional; si no concretó o desea continuar, ofrece consultar disponibilidad o iniciar una nueva reserva.`;
  } else if (Llegadapend) {
    Reglacontexto = `\nCONFIRMACIÓN DE LLEGADA PENDIENTE: La reserva ${Llegadapend.codigo} (Habitación ${Llegadapend.habitacion}, prevista ${Llegadapend.hora}) espera confirmación de presencia. Si el huésped confirma que ya llegó o está en la habitación (ej. "Sí", "Ya llegué"), llama INMEDIATAMENTE a Confirmarllegadahabitacion(codigo:"${Llegadapend.codigo}", yaenhabitacion:true). Si indica retraso u otra hora, llama Confirmarllegadahabitacion(codigo:"${Llegadapend.codigo}", yaenhabitacion:false, nuevahorallegada:"...").`;
  } else if (Sesionnueva && Nombrevalido) {
    Reglacontexto = `\nMEMORIA DE CLIENTE RECURRENTE: Este número ya escribió anteriormente y su nombre es "${Nombrevalido}". NO pidas el nombre ni uses el saludo de primera vez. Saluda exactamente con: "Hola ${Primernombre(Nombrevalido)}, un gusto atenderte nuevamente, ¿en qué te puedo ayudar el día de hoy?" (si ya hizo una pregunta en este mensaje, respóndela justo después del saludo).`;
  }
  const Resconfirmada = typeof Buscarreservaconfirmadacliente === 'function' ? Buscarreservaconfirmadacliente(Celularcliente, Estadoconv.codigoreserva) : null;
  if (Resconfirmada) {
    Reglacontexto += `\nRESERVA CONFIRMADA DEL CLIENTE: codigo="${Resconfirmada.fila[0]}", titular="${Resconfirmada.fila[2]}", cedula="${Resconfirmada.fila[3]}", celular="${Obtenercelularlegiblereserva(Resconfirmada.fila)}". Si pide recibo de caja a su propio nombre, NO vuelvas a pedir nombre, cédula ni celular.`;
  }
  const Estadodatoscliente = `\nDATOS ACTUALES DEL CLIENTE EN ESTA CHARLA: nombre="${Nombrevalido || 'sin registrar'}" (${Yaapellido ? 'YA tiene nombre y apellido completos: PROHIBIDO volver a pedirle nombre o apellido' : (Nombrevalido ? 'solo dio primer nombre: al registrar reserva pide ÚNICAMENTE su apellido, nunca el nombre otra vez' : 'aún no ha dado su nombre')}), celular_colombiano="${Celularconocido || 'sin registrar (debes pedir su celular colombiano de 10 dígitos al registrar la reserva)'}".`;

  const Instruccionessistema =
    `Actúas como la recepcionista humana, cálida, cercana y servicial de Hospedaje Nissi en Mingueo, Dibulla, La Guajira. Hoy es ${Hoy}. Hablas en español colombiano natural y respetuoso.\n` +
    `CONTEXTO: Jamás respondas preguntas ajenas al hospedaje (ciencia, historia, matemáticas, etc.). Di amablemente que en recepción solo atiendes reservas e información del hospedaje y retoma el paso actual.\n` +
    `TARIFAS Y HABITACIONES: Todas tienen aire acondicionado, Wi-Fi, TV y acceso al parqueadero sin costo adicional. La habitación 03 está en rediseño (nunca la ofrezcas). El cobro es por PERSONAS: ` +
    `1 persona = $55.000/noche (aplica incluso en habitaciones de 2 o 3 personas); 2 personas = $70.000/noche si comparten la cama doble/queen, o $90.000/noche si usan cada uno su cama individual (solo en habs. 01, 02 y 06; las habs. 04 y 05 tienen 1 cama doble a $70.000); 3 personas = $110.000/noche.\n` +
    `PARQUEADERO AMPLIO (INCLUYE MULAS Y VEHÍCULOS GRANDES): El hospedaje SÍ cuenta con parqueadero amplio con espacio suficiente tanto para motos, carros y camionetas como para VEHÍCULOS GRANDES Y DE CARGA PESADA (mulas, tractomulas, camiones, furgones, buses, vans). Si un cliente pregunta por parqueadero para una mula, camión o vehículo grande, confírmale con total seguridad que SÍ tenemos espacio disponible para parquearlo y regístralo en parqueadero (ej. "Sí, 1 mula").\n` +
    `VALIDACIÓN DE DOCUMENTOS EN COLOMBIA (OBLIGATORIO VERIFICAR ANTES DE GUARDAR):\n` +
    `- Cédula de ciudadanía colombiana válida: contiene SOLO números (con o sin puntos). Solo existen dos longitudes válidas en la Registraduría: de 6 a 8 dígitos (cédulas antiguas, ej. 11314688 o 79456123) o exactamente 10 dígitos iniciando por 1 (cédulas NUIP, ej. 1014305605). NUNCA aceptes cédulas de 9 dígitos, de menos de 6, de más de 10, con letras, ni de 10 dígitos que empiecen por 3 (eso es un celular); si es inválida, pídele amablemente revisar el número.\n` +
    `- Celular colombiano válido (CRC): tiene EXACTAMENTE 10 dígitos y SIEMPRE inicia por 3 (rango 300 a 399: 300–305, 310–324, 333, 350–351; o 12 dígitos si anteponen +57). Si escribe un celular de 8, 9 u 11 dígitos o que no inicie en 3, pídele corregirlo.\n` +
    `MÁS DE 3 PERSONAS: Si pide para más de 3 personas, NO consultes habitaciones ni apartes nada; responde: "Entiendo, [Nombre]. Para este caso debo comunicarte con un administrador, si quieres puedo comunicarte ahora mismo." Si confirma que sí, ejecuta Solicitaradministrador sin texto adicional.\n` +
    `PASOS DE RESERVA:\n` +
    `1) Primer mensaje (solo si NO hay memoria previa): "¡Hola! ¿Cómo estás? Hablas con la recepción del Hospedaje Nissi en Mingueo. ¿Me puedes indicar tu nombre, por favor?".\n` +
    `2) Apenas diga su nombre por primera vez (sea solo nombre o nombre y apellido), llama INMEDIATAMENTE a Guardarnombrecliente(nombre), salúdalo, infórmale: "Para continuar con la conversación te informo que tus datos personales se tratarán conforme a la Ley 1581 de 2012 para gestionar tu reserva." y pregúntale cuántas personas son, fechas de llegada y salida, y si requiere parqueadero (si dice SÍ, pregunta qué tipo y cuántos vehículos, aceptando también mulas/camiones).\n` +
    `3) Con fechas, personas (1 a 3) y parqueadero listo, llama a Consultardisponibilidad. Si son 2 personas y están libres 01, 02 o 06, explica ambas opciones ($70.000 compartiendo cama / $90.000 camas separadas) y pregunta cuál prefieren antes de apartar.\n` +
    `4) Al elegir habitación, llama a Apartarhabitacion. Si devuelve enproceso:true, responde exactamente el texto de mensajecliente (informando que otro huésped acaba de iniciar el proceso sin confirmar y dando opción de esperar o ver otra). Si elige esperar, llama a Registrarenesperahabitacion. Si logra apartar, revisa tieneapellido: si es TRUE no pidas nombre ni apellido; si es FALSE pide ÚNICAMENTE su apellido. Pídele cédula, hora de llegada y celular colombiano de 10 dígitos (si celularregistrado viene lleno, confírmale si dejamos ese).\n` +
    `5) Verifica que cédula y celular cumplan las reglas de Colombia y llama a Guardardatoshuesped (si devuelve exito:false, explica con calidez el ajuste necesario). Una vez guardado, pregunta el medio de pago: Nequi, Efectivo o Mixto.\n` +
    `PAGO EN EFECTIVO: Pide con qué monto va a pagar para alistar el cambio, envía el resumen completo (Nombre y apellido, C.C., celular, habitación y personas/camas, efectivo y cambio, parqueadero, fechas) y pregunta "¿Es correcto?". Al confirmar que sí, llama a Confirmarreservaefectivo y envía el código junto con los enlaces rutamaps y rutawaze, terminando SIEMPRE con: "¿Requieres un recibo de caja?".\n` +
    `PAGO POR NEQUI O MIXTO: Si es Nequi 100%, llama a Enviardatospago(mediopago:"Nequi") y pide captura del comprobante. Si es Mixto, pregunta cuánto transfiere por Nequi, cuánto paga en efectivo al llegar y con qué billete, llama a Enviardatospago(mediopago:"Mixto", montonequi, montoefectivo, montobillete) y pide la captura. Al recibirla, queda confirmada de inmediato y se envía la captura al administrador.\n` +
    `RECIBO DE CAJA: Si el huésped con reserva confirmada responde que SÍ quiere recibo de caja, pregunta primero si lo necesita a su nombre, de otra persona o de una empresa, indicándole que puede enviar su RUT (en PDF o foto) para extraer los datos automáticamente. Si es a nombre propio sin RUT, NO repitas nombre/cédula/celular ya guardados: pide solo dirección, ciudad/departamento y correo electrónico. Si es otra persona o empresa sin RUT, pide: Nombre o Razón social, C.C. o NIT (con DV), Dirección, Ciudad/Departamento, Teléfono y Correo electrónico. Si envía RUT, muéstrale los datos extraídos y SIEMPRE pregunta a cuál correo electrónico desea registrarlo y enviarlo (mencionando el del RUT como opción, sin darlo por definitivo). Pregunta también si lo quiere por WhatsApp, correo electrónico o ambos, y luego llama a Emitirrecibocaja. Si pide algún dato adicional o modificación en el recibo, NO alteres el formato: infórmale que lo pasarás con el administrador y llama a Solicitaradministrador.\n` +
    `CANCELACIÓN Y CHECK-OUT (11:00 a. m., hora extra $10.000 COP): Usa Liberarapartado para cancelar, Solicitarampliacioncheckout para ampliar salida y Confirmarllegadahabitacion si confirma presencia o retraso.\n` +
    `Nunca inventes precios ni disponibilidad y nunca confirmes reservas sin usar las herramientas.${Estadodatoscliente}${Reglacontexto}`;

  const Herramientas = Obtenerherramientasia();
  const Cuerpopeticion = {
    model: Parametrosistema.modeloia,
    system_instruction: Instruccionessistema,
    input: Textomensaje,
    tools: Herramientas
  };
  if (Estadoconv.idinteraccionia) {
    Cuerpopeticion.previous_interaction_id = Estadoconv.idinteraccionia;
  }

  let Respuesta = Llamarapigemini(Credenciales.clavegemini, Cuerpopeticion);
  let Abriocanal = false;

  for (let Iter = 0; Iter < 3; Iter++) {
    const Pasollamada = Respuesta && Array.isArray(Respuesta.steps) && Respuesta.steps.find(function(P) { return P.type === 'function_call'; });
    if (!Pasollamada) { break; }
    if (Pasollamada.name === 'Solicitaradministrador') { Abriocanal = true; }
    const Resultadolocal = Ejecutarherramientaia(Pasollamada.name, Pasollamada.arguments || {}, Celularcliente);
    Respuesta = Llamarapigemini(Credenciales.clavegemini, {
      model: Parametrosistema.modeloia,
      system_instruction: Instruccionessistema,
      previous_interaction_id: Respuesta.id,
      tools: Herramientas,
      input: [{ type: 'function_result', name: Pasollamada.name, call_id: Pasollamada.id, result: [{ type: 'text', text: JSON.stringify(Resultadolocal) }] }]
    });
    if (Abriocanal) { break; }
  }

  if (Respuesta && Respuesta.id) {
    Actualizarconversacion(Celularcliente, { idinteraccionia: Respuesta.id });
  }
  if (Abriocanal) { return ''; }
  return Extraertextointeraccion(Respuesta) || 'Permíteme un momento mientras verifico en recepción.';
}

function Llamarapigemini(Claveapi, Cuerpopeticion) {
  const Base = (!Cuerpopeticion.model || Cuerpopeticion.model === 'gemini-3.8-flash') ? 'gemini-3.5-flash-lite' : Cuerpopeticion.model;
  const Candidatos = [Base, Base, 'gemini-3.6-flash', 'gemini-4-hydrogen'].filter(function(M, Idx, Arr) {
    return Idx === 0 || Idx === 1 || Arr.indexOf(M, 2) === Idx && M !== Base;
  });
  let Ultimotexto = '{}';
  for (let I = 0; I < Candidatos.length; I++) {
    const Peticion = Object.assign({}, Cuerpopeticion, { model: Candidatos[I] });
    const Resp = UrlFetchApp.fetch(Parametrosistema.urlgemini, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': String(Claveapi || '').trim(), 'Api-Revision': Parametrosistema.versionapi },
      payload: JSON.stringify(Peticion)
    });
    const Codigo = Resp.getResponseCode();
    Ultimotexto = Resp.getContentText();
    if (Codigo < 300) {
      if (I > 0) { Registrarbitacora('Gemini', 'RespaldoExitoso', `Respondido con ${Candidatos[I]} tras fallo previo.`); }
      return JSON.parse(Ultimotexto);
    }
    Registrarbitacora('Gemini', `ErrorHTTP_${Codigo}_${Candidatos[I]}`, Ultimotexto);
    if (Codigo !== 503 && Codigo !== 429 && Codigo !== 500 && Codigo !== 404) { break; }
    if (I === 0 && typeof Utilities !== 'undefined' && Utilities.sleep) { Utilities.sleep(800); }
  }
  try { return JSON.parse(Ultimotexto); } catch (E) { return {}; }
}

function doGet(Eventopeticion) {
  const Parametros = (Eventopeticion && Eventopeticion.parameter) || {};
  if (Parametros['hub.mode'] === 'subscribe') {
    const Credenciales = Obtenercredenciales();
    const Tokenrecibido = String(Parametros['hub.verify_token'] || '').trim();
    if (Credenciales.tokenverificacion &&
        Comparartiempoconstante(Tokenrecibido, Credenciales.tokenverificacion) &&
        Validarllavewebhook(Eventopeticion, Credenciales)) {
      return ContentService.createTextOutput(String(Parametros['hub.challenge'] || ''));
    }
    Registrarbitacora('Seguridad', 'SuscripcionRechazada', 'Verificación de webhook rechazada.');
    return ContentService.createTextOutput('No autorizado');
  }

  const Llegada = Esfechaisovalida(Parametros.llegada) ? String(Parametros.llegada).trim() : '';
  const Salida = Esfechaisovalida(Parametros.salida) ? String(Parametros.salida).trim() : '';
  const Huespedes = Math.max(1, Math.min(3, parseInt(Parametros.huespedes, 10) || 1));
  const Resultado = Consultardisponibilidad(Llegada, Salida, Huespedes);
  return ContentService.createTextOutput(JSON.stringify(Resultado)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(Eventopeticion) {
  try {
    const Cuerpo = JSON.parse((Eventopeticion && Eventopeticion.postData && Eventopeticion.postData.contents) || '{}');

    if (Cuerpo.object === 'whatsapp_business_account') {
      const Credenciales = Obtenercredenciales();
      if (!Validarllavewebhook(Eventopeticion, Credenciales)) {
        Registrarbitacora('Seguridad', 'WebhookRechazado', 'Llave de webhook ausente o inválida.');
        return Respuestajsonservidor({ exito: false, noautorizado: true });
      }
      const Entrada = Cuerpo.entry && Cuerpo.entry[0];
      const Cambios = Entrada && Entrada.changes && Entrada.changes[0];
      const Valor = Cambios && Cambios.value;

      if (!Valor || !Valor.messages || !Valor.messages[0]) {
        return ContentService.createTextOutput('OK');
      }
      if (!Validaridtelefonowhatsapp(Valor, Credenciales)) {
        return Respuestajsonservidor({ exito: false, noautorizado: true });
      }

      const Mensaje = Valor.messages[0];
      if (Evitarmensajerepetido(Mensaje.id)) {
        return ContentService.createTextOutput('OK');
      }

      const Contacto = (Valor.contacts && Valor.contacts[0]) || {};
      const Telefonodetectado = Normalizarcelularcolombiano(Mensaje.from) || Normalizarcelularcolombiano(Contacto.wa_id);
      const Remitente = Normalizaridwhatsapp(Mensaje.from || Contacto.wa_id || Mensaje.from_user_id || Mensaje.user_id || Contacto.user_id);
      if (!Remitente) {
        Registrarbitacora('Webhook', 'SinRemitente', JSON.stringify(Valor).slice(0, 450));
        return ContentService.createTextOutput('OK');
      }

      if (Remitente === Credenciales.celularadmin || (Telefonodetectado && `57${Telefonodetectado}` === Credenciales.celularadmin)) {
        Actualizarconversacion(Remitente, { nombre: 'Administrador', ultimomensajecliente: Formatearfechahora(new Date()) });
        Procesarmensajeadministrador(Mensaje);
        return ContentService.createTextOutput('OK');
      }

      const Estadoconv = Obtenerestadoconversacion(Remitente);
      const Ultimoms = Estadoconv.ultimomensajecliente ? new Date(Estadoconv.ultimomensajecliente).getTime() : 0;
      const Inactivodoshoras = Ultimoms > 0 && (Date.now() - Ultimoms) > 2 * 3600000;
      const Modoprevio = Estadoconv.modo;
      const Nombrerecordado = Estadoconv.nombre || '';
      const Reiniciarporcambio = Modoprevio === 'PostCanal' || Modoprevio === 'PendienteContacto' || Modoprevio === 'Finalizado';
      const Sesionnueva = !Estadoconv.idinteraccionia || Inactivodoshoras || Reiniciarporcambio;
      const Camposconv = { ultimomensajecliente: Formatearfechahora(new Date()) };
      if (Telefonodetectado) { Camposconv.telefonocontacto = Telefonodetectado; }
      if (Reiniciarporcambio) {
        if (typeof Restaurarencanalpendiente === 'function') { Restaurarencanalpendiente(Remitente, Estadoconv.codigoreserva); }
        Camposconv.modo = 'IA'; Camposconv.aperturacanal = ''; Camposconv.avisodemoracanal = ''; Camposconv.idinteraccionia = '';
      }
      else if (Inactivodoshoras && Modoprevio !== 'Canal' && Modoprevio !== 'PendienteAdmin') { Camposconv.idinteraccionia = ''; }
      Actualizarconversacion(Remitente, Camposconv);

      if (Modoprevio === 'Canal' || Modoprevio === 'PendienteAdmin') {
        Procesarmensajeclienteencanal(Remitente, Mensaje);
        return ContentService.createTextOutput('OK');
      }

      if (Mensaje.type === 'text' && Mensaje.text) {
        const Respuestabot = Procesarmensajecongemini(Remitente, Mensaje.text.body, { modoprevio: Modoprevio, nombrerecordado: Nombrerecordado, sesionnueva: Sesionnueva });
        if (Respuestabot) { Enviarmensajewhatsapp(Remitente, Respuestabot); }
      } else if (Mensaje.type === 'document' && Mensaje.document) {
        if (typeof Procesarrutentrante !== 'function' || !Procesarrutentrante(Remitente, Mensaje.document.id, Mensaje.document.mime_type || 'application/pdf')) {
          const Respdoc = Procesarmensajecongemini(Remitente, 'El cliente envió un documento que no se pudo leer como RUT. Pídele enviarlo más nítido o escribir los datos.');
          if (Respdoc) { Enviarmensajewhatsapp(Remitente, Respdoc); }
        }
      } else if (Mensaje.type === 'image' && Mensaje.image) {
        const Resconf = typeof Buscarreservaconfirmadacliente === 'function' ? Buscarreservaconfirmadacliente(Remitente, Estadoconv.codigoreserva) : null;
        if (Resconf && typeof Procesarrutentrante === 'function' && Procesarrutentrante(Remitente, Mensaje.image.id, 'image/jpeg')) {
          return ContentService.createTextOutput('OK');
        }
        const Datosrecibo = Analizarcomprobanteimagen(Mensaje.image.id);
        if (Datosrecibo && Datosrecibo.escomprobante && Datosrecibo.monto && Datosrecibo.referencia) {
          Datosrecibo.idimagen = Mensaje.image.id;
          const Rescomp = Registrarcomprobante(Remitente, Estadoconv.codigoreserva, Datosrecibo);
          if (Rescomp && Rescomp.mensajecliente) { Enviarmensajewhatsapp(Remitente, Rescomp.mensajecliente); }
          else if (Rescomp && Rescomp.mensaje && !Rescomp.confirmada) { Enviarmensajewhatsapp(Remitente, Rescomp.mensaje); }
        } else {
          const Respimagen = Procesarmensajecongemini(Remitente, `El cliente envió una imagen que no parece un comprobante completo: ${JSON.stringify(Datosrecibo)}. Indícale amablemente qué dato falta.`);
          if (Respimagen) { Enviarmensajewhatsapp(Remitente, Respimagen); }
        }
      }

      return ContentService.createTextOutput('OK');
    }

    if (Cuerpo.accion === 'autenticaradmin') { return Respuestajsonservidor(Autenticaradminservidor(Cuerpo.pin)); }
    if (Cuerpo.accion === 'cerrarsesionadmin') { return Respuestajsonservidor(Revocartokenadmin(Cuerpo.tokenadmin)); }
    if (Cuerpo.accion === 'obtenerreservas') {
      if (!Validartokenadmin(Cuerpo.tokenadmin)) {
        return Respuestajsonservidor({ exito: false, noautorizado: true, mensaje: 'Sesión no autorizada.' });
      }
      return Respuestajsonservidor(Obtenerreservasreales());
    }
    if (Cuerpo.accion === 'bienvenida') { return Respuestajsonservidor(Procesarcorreobienvenida(Cuerpo.token)); }
    if (Cuerpo.accion === 'recuperarclave') { return Respuestajsonservidor(Procesarrecuperacionclave(Cuerpo.correo)); }
    if (Cuerpo.accion === 'registrarreserva') {
      const Autorizadoadmin = Boolean(Cuerpo.tokenadmin && Validartokenadmin(Cuerpo.tokenadmin));
      if (Cuerpo.datos && Cuerpo.datos.estado === 'Confirmada' && !Autorizadoadmin) {
        return Respuestajsonservidor({ exito: false, noautorizado: true, mensaje: 'Se requiere sesión de recepción para confirmar ingresos.' });
      }
      if (!Autorizadoadmin && !Permitirtasapublica('WEB_RESERVA', 12, 60)) {
        return Respuestajsonservidor({ exito: false, mensaje: 'Demasiadas solicitudes en poco tiempo. Espera un minuto e intenta de nuevo.' });
      }
      const Validacion = Validarreservaentrada(Cuerpo.datos || {}, Autorizadoadmin);
      if (!Validacion.exito) { return Respuestajsonservidor(Validacion); }
      return Respuestajsonservidor(Registrarosincronizarreserva(Validacion.datos, Autorizadoadmin));
    }
    if (Cuerpo.accion === 'habilitarhabitacion' || Cuerpo.accion === 'marcarlimpieza') {
      if (!Validartokenadmin(Cuerpo.tokenadmin)) {
        return Respuestajsonservidor({ exito: false, noautorizado: true, mensaje: 'Sesión no autorizada.' });
      }
      if (!Eshabitacionhabilitada(Cuerpo.habitacion)) {
        return Respuestajsonservidor({ exito: false, mensaje: 'Habitación no válida.' });
      }
      return Respuestajsonservidor(Gestionarlimpiezahabitacion(Cuerpo.habitacion, Cuerpo.accion === 'habilitarhabitacion'));
    }
    return Respuestajsonservidor({ exito: false, mensaje: 'Acción no reconocida.' });
  } catch (Errorpost) {
    Registrarbitacora('Webhook', 'ErrorDoPost', String(Errorpost));
    return Respuestajsonservidor({ exito: false, mensaje: 'No pudimos procesar la solicitud en este momento.' });
  }
}
