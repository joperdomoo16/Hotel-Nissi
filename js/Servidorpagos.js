// Verificación de pagos, lectura de correos bancarios y vencimiento de apartados

function Normalizarnombrepago(Texto) {
  return String(Texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function Parsearfechacomprobante(Valor) {
  if (Valor instanceof Date && !isNaN(Valor.getTime())) { return Valor.getTime(); }
  const Txt = String(Valor || '').trim().replace(/\s+/g, ' ');
  const M = Txt.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2})(?::\d{2})?)?/);
  if (!M) { return NaN; }
  const Hora = M[2] ? `${M[2].padStart(5, '0')}:00` : '12:00:00';
  return new Date(`${M[1]}T${Hora}-05:00`).getTime();
}

function Validardestinatariocomprobante(Datos, Config, Reserva) {
  const Numesperado = Normalizarcelularcolombiano((Config && Config.NUMERONEQUIDESTINO) || '3126609214') || '3126609214';
  const Nombresperado = Normalizarnombrepago((Config && Config.TITULARNEQUIDESTINO) || 'Justa Emilia Murgas Arias');
  const Numrecibido = Normalizarcelularcolombiano(Datos.numerodestino || '');
  const Nombrerecibido = Normalizarnombrepago(Datos.nombredestino || '');
  const Tokensesp = Nombresperado.split(' ').filter(Boolean);
  const Tokensrec = Nombrerecibido.split(' ').filter(Boolean);
  const Nombrecoincide = Tokensrec.length >= 2 &&
    Tokensrec.indexOf(Tokensesp[0]) !== -1 &&
    Tokensrec.some(function(T) { return T === 'murgas' || (Tokensesp.length > 1 && T === Tokensesp[Tokensesp.length - 1]); }) &&
    Tokensrec.every(function(T) { return Tokensesp.indexOf(T) !== -1; });
  const Numerocoincide = Boolean(Numrecibido && Numrecibido === Numesperado);
  const Fallos = [];
  if (!Nombrecoincide) { Fallos.push(`titular leído "${Datos.nombredestino || 'no legible'}" distinto a ${Config.TITULARNEQUIDESTINO || 'Justa Murgas'}`); }
  if (!Numerocoincide) { Fallos.push(`número leído "${Datos.numerodestino || 'no legible'}" distinto a ${Numesperado}`); }
  if (Reserva || Datos.fecha) {
    const Fechams = Parsearfechacomprobante(Datos.fecha);
    const Creams = Reserva ? Parsearfechacomprobante(Reserva[1]) : NaN;
    if (isNaN(Fechams) || Fechams > Date.now() + 900000 || (!isNaN(Creams) && Fechams < Creams - 1800000)) {
      Fallos.push(`fecha/hora "${Datos.fecha || 'no legible'}" incoherente con la reserva`);
    }
  }
  if (Fallos.length) { return { valido: false, motivo: `Anomalía en comprobante: ${Fallos.join(' y ')}` }; }
  return { valido: true };
}

function Registrarenesperahabitacion(Celularcliente, Numerohabitacion, Fechallegada, Fechasalida, Cantidadhuespedes, Camasseparadas) {
  const Hab = String(Numerohabitacion || '01').padStart(2, '0'), Cel = Normalizaridwhatsapp(Celularcliente);
  if (!Cel) { return { exito: false }; }
  PropertiesService.getScriptProperties().setProperty(`ESPERA_HAB_${Hab}`, JSON.stringify({
    celular: Cel, llegada: String(Fechallegada || ''), salida: String(Fechasalida || ''),
    huespedes: parseInt(Cantidadhuespedes || 1, 10), camasseparadas: Boolean(Camasseparadas), ts: Date.now()
  }));
  return { exito: true, habitacion: Hab, mensaje: `Listo, quedas anotado en espera prioritaria para la habitación ${Hab}.` };
}

