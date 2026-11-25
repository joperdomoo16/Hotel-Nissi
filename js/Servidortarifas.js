// Tarifas por cantidad de personas, catálogo real de habitaciones y ampliación de check-out

const Catalogoreal = [
  ['01', 'Triple (Queen + Sencilla)', '1 a 3 personas', 3, 55000, 'Disponible', '1 cama queen y 1 cama sencilla', 'SI', 'Aire acondicionado, Wi-Fi, TV, parqueadero'],
  ['02', 'Triple (Queen + Sencilla)', '1 a 3 personas', 3, 55000, 'Disponible', '1 cama queen y 1 cama sencilla', 'SI', 'Aire acondicionado, Wi-Fi, TV, parqueadero'],
  ['03', 'En rediseño', 'No disponible', 0, 0, 'Mantenimiento', 'En rediseño', 'NO', 'En remodelación'],
  ['04', 'Doble', '1 a 2 personas', 2, 55000, 'Disponible', '1 cama doble', 'NO', 'Aire acondicionado, Wi-Fi, TV, parqueadero'],
  ['05', 'Doble', '1 a 2 personas', 2, 55000, 'Disponible', '1 cama doble', 'NO', 'Aire acondicionado, Wi-Fi, TV, parqueadero'],
  ['06', 'Triple (Doble + Sencilla)', '1 a 3 personas', 3, 55000, 'Disponible', '1 cama doble y 1 cama sencilla', 'SI', 'Aire acondicionado, Wi-Fi, TV, parqueadero']
];

const Parametrostarifasbase = [
  ['TARIFA1PERSONA', '55000', 'Tarifa por noche para 1 persona en cualquier habitación'],
  ['TARIFA2PERSONASCAMACOMPARTIDA', '70000', 'Tarifa por noche para 2 personas compartiendo cama doble o queen'],
  ['TARIFA2PERSONASCAMASSEPARADAS', '90000', 'Tarifa por noche para 2 personas usando cada uno su propia cama'],
  ['TARIFA3PERSONAS', '110000', 'Tarifa por noche para 3 personas ($110.000 COP)'],
  ['VALORHORAADICIONAL', '10000', 'Costo en COP por cada hora adicional después del check-out'],
  ['HORACHECKOUT', '11', 'Hora estándar de check-out en formato 24h (11 = 11:00 a. m.)'],
  ['MINUTOSRECORDATORIOLIMPIEZA', '20', 'Minutos entre avisos al admin por habitación pendiente de limpieza']
];

function Habitacionadmitecamasseparadas(Numerohab) {
  const Num = String(Numerohab || '').padStart(2, '0');
  return Num === '01' || Num === '02' || Num === '06';
}

function Calculartarifanoche(Cantidadhuespedes, Camasseparadas, Numerohab) {
  const Config = Leerconfiguracionhoja(), Personas = parseInt(Cantidadhuespedes || 1, 10);
  if (Personas > 3) { return { exito: false, requiereadmin: true, mensaje: 'Para grupos de más de 3 personas se requiere atención directa de un administrador.' }; }
  const T1 = Number(Config.TARIFA1PERSONA || 55000), T2c = Number(Config.TARIFA2PERSONASCAMACOMPARTIDA || 70000);
  const T2s = Number(Config.TARIFA2PERSONASCAMASSEPARADAS || 90000), T3 = Number(Config.TARIFA3PERSONAS || 110000);
  if (Personas <= 1) { return { exito: true, tarifanoche: T1, detallecamas: '1 persona (cama principal)' }; }
  if (Personas === 2) {
    const Separadas = Boolean(Camasseparadas) && (!Numerohab || Habitacionadmitecamasseparadas(Numerohab));
    return { exito: true, tarifanoche: Separadas ? T2s : T2c, detallecamas: Separadas ? '2 personas en camas individuales' : '2 personas compartiendo cama doble/queen' };
  }
  return { exito: true, tarifanoche: T3, detallecamas: '3 personas (cama doble/queen + cama sencilla)' };
}

