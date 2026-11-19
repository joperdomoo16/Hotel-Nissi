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

// Descarga la imagen del comprobante desde WhatsApp y extrae los datos
function Analizarcomprobanteimagen(Idimagenwhatsapp) {
  const Credenciales = Obtenercredenciales();
  const Respuestameta = UrlFetchApp.fetch(`https://graph.facebook.com/v21.0/${Idimagenwhatsapp}`, {
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }
  });
  const Datosmeta = JSON.parse(Respuestameta.getContentText());
  const Descargaimagen = UrlFetchApp.fetch(Datosmeta.url, {
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }
  });

  const Bytesbase = Utilities.base64Encode(Descargaimagen.getBlob().getBytes());
  const Tipomime = Descargaimagen.getBlob().getContentType() || 'image/jpeg';

  const Solicitudgemini = {
    model: Parametrosistema.modeloia,
    input: [
      { type: 'text', text: 'Analiza esta captura de pantalla de un comprobante de pago en Colombia (Nequi o transferencia bancaria). Extrae exactamente en formato JSON sin bloques markdown: {"escomprobante": true/false, "monto": numero en pesos sin puntos, "referencia": "numero de comprobante o referencia", "entidad": "Nequi/Otro", "fecha": "YYYY-MM-DD HH:mm"}.' },
      { type: 'image', data: Bytesbase, mime_type: Tipomime }
    ]
  };

  const Respuestagemini = Llamarapigemini(Credenciales.clavegemini, Solicitudgemini);
  const Textosalida = Extraertextointeraccion(Respuestagemini);
  try {
    const Jsonlimpio = Textosalida.replace(/```json|```/g, '').trim();
    return JSON.parse(Jsonlimpio);
  } catch (Errorjson) {
    return { escomprobante: false, detalle: Textosalida };
  }
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

// Definicion de funciones disponibles para consulta y apartado
function Crearherramientaia(Nombre, Descripcion, Propiedades, Requeridos) {
  const Obj = { type: 'function', name: Nombre, description: Descripcion, parameters: { type: 'object', properties: Propiedades } };
  if (Requeridos && Requeridos.length) { Obj.parameters.required = Requeridos; }
  return Obj;
}

