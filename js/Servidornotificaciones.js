// Notificaciones de reserva confirmada (WhatsApp + correo HTML), recordatorio de check-out e informe diario

function Enviarcorreoreservaconfirmada(Datos) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin || MailApp.getRemainingDailyQuota() <= Datoscorreo.reservacuotacorreo) { return; }

  const Total = Number(Datos.total || 0);
  const Pagado = Number(Datos.pagado || 0);
  const Saldo = Math.max(0, Total - Pagado);
  const Horacheckout = Number(Leerconfiguracionhoja().HORACHECKOUT || 11);
  const Horasalida = Datos.horasalida || Formatearhoradoce(Horacheckout);

  const Html = Rellenarplantilla(
    Cargarplantilla('Correoreservaconfirmada'),
    {
      CODIGO: Datos.codigo || 'NS-0000',
      HABITACION: String(Datos.habitacion || '01').padStart(2, '0'),
      FECHACONFIRMACION: Formatearfechahora(new Date()).slice(0, 16),
      CANAL: Datos.canal || 'WhatsApp',
      TOTAL: Formatearpesos(Total),
      PAGADO: Formatearpesos(Pagado),
      MEDIOPAGO: Datos.entidad || 'Efectivo',
      REFERENCIA: Datos.referencia || 'Confirmación directa',
      SALDO: Formatearpesos(Saldo),
      HUESPED: Datos.nombre || 'Viajero',
      CELULAR: Datos.celular || 'No registrado',
      LLEGADA: Datos.llegada || '',
      SALIDA: Datos.salida || '',
      NOCHES: String(Datos.noches || 1),
      PERSONAS: String(Datos.personas || 1),
      CAMAS: Datos.camas || 'Según tarifa aplicada',
      HORALLEGADA: Datos.horallegada || 'Por confirmar',
      HORASALIDA: Horasalida,
      OBSERVACIONES: Datos.observaciones || 'Ninguna'
    },
    {}
  );

  const Textoplano =
    `Nueva reserva confirmada · ${Datos.codigo}\n` +
    `Habitación: ${Datos.habitacion} · Huésped: ${Datos.nombre} (${Datos.celular})\n` +
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

// Notifica al cliente por WhatsApp y al administrador por WhatsApp + correo HTML
function Notificarreservaconfirmada(Datos) {
  const Hab = String(Datos.habitacion || '01').padStart(2, '0');
  const Total = Number(Datos.total || 0);
  const Pagado = Number(Datos.pagado || 0);
  const Saldo = Math.max(0, Total - Pagado);
  const Horacheckout = Formatearhoradoce(Number(Leerconfiguracionhoja().HORACHECKOUT || 11));

  if (Datos.celular && Datos.enviarcliente !== false) {
    const Rutas = `\n\nCómo llegar a Hospedaje Nissi (Mingueo):\n- Google Maps: https://maps.app.goo.gl/TudMNAdQRpVyzHZGA\n- Waze: ${Datoscorreo.urlwaze}`;
    const Msgbase = Datos.mensajecliente ||
      `Tu reserva ${Datos.codigo} está confirmada en Hospedaje Nissi.\n` +
      `Habitación ${Hab} · ${Datos.llegada} al ${Datos.salida} · Llegada ${Datos.horallegada || 'Por confirmar'}.\n` +
      `Check-out: ${Horacheckout}.\n` +
      `Total: $${Total.toLocaleString('es-CO')} COP · Pagado: $${Pagado.toLocaleString('es-CO')} COP · Saldo: $${Saldo.toLocaleString('es-CO')} COP.\n` +
      `Te esperamos en Mingueo.`;
    const Msgcliente = Msgbase.indexOf('maps.app.goo.gl') !== -1 ? Msgbase : `${Msgbase}${Rutas}`;
    Enviarmensajeinteligente(Datos.celular, Msgcliente, 'reserva_confirmada_cliente', [Datos.nombre || 'Viajero', Datos.codigo]);
  }

  const Resumenadmin =
    `Reserva confirmada · ${Datos.codigo}\n` +
    `Habitación: ${Hab}\nHuésped: ${Datos.nombre}\nCelular: ${Datos.celular}\n` +
    `Estadía: ${Datos.llegada} al ${Datos.salida} (${Datos.noches} noche${Number(Datos.noches) > 1 ? 's' : ''}) · ${Datos.personas} persona(s)\n` +
    `Llegada: ${Datos.horallegada || 'Por confirmar'} · Check-out: ${Horacheckout}\n` +
    (Datos.observaciones ? `Detalles: ${Datos.observaciones}\n` : '') +
    `Total: $${Total.toLocaleString('es-CO')} · Pagado: $${Pagado.toLocaleString('es-CO')} (${Datos.entidad || 'Efectivo'} · ref. ${Datos.referencia || 'N/A'})\n` +
    `Saldo por cobrar: $${Saldo.toLocaleString('es-CO')}`;

  Notificaradministradorwhatsapp(Resumenadmin, [
    Datos.codigo, Hab, Datos.nombre, '-', Datos.celular, Datos.llegada, Datos.salida, Datos.personas,
    Datos.horallegada || 'Por confirmar', Total.toLocaleString('es-CO'), Pagado.toLocaleString('es-CO'),
    Datos.entidad || 'Efectivo', Datos.referencia || '-', Saldo.toLocaleString('es-CO')
  ]);

  try {
    Enviarcorreoreservaconfirmada(Datos);
  } catch (Errorcorreo) {
    Registrarbitacora('Correos', 'ErrorReservaConfirmada', String(Errorcorreo));
  }
}