function Actualizarcatalogohabitaciones() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet(), Ahora = Formatearfechahora(new Date()).slice(0, 16), Estadosprevios = {};
  let Hojahab = Libro.getSheetByName('Habitaciones');
  if (Hojahab && Hojahab.getLastRow() >= 2) {
    Hojahab.getDataRange().getValues().slice(1).forEach(function(F) { Estadosprevios[String(F[0]).padStart(2, '0')] = String(F[5] || 'Disponible'); });
  } else { Hojahab = Libro.insertSheet('Habitaciones'); }
  Hojahab.clearContents();
  Hojahab.appendRow(['Numero', 'Tipo', 'Capacidad', 'Huespedesmaximos', 'Tarifanoche', 'Estadoactual', 'Ultimaactualizacion', 'Camas', 'Camasindividuales', 'Comodidades']);
  Catalogoreal.forEach(function(Fila) {
    const Num = Fila[0], Estado = Num === '03' ? 'Mantenimiento' : (Estadosprevios[Num] === 'Ocupada' || Estadosprevios[Num] === 'Apartada' ? Estadosprevios[Num] : 'Disponible');
    Hojahab.appendRow([Num, Fila[1], Fila[2], Fila[3], Fila[4], Estado, Ahora, Fila[6], Fila[7], Fila[8]]);
  });
  const Hojaconfig = Libro.getSheetByName('Configuracion');
  if (Hojaconfig) {
    const Existentes = Hojaconfig.getLastRow() >= 2 ? Hojaconfig.getRange(2, 1, Hojaconfig.getLastRow() - 1, 1).getValues().map(function(R) { return String(R[0]).trim().toUpperCase(); }) : [];
    Parametrostarifasbase.forEach(function(Param) { if (Existentes.indexOf(Param[0]) === -1) { Hojaconfig.appendRow(Param); } });
  }
  Obtenerhojareservas();
  if (typeof Programarrelojesautomaticos === 'function') { Programarrelojesautomaticos(); }
  Registrarbitacora('Sistema', 'Actualizarcatalogohabitaciones', 'Catálogo de 6 habitaciones (03 en Mantenimiento), tarifas y relojes actualizados.');
}

function Interpretahorasalida(Textohora) {
  const Limpio = String(Textohora || '').toLowerCase().trim();
  const Match = Limpio.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!Match) { return 0; }
  let Hora = parseInt(Match[1], 10);
  const Minutos = parseInt(Match[2] || '0', 10);
  if ((Limpio.indexOf('pm') !== -1 || Limpio.indexOf('p.m') !== -1 || Limpio.indexOf('p. m') !== -1 || Limpio.indexOf('tarde') !== -1 || Limpio.indexOf('noche') !== -1) && Hora < 12) {
    Hora += 12;
  } else if (Hora >= 1 && Hora <= 10 && Limpio.indexOf('am') === -1 && Limpio.indexOf('a.m') === -1) {
    Hora += 12;
  }
  if (Minutos > 0) { Hora += 1; }
  return Hora;
}

function Formatearhoradoce(Horaveinticuatro) {
  const Hora = parseInt(Horaveinticuatro || 11, 10);
  if (Hora === 12) { return '12:00 p. m.'; }
  if (Hora > 12) { return `${Hora - 12}:00 p. m.`; }
  return `${Hora}:00 a. m.`;
}

function Habitaciontieneentradaeldia(Hojareservas, Numerohab, Fechahoy, Codigoactual) {
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = 1; I < Filas.length; I++) {
    const Cod = String(Filas[I][0]);
    if (Cod === Codigoactual) { continue; }
    const Hab = String(Filas[I][5]).padStart(2, '0');
    const Llegada = Normalizarfecha(Filas[I][6]);
    if (Hab === Numerohab && Llegada === Fechahoy && Reservaestabloqueando(Filas[I], Date.now())) {
      return true;
    }
  }
  return false;
}

