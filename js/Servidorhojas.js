// Diseño empresarial de Google Sheets, inicialización, migración de columnas y consulta del Dashboard

const Encabezadosreservas = [
  'Codigo', 'Fecharegistro', 'Nombre', 'Cedula', 'Celular', 'Habitacion', 'Fechallegada', 'Fechasalida',
  'Noches', 'Huespedes', 'Horallegada', 'Montototal', 'Montopagado', 'Referenciapago', 'Entidadpago',
  'Estado', 'Canal', 'Venceapartado', 'Mediopago', 'Montocomprobante', 'Referenciacomprobante',
  'Fechacomprobante', 'Idpagobanco', 'Observaciones', 'Horasalida', 'Horasadicionales', 'Valoradicional', 'Idwhatsapp'
];

const Configuracionbase = [
  ['PAGOMINIMOPORCENTAJE', '100', 'Porcentaje mínimo exigido para confirmar por transferencia (100%)'],
  ['MINUTOSAPARTADO', '30', 'Minutos para enviar el comprobante después de apartar'],
  ['MINUTOSESPERACORREO', '20', 'Minutos máximos esperando el correo del banco antes de pasar a administrador'],
  ['MINUTOSRECORDATORIOCLIENTE', '2', 'Minutos entre avisos de espera al cliente mientras busca al admin'],
  ['MINUTOSESPERAADMIN', '15', 'Tiempo máximo (min) esperando al admin antes de enviar informe pendiente'],
  ['MINUTOSRECORDATORIOCANAL', '5', 'Minutos entre recordatorios al administrador mientras espera'],
  ['MINUTOSINACTIVIDADCANAL', '15', 'Minutos de inactividad para cerrar automáticamente un canal abierto'],
  ['MINUTOSCIERREPOSTCANAL', '15', 'Minutos esperando respuesta del cliente tras cierre del canal'],
  ['MINUTOSAVISOCANAL', '15', 'Compatibilidad: minutos para avisar al cliente si el canal sigue abierto'],
  ['MINUTOSCIERREAUTO', '120', 'Compatibilidad: minutos máximos de seguridad para canal abierto'],
  ['CELULARADMIN', '573123639298', 'WhatsApp personal del administrador (recibe canales y avisos)'],
  ['MODOSOMBRA', 'NO', 'SI para pedir confirmación al admin antes de validar transferencia; NO para automático'],
  ['CUENTANEQUI', 'Nequi: 3123639298 (Hospedaje Nissi)', 'Datos de pago Nequi que la IA envía al huésped'],
  ['REMITENTESBANCOS', 'nequi.com.co,nequi.com,notificacionesnequi.com,bancolombia.com.co,notificacionesbancolombia.com', 'Dominios de correo autorizados de Nequi'],
  ['TARIFA1PERSONA', '55000', 'Tarifa por noche para 1 persona en cualquier habitación'],
  ['TARIFA2PERSONASCAMACOMPARTIDA', '70000', 'Tarifa por noche para 2 personas compartiendo cama doble o queen'],
  ['TARIFA2PERSONASCAMASSEPARADAS', '90000', 'Tarifa por noche para 2 personas usando cada uno su propia cama'],
  ['TARIFA3PERSONAS', '110000', 'Tarifa por noche para 3 personas ($110.000 COP)'],
  ['VALORHORAADICIONAL', '10000', 'Costo en COP por cada hora adicional después del check-out'],
  ['HORACHECKOUT', '11', 'Hora estándar de check-out en formato 24h (11 = 11:00 a. m.)'],
  ['MINUTOSRECORDATORIOLIMPIEZA', '20', 'Minutos entre avisos al admin por habitación pendiente de limpieza']
];

const Encabezadosconv = [
  'Celular', 'Nombre', 'Modo', 'Codigoreserva', 'Ultimomensajecliente', 'Ultimomensajeadmin',
  'Aperturacanal', 'Avisodemoracanal', 'Ultimorecordatorioadmin', 'Idinteraccionia',
  'Ultimorecordatoriocliente', 'Motivorequerimiento', 'Resumencontexto', 'Telefonocontacto'
];

