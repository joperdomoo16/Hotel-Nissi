// Canal de comunicación entre cliente y administrador por WhatsApp

function Formatearnumerocomando(Identificador) {
  const Id = Normalizaridwhatsapp(Identificador);
  const Diezdirecto = Normalizarcelularcolombiano(Id);
  if (Diezdirecto) { return Diezdirecto; }
  const Conv = Obtenerestadoconversacion(Id);
  return Normalizarcelularcolombiano(Conv.telefonocontacto) || Id;
}

function Buscaridclientepornumero(Entrada) {
  const Limpio = Normalizaridwhatsapp(String(Entrada || '').replace(/^\+/, ''));
  if (!Limpio) { return ''; }
  const Diezbuscado = Normalizarcelularcolombiano(Limpio);
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hoja = Libro.getSheetByName('Conversaciones');
  if (Hoja && Hoja.getLastRow() >= 2) {
    const Numcols = Math.min(Math.max(Hoja.getLastColumn(), 1), 14);
    const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, Numcols).getValues();
    for (let I = Filas.length - 1; I >= 0; I--) {
      const Id = Normalizaridwhatsapp(Filas[I][0]);
      const Tel = Numcols >= 14 ? Normalizarcelularcolombiano(Filas[I][13]) : '';
      if (!Id) { continue; }
      if (Id === Limpio || Id === `57${Limpio}` || (`57${Id}` === Limpio) || (Diezbuscado && (Tel === Diezbuscado || Normalizarcelularcolombiano(Id) === Diezbuscado))) {
        return Id;
      }
    }
  }
  const Hojares = typeof Obtenerhojareservas === 'function' ? Obtenerhojareservas() : Libro.getSheetByName('Reservas');
  if (Diezbuscado && Hojares && Hojares.getLastRow() >= 2) {
    const Filasres = Hojares.getDataRange().getValues();
    for (let R = Filasres.length - 1; R >= 1; R--) {
      if (Normalizarcelularcolombiano(Filasres[R][4]) === Diezbuscado) { return Obtenerdestinowhatsappreserva(Filasres[R]); }
    }
  }
  return Diezbuscado ? `57${Diezbuscado}` : Limpio;
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

function Notificaradministradorwhatsapp(Textoresumen, Parametrosplantilla) {
  const Credenciales = Obtenercredenciales();
  if (Credenciales.celularadmin) {
    Enviarmensajeinteligente(Credenciales.celularadmin, Textoresumen, 'reserva_confirmada_admin', Parametrosplantilla || []);
  }
}

function Enviartarjetaadminpendiente(Celularcliente, Filareserva, Conv, Motivo, Totalcola, Etiquetaturno) {
  const Credenciales = Obtenercredenciales(), Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Codigo = Filareserva ? String(Filareserva[0]) : (Conv.codigoreserva || 'SIN-CODIGO'), Nombreres = Filareserva ? String(Filareserva[2]) : '';
  const Nombre = (Nombreres && Nombreres !== 'Por confirmar') ? Nombreres : (Conv.nombre || 'Cliente');
  const Cedula = Filareserva && Filareserva[3] ? ` · C.C. ${Filareserva[3]}` : '', Hab = Filareserva ? String(Filareserva[5]).padStart(2, '0') : '--';
  const Llegada = Filareserva ? Normalizarfecha(Filareserva[6]) : 'Por definir', Personas = Filareserva ? Number(Filareserva[9] || 2) : 2;
  const Hora = Filareserva ? String(Filareserva[10] || 'Por confirmar') : 'Por confirmar', Total = Filareserva ? Number(Filareserva[11] || 0) : 0;
  const Obs = Filareserva ? String(Filareserva[23] || '').trim() : '', Numerocmd = (Filareserva && Normalizarcelularcolombiano(Filareserva[4])) || Formatearnumerocomando(Celularlimpio);
  const Titulo = Motivo === 'efectivo' ? 'Pago en efectivo' : `Atención requerida (${Motivo || Conv.motivorequerimiento || 'Atención solicitada'})`;
  const Prefijo = Etiquetaturno || (Totalcola > 1 ? `Turno 1 de ${Totalcola} en espera · ` : '');
  const Tarjeta = `${Prefijo}${Titulo} · ${Codigo}\nCliente: ${Nombre}${Cedula} (${Numerocmd})\nHabitación: ${Hab} · Personas: ${Personas} · Llegada: ${Llegada} ${Hora}` +
    `${Obs ? `\nDetalles: ${Obs}` : ''}${Conv.resumencontexto ? `\nResumen del chat: ${Conv.resumencontexto}` : ''}\nMonto: $${Total.toLocaleString('es-CO')} COP\n\n¿Comenzar atención con "${Nombre}"?\nResponde: SI (o escribe: abrir canal con ${Numerocmd})`;
  Guardarmapeomensajecanal(Enviarmensajeinteligente(Credenciales.celularadmin, Tarjeta, 'canal_efectivo_admin', [Codigo, Nombre, Hab, Personas, `${Llegada} ${Hora}`, Total.toLocaleString('es-CO')]), Celularlimpio, Codigo, 'sistema->admin');
}

