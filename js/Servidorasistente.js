// Servidor Asistente IA, WhatsApp Cloud API, Vision Comprobantes y Correo Diario para Hotel Nissi

// Reloj automatico diario: envia informe completo al correo del administrador
function Enviarinformecorreodiario() {
  if (typeof Liberarhabitacionesvencidas === 'function') {
    Liberarhabitacionesvencidas();
  }

  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin) {
    return;
  }

  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');

  const Hoytexto = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  const Filashab = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasres = Hojareservas.getDataRange().getValues().slice(1);

  let Recaudodia = 0;
  let Confirmadasdia = 0;
  let Filasllegadashoy = '';

  Filasres.forEach(function(Fila) {
    const Fechareg = String(Fila[1]).slice(0, 10);
    const Fechallegada = Utilities.formatDate(new Date(Fila[5]), 'America/Bogota', 'yyyy-MM-dd');
    const Estado = String(Fila[14]);
    const Montopagado = Number(Fila[11] || 0);

    if (Fechareg === Hoytexto && Estado === 'Confirmada') {
      Recaudodia += Montopagado;
      Confirmadasdia++;
    }

    if (Fechallegada === Hoytexto && Estado === 'Confirmada') {
      Filasllegadashoy +=
        `<tr>` +
        `<td style="padding:8px;border:1px solid #ddd">${Escaparhtmlservidor(Fila[0])}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">Hab. ${Escaparhtmlservidor(String(Fila[4]).padStart(2, '0'))}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">${Escaparhtmlservidor(Fila[2])}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">${Escaparhtmlservidor(Fila[3])}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">${Escaparhtmlservidor(Fila[9])}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">$${Montopagado.toLocaleString('es-CO')} COP (${Escaparhtmlservidor(Fila[12])})</td>` +
        `</tr>`;
    }
  });

  let Filasestadohab = '';
  Filashab.forEach(function(Hab) {
    const Color = String(Hab[5]) === 'Ocupada' ? '#8C3B1F' : '#2FB45A';
    Filasestadohab +=
      `<tr>` +
      `<td style="padding:8px;border:1px solid #ddd">Habitación ${Escaparhtmlservidor(String(Hab[0]).padStart(2, '0'))}</td>` +
      `<td style="padding:8px;border:1px solid #ddd">${Escaparhtmlservidor(Hab[1])} (${Escaparhtmlservidor(Hab[2])})</td>` +
      `<td style="padding:8px;border:1px solid #ddd;color:${Color};font-weight:bold">${Escaparhtmlservidor(Hab[5])}</td>` +
      `</tr>`;
  });

  const Cuerpohtml =
    `<div style="font-family:sans-serif;color:#1A1C13;max-width:680px">` +
    `<h2>Informe Diario · Hotel Nissi (${Hoytexto})</h2>` +
    `<p><strong>Reservas confirmadas hoy:</strong> ${Confirmadasdia} · ` +
    `<strong>Recaudo validado hoy:</strong> $${Recaudodia.toLocaleString('es-CO')} COP</p>` +
    `<h3>Estado actual de las 6 habitaciones</h3>` +
    `<table style="border-collapse:collapse;width:100%">` +
    `<tr style="background:#F2EADB"><th style="padding:8px;border:1px solid #ddd;text-align:left">Habitación</th><th style="padding:8px;border:1px solid #ddd;text-align:left">Tipo</th><th style="padding:8px;border:1px solid #ddd;text-align:left">Estado</th></tr>` +
    `${Filasestadohab}</table>` +
    `<h3>Huéspedes que llegan hoy (${Hoytexto})</h3>` +
    (Filasllegadashoy
      ? `<table style="border-collapse:collapse;width:100%"><tr style="background:#F2EADB"><th style="padding:8px;border:1px solid #ddd">Código</th><th style="padding:8px;border:1px solid #ddd">Hab.</th><th style="padding:8px;border:1px solid #ddd">Huésped</th><th style="padding:8px;border:1px solid #ddd">Celular</th><th style="padding:8px;border:1px solid #ddd">Hora llegada</th><th style="padding:8px;border:1px solid #ddd">Pago</th></tr>${Filasllegadashoy}</table>`
      : `<p>No hay llegadas programadas para hoy.</p>`) +
    `</div>`;

  MailApp.sendEmail({
    to: Credenciales.correoadmin,
    subject: `Informe Diario Hotel Nissi · ${Hoytexto}`,
    htmlBody: Cuerpohtml
  });
}