function Obtenerestadoconversacion(Celular) {
  const Hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Conversaciones');
  const Celularlimpio = Normalizaridwhatsapp(Celular);
  if (!Hoja || !Celularlimpio || Hoja.getLastRow() < 2) {
    return { fila: -1, celular: Celularlimpio, modo: 'IA', codigoreserva: '', ultimomensajecliente: '', ultimorecordatoriocliente: '', motivorequerimiento: '', resumencontexto: '', telefonocontacto: '' };
  }
  const Numcols = Math.min(Math.max(Hoja.getLastColumn(), 10), 14);
  const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, Numcols).getValues();
  for (let I = 0; I < Filas.length; I++) {
    if (Normalizaridwhatsapp(Filas[I][0]) === Celularlimpio) {
      return {
        fila: I + 2, celular: Celularlimpio, nombre: String(Filas[I][1] || ''), modo: String(Filas[I][2] || 'IA'),
        codigoreserva: String(Filas[I][3] || ''), ultimomensajecliente: Filas[I][4], ultimomensajeadmin: Filas[I][5],
        aperturacanal: Filas[I][6], avisodemoracanal: String(Filas[I][7] || ''), ultimorecordatorioadmin: Filas[I][8],
        idinteraccionia: String(Filas[I][9] || ''), ultimorecordatoriocliente: Filas[I][10] || '',
        motivorequerimiento: String(Filas[I][11] || ''), resumencontexto: String(Filas[I][12] || ''),
        telefonocontacto: String(Filas[I][13] || '')
      };
    }
  }
  return { fila: -1, celular: Celularlimpio, modo: 'IA', codigoreserva: '', ultimomensajecliente: '', ultimorecordatoriocliente: '', motivorequerimiento: '', resumencontexto: '', telefonocontacto: '' };
}

function Actualizarconversacion(Celular, Campos) {
  const Celularlimpio = Normalizaridwhatsapp(Celular);
  if (!Celularlimpio) { return; }
  const Candado = typeof LockService !== 'undefined' ? LockService.getScriptLock() : null;
  if (Candado) { try { Candado.waitLock(5000); } catch (El) {} }
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    let Hoja = Libro.getSheetByName('Conversaciones');
    if (!Hoja) { Hoja = Libro.insertSheet('Conversaciones'); Hoja.appendRow(Encabezadosconv); }
    else if (Hoja.getLastColumn() < 14) { for (let C = Hoja.getLastColumn(); C < 14; C++) { Hoja.getRange(1, C + 1).setValue(Encabezadosconv[C]); } }
    const A = Obtenerestadoconversacion(Celularlimpio);
    const Telefonodetectado = Campos.telefonocontacto !== undefined ? (Normalizarcelularcolombiano(Campos.telefonocontacto) || '') : (Normalizarcelularcolombiano(A.telefonocontacto) || Normalizarcelularcolombiano(Celularlimpio) || '');
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
      Campos.resumencontexto !== undefined ? Sanitizarcelda(Campos.resumencontexto, 400) : (A.resumencontexto || ''),
      Telefonodetectado
    ];
    const Filaobjetivo = A.fila > 0 ? A.fila : Hoja.getLastRow() + 1;
    if (A.fila > 0) { Hoja.getRange(A.fila, 1, 1, Nueva.length).setValues([Nueva]); } else { Hoja.appendRow(Nueva); }
    if (Telefonodetectado) { Hoja.getRange(Filaobjetivo, 14).setNumberFormat('@').setValue(Telefonodetectado); }
  } finally {
    if (Candado) { try { Candado.releaseLock(); } catch (Er) {} }
  }
}

function Obtenerhojareservas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  let Hoja = Libro.getSheetByName('Reservas');
  if (!Hoja) {
    Hoja = Libro.insertSheet('Reservas');
  }
  return Asegurarcolumnasreservas(Hoja);
}