function Solicitarampliacioncheckout(Celularcliente, Codigoreserva, Horasalidanueva, Mediopago) {
  const Hojareservas = Obtenerhojareservas();
  const Config = Leerconfiguracionhoja();
  const Credenciales = Obtenercredenciales();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Horacheckout = Number(Config.HORACHECKOUT || 11);
  const Valorhora = Number(Config.VALORHORAADICIONAL || 10000);

  const Horapedida = Interpretahorasalida(Horasalidanueva);
  if (!Horapedida || Horapedida <= Horacheckout || Horapedida > 22) {
    return { exito: false, mensaje: `Indica una hora de salida posterior a las ${Formatearhoradoce(Horacheckout)} (por ejemplo 1:00 p. m., 2:00 p. m. o 4:00 p. m.).` };
  }

  const Filas = Hojareservas.getDataRange().getValues();
  let Indice = -1, Fila = null;
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && String(Filas[I][15]) === 'Confirmada') {
      Indice = I + 1; Fila = Filas[I]; break;
    }
  }
  if (!Fila) {
    return { exito: false, mensaje: 'No se encontró una reserva confirmada activa para ampliar el check-out.' };
  }

  const Codigo = String(Fila[0]);
  const Nombre = String(Fila[2] || 'Huésped');
  const Hab = String(Fila[5]).padStart(2, '0');
  const Fechasalida = Normalizarfecha(Fila[7]);
  if (Habitaciontieneentradaeldia(Hojareservas, Hab, Fechasalida, Codigo)) {
    return { exito: false, conflicto: true, mensaje: `La habitación ${Hab} ya tiene una nueva llegada programada hoy, por lo que no es posible ampliar automáticamente. ¿Deseas que te comunique con un administrador?` };
  }

  const Horasextra = Horapedida - Horacheckout;
  const Valoradicional = Horasextra * Valorhora;
  const Horabonita = Formatearhoradoce(Horapedida);
  const Medio = String(Mediopago || '').toLowerCase().trim();

  if (!Medio) {
    return {
      exito: true, cotizacion: true, codigo: Codigo, habitacion: Hab,
      horasalida: Horabonita, horasadicionales: Horasextra, valoradicional: Valoradicional,
      mensaje: `Ampliar la salida hasta las ${Horabonita} son ${Horasextra} hora(s) adicional(es) por $${Valoradicional.toLocaleString('es-CO')} COP. Pregunta al huésped si desea pagarlo por transferencia de inmediato o en efectivo a la hora de salida.`
    };
  }

  const Obsactual = String(Fila[23] || '').trim();
  Hojareservas.getRange(Indice, 25).setValue(`${String(Horapedida).padStart(2, '0')}:00`);
  Hojareservas.getRange(Indice, 26).setValue(Horasextra);
  Hojareservas.getRange(Indice, 27).setValue(Valoradicional);

  if (Medio.indexOf('transfer') !== -1 || Medio.indexOf('nequi') !== -1) {
    Hojareservas.getRange(Indice, 24).setValue(Sanitizarcelda(`${Obsactual} · Ampliación ${Horabonita} pendiente transferencia ($${Valoradicional})`, 140));
    Registrarbitacora('Checkout', 'AmpliacionNequi', `${Codigo} Hab ${Hab} hasta ${Horabonita} ($${Valoradicional})`);
    return {
      exito: true, modo: 'transferencia', codigo: Codigo, habitacion: Hab,
      horasalida: Horabonita, horasadicionales: Horasextra, valoradicional: Valoradicional,
      cuenta: Config.CUENTANEQUI,
      instruccion: `Indícale al huésped el monto exacto ($${Valoradicional.toLocaleString('es-CO')} COP) a ${Config.CUENTANEQUI} y que envíe la captura del comprobante por este mismo chat.`
    };
  }

  Hojareservas.getRange(Indice, 12).setValue(Number(Fila[11] || 0) + Valoradicional);
  Hojareservas.getRange(Indice, 24).setValue(Sanitizarcelda(`${Obsactual} · Ampliación ${Horabonita} efectivo ($${Valoradicional})`, 140));

  const Msgadmin =
    `Ampliación de check-out (Efectivo) · ${Codigo}\n` +
    `Habitación: ${Hab}\nHuésped: ${Nombre}\n` +
    `Nueva hora de salida: ${Horabonita} (${Horasextra} hora${Horasextra > 1 ? 's' : ''} adicional${Horasextra > 1 ? 'es' : ''})\n` +
    `Valor a cobrar en efectivo al salir: $${Valoradicional.toLocaleString('es-CO')} COP`;
  Enviarmensajeinteligente(Credenciales.celularadmin, Msgadmin, '', []);
  Registrarbitacora('Checkout', 'AmpliacionEfectivo', `${Codigo} Hab ${Hab} hasta ${Horabonita} ($${Valoradicional} efectivo)`);

  return {
    exito: true, modo: 'efectivo', codigo: Codigo, habitacion: Hab,
    horasalida: Horabonita, horasadicionales: Horasextra, valoradicional: Valoradicional,
    mensajecliente: `¡Perfecto! Tu salida de la habitación ${Hab} quedó ampliada hasta las ${Horabonita} (${Horasextra} hora${Horasextra > 1 ? 's' : ''} adicional${Horasextra > 1 ? 'es' : ''}). El administrador ya está enterado y realizará el cobro de $${Valoradicional.toLocaleString('es-CO')} COP en efectivo a la hora de salida establecida.`
  };
}