function Probarcorreoreservaconfirmada() {
  Enviarcorreoreservaconfirmada({
    codigo: 'NS-TEST', habitacion: '01', canal: 'WhatsApp', total: 90000, pagado: 90000,
    entidad: 'Nequi', referencia: 'M984512', nombre: 'Jorge Perdomo (C.C. 1014305605)',
    celular: '573233238955', llegada: '2026-11-18', salida: '2026-11-19', noches: 1,
    personas: 2, camas: '2 personas en camas individuales', horallegada: '8:00 p. m.',
    observaciones: 'Parqueadero: Sí (1 carro)'
  });
}

// Reloj horario: 1 hora antes del check-out (10:00 a. m.) recuerda la salida y ofrece horas adicionales
function Enviarrecordatoriocheckout() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  if (!Hojareservas || Hojareservas.getLastRow() < 2) { return; }

  const Config = Leerconfiguracionhoja();
  const Horacheckout = Number(Config.HORACHECKOUT || 11);
  const Valorhora = Number(Config.VALORHORAADICIONAL || 10000);
  const Ahora = new Date();
  const Horaactual = parseInt(Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'HH'), 10);
  if (Horaactual !== Horacheckout - 1) { return; }

  const Hoytexto = Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  const Filas = Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, Math.max(23, Hojareservas.getLastColumn())).getValues();

  for (let I = 0; I < Filas.length; I++) {
    if (String(Filas[I][14]) !== 'Confirmada') { continue; }
    if (Normalizarfecha(Filas[I][6]) !== Hoytexto) { continue; }
    const Obs = String(Filas[I][22] || '');
    if (Obs.indexOf('Recordatorio checkout') !== -1) { continue; }

    const Celular = Normalizaridwhatsapp(Filas[I][3]);
    if (!Celular) { continue; }
    const Nombre = Primernombre(Filas[I][2]) || 'huésped';
    const Hab = String(Filas[I][4]).padStart(2, '0');
    const Horabonita = Formatearhoradoce(Horacheckout);

    const Msg =
      `Buenos días, ${Nombre}. Desde la recepción de Hospedaje Nissi te recordamos que el check-out de tu habitación ${Hab} es hoy a las ${Horabonita}.\n\n` +
      `Si deseas quedarte más tiempo, respóndenos por este chat a qué hora piensas salir para hacer el ajuste. Cada hora adicional tiene un valor de $${Valorhora.toLocaleString('es-CO')} COP (puedes pagarlo por transferencia o en efectivo al salir).`;

    Enviarmensajeinteligente(Celular, Msg, 'recordatorio_checkout', [Nombre, Hab, Horabonita, Valorhora.toLocaleString('es-CO')]);
    Hojareservas.getRange(I + 2, 23).setValue(Sanitizarcelda(Obs ? `${Obs} · Recordatorio checkout` : 'Recordatorio checkout', 140));
    Registrarbitacora('Checkout', 'Recordatorio1h', `Enviado a Hab ${Hab} (${Filas[I][0]})`);
  }
}

