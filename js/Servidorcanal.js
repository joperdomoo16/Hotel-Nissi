// Canal de comunicacion entre cliente y administrador por WhatsApp

const Encabezadosconv = [
  'Celular', 'Nombre', 'Modo', 'Codigoreserva', 'Ultimomensajecliente', 'Ultimomensajeadmin',
  'Aperturacanal', 'Avisodemoracanal', 'Ultimorecordatorioadmin', 'Idinteraccionia',
  'Ultimorecordatoriocliente', 'Motivorequerimiento', 'Resumencontexto'
];

function Obtenerestadoconversacion(Celular) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hoja = Libro.getSheetByName('Conversaciones');
  const Celularlimpio = Normalizaridwhatsapp(Celular);
  if (!Hoja || !Celularlimpio || Hoja.getLastRow() < 2) {
    return { fila: -1, celular: Celularlimpio, modo: 'IA', codigoreserva: '', ultimomensajecliente: '', ultimorecordatoriocliente: '', motivorequerimiento: '', resumencontexto: '' };
  }
  const Numcols = Math.min(Math.max(Hoja.getLastColumn(), 10), 13);
  const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, Numcols).getValues();
  for (let I = 0; I < Filas.length; I++) {
    if (Normalizaridwhatsapp(Filas[I][0]) === Celularlimpio) {
      return {
        fila: I + 2, celular: Celularlimpio, nombre: String(Filas[I][1] || ''), modo: String(Filas[I][2] || 'IA'),
        codigoreserva: String(Filas[I][3] || ''), ultimomensajecliente: Filas[I][4], ultimomensajeadmin: Filas[I][5],
        aperturacanal: Filas[I][6], avisodemoracanal: String(Filas[I][7] || ''), ultimorecordatorioadmin: Filas[I][8],
        idinteraccionia: String(Filas[I][9] || ''), ultimorecordatoriocliente: Filas[I][10] || '',
        motivorequerimiento: String(Filas[I][11] || ''), resumencontexto: String(Filas[I][12] || '')
      };
    }
  }
  return { fila: -1, celular: Celularlimpio, modo: 'IA', codigoreserva: '', ultimomensajecliente: '', ultimorecordatoriocliente: '', motivorequerimiento: '', resumencontexto: '' };
}

function Actualizarconversacion(Celular, Campos) {
  const Celularlimpio = Normalizaridwhatsapp(Celular);
  if (!Celularlimpio) { return; }
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  let Hoja = Libro.getSheetByName('Conversaciones');
  if (!Hoja) {
    Hoja = Libro.insertSheet('Conversaciones');
    Hoja.appendRow(Encabezadosconv);
  } else if (Hoja.getLastColumn() < 13) {
    for (let C = Hoja.getLastColumn(); C < 13; C++) { Hoja.getRange(1, C + 1).setValue(Encabezadosconv[C]); }
  }
  const A = Obtenerestadoconversacion(Celularlimpio);
  const Nueva = [
    A.celular, Campos.nombre !== undefined ? Sanitizarcelda(Campos.nombre, 60) : (A.nombre || ''),
    Campos.modo !== undefined ? Campos.modo : (A.modo || 'IA'),
    Campos.codigoreserva !== undefined ? Campos.codigoreserva : (A.codigoreserva || ''),
    Campos.ultimomensajecliente !== undefined ? Campos.ultimomensajecliente : (A.ultimomensajecliente || ''),
    Campos.ultimomensajeadmin !== undefined ? Campos.ultimomensajeadmin : (A.ultimomensajeadmin || ''),
    Campos.aperturacanal !== undefined ? Campos.aperturacanal : (A.aperturacanal || ''),
    Campos.avisodemoracanal !== undefined ? Campos.avisodemoracanal : (A.avisodemoracanal || ''),
    Campos.ultimorecordatorioadmin !== undefined ? Campos.ultimorecordatorioadmin : (A.ultimorecordatorioadmin || ''),
    Campos.idinteraccionia !== undefined ? Campos.idinteraccionia : (A.idinteraccionia || ''),
    Campos.ultimorecordatoriocliente !== undefined ? Campos.ultimorecordatoriocliente : (A.ultimorecordatoriocliente || ''),
    Campos.motivorequerimiento !== undefined ? Sanitizarcelda(Campos.motivorequerimiento, 120) : (A.motivorequerimiento || ''),
    Campos.resumencontexto !== undefined ? Sanitizarcelda(Campos.resumencontexto, 400) : (A.resumencontexto || '')
  ];
  if (A.fila > 0) { Hoja.getRange(A.fila, 1, 1, Nueva.length).setValues([Nueva]); } else { Hoja.appendRow(Nueva); }
}

