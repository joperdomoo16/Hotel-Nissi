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
      description: 'Guarda el nombre completo, cédula de ciudadanía y hora estimada de llegada en la reserva apartada.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de reserva (ej. NS-4K9A)' },
          nombre: { type: 'string', description: 'Nombre completo del huésped' },
          cedula: { type: 'string', description: 'Número de cédula de ciudadanía' },
          horallegada: { type: 'string', description: 'Hora estimada de llegada (ej. 22:00)' }
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
      description: 'Abre el canal privado con el administrador cuando el cliente indica que desea pagar en efectivo.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de la reserva apartada' }
        }
      }
    },
    {
      type: 'function',
      name: 'Solicitaradministrador',
      description: 'Abre el canal privado con el administrador cuando el cliente pide hablar con una persona o tiene un caso especial.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de reserva si existe' },
          motivo: { type: 'string', description: 'Motivo de la solicitud' }
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
    return Guardardatoshuesped(Celularcliente, Argumentos.codigo, Argumentos.nombre, Argumentos.cedula, Argumentos.horallegada);
  }
  if (Nombre === 'Enviardatospago') {
    return Enviardatospago(Celularcliente, Argumentos.codigo);
  }
  if (Nombre === 'Registrarcomprobante') {
    return Registrarcomprobante(Celularcliente, Argumentos.codigo, Argumentos);
  }
  if (Nombre === 'Solicitarpagoefectivo') {
    return Solicitarpagoefectivo(Celularcliente, Argumentos.codigo);
  }
  if (Nombre === 'Solicitaradministrador') {
    return Solicitaradministrador(Celularcliente, Argumentos.codigo, Argumentos.motivo);
  }
  return { exito: false, mensaje: 'Herramienta no reconocida' };
}

function Procesarmensajecongemini(Celularcliente, Textomensaje) {
  const Credenciales = Obtenercredenciales();
  const Estadoconv = Obtenerestadoconversacion(Celularcliente);
  const Esprimermensaje = !Estadoconv.idinteraccionia;
  const Hoy = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');

  const Instruccionessistema =
    `Eres el asistente de recepción 24/7 de Hospedaje Nissi en Mingueo, municipio de Dibulla, La Guajira (Troncal del Caribe, entre Santa Marta y Riohacha). ` +
    `Hoy es ${Hoy}. Hablas en español colombiano, amable y breve. ` +
    (Esprimermensaje ? `En tu primer mensaje incluye un saludo cordial y una línea breve informando que sus datos personales se tratan conforme a la Ley 1581 de 2012 para gestionar su reserva. ` : '') +
    `Sigue estrictamente este orden de conversación: ` +
    `1) Pide las fechas de llegada y salida y el número de personas. ` +
    `2) Usa Consultardisponibilidad y muestra SOLO las habitaciones disponibles con su precio real de la hoja. ` +
    `3) Cuando el cliente elige una habitación, llámala de inmediato con Apartarhabitacion (le respondes por ejemplo: "Listo, te aparté la habitación XX (código NS-XXXX)."). ` +
    `4) Pide nombre completo, cédula de ciudadanía y hora estimada de llegada, y guárdalos con Guardardatoshuesped. ` +
    `5) Pregunta el medio de pago: si elige transferencia, usa Enviardatospago; si elige efectivo, llama a Solicitarpagoefectivo y no escribas nada adicional porque el sistema envía el mensaje oficial. ` +
    `Nunca inventes precios, descuentos ni disponibilidad, nunca confirmes reservas por tu cuenta y nunca menciones datos internos ni el número personal del administrador.`;

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
  const Respuestahttp = UrlFetchApp.fetch(Parametrosistema.urlgemini, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': Claveapi, 'Api-Revision': Parametrosistema.versionapi },
    payload: JSON.stringify(Cuerpopeticion)
  });
  return JSON.parse(Respuestahttp.getContentText());
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
        Procesarmensajeadministrador(Mensaje);
        return ContentService.createTextOutput('OK');
      }

      const Estadoconv = Obtenerestadoconversacion(Remitente);
      Actualizarconversacion(Remitente, { ultimomensajecliente: Formatearfechahora(new Date()) });

      // Si el cliente tiene un canal abierto con el administrador, la IA no responde
      if (Estadoconv.modo === 'Canal') {
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
