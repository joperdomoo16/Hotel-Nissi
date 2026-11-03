// Servidor en Google Apps Script para Hotel Nissi: Google Sheets, Gemini 3.8 Flash, WhatsApp y Correo Diario

const Parametrosistema = {
  modeloia: 'gemini-3.8-flash',
  urlgemini: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  versionapi: '2026-05-20',
  horacheckout: 12,
  horainformediario: 19
};

const Catalogoinicial = [
  ['01', 'Sencilla', '1 a 2 personas', 2, 90000, 'Disponible'],
  ['02', 'Sencilla', '1 a 2 personas', 2, 90000, 'Disponible'],
  ['03', 'Doble', '2 personas', 2, 120000, 'Disponible'],
  ['04', 'Doble', '2 personas', 2, 120000, 'Disponible'],
  ['05', 'Triple', '3 personas', 3, 150000, 'Disponible'],
  ['06', 'Familiar', '4 personas', 4, 180000, 'Disponible']
];

// Lee las claves guardadas en Propiedades del Script (Clave Gemini, Token WhatsApp, Celular y Correo Admin)
function Obtenercredenciales() {
  const Propiedades = PropertiesService.getScriptProperties().getProperties();
  return {
    clavegemini: Propiedades.CLAVEGEMINI || '',
    tokenwhatsapp: Propiedades.TOKENWHATSAPP || '',
    idtelefonowhatsapp: Propiedades.IDTELEFONOWHATSAPP || '',
    tokenverificacion: Propiedades.TOKENVERIFICACION || 'nissiverificacion',
    celularadmin: Propiedades.CELULARADMIN || '573001234567',
    correoadmin: Propiedades.CORREOADMIN || Session.getActiveUser().getEmail()
  };
}

// Crea las pestañas Habitaciones y Reservas si no existen y programa los relojes automaticos
function Inicializarhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();

  let Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojahabitaciones) {
    Hojahabitaciones = Libro.insertSheet('Habitaciones');
    Hojahabitaciones.appendRow([
      'Numero', 'Tipo', 'Capacidad', 'Huespedesmaximos', 'Tarifanoche', 'Estadoactual', 'Ultimaactualizacion'
    ]);
    const Fechahoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
    Catalogoinicial.forEach(function(Filahabitacion) {
      Hojahabitaciones.appendRow(Filahabitacion.concat([Fechahoy]));
    });
  }

  let Hojareservas = Libro.getSheetByName('Reservas');
  if (!Hojareservas) {
    Hojareservas = Libro.insertSheet('Reservas');
    Hojareservas.appendRow([
      'Codigo', 'Fecharegistro', 'Nombre', 'Celular', 'Habitacion',
      'Fechallegada', 'Fechasalida', 'Noches', 'Huespedes', 'Horallegada',
      'Montototal', 'Montopagado', 'Referenciapago', 'Entidadpago', 'Estado'
    ]);
  }

  Programarrelojesautomaticos();
}

// Configura el reloj cada hora (liberar habitaciones vencidas) y el reloj diario (enviar correo de informe)
function Programarrelojesautomaticos() {
  const Disparadoresactuales = ScriptApp.getProjectTriggers();
  Disparadoresactuales.forEach(function(Disparador) {
    ScriptApp.deleteTrigger(Disparador);
  });

  ScriptApp.newTrigger('Liberarhabitacionesvencidas')
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger('Enviarinformecorreodiario')
    .timeBased()
    .everyDays(1)
    .atHour(Parametrosistema.horainformediario)
    .create();
}

