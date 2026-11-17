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
      {
        type: 'text',
        text: 'Analiza esta captura de pantalla de un comprobante de pago en Colombia (Nequi, Bancolombia, Daviplata o transferencia bancaria). Extrae exactamente en formato JSON sin bloques markdown: {"escomprobante": true/false, "monto": numero en pesos sin puntos, "referencia": "numero de comprobante o referencia", "entidad": "Nequi/Bancolombia/Daviplata/Otro", "fecha": "YYYY-MM-DD HH:mm"}.'
      },
      {
        type: 'image',
        data: Bytesbase,
        mime_type: Tipomime
      }
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
function Obtenerherramientasia() {
  return [
    {
      type: 'function',
      name: 'Consultardisponibilidad',
      description: 'Lee qué habitaciones están libres en Google Sheets para esas fechas y número de personas.',
      parameters: {
        type: 'object',
        properties: {
          fechallegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' },
          fechasalida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
          cantidadhuespedes: { type: 'integer', description: 'Número de personas (1 a 4)' }
        },
        required: ['fechallegada', 'fechasalida']
      }
    },
    {
      type: 'function',
      name: 'Apartarhabitacion',
      description: 'Aparta automáticamente la habitación elegida por el cliente para que nadie más la tome.',
      parameters: {
        type: 'object',
        properties: {
          habitacion: { type: 'string', description: 'Número de habitación de 01 a 06' },
          fechallegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' },
          fechasalida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
          cantidadhuespedes: { type: 'integer', description: 'Cantidad de huéspedes' }
        },
        required: ['habitacion', 'fechallegada', 'fechasalida']
      }
    },
    {
      type: 'function',
      name: 'Liberarapartado',
      description: 'Libera la habitación apartada si el cliente desiste o decide no continuar.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de la reserva apartada (ej. NS-4K9A)' },
          motivo: { type: 'string', description: 'Motivo por el que libera' }
        }
      }
    },
    {
      type: 'function',
      name: 'Guardardatoshuesped',
      description: 'Guarda el nombre completo, cédula de ciudadanía, hora estimada de llegada y teléfono de contacto en la reserva apartada.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de reserva (ej. NS-4K9A)' },
          nombre: { type: 'string', description: 'Nombre completo del huésped' },
          cedula: { type: 'string', description: 'Número de cédula de ciudadanía' },
          horallegada: { type: 'string', description: 'Hora estimada de llegada (ej. 8:00 p. m.)' },
          celularcontacto: { type: 'string', description: 'Número de celular de contacto si el cliente indica uno' },
          parqueadero: { type: 'string', description: 'Si requiere parqueadero: "No" o detalle de cantidad y tipo de vehículo (ej. "Sí, 1 carro" o "Sí, 2 motos")' }
        },
        required: ['nombre', 'cedula']
      }
    },
    {
      type: 'function',
      name: 'Enviardatospago',
      description: 'Obtiene las cuentas de transferencia (Nequi, Daviplata, Bancolombia) y el monto exacto a pagar de la hoja Configuracion.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de la reserva apartada' }
        }
      }
    },
    {
      type: 'function',
      name: 'Registrarcomprobante',
      description: 'Guarda los datos leídos de la captura de pago para que el sistema los verifique contra el correo del banco.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de reserva' },
          monto: { type: 'number', description: 'Monto en pesos colombianos leído de la captura' },
          referencia: { type: 'string', description: 'Referencia o número de comprobante' },
          entidad: { type: 'string', description: 'Nequi, Daviplata o Bancolombia' },
          fecha: { type: 'string', description: 'Fecha y hora del comprobante' }
        },
        required: ['monto', 'referencia']
      }
    },
    {
      type: 'function',
      name: 'Solicitarpagoefectivo',
      description: 'Solicita conexión con un administrador cuando el cliente indica que desea pagar en efectivo.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de la reserva apartada' },
          resumen: { type: 'string', description: 'Resumen breve de lo conversado con el cliente' }
        }
      }
    },
    {
      type: 'function',
      name: 'Solicitaradministrador',
      description: 'Solicita conexión con un administrador cuando el cliente pide hablar con una persona o tiene un caso especial.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de reserva si existe' },
          motivo: { type: 'string', description: 'Motivo de la solicitud' },
          resumen: { type: 'string', description: 'Resumen breve de lo conversado con el cliente' }
        }
      }
    }
  ];
}