function Buscarreservacanallista(Hojareservas, Codigoreserva, Celularlimpio) {
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Est = String(Filas[I][15]);
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && (Est === 'Apartada' || Est === 'Verificando' || Est === 'En canal')) { return { fila: Filas[I], indice: I + 1 }; }
  }
  return { fila: null, indice: -1 };
}

function Abrircanaladministrador(Celularcliente, Codigoreserva, Motivo, Detalleextra, Resumenchat) {
  const Hojareservas = Obtenerhojareservas();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Ahoratexto = Formatearfechahora(new Date());
  const Convprevia = Obtenerestadoconversacion(Celularlimpio);
  const Busq = Buscarreservacanallista(Hojareservas, Codigoreserva, Celularlimpio);
  const Filareserva = Busq.fila, Indicefila = Busq.indice;
  const Codigo = Filareserva ? String(Filareserva[0]) : (Codigoreserva || 'SIN-CODIGO');
  const Nombreres = Filareserva ? String(Filareserva[2]) : '';
  const Nombre = (Nombreres && Nombreres !== 'Por confirmar') ? Nombreres : (Convprevia.nombre || 'Cliente');
  const Obsantes = Filareserva ? String(Filareserva[23] || '').trim() : '';

  if (Indicefila > 0) {
    Hojareservas.getRange(Indicefila, 16).setValue('En canal');
    if (Motivo === 'efectivo') { Hojareservas.getRange(Indicefila, 19).setValue('Efectivo'); }
    Hojareservas.getRange(Indicefila, 24).setValue(Sanitizarcelda(Obsantes ? `${Obsantes} · En canal (${Motivo})` : `En canal (${Motivo})`, 120));
  }

  const Motivofinal = Detalleextra || Motivo || 'Atención solicitada';
  const Resumenfinal = [Resumenchat, Obsantes].filter(Boolean).join(' · ');
  const Telguardar = Filareserva ? Normalizarcelularcolombiano(Filareserva[4]) : '';
  const Apertura = (Convprevia.modo === 'PendienteAdmin' && Convprevia.aperturacanal) ? Convprevia.aperturacanal : Ahoratexto;
  Actualizarconversacion(Celularlimpio, { nombre: Nombre, modo: 'PendienteAdmin', codigoreserva: Codigo, aperturacanal: Apertura, avisodemoracanal: '', ultimorecordatorioadmin: Ahoratexto, ultimorecordatoriocliente: Ahoratexto, motivorequerimiento: Motivofinal, resumencontexto: Resumenfinal, telefonocontacto: Telguardar || Convprevia.telefonocontacto });

  const Adminocupado = Obtenercanalesabiertos('Canal').length > 0;
  const Pendientes = Obtenercanalesabiertos('PendienteAdmin');
  const Pos = Pendientes.findIndex(function(C) { return C.celular === Celularlimpio; });
  const Turno = Pos >= 0 ? Pos + 1 : Math.max(1, Pendientes.length);

  let Msgcli = '';
  if (Adminocupado) {
    Msgcli = Motivo === 'efectivo'
      ? `Debido a que es pago en efectivo, necesitas atención con un administrador. En este momento está ocupado atendiendo a otro huésped; tienes el turno #${Turno} en espera. Apenas termine le llegará el aviso para atenderte por este chat.`
      : (Motivo === 'tiempo_correo' || Motivo === 'comprobante'
        ? `Encontramos una anomalía al validar tu comprobante de pago, por lo cual te transferiré con un administrador. En este momento está ocupado atendiendo a otro huésped; tienes el turno #${Turno} en espera y te atenderá apenas se desocupe.`
        : `En este momento el administrador está ocupado atendiendo a otro huésped. Tienes el turno #${Turno} en espera; apenas finalice esa conversación le llegará el aviso para conectarse contigo por este mismo chat.`);
  } else {
    Msgcli = Motivo === 'efectivo'
      ? 'Debido a que es pago en efectivo, te voy a comunicar con un administrador. Por favor permanece en línea en el chat mientras se conecta contigo.'
      : (Motivo === 'comprobante'
        ? 'Encontramos una anomalía al validar los datos de tu comprobante de pago, por lo cual te voy a transferir con un administrador para revisarlo contigo. Por favor permanece en línea en el chat.'
        : (Motivo === 'tiempo_correo' ? 'Un administrador revisará tu comprobante en breve y se conectará por este medio. Por favor permanece en línea en el chat.' : 'Perfecto, ya te comunico con el administrador, por favor espera en el chat.'));
    Enviartarjetaadminpendiente(Celularlimpio, Filareserva, { nombre: Nombre, codigoreserva: Codigo, resumen: Resumenfinal, resumencontexto: Resumenfinal, motivorequerimiento: Motivofinal }, Motivo, Pendientes.length, Turno > 1 ? `Turno #${Turno} · ` : '');
  }
  Enviarmensajewhatsapp(Celularlimpio, Msgcli);
  Registrarbitacora('Canal', Adminocupado ? 'EnColaPorCanalOcupado' : 'Solicitaradmin', `${Codigo} (${Motivo}) · Turno ${Turno}`);
  return { exito: true, codigo: Codigo, modo: 'PendienteAdmin', turno: Turno, adminocupado: Adminocupado, mensaje: Adminocupado ? `En espera por canal ocupado (turno #${Turno}).` : 'Solicitud enviada al administrador.' };
}

