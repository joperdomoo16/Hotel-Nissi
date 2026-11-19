// Servidor en Google Apps Script para Hospedaje Nissi: Base de Datos Google Sheets, Apartados e Inventario

const Parametrosistema = {
  modeloia: 'gemini-3.5-flash-lite',
  urlgemini: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  versionapi: '2026-05-20',
  horacheckout: 11,
  horainformediario: 19,
  zonahoraria: 'America/Bogota'
};

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

function Sanitizarcelda(Valor, Maximo) {
  let Limpio = String(Valor == null ? '' : Valor).replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, Maximo || 120);
  return /^[=+\-@]/.test(Limpio) ? "'" + Limpio : Limpio;
}

// Conserva tanto numeros telefonicos E.164 como identificadores BSUID alfanumericos de Meta (ej. CO.1349...)
function Normalizaridwhatsapp(Valor) {
  const Crudo = String(Valor == null ? '' : Valor).trim();
  if (!Crudo) { return ''; }
  return /[A-Za-z]/.test(Crudo) ? Crudo : Crudo.replace(/\D/g, '');
}

function Escaparhtmlservidor(Texto) {
  return String(Texto == null ? '' : Texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function Formatearfechahora(Fecha) {
  return Utilities.formatDate(Fecha || new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd HH:mm:ss');
}

function Obtenercredenciales() {
  const Propiedades = PropertiesService.getScriptProperties().getProperties();
  const Confighoja = Leerconfiguracionhoja();
  let Adminlimpio = String(Confighoja.CELULARADMIN || Propiedades.CELULARADMIN || '573123639298').replace(/\D/g, '');
  if (Adminlimpio.length === 10 && Adminlimpio.indexOf('3') === 0) { Adminlimpio = '57' + Adminlimpio; }
  return {
    clavegemini: String(Propiedades.CLAVEGEMINI || '').trim(),
    tokenwhatsapp: String(Propiedades.TOKENWHATSAPP || '').trim(),
    idtelefonowhatsapp: String(Propiedades.IDTELEFONOWHATSAPP || '').trim(),
    tokenverificacion: String(Propiedades.TOKENVERIFICACION || '').trim(),
    llavewebhook: String(Propiedades.LLAVEWEBHOOK || '').trim(),
    celularadmin: Adminlimpio,
    correoadmin: Propiedades.CORREOADMIN || Session.getActiveUser().getEmail(),
    clavefirebase: String(Propiedades.CLAVEFIREBASE || '').trim()
  };
}

function Leerconfiguracionhoja() {
  const Mapa = {
    PAGOMINIMOPORCENTAJE: 100, MINUTOSAPARTADO: 30, MINUTOSESPERACORREO: 20,
    MINUTOSRECORDATORIOCLIENTE: 2, MINUTOSESPERAADMIN: 15, MINUTOSRECORDATORIOCANAL: 5,
    MINUTOSINACTIVIDADCANAL: 15, MINUTOSCIERREPOSTCANAL: 15, MINUTOSAVISOCANAL: 15,
    MINUTOSCIERREAUTO: 120, CELULARADMIN: '573123639298', MODOSOMBRA: 'NO',
    TARIFA1PERSONA: 55000, TARIFA2PERSONASCAMACOMPARTIDA: 70000, TARIFA2PERSONASCAMASSEPARADAS: 90000,
    TARIFA3PERSONAS: 110000, VALORHORAADICIONAL: 10000, HORACHECKOUT: 11, MINUTOSRECORDATORIOLIMPIEZA: 20,
    CUENTANEQUI: 'Nequi: 3123639298',
    REMITENTESBANCOS: 'nequi.com.co,nequi.com,notificacionesnequi.com,bancolombia.com.co,notificacionesbancolombia.com'
  };
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hoja = Libro && Libro.getSheetByName('Configuracion');
    if (!Hoja || Hoja.getLastRow() < 2) { return Mapa; }
    Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 2).getValues().forEach(function(Fila) {
      const Clave = String(Fila[0] || '').trim().toUpperCase();
      const Valor = String(Fila[1] == null ? '' : Fila[1]).trim();
      if (Clave && Valor !== '') {
        Mapa[Clave] = isNaN(Number(Valor)) || Clave === 'CELULARADMIN' ? Valor : Number(Valor);
      }
    });
  } catch (Errorconfig) {}
  return Mapa;
}

function Registrarbitacora(Modulo, Accion, Detalle) {
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    let Hoja = Libro.getSheetByName('Registro');
    if (!Hoja) {
      Hoja = Libro.insertSheet('Registro');
      Hoja.appendRow(['Fechahora', 'Modulo', 'Accion', 'Detalle']);
    }
    Hoja.appendRow([
      Formatearfechahora(new Date()), Sanitizarcelda(Modulo, 40), Sanitizarcelda(Accion, 80),
      Sanitizarcelda(typeof Detalle === 'string' ? Detalle : JSON.stringify(Detalle), 500)
    ]);
  } catch (Errorbitacora) {}
}