function Obtenerherramientasia() {
  return [
    Crearherramientaia('Guardarnombrecliente', 'Guarda el nombre del cliente apenas lo indique para recordarlo en futuras conversaciones.', {
      nombre: { type: 'string', description: 'Nombre indicado por el cliente' }
    }, ['nombre']),
    Crearherramientaia('Consultardisponibilidad', 'Lee qué habitaciones están libres en Google Sheets y calcula la tarifa por cantidad de personas.', {
      fechallegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' },
      fechasalida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
      cantidadhuespedes: { type: 'integer', description: 'Número de personas (1 a 3)' },
      camasseparadas: { type: 'boolean', description: 'True si son 2 personas y desean camas separadas' }
    }, ['fechallegada', 'fechasalida']),
    Crearherramientaia('Apartarhabitacion', 'Aparta automáticamente la habitación elegida con su tarifa calculada por persona y uso de camas.', {
      habitacion: { type: 'string', description: 'Número de habitación disponible (01, 02, 04, 05 o 06)' },
      fechallegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' },
      fechasalida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
      cantidadhuespedes: { type: 'integer', description: 'Cantidad de huéspedes (1 a 3)' },
      camasseparadas: { type: 'boolean', description: 'True si son 2 personas en camas individuales' }
    }, ['habitacion', 'fechallegada', 'fechasalida']),
    Crearherramientaia('Liberarapartado', 'Libera la habitación apartada si el cliente desiste o cancela.', {
      codigo: { type: 'string', description: 'Código de la reserva (ej. NS-4K9A)' },
      motivo: { type: 'string', description: 'Motivo por el que libera' }
    }),
    Crearherramientaia('Guardardatoshuesped', 'Guarda nombre completo, cédula de ciudadanía, hora estimada de llegada y contacto en la reserva apartada.', {
      codigo: { type: 'string', description: 'Código de reserva (ej. NS-4K9A)' },
      nombre: { type: 'string', description: 'Nombre completo del huésped' },
      cedula: { type: 'string', description: 'Número de cédula de ciudadanía' },
      horallegada: { type: 'string', description: 'Hora estimada de llegada (ej. 8:00 p. m.)' },
      celularcontacto: { type: 'string', description: 'Celular de contacto si indica otro' },
      parqueadero: { type: 'string', description: 'No, o detalle de vehículos (ej. "Sí, 1 carro")' }
    }, ['nombre', 'cedula']),
    Crearherramientaia('Enviardatospago', 'Devuelve la cuenta de Nequi y el valor exacto a transferir para Nequi o pago Mixto.', {
      codigo: { type: 'string', description: 'Código de la reserva apartada' },
      mediopago: { type: 'string', description: '"Nequi" o "Mixto"' },
      montonequi: { type: 'number', description: 'Si es Mixto, pesos por Nequi' },
      montoefectivo: { type: 'number', description: 'Si es Mixto, pesos en efectivo al llegar' },
      montobillete: { type: 'number', description: 'Si es Mixto, billete en efectivo (opcional)' }
    }),
    Crearherramientaia('Registrarcomprobante', 'Guarda los datos de la captura de Nequi para verificarlos contra el correo del banco.', {
      codigo: { type: 'string', description: 'Código de reserva' },
      monto: { type: 'number', description: 'Monto en COP de la captura' },
      referencia: { type: 'string', description: 'Referencia o número de comprobante' },
      entidad: { type: 'string', description: 'Nequi' },
      fecha: { type: 'string', description: 'Fecha y hora del comprobante' }
    }, ['monto', 'referencia']),
    Crearherramientaia('Confirmarreservaefectivo', 'Confirma una reserva 100% en efectivo tras validar el monto/billete y confirmación del resumen.', {
      codigo: { type: 'string', description: 'Código de la reserva apartada' },
      montobillete: { type: 'number', description: 'Monto o billete con el que pagará en efectivo' }
    }, ['montobillete']),
    Crearherramientaia('Solicitaradministrador', 'Solicita conexión con un administrador cuando pide persona, más de 3 huéspedes o caso especial.', {
      codigo: { type: 'string', description: 'Código de reserva si existe' },
      motivo: { type: 'string', description: 'Motivo de la solicitud' },
      resumen: { type: 'string', description: 'Resumen breve de lo conversado con el cliente' }
    }),
    Crearherramientaia('Solicitarampliacioncheckout', 'Cotiza o registra ampliación de hora de salida después de las 11:00 a. m. ($10.000 COP/hora).', {
      codigo: { type: 'string', description: 'Código de la reserva confirmada' },
      horasalida: { type: 'string', description: 'Hora solicitada (ej. 2:00 p. m.)' },
      mediopago: { type: 'string', description: 'Vacío para cotizar; "transferencia" o "efectivo" al elegir pago' }
    }, ['horasalida'])
  ];
}

function Ejecutarherramientaia(Nombre, Argumentos, Celularcliente) {
  if (Nombre === 'Guardarnombrecliente') {
    const Nom = Sanitizarcelda(Argumentos.nombre, 60);
    if (Nom) { Actualizarconversacion(Celularcliente, { nombre: Nom }); }
    return { exito: Boolean(Nom), nombre: Nom };
  }
  if (Nombre === 'Consultardisponibilidad') { return Consultardisponibilidad(Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes, Argumentos.camasseparadas); }
  if (Nombre === 'Apartarhabitacion') { return Apartarhabitacion(Celularcliente, Argumentos.habitacion, Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes, 'WhatsApp', Argumentos.camasseparadas); }
  if (Nombre === 'Liberarapartado') { return Liberarapartado(Celularcliente, Argumentos.codigo, Argumentos.motivo); }
  if (Nombre === 'Guardardatoshuesped') { return Guardardatoshuesped(Celularcliente, Argumentos.codigo, Argumentos.nombre, Argumentos.cedula, Argumentos.horallegada, Argumentos.celularcontacto, Argumentos.parqueadero); }
  if (Nombre === 'Enviardatospago') { return Enviardatospago(Celularcliente, Argumentos.codigo, Argumentos.mediopago, Argumentos.montonequi, Argumentos.montoefectivo, Argumentos.montobillete); }
  if (Nombre === 'Registrarcomprobante') { return Registrarcomprobante(Celularcliente, Argumentos.codigo, Argumentos); }
  if (Nombre === 'Confirmarreservaefectivo') { return Confirmarreservaefectivo(Celularcliente, Argumentos.codigo, Argumentos.montobillete); }
  if (Nombre === 'Solicitaradministrador') { return Solicitaradministrador(Celularcliente, Argumentos.codigo, Argumentos.motivo, Argumentos.resumen); }
  if (Nombre === 'Solicitarampliacioncheckout') { return Solicitarampliacioncheckout(Celularcliente, Argumentos.codigo, Argumentos.horasalida, Argumentos.mediopago); }
  return { exito: false, mensaje: 'Herramienta no reconocida' };
}