function Enviaravisolimpiezaadmin(Numerohab) {
  const Num = String(Numerohab || '').padStart(2, '0');
  const Credenciales = Obtenercredenciales();
  const Mensaje =
    `Hola administrador, te recuerdo que la habitación ${Num} está pendiente de limpieza.\n` +
    `Cuando ya esté lista para recibir huéspedes, escribe exactamente aquí:\n` +
    `Habilitar la habitacion ${Num}\n` +
    `(O habilítala desde el panel: https://hospedaje-nissi-mingueo.web.app/Administracion.html)`;
  Enviarmensajeinteligente(Credenciales.celularadmin, Mensaje, '', []);
  PropertiesService.getScriptProperties().setProperty(`LIMPIEZA_TS_${Num}`, String(Date.now()));
}

function Parsearfechahorallegada(Fechaiso, Valorhora) {
  const Fecha = Normalizarfecha(Fechaiso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(Fecha)) { return 0; }
  let Texto = '';
  if (Valorhora instanceof Date && !isNaN(Valorhora.getTime())) {
    Texto = Utilities.formatDate(Valorhora, Parametrosistema.zonahoraria, 'HH:mm');
  } else {
    Texto = String(Valorhora || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
  if (!Texto || /confirmar|definir/.test(Texto)) { return 0; }
  if (/medio\s*dia/.test(Texto)) { return new Date(`${Fecha}T12:00:00-05:00`).getTime(); }
  const Match = Texto.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!Match) { return 0; }
  let Hora = parseInt(Match[1], 10);
  const Min = Math.min(59, Math.max(0, parseInt(Match[2] || '0', 10)));
  const Esam = /a\.?\s*m|manana|madrugada/.test(Texto);
  const Espm = /p\.?\s*m|tarde|noche/.test(Texto);
  if (Esam && Hora === 12) { Hora = 0; }
  else if (Espm && Hora < 12) { Hora += 12; }
  else if (!Esam && !Espm && !Match[2] && Hora >= 1 && Hora <= 6) { Hora += 12; }
  if (Hora < 0 || Hora > 23) { return 0; }
  return new Date(`${Fecha}T${String(Hora).padStart(2, '0')}:${String(Min).padStart(2, '0')}:00-05:00`).getTime();
}

function Leerestadollegada(Codigo) {
  try {
    const Crudo = PropertiesService.getScriptProperties().getProperty(`LLEGADA_${Codigo}`);
    return Crudo ? JSON.parse(Crudo) : {};
  } catch (E) { return {}; }
}

function Guardarestadollegada(Codigo, Estado) {
  PropertiesService.getScriptProperties().setProperty(`LLEGADA_${Codigo}`, JSON.stringify(Estado || {}));
}

function Obtenerllegadapendientecliente(Celularcliente) {
  const Hoja = Obtenerhojareservas(), Filas = Hoja ? Hoja.getDataRange().getValues() : [];
  const Ahorams = Date.now(), Cel = Normalizaridwhatsapp(Celularcliente);
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (String(Filas[I][15]) !== 'Confirmada' || !Coincidereservacliente(Filas[I], '', Cel)) { continue; }
    const Cod = String(Filas[I][0]), Est = Leerestadollegada(Cod);
    const Llegadams = Parsearfechahorallegada(Filas[I][6], Filas[I][10]);
    if (!Est.ok && (Est.p10 || (Llegadams && Ahorams >= Llegadams - 15 * 60000 && Ahorams <= Llegadams + 180 * 60000))) {
      return { codigo: Cod, habitacion: String(Filas[I][5]).padStart(2, '0'), hora: String(Filas[I][10] || '') };
    }
  }
  return null;
}