function Solicitaradministrador(Celularcliente, Codigoreserva, Motivo, Resumenchat) { return Abrircanaladministrador(Celularcliente, Codigoreserva, 'persona', Motivo || 'Solicitud de hablar con una persona', Resumenchat); }

function Procesarmensajeclienteencanal(Celularcliente, Mensaje) {
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Estadoconv = Obtenerestadoconversacion(Celularlimpio);
  const Campos = { ultimomensajecliente: Formatearfechahora(new Date()) };
  if (Estadoconv.modo === 'PendienteAdmin') {
    const Textoextra = (Mensaje.type === 'text' && Mensaje.text && Mensaje.text.body) ? Mensaje.text.body.trim() : `[Adjunto: ${Mensaje.type || 'archivo'}]`;
    Campos.resumencontexto = Estadoconv.resumencontexto ? `${Estadoconv.resumencontexto} | Cliente: ${Textoextra}`.slice(-400) : `Cliente: ${Textoextra}`;
    Actualizarconversacion(Celularlimpio, Campos);
    const Adminocupado = Obtenercanalesabiertos('Canal').length > 0;
    const Pendientes = Obtenercanalesabiertos('PendienteAdmin');
    const Indice = Pendientes.findIndex(function(C) { return C.celular === Celularlimpio; });
    const Turno = Indice >= 0 ? Indice + 1 : 1;
    if (Adminocupado) {
      Enviarmensajewhatsapp(Celularlimpio, `El administrador sigue atendiendo a otro huésped (tienes el turno #${Turno} en espera). Guardé tu mensaje para mostrárselo apenas se desocupe.`);
      return;
    }
    if (Mensaje.type === 'text' && Mensaje.text && Mensaje.text.body) {
      Guardarmapeomensajecanal(Enviarmensajewhatsapp(Credenciales.celularadmin, `[En espera] ${Estadoconv.nombre || 'Cliente'} (${Estadoconv.codigoreserva || Formatearnumerocomando(Celularlimpio)}) escribió: "${Textoextra}"\nResponde SI para iniciar la atención.`), Celularlimpio, Estadoconv.codigoreserva, 'cliente->admin');
    }
    Enviarmensajewhatsapp(Celularlimpio, 'Estamos buscando a un administrador disponible para atenderte, por favor permanece en línea en el chat.');
    return;
  }
  Actualizarconversacion(Celularlimpio, Campos);
  const Props = PropertiesService.getScriptProperties();
  if (!Props.getProperty('CANAL_ACTIVO_ADMIN') || Obtenercanalesabiertos('Canal').length <= 1) {
    Props.setProperty('CANAL_ACTIVO_ADMIN', Celularlimpio);
  }
  const Etiqueta = `${Estadoconv.nombre || 'Cliente'} (${Estadoconv.codigoreserva || 'Canal'}):`;
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
  const Lista = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 8).getValues().filter(function(F) {
    return Modofiltro ? String(F[2]) === Modofiltro : (F[2] === 'Canal' || F[2] === 'PendienteAdmin');
  }).map(function(F, Idx) {
    const Ms = F[6] ? new Date(F[6]).getTime() : 0;
    return { celular: Normalizaridwhatsapp(F[0]), nombre: String(F[1] || 'Cliente'), modo: String(F[2]), codigo: String(F[3] || ''), aperturams: isNaN(Ms) ? 0 : Ms, avisodemora: String(F[7] || ''), orden: Idx };
  });
  if (Modofiltro === 'PendienteAdmin') {
    Lista.sort(function(A, B) { return (A.aperturams - B.aperturams) || (A.orden - B.orden); });
  }
  return Lista;
}