// Crea o actualiza las pestañas y columnas necesarias sin alterar los datos existentes
function Inicializarhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();

  let Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojahabitaciones) {
    Hojahabitaciones = Libro.insertSheet('Habitaciones');
    Hojahabitaciones.appendRow(['Numero', 'Tipo', 'Capacidad', 'Huespedesmaximos', 'Tarifanoche', 'Estadoactual', 'Ultimaactualizacion', 'Camas', 'Camasindividuales', 'Comodidades']);
    const Fechahoy = Formatearfechahora(new Date()).slice(0, 16);
    Catalogoreal.forEach(function(F) { Hojahabitaciones.appendRow([F[0], F[1], F[2], F[3], F[4], F[5], Fechahoy, F[6], F[7], F[8]]); });
  }
  const Columnasreservas = [
    'Codigo', 'Fecharegistro', 'Nombre', 'Celular', 'Habitacion', 'Fechallegada', 'Fechasalida', 'Noches', 'Huespedes', 'Horallegada',
    'Montototal', 'Montopagado', 'Referenciapago', 'Entidadpago', 'Estado', 'Canal', 'Venceapartado', 'Mediopago', 'Montocomprobante',
    'Referenciacomprobante', 'Fechacomprobante', 'Idpagobanco', 'Observaciones', 'Horasalida', 'Horasadicionales', 'Valoradicional'
  ];
  let Hojareservas = Libro.getSheetByName('Reservas');
  if (!Hojareservas) {
    Hojareservas = Libro.insertSheet('Reservas');
    Hojareservas.appendRow(Columnasreservas);
  } else {
    const Encabezadosactuales = Hojareservas.getRange(1, 1, 1, Hojareservas.getLastColumn()).getValues()[0].map(String);
    Columnasreservas.forEach(function(Nombrecol, Indice) {
      if (Indice >= Encabezadosactuales.length) { Hojareservas.getRange(1, Indice + 1).setValue(Nombrecol); }
    });
  }
  let Hojaconfig = Libro.getSheetByName('Configuracion');
  if (!Hojaconfig) {
    Hojaconfig = Libro.insertSheet('Configuracion');
    Hojaconfig.appendRow(['Parametro', 'Valor', 'Descripcion']);
    Configuracionbase.forEach(function(Fila) { Hojaconfig.appendRow(Fila); });
  } else {
    const Existcfg = Hojaconfig.getLastRow() >= 2 ? Hojaconfig.getRange(2, 1, Hojaconfig.getLastRow() - 1, 1).getValues().map(function(R) { return String(R[0]).trim().toUpperCase(); }) : [];
    Configuracionbase.forEach(function(Fila) { if (Existcfg.indexOf(Fila[0]) === -1) { Hojaconfig.appendRow(Fila); } });
  }
  const Columnasconv = ['Celular', 'Nombre', 'Modo', 'Codigoreserva', 'Ultimomensajecliente', 'Ultimomensajeadmin', 'Aperturacanal', 'Avisodemoracanal', 'Ultimorecordatorioadmin', 'Idinteraccionia', 'Ultimorecordatoriocliente', 'Motivorequerimiento', 'Resumencontexto'];
  let Hojaconv = Libro.getSheetByName('Conversaciones');
  if (!Hojaconv) {
    Hojaconv = Libro.insertSheet('Conversaciones');
    Hojaconv.appendRow(Columnasconv);
  } else {
    const Encconv = Hojaconv.getRange(1, 1, 1, Hojaconv.getLastColumn()).getValues()[0].map(String);
    Columnasconv.forEach(function(Nom, Idx) { if (Idx >= Encconv.length) { Hojaconv.getRange(1, Idx + 1).setValue(Nom); } });
  }
  if (!Libro.getSheetByName('Mensajescanal')) { Libro.insertSheet('Mensajescanal').appendRow(['Idmensajemeta', 'Celularcliente', 'Codigoreserva', 'Direccion', 'Fechahora']); }
  if (!Libro.getSheetByName('Pagosrecibidos')) { Libro.insertSheet('Pagosrecibidos').appendRow(['Idpago', 'Fechacorreo', 'Entidad', 'Monto', 'Referencia', 'Pagador', 'Remitente', 'Dkimvalido', 'Estado']); }
  if (!Libro.getSheetByName('Registro')) { Libro.insertSheet('Registro').appendRow(['Fechahora', 'Modulo', 'Accion', 'Detalle']); }
  if (typeof Obtenerhojausuarios === 'function') { Obtenerhojausuarios(); }
  Programarrelojesautomaticos();
  if (typeof Aplicardisenoempresarialhojas === 'function') { Aplicardisenoempresarialhojas(); }
  Registrarbitacora('Sistema', 'Inicializarhojas', 'Pestañas, columnas y relojes verificados correctamente.');
}