function Procesarmensajecongemini(Celularcliente, Textomensaje, Contexto) {
  const Credenciales = Obtenercredenciales();
  const Estadoconv = Obtenerestadoconversacion(Celularcliente);
  const Ctx = Contexto || {};
  const Modoprevio = Ctx.modoprevio || Estadoconv.modo;
  const Nombrerecordado = Ctx.nombrerecordado !== undefined ? Ctx.nombrerecordado : (Estadoconv.nombre || '');
  const Nombrevalido = Nombrerecordado && !/^(cliente|viajero|por confirmar)$/i.test(Nombrerecordado.trim()) ? Nombrerecordado.trim() : '';
  const Sesionnueva = Ctx.sesionnueva !== undefined ? Ctx.sesionnueva : !Estadoconv.idinteraccionia;
  const Hoy = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');

  let Reglacontexto = '';
  if (Modoprevio === 'PostCanal') {
    Reglacontexto = `\nATENCIÓN POST-CANAL: El canal con el administrador acaba de cerrarse por inactividad y se preguntó a ${Nombrevalido || 'el cliente'} si concretó reserva con el administrador. Procesa su respuesta: si confirmó que sí reservó, felicítalo y pregunta si requiere indicaciones de llegada o algo adicional; si no concretó o desea continuar, ofrece consultar disponibilidad o iniciar una nueva reserva.`;
  } else if (Sesionnueva && Nombrevalido) {
    Reglacontexto = `\nMEMORIA DE CLIENTE RECURRENTE: Este número ya escribió anteriormente y su nombre es "${Nombrevalido}". NO pidas el nombre ni uses el saludo de primera vez. Saluda exactamente con: "Hola ${Primernombre(Nombrevalido)}, un gusto atenderte nuevamente, ¿en qué te puedo ayudar el día de hoy?" (si ya hizo una pregunta en este mensaje, respóndela justo después del saludo).`;
  }

  const Instruccionessistema =
    `Actúas como la recepcionista humana, cálida, cercana y servicial de Hospedaje Nissi en Mingueo, Dibulla, La Guajira. Hoy es ${Hoy}. Hablas en español colombiano natural y respetuoso.\n` +
    `CONTEXTO: Jamás respondas preguntas ajenas al hospedaje (ciencia, historia, matemáticas, etc.). Di amablemente que en recepción solo atiendes reservas e información del hospedaje y retoma el paso actual.\n` +
    `TARIFAS Y HABITACIONES: Todas tienen aire acondicionado, Wi-Fi, TV y acceso al parqueadero general del hospedaje. La habitación 03 está en rediseño (nunca la ofrezcas). El cobro es por PERSONAS: ` +
    `1 persona = $55.000/noche (aplica incluso en habitaciones de 2 o 3 personas); 2 personas = $70.000/noche si comparten la cama doble/queen, o $90.000/noche si usan cada uno su cama individual (solo en habs. 01, 02 y 06; las habs. 04 y 05 tienen 1 cama doble a $70.000); 3 personas = $110.000/noche.\n` +
    `MÁS DE 3 PERSONAS: Si el cliente pide para más de 3 personas, NO consultes habitaciones ni apartes nada; respóndele exactamente en este tono: "Entiendo, [Nombre]. Para este caso debo comunicarte con un administrador, si quieres puedo comunicarte ahora mismo." Si confirma que sí, ejecuta Solicitaradministrador y no escribas texto adicional.\n` +
    `PASOS DE RESERVA:\n` +
    `1) Primer mensaje (solo si NO hay memoria previa): "¡Hola! ¿Cómo estás? Hablas con la recepción del Hospedaje Nissi en Mingueo 😊 ¿Me puedes indicar tu nombre, por favor?".\n` +
    `2) Apenas el cliente diga su nombre por primera vez, llama INMEDIATAMENTE a Guardarnombrecliente(nombre), salúdalo por su nombre, dile: "Para continuar con la conversación te informo que tus datos personales se tratarán conforme a la Ley 1581 de 2012 para gestionar tu reserva." y pregúntale cuántas personas son, fechas de llegada y salida, y si requiere parqueadero. Si dice NO al parqueadero, no preguntes más de vehículos; si dice SÍ, pregunta tipo y cantidad de vehículos.\n` +
    `3) Con fechas, personas (1 a 3) y parqueadero listo, llama a Consultardisponibilidad. Si son 2 personas y están libres 01, 02 o 06, explícales ambas opciones ($70.000 compartiendo cama / $90.000 camas separadas) y pregunta qué prefieren antes de apartar.\n` +
    `4) Al elegir habitación (y tipo de camas si aplica), llama a Apartarhabitacion y responde: "¡Listo, [Nombre]! Te aparté la habitación XX, con el código NS-XXXX. Para continuar dime tu nombre completo, cédula de ciudadanía, hora estimada de llegada y número de contacto."\n` +
    `5) Guarda con Guardardatoshuesped (incluyendo parqueadero) y pregunta el medio de pago. El hospedaje SOLO acepta: Nequi, Efectivo o Mixto (una parte por Nequi y otra en Efectivo).\n` +
    `PAGO EN EFECTIVO (sin pasar a administrador): Si elige Efectivo, respóndele cálidamente: "Perfecto, como tu pago es en efectivo, por favor indícame con qué monto vas a pagar para tener listo el cambio cuando llegues al hospedaje." Apenas responda el billete/monto, envíale el resumen completo para confirmar: Nombre, C.C., habitación y personas/camas, pago en efectivo (y que se tendrá el cambio listo), parqueadero (y tipo/cantidad de vehículo si aplica), fechas de llegada y salida, y pregunta "¿Es correcto?". Apenas responda que sí, llama a Confirmarreservaefectivo y dile: "Tu reserva ha quedado confirmada con el código [NS-XXXX]. Ya se ha notificado a la recepción del hospedaje; cualquier inconveniente o cancelación lo puedes llevar a cabo por este mismo chat. ¡Esperamos tu llegada!" e incluye SIEMPRE los enlaces de rutamaps y rutawaze para abrir Google Maps y Waze directo al hospedaje.\n` +
    `PAGO POR NEQUI O MIXTO: Si elige Nequi 100%, llama a Enviardatospago(mediopago:"Nequi") y pídele enviar la captura del comprobante aquí. Si elige Mixto, pregúntale cuánto pagará ahora por Nequi, cuánto pagará en efectivo al llegar (validando que sume el total) y con qué monto pagará la parte en efectivo para tener cambio; luego llama a Enviardatospago(mediopago:"Mixto", montonequi, montoefectivo, montobillete) y pídele enviar la captura de la parte por Nequi.\n` +
    `CANCELACIÓN: Si un huésped pide cancelar o desistir de su reserva, usa Liberarapartado.\n` +
    `CHECK-OUT (11:00 a. m.): Cada hora adicional vale $10.000 COP. Si quiere ampliar su salida, usa Solicitarampliacioncheckout primero sin mediopago para cotizar y preguntar si paga por Nequi ya o en efectivo al salir; luego llama de nuevo con mediopago.\n` +
    `Nunca inventes precios ni disponibilidad y nunca confirmes reservas sin usar las herramientas.${Reglacontexto}`;

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
  if (Abriocanal) {
    return '';
  }
  return Extraertextointeraccion(Respuesta) || 'Permíteme un momento mientras verifico en recepción.';
}

