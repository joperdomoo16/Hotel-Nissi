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
    const Coincidecod = Codigo && String(Filasres[I][0]).toUpperCase() === String(Codigo).toUpperCase();
    const Coincidecel = Celularlimpio && String(Filasres[I][3]).replace(/\D/g, '') === Celularlimpio;
    const Est = String(Filasres[I][14]);
    if ((Coincidecod || Coincidecel) && (Est === 'Apartada' || Est === 'Verificando')) {
      Indice = I + 1;
      Codigo = String(Filasres[I][0]);
      break;
    }
  }

  if (Indice < 0) {
    return { exito: false, mensaje: 'No se encontró una reserva apartada activa para asociar el comprobante.' };
  }

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
  Hojareservas.getRange(Indice, 14).setValue(Entidadleida);
  Hojareservas.getRange(Indice, 15).setValue('Verificando');
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
    if (String(Filasres[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase() && String(Filasres[I][14]) === 'Verificando') {
      Indice = I + 1;
      Reserva = Filasres[I];
      break;
    }
  }
  if (!Reserva) { return { confirmada: false }; }

  const Montototal = Number(Reserva[10] || 0);
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
      Confirmarreservaynotificar(Hojareservas, Hojahabitaciones, Indice, Reserva, Montocorreo, String(Filaspagos[P][4]), String(Filaspagos[P][2]), Idpago);
      return { confirmada: true, codigo: String(Reserva[0]), idpago: Idpago };
    }
  }
  return { confirmada: false };
}

function Confirmarreservaynotificar(Hojareservas, Hojahabitaciones, Indicefila, Reserva, Montopagado, Referencia, Entidad, Idpagobanco) {
  const Codigo = String(Reserva[0]);
  const Nombre = String(Reserva[2] || 'Viajero');
  const Celular = String(Reserva[3] || '').replace(/\D/g, '');
  const Hab = String(Reserva[4]).padStart(2, '0');
  const Llegada = String(Reserva[5]).slice(0, 10);
  const Salida = String(Reserva[6]).slice(0, 10);
  const Noches = Number(Reserva[7] || 1);
  const Personas = Number(Reserva[8] || 2);
  const Hora = String(Reserva[9] || 'Por confirmar');
  const Total = Number(Reserva[10] || 0);
  const Saldo = Math.max(0, Total - Number(Montopagado || 0));

  Hojareservas.getRange(Indicefila, 12).setValue(Number(Montopagado));
  Hojareservas.getRange(Indicefila, 13).setValue(Sanitizarcelda(Referencia, 60));
  Hojareservas.getRange(Indicefila, 14).setValue(Sanitizarcelda(Entidad, 40));
  Hojareservas.getRange(Indicefila, 15).setValue('Confirmada');
  Hojareservas.getRange(Indicefila, 22).setValue(Sanitizarcelda(Idpagobanco || 'MANUAL', 60));
  Hojareservas.getRange(Indicefila, 23).setValue('Confirmada por coincidencia con correo bancario');

  Cambiarocupacionhabitacion(Hojahabitaciones, Hab, 'Ocupada');

  // Mensaje de confirmacion al cliente
  const Msgcliente =
    `✅ ¡Pago verificado! Tu reserva ${Codigo} está confirmada.\n` +
    `Habitación ${Hab} · ${Llegada} al ${Salida} · Llegada ${Hora}.\n` +
    `Pagado: $${Number(Montopagado).toLocaleString('es-CO')} · Saldo al llegar: $${Saldo.toLocaleString('es-CO')}.\n` +
    `Te esperamos en Hospedaje Nissi.`;
  if (Celular) {
    Enviarmensajeinteligente(Celular, Msgcliente, 'reserva_confirmada_cliente', [Nombre, Codigo]);
  }

  // Resumen de reserva confirmada para el administrador
  const Resumenadmin =
    `✅ Reserva confirmada · ${Codigo}\n` +
    `Habitación: ${Hab}\n` +
    `Huésped: ${Nombre}\n` +
    `Celular: ${Celular}\n` +
    `Estadía: ${Llegada} al ${Salida} (${Noches} noche${Noches > 1 ? 's' : ''}) · ${Personas} personas\n` +
    `Llegada estimada: ${Hora}\n` +
    `Total: $${Total.toLocaleString('es-CO')} · Pagado: $${Number(Montopagado).toLocaleString('es-CO')} (${Entidad} · ref. ${Referencia})\n` +
    `Saldo por cobrar: $${Saldo.toLocaleString('es-CO')}`;

  Notificaradministradorwhatsapp(Resumenadmin, [
    Codigo, Hab, Nombre, '-', Celular, Llegada, Salida, Personas, Hora,
    Total.toLocaleString('es-CO'), Number(Montopagado).toLocaleString('es-CO'), Entidad, Referencia, Saldo.toLocaleString('es-CO')
  ]);
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
          Hojapagos.appendRow([
            Idmsg, Formatearfechahora(Msg.getDate()), Extraido.entidad, Extraido.monto,
            Sanitizarcelda(Extraido.referencia, 60), Sanitizarcelda(Extraido.pagador || '', 80),
            Sanitizarcelda(Remitente, 100), 'SI', 'Libre'
          ]);
        }
      });
      Hilo.addLabel(Etiquetaprocesado);
    });

    if (Hojareservas && Hojareservas.getLastRow() >= 2) {
      const Filasres = Hojareservas.getRange(2, 1, Hojareservas.getLastRow() - 1, 15).getValues();
      Filasres.forEach(function(F) {
        if (String(F[14]) === 'Verificando') {
          Intentarcruzarcomprobante(String(F[0]));
        }
      });
    }
  } catch (Errorlectura) {
    Registrarbitacora('CorreosPago', 'Error', String(Errorlectura));
  }
}