// Descarga la imagen del comprobante desde WhatsApp y extrae los datos con Gemini 3.8 Flash
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
        text: 'Analiza esta captura de pantalla de un comprobante de pago en Colombia (Nequi, Bancolombia, Daviplata o transferencia bancaria). Extrae exactamente en formato JSON sin bloques markdown: {"escomprobante": true/false, "monto": numero en pesos sin puntos, "referencia": "numero de comprobante o referencia", "entidad": "Nequi/Bancolombia/Daviplata/Otro", "fecha": "YYYY-MM-DD"}.'
      },
      {
        type: 'image',
        data: Bytesbase,
        mime_type: Tipomime
      }
    ]
  };

  const Respuestagemini = UrlFetchApp.fetch(Parametrosistema.urlgemini, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': Credenciales.clavegemini,
      'Api-Revision': Parametrosistema.versionapi
    },
    payload: JSON.stringify(Solicitudgemini)
  });

  const Datosinteraccion = JSON.parse(Respuestagemini.getContentText());
  const Textosalida = Extraertextointeraccion(Datosinteraccion);
  try {
    const Jsonlimpio = Textosalida.replace(/```json|```/g, '').trim();
    return JSON.parse(Jsonlimpio);
  } catch (Errorjson) {
    return { escomprobante: false, detalle: Textosalida };
  }
}

// Extrae el texto final del arreglo steps de la API de Interactions de Gemini
function Extraertextointeraccion(Datosinteraccion) {
  if (!Datosinteraccion || !Datosinteraccion.steps) {
    return '';
  }
  const Textos = [];
  Datosinteraccion.steps.forEach(function(Paso) {
    if (Paso.type === 'model_output' && Array.isArray(Paso.content)) {
      Paso.content.forEach(function(Bloque) {
        if (Bloque.type === 'text' && Bloque.text) {
          Textos.push(Bloque.text);
        }
      });
    }
  });
  return Textos.join('\n').trim();
}