function Confirmarllegadahabitacion(Celularcliente, Codigoreserva, Yaenhabitacion, Nuevahorallegada) {
  const Hoja = Obtenerhojareservas(), Filas = Hoja.getDataRange().getValues(), Cel = Normalizaridwhatsapp(Celularcliente);
  const Cred = Obtenercredenciales();
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (!Coincidereservacliente(Filas[I], Codigoreserva, Cel) || String(Filas[I][15]) !== 'Confirmada') { continue; }
    const Cod = String(Filas[I][0]), Hab = String(Filas[I][5]).padStart(2, '0'), Nom = String(Filas[I][2] || 'Huésped');
    const Obs = String(Filas[I][23] || '').trim(), Est = Leerestadollegada(Cod);
    if (Yaenhabitacion !== false) {
      const Estanterior = Object.assign({}, Est);
      Est.ok = 1; Guardarestadollegada(Cod, Est);
      if (Obs.indexOf('Presencia confirmada') === -1) { Hoja.getRange(I + 1, 24).setValue(Sanitizarcelda(Obs ? `${Obs} · Presencia confirmada` : 'Presencia confirmada', 140)); }
      if (Estanterior.a15) { Enviarmensajeinteligente(Cred.celularadmin, `Actualización de llegada · ${Cod} (${Nom}, Hab. ${Hab}): el huésped acaba de confirmar que ya está en la habitación.`, '', []); }
      Registrarbitacora('Llegada', 'PresenciaConfirmada', `${Cod} Hab ${Hab}`);
      return { exito: true, confirmado: true, codigo: Cod, habitacion: Hab };
    }
    if (Nuevahorallegada) {
      Hoja.getRange(I + 1, 11).setValue(Sanitizarcelda(Nuevahorallegada, 40));
      Guardarestadollegada(Cod, { h60: 0, m15: 0, p10: 0, a15: 0, ok: 0 });
      Enviarmensajeinteligente(Cred.celularadmin, `Cambio de llegada · ${Cod} (${Nom}, Hab. ${Hab}): informó que llegará a las ${Nuevahorallegada}.`, '', []);
      return { exito: true, confirmado: false, codigo: Cod, habitacion: Hab, nuevahorallegada: Nuevahorallegada };
    }
  }
  return { exito: false, mensaje: 'No se encontró reserva confirmada para actualizar llegada.' };
}

function Revisarhabitacioneslimpieza() {
  const Hojahab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Habitaciones');
  if (!Hojahab || Hojahab.getLastRow() < 2) { return; }
  const Minutos = Number(Leerconfiguracionhoja().MINUTOSRECORDATORIOLIMPIEZA || 20);
  const Props = PropertiesService.getScriptProperties();
  const Ahorams = Date.now();
  Hojahab.getDataRange().getValues().slice(1).forEach(function(Fila) {
    const Num = String(Fila[0]).padStart(2, '0');
    if (String(Fila[5]) !== 'Limpieza') { return; }
    const Ultimo = Number(Props.getProperty(`LIMPIEZA_TS_${Num}`) || 0);
    if (!Ultimo || (Ahorams - Ultimo) / 60000 >= Minutos) {
      Enviaravisolimpiezaadmin(Num);
    }
  });
}