function Notificaresperahabitacion(Numerohabitacion) {
  const Hab = String(Numerohabitacion || '').padStart(2, '0'), Props = PropertiesService.getScriptProperties();
  const Crudo = Props.getProperty(`ESPERA_HAB_${Hab}`);
  if (!Crudo) { return false; }
  Props.deleteProperty(`ESPERA_HAB_${Hab}`);
  try {
    const Esp = JSON.parse(Crudo);
    if (!Esp.celular || (Date.now() - Number(Esp.ts || 0)) > 7200000) { return false; }
    const Res = Apartarhabitacion(Esp.celular, Hab, Esp.llegada, Esp.salida, Esp.huespedes, 'WhatsApp', Esp.camasseparadas);
    if (Res && Res.exito) {
      Enviarmensajewhatsapp(Esp.celular, `¡Buenas noticias! La habitación ${Hab} acaba de quedar libre y te la aparté de inmediato (código ${Res.codigo}). ¿Me confirmas si continuamos con tu registro para confirmarla?`);
      return true;
    }
  } catch (E) {}
  return false;
}

function Normalizarreferencia(Ref) {
  return String(Ref || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function Registrarcomprobante(Celularcliente, Codigoreserva, Datoscomprobante) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Obtenerhojareservas();
  const Hojapagos = Libro.getSheetByName('Pagosrecibidos');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Config = Leerconfiguracionhoja();
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Reflimpia = Normalizarreferencia(Datoscomprobante.referencia);
  const Montoleido = Number(Datoscomprobante.monto || 0);
  const Entidadleida = Sanitizarcelda(Datoscomprobante.entidad || 'Nequi', 40);
  const Fechaleida = Sanitizarcelda(Datoscomprobante.fecha || Formatearfechahora(new Date()), 30);
  const Idimagen = String(Datoscomprobante.idimagen || '').trim();

  const Filasres = Hojareservas.getDataRange().getValues();
  let Indice = -1, Codigo = Codigoreserva || '';
  for (let I = Filasres.length - 1; I >= 1; I--) {
    const Est = String(Filasres[I][15]);
    const Esampliacion = Est === 'Confirmada' && String(Filasres[I][23] || '').indexOf('pendiente transferencia') !== -1;
    if (Coincidereservacliente(Filasres[I], Codigo, Celularlimpio) && (Est === 'Apartada' || Est === 'Verificando' || Esampliacion)) {
      Indice = I + 1; Codigo = String(Filasres[I][0]); break;
    }
  }
  if (Indice < 0) { return { exito: false, mensaje: 'No se encontró una reserva apartada activa para asociar el comprobante.' }; }

  if (Reflimpia) {
    for (let J = 1; J < Filasres.length; J++) {
      const Refprevia = Normalizarreferencia(Filasres[J][13] || Filasres[J][20]), Codprevio = String(Filasres[J][0]);
      if (Refprevia && Refprevia === Reflimpia && Codprevio !== Codigo && String(Filasres[J][15]) === 'Confirmada') {
        Hojareservas.getRange(Indice, 16).setValue('Rechazada');
        Hojareservas.getRange(Indice, 24).setValue(`Rechazada: referencia duplicada (${Reflimpia} usada en ${Codprevio})`);
        Enviarmensajewhatsapp(Credenciales.celularadmin, `Alerta de posible fraude: el cliente ${Formatearnumerocomando(Celularlimpio)} (${Codigo}) envió una captura con referencia ${Reflimpia} ya usada en ${Codprevio}.`);
        return { exito: false, estado: 'Rechazada', mensaje: 'Este comprobante ya fue utilizado previamente en otra reserva.' };
      }
    }
    if (Hojapagos && Hojapagos.getLastRow() >= 2) {
      const Reusado = Hojapagos.getRange(2, 1, Hojapagos.getLastRow() - 1, 9).getValues().find(function(P) {
        return Normalizarreferencia(P[4]) === Reflimpia && String(P[8]).indexOf('Usado') === 0 && String(P[8]).indexOf(Codigo) === -1;
      });
      if (Reusado) {
        Hojareservas.getRange(Indice, 16).setValue('Rechazada');
        Enviarmensajewhatsapp(Credenciales.celularadmin, `Alerta de posible fraude: referencia ${Reflimpia} en ${Codigo} ya figura como "${Reusado[8]}".`);
        return { exito: false, estado: 'Rechazada', mensaje: 'Este comprobante ya fue registrado en otra reserva.' };
      }
    }
  }

  const Ahoratexto = Formatearfechahora(new Date()), Reserva = Filasres[Indice - 1];
  const Esampliacion = String(Reserva[15]) === 'Confirmada' && String(Reserva[23] || '').indexOf('pendiente transferencia') !== -1;
  const Mediopago = String(Reserva[18] || '').toLowerCase();
  const Coincidemixto = String(Reserva[23] || '').match(/\[Mixto Nequi:(\d+)/i);
  const Esmixto = !Esampliacion && Mediopago === 'mixto' && Boolean(Coincidemixto);
  const Montoobj = Esampliacion ? Number(Reserva[26] || 0) : (Esmixto ? Number(Coincidemixto[1]) : Number(Reserva[11] || 0));
  const Minimo = Math.round(Montoobj * (Number(Config.PAGOMINIMOPORCENTAJE || 100) / 100));
  const Refguardar = Sanitizarcelda(Datoscomprobante.referencia || Reflimpia || 'CAPTURA', 60);

  Hojareservas.getRange(Indice, 15).setValue(Entidadleida);
  if (!Esampliacion) { Hojareservas.getRange(Indice, 16).setValue('Verificando'); }
  Hojareservas.getRange(Indice, 18).setValue(Ahoratexto);
  if (!Esmixto && !Esampliacion) { Hojareservas.getRange(Indice, 19).setValue('Transferencia'); }
  Hojareservas.getRange(Indice, 20).setValue(Montoleido);
  Hojareservas.getRange(Indice, 21).setValue(Refguardar);
  Hojareservas.getRange(Indice, 22).setValue(Fechaleida);

  const Destinocliente = Obtenerdestinowhatsappreserva(Reserva) || Celularlimpio;
  const Numcmd = Obtenercelularlegiblereserva(Reserva);
  const Validaciondest = Validardestinatariocomprobante(Datoscomprobante, Config, Reserva);
  if (!Validaciondest.valido) {
    Abrircanaladministrador(Destinocliente, Codigo, 'comprobante', Validaciondest.motivo, `Captura recibida: $${Montoleido.toLocaleString('es-CO')} · Ref. ${Refguardar}`);
    if (Idimagen && typeof Obtenercanalesabiertos === 'function' && Obtenercanalesabiertos('Canal').length === 0) {
      Reenviarmediawhatsapp(Credenciales.celularadmin, 'image', Idimagen, `Comprobante con anomalía · ${Codigo} (${Reserva[2]})\n${Validaciondest.motivo}`);
    }
    return { exito: false, confirmada: false, encanal: true, anomalia: Validaciondest.motivo };
  }
  if (Montoleido < Minimo) {
    Abrircanaladministrador(Destinocliente, Codigo, 'comprobante', `Monto captura ($${Montoleido.toLocaleString('es-CO')}) menor al requerido ($${Minimo.toLocaleString('es-CO')})`);
    return { exito: false, confirmada: false, encanal: true };
  }

  if (Esampliacion) {
    const Horasalida = String(Reserva[24] || 'ampliada'), Hab = String(Reserva[5]).padStart(2, '0');
    Hojareservas.getRange(Indice, 12).setValue(Number(Reserva[11] || 0) + Montoleido);
    Hojareservas.getRange(Indice, 13).setValue(Number(Reserva[12] || 0) + Montoleido);
    Hojareservas.getRange(Indice, 24).setValue(Sanitizarcelda(String(Reserva[23]).replace('pendiente transferencia', 'pagada por transferencia'), 140));
    Enviarmensajewhatsapp(Destinocliente, `Comprobante recibido. Tu ampliación de check-out de la habitación ${Hab} hasta las ${Horasalida} está confirmada.`);
    const Capamp = `Ampliación pagada por ${Entidadleida} · ${Codigo} (Hab. ${Hab} · ${Reserva[2]})\nSalida: ${Horasalida} · Monto captura: $${Montoleido.toLocaleString('es-CO')} COP (ref. ${Refguardar})\n\nRecuerda revisar los movimientos de tu app Nequi para verificar el ingreso. Si ves alguna anomalía, abre canal con:\nabrir canal con ${Numcmd}`;
    if (!(Idimagen && Reenviarmediawhatsapp(Credenciales.celularadmin, 'image', Idimagen, Capamp))) { Enviarmensajeinteligente(Credenciales.celularadmin, Capamp, '', []); }
    return { exito: true, confirmada: true, codigo: Codigo };
  }

  const Filaact = Hojareservas.getRange(Indice, 1, 1, 28).getValues()[0];
  Confirmarreservaynotificar(Hojareservas, Hojahabitaciones, Indice, Filaact, Montoleido, Refguardar, Entidadleida, 'CAPTURA-NEQUI', Idimagen);
  return { exito: true, confirmada: true, codigo: Codigo, idpago: 'CAPTURA-NEQUI' };
}

function Intentarcruzarcomprobante(Codigoreserva) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Obtenerhojareservas(), Hojapagos = Libro.getSheetByName('Pagosrecibidos');
  if (!Hojareservas || !Hojapagos || Hojapagos.getLastRow() < 2) { return { confirmada: false }; }
  const Filasres = Hojareservas.getDataRange().getValues();
  let Indice = -1, Reserva = null;
  for (let I = 1; I < Filasres.length; I++) {
    const Estfila = String(Filasres[I][15]);
    if (String(Filasres[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase() && (Estfila === 'Confirmada' || Estfila === 'Verificando')) {
      Indice = I + 1; Reserva = Filasres[I]; break;
    }
  }
  if (!Reserva || String(Reserva[22] || '').indexOf('BANCO-') === 0) { return { confirmada: Boolean(Reserva && String(Reserva[15]) === 'Confirmada') }; }
  const Refcap = Normalizarreferencia(Reserva[20] || Reserva[13]), Montocap = Number(Reserva[19] || Reserva[12] || 0);
  const Filaspagos = Hojapagos.getRange(2, 1, Hojapagos.getLastRow() - 1, 9).getValues();
  for (let P = 0; P < Filaspagos.length; P++) {
    if (String(Filaspagos[P][8] || '') !== 'Libre' || String(Filaspagos[P][7] || '') !== 'SI') { continue; }
    const Montocor = Number(Filaspagos[P][3] || 0), Refcor = Normalizarreferencia(Filaspagos[P][4]);
    const Coincideref = Boolean(Refcap && Refcor && (Refcap === Refcor || Refcor.indexOf(Refcap) !== -1 || Refcap.indexOf(Refcor) !== -1));
    if (Coincideref && Montocor === Montocap && Montocor > 0) {
      const Idpago = String(Filaspagos[P][0]);
      Hojapagos.getRange(P + 2, 9).setValue(`Conciliado en ${Reserva[0]}`);
      Hojareservas.getRange(Indice, 23).setValue(Sanitizarcelda(`BANCO-${Idpago}`, 60));
      return { confirmada: true, codigo: String(Reserva[0]), idpago: Idpago };
    }
  }
  return { confirmada: false };
}

function Confirmarreservaynotificar(Hojareservas, Hojahabitaciones, Indicefila, Reserva, Montopagado, Referencia, Entidad, Idpagobanco, Idimagencaptura) {
  const Codigo = String(Reserva[0]);
  const Hab = String(Reserva[5]).padStart(2, '0');
  const Total = Number(Reserva[11] || 0);
  const Saldo = Math.max(0, Total - Number(Montopagado || 0));
  const Obs = String(Reserva[23] || '').trim();

  Hojareservas.getRange(Indicefila, 13).setValue(Number(Montopagado));
  Hojareservas.getRange(Indicefila, 14).setValue(Sanitizarcelda(Referencia, 60));
  Hojareservas.getRange(Indicefila, 15).setValue(Sanitizarcelda(Entidad, 40));
  Hojareservas.getRange(Indicefila, 16).setValue('Confirmada');
  Hojareservas.getRange(Indicefila, 23).setValue(Sanitizarcelda(Idpagobanco || 'MANUAL', 60));
  Hojareservas.getRange(Indicefila, 24).setValue(Sanitizarcelda(Obs ? `${Obs} · Confirmada` : 'Confirmada por comprobante', 140));
  const Hoytexto = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  if (Normalizarfecha(Reserva[6]) <= Hoytexto) { Cambiarocupacionhabitacion(Hojahabitaciones, Hab, 'Ocupada'); }

  Notificarreservaconfirmada({
    codigo: Codigo, habitacion: Hab, canal: String(Reserva[16] || 'WhatsApp'),
    nombre: String(Reserva[2] || 'Viajero'), cedula: String(Reserva[3] || ''),
    celular: Obtenercelularlegiblereserva(Reserva), idwhatsapp: Obtenerdestinowhatsappreserva(Reserva),
    llegada: Normalizarfecha(Reserva[6]), salida: Normalizarfecha(Reserva[7]),
    noches: Number(Reserva[8] || 1), personas: Number(Reserva[9] || 1),
    horallegada: String(Reserva[10] || 'Por confirmar'), horasalida: String(Reserva[24] || ''),
    total: Total, pagado: Number(Montopagado || 0), entidad: String(Reserva[18]) === 'Mixto' ? 'Mixto (Nequi + Efectivo)' : Entidad, referencia: Referencia,
    observaciones: Obs, idimagencaptura: Idimagencaptura || '', requiererevisionnequi: String(Idpagobanco || '').indexOf('CAPTURA') === 0,
    mensajecliente:
      `Comprobante recibido. Tu reserva ${Codigo} está confirmada en Hospedaje Nissi.\n` +
      `Habitación ${Hab} · ${Normalizarfecha(Reserva[6])} al ${Normalizarfecha(Reserva[7])} · Llegada ${Reserva[10] || 'Por confirmar'} · Check-out ${Formatearhoradoce(Number(Leerconfiguracionhoja().HORACHECKOUT || 11))}.\n` +
      `Pagado por Nequi: $${Number(Montopagado).toLocaleString('es-CO')} · Saldo pendiente en efectivo: $${Saldo.toLocaleString('es-CO')}. Cualquier inconveniente o cancelación puedes gestionarlo por este mismo chat.`
  });
  Registrarbitacora('Pagos', 'Confirmarreserva', `${Codigo} confirmada (${Idpagobanco})`);
}

function Leercorreospago() {
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojapagos = Libro.getSheetByName('Pagosrecibidos');
    const Hojareservas = Obtenerhojareservas();
    const Config = Leerconfiguracionhoja();
    if (!Hojapagos) { return; }

    const Dominiospermitidos = String(Config.REMITENTESBANCOS || '').toLowerCase().split(',').map(function(D) { return D.trim(); }).filter(Boolean);
    const Etiquetaprocesado = GmailApp.getUserLabelByName('Pagos-Nissi/Procesado') || GmailApp.createLabel('Pagos-Nissi/Procesado');
    const Hilos = GmailApp.search('label:Pagos-Nissi -label:Pagos-Nissi-Procesado newer_than:2d', 0, 20);

    Hilos.forEach(function(Hilo) {
      Hilo.getMessages().forEach(function(Msg) {
        const Idmsg = Msg.getId();
        const Remitente = String(Msg.getFrom() || '').toLowerCase();
        const Crudo = Msg.getRawContent();
        const Dkimok = /Authentication-Results:[\s\S]*?dkim=pass/i.test(Crudo);
        const Dominiovalido = Dominiospermitidos.some(function(Dom) { return Remitente.indexOf(Dom) !== -1; });

        if (!Dkimok || !Dominiovalido) {
          Registrarbitacora('CorreosPago', 'Descartado', `Remitente: ${Remitente} · DKIM: ${Dkimok}`);
          return;
        }
        const Extraido = Extraerdatoscorreobanco(Msg.getSubject(), Msg.getPlainBody(), Remitente);
        if (Extraido && Extraido.monto > 0) {
          Hojapagos.appendRow([Idmsg, Formatearfechahora(Msg.getDate()), Extraido.entidad, Extraido.monto, Sanitizarcelda(Extraido.referencia, 60), Sanitizarcelda(Extraido.pagador || '', 80), Sanitizarcelda(Remitente, 100), 'SI', 'Libre']);
        }
      });
      Hilo.addLabel(Etiquetaprocesado);
    });

    if (Hojareservas && Hojareservas.getLastRow() >= 2) {
      Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, 16).getValues().forEach(function(F) {
        if (String(F[15]) === 'Verificando') { Intentarcruzarcomprobante(String(F[0])); }
      });
    }
  } catch (Errorlectura) {
    Registrarbitacora('CorreosPago', 'Error', String(Errorlectura));
  }
}

function Extraerdatoscorreobanco(Asunto, Cuerpo, Remitente) {
  const Texto = `${Asunto || ''}\n${Cuerpo || ''}`;
  const Entidad = (/nequi/i.test(Remitente) || /nequi/i.test(Texto)) ? 'Nequi' : 'Transferencia';
  const Coincidenciamonto = Texto.match(/\$\s*([\d.]+(?:,\d{2})?)/);
  const Monto = Coincidenciamonto ? Number(Coincidenciamonto[1].replace(/\./g, '').split(',')[0]) : 0;
  const Coincidenciaref = Texto.match(/(?:referencia|comprobante|aprobaci[oó]n|cus|transacci[oó]n|n[uú]mero)[:\s#]*([A-Za-z0-9\-]{4,25})/i);
  const Referencia = Coincidenciaref ? Coincidenciaref[1] : '';
  return (Monto > 0 && Referencia) ? { entidad: Entidad, monto: Monto, referencia: Referencia, pagador: '' } : null;
}

function Revisarapartados() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Obtenerhojareservas();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Config = Leerconfiguracionhoja();
  const Ahorams = Date.now();

  if (Hojareservas && Hojareservas.getLastRow() >= 2) {
    const Filas = Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, 28).getValues();
    for (let I = 0; I < Filas.length; I++) {
      const Estado = String(Filas[I][15]);
      const Celular = Obtenerdestinowhatsappreserva(Filas[I]);
      const Codigo = String(Filas[I][0]);
      const Marcatiempo = new Date(Filas[I][17] || Filas[I][1]).getTime();

      if (Estado === 'Apartada' && !isNaN(Marcatiempo) && Ahorams > Marcatiempo) {
        Hojareservas.getRange(I + 2, 16).setValue('Vencida');
        Hojareservas.getRange(I + 2, 24).setValue('Vencida por superar 30 min sin comprobante');
        if (Hojahabitaciones) { Cambiarocupacionhabitacion(Hojahabitaciones, Filas[I][5], 'Disponible'); }
        if (Celular) {
          Actualizarconversacion(Celular, { idinteraccionia: '', codigoreserva: '' });
          Enviarmensajewhatsapp(Celular, 'Tu apartado venció; si aún la quieres, te reviso disponibilidad.');
        }
        Notificaresperahabitacion(Filas[I][5]);
      } else if (Estado === 'Apartada' && !isNaN(Marcatiempo) && (Marcatiempo - Ahorams) / 60000 <= 15) {
        const Obsactual = String(Filas[I][23] || '');
        if (Obsactual.indexOf('Recordatorio 15m') === -1 && Celular) {
          const Habnum = String(Filas[I][5]).padStart(2, '0');
          Hojareservas.getRange(I + 2, 24).setValue(`${Obsactual} · Recordatorio 15m`);
          Enviarmensajewhatsapp(Celular, `Hola, te recordamos desde la recepción de Hospedaje Nissi que tu habitación ${Habnum} (reserva ${Codigo}) sigue apartada por 15 minutos más. Quedamos atentos a tus datos o al comprobante de pago para dejártela confirmada.`);
        }
      } else if (Estado === 'Verificando' && !isNaN(Marcatiempo)) {
        const Minutosespera = (Ahorams - Marcatiempo) / 60000;
        if (Minutosespera >= Number(Config.MINUTOSESPERACORREO || 20)) {
          Abrircanaladministrador(Celular, Codigo, 'tiempo_correo', 'Superó 20 min esperando correo del banco');
        }
      }
    }
  }

  if (typeof Revisarhabitacioneslimpieza === 'function') { Revisarhabitacioneslimpieza(); }
}

function Registrarosincronizarreserva(Datos, Autorizadoadmin) {
  if (Autorizadoadmin && Datos.estado === 'Confirmada') {
    const Res = Apartarhabitacion(Datos.celular, Datos.habitacion, Datos.llegada, Datos.salida, Datos.huespedes, 'Recepcion', Datos.camasseparadas);
    if (!Res.exito) { return Res; }
    Guardardatoshuesped(Datos.celular, Res.codigo, Datos.nombre, Datos.cedula, Datos.horallegada, Datos.celular);
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojares = Obtenerhojareservas();
    const Hojahab = Libro.getSheetByName('Habitaciones');
    const Ult = Hojares.getLastRow();
    const Esmixto = String(Datos.entidadpago || '').toLowerCase().indexOf('mixt') !== -1 || (Number(Datos.montonequi) > 0 && Number(Datos.montoefectivo) > 0);
    if (Esmixto) {
      Hojares.getRange(Ult, 19).setValue('Mixto');
      const Obs = String(Hojares.getRange(Ult, 24).getValue() || '').trim();
      Hojares.getRange(Ult, 24).setValue(Sanitizarcelda(`${Obs} · [Mixto Nequi:${Datos.montonequi || 0} Efectivo:${Datos.montoefectivo || 0}]`, 140));
    } else {
      Hojares.getRange(Ult, 19).setValue(Sanitizarcelda(Datos.entidadpago || 'Efectivo', 30));
    }
    Confirmarreservaynotificar(Hojares, Hojahab, Ult, Hojares.getRange(Ult, 1, 1, 28).getValues()[0], Datos.montopagado || Res.montototal, Datos.referenciapago || 'Presencial', Datos.entidadpago || 'Efectivo', 'PRESENCIAL');
    const Tlleg = typeof Parsearfechahorallegada === 'function' ? Parsearfechahorallegada(Datos.llegada, Datos.horallegada) : 0;
    if (Tlleg && (Tlleg - Date.now()) < 15 * 60000 && typeof Guardarestadollegada === 'function') { Guardarestadollegada(Res.codigo, { ok: 1 }); }
    return Res;
  }
  const Apartado = Apartarhabitacion(Datos.celular, Datos.habitacion, Datos.llegada, Datos.salida, Datos.huespedes, 'Web', Datos.camasseparadas);
  if (Apartado.exito) { Guardardatoshuesped(Datos.celular, Apartado.codigo, Datos.nombre, Datos.cedula, Datos.horallegada, Datos.celular); }
  return Apartado;
}

function Liberarhabitacionesvencidas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Obtenerhojareservas();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojareservas || !Hojahabitaciones) { return; }
  const Ahora = new Date(), Props = PropertiesService.getScriptProperties();
  const Horacheckoutbase = Number(Leerconfiguracionhoja().HORACHECKOUT || 11);
  const Hoytexto = Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  const Horaactual = parseInt(Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'HH'), 10);
  const Filas = Hojareservas.getDataRange().getValues();
  const Activas = {};

  for (let I = 1; I < Filas.length; I++) {
    const Estfila = String(Filas[I][15]);
    const Numhab = String(Filas[I][5]).padStart(2, '0');
    if (Estfila === 'Confirmada') {
      const Llegada = Normalizarfecha(Filas[I][6]);
      const Salida = Normalizarfecha(Filas[I][7]);
      const Horasalida = Interpretahorasalida(Filas[I][24]) || Horacheckoutbase;
      if (Salida < Hoytexto || (Salida === Hoytexto && Horaactual >= Horasalida)) {
        Hojareservas.getRange(I + 1, 16).setValue('Finalizada');
        Props.deleteProperty(`LLEGADA_${String(Filas[I][0])}`);
        Activas[Numhab] = 'Limpieza';
      } else if (Llegada <= Hoytexto && Salida >= Hoytexto) {
        Activas[Numhab] = 'Ocupada';
      }
    } else if (Reservaestabloqueando(Filas[I], Ahora.getTime())) {
      if (!Activas[Numhab]) { Activas[Numhab] = 'Apartada'; }
    }
  }
  const Filashab = Hojahabitaciones.getDataRange().getValues();
  for (let J = 1; J < Filashab.length; J++) {
    const Numhab = String(Filashab[J][0]).padStart(2, '0');
    const Estadoactual = String(Filashab[J][5]);
    if (Numhab === '03' || Estadoactual === 'Mantenimiento') { continue; }
    if (Activas[Numhab] === 'Limpieza' || (Estadoactual === 'Limpieza' && !Activas[Numhab])) {
      if (Estadoactual !== 'Limpieza') {
        Cambiarocupacionhabitacion(Hojahabitaciones, Numhab, 'Limpieza');
        if (typeof Enviaravisolimpiezaadmin === 'function') { Enviaravisolimpiezaadmin(Numhab); }
      }
      continue;
    }
    const Nuevoestado = Activas[Numhab] || 'Disponible';
    if (Estadoactual !== Nuevoestado) { Cambiarocupacionhabitacion(Hojahabitaciones, Numhab, Nuevoestado); }
  }
}