function Formatearnumerocomando(Identificador) {
  const Id = Normalizaridwhatsapp(Identificador);
  return /^57\d{10}$/.test(Id) ? Id.slice(2) : Id;
}

function Buscaridclientepornumero(Entrada) {
  const Limpio = Normalizaridwhatsapp(String(Entrada || '').replace(/^\+/, ''));
  if (!Limpio) { return ''; }
  const Hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Conversaciones');
  if (Hoja && Hoja.getLastRow() >= 2) {
    const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 1).getValues();
    for (let I = Filas.length - 1; I >= 0; I--) {
      const Id = Normalizaridwhatsapp(Filas[I][0]);
      if (!Id) { continue; }
      if (Id === Limpio || Id === `57${Limpio}` || (`57${Id}` === Limpio) || (Limpio.length >= 10 && Id.slice(-10) === Limpio.slice(-10) && !/[A-Za-z]/.test(Id))) {
        return Id;
      }
    }
  }
  return (/^\d{10}$/.test(Limpio) && Limpio.charAt(0) === '3') ? `57${Limpio}` : Limpio;
}

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
  const Destino = Normalizaridwhatsapp(Cuerpopayload.to || Cuerpopayload.recipient);
  if (!Destino) { return ''; }
  const Esbsuid = /[A-Za-z]/.test(Destino);
  delete Cuerpopayload.to; delete Cuerpopayload.recipient;
  if (Esbsuid) { Cuerpopayload.recipient = Destino; } else { Cuerpopayload.to = Destino; }
  const Url = `https://graph.facebook.com/v25.0/${Credenciales.idtelefonowhatsapp}/messages`;
  const Opciones = { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }, payload: JSON.stringify(Cuerpopayload) };
  let Respuesta = UrlFetchApp.fetch(Url, Opciones);
  if (Esbsuid && Respuesta.getResponseCode() >= 400) {
    delete Cuerpopayload.recipient; Cuerpopayload.to = Destino;
    Opciones.payload = JSON.stringify(Cuerpopayload);
    Respuesta = UrlFetchApp.fetch(Url, Opciones);
  }
  try {
    const Texto = Respuesta.getContentText();
    if (Respuesta.getResponseCode() >= 300) { Registrarbitacora(Moduloerror || 'WhatsApp', `ErrorHTTP_${Respuesta.getResponseCode()}`, Texto); }
    const Datos = JSON.parse(Texto);
    return (Datos.messages && Datos.messages[0] && Datos.messages[0].id) || '';
  } catch (E) { return ''; }
}

function Enviarmensajewhatsapp(Numerodestino, Textomensaje) {
  return Peticionwhatsapp({ messaging_product: 'whatsapp', to: Normalizaridwhatsapp(Numerodestino), type: 'text', text: { body: String(Textomensaje || '') } }, 'WhatsApp');
}

function Enviarplantillawhatsapp(Numerodestino, Nombreplantilla, Parametrostexto) {
  const Parametros = (Parametrostexto || []).map(function(Valor) { return { type: 'text', text: String(Valor == null ? '-' : Valor) }; });
  return Peticionwhatsapp({ messaging_product: 'whatsapp', to: Normalizaridwhatsapp(Numerodestino), type: 'template', template: { name: Nombreplantilla, language: { code: 'es' }, components: Parametros.length ? [{ type: 'body', parameters: Parametros }] : [] } }, 'WhatsAppPlantilla');
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
    if (Credenciales.correoadmin && Normalizaridwhatsapp(Numerodestino) === Credenciales.celularadmin) {
      MailApp.sendEmail({ to: Credenciales.correoadmin, subject: 'Hospedaje Nissi · Atención requerida en WhatsApp', body: Textolibre });
    }
  } catch (E) {}
  return '';
}