function Coincidereservacliente(Filareserva, Codigoreserva, Celularcliente) {
  if (Codigoreserva && String(Filareserva[0] || '').toUpperCase() === String(Codigoreserva).toUpperCase()) {
    return true;
  }
  const Idlimpio = Normalizaridwhatsapp(Celularcliente);
  if (!Idlimpio) { return false; }
  const Idfila = Normalizaridwhatsapp(Filareserva[27]);
  const Celfila = Normalizaridwhatsapp(Filareserva[4]);
  if ((Idfila && Idfila === Idlimpio) || (Celfila && Celfila === Idlimpio)) {
    return true;
  }
  const Diezbuscado = Normalizarcelularcolombiano(Idlimpio);
  const Diezfila = Normalizarcelularcolombiano(Filareserva[4]) || Normalizarcelularcolombiano(Filareserva[27]);
  return Boolean(Diezbuscado && Diezfila && Diezbuscado === Diezfila);
}

function Obtenerdestinowhatsappreserva(Filareserva) {
  const Idwa = Normalizaridwhatsapp(Filareserva[27]);
  if (Idwa) { return Idwa; }
  const Diez = Normalizarcelularcolombiano(Filareserva[4]);
  if (Diez) { return `57${Diez}`; }
  return Normalizaridwhatsapp(Filareserva[4]);
}

function Obtenercelularlegiblereserva(Filareserva) {
  const Diez = Normalizarcelularcolombiano(Filareserva[4]) || Normalizarcelularcolombiano(Filareserva[27]);
  if (Diez) { return Diez; }
  const Crudo = String(Filareserva[4] || '').trim();
  if (!Crudo || /[A-Za-z]/.test(Crudo)) { return 'Por confirmar'; }
  return Crudo;
}

function Inicializarhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  let Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojahabitaciones) {
    Hojahabitaciones = Libro.insertSheet('Habitaciones');
    Hojahabitaciones.appendRow(['Numero', 'Tipo', 'Capacidad', 'Huespedesmaximos', 'Tarifanoche', 'Estadoactual', 'Ultimaactualizacion', 'Camas', 'Camasindividuales', 'Comodidades']);
    const Fechahoy = Formatearfechahora(new Date()).slice(0, 16);
    Catalogoreal.forEach(function(F) { Hojahabitaciones.appendRow([F[0], F[1], F[2], F[3], F[4], F[5], Fechahoy, F[6], F[7], F[8]]); });
  }
  Obtenerhojareservas();

  let Hojaconfig = Libro.getSheetByName('Configuracion');
  if (!Hojaconfig) {
    Hojaconfig = Libro.insertSheet('Configuracion');
    Hojaconfig.appendRow(['Parametro', 'Valor', 'Descripcion']);
    Configuracionbase.forEach(function(Fila) { Hojaconfig.appendRow(Fila); });
  } else {
    const Existcfg = Hojaconfig.getLastRow() >= 2 ? Hojaconfig.getRange(2, 1, Hojaconfig.getLastRow() - 1, 1).getValues().map(function(R) { return String(R[0]).trim().toUpperCase(); }) : [];
    Configuracionbase.forEach(function(Fila) { if (Existcfg.indexOf(Fila[0]) === -1) { Hojaconfig.appendRow(Fila); } });
  }
  let Hojaconv = Libro.getSheetByName('Conversaciones');
  if (!Hojaconv) {
    Hojaconv = Libro.insertSheet('Conversaciones');
    Hojaconv.appendRow(Encabezadosconv);
  } else {
    const Encconv = Hojaconv.getRange(1, 1, 1, Hojaconv.getLastColumn()).getValues()[0].map(String);
    Encabezadosconv.forEach(function(Nom, Idx) { if (Idx >= Encconv.length) { Hojaconv.getRange(1, Idx + 1).setValue(Nom); } });
  }
  if (!Libro.getSheetByName('Mensajescanal')) { Libro.insertSheet('Mensajescanal').appendRow(['Idmensajemeta', 'Celularcliente', 'Codigoreserva', 'Direccion', 'Fechahora']); }
  if (!Libro.getSheetByName('Pagosrecibidos')) { Libro.insertSheet('Pagosrecibidos').appendRow(['Idpago', 'Fechacorreo', 'Entidad', 'Monto', 'Referencia', 'Pagador', 'Remitente', 'Dkimvalido', 'Estado']); }
  if (!Libro.getSheetByName('Registro')) { Libro.insertSheet('Registro').appendRow(['Fechahora', 'Modulo', 'Accion', 'Detalle']); }
  if (typeof Obtenerhojausuarios === 'function') { Obtenerhojausuarios(); }
  Programarrelojesautomaticos();
  Aplicardisenoempresarialhojas();
  Registrarbitacora('Sistema', 'Inicializarhojas', 'Pestañas, columnas y relojes verificados correctamente.');
}