// Informe diario de ventas (reloj automatico)
function Enviarinformecorreodiario() {
  if (typeof Liberarhabitacionesvencidas === 'function') { Liberarhabitacionesvencidas(); }
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin) { return; }

  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Zonalibro = Libro.getSpreadsheetTimeZone();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojausuarios = Libro.getSheetByName('Usuarios');

  const Ahora = new Date();
  const Hoy = Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'yyyy-MM-dd');
  const Filashab = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasres = Hojareservas.getDataRange().getValues().slice(1);

  let Recaudo = 0, Confirmadas = 0, Pendientes = 0;
  const Llegadas = [], Salidas = [];

  Filasres.forEach(function(Fila) {
    const Fecharegistro = Normalizarfecha(Fila[1]);
    const Llegada = Normalizarfecha(Fila[5]);
    const Salida = Normalizarfecha(Fila[6]);
    const Estado = String(Fila[14]);
    const Pagado = Number(Fila[11] || 0);
    const Valida = Estado === 'Confirmada' || Estado === 'Finalizada';

    if (Fecharegistro === Hoy && Valida) { Recaudo += Pagado; Confirmadas++; }
    if ((Estado === 'Pendiente' || Estado === 'Apartada' || Estado === 'Verificando') && (!Llegada || Llegada >= Hoy)) { Pendientes++; }
    if (Llegada === Hoy && Estado === 'Confirmada') { Llegadas.push(Fila); }
    if (Salida === Hoy && Valida) { Salidas.push(Fila); }
  });

  let Nuevosusuarios = 0;
  if (Hojausuarios && Hojausuarios.getLastRow() > 1) {
    Hojausuarios.getRange(2, 5, Hojausuarios.getLastRow() - 1, 1).getValues().forEach(function(Fila) {
      if (Normalizarfecha(Fila[0]) === Hoy) { Nuevosusuarios++; }
    });
  }

  const Totalhab = Filashab.length;
  const Ocupadas = Filashab.filter(function(Hab) { return String(Hab[5]) === 'Ocupada'; }).length;
  const Porcentaje = Totalhab ? Math.round((Ocupadas / Totalhab) * 100) : 0;
  const Diasemana = Diassemanacorreo[Number(Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'u')) - 1];
  const Fechacorta = `${Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'd')} de ${Mesescorreo[Number(Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'M')) - 1]}`;
  const Textoconfirmadas = Confirmadas === 0 ? 'Aún no hay reservas confirmadas hoy.' : `${Confirmadas} reserva${Confirmadas === 1 ? '' : 's'} confirmada${Confirmadas === 1 ? '' : 's'} hoy.`;

  const Html = Rellenarplantilla(
    Cargarplantilla('Informediario'),
    {
      DIASEMANA: Diasemana, FECHACORTA: Fechacorta, HORAGENERADO: Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'HH:mm'),
      RECAUDO: Formatearpesos(Recaudo), TEXTOCONFIRMADAS: Textoconfirmadas, OCUPADAS: Ocupadas, TOTALHAB: Totalhab,
      PORCENTAJE: Porcentaje, LLEGADAS: Llegadas.length, SALIDAS: Salidas.length, PENDIENTES: Pendientes, NUEVOSUSUARIOS: Nuevosusuarios
    },
    {
      BARRA: Construirbarraocupacion(Porcentaje), HABITACIONES: Construirfilashabitaciones(Filashab),
      LLEGADAS: Construirtarjetasmovimiento(Llegadas, 'llegada', Zonalibro), SALIDAS: Construirtarjetasmovimiento(Salidas, 'salida', Zonalibro)
    }
  );

  MailApp.sendEmail({
    to: Credenciales.correoadmin,
    subject: `Informe diario · ${Diasemana} ${Fechacorta} · $${Formatearpesos(Recaudo)} COP`,
    htmlBody: Html,
    body: `Informe diario Hospedaje Nissi (${Hoy})\nRecaudo validado hoy: $${Formatearpesos(Recaudo)} COP (${Textoconfirmadas})\nOcupación: ${Ocupadas}/${Totalhab} · Llegadas: ${Llegadas.length} · Salidas: ${Salidas.length}`,
    name: `${Datoscorreo.remitente} · Recepción`
  });
}

