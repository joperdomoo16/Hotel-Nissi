// Notificaciones de reserva confirmada (WhatsApp + correo HTML), recordatorio de check-out e informe diario

function Enviarcorreoreservaconfirmada(Datos) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin || MailApp.getRemainingDailyQuota() <= Datoscorreo.reservacuotacorreo) { return; }

  const Total = Number(Datos.total || 0);
  const Pagado = Number(Datos.pagado || 0);
  const Saldo = Math.max(0, Total - Pagado);
  const Horacheckout = Number(Leerconfiguracionhoja().HORACHECKOUT || 11);
  const Horasalida = Datos.horasalida || Formatearhoradoce(Horacheckout);
  const Huespedtexto = Datos.cedula ? `${Datos.nombre || 'Viajero'} · C.C. ${Datos.cedula}` : (Datos.nombre || 'Viajero');

  const Html = Rellenarplantilla(Cargarplantilla('Correoreservaconfirmada'), {
    CODIGO: Datos.codigo || 'NS-0000', HABITACION: String(Datos.habitacion || '01').padStart(2, '0'),
    FECHACONFIRMACION: Formatearfechahora(new Date()).slice(0, 16), CANAL: Datos.canal || 'WhatsApp',
    TOTAL: Formatearpesos(Total), PAGADO: Formatearpesos(Pagado), MEDIOPAGO: Datos.entidad || 'Efectivo',
    REFERENCIA: Datos.referencia || 'Confirmación directa', SALDO: Formatearpesos(Saldo), HUESPED: Huespedtexto,
    CELULAR: Datos.celular || 'No registrado', LLEGADA: Datos.llegada || '', SALIDA: Datos.salida || '',
    NOCHES: String(Datos.noches || 1), PERSONAS: String(Datos.personas || 1),
    CAMAS: Datos.camas || 'Según tarifa aplicada', HORALLEGADA: Datos.horallegada || 'Por confirmar',
    HORASALIDA: Horasalida, OBSERVACIONES: Datos.observaciones || 'Ninguna'
  }, {});

  const Textoplano =
    `Nueva reserva confirmada · ${Datos.codigo}\n` +
    `Habitación: ${Datos.habitacion} · Huésped: ${Huespedtexto} (${Datos.celular})\n` +
    `Estadía: ${Datos.llegada} al ${Datos.salida} (${Datos.noches} noche/s) · ${Datos.personas} persona(s)\n` +
    `Llegada: ${Datos.horallegada} · Check-out: ${Horasalida}\n` +
    `Total: $${Formatearpesos(Total)} COP · Pagado: $${Formatearpesos(Pagado)} COP (${Datos.entidad}) · Saldo: $${Formatearpesos(Saldo)} COP`;

  MailApp.sendEmail({
    to: Credenciales.correoadmin,
    subject: `Reserva confirmada · ${Datos.codigo} · Hab. ${Datos.habitacion} · ${Datos.nombre}`,
    htmlBody: Html,
    body: Textoplano,
    name: `${Datoscorreo.remitente} · Recepción`
  });
}