function Programarrelojesautomaticos() {
  ScriptApp.getProjectTriggers().forEach(function(Disparador) { ScriptApp.deleteTrigger(Disparador); });
  ScriptApp.newTrigger('Revisarcanales').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('Revisarapartados').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('Leercorreospago').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('Liberarhabitacionesvencidas').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Enviarrecordatoriocheckout').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Enviarinformecorreodiario').timeBased().everyDays(1).atHour(Parametrosistema.horainformediario).create();
}

// Comprueba si un estado de reserva bloquea la habitacion actualmente
function Reservaestabloqueando(Filareserva, Ahorams) {
  const Estado = String(Filareserva[14] || '').trim();
  if (Estado === 'Confirmada' || Estado === 'Verificando' || Estado === 'En canal') { return true; }
  if (Estado === 'Apartada') {
    if (!Filareserva[16]) { return true; }
    const Vencems = new Date(Filareserva[16]).getTime();
    return isNaN(Vencems) || Vencems > (Ahorams || Date.now());
  }
  return false;
}

function Consultardisponibilidad(Fechallegada, Fechasalida, Cantidadhuespedes, Camasseparadas) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');

  const Filashabitaciones = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasreservas = Hojareservas.getDataRange().getValues().slice(1);

  const Llegadasolicitada = Fechallegada ? new Date(Fechallegada) : null;
  const Salidasolicitada = Fechasalida ? new Date(Fechasalida) : null;
  const Huespedesminimos = parseInt(Cantidadhuespedes || 1, 10);
  if (Huespedesminimos > 3) {
    return { fechallegada: Fechallegada || 'hoy', fechasalida: Fechasalida || 'por definir', requiereadmin: true, disponibles: [], todas: [], mensaje: 'Grupos de más de 3 personas requieren atención directa de un administrador.' };
  }

  const Ahorams = Date.now();
  const Habitacionesocupadasenrango = {};
  const Habitacionesenproceso = {};

  Filasreservas.forEach(function(Filareserva) {
    if (Reservaestabloqueando(Filareserva, Ahorams)) {
      const Numerohab = String(Filareserva[4]).padStart(2, '0');
      const Estado = String(Filareserva[14] || '').trim();
      if (Estado === 'Apartada' || Estado === 'Verificando' || Estado === 'En canal') {
        Habitacionesenproceso[Numerohab] = Estado;
      }
      if (Llegadasolicitada && Salidasolicitada) {
        const Llegadaexistente = new Date(Filareserva[5]);
        const Salidaexistente = new Date(Filareserva[6]);
        if (Llegadasolicitada < Salidaexistente && Salidasolicitada > Llegadaexistente) {
          Habitacionesocupadasenrango[Numerohab] = Estado;
        }
      }
    }
  });

  const Config = Leerconfiguracionhoja();
  const Listadodisponibles = [];
  const Listadogeneral = [];

  Filashabitaciones.forEach(function(Filahab) {
    const Numerohab = String(Filahab[0]).padStart(2, '0');
    const Tipohab = String(Filahab[1]);
    const Capacidadtexto = String(Filahab[2]);
    const Maxhuespedes = parseInt(Filahab[3], 10);
    const Estadopestana = String(Filahab[5]);
    const Camastexto = String(Filahab[7] || '');
    const Comodidades = String(Filahab[9] || 'Aire acondicionado, Wi-Fi, TV, parqueadero');
    const Enmantenimiento = Numerohab === '03' || Estadopestana === 'Mantenimiento';
    const Enlimpieza = !Enmantenimiento && (Estadopestana === 'Limpieza' || Estadopestana === 'Pendiente de limpieza');

    const Estadorango = Habitacionesocupadasenrango[Numerohab] || '';
    const Estadoproceso = Habitacionesenproceso[Numerohab] || '';
    const Ocupadahoy = !Llegadasolicitada && Estadopestana === 'Ocupada';
    const Ocupadaconfirmada = Ocupadahoy || Estadorango === 'Confirmada';
    const Enapartado = !Enmantenimiento && !Enlimpieza && !Ocupadaconfirmada && Boolean(Estadoproceso || (Estadorango && Estadorango !== 'Confirmada'));
    const Disponible = !Enmantenimiento && !Enlimpieza && !Ocupadaconfirmada && !Enapartado && Maxhuespedes >= Huespedesminimos;
    const Estadomostrar = Enmantenimiento ? 'Mantenimiento' : (Enlimpieza ? 'Limpieza' : (Ocupadaconfirmada ? 'Ocupada' : (Enapartado ? 'Apartada' : 'Disponible')));

    const Tarifaobj = Calculartarifanoche(Huespedesminimos, Camasseparadas, Numerohab);
    const Objetoestado = {
      numero: Numerohab, tipo: Tipohab, capacidad: Capacidadtexto, huespedesmaximos: Maxhuespedes,
      camas: Camastexto, comodidades: Comodidades, admitecamasseparadas: Habitacionadmitecamasseparadas(Numerohab),
      tarifanoche: Tarifaobj.tarifanoche || Number(Config.TARIFA1PERSONA || 55000),
      tarifacamacompartida: Number(Config.TARIFA2PERSONASCAMACOMPARTIDA || 70000),
      tarifacamasseparadas: Number(Config.TARIFA2PERSONASCAMASSEPARADAS || 90000),
      estadoactual: Estadomostrar, disponible: Disponible
    };
    Listadogeneral.push(Objetoestado);
    if (Disponible) { Listadodisponibles.push(Objetoestado); }
  });

  return { fechallegada: Fechallegada || 'hoy', fechasalida: Fechasalida || 'por definir', disponibles: Listadodisponibles, todas: Listadogeneral };
}

