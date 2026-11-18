// Canal de comunicacion entre cliente y administrador por WhatsApp

function Obtenerestadoconversacion(Celular) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hoja = Libro.getSheetByName('Conversaciones');
  const Celularlimpio = String(Celular || '').replace(/\D/g, '');
  if (!Hoja || !Celularlimpio || Hoja.getLastRow() < 2) {
    return { fila: -1, celular: Celularlimpio, modo: 'IA', codigoreserva: '', ultimomensajecliente: '' };
  }
  const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 10).getValues();
  for (let I = 0; I < Filas.length; I++) {
    if (String(Filas[I][0]).replace(/\D/g, '') === Celularlimpio) {
      return {
        fila: I + 2, celular: Celularlimpio, nombre: String(Filas[I][1] || ''), modo: String(Filas[I][2] || 'IA'),
        codigoreserva: String(Filas[I][3] || ''), ultimomensajecliente: Filas[I][4], ultimomensajeadmin: Filas[I][5],
        aperturacanal: Filas[I][6], avisodemoracanal: String(Filas[I][7] || ''), ultimorecordatorioadmin: Filas[I][8],
        idinteraccionia: String(Filas[I][9] || '')
      };
    }
  }
  return { fila: -1, celular: Celularlimpio, modo: 'IA', codigoreserva: '', ultimomensajecliente: '' };
}

function Actualizarconversacion(Celular, Campos) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  let Hoja = Libro.getSheetByName('Conversaciones');
  if (!Hoja) {
    Hoja = Libro.insertSheet('Conversaciones');
    Hoja.appendRow([
      'Celular', 'Nombre', 'Modo', 'Codigoreserva', 'Ultimomensajecliente',
      'Ultimomensajeadmin', 'Aperturacanal', 'Avisodemoracanal', 'Ultimorecordatorioadmin', 'Idinteraccionia'
    ]);
  }
  const Actual = Obtenerestadoconversacion(Celular);
  const Nueva = [
    Actual.celular,
    Campos.nombre !== undefined ? Sanitizarcelda(Campos.nombre, 60) : (Actual.nombre || ''),
    Campos.modo !== undefined ? Campos.modo : (Actual.modo || 'IA'),
    Campos.codigoreserva !== undefined ? Campos.codigoreserva : (Actual.codigoreserva || ''),
    Campos.ultimomensajecliente !== undefined ? Campos.ultimomensajecliente : (Actual.ultimomensajecliente || ''),
    Campos.ultimomensajeadmin !== undefined ? Campos.ultimomensajeadmin : (Actual.ultimomensajeadmin || ''),
    Campos.aperturacanal !== undefined ? Campos.aperturacanal : (Actual.aperturacanal || ''),
    Campos.avisodemoracanal !== undefined ? Campos.avisodemoracanal : (Actual.avisodemoracanal || ''),
    Campos.ultimorecordatorioadmin !== undefined ? Campos.ultimorecordatorioadmin : (Actual.ultimorecordatorioadmin || ''),
    Campos.idinteraccionia !== undefined ? Campos.idinteraccionia : (Actual.idinteraccionia || '')
  ];
  if (Actual.fila > 0) { Hoja.getRange(Actual.fila, 1, 1, Nueva.length).setValues([Nueva]); }
  else { Hoja.appendRow(Nueva); }
}

// Verifica si el destinatario escribio en las ultimas 24 horas
function Dentroventana24horas(Celular) {
  const Estado = Obtenerestadoconversacion(Celular);
  if (!Estado.ultimomensajecliente) { return false; }
  const Hace = Date.now() - new Date(Estado.ultimomensajecliente).getTime();
  return !isNaN(Hace) && Hace < 24 * 3600000;
}