function Asegurarcolumnasreservas(Hojareservas) {
  if (!Hojareservas) { return null; }
  const Ultcol = Hojareservas.getLastColumn();
  if (Ultcol === 0) {
    Hojareservas.appendRow(Encabezadosreservas);
    return Hojareservas;
  }

  let Encabezados = Hojareservas.getRange(1, 1, 1, Ultcol).getValues()[0].map(function(C) { return String(C || '').trim(); });
  const Requiereinsertarcedula = Encabezados[3] !== 'Cedula';

  if (Requiereinsertarcedula) {
    Hojareservas.insertColumnAfter(3);
    Hojareservas.getRange(1, 4).setValue('Cedula');
    Encabezados = Hojareservas.getRange(1, 1, 1, Hojareservas.getLastColumn()).getValues()[0].map(function(C) { return String(C || '').trim(); });
  }

  Encabezadosreservas.forEach(function(Nombrecol, Indice) {
    if (Indice >= Encabezados.length || !Encabezados[Indice]) {
      Hojareservas.getRange(1, Indice + 1).setValue(Nombrecol);
    }
  });

  if (Requiereinsertarcedula && Hojareservas.getLastRow() >= 2) {
    const Numfilas = Hojareservas.getLastRow() - 1;
    const Rango = Hojareservas.getRange(2, 1, Numfilas, 28);
    const Datos = Rango.getValues();
    Hojareservas.getRange(2, 4, Numfilas, 3).setNumberFormat('@');
    Hojareservas.getRange(2, 28, Numfilas, 1).setNumberFormat('@');

    for (let I = 0; I < Datos.length; I++) {
      const Nombrecrudo = String(Datos[I][2] || '').trim();
      const Coincidenciacc = Nombrecrudo.match(/^(.+?)\s*\(C\.C\.\s*([^)]+)\)$/i);
      if (Coincidenciacc) {
        Datos[I][2] = Coincidenciacc[1].trim();
        Datos[I][3] = Coincidenciacc[2].replace(/\D/g, '');
      }
      const Celularcrudo = String(Datos[I][4] || '').trim();
      const Obs = String(Datos[I][23] || '').trim();
      if (!Datos[I][27] && Celularcrudo) {
        Datos[I][27] = Normalizaridwhatsapp(Celularcrudo);
      }
      const Contactoenobs = Obs.match(/Contacto:\s*(\+?\d[\d\s\-]{7,14})/i);
      const Celulardesdeobs = Contactoenobs ? Normalizarcelularcolombiano(Contactoenobs[1]) : '';
      const Celularlimpio = Normalizarcelularcolombiano(Celularcrudo) || Celulardesdeobs;
      if (Celularlimpio) {
        Datos[I][4] = Celularlimpio;
        if (Contactoenobs) {
          Datos[I][23] = Obs.replace(/\s*·?\s*Contacto:\s*\+?\d[\d\s\-]{7,14}/i, '').replace(/^·\s*/, '').trim();
        }
      } else if (/[A-Za-z]/.test(Celularcrudo)) {
        Datos[I][4] = 'Por confirmar';
      }
      if (Datos[I][5] !== '') {
        Datos[I][5] = String(Datos[I][5]).padStart(2, '0');
      }
    }
    Rango.setValues(Datos);
  }
  return Hojareservas;
}