function Reenviarmediawhatsapp(Numerodestino, Tipomedia, Idmedia, Leyenda) {
  const Objetomedia = { id: Idmedia };
  if (Leyenda && (Tipomedia === 'image' || Tipomedia === 'document')) { Objetomedia.caption = Leyenda; }
  const Cuerpo = { messaging_product: 'whatsapp', to: Normalizaridwhatsapp(Numerodestino), type: Tipomedia };
  Cuerpo[Tipomedia] = Objetomedia;
  return Peticionwhatsapp(Cuerpo, 'WhatsAppMedia');
}

function Guardarmapeomensajecanal(Idmensajemeta, Celularcliente, Codigoreserva, Direccion) {
  if (!Idmensajemeta) { return; }
  const Hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mensajescanal');
  if (Hoja) { Hoja.appendRow([Idmensajemeta, Normalizaridwhatsapp(Celularcliente), Codigoreserva || '', Direccion || 'cliente->admin', Formatearfechahora(new Date())]); }
}

// Envia el resumen de la reserva confirmada al WhatsApp del administrador
function Notificaradministradorwhatsapp(Textoresumen, Parametrosplantilla) {
  const Credenciales = Obtenercredenciales();
  if (Credenciales.celularadmin) {
    Enviarmensajeinteligente(Credenciales.celularadmin, Textoresumen, 'reserva_confirmada_admin', Parametrosplantilla || []);
  }
}

// Solicita conexion privada con el administrador y espera confirmacion SI o comando manual
function Abrircanaladministrador(Celularcliente, Codigoreserva, Motivo, Detalleextra, Resumenchat) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Ahoratexto = Formatearfechahora(new Date());
  const Convprevia = Obtenerestadoconversacion(Celularlimpio);
  let Filareserva = null, Indicefila = -1;
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Ccod = Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase();
    const Ccel = Celularlimpio && Normalizaridwhatsapp(Filas[I][3]) === Celularlimpio;
    const Est = String(Filas[I][14]);
    if ((Ccod || Ccel) && (Est === 'Apartada' || Est === 'Verificando' || Est === 'En canal')) { Filareserva = Filas[I]; Indicefila = I + 1; break; }
  }
  const Codigo = Filareserva ? String(Filareserva[0]) : (Codigoreserva || 'SIN-CODIGO');
  const Nombreres = Filareserva ? String(Filareserva[2]) : '';
  const Nombre = (Nombreres && Nombreres !== 'Por confirmar') ? Nombreres : (Convprevia.nombre || 'Cliente');
  const Hab = Filareserva ? String(Filareserva[4]).padStart(2, '0') : '--';
  const Llegada = Filareserva ? Normalizarfecha(Filareserva[5]) : 'Por definir';
  const Personas = Filareserva ? Number(Filas[Indicefila - 1][8] || 2) : 2;
  const Hora = Filareserva ? String(Filareserva[9] || 'Por confirmar') : 'Por confirmar';
  const Total = Filareserva ? Number(Filareserva[10] || 0) : 0;
  const Obsantes = Filareserva ? String(Filareserva[22] || '').trim() : '';

  if (Indicefila > 0) {
    Hojareservas.getRange(Indicefila, 15).setValue('En canal');
    if (Motivo === 'efectivo') { Hojareservas.getRange(Indicefila, 18).setValue('Efectivo'); }
    Hojareservas.getRange(Indicefila, 23).setValue(Sanitizarcelda(Obsantes ? `${Obsantes} · En canal (${Motivo})` : `En canal (${Motivo})`, 120));
  }
  const Msgcli = Motivo === 'efectivo'
    ? 'Debido a que es pago en efectivo, te voy a comunicar con un administrador. Por favor permanece en línea en el chat mientras se conecta contigo.'
    : (Motivo === 'tiempo_correo' ? 'Un administrador revisará tu comprobante en breve y se conectará por este medio. Por favor permanece en línea en el chat.' : 'Perfecto, ya te comunico con el administrador, por favor espera en el chat.');
  Enviarmensajewhatsapp(Celularlimpio, Msgcli);

  const Motivofinal = Detalleextra || Motivo || 'Atención solicitada';
  const Resumenfinal = [Resumenchat, Obsantes].filter(Boolean).join(' · ');
  Actualizarconversacion(Celularlimpio, { nombre: Nombre, modo: 'PendienteAdmin', codigoreserva: Codigo, aperturacanal: Ahoratexto, avisodemoracanal: '', ultimorecordatorioadmin: Ahoratexto, ultimorecordatoriocliente: Ahoratexto, motivorequerimiento: Motivofinal, resumencontexto: Resumenfinal });

  const Numerocmd = Formatearnumerocomando(Celularlimpio);
  const Titulomotivo = Motivo === 'efectivo' ? '💵 Pago en efectivo' : `🔔 Atención requerida (${Motivofinal})`;
  const Tarjetaadmin = `${Titulomotivo} · ${Codigo}\nCliente: ${Nombre} (${Numerocmd})\nHabitación: ${Hab} · Personas: ${Personas} · Llegada: ${Llegada} ${Hora}` +
    `${Obsantes ? `\nDetalles: ${Obsantes}` : ''}${Resumenchat ? `\nResumen del chat: ${Resumenchat}` : ''}\nMonto: $${Total.toLocaleString('es-CO')} COP\n\n¿Comenzar atención con "${Nombre}"?\nResponde: SI (o escribe: abrir canal con ${Numerocmd})`;
  const Idmsg = Enviarmensajeinteligente(Credenciales.celularadmin, Tarjetaadmin, 'canal_efectivo_admin', [Codigo, Nombre, Hab, Personas, `${Llegada} ${Hora}`, Total.toLocaleString('es-CO')]);
  Guardarmapeomensajecanal(Idmsg, Celularlimpio, Codigo, 'sistema->admin');
  Registrarbitacora('Canal', 'Solicitaradmin', `Solicitud enviada para ${Codigo} (${Motivo})`);
  return { exito: true, codigo: Codigo, modo: 'PendienteAdmin', mensaje: 'Solicitud enviada al administrador.' };
}