function Ejecutarherramientaia(Nombre, Argumentos, Celularcliente) {
  if (Nombre === 'Consultardisponibilidad') {
    return Consultardisponibilidad(Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes);
  }
  if (Nombre === 'Apartarhabitacion') {
    return Apartarhabitacion(Celularcliente, Argumentos.habitacion, Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes, 'WhatsApp');
  }
  if (Nombre === 'Liberarapartado') {
    return Liberarapartado(Celularcliente, Argumentos.codigo, Argumentos.motivo);
  }
  if (Nombre === 'Guardardatoshuesped') {
    return Guardardatoshuesped(Celularcliente, Argumentos.codigo, Argumentos.nombre, Argumentos.cedula, Argumentos.horallegada, Argumentos.celularcontacto, Argumentos.parqueadero);
  }
  if (Nombre === 'Enviardatospago') {
    return Enviardatospago(Celularcliente, Argumentos.codigo);
  }
  if (Nombre === 'Registrarcomprobante') {
    return Registrarcomprobante(Celularcliente, Argumentos.codigo, Argumentos);
  }
  if (Nombre === 'Solicitarpagoefectivo') {
    return Solicitarpagoefectivo(Celularcliente, Argumentos.codigo, Argumentos.resumen);
  }
  if (Nombre === 'Solicitaradministrador') {
    return Solicitaradministrador(Celularcliente, Argumentos.codigo, Argumentos.motivo, Argumentos.resumen);
  }
  return { exito: false, mensaje: 'Herramienta no reconocida' };
}