// Aparta la habitacion de inmediato cuando el cliente la elige
function Apartarhabitacion(Celularcliente, Numerohabitacion, Fechallegada, Fechasalida, Cantidadhuespedes, Canalorigen, Camasseparadas) {
  const Candado = LockService.getScriptLock();
  Candado.waitLock(10000);
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojareservas = Libro.getSheetByName('Reservas');
    const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
    const Config = Leerconfiguracionhoja();
    const Numerohab = String(Numerohabitacion || '01').padStart(2, '0');
    const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
    const Personas = parseInt(Cantidadhuespedes || 1, 10);

    if (Personas > 3) {
      return { exito: false, requiereadmin: true, mensaje: 'Para más de 3 personas se requiere atención directa de un administrador.' };
    }
    if (Celularlimpio) { Liberarapartadosprevioscliente(Hojareservas, Hojahabitaciones, Celularlimpio); }

    const Disponibilidad = Consultardisponibilidad(Fechallegada, Fechasalida, Personas, Camasseparadas);
    const Hablibre = Disponibilidad.disponibles.find(function(H) { return H.numero === Numerohab; });
    if (!Hablibre) {
      return { exito: false, mensaje: `La habitación ${Numerohab} ya no está disponible para esas fechas.` };
    }

    const Calculo = Calculartarifanoche(Personas, Camasseparadas, Numerohab);
    const Noches = Math.max(1, Math.round((new Date(Fechasalida) - new Date(Fechallegada)) / 86400000));
    const Montototal = Noches * Calculo.tarifanoche;
    const Codigo = Generarcodigoreservaservidor();
    const Ahora = new Date();
    const Vence = new Date(Ahora.getTime() + Number(Config.MINUTOSAPARTADO || 30) * 60000);
    const Horasalidadefault = `${String(Number(Config.HORACHECKOUT || 11)).padStart(2, '0')}:00`;

    Hojareservas.appendRow([
      Codigo, Formatearfechahora(Ahora).slice(0, 16), 'Por confirmar', Sanitizarcelda(Celularlimpio, 45),
      Numerohab, Sanitizarcelda(Fechallegada, 15), Sanitizarcelda(Fechasalida, 15), Noches,
      Personas, 'Por confirmar', Montototal, 0, '', '', 'Apartada',
      Sanitizarcelda(Canalorigen || 'WhatsApp', 20), Formatearfechahora(Vence), '', '', '', '', '',
      Sanitizarcelda(Calculo.detallecamas, 100), Horasalidadefault, 0, 0
    ]);
    Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, 'Apartada');
    if (typeof Actualizarconversacion === 'function' && Celularlimpio) {
      Actualizarconversacion(Celularlimpio, { codigoreserva: Codigo });
    }
    Registrarbitacora('Apartados', 'Apartarhabitacion', `Hab ${Numerohab} apartada (${Codigo}) · ${Calculo.detallecamas} · $${Montototal}`);

    return {
      exito: true, codigo: Codigo, habitacion: Numerohab, tipo: Hablibre.tipo, noches: Noches,
      tarifanoche: Calculo.tarifanoche, detallecamas: Calculo.detallecamas, montototal: Montototal,
      minutosapartado: Number(Config.MINUTOSAPARTADO || 30), venceapartado: Formatearfechahora(Vence)
    };
  } finally {
    Candado.releaseLock();
  }
}