function Buscarcitalistacanal(Idcitado, Lista) {
  const Hojamsg = Idcitado ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mensajescanal') : null;
  if (!Hojamsg || Hojamsg.getLastRow() < 2) { return ''; }
  const Filasmsg = Hojamsg.getRange(2, 1, Hojamsg.getLastRow() - 1, 3).getValues();
  for (let I = Filasmsg.length - 1; I >= 0; I--) {
    const Cel = Normalizaridwhatsapp(Filasmsg[I][1]);
    if (String(Filasmsg[I][0]) === String(Idcitado) && Lista.some(function(C) { return C.celular === Cel; })) { return Cel; }
  }
  return '';
}

function Resolverclientedestinoadmin(Mensaje, Modofiltro) {
  const Idcitado = Mensaje && Mensaje.context && Mensaje.context.id;
  const Lista = Obtenercanalesabiertos(Modofiltro);
  const Porcita = Buscarcitalistacanal(Idcitado, Lista);
  if (Porcita) { return Porcita; }
  if (Lista.length === 1) { return Lista[0].celular; }
  if (Modofiltro === 'PendienteAdmin') { return Lista.length ? Lista[0].celular : ''; }
  const Activo = PropertiesService.getScriptProperties().getProperty('CANAL_ACTIVO_ADMIN');
  return (Activo && Lista.some(function(C) { return C.celular === Activo; })) ? Activo : (Lista.length ? Lista[0].celular : '');
}