// Atiende el mensaje del cliente con Gemini 3.8 Flash y ejecuta herramientas sobre Google Sheets
function Procesarmensajecongemini(Celularcliente, Textomensaje) {
  const Credenciales = Obtenercredenciales();
  const Propiedades = PropertiesService.getScriptProperties();
  const Claveinteraccion = `INTERACCION_${Celularcliente}`;
  const Idanterior = Propiedades.getProperty(Claveinteraccion);

  const Hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  const Instruccionessistema =
    `Eres el asistente de recepción 24/7 de Hotel Nissi en Mingueo, municipio de Dibulla, La Guajira (Troncal del Caribe, entre Santa Marta y Riohacha). ` +
    `Hoy es ${Hoy}. Hablas en español colombiano amable, breve y claro. ` +
    `Usa siempre las herramientas para consultar qué habitaciones están disponibles en Google Sheets, registrar solicitudes y validar pagos cuando el huésped envíe un comprobante. ` +
    `Precios por noche en pesos colombianos: Sencilla (01 y 02) $90.000 COP, Doble (03 y 04) $120.000 COP, Triple (05) $150.000 COP, Familiar (06) $180.000 COP.`;

  const Herramientas = [
    {
      type: 'function',
      name: 'Consultardisponibilidad',
      description: 'Consulta en Google Sheets qué habitaciones están disponibles para las fechas y cantidad de huéspedes.',
      parameters: {
        type: 'object',
        properties: {
          fechallegada: { type: 'string', description: 'Fecha de llegada en formato YYYY-MM-DD' },
          fechasalida: { type: 'string', description: 'Fecha de salida en formato YYYY-MM-DD' },
          cantidadhuespedes: { type: 'integer', description: 'Número de personas (1 a 4)' }
        },
        required: ['fechallegada', 'fechasalida']
      }
    },
    {
      type: 'function',
      name: 'Registrarosincronizarreserva',
      description: 'Crea una solicitud de reserva en Google Sheets en estado Pendiente mientras el cliente envía el comprobante de pago.',
      parameters: {
        type: 'object',
        properties: {
          codigo: { type: 'string', description: 'Código de reserva si ya tiene uno (ej. NS-4K9A)' },
          nombre: { type: 'string', description: 'Nombre completo del huésped' },
          habitacion: { type: 'string', description: 'Número de habitación de 01 a 06' },
          llegada: { type: 'string', description: 'Fecha de llegada YYYY-MM-DD' },
          salida: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
          huespedes: { type: 'integer', description: 'Cantidad de huéspedes' },
          horallegada: { type: 'string', description: 'Hora estimada de llegada' }
        },
        required: ['nombre', 'habitacion', 'llegada', 'salida']
      }
    },
    {
      type: 'function',
      name: 'Confirmarpagoyocuparhabitacion',
      description: 'Confirma el pago de una reserva tras verificar la captura del comprobante, marca la habitación como Ocupada y avisa al administrador.',
      parameters: {
        type: 'object',
        properties: {
          codigoreserva: { type: 'string', description: 'Código de la reserva (ej. NS-4K9A)' },
          montopagado: { type: 'number', description: 'Monto en pesos colombianos leído del comprobante' },
          referenciapago: { type: 'string', description: 'Número de referencia único del comprobante' },
          entidadpago: { type: 'string', description: 'Entidad bancaria o billetera (Nequi, Bancolombia, Daviplata)' }
        },
        required: ['codigoreserva', 'montopagado', 'referenciapago']
      }
    }
  ];

  const Cuerpopeticion = {
    model: Parametrosistema.modeloia,
    system_instruction: Instruccionessistema,
    input: Textomensaje,
    tools: Herramientas
  };

  if (Idanterior) {
    Cuerpopeticion.previous_interaction_id = Idanterior;
  }

  let Respuesta = Llamarapigemini(Credenciales.clavegemini, Cuerpopeticion);

  // Si Gemini solicita ejecutar una herramienta sobre Google Sheets
  if (Respuesta && Array.isArray(Respuesta.steps)) {
    const Pasollamada = Respuesta.steps.find(function(Paso) {
      return Paso.type === 'function_call';
    });

    if (Pasollamada) {
      const Argumentos = Pasollamada.arguments || {};
      let Resultadolocal = {};

      if (Pasollamada.name === 'Consultardisponibilidad') {
        Resultadolocal = Consultardisponibilidad(Argumentos.fechallegada, Argumentos.fechasalida, Argumentos.cantidadhuespedes);
      } else if (Pasollamada.name === 'Registrarosincronizarreserva') {
        Argumentos.celular = Celularcliente;
        Resultadolocal = Registrarosincronizarreserva(Argumentos);
      } else if (Pasollamada.name === 'Confirmarpagoyocuparhabitacion') {
        Resultadolocal = Confirmarpagoyocuparhabitacion(
          Argumentos.codigoreserva,
          Argumentos.montopagado,
          Argumentos.referenciapago,
          Argumentos.entidadpago
        );
      }

      Respuesta = Llamarapigemini(Credenciales.clavegemini, {
        model: Parametrosistema.modeloia,
        system_instruction: Instruccionessistema,
        previous_interaction_id: Respuesta.id,
        tools: Herramientas,
        input: [
          {
            type: 'function_result',
            name: Pasollamada.name,
            call_id: Pasollamada.id,
            result: [{ type: 'text', text: JSON.stringify(Resultadolocal) }]
          }
        ]
      });
    }
  }

  if (Respuesta && Respuesta.id) {
    Propiedades.setProperty(Claveinteraccion, Respuesta.id);
  }

  return Extraertextointeraccion(Respuesta) || 'Permíteme un momento mientras verifico en recepción.';
}

function Llamarapigemini(Claveapi, Cuerpopeticion) {
  const Respuestahttp = UrlFetchApp.fetch(Parametrosistema.urlgemini, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-goog-api-key': Claveapi,
      'Api-Revision': Parametrosistema.versionapi
    },
    payload: JSON.stringify(Cuerpopeticion)
  });
  return JSON.parse(Respuestahttp.getContentText());
}