function Liberarapartadosprevioscliente(Hojareservas, Hojahabitaciones, Celularlimpio) {
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = 1; I < Filas.length; I++) {
    if (Normalizaridwhatsapp(Filas[I][3]) === Celularlimpio && String(Filas[I][14] || '') === 'Apartada') {
      Hojareservas.getRange(I + 1, 15).setValue('Vencida');
      Hojareservas.getRange(I + 1, 23).setValue('Liberada por cambio de habitación');
      if (Hojahabitaciones) { Cambiarocupacionhabitacion(Hojahabitaciones, Filas[I][4], 'Disponible'); }
    }
  }
}

function Liberarapartado(Celularcliente, Codigoreserva, Motivo) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincide = (Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase()) || (Celularlimpio && Normalizaridwhatsapp(Filas[I][3]) === Celularlimpio);
    const Est = String(Filas[I][14]);
    if (Coincide && (Est === 'Apartada' || Est === 'Confirmada')) {
      const Nuevoest = Est === 'Confirmada' ? 'Cancelada' : 'Vencida';
      Hojareservas.getRange(I + 1, 15).setValue(Nuevoest);
      Hojareservas.getRange(I + 1, 23).setValue(Sanitizarcelda(Motivo || 'Cancelada por el cliente', 120));
      if (Hojahabitaciones) { Cambiarocupacionhabitacion(Hojahabitaciones, Filas[I][4], 'Disponible'); }
      if (Est === 'Confirmada' && typeof Enviarmensajeinteligente === 'function') {
        Enviarmensajeinteligente(Obtenercredenciales().celularadmin, `Reserva cancelada por el cliente · ${Filas[I][0]} (Hab. ${String(Filas[I][4]).padStart(2, '0')} · ${Filas[I][2]}). Motivo: ${Motivo || 'Solicitado en chat'}.`, '', []);
      }
      Registrarbitacora('Apartados', 'Liberarapartado', `Reserva ${Filas[I][0]} -> ${Nuevoest}`);
      return { exito: true, codigo: Filas[I][0], estado: Nuevoest, mensaje: `Reserva ${Nuevoest.toLowerCase()} correctamente.` };
    }
  }
  return { exito: false, mensaje: 'No se encontró una reserva activa para cancelar o liberar.' };
}