function Solicitarpagoefectivo(Celularcliente, Codigoreserva, Resumenchat) { return Abrircanaladministrador(Celularcliente, Codigoreserva, 'efectivo', 'Pago en efectivo', Resumenchat); }
function Solicitaradministrador(Celularcliente, Codigoreserva, Motivo, Resumenchat) { return Abrircanaladministrador(Celularcliente, Codigoreserva, 'persona', Motivo || 'Solicitud de hablar con una persona', Resumenchat); }

function Procesarmensajeclienteencanal(Celularcliente, Mensaje) {
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Estadoconv = Obtenerestadoconversacion(Celularlimpio);
  const Campos = { ultimomensajecliente: Formatearfechahora(new Date()) };
  if (Estadoconv.modo === 'PendienteAdmin') {
    if (Mensaje.type === 'text' && Mensaje.text && Mensaje.text.body) {
      const Textoextra = Mensaje.text.body.trim();
      Campos.resumencontexto = Estadoconv.resumencontexto ? `${Estadoconv.resumencontexto} | Cliente: ${Textoextra}`.slice(-400) : `Cliente: ${Textoextra}`;
      Guardarmapeomensajecanal(Enviarmensajewhatsapp(Credenciales.celularadmin, `⏳ ${Estadoconv.nombre || 'Cliente'} (${Estadoconv.codigoreserva || Formatearnumerocomando(Celularlimpio)}) escribió: "${Textoextra}"\nResponde SI para iniciar la atención.`), Celularlimpio, Estadoconv.codigoreserva, 'cliente->admin');
    }
    Actualizarconversacion(Celularlimpio, Campos);
    Enviarmensajewhatsapp(Celularlimpio, 'Estamos buscando a un administrador disponible para atenderte, por favor permanece en línea en el chat.');
    return;
  }
  Actualizarconversacion(Celularlimpio, Campos);
  const Etiqueta = `👤 ${Estadoconv.nombre || 'Cliente'} (${Estadoconv.codigoreserva || 'Canal'}):`;
  PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celularlimpio);
  let Idreenviado = '';
  if (Mensaje.type === 'text' && Mensaje.text) { Idreenviado = Enviarmensajewhatsapp(Credenciales.celularadmin, `${Etiqueta} ${Mensaje.text.body}`); }
  else if (Mensaje.type === 'image' && Mensaje.image) { Idreenviado = Reenviarmediawhatsapp(Credenciales.celularadmin, 'image', Mensaje.image.id, `${Etiqueta} [Imagen]`); }
  else if ((Mensaje.type === 'audio' || Mensaje.type === 'voice') && (Mensaje.audio || Mensaje.voice)) { Enviarmensajewhatsapp(Credenciales.celularadmin, `${Etiqueta} [Audio adjunto]`); Idreenviado = Reenviarmediawhatsapp(Credenciales.celularadmin, 'audio', (Mensaje.audio || Mensaje.voice).id, ''); }
  else if (Mensaje.type === 'document' && Mensaje.document) { Idreenviado = Reenviarmediawhatsapp(Credenciales.celularadmin, 'document', Mensaje.document.id, `${Etiqueta} [Documento]`); }
  Guardarmapeomensajecanal(Idreenviado, Celularlimpio, Estadoconv.codigoreserva, 'cliente->admin');
}