function Construirbarraocupacion(Porcentaje) {
  const Celda = function(Ancho, Color, Radio) {
    return `<td width="${Ancho}%" height="6" bgcolor="${Color}" style="background:${Color};height:6px;font-size:0;line-height:0;border-radius:${Radio};">&nbsp;</td>`;
  };
  let Celdas;
  if (Porcentaje <= 0) { Celdas = Celda(100, '#2A2D20', '6px'); }
  else if (Porcentaje >= 100) { Celdas = Celda(100, '#4DD678', '6px'); }
  else { Celdas = Celda(Porcentaje, '#4DD678', '6px 0 0 6px') + Celda(100 - Porcentaje, '#2A2D20', '0 6px 6px 0'); }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>${Celdas}</tr></table>`;
}

function Construirfilashabitaciones(Filashab) {
  return Filashab.map(function(Hab) {
    const Est = String(Hab[5]);
    const Fondo = Est === 'Ocupada' ? '#EBD3C6' : (Est === 'Mantenimiento' ? '#DEDAD0' : (Est === 'Apartada' ? '#F5E4B8' : (Est === 'Limpieza' ? '#D6EAF8' : '#DDE2CC')));
    const Color = Est === 'Ocupada' ? '#8C3B1F' : (Est === 'Mantenimiento' ? '#5A5C4E' : (Est === 'Apartada' ? '#8A5A00' : (Est === 'Limpieza' ? '#1B4F72' : '#4F5A2E')));
    const Etiqueta = Est === 'Mantenimiento' ? 'En rediseño' : (Est === 'Limpieza' ? 'Pendiente de limpieza' : Est);
    const Borde = 'border-top:1px solid #D9CDB5;';
    return (
      `<tr>` +
      `<td width="56" valign="middle" style="width:56px;padding:14px 0;${Borde}font-family:${Fuenteserif};font-size:26px;line-height:28px;font-weight:300;color:#1A1C13;">${Escaparhtmlservidor(String(Hab[0]).padStart(2, '0'))}</td>` +
      `<td valign="middle" style="padding:14px 0;${Borde}font-family:${Fuentesans};font-size:14px;line-height:20px;color:#3A3C30;"><strong style="color:#1A1C13;font-weight:600;">${Escaparhtmlservidor(Hab[1])}</strong><br><span style="font-size:12px;color:#5A5C4E;">${Escaparhtmlservidor(Hab[2])}</span></td>` +
      `<td valign="middle" align="right" style="padding:14px 0;${Borde}"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${Fondo};font-family:${Fuentesans};font-size:12px;line-height:16px;font-weight:600;color:${Color};">${Escaparhtmlservidor(Etiqueta)}</span></td>` +
      `</tr>`
    );
  }).join('');
}