function Notificarsiguienteturnoadmin() {
  if (Obtenercanalesabiertos('Canal').length > 0) { return; }
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojaconv = Libro.getSheetByName('Conversaciones');
  const Credenciales = Obtenercredenciales();
  const Hojareservas = Obtenerhojareservas();
  if (Hojaconv && Hojaconv.getLastRow() >= 2) {
    const Numcols = Math.min(Math.max(Hojaconv.getLastColumn(), 13), 14);
    const Filas = Hojaconv.getRange(2, 1, Hojaconv.getLastRow() - 1, Numcols).getValues();
    Filas.forEach(function(F) {
      if (String(F[2]) === 'PendienteContacto' && String(F[7]) === 'PENDIENTE_AVISO_ADMIN') {
        const Celp = Normalizaridwhatsapp(F[0]), Numcmd = Formatearnumerocomando(Celp);
        const Idaviso = Enviarmensajeinteligente(Credenciales.celularadmin, `Espera vencida mientras atendías el canal anterior (${F[3] || 'Chat'}):\nCliente: ${F[1] || 'Cliente'} (${Numcmd})\nResumen: ${F[12] || F[11] || 'Solicitó atención'}\nPara contactarlo, escribe: abrir canal con ${Numcmd}`, '', []);
        Guardarmapeomensajecanal(Idaviso, Celp, String(F[3] || ''), 'sistema->admin');
        Actualizarconversacion(Celp, { avisodemoracanal: 'TIMEOUT_15M' });
      }
    });
  }
  const Pendientes = Obtenercanalesabiertos('PendienteAdmin');
  if (!Pendientes.length) { return; }
  const Sig = Pendientes[0], Conv = Obtenerestadoconversacion(Sig.celular);
  const Busq = Buscarreservacanallista(Hojareservas, Conv.codigoreserva, Sig.celular);
  const Ahorams = Date.now(), Ahoratxt = Formatearfechahora(new Date(Ahorams));
  const Limiteespera = Number(Leerconfiguracionhoja().MINUTOSESPERAADMIN || 15);
  const Minapertura = Ahorams - Math.max(Limiteespera - 5, 1) * 60000;
  const Aperturanueva = (!Sig.aperturams || Sig.aperturams < Minapertura) ? Formatearfechahora(new Date(Minapertura)) : Conv.aperturacanal;
  Actualizarconversacion(Sig.celular, { ultimorecordatorioadmin: Ahoratxt, aperturacanal: Aperturanueva });
  Enviartarjetaadminpendiente(Sig.celular, Busq.fila, Conv, '', Pendientes.length, 'Siguiente en turno · ');
}