function Llamarapigemini(Claveapi, Cuerpopeticion) {
  if (!Cuerpopeticion.model || Cuerpopeticion.model === 'gemini-3.8-flash') {
    Cuerpopeticion.model = 'gemini-3.5-flash-lite';
  }
  const Respuestahttp = UrlFetchApp.fetch(Parametrosistema.urlgemini, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': String(Claveapi || '').trim(), 'Api-Revision': Parametrosistema.versionapi },
    payload: JSON.stringify(Cuerpopeticion)
  });
  const Texto = Respuestahttp.getContentText();
  if (Respuestahttp.getResponseCode() >= 300) {
    Registrarbitacora('Gemini', `ErrorHTTP_${Respuestahttp.getResponseCode()}`, Texto);
  }
  return JSON.parse(Texto);
}

function doGet(Eventopeticion) {
  const Parametros = (Eventopeticion && Eventopeticion.parameter) || {};
  if (Parametros['hub.mode'] === 'subscribe') {
    const Credenciales = Obtenercredenciales();
    const Tokenrecibido = String(Parametros['hub.verify_token'] || '').trim();
    if (Tokenrecibido === Credenciales.tokenverificacion || Tokenrecibido === 'nissiverificacion' || Tokenrecibido === 'nissiverificacion2026') {
      return ContentService.createTextOutput(Parametros['hub.challenge']);
    }
    return ContentService.createTextOutput('Token invalido');
  }
  if (Parametros.tipo === 'reservas') {
    return ContentService.createTextOutput(JSON.stringify(Obtenerreservasreales())).setMimeType(ContentService.MimeType.JSON);
  }
  const Resultado = Consultardisponibilidad(Parametros.llegada, Parametros.salida, Parametros.huespedes);
  return ContentService.createTextOutput(JSON.stringify(Resultado)).setMimeType(ContentService.MimeType.JSON);
}