function Obtenerreservasreales() {
  const Hoja = typeof Obtenerhojareservas === 'function'
    ? Obtenerhojareservas()
    : Asegurarcolumnasreservas(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reservas'));
  if (!Hoja || Hoja.getLastRow() < 2) { return { exito: true, reservas: [] }; }
  const Filas = Hoja.getDataRange().getValues().slice(1);
  const Lista = [];
  for (let I = Filas.length - 1; I >= 0; I--) {
    const F = Filas[I];
    const Codigo = String(F[0] || '').trim();
    if (!Codigo) { continue; }
    const Nombrecrudo = String(F[2] || '').trim();
    const Matchcc = Nombrecrudo.match(/^(.+?)\s*\(C\.C\.\s*([^)]+)\)$/i);
    const Nombre = Matchcc ? Matchcc[1].trim() : Nombrecrudo;
    const Cedula = String(F[3] || (Matchcc ? Matchcc[2] : '') || '').trim();
    const Celular = Obtenercelularlegiblereserva(F);
    const Mediopago = String(F[18] || F[14] || 'Efectivo').trim();
    const Obs = String(F[23] || '').trim();
    const Montototal = Number(F[11] || 0);
    const Montopagado = Number(F[12] || 0);
    const Mixmatch = Obs.match(/\[Mixto Nequi:(\d+)\s+Efectivo:(\d+)/i);
    let Montonequi = 0, Montoefectivo = 0;
    if (Mixmatch) {
      Montonequi = Number(Mixmatch[1] || 0);
      Montoefectivo = Number(Mixmatch[2] || 0);
    } else if (/nequi/i.test(Mediopago) || /nequi/i.test(String(F[14] || ''))) {
      Montonequi = Montopagado || Montototal;
    } else if (/efectivo/i.test(Mediopago) || /efectivo/i.test(String(F[14] || ''))) {
      Montoefectivo = Montopagado || Montototal;
    }
    const Fechareg = F[1] instanceof Date ? Formatearfechahora(F[1]).slice(0, 16) : String(F[1] || '').trim();
    Lista.push({
      codigo: Codigo, fecharegistro: Fechareg, nombre: Nombre, cedula: Cedula,
      celular: Celular === 'Por confirmar' ? '' : Celular, habitacion: String(F[5] || '').padStart(2, '0'),
      llegada: Normalizarfecha(F[6]), salida: Normalizarfecha(F[7]),
      noches: Number(F[8] || 1), huespedes: Number(F[9] || 1), horallegada: String(F[10] || ''),
      montototal: Montototal, montopagado: Montopagado, montonequi: Montonequi, montoefectivo: Montoefectivo,
      referenciapago: String(F[13] || ''), entidadpago: Mediopago, estado: String(F[15] || ''),
      canal: String(F[16] || ''), observaciones: Obs
    });
  }
  return { exito: true, reservas: Lista };
}

function Definicionesdisenohojas() {
  return [
    { nombre: 'Reservas', color: '#4F5A2E', anchos: [100, 145, 210, 125, 130, 95, 115, 115, 75, 95, 115, 120, 120, 140, 110, 125, 105, 145, 105, 125, 140, 145, 130, 290, 100, 120, 120, 170], moneda: [12, 13, 20, 27], texto: [4, 5, 6, 28], ocultar: [28], centro: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16, 17, 18, 19, 22, 25, 26], ajuste: [24] },
    { nombre: 'Habitaciones', color: '#4F5A2E', anchos: [85, 200, 130, 145, 125, 130, 155, 225, 135, 300], moneda: [5], texto: [1], ocultar: [], centro: [1, 3, 4, 6, 7, 9], ajuste: [2, 8, 10] },
    { nombre: 'Conversaciones', color: '#8C3B1F', anchos: [165, 185, 145, 120, 155, 155, 155, 145, 165, 220, 170, 220, 320, 130], moneda: [], texto: [1, 14], ocultar: [], centro: [1, 3, 4, 5, 6, 7, 8, 9, 11, 14], ajuste: [12, 13] },
    { nombre: 'Mensajescanal', color: '#8C3B1F', anchos: [260, 165, 120, 145, 165], moneda: [], texto: [2], ocultar: [], centro: [2, 3, 4, 5], ajuste: [1] },
    { nombre: 'Pagosrecibidos', color: '#5A5C4E', anchos: [185, 155, 120, 125, 145, 185, 235, 95, 120], moneda: [4], texto: [5], ocultar: [], centro: [2, 3, 5, 8, 9], ajuste: [7] },
    { nombre: 'Usuarios', color: '#1A1C13', anchos: [225, 200, 245, 120, 155, 110], moneda: [], texto: [], ocultar: [], centro: [4, 5, 6], ajuste: [] },
    { nombre: 'Configuracion', color: '#1A1C13', anchos: [255, 220, 440], moneda: [], texto: [], ocultar: [], centro: [], ajuste: [2, 3] },
    { nombre: 'Registro', color: '#5A5C4E', anchos: [160, 130, 175, 480], moneda: [], texto: [], ocultar: [], centro: [1, 2, 3], ajuste: [4] }
  ];
}