function Gestionarlimpiezahabitacion(Numerohab, Habilitar) {
  const Num = String(Numerohab || '').padStart(2, '0');
  if (!Num || Num === '03') { return { exito: false, mensaje: 'Habitación no modificable.' }; }
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahab = Libro.getSheetByName('Habitaciones');
  const Hojares = Obtenerhojareservas();
  if (!Hojahab) { return { exito: false, mensaje: 'Hoja Habitaciones no encontrada.' }; }

  if (Habilitar) {
    Cambiarocupacionhabitacion(Hojahab, Num, 'Disponible');
    PropertiesService.getScriptProperties().deleteProperty(`LIMPIEZA_TS_${Num}`);
    Registrarbitacora('Limpieza', 'Habilitarhabitacion', `Habitación ${Num} habilitada como Disponible.`);
    return { exito: true, habitacion: Num, estado: 'Disponible' };
  }

  if (Hojares && Hojares.getLastRow() >= 2) {
    const Hoytexto = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');
    const Filas = Hojares.getDataRange().getValues();
    for (let I = 1; I < Filas.length; I++) {
      if (String(Filas[I][15]) === 'Confirmada' && String(Filas[I][5]).padStart(2, '0') === Num && Normalizarfecha(Filas[I][6]) <= Hoytexto) {
        Hojares.getRange(I + 1, 16).setValue('Finalizada');
      }
    }
  }
  Cambiarocupacionhabitacion(Hojahab, Num, 'Limpieza');
  Enviaravisolimpiezaadmin(Num);
  Registrarbitacora('Limpieza', 'Marcarlimpieza', `Habitación ${Num} pasada a pendiente de limpieza.`);
  return { exito: true, habitacion: Num, estado: 'Limpieza' };
}

function Confirmarreservaefectivo(Celularcliente, Codigoreserva, Montobillete) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet(), Hojareservas = Obtenerhojareservas(), Hojahab = Libro.getSheetByName('Habitaciones');
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente), Filas = Hojareservas.getDataRange().getValues();
  let Indice = -1, Fila = null;
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && String(Filas[I][15]) === 'Apartada') { Indice = I + 1; Fila = Filas[I]; break; }
  }
  if (!Fila) { return { exito: false, mensaje: 'No se encontró una reserva apartada activa para confirmar.' }; }
  const Codigo = String(Fila[0]), Hab = String(Fila[5]).padStart(2, '0'), Total = Number(Fila[11] || 0), Billete = Number(Montobillete || Total);
  if (Billete > 0 && Billete < Total) {
    return { exito: false, mensaje: `El monto ($${Billete.toLocaleString('es-CO')} COP) es menor al total ($${Total.toLocaleString('es-CO')} COP). Pregunta con qué monto igual o mayor va a pagar.` };
  }
  const Cambio = Math.max(0, Billete - Total);
  const Obsnueva = [String(Fila[23] || '').trim(), `Efectivo al llegar (paga con $${Billete.toLocaleString('es-CO')} · cambio $${Cambio.toLocaleString('es-CO')})`].filter(Boolean).join(' · ');
  Hojareservas.getRange(Indice, 13).setValue(0);
  Hojareservas.getRange(Indice, 14).setValue(Sanitizarcelda(`Paga con $${Billete.toLocaleString('es-CO')}`, 60));
  Hojareservas.getRange(Indice, 15).setValue('Efectivo'); Hojareservas.getRange(Indice, 16).setValue('Confirmada');
  Hojareservas.getRange(Indice, 19).setValue('Efectivo'); Hojareservas.getRange(Indice, 24).setValue(Sanitizarcelda(Obsnueva, 140));
  const Hoytexto = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd');
  if (Normalizarfecha(Fila[6]) <= Hoytexto) { Cambiarocupacionhabitacion(Hojahab, Hab, 'Ocupada'); }
  Notificarreservaconfirmada({
    codigo: Codigo, habitacion: Hab, canal: String(Fila[16] || 'WhatsApp'), nombre: String(Fila[2] || 'Viajero'), cedula: String(Fila[3] || ''),
    celular: Obtenercelularlegiblereserva(Fila), idwhatsapp: Celularlimpio || Obtenerdestinowhatsappreserva(Fila),
    llegada: Normalizarfecha(Fila[6]), salida: Normalizarfecha(Fila[7]), noches: Number(Fila[8] || 1), personas: Number(Fila[9] || 1),
    horallegada: String(Fila[10] || 'Por confirmar'), horasalida: String(Fila[24] || Formatearhoradoce(Number(Leerconfiguracionhoja().HORACHECKOUT || 11))),
    total: Total, pagado: 0, entidad: 'Efectivo', referencia: `Paga con $${Billete.toLocaleString('es-CO')} (cambio $${Cambio.toLocaleString('es-CO')})`,
    observaciones: Obsnueva, enviarcliente: false
  });
  Registrarbitacora('Pagos', 'ConfirmarEfectivo', `${Codigo} confirmada en efectivo (billete $${Billete}, cambio $${Cambio})`);
  return { exito: true, codigo: Codigo, habitacion: Hab, montototal: Total, billete: Billete, cambio: Cambio, rutamaps: 'https://maps.app.goo.gl/TudMNAdQRpVyzHZGA', rutawaze: 'https://waze.com/ul?ll=11.216310,-73.392264&navigate=yes' };
}