function Notificarreservaconfirmada(Datos) {
  const Hab = String(Datos.habitacion || '01').padStart(2, '0');
  const Total = Number(Datos.total || 0);
  const Pagado = Number(Datos.pagado || 0);
  const Saldo = Math.max(0, Total - Pagado);
  const Horacheckout = Formatearhoradoce(Number(Leerconfiguracionhoja().HORACHECKOUT || 11));
  const Destinocliente = Datos.idwhatsapp || Datos.celular;

  if (Destinocliente && Datos.enviarcliente !== false) {
    const Rutas = `\n\nCómo llegar a Hospedaje Nissi (Mingueo):\n- Google Maps: https://maps.app.goo.gl/TudMNAdQRpVyzHZGA\n- Waze: ${Datoscorreo.urlwaze}`;
    const Preguntarecibo = '\n\n¿Requieres un recibo de caja?';
    const Msgbase = Datos.mensajecliente ||
      `Tu reserva ${Datos.codigo} está confirmada en Hospedaje Nissi.\n` +
      `Habitación ${Hab} · ${Datos.llegada} al ${Datos.salida} · Llegada ${Datos.horallegada || 'Por confirmar'}.\n` +
      `Check-out: ${Horacheckout}.\n` +
      `Total: $${Total.toLocaleString('es-CO')} COP · Pagado: $${Pagado.toLocaleString('es-CO')} COP · Saldo: $${Saldo.toLocaleString('es-CO')} COP.\n` +
      `Te esperamos en Mingueo.`;
    const Msgconrutas = Msgbase.indexOf('maps.app.goo.gl') !== -1 ? Msgbase : `${Msgbase}${Rutas}`;
    const Msgcliente = /recibo de caja/i.test(Msgconrutas) ? Msgconrutas : `${Msgconrutas}${Preguntarecibo}`;
    Enviarmensajeinteligente(Destinocliente, Msgcliente, 'reserva_confirmada_cliente', [Datos.nombre || 'Viajero', Datos.codigo]);
  }

  const Huespedresumen = Datos.cedula ? `${Datos.nombre} (C.C. ${Datos.cedula})` : Datos.nombre;
  const Resumenadmin =
    `Reserva confirmada · ${Datos.codigo}\n` +
    `Habitación: ${Hab}\nHuésped: ${Huespedresumen}\nCelular: ${Datos.celular}\n` +
    `Estadía: ${Datos.llegada} al ${Datos.salida} (${Datos.noches} noche${Number(Datos.noches) > 1 ? 's' : ''}) · ${Datos.personas} persona(s)\n` +
    `Llegada: ${Datos.horallegada || 'Por confirmar'} · Check-out: ${Horacheckout}\n` +
    (Datos.observaciones ? `Detalles: ${Datos.observaciones}\n` : '') +
    `Total: $${Total.toLocaleString('es-CO')} · Pagado: $${Pagado.toLocaleString('es-CO')} (${Datos.entidad || 'Efectivo'} · ref. ${Datos.referencia || 'N/A'})\n` +
    `Saldo por cobrar: $${Saldo.toLocaleString('es-CO')}`;

  const Numerocmd = Normalizarcelularcolombiano(Datos.celular) || Formatearnumerocomando(Destinocliente || Datos.celular);
  const AvisoNequi = (Datos.idimagencaptura || Datos.requiererevisionnequi)
    ? `\n\nRecuerda revisar en los movimientos de tu app Nequi para confirmar este ingreso.\nSi ves alguna anomalía, contáctalo abriendo canal con el comando:\nabrir canal con ${Numerocmd}`
    : '';
  const Cred = Obtenercredenciales();
  let Enviadaconimagen = false;
  if (Datos.idimagencaptura && Cred.celularadmin && typeof Reenviarmediawhatsapp === 'function') {
    const Idimg = Reenviarmediawhatsapp(Cred.celularadmin, 'image', Datos.idimagencaptura, `${Resumenadmin}${AvisoNequi}`);
    if (Idimg) { Guardarmapeomensajecanal(Idimg, Destinocliente, Datos.codigo, 'sistema->admin'); Enviadaconimagen = true; }
  }
  if (!Enviadaconimagen) {
    Notificaradministradorwhatsapp(`${Resumenadmin}${AvisoNequi}`, [
      Datos.codigo, Hab, Datos.nombre, Datos.cedula || '-', Datos.celular, Datos.llegada, Datos.salida, Datos.personas,
      Datos.horallegada || 'Por confirmar', Total.toLocaleString('es-CO'), Pagado.toLocaleString('es-CO'),
      Datos.entidad || 'Efectivo', Datos.referencia || '-', Saldo.toLocaleString('es-CO')
    ]);
  }

  try {
    Enviarcorreoreservaconfirmada(Datos);
  } catch (Errorcorreo) {
    Registrarbitacora('Correos', 'ErrorReservaConfirmada', String(Errorcorreo));
  }
}

function Probarcorreoreservaconfirmada() {
  Enviarcorreoreservaconfirmada({
    codigo: 'NS-TEST', habitacion: '01', canal: 'WhatsApp', total: 90000, pagado: 90000, entidad: 'Nequi', referencia: 'M984512',
    nombre: 'Jorge Perdomo', cedula: '1014305605', celular: '3233238955', llegada: '2026-11-18', salida: '2026-11-19',
    noches: 1, personas: 2, camas: '2 personas en camas individuales', horallegada: '8:00 p. m.', observaciones: 'Parqueadero: Sí (1 carro)'
  });
}