function Construirtarjetasmovimiento(Filas, Tipo, Zonalibro) {
  if (!Filas.length) {
    const Mensaje = Tipo === 'llegada' ? 'No hay llegadas programadas para hoy.' : 'No hay salidas programadas para hoy.';
    return `<p style="margin:0;padding:18px 20px;border-radius:16px;background:#E7DCC6;font-family:${Fuentesans};font-size:14px;line-height:20px;color:#5A5C4E;">${Mensaje}</p>`;
  }
  return Filas.map(function(Fila) {
    const Total = Number(Fila[10] || 0);
    const Pagado = Number(Fila[11] || 0);
    const Saldo = Math.max(0, Total - Pagado);
    const Entidad = String(Fila[13] || '').trim();
    const Referencia = String(Fila[12] || '').trim();
    const Detallehora = Tipo === 'llegada' ? Formatearhora(Fila[9], Zonalibro) : (Fila[23] ? `Hasta ${Fila[23]}` : 'Antes de 11:00');
    let Detallepago = `Pagó <strong style="color:#8C3B1F;">$${Formatearpesos(Pagado)} COP</strong>`;
    if (Entidad) { Detallepago += ` · ${Escaparhtmlservidor(Entidad)}`; }
    if (Referencia) { Detallepago += ` · Ref. ${Escaparhtmlservidor(Referencia)}`; }
    if (Saldo > 0) { Detallepago += `<br><strong style="color:#1A1C13;">Saldo por cobrar: $${Formatearpesos(Saldo)} COP</strong>`; }
    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E7DCC6" style="background:#E7DCC6;border-radius:16px;margin-bottom:10px;">` +
      `<tr><td style="padding:18px 20px;font-family:${Fuentesans};">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td style="font-size:11px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:#5A5C4E;">Hab. ${Escaparhtmlservidor(String(Fila[4]).padStart(2, '0'))} · ${Escaparhtmlservidor(Fila[0])}</td>` +
      `<td align="right" style="font-size:13px;line-height:16px;font-weight:600;color:#1A1C13;">${Escaparhtmlservidor(Detallehora)}</td>` +
      `</tr></table>` +
      `<span style="display:block;margin-top:8px;font-family:${Fuenteserif};font-size:21px;line-height:25px;color:#1A1C13;">${Escaparhtmlservidor(Fila[2])}</span>` +
      `<span style="display:block;margin-top:4px;font-size:13px;line-height:19px;color:#3A3C30;">Cel. ${Escaparhtmlservidor(Fila[3])} · ${Detallepago}</span>` +
      `</td></tr></table>`
    );
  }).join('');
}

function Probarinformediario() { Enviarinformecorreodiario(); }

function Enviarcorreocontactopendiente(Datos) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin || MailApp.getRemainingDailyQuota() <= Datoscorreo.reservacuotacorreo) { return; }
  const Fechaactual = Formatearfechahora(new Date()).slice(0, 16);
  const Html = Rellenarplantilla(Cargarplantilla('Correocontactopendiente'), {
    NOMBRE: Datos.nombre || 'Cliente', CELULAR: Datos.numerocomando || Datos.celular || '-',
    CODIGO: Datos.codigo || 'SIN-CODIGO', FECHA: Fechaactual,
    MOTIVO: Datos.motivo || 'Atención con recepción',
    RESUMEN: Datos.resumen || 'El cliente solicitó hablar con un administrador y esperó 15 minutos sin respuesta.',
    HABITACION: Datos.habitacion || '--', FECHASESTADIA: Datos.fechasestadia || 'Por definir',
    PERSONAS: String(Datos.personas || 'Por definir'), COMANDOABRIR: Datos.comandoabrir
  }, {});
  const Textoplano =
    `Contacto pendiente (${Datos.codigo || 'Chat'})\nCliente: ${Datos.nombre} (${Datos.numerocomando})\n` +
    `Requerimiento: ${Datos.motivo}\nResumen: ${Datos.resumen}\n\n` +
    `Para contactar al cliente, abre el chat de Hospedaje Nissi con tu WhatsApp de administrador y escribe:\n${Datos.comandoabrir}`;
  MailApp.sendEmail({
    to: Credenciales.correoadmin,
    subject: `Contacto pendiente · ${Datos.nombre} (${Datos.numerocomando}) · Hospedaje Nissi`,
    htmlBody: Html, body: Textoplano, name: `${Datoscorreo.remitente} · Recepción`
  });
}

function Buscarcontextoreserva(Hojares, Codres, Celcliente) {
  if (!Hojares || Hojares.getLastRow() < 2) { return { habitacion: '--', fechasestadia: 'Por definir', personas: 'Por definir', obs: '' }; }
  const Filas = Hojares.getDataRange().getValues();
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Ccod = Codres && String(Filas[I][0]).toUpperCase() === String(Codres).toUpperCase();
    const Ccel = Celcliente && Normalizaridwhatsapp(Filas[I][3]) === Celcliente;
    if (Ccod || Ccel) {
      return { habitacion: String(Filas[I][4] || '--').padStart(2, '0'), fechasestadia: `${Normalizarfecha(Filas[I][5])} al ${Normalizarfecha(Filas[I][6])}`, personas: `${Number(Filas[I][8] || 1)} persona(s)`, obs: String(Filas[I][22] || '').trim() };
    }
  }
  return { habitacion: '--', fechasestadia: 'Por definir', personas: 'Por definir', obs: '' };
}