function Procesarmensajecongemini(Celularcliente, Textomensaje) {
  const Credenciales = Obtenercredenciales();
  const Estadoconv = Obtenerestadoconversacion(Celularcliente);
  const Esprimermensaje = !Estadoconv.idinteraccionia;
  const Hoy = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');

  const Instruccionessistema =
    `Actúas como la recepcionista humana, cálida, cercana y servicial de Hospedaje Nissi en Mingueo, municipio de Dibulla, La Guajira (sobre la Troncal del Caribe, entre Santa Marta y Riohacha). ` +
    `Hoy es ${Hoy}. Hablas en español colombiano natural, respetuoso y amable (sin sonar a robot y sin usar apelativos como "mi amor" o "corazón"). ` +
    `REGLA ESTRICTA DE CONTEXTO: Jamás respondas preguntas de cultura general, ciencia, matemáticas, tareas, programación ni temas ajenos al hospedaje (por ejemplo, si preguntan la distancia entre la Tierra y la Luna o cualquier tema fuera del hotel, NO des el dato; responde con simpatía que desde la recepción de Hospedaje Nissi solo puedes brindar información de alojamiento y reservas, y retoma amablemente el paso en el que iban). ` +
    `Sigue esta conversación natural paso a paso:\n` +
    `Paso 1 (Saludo inicial): Si es el primer mensaje y el cliente aún no ha dicho su nombre, salúdalo con calidez: "¡Hola! ¿Cómo estás? Hablas con la recepción del Hospedaje Nissi en Mingueo 😊 ¿Me puedes indicar tu nombre, por favor?".\n` +
    `Paso 2 (Aviso Ley 1581, fechas y parqueadero): Apenas te diga su nombre, salúdalo por su nombre de pila, infórmale: "Para continuar con la conversación te informo que tus datos personales se tratarán conforme a la Ley 1581 de 2012 para gestionar tu reserva." y pregúntale: "Para empezar, [Nombre], me gustaría saber para cuántas personas sería, tu fecha de llegada y salida al hospedaje, y si requieres parqueadero." (Si en su primer mensaje ya dio fechas, igual incluye el aviso de la Ley 1581 de 2012 y pregunta si requiere parqueadero).\n` +
    `Regla de parqueadero: Si el cliente dice que NO requiere parqueadero, NO le hagas más preguntas sobre vehículos y avanza directo al Paso 3. Si dice que SÍ requiere parqueadero y aún no ha dicho los detalles, pregúntale amablemente qué tipo de vehículo trae (ej. moto, carro, camioneta) y cuántos vehículos son, y recuérdalo para guardarlo luego en Guardardatoshuesped.\n` +
    `Paso 3 (Disponibilidad): Cuando tengas fechas de llegada, salida, cantidad de personas y el dato de parqueadero completo, ejecuta Consultardisponibilidad y muéstrale SOLO las habitaciones disponibles con su tarifa real, cerrando con "¿Cuál te gustaría elegir?".\n` +
    `Paso 4 (Apartado inmediato): Cuando elija una habitación, ejecuta de inmediato Apartarhabitacion y respóndele cálidamente: "¡Listo, [Nombre]! Te aparté la habitación XX, con el código de reserva NS-XXXX.\nPara continuar con el registro, por favor dime tu nombre completo, número de cédula de ciudadanía, la hora estimada de llegada y un número de contacto."\n` +
    `Paso 5 (Datos y pago): Cuando te envíe esos datos, guárdalos con Guardardatoshuesped y pregúntale con amabilidad si desea realizar el pago por transferencia (Nequi, Daviplata o Bancolombia) o en efectivo. Si elige transferencia, usa Enviardatospago; si elige efectivo, ejecuta Solicitarpagoefectivo y no escribas texto adicional porque el sistema envía el mensaje oficial.\n` +
    `Nunca inventes precios ni disponibilidad, nunca confirmes reservas por tu cuenta y nunca reveles números personales internos.`;

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
    if (Pasollamada.name === 'Solicitarpagoefectivo' || Pasollamada.name === 'Solicitaradministrador') {
      Abriocanal = true;
    }
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

      const Remitente = String(Mensaje.from || '').replace(/\D/g, '');
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
      const Camposconv = { ultimomensajecliente: Formatearfechahora(new Date()) };
      if (Inactivo2h && Estadoconv.modo !== 'Canal' && Estadoconv.modo !== 'PendienteAdmin') { Camposconv.idinteraccionia = ''; }
      Actualizarconversacion(Remitente, Camposconv);

      // Si el cliente esta esperando al administrador o ya tiene canal abierto, la IA no responde
      if (Estadoconv.modo === 'Canal' || Estadoconv.modo === 'PendienteAdmin') {
        Procesarmensajeclienteencanal(Remitente, Mensaje);
        return ContentService.createTextOutput('OK');
      }

      if (Mensaje.type === 'text' && Mensaje.text) {
        const Respuestabot = Procesarmensajecongemini(Remitente, Mensaje.text.body);
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

    if (Cuerpo.accion === 'bienvenida') {
      return Respuestajsonservidor(Procesarcorreobienvenida(Cuerpo.token));
    }
    if (Cuerpo.accion === 'recuperarclave') {
      return Respuestajsonservidor(Procesarrecuperacionclave(Cuerpo.correo));
    }
    if (Cuerpo.accion === 'registrarreserva') {
      const Respuestaregistro = Registrarosincronizarreserva(Cuerpo.datos || {});
      return ContentService.createTextOutput(JSON.stringify(Respuestaregistro)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ exito: false, mensaje: 'Acción no reconocida' })).setMimeType(ContentService.MimeType.JSON);
  } catch (Errorpost) {
    Registrarbitacora('Webhook', 'ErrorDoPost', String(Errorpost));
    return ContentService.createTextOutput(JSON.stringify({ exito: false, mensaje: String(Errorpost) })).setMimeType(ContentService.MimeType.JSON);
  }
}