function Normalizarcomandoadmin(Texto) { return String(Texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }

function Obtenercanalesabiertos(Modofiltro) {
  const Hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Conversaciones');
  if (!Hoja || Hoja.getLastRow() < 2) { return []; }
  return Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 7).getValues().filter(function(F) {
    return Modofiltro ? String(F[2]) === Modofiltro : (F[2] === 'Canal' || F[2] === 'PendienteAdmin');
  }).map(function(F) { return { celular: Normalizaridwhatsapp(F[0]), nombre: String(F[1] || 'Cliente'), modo: String(F[2]), codigo: String(F[3] || '') }; });
}

function Resolverclientedestinoadmin(Mensaje, Modofiltro) {
  const Idcitado = Mensaje && Mensaje.context && Mensaje.context.id;
  const Lista = Obtenercanalesabiertos(Modofiltro);
  if (Idcitado) {
    const Hojamsg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mensajescanal');
    if (Hojamsg && Hojamsg.getLastRow() >= 2) {
      const Filasmsg = Hojamsg.getRange(2, 1, Hojamsg.getLastRow() - 1, 3).getValues();
      for (let I = Filasmsg.length - 1; I >= 0; I--) {
        const Cel = Normalizaridwhatsapp(Filasmsg[I][1]);
        if (String(Filasmsg[I][0]) === String(Idcitado) && Lista.some(function(C) { return C.celular === Cel; })) { return Cel; }
      }
    }
  }
  if (Lista.length === 1) { return Lista[0].celular; }
  const Activo = PropertiesService.getScriptProperties().getProperty('CANAL_ACTIVO_ADMIN');
  return (Activo && Lista.some(function(C) { return C.celular === Activo; })) ? Activo : (Lista.length ? Lista[Lista.length - 1].celular : '');
}