// Envia un mensaje de WhatsApp a cualquier numero (huesped o administrador)
function Enviarmensajewhatsapp(Numerodestino, Textomensaje) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.tokenwhatsapp || !Credenciales.idtelefonowhatsapp) {
    return;
  }
  const Urlmeta = `https://graph.facebook.com/v21.0/${Credenciales.idtelefonowhatsapp}/messages`;
  UrlFetchApp.fetch(Urlmeta, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` },
    payload: JSON.stringify({
      messaging_product: 'whatsapp',
      to: String(Numerodestino).replace(/\D/g, ''),
      type: 'text',
      text: { body: Textomensaje }
    })
  });
}

function Notificaradministradorwhatsapp(Textoresumen) {
  const Credenciales = Obtenercredenciales();
  if (Credenciales.celularadmin) {
    Enviarmensajewhatsapp(Credenciales.celularadmin, Textoresumen);
  }
}

// Punto de entrada GET: verificacion del Webhook de Meta y consulta de disponibilidad desde la web
function doGet(Eventopeticion) {
  const Parametros = (Eventopeticion && Eventopeticion.parameter) || {};

  // Verificacion oficial del Webhook de WhatsApp (Meta)
  if (Parametros['hub.mode'] === 'subscribe') {
    const Credenciales = Obtenercredenciales();
    if (Parametros['hub.verify_token'] === Credenciales.tokenverificacion) {
      return ContentService.createTextOutput(Parametros['hub.challenge']);
    }
    return ContentService.createTextOutput('Token invalido');
  }

  // Consulta de disponibilidad en vivo desde la pagina web
  const Resultado = Consultardisponibilidad(Parametros.llegada, Parametros.salida, Parametros.huespedes);
  return ContentService
    .createTextOutput(JSON.stringify(Resultado))
    .setMimeType(ContentService.MimeType.JSON);
}

// Punto de entrada POST: recibe mensajes e imagenes de WhatsApp o solicitudes desde la pagina web
function doPost(Eventopeticion) {
  try {
    const Cuerpo = JSON.parse(Eventopeticion.postData.contents || '{}');

    // Si proviene del Webhook de WhatsApp Cloud API
    if (Cuerpo.object === 'whatsapp_business_account') {
      const Entrada = Cuerpo.entry && Cuerpo.entry[0];
      const Cambios = Entrada && Entrada.changes && Entrada.changes[0];
      const Valor = Cambios && Cambios.value;
      const Mensaje = Valor && Valor.messages && Valor.messages[0];

      if (Mensaje) {
        const Celularremitente = Mensaje.from;
        let Textoparaia = '';

        if (Mensaje.type === 'text' && Mensaje.text) {
          Textoparaia = Mensaje.text.body;
        } else if (Mensaje.type === 'image' && Mensaje.image) {
          const Datosrecibo = Analizarcomprobanteimagen(Mensaje.image.id);
          Textoparaia = `El cliente envió una imagen de comprobante de pago. Resultado de lectura visual: ${JSON.stringify(Datosrecibo)}. Si los datos están completos y corresponden a su reserva, confirma el pago con la herramienta Confirmarpagoyocuparhabitacion.`;
        }

        if (Textoparaia) {
          const Respuestabot = Procesarmensajecongemini(Celularremitente, Textoparaia);
          Enviarmensajewhatsapp(Celularremitente, Respuestabot);
        }
      }

      return ContentService.createTextOutput('OK');
    }

    // Si proviene del formulario de reserva de la pagina web
    if (Cuerpo.accion === 'registrarreserva') {
      const Respuestaregistro = Registrarosincronizarreserva(Cuerpo.datos || {});
      return ContentService
        .createTextOutput(JSON.stringify(Respuestaregistro))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ exito: false, mensaje: 'Acción no reconocida' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (Errorpost) {
    return ContentService
      .createTextOutput(JSON.stringify({ exito: false, mensaje: String(Errorpost) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