function Extraerdatoscorreobanco(Asunto, Cuerpo, Remitente) {
  const Texto = `${Asunto || ''}\n${Cuerpo || ''}`;
  let Entidad = 'Bancolombia';
  if (/nequi/i.test(Remitente) || /nequi/i.test(Texto)) { Entidad = 'Nequi'; }
  else if (/daviplata|davivienda/i.test(Remitente) || /daviplata/i.test(Texto)) { Entidad = 'Daviplata'; }

  const Coincidenciamonto = Texto.match(/\$\s*([\d.]+(?:,\d{2})?)/);
  const Monto = Coincidenciamonto ? Number(Coincidenciamonto[1].replace(/\./g, '').split(',')[0]) : 0;
  const Coincidenciaref = Texto.match(/(?:referencia|comprobante|aprobaci[oó]n|cus|transacci[oó]n|n[uú]mero)[:\s#]*([A-Za-z0-9\-]{4,25})/i);
  const Referencia = Coincidenciaref ? Coincidenciaref[1] : '';

  if (Monto > 0 && Referencia) {
    return { entidad: Entidad, monto: Monto, referencia: Referencia, pagador: '' };
  }
  return null;
}

// Revisa cada 5 minutos los vencimientos de apartados, espera de correo y canales abiertos
function Revisarapartados() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
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
        if (Celular) {
          Enviarmensajewhatsapp(Celular, 'Tu apartado venció; si aún la quieres, te reviso disponibilidad.');
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
      if (String(Convfilas[C][2]) !== 'Canal') { continue; }
      const Celcliente = String(Convfilas[C][0]).replace(/\D/g, '');
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
      if (Minabierto >= Number(Config.MINUTOSAVISOCANAL || 15) && Ultadminms < Aperturams && String(Convfilas[C][7]) !== 'SI') {
        Enviarmensajewhatsapp(Celcliente, 'Un administrador te responderá en breve.');
        Hojaconv.getRange(C + 2, 8).setValue('SI');
      }
      if ((Ahorams - Ultrecordms) / 60000 >= Number(Config.MINUTOSRECORDATORIOCANAL || 10)) {
        Enviarmensajewhatsapp(Credenciales.celularadmin, `⏰ Recordatorio: tienes el canal ${Codres} (+${Celcliente}) abierto hace ${Math.round(Minabierto)} min. Responde al cliente o ciérralo con "reserva confirmada finalizar" o "reserva rechazada finalizar".`);
        Hojaconv.getRange(C + 2, 9).setValue(Formatearfechahora(new Date()));
      }
    }
  }
}

// Compatibilidad con formulario web y check-in presencial de recepcion + reloj horario de salidas
function Registrarosincronizarreserva(Datos) {
  if (Datos.estado === 'Confirmada') {
    const Res = Apartarhabitacion(Datos.celular, Datos.habitacion, Datos.llegada, Datos.salida, Datos.huespedes, 'Recepcion');
    if (!Res.exito) { return Res; }
    Guardardatoshuesped(Datos.celular, Res.codigo, Datos.nombre, Datos.cedula, Datos.horallegada);
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojares = Libro.getSheetByName('Reservas');
    const Hojahab = Libro.getSheetByName('Habitaciones');
    const Ult = Hojares.getLastRow();
    Confirmarreservaynotificar(Hojares, Hojahab, Ult, Hojares.getRange(Ult, 1, 1, 23).getValues()[0], Datos.montopagado || Res.montototal, Datos.referenciapago || 'Presencial', Datos.entidadpago || 'Efectivo', 'PRESENCIAL');
    return Res;
  }
  const Apartado = Apartarhabitacion(Datos.celular, Datos.habitacion, Datos.llegada, Datos.salida, Datos.huespedes, 'Web');
  if (Apartado.exito) {
    Guardardatoshuesped(Datos.celular, Apartado.codigo, Datos.nombre, Datos.cedula, Datos.horallegada);
  }
  return Apartado;
}

function Liberarhabitacionesvencidas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojareservas || !Hojahabitaciones) { return; }
  const Ahora = new Date();
  const Hoytexto = Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  const Horaactual = parseInt(Utilities.formatDate(Ahora, Parametrosistema.zonahoraria, 'HH'), 10);
  const Filas = Hojareservas.getDataRange().getValues();
  const Activas = {};

  for (let I = 1; I < Filas.length; I++) {
    if (String(Filas[I][14]) === 'Confirmada') {
      const Numhab = String(Filas[I][4]).padStart(2, '0');
      const Llegada = Utilities.formatDate(new Date(Filas[I][5]), Parametrosistema.zonahoraria, 'yyyy-MM-dd');
      const Salida = Utilities.formatDate(new Date(Filas[I][6]), Parametrosistema.zonahoraria, 'yyyy-MM-dd');
      if (Salida < Hoytexto || (Salida === Hoytexto && Horaactual >= Parametrosistema.horacheckout)) {
        Hojareservas.getRange(I + 1, 15).setValue('Finalizada');
      } else if (Llegada <= Hoytexto && Salida >= Hoytexto) {
        Activas[Numhab] = true;
      }
    }
  }
  const Filashab = Hojahabitaciones.getDataRange().getValues();
  for (let J = 1; J < Filashab.length; J++) {
    const Numhab = String(Filashab[J][0]).padStart(2, '0');
    const Nuevoestado = Activas[Numhab] ? 'Ocupada' : 'Disponible';
    if (String(Filashab[J][5]) !== Nuevoestado) {
      Cambiarocupacionhabitacion(Hojahabitaciones, Numhab, Nuevoestado);
    }
  }
}