function Enviarrecordatoriocheckout() {
  const Hojareservas = Obtenerhojareservas();
  if (!Hojareservas || Hojareservas.getLastRow() < 2) { return; }
  const Config = Leerconfiguracionhoja(), Horacheckout = Number(Config.HORACHECKOUT || 11), Valorhora = Number(Config.VALORHORAADICIONAL || 10000);
  const Ahora = new Date(), Horaactual = parseInt(Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'HH'), 10);
  if (Horaactual !== Horacheckout - 1) { return; }
  const Hoytexto = Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  const Filas = Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, 28).getValues();
  for (let I = 0; I < Filas.length; I++) {
    if (String(Filas[I][15]) !== 'Confirmada' || Normalizarfecha(Filas[I][7]) !== Hoytexto) { continue; }
    const Obs = String(Filas[I][23] || '');
    if (Obs.indexOf('Recordatorio checkout') !== -1) { continue; }
    const Destinowa = Obtenerdestinowhatsappreserva(Filas[I]);
    if (!Destinowa) { continue; }
    const Nombre = Primernombre(Filas[I][2]) || 'huésped', Hab = String(Filas[I][5]).padStart(2, '0'), Horabonita = Formatearhoradoce(Horacheckout);
    const Msg = `Buenos días, ${Nombre}. Desde la recepción de Hospedaje Nissi te recordamos que el check-out de tu habitación ${Hab} es hoy a las ${Horabonita}.\n\n` +
      `Si deseas quedarte más tiempo, respóndenos por este chat a qué hora piensas salir para hacer el ajuste. Cada hora adicional tiene un valor de $${Valorhora.toLocaleString('es-CO')} COP (puedes pagarlo por transferencia o en efectivo al salir).`;
    Enviarmensajeinteligente(Destinowa, Msg, 'recordatorio_checkout', [Nombre, Hab, Horabonita, Valorhora.toLocaleString('es-CO')]);
    Hojareservas.getRange(I + 2, 24).setValue(Sanitizarcelda(Obs ? `${Obs} · Recordatorio checkout` : 'Recordatorio checkout', 140));
    Registrarbitacora('Checkout', 'Recordatorio1h', `Enviado a Hab ${Hab} (${Filas[I][0]})`);
  }
}

function Enviarinformecorreodiario() {
  if (typeof Liberarhabitacionesvencidas === 'function') { Liberarhabitacionesvencidas(); }
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin) { return; }
  const Libro = SpreadsheetApp.getActiveSpreadsheet(), Zonalibro = Libro.getSpreadsheetTimeZone();
  const Filashab = Libro.getSheetByName('Habitaciones').getDataRange().getValues().slice(1);
  const Filasres = Obtenerhojareservas().getDataRange().getValues().slice(1), Hojausuarios = Libro.getSheetByName('Usuarios');
  const Ahora = new Date(), Hoy = Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'yyyy-MM-dd');
  let Recaudo = 0, Confirmadas = 0, Pendientes = 0, Nuevosusuarios = 0;
  const Llegadas = [], Salidas = [];
  Filasres.forEach(function(Fila) {
    const Reg = Normalizarfecha(Fila[1]), Llegada = Normalizarfecha(Fila[6]), Salida = Normalizarfecha(Fila[7]);
    const Estado = String(Fila[15]), Pagado = Number(Fila[12] || 0), Valida = Estado === 'Confirmada' || Estado === 'Finalizada';
    if (Reg === Hoy && Valida) { Recaudo += Pagado; Confirmadas++; }
    if ((Estado === 'Pendiente' || Estado === 'Apartada' || Estado === 'Verificando') && (!Llegada || Llegada >= Hoy)) { Pendientes++; }
    if (Llegada === Hoy && Estado === 'Confirmada') { Llegadas.push(Fila); }
    if (Salida === Hoy && Valida) { Salidas.push(Fila); }
  });
  if (Hojausuarios && Hojausuarios.getLastRow() > 1) {
    Hojausuarios.getRange(2, 5, Hojausuarios.getLastRow() - 1, 1).getValues().forEach(function(F) { if (Normalizarfecha(F[0]) === Hoy) { Nuevosusuarios++; } });
  }
  const Totalhab = Filashab.length, Ocupadas = Filashab.filter(function(H) { return String(H[5]) === 'Ocupada'; }).length;
  const Porcentaje = Totalhab ? Math.round((Ocupadas / Totalhab) * 100) : 0;
  const Diasemana = Diassemanacorreo[Number(Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'u')) - 1];
  const Fechacorta = `${Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'd')} de ${Mesescorreo[Number(Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'M')) - 1]}`;
  const Textoconfirmadas = Confirmadas === 0 ? 'Aún no hay reservas confirmadas hoy.' : `${Confirmadas} reserva${Confirmadas === 1 ? '' : 's'} confirmada${Confirmadas === 1 ? '' : 's'} hoy.`;
  const Html = Rellenarplantilla(Cargarplantilla('Informediario'), {
    DIASEMANA: Diasemana, FECHACORTA: Fechacorta, HORAGENERADO: Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'HH:mm'),
    RECAUDO: Formatearpesos(Recaudo), TEXTOCONFIRMADAS: Textoconfirmadas, OCUPADAS: Ocupadas, TOTALHAB: Totalhab,
    PORCENTAJE: Porcentaje, LLEGADAS: Llegadas.length, SALIDAS: Salidas.length, PENDIENTES: Pendientes, NUEVOSUSUARIOS: Nuevosusuarios
  }, {
    BARRA: Construirbarraocupacion(Porcentaje), HABITACIONES: Construirfilashabitaciones(Filashab),
    LLEGADAS: Construirtarjetasmovimiento(Llegadas, 'llegada', Zonalibro), SALIDAS: Construirtarjetasmovimiento(Salidas, 'salida', Zonalibro)
  });
  MailApp.sendEmail({
    to: Credenciales.correoadmin, subject: `Informe diario · ${Diasemana} ${Fechacorta} · $${Formatearpesos(Recaudo)} COP`,
    htmlBody: Html, body: `Informe diario Hospedaje Nissi (${Hoy})\nRecaudo validado hoy: $${Formatearpesos(Recaudo)} COP (${Textoconfirmadas})\nOcupación: ${Ocupadas}/${Totalhab} · Llegadas: ${Llegadas.length} · Salidas: ${Salidas.length}`,
    name: `${Datoscorreo.remitente} · Recepción`
  });
}