function Enviardatospago(Celularcliente, Codigoreserva, Mediopago, Montonequi, Montoefectivo, Montobillete) {
  const Hojareservas = Obtenerhojareservas(), Config = Leerconfiguracionhoja(), Filas = Hojareservas.getDataRange().getValues(), Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && String(Filas[I][15]) === 'Apartada') {
      const Total = Number(Filas[I][11] || 0), Pnequi = Number(Montonequi || 0), Pefec = Number(Montoefectivo || 0), Billete = Number(Montobillete || 0);
      const Esmixto = String(Mediopago || '').toLowerCase().indexOf('mixt') !== -1 || (Pnequi > 0 && Pefec > 0);
      if (Esmixto) {
        if (Pnequi <= 0 || Pefec <= 0 || Pnequi + Pefec !== Total) { return { exito: false, mensaje: `La suma de Nequi y efectivo debe ser exactamente $${Total.toLocaleString('es-CO')} COP.` }; }
        if (Billete > 0 && Billete < Pefec) { return { exito: false, mensaje: `El monto en efectivo debe cubrir al menos los $${Pefec.toLocaleString('es-CO')} COP restantes.` }; }
        const Cambio = Billete > Pefec ? Billete - Pefec : 0, Obsactual = String(Filas[I][23] || '').replace(/\s*\[Mixto[^\]]*\]/g, '').trim();
        const Marca = `[Mixto Nequi:${Pnequi} Efectivo:${Pefec}${Billete ? ` Billete:${Billete} Cambio:${Cambio}` : ''}]`;
        Hojareservas.getRange(I + 1, 19).setValue('Mixto');
        Hojareservas.getRange(I + 1, 24).setValue(Sanitizarcelda(Obsactual ? `${Obsactual} · ${Marca}` : Marca, 140));
        return {
          exito: true, mediopago: 'Mixto', codigo: String(Filas[I][0]), habitacion: String(Filas[I][5]).padStart(2, '0'),
          montototal: Total, montoexigido: Pnequi, saldoefectivo: Pefec, cambio: Cambio, cuenta: Config.CUENTANEQUI,
          instruccion: `Pago mixto registrado: transfiere $${Pnequi.toLocaleString('es-CO')} COP a ${Config.CUENTANEQUI} (tienes ${Config.MINUTOSAPARTADO} min para enviar la captura aquí) y pagas $${Pefec.toLocaleString('es-CO')} COP en efectivo al llegar.`
        };
      }
      Hojareservas.getRange(I + 1, 19).setValue('Nequi');
      return { exito: true, mediopago: 'Nequi', codigo: String(Filas[I][0]), habitacion: String(Filas[I][5]).padStart(2, '0'), montototal: Total, montoexigido: Total, cuenta: Config.CUENTANEQUI, instruccion: `El pago por Nequi es del 100% ($${Total.toLocaleString('es-CO')} COP) a ${Config.CUENTANEQUI}. Tienes ${Config.MINUTOSAPARTADO} minutos para enviar la captura del comprobante por este chat.` };
    }
  }
  return { exito: false, mensaje: 'No se encontró una reserva apartada activa para este cliente.' };
}