function Peticionwhatsapp(Cuerpopayload, Moduloerror) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.tokenwhatsapp || !Credenciales.idtelefonowhatsapp) {
    Registrarbitacora('WhatsApp', 'CredencialesFaltantes', 'Falta TOKENWHATSAPP o IDTELEFONOWHATSAPP');
    return '';
  }
  const Respuesta = UrlFetchApp.fetch(`https://graph.facebook.com/v21.0/${Credenciales.idtelefonowhatsapp}/messages`, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` },
    payload: JSON.stringify(Cuerpopayload)
  });
  try {
    const Texto = Respuesta.getContentText();
    if (Respuesta.getResponseCode() >= 300) { Registrarbitacora(Moduloerror || 'WhatsApp', `ErrorHTTP_${Respuesta.getResponseCode()}`, Texto); }
    const Datos = JSON.parse(Texto);
    return (Datos.messages && Datos.messages[0] && Datos.messages[0].id) || '';
  } catch (E) { return ''; }
}

function Enviarmensajewhatsapp(Numerodestino, Textomensaje) {
  return Peticionwhatsapp({
    messaging_product: 'whatsapp', to: String(Numerodestino).replace(/\D/g, ''),
    type: 'text', text: { body: String(Textomensaje || '') }
  }, 'WhatsApp');
}

function Enviarplantillawhatsapp(Numerodestino, Nombreplantilla, Parametrostexto) {
  const Parametros = (Parametrostexto || []).map(function(Valor) { return { type: 'text', text: String(Valor == null ? '-' : Valor) }; });
  return Peticionwhatsapp({
    messaging_product: 'whatsapp', to: String(Numerodestino).replace(/\D/g, ''), type: 'template',
    template: { name: Nombreplantilla, language: { code: 'es' }, components: Parametros.length ? [{ type: 'body', parameters: Parametros }] : [] }
  }, 'WhatsAppPlantilla');
}

// Intenta texto libre primero y si falla usa plantilla o alerta por correo como respaldo
function Enviarmensajeinteligente(Numerodestino, Textolibre, Nombreplantilla, Parametrosplantilla) {
  const Idlibre = Enviarmensajewhatsapp(Numerodestino, Textolibre);
  if (Idlibre) { return Idlibre; }
  if (Nombreplantilla) {
    const Idplantilla = Enviarplantillawhatsapp(Numerodestino, Nombreplantilla, Parametrosplantilla);
    if (Idplantilla) { return Idplantilla; }
  }
  try {
    const Credenciales = Obtenercredenciales();
    if (Credenciales.correoadmin && String(Numerodestino).replace(/\D/g, '') === Credenciales.celularadmin) {
      MailApp.sendEmail({ to: Credenciales.correoadmin, subject: 'Hospedaje Nissi · Atención requerida en WhatsApp', body: Textolibre });
    }
  } catch (E) {}
  return '';
}

function Reenviarmediawhatsapp(Numerodestino, Tipomedia, Idmedia, Leyenda) {
  const Objetomedia = { id: Idmedia };
  if (Leyenda && (Tipomedia === 'image' || Tipomedia === 'document')) { Objetomedia.caption = Leyenda; }
  const Cuerpo = { messaging_product: 'whatsapp', to: String(Numerodestino).replace(/\D/g, ''), type: Tipomedia };
  Cuerpo[Tipomedia] = Objetomedia;
  return Peticionwhatsapp(Cuerpo, 'WhatsAppMedia');
}

function Guardarmapeomensajecanal(Idmensajemeta, Celularcliente, Codigoreserva, Direccion) {
  if (!Idmensajemeta) { return; }
  const Hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mensajescanal');
  if (Hoja) { Hoja.appendRow([Idmensajemeta, String(Celularcliente).replace(/\D/g, ''), Codigoreserva || '', Direccion || 'cliente->admin', Formatearfechahora(new Date())]); }
}

// Envia el resumen de la reserva confirmada al WhatsApp del administrador
function Notificaradministradorwhatsapp(Textoresumen, Parametrosplantilla) {
  const Credenciales = Obtenercredenciales();
  if (Credenciales.celularadmin) {
    Enviarmensajeinteligente(Credenciales.celularadmin, Textoresumen, 'reserva_confirmada_admin', Parametrosplantilla || []);
  }
}

// Solicita conexion privada con el administrador y espera confirmacion SI
function Abrircanaladministrador(Celularcliente, Codigoreserva, Motivo, Detalleextra, Resumenchat) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');
  const Ahoratexto = Formatearfechahora(new Date());
  const Convprevia = Obtenerestadoconversacion(Celularlimpio);

  let Filareserva = null;
  let Indicefila = -1;
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincidecod = Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase();
    const Coincidecel = Celularlimpio && String(Filas[I][3]).replace(/\D/g, '') === Celularlimpio;
    const Est = String(Filas[I][14]);
    if ((Coincidecod || Coincidecel) && (Est === 'Apartada' || Est === 'Verificando' || Est === 'En canal')) {
      Filareserva = Filas[I]; Indicefila = I + 1; break;
    }
  }

  const Codigo = Filareserva ? String(Filareserva[0]) : (Codigoreserva || 'SIN-CODIGO');
  const Nombreres = Filareserva ? String(Filareserva[2]) : '';
  const Nombre = (Nombreres && Nombreres !== 'Por confirmar') ? Nombreres : (Convprevia.nombre || 'Cliente');
  const Hab = Filareserva ? String(Filareserva[4]).padStart(2, '0') : '--';
  const Llegada = Filareserva ? String(Filareserva[5]).slice(0, 10) : 'Por definir';
  const Personas = Filareserva ? Number(Filas[Indicefila - 1][8] || 2) : 2;
  const Hora = Filareserva ? String(Filareserva[9] || 'Por confirmar') : 'Por confirmar';
  const Total = Filareserva ? Number(Filareserva[10] || 0) : 0;
  const Obsantes = Filareserva ? String(Filareserva[22] || '').trim() : '';

  if (Indicefila > 0) {
    Hojareservas.getRange(Indicefila, 15).setValue('En canal');
    if (Motivo === 'efectivo') { Hojareservas.getRange(Indicefila, 18).setValue('Efectivo'); }
    const Obscanal = Obsantes ? `${Obsantes} · En canal (${Motivo})` : `En canal (${Motivo})`;
    Hojareservas.getRange(Indicefila, 23).setValue(Sanitizarcelda(Obscanal, 120));
  }

  // Paso 1: Avisa al cliente que se esta buscando al administrador
  if (Motivo === 'efectivo') {
    Enviarmensajewhatsapp(Celularlimpio, 'Debido a que es pago en efectivo, te voy a comunicar con un administrador. Por favor permanece en línea en el chat mientras se conecta contigo.');
  } else if (Motivo === 'tiempo_correo') {
    Enviarmensajewhatsapp(Celularlimpio, 'Un administrador revisará tu comprobante en breve y se conectará por este medio. Por favor permanece en línea en el chat.');
  } else {
    Enviarmensajewhatsapp(Celularlimpio, 'Perfecto, ya te comunico con el administrador, por favor espera en el chat.');
  }

  Actualizarconversacion(Celularlimpio, {
    nombre: Nombre, modo: 'PendienteAdmin', codigoreserva: Codigo,
    aperturacanal: Ahoratexto, avisodemoracanal: '', ultimorecordatorioadmin: Ahoratexto
  });

  // Paso 2: Envia resumen al administrador y pregunta si desea iniciar atencion con SI
  const Titulomotivo = Motivo === 'efectivo' ? '💵 Pago en efectivo' : `🔔 Atención requerida (${Detalleextra || Motivo})`;
  const Lineadetalle = Obsantes ? `\nDetalles: ${Obsantes}` : '';
  const Linearesumen = Resumenchat ? `\nResumen del chat: ${Resumenchat}` : '';
  const Tarjetaadmin =
    `${Titulomotivo} · ${Codigo}\nCliente: ${Nombre}\nHabitación: ${Hab} · Personas: ${Personas}\n` +
    `Llegada: ${Llegada} · ${Hora}${Lineadetalle}${Linearesumen}\nMonto a pagar: $${Total.toLocaleString('es-CO')} COP\n\n` +
    `¿Comenzar atención con el cliente "${Nombre}"?\nResponde: SI`;

  const Idmsg = Enviarmensajeinteligente(
    Credenciales.celularadmin, Tarjetaadmin, 'canal_efectivo_admin',
    [Codigo, Nombre, Hab, Personas, `${Llegada} ${Hora}`, Total.toLocaleString('es-CO')]
  );
  Guardarmapeomensajecanal(Idmsg, Celularlimpio, Codigo, 'sistema->admin');
  Registrarbitacora('Canal', 'Solicitaradmin', `Solicitud enviada para ${Codigo} (${Motivo})`);

  return { exito: true, codigo: Codigo, modo: 'PendienteAdmin', mensaje: 'Solicitud enviada al administrador.' };
}

function Solicitarpagoefectivo(Celularcliente, Codigoreserva, Resumenchat) {
  return Abrircanaladministrador(Celularcliente, Codigoreserva, 'efectivo', 'Pago en efectivo', Resumenchat);
}

function Solicitaradministrador(Celularcliente, Codigoreserva, Motivo, Resumenchat) {
  return Abrircanaladministrador(Celularcliente, Codigoreserva, 'persona', Motivo || 'Solicitud de hablar con una persona', Resumenchat);
}

// Reenvia mensajes del cliente cuando el canal esta activo o avisa si aun espera al admin
function Procesarmensajeclienteencanal(Celularcliente, Mensaje) {
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');
  const Estadoconv = Obtenerestadoconversacion(Celularlimpio);
  Actualizarconversacion(Celularlimpio, { ultimomensajecliente: Formatearfechahora(new Date()) });

  if (Estadoconv.modo === 'PendienteAdmin') {
    Enviarmensajewhatsapp(Celularlimpio, 'Estamos buscando a un administrador disponible para atenderte, por favor permanece en línea en el chat.');
    if (Mensaje.type === 'text' && Mensaje.text) {
      const Idmsg = Enviarmensajewhatsapp(Credenciales.celularadmin, `⏳ ${Estadoconv.nombre || 'Cliente'} (${Estadoconv.codigoreserva || 'Espera'}) escribió: "${Mensaje.text.body}"\nResponde SI para iniciar la atención.`);
      Guardarmapeomensajecanal(Idmsg, Celularlimpio, Estadoconv.codigoreserva, 'cliente->admin');
    }
    return;
  }

  const Etiqueta = `👤 ${Estadoconv.nombre || 'Cliente'} (${Estadoconv.codigoreserva || 'Canal'}):`;
  PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celularlimpio);
  let Idreenviado = '';
  if (Mensaje.type === 'text' && Mensaje.text) {
    Idreenviado = Enviarmensajewhatsapp(Credenciales.celularadmin, `${Etiqueta} ${Mensaje.text.body}`);
  } else if (Mensaje.type === 'image' && Mensaje.image) {
    Idreenviado = Reenviarmediawhatsapp(Credenciales.celularadmin, 'image', Mensaje.image.id, `${Etiqueta} [Imagen]`);
  } else if ((Mensaje.type === 'audio' || Mensaje.type === 'voice') && (Mensaje.audio || Mensaje.voice)) {
    Enviarmensajewhatsapp(Credenciales.celularadmin, `${Etiqueta} [Audio adjunto]`);
    Idreenviado = Reenviarmediawhatsapp(Credenciales.celularadmin, 'audio', (Mensaje.audio || Mensaje.voice).id, '');
  } else if (Mensaje.type === 'document' && Mensaje.document) {
    Idreenviado = Reenviarmediawhatsapp(Credenciales.celularadmin, 'document', Mensaje.document.id, `${Etiqueta} [Documento]`);
  }
  Guardarmapeomensajecanal(Idreenviado, Celularlimpio, Estadoconv.codigoreserva, 'cliente->admin');
}

function Normalizarcomandoadmin(Texto) {
  return String(Texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function Obtenercanalesabiertos(Modofiltro) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hoja = Libro.getSheetByName('Conversaciones');
  if (!Hoja || Hoja.getLastRow() < 2) { return []; }
  const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 7).getValues();
  return Filas.filter(function(F) {
    const M = String(F[2]);
    return Modofiltro ? M === Modofiltro : (M === 'Canal' || M === 'PendienteAdmin');
  }).map(function(F) {
    return { celular: String(F[0]).replace(/\D/g, ''), nombre: String(F[1] || 'Cliente'), modo: String(F[2]), codigo: String(F[3] || '') };
  });
}

function Resolverclientedestinoadmin(Mensaje, Modofiltro) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Idcitado = Mensaje && Mensaje.context && Mensaje.context.id;
  const Lista = Obtenercanalesabiertos(Modofiltro);
  if (Idcitado) {
    const Hojamsg = Libro.getSheetByName('Mensajescanal');
    if (Hojamsg && Hojamsg.getLastRow() >= 2) {
      const Filasmsg = Hojamsg.getRange(2, 1, Hojamsg.getLastRow() - 1, 3).getValues();
      for (let I = Filasmsg.length - 1; I >= 0; I--) {
        const Cel = String(Filasmsg[I][1]).replace(/\D/g, '');
        if (String(Filasmsg[I][0]) === String(Idcitado) && Lista.some(function(C) { return C.celular === Cel; })) { return Cel; }
      }
    }
  }
  if (Lista.length === 1) { return Lista[0].celular; }
  const Activo = PropertiesService.getScriptProperties().getProperty('CANAL_ACTIVO_ADMIN');
  if (Activo && Lista.some(function(C) { return C.celular === Activo; })) { return Activo; }
  return Lista.length > 0 ? Lista[Lista.length - 1].celular : '';
}

// Procesa comandos y respuestas enviadas desde el WhatsApp del administrador
function Procesarmensajeadministrador(Mensaje) {
  const Credenciales = Obtenercredenciales();
  const Textocrudo = (Mensaje.type === 'text' && Mensaje.text && Mensaje.text.body) ? Mensaje.text.body.trim() : '';
  const Comando = Normalizarcomandoadmin(Textocrudo);

  if (Comando === 'canales') {
    const Todos = Obtenercanalesabiertos();
    if (!Todos.length) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay canales abiertos ni pendientes en este momento.'); }
    const Lista = Todos.map(function(C) {
      const Tag = C.modo === 'PendienteAdmin' ? '⏳ Pendiente (responde SI)' : '🟢 En chat';
      return `• ${C.codigo}: ${C.nombre} (+${C.celular}) — ${Tag}`;
    }).join('\n');
    return Enviarmensajewhatsapp(Credenciales.celularadmin, `Canales (${Todos.length}):\n${Lista}`);
  }

  // Paso 4: El administrador responde SI para aceptar e iniciar el chat privado
  if (Comando === 'si') {
    const Celpendiente = Resolverclientedestinoadmin(Mensaje, 'PendienteAdmin');
    if (!Celpendiente) {
      return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay ningún cliente pendiente por iniciar atención. Escribe "canales" para verificar.');
    }
    const Convp = Obtenerestadoconversacion(Celpendiente);
    Actualizarconversacion(Celpendiente, { modo: 'Canal', ultimomensajeadmin: Formatearfechahora(new Date()) });
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celpendiente);
    Enviarmensajewhatsapp(Credenciales.celularadmin,
      `✅ Desde este momento estás hablando con el cliente "${Convp.nombre || 'Cliente'}" (${Convp.codigoreserva || 'Canal'}).\n` +
      `Todo lo que escribas aquí le llegará directamente.\n\n` +
      `Para finalizar el canal privado con el cliente, usa estos comandos:\n` +
      `• reserva confirmada finalizar\n• reserva rechazada finalizar`);
    Enviarmensajewhatsapp(Celpendiente, '¡Listo! Un administrador de Hospedaje Nissi ya se conectó y a partir de este momento te atiende directamente por este mismo chat.');
    Registrarbitacora('Canal', 'AdminAceptoCanal', `Admin inició atención con ${Convp.codigoreserva}`);
    return;
  }

  const Cambiocodigo = Textocrudo.match(/^#(NS-[A-Z0-9]+)$/i);
  if (Cambiocodigo) {
    const Codbuscado = Cambiocodigo[1].toUpperCase();
    const Encontrado = Obtenercanalesabiertos().find(function(C) { return C.codigo.toUpperCase() === Codbuscado; });
    if (!Encontrado) { return Enviarmensajewhatsapp(Credenciales.celularadmin, `No se encontró un canal con el código ${Codbuscado}.`); }
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Encontrado.celular);
    return Enviarmensajewhatsapp(Credenciales.celularadmin, `Cliente activo cambiado a ${Encontrado.nombre} (${Encontrado.codigo}).`);
  }

  const Celulardestino = Resolverclientedestinoadmin(Mensaje, 'Canal');
  if (!Celulardestino) {
    const Pendientes = Obtenercanalesabiertos('PendienteAdmin');
    if (Pendientes.length) {
      const P = Pendientes[Pendientes.length - 1];
      return Enviarmensajewhatsapp(Credenciales.celularadmin, `Tienes pendiente iniciar atención con "${P.nombre}" (${P.codigo}). Responde SI para comenzar a hablar con el cliente.`);
    }
    return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay ningún canal abierto activo. Escribe "canales" para verificar.');
  }

  if (Comando === 'reserva confirmada finalizar') { return Cerrarcanalyactualizarreserva(Celulardestino, true, 'administrador'); }
  if (Comando === 'reserva rechazada finalizar') { return Cerrarcanalyactualizarreserva(Celulardestino, false, 'administrador'); }

  PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celulardestino);
  Actualizarconversacion(Celulardestino, { ultimomensajeadmin: Formatearfechahora(new Date()) });

  if (Mensaje.type === 'text' && Textocrudo) {
    Enviarmensajewhatsapp(Celulardestino, `Administración Nissi: ${Textocrudo}`);
  } else if (Mensaje.type === 'image' && Mensaje.image) {
    Reenviarmediawhatsapp(Celulardestino, 'image', Mensaje.image.id, 'Administración Nissi');
  } else if ((Mensaje.type === 'audio' || Mensaje.type === 'voice') && (Mensaje.audio || Mensaje.voice)) {
    Reenviarmediawhatsapp(Celulardestino, 'audio', (Mensaje.audio || Mensaje.voice).id, '');
  } else if (Mensaje.type === 'document' && Mensaje.document) {
    Reenviarmediawhatsapp(Celulardestino, 'document', Mensaje.document.id, 'Administración Nissi');
  }
}

// Confirma o rechaza la reserva y cierra el canal activo
function Cerrarcanalyactualizarreserva(Celularcliente, Confirmar, Origen) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Credenciales = Obtenercredenciales();
  const Conv = Obtenerestadoconversacion(Celularcliente);
  const Filas = Hojareservas.getDataRange().getValues();

  let Fila = null;
  let Indice = -1;
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincidecod = Conv.codigoreserva && String(Filas[I][0]).toUpperCase() === Conv.codigoreserva.toUpperCase();
    const Coincidecel = String(Filas[I][3]).replace(/\D/g, '') === Conv.celular;
    if ((Coincidecod || Coincidecel) && (String(Filas[I][14]) === 'En canal' || String(Filas[I][14]) === 'Apartada' || String(Filas[I][14]) === 'Verificando')) {
      Fila = Filas[I]; Indice = I + 1; break;
    }
  }

  const Codigo = Fila ? String(Fila[0]) : (Conv.codigoreserva || 'NS-0000');
  const Nombre = Fila ? String(Fila[2]) : (Conv.nombre || 'Viajero');
  const Hab = Fila ? String(Fila[4]).padStart(2, '0') : '01';
  const Llegada = Fila ? String(Fila[5]).slice(0, 10) : '';
  const Salida = Fila ? String(Fila[6]).slice(0, 10) : '';
  const Hora = Fila ? String(Fila[9] || 'Por confirmar') : 'Por confirmar';
  const Total = Fila ? Number(Fila[10] || 0) : 0;

  if (Confirmar && Indice > 0) {
    Hojareservas.getRange(Indice, 14).setValue(Fila[13] || 'Efectivo');
    Hojareservas.getRange(Indice, 15).setValue('Confirmada');
    Hojareservas.getRange(Indice, 23).setValue('Confirmada por el administrador en canal');
    Cambiarocupacionhabitacion(Hojahabitaciones, Hab, 'Ocupada');
    const Horacheckout = Formatearhora12(Number(Leerconfiguracionhoja().HORACHECKOUT || 11));
    Notificarreservaconfirmada({
      codigo: Codigo, habitacion: Hab, canal: String(Fila[15] || 'WhatsApp'), nombre: Nombre, celular: Conv.celular,
      llegada: Llegada, salida: Salida, noches: Number(Fila[7] || 1), personas: Number(Fila[8] || 1),
      horallegada: Hora, horasalida: String(Fila[23] || Horacheckout), total: Total, pagado: Number(Fila[11] || 0),
      entidad: Fila[13] || 'Efectivo', referencia: 'Confirmada en canal privado', observaciones: String(Fila[22] || ''),
      mensajecliente: `✅ El administrador ha confirmado tu reserva ${Codigo} en Hospedaje Nissi.\nHabitación ${Hab} · ${Llegada} al ${Salida} · Llegada ${Hora} · Check-out ${Horacheckout} · Total $${Total.toLocaleString('es-CO')} COP.`
    });
  } else if (Indice > 0) {
    Hojareservas.getRange(Indice, 15).setValue('Rechazada');
    Hojareservas.getRange(Indice, 23).setValue(`Cerrada sin confirmar (${Origen || 'admin'})`);
    Cambiarocupacionhabitacion(Hojahabitaciones, Hab, 'Disponible');
    Enviarmensajeinteligente(Conv.celular, 'Tu reserva no ha sido confirmada en esta ocasión, pero puedes seguir contando con Hospedaje Nissi. Cuando quieras, vuelve a escribirnos por este mismo chat.', 'reserva_no_confirmada_cliente', [Nombre, Codigo]);
  }
  Actualizarconversacion(Conv.celular, { modo: 'IA', aperturacanal: '', avisodemoracanal: '' });
  Enviarmensajewhatsapp(Credenciales.celularadmin, `Canal ${Codigo} cerrado: reserva ${Confirmar ? 'confirmada' : 'rechazada'}. Canales restantes: ${Obtenercanalesabiertos().length}.`);
  Registrarbitacora('Canal', 'Cerrarcanal', `${Codigo} -> ${Confirmar ? 'Confirmada' : 'Rechazada'}`);
}