function Procesarmensajeadministrador(Mensaje) {
  const Credenciales = Obtenercredenciales();
  const Textocrudo = (Mensaje.type === 'text' && Mensaje.text && Mensaje.text.body) ? Mensaje.text.body.trim() : '';
  const Comando = Normalizarcomandoadmin(Textocrudo);
  if (Comando === 'canales') {
    const Todos = Obtenercanalesabiertos();
    if (!Todos.length) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay canales abiertos ni pendientes en este momento.'); }
    const Lista = Todos.map(function(C) { return `• ${C.codigo}: ${C.nombre} (${Formatearnumerocomando(C.celular)}) — ${C.modo === 'PendienteAdmin' ? '⏳ Pendiente (SI)' : '🟢 En chat'}`; }).join('\n');
    return Enviarmensajewhatsapp(Credenciales.celularadmin, `Canales (${Todos.length}):\n${Lista}`);
  }
  const Matchabrir = Textocrudo.replace(/^-\s*/, '').match(/^abrir\s+canal\s+con\s+(.+)$/i);
  if (Matchabrir) {
    const Celobjetivo = Buscaridclientepornumero(Matchabrir[1]);
    if (!Celobjetivo) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'Indica un número válido, por ejemplo: abrir canal con 3209014142'); }
    const Ahoratxt = Formatearfechahora(new Date()), Numcmd = Formatearnumerocomando(Celobjetivo);
    Actualizarconversacion(Celobjetivo, { modo: 'Canal', aperturacanal: Ahoratxt, ultimomensajeadmin: Ahoratxt, avisodemoracanal: '' });
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celobjetivo);
    Enviarmensajewhatsapp(Credenciales.celularadmin, `Canal con el cliente ${Numcmd} establecido. A partir de este momento los mensajes serán redirigidos directamente.\n\nRecuerda que para finalizar el canal y devolverme la atención del cliente debes ejecutar uno de estos comandos:\n• reserva confirmada finalizar\n• reserva rechazada finalizar\npara saber cómo proceder con el cliente.`);
    Enviarmensajewhatsapp(Celobjetivo, '¡Hola! Un administrador de Hospedaje Nissi se acaba de conectar a este chat para atender tu solicitud directamente.');
    Registrarbitacora('Canal', 'AdminAbrioCanalManual', `Admin abrió canal manual con ${Celobjetivo}`);
    return;
  }
  if (Comando === 'si') {
    const Celpendiente = Resolverclientedestinoadmin(Mensaje, 'PendienteAdmin');
    if (!Celpendiente) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay ningún cliente pendiente por iniciar atención. Escribe "canales" para verificar.'); }
    const Convp = Obtenerestadoconversacion(Celpendiente), Ahoracanal = Formatearfechahora(new Date());
    Actualizarconversacion(Celpendiente, { modo: 'Canal', aperturacanal: Ahoracanal, ultimomensajeadmin: Ahoracanal, avisodemoracanal: '' });
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celpendiente);
    Enviarmensajewhatsapp(Credenciales.celularadmin, `✅ Hablando con "${Convp.nombre || 'Cliente'}" (${Convp.codigoreserva || 'Canal'}). Todo lo que escribas le llegará directo.\nComandos de cierre:\n• reserva confirmada finalizar\n• reserva rechazada finalizar`);
    Enviarmensajewhatsapp(Celpendiente, '¡Listo! Un administrador de Hospedaje Nissi ya se conectó y a partir de este momento te atiende directamente por este mismo chat.');
    return Registrarbitacora('Canal', 'AdminAceptoCanal', `Admin inició atención con ${Convp.codigoreserva}`);
  }
  const Cambiocodigo = Textocrudo.match(/^#(NS-[A-Z0-9]+)$/i);
  if (Cambiocodigo) {
    const Codbuscado = Cambiocodigo[1].toUpperCase(), Enc = Obtenercanalesabiertos().find(function(C) { return C.codigo.toUpperCase() === Codbuscado; });
    if (!Enc) { return Enviarmensajewhatsapp(Credenciales.celularadmin, `No se encontró un canal con el código ${Codbuscado}.`); }
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Enc.celular);
    return Enviarmensajewhatsapp(Credenciales.celularadmin, `Cliente activo cambiado a ${Enc.nombre} (${Enc.codigo}).`);
  }
  const Celulardestino = Resolverclientedestinoadmin(Mensaje, 'Canal');
  if (!Celulardestino) {
    const Pendientes = Obtenercanalesabiertos('PendienteAdmin');
    if (Pendientes.length) { const P = Pendientes[Pendientes.length - 1]; return Enviarmensajewhatsapp(Credenciales.celularadmin, `Tienes pendiente atender a "${P.nombre}" (${P.codigo}). Responde SI para iniciar.`); }
    return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay ningún canal abierto activo. Escribe "canales" para verificar.');
  }
  if (Comando === 'reserva confirmada finalizar') { return Cerrarcanalyactualizarreserva(Celulardestino, true, 'administrador'); }
  if (Comando === 'reserva rechazada finalizar') { return Cerrarcanalyactualizarreserva(Celulardestino, false, 'administrador'); }
  PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celulardestino);
  Actualizarconversacion(Celulardestino, { ultimomensajeadmin: Formatearfechahora(new Date()) });
  if (Mensaje.type === 'text' && Textocrudo) { Enviarmensajewhatsapp(Celulardestino, `Administración Nissi: ${Textocrudo}`); }
  else if (Mensaje.type === 'image' && Mensaje.image) { Reenviarmediawhatsapp(Celulardestino, 'image', Mensaje.image.id, 'Administración Nissi'); }
  else if ((Mensaje.type === 'audio' || Mensaje.type === 'voice') && (Mensaje.audio || Mensaje.voice)) { Reenviarmediawhatsapp(Celulardestino, 'audio', (Mensaje.audio || Mensaje.voice).id, ''); }
  else if (Mensaje.type === 'document' && Mensaje.document) { Reenviarmediawhatsapp(Celulardestino, 'document', Mensaje.document.id, 'Administración Nissi'); }
}