function Construirbarraocupacion(Porcentaje) {
  const Celda = function(Ancho, Color, Radio) { return `<td width="${Ancho}%" height="6" bgcolor="${Color}" style="background:${Color};height:6px;font-size:0;line-height:0;border-radius:${Radio};">&nbsp;</td>`; };
  const Celdas = Porcentaje <= 0 ? Celda(100, '#2A2D20', '6px') : (Porcentaje >= 100 ? Celda(100, '#4DD678', '6px') : Celda(Porcentaje, '#4DD678', '6px 0 0 6px') + Celda(100 - Porcentaje, '#2A2D20', '0 6px 6px 0'));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>${Celdas}</tr></table>`;
}

function Construirfilashabitaciones(Filashab) {
  return Filashab.map(function(Hab) {
    const Est = String(Hab[5]);
    const Fondo = Est === 'Ocupada' ? '#EBD3C6' : (Est === 'Mantenimiento' ? '#DEDAD0' : (Est === 'Apartada' ? '#F5E4B8' : (Est === 'Limpieza' ? '#D6EAF8' : '#DDE2CC')));
    const Color = Est === 'Ocupada' ? '#8C3B1F' : (Est === 'Mantenimiento' ? '#5A5C4E' : (Est === 'Apartada' ? '#8A5A00' : (Est === 'Limpieza' ? '#1B4F72' : '#4F5A2E')));
    const Etiqueta = Est === 'Mantenimiento' ? 'En rediseño' : (Est === 'Limpieza' ? 'Pendiente de limpieza' : Est), Borde = 'border-top:1px solid #D9CDB5;';
    return `<tr><td width="56" valign="middle" style="width:56px;padding:14px 0;${Borde}font-family:${Fuenteserif};font-size:26px;line-height:28px;font-weight:300;color:#1A1C13;">${Escaparhtmlservidor(String(Hab[0]).padStart(2, '0'))}</td>` +
      `<td valign="middle" style="padding:14px 0;${Borde}font-family:${Fuentesans};font-size:14px;line-height:20px;color:#3A3C30;"><strong style="color:#1A1C13;font-weight:600;">${Escaparhtmlservidor(Hab[1])}</strong><br><span style="font-size:12px;color:#5A5C4E;">${Escaparhtmlservidor(Hab[2])}</span></td>` +
      `<td valign="middle" align="right" style="padding:14px 0;${Borde}"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${Fondo};font-family:${Fuentesans};font-size:12px;line-height:16px;font-weight:600;color:${Color};">${Escaparhtmlservidor(Etiqueta)}</span></td></tr>`;
  }).join('');
}