function Construirreglasestado(Hoja, Columna, Pares) {
  const Rango = Hoja.getRange(2, Columna, Math.max(Hoja.getMaxRows() - 1, 200), 1);
  return Pares.map(function(P) {
    const Constructor = SpreadsheetApp.newConditionalFormatRule().setRanges([Rango]).setBackground(P[1]).setFontColor(P[2]).setBold(true);
    return P[3] ? Constructor.whenTextContains(P[0]).build() : Constructor.whenTextEqualTo(P[0]).build();
  });
}

function Reglashoja(Hoja, Nombre) {
  if (Nombre === 'Habitaciones') {
    return Construirreglasestado(Hoja, 6, [['Disponible', '#E6F4EA', '#137333'], ['Ocupada', '#FCE8E6', '#A50E0E'], ['Apartada', '#FEF7E0', '#B06000'], ['Limpieza', '#E8F0FE', '#1967D2'], ['Mantenimiento', '#ECEFF1', '#455A64']]);
  }
  if (Nombre === 'Reservas') {
    return Construirreglasestado(Hoja, 16, [['Confirmada', '#E6F4EA', '#137333'], ['Apartada', '#FEF7E0', '#B06000'], ['Verificando', '#FEF7E0', '#B06000'], ['En canal', '#E8F0FE', '#1967D2'], ['Finalizada', '#EDF1E6', '#3E4A22'], ['Cancelada', '#FCE8E6', '#A50E0E'], ['Rechazada', '#FCE8E6', '#A50E0E'], ['Vencida', '#FCE8E6', '#A50E0E']]);
  }
  if (Nombre === 'Conversaciones') {
    return Construirreglasestado(Hoja, 3, [['IA', '#E6F4EA', '#137333'], ['PendienteAdmin', '#FEF7E0', '#B06000'], ['Canal', '#E8F0FE', '#1967D2'], ['PostCanal', '#EFE6D5', '#6B4E2E'], ['PendienteContacto', '#FDECE6', '#8C3B1F'], ['Finalizado', '#ECEFF1', '#455A64']]);
  }
  if (Nombre === 'Pagosrecibidos') {
    return Construirreglasestado(Hoja, 9, [['Libre', '#FEF7E0', '#B06000'], ['Usado', '#E6F4EA', '#137333'], ['Conciliado', '#E6F4EA', '#137333']]);
  }
  if (Nombre === 'Registro') {
    return Construirreglasestado(Hoja, 3, [['Error', '#FCE8E6', '#A50E0E', true], ['Timeout', '#FEF7E0', '#B06000', true]]);
  }
  return [];
}

function Aplicardisenoempresarialhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojauno = Libro.getSheetByName('Hoja 1');
  if (Hojauno && Libro.getSheets().length > 1 && Hojauno.getLastRow() <= 1 && Hojauno.getLastColumn() <= 1) {
    Libro.deleteSheet(Hojauno);
  }
  Asegurarcolumnasreservas(Libro.getSheetByName('Reservas'));

  let Pos = 1;
  Definicionesdisenohojas().forEach(function(Def) {
    const Hoja = Libro.getSheetByName(Def.nombre);
    if (!Hoja) { return; }
    const Ncols = Math.max(Hoja.getLastColumn(), Def.anchos.length);
    const Filasvis = Math.max(Hoja.getLastRow(), Def.nombre === 'Habitaciones' ? 7 : 25);

    Hoja.setTabColor(Def.color);
    Hoja.setHiddenGridlines(true);
    Hoja.setFrozenRows(1);

    const Filtroprevio = Hoja.getFilter();
    if (Filtroprevio) { Filtroprevio.remove(); }
    Hoja.getRange(1, 1, Math.max(Hoja.getLastRow(), 2), Ncols).createFilter();

    Hoja.getBandings().forEach(function(B) { B.remove(); });
    Hoja.getRange(1, 1, Filasvis, Ncols).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
      .setHeaderRowColor('#1A1C13').setFirstRowColor('#FFFFFF').setSecondRowColor('#F7F4EC');

    const Encabezado = Hoja.getRange(1, 1, 1, Ncols);
    Encabezado.setBackground('#1A1C13').setFontColor('#F2EADB').setFontFamily('Roboto').setFontSize(10).setFontWeight('bold')
      .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
    Hoja.setRowHeight(1, 36);

    const Cuerpo = Hoja.getRange(2, 1, Filasvis - 1, Ncols);
    Cuerpo.setFontFamily('Roboto').setFontSize(10).setFontColor('#1A1C13').setVerticalAlignment('middle')
      .setHorizontalAlignment('left').setWrap(false)
      .setBorder(true, true, true, true, true, true, '#D9CDB5', SpreadsheetApp.BorderStyle.SOLID);
    Hoja.setRowHeights(2, Filasvis - 1, 28);

    Def.anchos.forEach(function(Ancho, Idx) { Hoja.setColumnWidth(Idx + 1, Ancho); });
    Def.centro.forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setHorizontalAlignment('center'); } });
    (Def.texto || []).forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setNumberFormat('@'); } });
    Def.moneda.forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setNumberFormat('$#,##0').setHorizontalAlignment('right'); } });
    Def.ajuste.forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setWrap(true); } });
    (Def.ocultar || []).forEach(function(Col) { if (Col <= Ncols) { Hoja.hideColumns(Col); } });

    Hoja.setConditionalFormatRules(Reglashoja(Hoja, Def.nombre));
    Libro.setActiveSheet(Hoja);
    Libro.moveActiveSheet(Pos++);
  });
}

function Reiniciarydisenarhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  Inicializarhojas();
  ['Reservas', 'Conversaciones', 'Mensajescanal', 'Pagosrecibidos', 'Registro'].forEach(function(Nombre) {
    const H = Libro.getSheetByName(Nombre);
    if (H && H.getLastRow() > 1) { H.getRange(2, 1, H.getLastRow() - 1, H.getLastColumn()).clearContent(); }
  });
  const Hojahab = Libro.getSheetByName('Habitaciones');
  if (Hojahab) {
    if (Hojahab.getLastRow() > 1) { Hojahab.getRange(2, 1, Hojahab.getLastRow() - 1, Hojahab.getLastColumn()).clearContent(); }
    const Ahora = Formatearfechahora(new Date()).slice(0, 16);
    const Filashab = Catalogoreal.map(function(F) { return [F[0], F[1], F[2], F[3], F[4], F[5], Ahora, F[6], F[7], F[8]]; });
    Hojahab.getRange(2, 1, Filashab.length, 10).setValues(Filashab);
  }
  const Props = PropertiesService.getScriptProperties();
  Props.deleteProperty('CANAL_ACTIVO_ADMIN');
  Props.getKeys().forEach(function(C) { if (C.indexOf('LLEGADA_') === 0 || C.indexOf('LIMPIEZA_TS_') === 0) { Props.deleteProperty(C); } });
  Programarrelojesautomaticos();
  Aplicardisenoempresarialhojas();
  Registrarbitacora('Sistema', 'Reiniciarydisenarhojas', 'Hojas reiniciadas, relojes activos y diseño corporativo aplicado.');
}