// Punto de entrada POST para el webhook de WhatsApp y peticiones de la web
function doPost(Eventopeticion) {
  try {
    const Cuerpo = JSON.parse((Eventopeticion && Eventopeticion.postData && Eventopeticion.postData.contents) || '{}');

    if (Cuerpo.object === 'whatsapp_business_account') {
      const Entrada = Cuerpo.entry && Cuerpo.entry[0];
      const Cambios = Entrada && Entrada.changes && Entrada.changes[0];
      const Valor = Cambios && Cambios.value;

      // Ignorar avisos de entrega o lectura de Meta
      if (!Valor || !Valor.messages || !Valor.messages[0]) {
        return ContentService.createTextOutput('OK');
      }

      const Mensaje = Valor.messages[0];
      if (Evitarmensajerepetido(Mensaje.id)) {
        return ContentService.createTextOutput('OK');
      }

      const Contacto = (Valor.contacts && Valor.contacts[0]) || {};
      const Remitente = Normalizaridwhatsapp(Mensaje.from || Contacto.wa_id || Mensaje.from_user_id || Mensaje.user_id || Contacto.user_id);
      if (!Remitente) {
        Registrarbitacora('Webhook', 'SinRemitente', JSON.stringify(Valor).slice(0, 450));
        return ContentService.createTextOutput('OK');
      }
      const Credenciales = Obtenercredenciales();

      // Si escribe el administrador desde su WhatsApp personal
      if (Remitente === Credenciales.celularadmin) {
        Actualizarconversacion(Remitente, { nombre: 'Administrador', ultimomensajecliente: Formatearfechahora(new Date()) });
        Procesarmensajeadministrador(Mensaje);
        return ContentService.createTextOutput('OK');
      }

      const Estadoconv = Obtenerestadoconversacion(Remitente);
      const Ultimoms = Estadoconv.ultimomensajecliente ? new Date(Estadoconv.ultimomensajecliente).getTime() : 0;
      const Inactivo2h = Ultimoms > 0 && (Date.now() - Ultimoms) > 2 * 3600000;
      const Modoprevio = Estadoconv.modo;
      const Nombrerecordado = Estadoconv.nombre || '';
      const Reiniciarporcambio = Modoprevio === 'PostCanal' || Modoprevio === 'PendienteContacto' || Modoprevio === 'Finalizado';
      const Sesionnueva = !Estadoconv.idinteraccionia || Inactivo2h || Reiniciarporcambio;
      const Camposconv = { ultimomensajecliente: Formatearfechahora(new Date()) };
      if (Reiniciarporcambio) { Camposconv.modo = 'IA'; Camposconv.aperturacanal = ''; Camposconv.idinteraccionia = ''; }
      else if (Inactivo2h && Modoprevio !== 'Canal' && Modoprevio !== 'PendienteAdmin') { Camposconv.idinteraccionia = ''; }
      Actualizarconversacion(Remitente, Camposconv);

      // Si el cliente esta esperando al administrador o ya tiene canal abierto, la IA no responde
      if (Modoprevio === 'Canal' || Modoprevio === 'PendienteAdmin') {
        Procesarmensajeclienteencanal(Remitente, Mensaje);
        return ContentService.createTextOutput('OK');
      }

      if (Mensaje.type === 'text' && Mensaje.text) {
        const Respuestabot = Procesarmensajecongemini(Remitente, Mensaje.text.body, { modoprevio: Modoprevio, nombrerecordado: Nombrerecordado, sesionnueva: Sesionnueva });
        if (Respuestabot) {
          Enviarmensajewhatsapp(Remitente, Respuestabot);
        }
      } else if (Mensaje.type === 'image' && Mensaje.image) {
        const Datosrecibo = Analizarcomprobanteimagen(Mensaje.image.id);
        if (Datosrecibo && Datosrecibo.escomprobante && Datosrecibo.monto && Datosrecibo.referencia) {
          const Rescomp = Registrarcomprobante(Remitente, Estadoconv.codigoreserva, Datosrecibo);
          if (Rescomp && Rescomp.mensajecliente) {
            Enviarmensajewhatsapp(Remitente, Rescomp.mensajecliente);
          } else if (Rescomp && Rescomp.mensaje && !Rescomp.confirmada) {
            Enviarmensajewhatsapp(Remitente, Rescomp.mensaje);
          }
        } else {
          const Respimagen = Procesarmensajecongemini(Remitente, `El cliente envió una imagen que no parece un comprobante completo: ${JSON.stringify(Datosrecibo)}. Indícale amablemente qué dato falta.`);
          if (Respimagen) { Enviarmensajewhatsapp(Remitente, Respimagen); }
        }
      }

      return ContentService.createTextOutput('OK');
    }

    if (Cuerpo.accion === 'bienvenida') { return Respuestajsonservidor(Procesarcorreobienvenida(Cuerpo.token)); }
    if (Cuerpo.accion === 'recuperarclave') { return Respuestajsonservidor(Procesarrecuperacionclave(Cuerpo.correo)); }
    if (Cuerpo.accion === 'registrarreserva') {
      return ContentService.createTextOutput(JSON.stringify(Registrarosincronizarreserva(Cuerpo.datos || {}))).setMimeType(ContentService.MimeType.JSON);
    }
    if (Cuerpo.accion === 'habilitarhabitacion' || Cuerpo.accion === 'marcarlimpieza') {
      return Respuestajsonservidor(Gestionarlimpiezahabitacion(Cuerpo.habitacion, Cuerpo.accion === 'habilitarhabitacion'));
    }
    return ContentService.createTextOutput(JSON.stringify({ exito: false, mensaje: 'Acción no reconocida' })).setMimeType(ContentService.MimeType.JSON);
  } catch (Errorpost) {
    Registrarbitacora('Webhook', 'ErrorDoPost', String(Errorpost));
    return ContentService.createTextOutput(JSON.stringify({ exito: false, mensaje: String(Errorpost) })).setMimeType(ContentService.MimeType.JSON);
  }
}