function Construirtarjetasmovimiento(Filas, Tipo, Zonalibro) {
  if (!Filas.length) {
    return `<p style="margin:0;padding:18px 20px;border-radius:16px;background:#E7DCC6;font-family:${Fuentesans};font-size:14px;line-height:20px;color:#5A5C4E;">${Tipo === 'llegada' ? 'No hay llegadas programadas para hoy.' : 'No hay salidas programadas para hoy.'}</p>`;
  }
  return Filas.map(function(Fila) {
    const Total = Number(Fila[11] || 0), Pagado = Number(Fila[12] || 0), Saldo = Math.max(0, Total - Pagado);
    const Entidad = String(Fila[14] || '').trim(), Referencia = String(Fila[13] || '').trim();
    const Detallehora = Tipo === 'llegada' ? Formatearhora(Fila[10], Zonalibro) : (Fila[24] ? `Hasta ${Fila[24]}` : 'Antes de 11:00');
    const Huespedtexto = Fila[3] ? `${Fila[2]} · C.C. ${Fila[3]}` : Fila[2];
    let Detallepago = `Pagó <strong style="color:#8C3B1F;">$${Formatearpesos(Pagado)} COP</strong>`;
    if (Entidad) { Detallepago += ` · ${Escaparhtmlservidor(Entidad)}`; }
    if (Referencia) { Detallepago += ` · Ref. ${Escaparhtmlservidor(Referencia)}`; }
    if (Saldo > 0) { Detallepago += `<br><strong style="color:#1A1C13;">Saldo por cobrar: $${Formatearpesos(Saldo)} COP</strong>`; }
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E7DCC6" style="background:#E7DCC6;border-radius:16px;margin-bottom:10px;"><tr><td style="padding:18px 20px;font-family:${Fuentesans};">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:11px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:#5A5C4E;">Hab. ${Escaparhtmlservidor(String(Fila[5]).padStart(2, '0'))} · ${Escaparhtmlservidor(Fila[0])}</td><td align="right" style="font-size:13px;line-height:16px;font-weight:600;color:#1A1C13;">${Escaparhtmlservidor(Detallehora)}</td></tr></table>` +
      `<span style="display:block;margin-top:8px;font-family:${Fuenteserif};font-size:21px;line-height:25px;color:#1A1C13;">${Escaparhtmlservidor(Huespedtexto)}</span>` +
      `<span style="display:block;margin-top:4px;font-size:13px;line-height:19px;color:#3A3C30;">Cel. ${Escaparhtmlservidor(Obtenercelularlegiblereserva(Fila))} · ${Detallepago}</span></td></tr></table>`;
  }).join('');
}

function Probarinformediario() { Enviarinformecorreodiario(); }

function Enviarcorreocontactopendiente(Datos) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin || MailApp.getRemainingDailyQuota() <= Datoscorreo.reservacuotacorreo) { return; }
  const Html = Rellenarplantilla(Cargarplantilla('Correocontactopendiente'), {
    NOMBRE: Datos.nombre || 'Cliente', CELULAR: Datos.numerocomando || Datos.celular || '-', CODIGO: Datos.codigo || 'SIN-CODIGO',
    FECHA: Formatearfechahora(new Date()).slice(0, 16), MOTIVO: Datos.motivo || 'Atención con recepción',
    RESUMEN: Datos.resumen || 'El cliente solicitó hablar con un administrador y esperó 15 minutos sin respuesta.',
    HABITACION: Datos.habitacion || '--', FECHASESTADIA: Datos.fechasestadia || 'Por definir',
    PERSONAS: String(Datos.personas || 'Por definir'), COMANDOABRIR: Datos.comandoabrir
  }, {});
  const Textoplano = `URGENTE · Contacto pendiente (${Datos.codigo || 'Chat'})\nCliente: ${Datos.nombre} (${Datos.numerocomando})\nRequerimiento: ${Datos.motivo}\nResumen: ${Datos.resumen}\n\nPara contactar al cliente de inmediato, escribe en WhatsApp:\n${Datos.comandoabrir}`;
  MailApp.sendEmail({ to: Credenciales.correoadmin, subject: `URGENTE · Atención pendiente: ${Datos.nombre} (${Datos.numerocomando}) · Hospedaje Nissi`, htmlBody: Html, body: Textoplano, name: `${Datoscorreo.remitente} · Recepción` });
}

function Buscarcontextoreserva(Hojares, Codres, Celcliente) {
  if (!Hojares || Hojares.getLastRow() < 2) { return { habitacion: '--', fechasestadia: 'Por definir', personas: 'Por definir', obs: '' }; }
  const Filas = Hojares.getDataRange().getValues();
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (Coincidereservacliente(Filas[I], Codres, Celcliente)) {
      return { habitacion: String(Filas[I][5] || '--').padStart(2, '0'), fechasestadia: `${Normalizarfecha(Filas[I][6])} al ${Normalizarfecha(Filas[I][7])}`, personas: `${Number(Filas[I][9] || 1)} persona(s)`, obs: String(Filas[I][23] || '').trim() };
    }
  }
  return { habitacion: '--', fechasestadia: 'Por definir', personas: 'Por definir', obs: '' };
}