function Cambiarocupacionhabitacion(Hojahabitaciones, Numerohabitacion, Nuevoestado) {
  const Num = String(Numerohabitacion).padStart(2, '0');
  if (Num === '03' && Nuevoestado !== 'Mantenimiento') { return; }
  const Datos = Hojahabitaciones.getDataRange().getValues();
  const Ahora = Formatearfechahora(new Date()).slice(0, 16);
  for (let Indice = 1; Indice < Datos.length; Indice++) {
    if (String(Datos[Indice][0]).padStart(2, '0') === Num) {
      Hojahabitaciones.getRange(Indice + 1, 6).setValue(Nuevoestado);
      Hojahabitaciones.getRange(Indice + 1, 7).setValue(Ahora);
      break;
    }
  }
}

function Guardardatoshuesped(Celularcliente, Codigoreserva, Nombre, Cedula, Horallegada, Celularcontacto, Parqueadero) {
  const Hojareservas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reservas');
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincide = (Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase()) || (Celularlimpio && Normalizaridwhatsapp(Filas[I][3]) === Celularlimpio);
    const Estado = String(Filas[I][14]);
    if (Coincide && (Estado === 'Apartada' || Estado === 'Verificando' || Estado === 'En canal')) {
      const Nombreconcedula = Cedula ? `${Sanitizarcelda(Nombre || 'Viajero', 70)} (C.C. ${Sanitizarcelda(Cedula, 20)})` : Sanitizarcelda(Nombre || 'Viajero', 80);
      Hojareservas.getRange(I + 1, 3).setValue(Nombreconcedula);
      if (Horallegada) { Hojareservas.getRange(I + 1, 10).setValue(Sanitizarcelda(Horallegada, 40)); }
      const Detalles = [String(Filas[I][22] || '').trim()].filter(Boolean);
      if (Celularcontacto) { Detalles.push(`Contacto: ${Celularcontacto}`); }
      if (Parqueadero) { Detalles.push(`Parqueadero: ${Parqueadero}`); }
      if (Detalles.length) { Hojareservas.getRange(I + 1, 23).setValue(Sanitizarcelda(Detalles.join(' · '), 140)); }
      if (typeof Actualizarconversacion === 'function' && Celularlimpio) { Actualizarconversacion(Celularlimpio, { nombre: Sanitizarcelda(Nombre, 60), codigoreserva: String(Filas[I][0]) }); }
      return { exito: true, codigo: String(Filas[I][0]), nombre: Nombreconcedula, horallegada: Horallegada || 'Por confirmar', parqueadero: Parqueadero || 'No especificado' };
    }
  }
  return { exito: false, mensaje: 'Primero debes apartar una habitación antes de guardar los datos del huésped.' };
}