// Reloj cada 1 minuto: avisos al cliente cada 2m, timeout 15m al admin, inactividad de canal 15m y cierre post-canal
function Revisarcanales() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojaconv = Libro.getSheetByName('Conversaciones');
  if (!Hojaconv || Hojaconv.getLastRow() < 2) { return; }
  const Numcols = Math.min(Math.max(Hojaconv.getLastColumn(), 10), 13);
  const Filas = Hojaconv.getRange(2, 1, Hojaconv.getLastRow() - 1, Numcols).getValues();
  if (!Filas.some(function(F) { return F[2] === 'PendienteAdmin' || F[2] === 'Canal' || F[2] === 'PostCanal'; })) { return; }

  const Config = Leerconfiguracionhoja();
  const Credenciales = Obtenercredenciales();
  const Hojares = Libro.getSheetByName('Reservas');
  const Limitecliente = Number(Config.MINUTOSRECORDATORIOCLIENTE || 2);
  const Limiteespera = Number(Config.MINUTOSESPERAADMIN || 15);
  const Limiterecadmin = Number(Config.MINUTOSRECORDATORIOCANAL || 5);
  const Limiteinact = Number(Config.MINUTOSINACTIVIDADCANAL || 15);
  const Limitepost = Number(Config.MINUTOSCIERREPOSTCANAL || 15);
  const Ahorams = Date.now();

  for (let C = 0; C < Filas.length; C++) {
    const Modo = String(Filas[C][2] || '');
    if (Modo !== 'PendienteAdmin' && Modo !== 'Canal' && Modo !== 'PostCanal') { continue; }
    const Cel = Normalizaridwhatsapp(Filas[C][0]);
    const Nombre = String(Filas[C][1] || 'Cliente');
    const Codres = String(Filas[C][3] || 'SIN-CODIGO');
    const Aperturams = Filas[C][6] ? new Date(Filas[C][6]).getTime() : 0;
    if (!Cel || isNaN(Aperturams) || !Aperturams) { continue; }

    if (Modo === 'PendienteAdmin') {
      const Minabierto = (Ahorams - Aperturams) / 60000;
      const Numerocmd = Formatearnumerocomando(Cel);
      if (Minabierto >= Limiteespera) {
        Enviarmensajewhatsapp(Cel, 'El administrador no se encuentra disponible en este momento, lamentamos las molestias. Igualmente ya le envié el resumen de este chat con tu requerimiento; apenas esté disponible se pondrá en contacto contigo por este mismo medio.');
        const Ctx = Buscarcontextoreserva(Hojares, Codres, Cel);
        const Motivo = String(Filas[C][11] || 'Solicitud de atención con recepción');
        const Resumen = String(Filas[C][12] || Ctx.obs || 'Cliente en espera de respuesta del administrador.');
        const Comandoabrir = `abrir canal con ${Numerocmd}`;
        const Reportewa = `Contacto pendiente (${Codres})\nCliente: ${Nombre} (${Numerocmd})\nHabitación: ${Ctx.habitacion} · ${Ctx.fechasestadia} (${Ctx.personas})\nRequerimiento: ${Motivo}\nResumen: ${Resumen}\n\nPara contactar al cliente, puedes abrir canal desde tu WhatsApp de administrador en el chat de Hospedaje Nissi escribiendo exactamente:\n${Comandoabrir}`;
        Enviarmensajeinteligente(Credenciales.celularadmin, Reportewa, 'canal_efectivo_admin', [Codres, Nombre]);
        try { Enviarcorreocontactopendiente({ nombre: Nombre, celular: Cel, numerocomando: Numerocmd, codigo: Codres, motivo: Motivo, resumen: Resumen, habitacion: Ctx.habitacion, fechasestadia: Ctx.fechasestadia, personas: Ctx.personas, comandoabrir: Comandoabrir }); } catch (Ec) { Registrarbitacora('Correos', 'ErrorContactoPendiente', String(Ec)); }
        Actualizarconversacion(Cel, { modo: 'PendienteContacto', aperturacanal: '', avisodemoracanal: 'TIMEOUT_15M', idinteraccionia: '' });
        Registrarbitacora('Canal', 'TimeoutAdmin15m', `${Nombre} (${Numerocmd}) pasó a PendienteContacto.`);
        continue;
      }
      const Ultreccli = Filas[C][10] ? new Date(Filas[C][10]).getTime() : Aperturams;
      if ((Ahorams - Ultreccli) / 60000 >= Limitecliente) {
        Enviarmensajewhatsapp(Cel, 'Por favor espera en el chat, seguimos buscando a un administrador disponible para atenderte.');
        Actualizarconversacion(Cel, { ultimorecordatoriocliente: Formatearfechahora(new Date()) });
      }
      const Ultrecadm = Filas[C][8] ? new Date(Filas[C][8]).getTime() : Aperturams;
      if ((Ahorams - Ultrecadm) / 60000 >= Limiterecadmin) {
        Enviarmensajeinteligente(Credenciales.celularadmin, `Recordatorio: "${Nombre}" (${Codres} · ${Numerocmd}) lleva ${Math.round(Minabierto)} min esperando. Responde SI o escribe: abrir canal con ${Numerocmd}`, 'canal_efectivo_admin', []);
        Actualizarconversacion(Cel, { ultimorecordatorioadmin: Formatearfechahora(new Date()) });
      }
    } else if (Modo === 'Canal') {
      const Ultcli = Filas[C][4] ? new Date(Filas[C][4]).getTime() : 0;
      const Ultadm = Filas[C][5] ? new Date(Filas[C][5]).getTime() : 0;
      const Ultact = Math.max(Aperturams, Ultcli || 0, Ultadm || 0);
      if ((Ahorams - Ultact) / 60000 >= Limiteinact) {
        const Ahoratexto = Formatearfechahora(new Date());
        Actualizarconversacion(Cel, { modo: 'PostCanal', aperturacanal: Ahoratexto, idinteraccionia: '' });
        const Props = PropertiesService.getScriptProperties();
        if (Props.getProperty('CANAL_ACTIVO_ADMIN') === Cel) { Props.deleteProperty('CANAL_ACTIVO_ADMIN'); }
        const Saludo = Primernombre(Nombre) || Nombre || 'viajero';
        Enviarmensajewhatsapp(Cel, `Hola ${Saludo}, la atención con el administrador ha finalizado. Para poder proceder, ¿me puedes indicar si concretaste alguna reserva con el administrador?`);
        Enviarmensajewhatsapp(Credenciales.celularadmin, `Canal con ${Nombre} (${Formatearnumerocomando(Cel)}) cerrado por 15 min de inactividad. La IA consultó al cliente si concretó reserva.`);
        Registrarbitacora('Canal', 'CierreInactividad15m', `Canal ${Codres} (${Cel}) pasó a PostCanal.`);
      }
    } else if (Modo === 'PostCanal' && (Ahorams - Aperturams) / 60000 >= Limitepost) {
      Actualizarconversacion(Cel, { modo: 'Finalizado', aperturacanal: '', idinteraccionia: '' });
      Registrarbitacora('Canal', 'FinalizadoPostCanal15m', `Chat ${Codres} (${Cel}) marcado como Finalizado.`);
    }
  }
}

function Probarcorreocontactopendiente() {
  Enviarcorreocontactopendiente({ nombre: 'Juan Pérez', numerocomando: '3209014142', codigo: 'NS-PRUEBA', motivo: 'Grupo de 5 personas', resumen: 'Solicita cotización para 5 personas este fin de semana.', habitacion: '--', fechasestadia: '2026-11-20 al 2026-11-22', personas: '5', comandoabrir: 'abrir canal con 3209014142' });
}