function Revisarllegadasclientes() {
  const Hojares = Obtenerhojareservas();
  if (!Hojares || Hojares.getLastRow() < 2) { return; }
  const Cred = Obtenercredenciales(), Ahorams = Date.now(), Zona = Parametrosistema.zonahoraria;
  const Hoy = Utilities.formatDate(new Date(Ahorams), Zona, 'yyyy-MM-dd');
  const Ayer = Utilities.formatDate(new Date(Ahorams - 86400000), Zona, 'yyyy-MM-dd');
  const Filas = Hojares.getRange(2, 1, Hojares.getLastRow() - 1, 28).getValues();
  for (let I = 0; I < Filas.length; I++) {
    if (String(Filas[I][15]) !== 'Confirmada') { continue; }
    const Lleg = Normalizarfecha(Filas[I][6]);
    if (Lleg !== Hoy && Lleg !== Ayer) { continue; }
    const Tlleg = Parsearfechahorallegada(Lleg, Filas[I][10]);
    if (!Tlleg) { continue; }
    const Regms = Filas[I][1] ? new Date(Filas[I][1]).getTime() : 0;
    if (String(Filas[I][16]) === 'Recepcion' && Regms && (Tlleg - Regms) < 15 * 60000) { continue; }
    const Cod = String(Filas[I][0]), Est = Leerestadollegada(Cod);
    if (Est.ok) { continue; }
    const Dest = Obtenerdestinowhatsappreserva(Filas[I]), Hab = String(Filas[I][5]).padStart(2, '0');
    if (!Dest) { continue; }
    const Nom = Primernombre(Filas[I][2]) || String(Filas[I][2] || 'huésped');
    const Horatxt = Filas[I][10] instanceof Date ? Utilities.formatDate(Filas[I][10], Zona, 'h:mm a') : String(Filas[I][10] || '');
    const Diff = (Ahorams - Tlleg) / 60000;
    let Cambio = false;
    if (Diff >= -60 && Diff < -20 && !Est.h60 && (!Regms || (Tlleg - Regms) > 25 * 60000)) {
      Enviarmensajewhatsapp(Dest, `Hola ${Nom}, te recordamos desde la recepción de Hospedaje Nissi que tu reserva ${Cod} (Habitación ${Hab}) es hoy a las ${Horatxt} (en 1 hora). Si tienes algún inconveniente o cambio en tu llegada, por favor escríbenos por este mismo chat.`);
      Est.h60 = 1; Cambio = true;
    } else if (Diff >= -15 && Diff < 0 && !Est.m15) {
      Enviarmensajewhatsapp(Dest, `Hola ${Nom}, te recordamos que faltan 15 minutos para tu hora de llegada (${Horatxt}) en Hospedaje Nissi (reserva ${Cod}, Habitación ${Hab}). Si tienes algún inconveniente, escríbenos por este chat.`);
      Est.m15 = 1; Cambio = true;
    } else if (Diff >= 10 && Diff < 60 && !Est.p10) {
      Enviarmensajewhatsapp(Dest, `Hola ${Nom}, ya pasaron 10 minutos desde tu hora de reserva (${Horatxt}) para la habitación ${Hab} (${Cod}). ¿Nos confirmas por favor si ya te encuentras en la habitación?`);
      Est.p10 = 1; Cambio = true;
    }
    if (Diff >= 15 && Diff <= 120 && !Est.a15) {
      const Numcmd = Obtenercelularlegiblereserva(Filas[I]);
      Enviarmensajeinteligente(Cred.celularadmin, `Alerta de llegada sin confirmar · ${Cod}\nHuésped: ${Filas[I][2]} (${Numcmd})\nHabitación: ${Hab} · Hora prevista: ${Horatxt}\nHan pasado 15 min y el cliente no ha confirmado si ya está en la habitación. Verifica si está ocupada o si se debe liberar:\n- Contactar: abrir canal con ${Numcmd}\n- Liberar si quedó lista: Habilitar la habitacion ${Hab}`, '', []);
      Est.a15 = 1; Cambio = true;
    }
    if (Cambio) { Guardarestadollegada(Cod, Est); }
  }
}