function Procesarmensajeadministrador(Mensaje) {
  const Credenciales = Obtenercredenciales();
  const Textocrudo = (Mensaje.type === 'text' && Mensaje.text && Mensaje.text.body) ? Mensaje.text.body.trim() : '';
  const Comando = Normalizarcomandoadmin(Textocrudo);
  const Matchhab = Comando.match(/^habilitar\s+(?:la\s+)?habitacion\s+(\d{1,2})$/);
  if (Matchhab) {
    const Numhab = String(Matchhab[1]).padStart(2, '0');
    if (!Eshabitacionhabilitada(Numhab)) { return Enviarmensajewhatsapp(Credenciales.celularadmin, `La habitación ${Numhab} no está habilitada para operación (solo 01, 02, 04, 05 y 06).`); }
    const Reshab = Gestionarlimpiezahabitacion(Numhab, true);
    return Enviarmensajewhatsapp(Credenciales.celularadmin, Reshab.exito ? `¡Listo! La habitación ${Numhab} quedó habilitada como Disponible. Ya puedo volver a ofrecerla y detuve los avisos de limpieza.` : (Reshab.mensaje || `No se pudo habilitar la habitación ${Numhab}.`));
  }
  if (Comando === 'canales') {
    const Pend = Obtenercanalesabiertos('PendienteAdmin'), Activos = Obtenercanalesabiertos('Canal');
    if (!Pend.length && !Activos.length) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay canales abiertos ni pendientes en este momento.'); }
    const Lista = Activos.map(function(C) { return `- ${C.codigo}: ${C.nombre} (${Formatearnumerocomando(C.celular)}) · En chat`; })
      .concat(Pend.map(function(C, I) { return `- ${C.codigo}: ${C.nombre} (${Formatearnumerocomando(C.celular)}) · Turno #${I + 1} en espera`; })).join('\n');
    return Enviarmensajewhatsapp(Credenciales.celularadmin, `Canales (${Activos.length + Pend.length}):\n${Lista}`);
  }
  const Matchabrir = Textocrudo.replace(/^-\s*/, '').match(/^abrir\s+canal\s+con\s+(.+)$/i);
  if (Matchabrir) {
    const Celobjetivo = Buscaridclientepornumero(Matchabrir[1]);
    if (!Celobjetivo) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'Indica un número válido, por ejemplo: abrir canal con 3209014142'); }
    const Ahoratxt = Formatearfechahora(new Date()), Numcmd = Formatearnumerocomando(Celobjetivo);
    Actualizarconversacion(Celobjetivo, { modo: 'Canal', aperturacanal: Ahoratxt, ultimomensajeadmin: Ahoratxt, avisodemoracanal: '' });
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celobjetivo);
    Enviarmensajewhatsapp(Credenciales.celularadmin, `Canal con el cliente ${Numcmd} establecido. Todo lo que escribas será redirigido directamente.\n\nComandos de cierre:\n- reserva confirmada finalizar\n- reserva rechazada finalizar`);
    Enviarmensajewhatsapp(Celobjetivo, '¡Hola! Un administrador de Hospedaje Nissi se acaba de conectar a este chat para atender tu solicitud directamente.');
    return Registrarbitacora('Canal', 'AdminAbrioCanalManual', `Admin abrió canal manual con ${Celobjetivo}`);
  }
  const Canalesactivos = Obtenercanalesabiertos('Canal'), Idcitado = Mensaje && Mensaje.context && Mensaje.context.id;
  const Citapendiente = Idcitado ? Buscarcitalistacanal(Idcitado, Obtenercanalesabiertos('PendienteAdmin')) : '';
  if (Comando === 'si' && (Canalesactivos.length === 0 || Citapendiente)) {
    const Celpendiente = Citapendiente || Resolverclientedestinoadmin(Mensaje, 'PendienteAdmin');
    if (!Celpendiente) { return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay ningún cliente pendiente por iniciar atención. Escribe "canales" para verificar.'); }
    const Convp = Obtenerestadoconversacion(Celpendiente), Ahoracanal = Formatearfechahora(new Date());
    Actualizarconversacion(Celpendiente, { modo: 'Canal', aperturacanal: Ahoracanal, ultimomensajeadmin: Ahoracanal, avisodemoracanal: '' });
    PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celpendiente);
    Enviarmensajewhatsapp(Credenciales.celularadmin, `Hablando con "${Convp.nombre || 'Cliente'}" (${Convp.codigoreserva || 'Canal'}). Todo lo que escribas le llegará directo.\nComandos de cierre:\n- reserva confirmada finalizar\n- reserva rechazada finalizar`);
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
    if (Pendientes.length) { const P = Pendientes[0]; return Enviarmensajewhatsapp(Credenciales.celularadmin, `Tienes pendiente atender a "${P.nombre}" (${P.codigo}, Turno #1). Responde SI para iniciar.`); }
    return Enviarmensajewhatsapp(Credenciales.celularadmin, 'No hay ningún canal abierto activo. Escribe "canales" para verificar.');
  }
  if (Comando === 'reserva confirmada finalizar') { return Cerrarcanalyactualizarreserva(Celulardestino, true, 'administrador'); }
  if (Comando === 'reserva rechazada finalizar') { return Cerrarcanalyactualizarreserva(Celulardestino, false, 'administrador'); }
  PropertiesService.getScriptProperties().setProperty('CANAL_ACTIVO_ADMIN', Celulardestino);
  Actualizarconversacion(Celulardestino, { ultimomensajeadmin: Formatearfechahora(new Date()) });
  if (Mensaje.type === 'text' && Textocrudo) { Enviarmensajewhatsapp(Celulardestino, Textocrudo); }
  else if (Mensaje.type === 'image' && Mensaje.image) { Reenviarmediawhatsapp(Celulardestino, 'image', Mensaje.image.id, ''); }
  else if ((Mensaje.type === 'audio' || Mensaje.type === 'voice') && (Mensaje.audio || Mensaje.voice)) { Reenviarmediawhatsapp(Celulardestino, 'audio', (Mensaje.audio || Mensaje.voice).id, ''); }
  else if (Mensaje.type === 'document' && Mensaje.document) { Reenviarmediawhatsapp(Celulardestino, 'document', Mensaje.document.id, ''); }
}