// Devuelve las habitaciones libres cruzando el estado actual y los rangos de fechas en Reservas
function Consultardisponibilidad(Fechallegada, Fechasalida, Cantidadhuespedes) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');

  const Filashabitaciones = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasreservas = Hojareservas.getDataRange().getValues().slice(1);

  const Llegadasolicitada = Fechallegada ? new Date(Fechallegada) : null;
  const Salidasolicitada = Fechasalida ? new Date(Fechasalida) : null;
  const Huespedesminimos = parseInt(Cantidadhuespedes || 1, 10);

  const Habitacionesocupadasenrango = {};

  if (Llegadasolicitada && Salidasolicitada) {
    Filasreservas.forEach(function(Filareserva) {
      const Numerohab = String(Filareserva[4]).padStart(2, '0');
      const Llegadaexistente = new Date(Filareserva[5]);
      const Salidaexistente = new Date(Filareserva[6]);
      const Estadoreserva = String(Filareserva[14]);

      if (Estadoreserva === 'Confirmada') {
        const Haycruce = Llegadasolicitada < Salidaexistente && Salidasolicitada > Llegadaexistente;
        if (Haycruce) {
          Habitacionesocupadasenrango[Numerohab] = true;
        }
      }
    });
  }

  const Listadodisponibles = [];
  const Listadogeneral = [];

  Filashabitaciones.forEach(function(Filahab) {
    const Numerohab = String(Filahab[0]).padStart(2, '0');
    const Tipohab = String(Filahab[1]);
    const Capacidadtexto = String(Filahab[2]);
    const Maxhuespedes = parseInt(Filahab[3], 10);
    const Tarifanoche = Number(Filahab[4]);
    const Estadopestana = String(Filahab[5]);

    const Ocupadahoy = !Llegadasolicitada && Estadopestana === 'Ocupada';
    const Ocupadafechas = Boolean(Habitacionesocupadasenrango[Numerohab]);
    const Disponible = !Ocupadahoy && !Ocupadafechas && Maxhuespedes >= Huespedesminimos;

    const Objetoestado = {
      numero: Numerohab,
      tipo: Tipohab,
      capacidad: Capacidadtexto,
      huespedesmaximos: Maxhuespedes,
      tarifanoche: Tarifanoche,
      estadoactual: Ocupadafechas ? 'Ocupada en esas fechas' : Estadopestana,
      disponible: Disponible
    };

    Listadogeneral.push(Objetoestado);
    if (Disponible) {
      Listadodisponibles.push(Objetoestado);
    }
  });

  return {
    fechallegada: Fechallegada || 'hoy',
    fechasalida: Fechasalida || 'por definir',
    disponibles: Listadodisponibles,
    todas: Listadogeneral
  };
}