function Revisarcanales() {
  Revisarllegadasclientes();
  const Hojaconv = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Conversaciones');
  if (!Hojaconv || Hojaconv.getLastRow() < 2) { return; }
  const Numcols = Math.min(Math.max(Hojaconv.getLastColumn(), 10), 14);
  let Filas = Hojaconv.getRange(2, 1, Hojaconv.getLastRow() - 1, Numcols).getValues();
  if (!Filas.some(function(F) { return F[2] === 'PendienteAdmin' || F[2] === 'Canal' || F[2] === 'PostCanal'; })) { return; }

  const Cfg = Leerconfiguracionhoja(), Cred = Obtenercredenciales(), Hojares = Obtenerhojareservas(), Ahorams = Date.now();
  const Limcli = Number(Cfg.MINUTOSRECORDATORIOCLIENTE || 2), Limesp = Number(Cfg.MINUTOSESPERAADMIN || 15);
  const Limadm = Number(Cfg.MINUTOSRECORDATORIOCANAL || 5), Liminact = Number(Cfg.MINUTOSINACTIVIDADCANAL || 15), Limpost = Number(Cfg.MINUTOSCIERREPOSTCANAL || 15);
  let Cerronalguno = false;

  for (let C = 0; C < Filas.length; C++) {
    const Modo = String(Filas[C][2] || ''), Cel = Normalizaridwhatsapp(Filas[C][0]), Nombre = String(Filas[C][1] || 'Cliente'), Codres = String(Filas[C][3] || 'SIN-CODIGO');
    const Aperturams = Filas[C][6] ? new Date(Filas[C][6]).getTime() : 0;
    if (!Cel || isNaN(Aperturams) || !Aperturams) { continue; }
    if (Modo === 'Canal') {
      const Ultact = Math.max(Aperturams, (Filas[C][4] ? new Date(Filas[C][4]).getTime() : 0) || 0, (Filas[C][5] ? new Date(Filas[C][5]).getTime() : 0) || 0);
      if ((Ahorams - Ultact) / 60000 >= Liminact) {
        Actualizarconversacion(Cel, { modo: 'PostCanal', aperturacanal: Formatearfechahora(new Date()), idinteraccionia: '' });
        const Props = PropertiesService.getScriptProperties();
        if (Props.getProperty('CANAL_ACTIVO_ADMIN') === Cel) { Props.deleteProperty('CANAL_ACTIVO_ADMIN'); }
        Enviarmensajewhatsapp(Cel, `Hola ${Primernombre(Nombre) || Nombre || 'viajero'}, la atención con el administrador ha finalizado. Para poder proceder, ¿me puedes indicar si concretaste alguna reserva con el administrador?`);
        Enviarmensajewhatsapp(Cred.celularadmin, `Canal con ${Nombre} (${Formatearnumerocomando(Cel)}) cerrado por 15 min de inactividad. La IA consultó al cliente si concretó reserva.`);
        Registrarbitacora('Canal', 'CierreInactividad15m', `Canal ${Codres} (${Cel}) pasó a PostCanal.`);
        Notificarsiguienteturnoadmin();
        Cerronalguno = true;
      }
    } else if (Modo === 'PostCanal' && (Ahorams - Aperturams) / 60000 >= Limpost) {
      Restaurarencanalpendiente(Cel, Codres);
      Actualizarconversacion(Cel, { modo: 'Finalizado', aperturacanal: '', idinteraccionia: '' });
      Registrarbitacora('Canal', 'FinalizadoPostCanal15m', `Chat ${Codres} (${Cel}) marcado como Finalizado.`);
    }
  }

  if (Cerronalguno) { Filas = Hojaconv.getRange(2, 1, Hojaconv.getLastRow() - 1, Numcols).getValues(); }
  const Adminocupado = Filas.some(function(F) { return String(F[2]) === 'Canal'; });
  const Colapendientes = Obtenercanalesabiertos('PendienteAdmin').map(function(P) { return P.celular; });

  for (let C = 0; C < Filas.length; C++) {
    if (String(Filas[C][2] || '') !== 'PendienteAdmin') { continue; }
    const Cel = Normalizaridwhatsapp(Filas[C][0]), Nombre = String(Filas[C][1] || 'Cliente'), Codres = String(Filas[C][3] || 'SIN-CODIGO');
    const Aperturams = Filas[C][6] ? new Date(Filas[C][6]).getTime() : 0;
    if (!Cel || isNaN(Aperturams) || !Aperturams) { continue; }
    const Minabierto = (Ahorams - Aperturams) / 60000, Numerocmd = Formatearnumerocomando(Cel);
    const Turno = Math.max(1, Colapendientes.indexOf(Cel) + 1);
    if (Minabierto >= Limesp) {
      const Resrest = Restaurarencanalpendiente(Cel, Codres);
      const Txtcli = Adminocupado
        ? 'El administrador continúa atendiendo otra conversación y por el momento no ha podido conectarse, lamentamos la espera. Ya le dejé tu resumen prioritario; apenas finalice se pondrá en contacto contigo por este mismo medio.'
        : 'El administrador no se encuentra disponible en este momento, lamentamos las molestias. Igualmente ya le envié el resumen de este chat con tu requerimiento; apenas esté disponible se pondrá en contacto contigo por este mismo medio.';
      const Notaapart = Resrest.estadofinal === 'Vencida' ? ` Tu apartado temporal de la habitación ${Resrest.habitacion} venció tras la espera, pero puedes consultar disponibilidad nuevamente aquí cuando gustes.` : '';
      Enviarmensajewhatsapp(Cel, `${Txtcli}${Notaapart}`);
      const Ctx = Buscarcontextoreserva(Hojares, Codres, Cel), Motivo = String(Filas[C][11] || 'Solicitud de atención con recepción'), Resumen = String(Filas[C][12] || Ctx.obs || 'Cliente en espera de respuesta del administrador.'), Cmdabrir = `abrir canal con ${Numerocmd}`;
      if (!Adminocupado) {
        const Rep = `Contacto pendiente (${Codres})\nCliente: ${Nombre} (${Numerocmd})\nHabitación: ${Ctx.habitacion} · ${Ctx.fechasestadia} (${Ctx.personas})\nRequerimiento: ${Motivo}\nResumen: ${Resumen}\n\nPara contactar al cliente, puedes abrir canal desde tu WhatsApp de administrador en el chat de Hospedaje Nissi escribiendo exactamente:\n${Cmdabrir}`;
        Guardarmapeomensajecanal(Enviarmensajeinteligente(Cred.celularadmin, Rep, 'canal_efectivo_admin', [Codres, Nombre]), Cel, Codres, 'sistema->admin');
      }
      try { Enviarcorreocontactopendiente({ nombre: Nombre, celular: Cel, numerocomando: Numerocmd, codigo: Codres, motivo: Motivo, resumen: Resumen, habitacion: Ctx.habitacion, fechasestadia: Ctx.fechasestadia, personas: Ctx.personas, comandoabrir: Cmdabrir }); } catch (Ec) { Registrarbitacora('Correos', 'ErrorContactoPendiente', String(Ec)); }
      Actualizarconversacion(Cel, { modo: 'PendienteContacto', aperturacanal: '', avisodemoracanal: Adminocupado ? 'PENDIENTE_AVISO_ADMIN' : 'TIMEOUT_15M', idinteraccionia: '' });
      Registrarbitacora('Canal', 'TimeoutAdmin15m', `${Nombre} (${Numerocmd}) pasó a PendienteContacto (Hab: ${Resrest.estadofinal || 'N/A'}).`);
      continue;
    }
    const Ultreccli = Filas[C][10] ? new Date(Filas[C][10]).getTime() : Aperturams;
    if ((Ahorams - Ultreccli) / 60000 >= Limcli) {
      Enviarmensajewhatsapp(Cel, Adminocupado ? `Por favor espera en el chat; el administrador sigue atendiendo a otro huésped (tienes el turno #${Turno}). Apenas finalice le llegará el aviso para atenderte.` : 'Por favor espera en el chat, seguimos buscando a un administrador disponible para atenderte.');
      Actualizarconversacion(Cel, { ultimorecordatoriocliente: Formatearfechahora(new Date()) });
    }
    const Ultrecadm = Filas[C][8] ? new Date(Filas[C][8]).getTime() : Aperturams;
    if (!Adminocupado && (Ahorams - Ultrecadm) / 60000 >= Limadm) {
      Guardarmapeomensajecanal(Enviarmensajeinteligente(Cred.celularadmin, `Recordatorio: "${Nombre}" (${Codres} · ${Numerocmd}) lleva ${Math.round(Minabierto)} min esperando. Responde SI o escribe: abrir canal con ${Numerocmd}`, 'canal_efectivo_admin', []), Cel, Codres, 'sistema->admin');
      Actualizarconversacion(Cel, { ultimorecordatorioadmin: Formatearfechahora(new Date()) });
    }
  }
}

function Probarcorreocontactopendiente() {
  Enviarcorreocontactopendiente({ nombre: 'Juan Pérez', numerocomando: '3209014142', codigo: 'NS-PRUEBA', motivo: 'Grupo de 5 personas', resumen: 'Solicita cotización para 5 personas este fin de semana.', habitacion: '--', fechasestadia: '2026-11-20 al 2026-11-22', personas: '5', comandoabrir: 'abrir canal con 3209014142' });
}