function Cerrarcanalyactualizarreserva(Celularcliente, Confirmar, Origen) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet(), Hojareservas = Obtenerhojareservas(), Hojahab = Libro.getSheetByName('Habitaciones');
  const Credenciales = Obtenercredenciales(), Conv = Obtenerestadoconversacion(Celularcliente), Filas = Hojareservas.getDataRange().getValues();
  let Fila = null, Indice = -1;
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Est = String(Filas[I][15]);
    if (Coincidereservacliente(Filas[I], Conv.codigoreserva, Conv.celular) && (Est === 'En canal' || Est === 'Apartada' || Est === 'Verificando')) {
      Fila = Filas[I]; Indice = I + 1; break;
    }
  }
  const Codigo = Fila ? String(Fila[0]) : (Conv.codigoreserva || 'NS-0000'), Nombre = Fila ? String(Fila[2]) : (Conv.nombre || 'Viajero');
  const Cedula = Fila ? String(Fila[3] || '') : '';
  const Hab = Fila ? String(Fila[5]).padStart(2, '0') : '01', Llegada = Fila ? Normalizarfecha(Fila[6]) : '', Salida = Fila ? Normalizarfecha(Fila[7]) : '';
  const Hora = Fila ? String(Fila[10] || 'Por confirmar') : 'Por confirmar', Total = Fila ? Number(Fila[11] || 0) : 0;

  if (Confirmar && Indice > 0) {
    Hojareservas.getRange(Indice, 15).setValue(Fila[14] || 'Efectivo'); Hojareservas.getRange(Indice, 16).setValue('Confirmada');
    Hojareservas.getRange(Indice, 24).setValue('Confirmada por el administrador en canal'); Cambiarocupacionhabitacion(Hojahab, Hab, 'Ocupada');
    const Horacheckout = Formatearhoradoce(Number(Leerconfiguracionhoja().HORACHECKOUT || 11));
    Notificarreservaconfirmada({
      codigo: Codigo, habitacion: Hab, canal: String(Fila[16] || 'WhatsApp'), nombre: Nombre, cedula: Cedula,
      celular: Obtenercelularlegiblereserva(Fila), idwhatsapp: Conv.celular, llegada: Llegada, salida: Salida,
      noches: Number(Fila[8] || 1), personas: Number(Fila[9] || 1), horallegada: Hora, horasalida: String(Fila[24] || Horacheckout), total: Total, pagado: Number(Fila[12] || 0),
      entidad: Fila[14] || 'Efectivo', referencia: 'Confirmada en canal privado', observaciones: String(Fila[23] || ''),
      mensajecliente: `El administrador ha confirmado tu reserva ${Codigo} en Hospedaje Nissi.\nHabitación ${Hab} · ${Llegada} al ${Salida} · Llegada ${Hora} · Check-out ${Horacheckout} · Total $${Total.toLocaleString('es-CO')} COP.`
    });
  } else if (Indice > 0) {
    Hojareservas.getRange(Indice, 16).setValue('Rechazada'); Hojareservas.getRange(Indice, 24).setValue(`Cerrada sin confirmar (${Origen || 'admin'})`);
    Cambiarocupacionhabitacion(Hojahab, Hab, 'Disponible');
    Enviarmensajeinteligente(Conv.celular, 'Tu reserva no ha sido confirmada en esta ocasión, pero puedes seguir contando con Hospedaje Nissi. Cuando quieras, vuelve a escribirnos por este mismo chat.', 'reserva_no_confirmada_cliente', [Nombre, Codigo]);
    if (typeof Notificaresperahabitacion === 'function') { Notificaresperahabitacion(Hab); }
  }
  Actualizarconversacion(Conv.celular, { modo: 'IA', aperturacanal: '', avisodemoracanal: '' });
  const Props = PropertiesService.getScriptProperties();
  if (Props.getProperty('CANAL_ACTIVO_ADMIN') === Conv.celular) { Props.deleteProperty('CANAL_ACTIVO_ADMIN'); }
  Enviarmensajewhatsapp(Credenciales.celularadmin, `Canal ${Codigo} cerrado: reserva ${Confirmar ? 'confirmada' : 'rechazada'}. En espera: ${Obtenercanalesabiertos('PendienteAdmin').length}.`);
  Registrarbitacora('Canal', 'Cerrarcanal', `${Codigo} -> ${Confirmar ? 'Confirmada' : 'Rechazada'}`);
  Notificarsiguienteturnoadmin();
}
