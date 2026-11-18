// Verificacion de pagos, lectura de correos bancarios y vencimiento de apartados

function Normalizarreferencia(Ref) {
  return String(Ref || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// Guarda los datos leidos de la captura, pasa a Verificando e intenta cruzar con los correos
function Registrarcomprobante(Celularcliente, Codigoreserva, Datoscomprobante) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojapagos = Libro.getSheetByName('Pagosrecibidos');
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');
  const Reflimpia = Normalizarreferencia(Datoscomprobante.referencia);
  const Montoleido = Number(Datoscomprobante.monto || 0);
  const Entidadleida = Sanitizarcelda(Datoscomprobante.entidad || 'Transferencia', 40);
  const Fechaleida = Sanitizarcelda(Datoscomprobante.fecha || Formatearfechahora(new Date()), 30);

  const Filasres = Hojareservas.getDataRange().getValues();
  let Indice = -1;
  let Codigo = Codigoreserva || '';

  for (let I = Filasres.length - 1; I >= 1; I--) {
    const Coincide = (Codigo && String(Filasres[I][0]).toUpperCase() === String(Codigo).toUpperCase()) || (Celularlimpio && String(Filasres[I][3]).replace(/\D/g, '') === Celularlimpio);
    const Est = String(Filasres[I][14]);
    const Esampliacion = Est === 'Confirmada' && String(Filasres[I][22] || '').indexOf('pendiente transferencia') !== -1;
    if (Coincide && (Est === 'Apartada' || Est === 'Verificando' || Esampliacion)) {
      Indice = I + 1; Codigo = String(Filasres[I][0]); break;
    }
  }
  if (Indice < 0) { return { exito: false, mensaje: 'No se encontró una reserva apartada activa para asociar el comprobante.' }; }

  // Verificar si la referencia ya se uso en otra reserva
  if (Reflimpia) {
    for (let J = 1; J < Filasres.length; J++) {
      const Refprevia = Normalizarreferencia(Filasres[J][12] || Filasres[J][19]);
      const Codprevio = String(Filasres[J][0]);
      if (Refprevia && Refprevia === Reflimpia && Codprevio !== Codigo && String(Filasres[J][14]) === 'Confirmada') {
        Hojareservas.getRange(Indice, 15).setValue('Rechazada');
        Hojareservas.getRange(Indice, 23).setValue(`Rechazada: referencia duplicada (${Reflimpia} usada en ${Codprevio})`);
        Enviarmensajewhatsapp(Credenciales.celularadmin, `⚠️ Alerta de posible fraude: el cliente +${Celularlimpio} (${Codigo}) envió un comprobante con referencia ${Reflimpia} que ya fue usada en la reserva ${Codprevio}.`);
        return { exito: false, estado: 'Rechazada', mensaje: 'Este comprobante ya fue utilizado previamente en otra reserva.' };
      }
    }
    if (Hojapagos && Hojapagos.getLastRow() >= 2) {
      const Filaspagos = Hojapagos.getRange(2, 1, Hojapagos.getLastRow() - 1, 9).getValues();
      const Reusado = Filaspagos.find(function(P) {
        return Normalizarreferencia(P[4]) === Reflimpia && String(P[8]).indexOf('Usado') === 0 && String(P[8]).indexOf(Codigo) === -1;
      });
      if (Reusado) {
        Hojareservas.getRange(Indice, 15).setValue('Rechazada');
        Enviarmensajewhatsapp(Credenciales.celularadmin, `⚠️ Alerta de posible fraude: referencia ${Reflimpia} en ${Codigo} ya figura como "${Reusado[8]}".`);
        return { exito: false, estado: 'Rechazada', mensaje: 'Este comprobante ya fue registrado en otra reserva.' };
      }
    }
  }

  const Ahoratexto = Formatearfechahora(new Date());
  const Filaact = Filasres[Indice - 1];
  const Esampliacion = String(Filaact[14]) === 'Confirmada' && String(Filaact[22] || '').indexOf('pendiente transferencia') !== -1;
  Hojareservas.getRange(Indice, 14).setValue(Entidadleida);
  if (!Esampliacion) { Hojareservas.getRange(Indice, 15).setValue('Verificando'); }
  Hojareservas.getRange(Indice, 17).setValue(Ahoratexto);
  Hojareservas.getRange(Indice, 18).setValue('Transferencia');
  Hojareservas.getRange(Indice, 19).setValue(Montoleido);
  Hojareservas.getRange(Indice, 20).setValue(Sanitizarcelda(Datoscomprobante.referencia || '', 60));
  Hojareservas.getRange(Indice, 21).setValue(Fechaleida);

  const Resultadocruce = Intentarcruzarcomprobante(Codigo);
  if (Resultadocruce && Resultadocruce.confirmada) {
    return Resultadocruce;
  }

  return {
    exito: true,
    codigo: Codigo,
    estado: 'Verificando',
    mensajecliente: 'Recibí tu comprobante, lo estoy validando con el banco. Te confirmo en unos minutos.'
  };
}

// Compara los datos del comprobante contra la hoja Pagosrecibidos
function Intentarcruzarcomprobante(Codigoreserva) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojapagos = Libro.getSheetByName('Pagosrecibidos');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Config = Leerconfiguracionhoja();
  if (!Hojareservas || !Hojapagos || Hojapagos.getLastRow() < 2) {
    return { confirmada: false };
  }

  const Filasres = Hojareservas.getDataRange().getValues();
  let Indice = -1;
  let Reserva = null;
  for (let I = 1; I < Filasres.length; I++) {
    const Estfila = String(Filasres[I][14]);
    const Obsfila = String(Filasres[I][22] || '');
    const Espagoextra = Estfila === 'Confirmada' && Obsfila.indexOf('pendiente transferencia') !== -1;
    if (String(Filasres[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase() && (Estfila === 'Verificando' || Espagoextra)) {
      Indice = I + 1;
      Reserva = Filasres[I];
      break;
    }
  }
  if (!Reserva) { return { confirmada: false }; }

  const Espagoextra = String(Reserva[14]) === 'Confirmada';
  const Mediopago = String(Reserva[17] || '').toLowerCase();
  const Coincidemixto = String(Reserva[22] || '').match(/\[Mixto Nequi:(\d+)/i);
  const EsMixto = !Espagoextra && Mediopago === 'mixto' && Boolean(Coincidemixto);
  const Montototal = Espagoextra ? Number(Reserva[25] || 0) : (EsMixto ? Number(Coincidemixto[1]) : Number(Reserva[10] || 0));
  const Minimoexigido = Math.round(Montototal * (Number(Config.PAGOMINIMOPORCENTAJE || 100) / 100));
  const Montocaptura = Number(Reserva[18] || 0);
  const Refcaptura = Normalizarreferencia(Reserva[19]);
  const Entidadcaptura = String(Reserva[13] || '').toLowerCase();

  if (Montocaptura < Minimoexigido) {
    Abrircanaladministrador(Reserva[3], Reserva[0], 'comprobante', `Monto ($${Montocaptura.toLocaleString('es-CO')}) menor al 100% exigido ($${Minimoexigido.toLocaleString('es-CO')})`);
    return { confirmada: false, encanal: true };
  }

  const Filaspagos = Hojapagos.getRange(2, 1, Hojapagos.getLastRow() - 1, 9).getValues();
  for (let P = 0; P < Filaspagos.length; P++) {
    const Estadopago = String(Filaspagos[P][8] || '');
    const Dkimok = String(Filaspagos[P][7] || '') === 'SI';
    if (Estadopago !== 'Libre' || !Dkimok) { continue; }

    const Montocorreo = Number(Filaspagos[P][3] || 0);
    const Refcorreo = Normalizarreferencia(Filaspagos[P][4]);
    const Entidadcorreo = String(Filaspagos[P][2] || '').toLowerCase();

    const Coincideref = Boolean(Refcaptura && Refcorreo && (Refcaptura === Refcorreo || Refcorreo.indexOf(Refcaptura) !== -1 || Refcaptura.indexOf(Refcorreo) !== -1));
    const Coincidemonto = Montocorreo === Montocaptura && Montocorreo >= Minimoexigido;
    const Coincideentidad = !Entidadcaptura || !Entidadcorreo || Entidadcaptura.indexOf(Entidadcorreo) !== -1 || Entidadcorreo.indexOf(Entidadcaptura) !== -1;

    if (Coincideref && Coincidemonto && Coincideentidad) {
      const Idpago = String(Filaspagos[P][0]);
      Hojapagos.getRange(P + 2, 9).setValue(`Usado en ${Reserva[0]}`);
      if (Espagoextra) {
        const Nuevototal = Number(Reserva[10] || 0) + Montocorreo;
        const Nuevopagado = Number(Reserva[11] || 0) + Montocorreo;
        const Horasalida = String(Reserva[23] || 'ampliada');
        Hojareservas.getRange(Indice, 11).setValue(Nuevototal);
        Hojareservas.getRange(Indice, 12).setValue(Nuevopagado);
        Hojareservas.getRange(Indice, 23).setValue(Sanitizarcelda(String(Reserva[22]).replace('pendiente transferencia', 'pagada por transferencia'), 140));
        Enviarmensajewhatsapp(Reserva[3], `✅ ¡Pago verificado! Tu ampliación de check-out de la habitación ${String(Reserva[4]).padStart(2, '0')} hasta las ${Horasalida} está confirmada.`);
        Enviarmensajeinteligente(Obtenercredenciales().celularadmin, `✅ Ampliación pagada por transferencia · ${Reserva[0]} (Hab. ${String(Reserva[4]).padStart(2, '0')}) · Nueva salida: ${Horasalida} · $${Montocorreo.toLocaleString('es-CO')} COP.`, '', []);
        return { confirmada: true, codigo: String(Reserva[0]), idpago: Idpago };
      }
      Confirmarreservaynotificar(Hojareservas, Hojahabitaciones, Indice, Reserva, Montocorreo, String(Filaspagos[P][4]), String(Filaspagos[P][2]), Idpago);
      return { confirmada: true, codigo: String(Reserva[0]), idpago: Idpago };
    }
  }
  return { confirmada: false };
}

function Confirmarreservaynotificar(Hojareservas, Hojahabitaciones, Indicefila, Reserva, Montopagado, Referencia, Entidad, Idpagobanco) {
  const Codigo = String(Reserva[0]);
  const Hab = String(Reserva[4]).padStart(2, '0');
  const Total = Number(Reserva[10] || 0);
  const Saldo = Math.max(0, Total - Number(Montopagado || 0));
  const Obs = String(Reserva[22] || '').trim();

  Hojareservas.getRange(Indicefila, 12).setValue(Number(Montopagado));
  Hojareservas.getRange(Indicefila, 13).setValue(Sanitizarcelda(Referencia, 60));
  Hojareservas.getRange(Indicefila, 14).setValue(Sanitizarcelda(Entidad, 40));
  Hojareservas.getRange(Indicefila, 15).setValue('Confirmada');
  Hojareservas.getRange(Indicefila, 22).setValue(Sanitizarcelda(Idpagobanco || 'MANUAL', 60));
  Hojareservas.getRange(Indicefila, 23).setValue(Sanitizarcelda(Obs ? `${Obs} · Confirmada` : 'Confirmada automáticamente', 140));
  const Hoytexto = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  if (Normalizarfecha(Reserva[5]) <= Hoytexto) { Cambiarocupacionhabitacion(Hojahabitaciones, Hab, 'Ocupada'); }

  Notificarreservaconfirmada({
    codigo: Codigo, habitacion: Hab, canal: String(Reserva[15] || 'WhatsApp'),
    nombre: String(Reserva[2] || 'Viajero'), celular: String(Reserva[3] || '').replace(/\D/g, ''),
    llegada: Normalizarfecha(Reserva[5]), salida: Normalizarfecha(Reserva[6]),
    noches: Number(Reserva[7] || 1), personas: Number(Reserva[8] || 1),
    horallegada: String(Reserva[9] || 'Por confirmar'), horasalida: String(Reserva[23] || ''),
    total: Total, pagado: Number(Montopagado || 0), entidad: String(Reserva[17]) === 'Mixto' ? 'Mixto (Nequi + Efectivo)' : Entidad, referencia: Referencia,
    observaciones: Obs,
    mensajecliente:
      `✅ ¡Pago verificado! Tu reserva ${Codigo} está confirmada en Hospedaje Nissi.\n` +
      `Habitación ${Hab} · ${Normalizarfecha(Reserva[5])} al ${Normalizarfecha(Reserva[6])} · Llegada ${Reserva[9] || 'Por confirmar'} · Check-out ${Formatearhora12(Number(Leerconfiguracionhoja().HORACHECKOUT || 11))}.\n` +
      `Pagado por Nequi: $${Number(Montopagado).toLocaleString('es-CO')} · Saldo pendiente en efectivo: $${Saldo.toLocaleString('es-CO')}. Cualquier inconveniente o cancelación puedes gestionarlo por este mismo chat.`
  });
  Registrarbitacora('Pagos', 'Confirmarreserva', `${Codigo} confirmada con pago ${Idpagobanco}`);
}

// Revisa cada 5 minutos los correos del banco con etiqueta Pagos-Nissi y valida DKIM
function Leercorreospago() {
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojapagos = Libro.getSheetByName('Pagosrecibidos');
    const Hojareservas = Libro.getSheetByName('Reservas');
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
      Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, 15).getValues().forEach(function(F) {
        if (String(F[14]) === 'Verificando') { Intentarcruzarcomprobante(String(F[0])); }
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

// Revisa cada 5 minutos los vencimientos de apartados, espera de correo y canales abiertos
function Revisarapartados() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojaconv = Libro.getSheetByName('Conversaciones');
  const Config = Leerconfiguracionhoja();
  const Credenciales = Obtenercredenciales();
  const Ahorams = Date.now();

  if (Hojareservas && Hojareservas.getLastRow() >= 2) {
    const Filas = Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, 23).getValues();
    for (let I = 0; I < Filas.length; I++) {
      const Estado = String(Filas[I][14]);
      const Celular = String(Filas[I][3] || '').replace(/\D/g, '');
      const Codigo = String(Filas[I][0]);
      const Marcatiempo = new Date(Filas[I][16] || Filas[I][1]).getTime();

      if (Estado === 'Apartada' && !isNaN(Marcatiempo) && Ahorams > Marcatiempo) {
        Hojareservas.getRange(I + 2, 15).setValue('Vencida');
        Hojareservas.getRange(I + 2, 23).setValue('Vencida por superar 30 min sin comprobante');
        if (Hojahabitaciones) { Cambiarocupacionhabitacion(Hojahabitaciones, Filas[I][4], 'Disponible'); }
        if (Celular) {
          Actualizarconversacion(Celular, { idinteraccionia: '', codigoreserva: '' });
          Enviarmensajewhatsapp(Celular, 'Tu apartado venció; si aún la quieres, te reviso disponibilidad.');
        }
      } else if (Estado === 'Apartada' && !isNaN(Marcatiempo) && (Marcatiempo - Ahorams) / 60000 <= 15) {
        const Obsactual = String(Filas[I][22] || '');
        if (Obsactual.indexOf('Recordatorio 15m') === -1 && Celular) {
          const Habnum = String(Filas[I][4]).padStart(2, '0');
          Hojareservas.getRange(I + 2, 23).setValue(`${Obsactual} · Recordatorio 15m`);
          Enviarmensajewhatsapp(Celular, `¡Hola! 😊 Te recordamos desde la recepción de Hospedaje Nissi que tu habitación ${Habnum} (reserva ${Codigo}) sigue apartada por 15 minutos más. Quedamos atentos a tus datos o al comprobante de pago para dejártela confirmada.`);
        }
      } else if (Estado === 'Verificando' && !isNaN(Marcatiempo)) {
        const Minutosespera = (Ahorams - Marcatiempo) / 60000;
        if (Minutosespera >= Number(Config.MINUTOSESPERACORREO || 20)) {
          Abrircanaladministrador(Celular, Codigo, 'tiempo_correo', 'Superó 20 min esperando correo del banco');
        }
      }
    }
  }

  if (Hojaconv && Hojaconv.getLastRow() >= 2) {
    const Convfilas = Hojaconv.getRange(2, 1, Hojaconv.getLastRow() - 1, 10).getValues();
    for (let C = 0; C < Convfilas.length; C++) {
      const Modoc = String(Convfilas[C][2]);
      if (Modoc !== 'Canal' && Modoc !== 'PendienteAdmin') { continue; }
      const Celcliente = String(Convfilas[C][0]).replace(/\D/g, '');
      const Nombrec = String(Convfilas[C][1] || 'Cliente');
      const Codres = String(Convfilas[C][3] || '');
      const Aperturams = new Date(Convfilas[C][6]).getTime();
      const Ultadminms = Convfilas[C][5] ? new Date(Convfilas[C][5]).getTime() : 0;
      const Ultrecordms = Convfilas[C][8] ? new Date(Convfilas[C][8]).getTime() : Aperturams;
      if (isNaN(Aperturams)) { continue; }

      const Minabierto = (Ahorams - Aperturams) / 60000;
      if (Minabierto >= Number(Config.MINUTOSCIERREAUTO || 120)) {
        Cerrarcanalyactualizarreserva(Celcliente, false, 'cierre_automatico_2h');
        continue;
      }
      const Limiteaviso = Modoc === 'PendienteAdmin' ? 5 : Number(Config.MINUTOSAVISOCANAL || 15);
      if (Minabierto >= Limiteaviso && Ultadminms < Aperturams && String(Convfilas[C][7]) !== 'SI') {
        const Msgdemora = Modoc === 'PendienteAdmin'
          ? 'Seguimos buscando a un administrador disponible para atenderte. Por favor permanece en línea en el chat.'
          : 'Un administrador te responderá en breve. Por favor permanece en línea en el chat.';
        Enviarmensajewhatsapp(Celcliente, Msgdemora);
        Hojaconv.getRange(C + 2, 8).setValue('SI');
      }
      if ((Ahorams - Ultrecordms) / 60000 >= Number(Config.MINUTOSRECORDATORIOCANAL || 10)) {
        const Msgrec = Modoc === 'PendienteAdmin'
          ? `⏰ Recordatorio: el cliente "${Nombrec}" (${Codres}) sigue esperando atención hace ${Math.round(Minabierto)} min.\n¿Comenzar atención con el cliente "${Nombrec}"?\nResponde: SI`
          : `⏰ Recordatorio: tienes el canal ${Codres} (+${Celcliente}) abierto hace ${Math.round(Minabierto)} min. Responde al cliente o ciérralo con "reserva confirmada finalizar" o "reserva rechazada finalizar".`;
        Enviarmensajeinteligente(Credenciales.celularadmin, Msgrec, 'canal_efectivo_admin', []);
        Hojaconv.getRange(C + 2, 9).setValue(Formatearfechahora(new Date()));
      }
    }
  }
  if (typeof Revisarhabitacioneslimpieza === 'function') { Revisarhabitacioneslimpieza(); }
}

// Compatibilidad con formulario web y check-in presencial de recepcion + reloj horario de salidas
function Registrarosincronizarreserva(Datos) {
  if (Datos.estado === 'Confirmada') {
    const Res = Apartarhabitacion(Datos.celular, Datos.habitacion, Datos.llegada, Datos.salida, Datos.huespedes, 'Recepcion', Datos.camasseparadas);
    if (!Res.exito) { return Res; }
    Guardardatoshuesped(Datos.celular, Res.codigo, Datos.nombre, Datos.cedula, Datos.horallegada);
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojares = Libro.getSheetByName('Reservas');
    const Hojahab = Libro.getSheetByName('Habitaciones');
    const Ult = Hojares.getLastRow();
    const EsMixto = String(Datos.entidadpago || '').toLowerCase().indexOf('mixt') !== -1 || (Number(Datos.montonequi) > 0 && Number(Datos.montoefectivo) > 0);
    if (EsMixto) {
      Hojares.getRange(Ult, 18).setValue('Mixto');
      const Obs = String(Hojares.getRange(Ult, 23).getValue() || '').trim();
      Hojares.getRange(Ult, 23).setValue(Sanitizarcelda(`${Obs} · [Mixto Nequi:${Datos.montonequi || 0} Efectivo:${Datos.montoefectivo || 0}]`, 140));
    } else {
      Hojares.getRange(Ult, 18).setValue(Sanitizarcelda(Datos.entidadpago || 'Efectivo', 30));
    }
    Confirmarreservaynotificar(Hojares, Hojahab, Ult, Hojares.getRange(Ult, 1, 1, 26).getValues()[0], Datos.montopagado || Res.montototal, Datos.referenciapago || 'Presencial', Datos.entidadpago || 'Efectivo', 'PRESENCIAL');
    return Res;
  }
  const Apartado = Apartarhabitacion(Datos.celular, Datos.habitacion, Datos.llegada, Datos.salida, Datos.huespedes, 'Web', Datos.camasseparadas);
  if (Apartado.exito) { Guardardatoshuesped(Datos.celular, Apartado.codigo, Datos.nombre, Datos.cedula, Datos.horallegada); }
  return Apartado;
}

function Liberarhabitacionesvencidas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojareservas || !Hojahabitaciones) { return; }
  const Ahora = new Date();
  const Horacheckoutbase = Number(Leerconfiguracionhoja().HORACHECKOUT || 11);
  const Hoytexto = Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  const Horaactual = parseInt(Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'HH'), 10);
  const Filas = Hojareservas.getDataRange().getValues();
  const Activas = {};

  for (let I = 1; I < Filas.length; I++) {
    const Estfila = String(Filas[I][14]);
    const Numhab = String(Filas[I][4]).padStart(2, '0');
    if (Estfila === 'Confirmada') {
      const Llegada = Normalizarfecha(Filas[I][5]);
      const Salida = Normalizarfecha(Filas[I][6]);
      const Horasalida = Interpretahorasalida(Filas[I][23]) || Horacheckoutbase;
      if (Salida < Hoytexto || (Salida === Hoytexto && Horaactual >= Horasalida)) {
        Hojareservas.getRange(I + 1, 15).setValue('Finalizada');
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