// Registra una solicitud nueva o actualiza una existente en la pestaña Reservas
function Registrarosincronizarreserva(Datos) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');

  const Numerohab = String(Datos.habitacion || '01').padStart(2, '0');
  const Disponibilidad = Consultardisponibilidad(Datos.llegada, Datos.salida, Datos.huespedes);
  const Habitacionlibre = Disponibilidad.disponibles.find(function(Hab) {
    return Hab.numero === Numerohab;
  });

  if (!Habitacionlibre) {
    return {
      exito: false,
      mensaje: `La habitación ${Numerohab} no está disponible para las fechas indicadas.`
    };
  }

  const Milisegundosdia = 86400000;
  const Noches = Math.max(1, Math.round((new Date(Datos.salida) - new Date(Datos.llegada)) / Milisegundosdia));
  const Montototal = Noches * Habitacionlibre.tarifanoche;
  const Codigoreserva = Datos.codigo || `NS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const Fecharegistro = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
  const Estadoinicial = Datos.estado || 'Pendiente';

  const Filas = Hojareservas.getDataRange().getValues();
  let Filaencontrada = -1;
  for (let Indice = 1; Indice < Filas.length; Indice++) {
    if (String(Filas[Indice][0]).toUpperCase() === Codigoreserva.toUpperCase()) {
      Filaencontrada = Indice + 1;
      break;
    }
  }

  const Nuevafila = [
    Codigoreserva,
    Fecharegistro,
    Datos.nombre || 'Viajero',
    String(Datos.celular || ''),
    Numerohab,
    Datos.llegada,
    Datos.salida,
    Noches,
    Number(Datos.huespedes || 2),
    Datos.horallegada || 'Por confirmar',
    Montototal,
    Number(Datos.montopagado || 0),
    Datos.referenciapago || '',
    Datos.entidadpago || '',
    Estadoinicial
  ];

  if (Filaencontrada > 0) {
    Hojareservas.getRange(Filaencontrada, 1, 1, Nuevafila.length).setValues([Nuevafila]);
  } else {
    Hojareservas.appendRow(Nuevafila);
  }

  if (Estadoinicial === 'Confirmada') {
    Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, 'Ocupada');
  }

  return {
    exito: true,
    codigo: Codigoreserva,
    habitacion: Numerohab,
    noches: Noches,
    montototal: Montototal,
    estado: Estadoinicial
  };
}

// Cambia el estado de una habitacion en la pestaña Habitaciones (Disponible u Ocupada)
function Cambiarocupacionhabitacion(Hojahabitaciones, Numerohabitacion, Nuevoestado) {
  const Datos = Hojahabitaciones.getDataRange().getValues();
  const Ahora = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
  for (let Indice = 1; Indice < Datos.length; Indice++) {
    if (String(Datos[Indice][0]).padStart(2, '0') === String(Numerohabitacion).padStart(2, '0')) {
      Hojahabitaciones.getRange(Indice + 1, 6).setValue(Nuevoestado);
      Hojahabitaciones.getRange(Indice + 1, 7).setValue(Ahora);
      break;
    }
  }
}

// Valida un pago recibido, marca la habitacion como Ocupada y avisa por WhatsApp al administrador
function Confirmarpagoyocuparhabitacion(Codigoreserva, Montopagado, Referenciapago, Entidadpago) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Filas = Hojareservas.getDataRange().getValues();

  // Verificar que la referencia de pago no haya sido usada antes
  for (let Indice = 1; Indice < Filas.length; Indice++) {
    const Referenciaexistente = String(Filas[Indice][12] || '').trim();
    const Codigoexistente = String(Filas[Indice][0] || '').trim();
    if (Referenciaexistente && Referenciaexistente === String(Referenciapago).trim() && Codigoexistente !== Codigoreserva) {
      return {
        exito: false,
        mensaje: `El comprobante con referencia ${Referenciapago} ya fue registrado previamente en otra reserva.`
      };
    }
  }

  for (let Indice = 1; Indice < Filas.length; Indice++) {
    if (String(Filas[Indice][0]).toUpperCase() === String(Codigoreserva).toUpperCase()) {
      const Numerofila = Indice + 1;
      const Nombrehuesped = Filas[Indice][2];
      const Celularhuesped = Filas[Indice][3];
      const Numerohab = String(Filas[Indice][4]).padStart(2, '0');
      const Fechallegada = Utilities.formatDate(new Date(Filas[Indice][5]), 'America/Bogota', 'yyyy-MM-dd');
      const Fechasalida = Utilities.formatDate(new Date(Filas[Indice][6]), 'America/Bogota', 'yyyy-MM-dd');
      const Horallegada = Filas[Indice][9];
      const Montoesperado = Number(Filas[Indice][10]);
      const Montorecibido = Number(Montopagado);

      if (Montorecibido < Montoesperado * 0.5) {
        return {
          exito: false,
          mensaje: `El monto del comprobante ($${Montorecibido} COP) es menor al mínimo requerido ($${Montoesperado * 0.5} COP).`
        };
      }

      Hojareservas.getRange(Numerofila, 12).setValue(Montorecibido);
      Hojareservas.getRange(Numerofila, 13).setValue(Referenciapago);
      Hojareservas.getRange(Numerofila, 14).setValue(Entidadpago || 'Transferencia');
      Hojareservas.getRange(Numerofila, 15).setValue('Confirmada');

      Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, 'Ocupada');

      const Resumenadmin =
        `Nueva reserva confirmada en Hotel Nissi\n` +
        `Código: ${Codigoreserva}\n` +
        `Habitación: ${Numerohab} (marcada como Ocupada)\n` +
        `Huésped: ${Nombrehuesped} (+${Celularhuesped})\n` +
        `Estadía: ${Fechallegada} al ${Fechasalida}\n` +
        `Llegada estimada: ${Horallegada}\n` +
        `Pago validado: $${Montorecibido.toLocaleString('es-CO')} COP (${Entidadpago || 'Transferencia'} · Ref: ${Referenciapago})`;

      Notificaradministradorwhatsapp(Resumenadmin);

      return {
        exito: true,
        codigo: Codigoreserva,
        habitacion: Numerohab,
        estado: 'Confirmada',
        mensaje: 'Pago validado, habitación marcada como Ocupada y administrador notificado por WhatsApp.'
      };
    }
  }

  return {
    exito: false,
    mensaje: `No se encontró ninguna solicitud con el código ${Codigoreserva}.`
  };
}

// Reloj automatico cada hora: libera habitaciones cuyo tiempo de reserva ya termino
function Liberarhabitacionesvencidas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojareservas || !Hojahabitaciones) {
    return;
  }

  const Ahora = new Date();
  const Hoytexto = Utilities.formatDate(Ahora, 'America/Bogota', 'yyyy-MM-dd');
  const Horaactual = parseInt(Utilities.formatDate(Ahora, 'America/Bogota', 'HH'), 10);

  const Filas = Hojareservas.getDataRange().getValues();
  const Habitacionesactivas = {};

  for (let Indice = 1; Indice < Filas.length; Indice++) {
    const Estado = String(Filas[Indice][14]);
    const Numerohab = String(Filas[Indice][4]).padStart(2, '0');
    const Fechallegada = Utilities.formatDate(new Date(Filas[Indice][5]), 'America/Bogota', 'yyyy-MM-dd');
    const Fechasalida = Utilities.formatDate(new Date(Filas[Indice][6]), 'America/Bogota', 'yyyy-MM-dd');

    if (Estado === 'Confirmada') {
      const Venciofecha = Fechasalida < Hoytexto || (Fechasalida === Hoytexto && Horaactual >= Parametrosistema.horacheckout);
      if (Venciofecha) {
        Hojareservas.getRange(Indice + 1, 15).setValue('Finalizada');
      } else if (Fechallegada <= Hoytexto && Fechasalida >= Hoytexto) {
        Habitacionesactivas[Numerohab] = true;
      }
    }
  }

  const Filashab = Hojahabitaciones.getDataRange().getValues();
  for (let Indice = 1; Indice < Filashab.length; Indice++) {
    const Numerohab = String(Filashab[Indice][0]).padStart(2, '0');
    const Nuevoestado = Habitacionesactivas[Numerohab] ? 'Ocupada' : 'Disponible';
    if (String(Filashab[Indice][5]) !== Nuevoestado) {
      Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, Nuevoestado);
    }
  }
}

// Reloj automatico diario: envia informe completo al correo del administrador
function Enviarinformecorreodiario() {
  Liberarhabitacionesvencidas();

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
        `<td style="padding:8px;border:1px solid #ddd">${Fila[0]}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">Hab. ${String(Fila[4]).padStart(2, '0')}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">${Fila[2]}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">${Fila[3]}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">${Fila[9]}</td>` +
        `<td style="padding:8px;border:1px solid #ddd">$${Montopagado.toLocaleString('es-CO')} COP (${Fila[12]})</td>` +
        `</tr>`;
    }
  });

  let Filasestadohab = '';
  Filashab.forEach(function(Hab) {
    const Color = String(Hab[5]) === 'Ocupada' ? '#8C3B1F' : '#2FB45A';
    Filasestadohab +=
      `<tr>` +
      `<td style="padding:8px;border:1px solid #ddd">Habitación ${String(Hab[0]).padStart(2, '0')}</td>` +
      `<td style="padding:8px;border:1px solid #ddd">${Hab[1]} (${Hab[2]})</td>` +
      `<td style="padding:8px;border:1px solid #ddd;color:${Color};font-weight:bold">${Hab[5]}</td>` +
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