function Cerrarcanalyactualizarreserva(Celularcliente, Confirmar, Origen) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet(), Hojareservas = Libro.getSheetByName('Reservas'), Hojahab = Libro.getSheetByName('Habitaciones');
  const Credenciales = Obtenercredenciales(), Conv = Obtenerestadoconversacion(Celularcliente), Filas = Hojareservas.getDataRange().getValues();
  let Fila = null, Indice = -1;
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Ccod = Conv.codigoreserva && String(Filas[I][0]).toUpperCase() === Conv.codigoreserva.toUpperCase();
    const Ccel = Normalizaridwhatsapp(Filas[I][3]) === Conv.celular;
    if ((Ccod || Ccel) && (String(Filas[I][14]) === 'En canal' || String(Filas[I][14]) === 'Apartada' || String(Filas[I][14]) === 'Verificando')) { Fila = Filas[I]; Indice = I + 1; break; }
  }
  const Codigo = Fila ? String(Fila[0]) : (Conv.codigoreserva || 'NS-0000'), Nombre = Fila ? String(Fila[2]) : (Conv.nombre || 'Viajero');
  const Hab = Fila ? String(Fila[4]).padStart(2, '0') : '01', Llegada = Fila ? Normalizarfecha(Fila[5]) : '', Salida = Fila ? Normalizarfecha(Fila[6]) : '';
  const Hora = Fila ? String(Fila[9] || 'Por confirmar') : 'Por confirmar', Total = Fila ? Number(Fila[10] || 0) : 0;

  if (Confirmar && Indice > 0) {
    Hojareservas.getRange(Indice, 14).setValue(Fila[13] || 'Efectivo'); Hojareservas.getRange(Indice, 15).setValue('Confirmada');
    Hojareservas.getRange(Indice, 23).setValue('Confirmada por el administrador en canal'); Cambiarocupacionhabitacion(Hojahab, Hab, 'Ocupada');
    const Horacheckout = Formatearhora12(Number(Leerconfiguracionhoja().HORACHECKOUT || 11));
    Notificarreservaconfirmada({
      codigo: Codigo, habitacion: Hab, canal: String(Fila[15] || 'WhatsApp'), nombre: Nombre, celular: Conv.celular, llegada: Llegada, salida: Salida,
      noches: Number(Fila[7] || 1), personas: Number(Fila[8] || 1), horallegada: Hora, horasalida: String(Fila[23] || Horacheckout), total: Total, pagado: Number(Fila[11] || 0),
      entidad: Fila[13] || 'Efectivo', referencia: 'Confirmada en canal privado', observaciones: String(Fila[22] || ''),
      mensajecliente: `✅ El administrador ha confirmado tu reserva ${Codigo} en Hospedaje Nissi.\nHabitación ${Hab} · ${Llegada} al ${Salida} · Llegada ${Hora} · Check-out ${Horacheckout} · Total $${Total.toLocaleString('es-CO')} COP.`
    });
  } else if (Indice > 0) {
    Hojareservas.getRange(Indice, 15).setValue('Rechazada'); Hojareservas.getRange(Indice, 23).setValue(`Cerrada sin confirmar (${Origen || 'admin'})`);
    Cambiarocupacionhabitacion(Hojahab, Hab, 'Disponible');
    Enviarmensajeinteligente(Conv.celular, 'Tu reserva no ha sido confirmada en esta ocasión, pero puedes seguir contando con Hospedaje Nissi. Cuando quieras, vuelve a escribirnos por este mismo chat.', 'reserva_no_confirmada_cliente', [Nombre, Codigo]);
  }
  Actualizarconversacion(Conv.celular, { modo: 'IA', aperturacanal: '', avisodemoracanal: '' });
  const Props = PropertiesService.getScriptProperties();
  if (Props.getProperty('CANAL_ACTIVO_ADMIN') === Conv.celular) { Props.deleteProperty('CANAL_ACTIVO_ADMIN'); }
  Enviarmensajewhatsapp(Credenciales.celularadmin, `Canal ${Codigo} cerrado: reserva ${Confirmar ? 'confirmada' : 'rechazada'}. Canales restantes: ${Obtenercanalesabiertos().length}.`);
  Registrarbitacora('Canal', 'Cerrarcanal', `${Codigo} -> ${Confirmar ? 'Confirmada' : 'Rechazada'}`);
}
