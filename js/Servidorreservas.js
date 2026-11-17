// Servidor en Google Apps Script para Hospedaje Nissi: Base de Datos Google Sheets, Apartados e Inventario

const Parametrosistema = {
  modeloia: 'gemini-3.8-flash',
  urlgemini: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  versionapi: '2026-05-20',
  horacheckout: 12,
  horainformediario: 19,
  zonahoraria: 'America/Bogota'
};

const Catalogoinicial = [
  ['01', 'Sencilla', '1 a 2 personas', 2, 90000, 'Disponible'],
  ['02', 'Sencilla', '1 a 2 personas', 2, 90000, 'Disponible'],
  ['03', 'Doble', '2 personas', 2, 120000, 'Disponible'],
  ['04', 'Doble', '2 personas', 2, 120000, 'Disponible'],
  ['05', 'Triple', '3 personas', 3, 150000, 'Disponible'],
  ['06', 'Familiar', '4 personas', 4, 180000, 'Disponible']
];

const Configuracionbase = [
  ['PAGOMINIMOPORCENTAJE', '100', 'Porcentaje mínimo exigido para confirmar por transferencia (100%)'],
  ['MINUTOSAPARTADO', '30', 'Minutos para enviar el comprobante después de apartar'],
  ['MINUTOSESPERACORREO', '20', 'Minutos máximos esperando el correo del banco antes de pasar a administrador'],
  ['MINUTOSAVISOCANAL', '15', 'Minutos para avisar al cliente si el administrador no ha respondido'],
  ['MINUTOSRECORDATORIOCANAL', '10', 'Minutos entre cada recordatorio al administrador mientras haya un canal abierto'],
  ['MINUTOSCIERREAUTO', '120', 'Minutos para cierre automático de un canal sin respuesta (2 horas)'],
  ['CELULARADMIN', '573123639298', 'WhatsApp personal del administrador (recibe canales y avisos)'],
  ['MODOSOMBRA', 'NO', 'SI para pedir confirmación al admin antes de validar transferencia; NO para automático'],
  ['CUENTANEQUI', 'Nequi: 3123639298 (Hospedaje Nissi)', 'Datos de pago Nequi que la IA envía al huésped'],
  ['CUENTADAVIPLATA', 'Daviplata: 3123639298 (Hospedaje Nissi)', 'Datos de pago Daviplata que la IA envía al huésped'],
  ['CUENTABANCOLOMBIA', 'Bancolombia Ahorros: Por definir en esta celda', 'Datos de cuenta Bancolombia que la IA envía al huésped'],
  ['REMITENTESBANCOS', 'bancolombia.com.co,notificacionesbancolombia.com,nequi.com.co,nequi.com,daviplata.com,davivienda.com', 'Dominios de correo autorizados de bancos']
];

function Sanitizarcelda(Valor, Maximo) {
  const Limite = Maximo || 120;
  let Limpio = String(Valor == null ? '' : Valor)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, Limite);
  if (/^[=+\-@]/.test(Limpio)) {
    Limpio = "'" + Limpio;
  }
  return Limpio;
}

function Escaparhtmlservidor(Texto) {
  return String(Texto == null ? '' : Texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function Formatearfechahora(Fecha) {
  return Utilities.formatDate(Fecha || new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd HH:mm:ss');
}

function Obtenercredenciales() {
  const Propiedades = PropertiesService.getScriptProperties().getProperties();
  const Confighoja = Leerconfiguracionhoja();
  return {
    clavegemini: Propiedades.CLAVEGEMINI || '',
    tokenwhatsapp: Propiedades.TOKENWHATSAPP || '',
    idtelefonowhatsapp: Propiedades.IDTELEFONOWHATSAPP || '',
    tokenverificacion: Propiedades.TOKENVERIFICACION || 'nissiverificacion2026',
    celularadmin: String(Confighoja.CELULARADMIN || Propiedades.CELULARADMIN || '573123639298').replace(/\D/g, ''),
    correoadmin: Propiedades.CORREOADMIN || Session.getActiveUser().getEmail(),
    clavefirebase: Propiedades.CLAVEFIREBASE || 'AIzaSyDejKbwGSI3t4_gw6YRXeDwEDnhBIKjI0o'
  };
}

function Leerconfiguracionhoja() {
  const Mapa = {
    PAGOMINIMOPORCENTAJE: 100,
    MINUTOSAPARTADO: 30,
    MINUTOSESPERACORREO: 20,
    MINUTOSAVISOCANAL: 15,
    MINUTOSRECORDATORIOCANAL: 10,
    MINUTOSCIERREAUTO: 120,
    CELULARADMIN: '573123639298',
    MODOSOMBRA: 'NO',
    CUENTANEQUI: 'Nequi: 3123639298',
    CUENTADAVIPLATA: 'Daviplata: 3123639298',
    CUENTABANCOLOMBIA: 'Bancolombia: Solicitar en recepción',
    REMITENTESBANCOS: 'bancolombia.com.co,notificacionesbancolombia.com,nequi.com.co,nequi.com,daviplata.com,davivienda.com'
  };
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hoja = Libro && Libro.getSheetByName('Configuracion');
    if (!Hoja || Hoja.getLastRow() < 2) {
      return Mapa;
    }
    const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 2).getValues();
    Filas.forEach(function(Fila) {
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
      Formatearfechahora(new Date()),
      Sanitizarcelda(Modulo, 40),
      Sanitizarcelda(Accion, 80),
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
    Hojahabitaciones.appendRow(['Numero', 'Tipo', 'Capacidad', 'Huespedesmaximos', 'Tarifanoche', 'Estadoactual', 'Ultimaactualizacion']);
    const Fechahoy = Formatearfechahora(new Date()).slice(0, 16);
    Catalogoinicial.forEach(function(Filahabitacion) { Hojahabitaciones.appendRow(Filahabitacion.concat([Fechahoy])); });
  }
  const Columnasreservas = [
    'Codigo', 'Fecharegistro', 'Nombre', 'Celular', 'Habitacion', 'Fechallegada', 'Fechasalida', 'Noches', 'Huespedes', 'Horallegada',
    'Montototal', 'Montopagado', 'Referenciapago', 'Entidadpago', 'Estado', 'Canal', 'Venceapartado', 'Mediopago', 'Montocomprobante',
    'Referenciacomprobante', 'Fechacomprobante', 'Idpagobanco', 'Observaciones'
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
  }
  if (!Libro.getSheetByName('Conversaciones')) {
    Libro.insertSheet('Conversaciones').appendRow([
      'Celular', 'Nombre', 'Modo', 'Codigoreserva', 'Ultimomensajecliente',
      'Ultimomensajeadmin', 'Aperturacanal', 'Avisodemoracanal', 'Ultimorecordatorioadmin', 'Idinteraccionia'
    ]);
  }
  if (!Libro.getSheetByName('Mensajescanal')) {
    Libro.insertSheet('Mensajescanal').appendRow(['Idmensajemeta', 'Celularcliente', 'Codigoreserva', 'Direccion', 'Fechahora']);
  }
  if (!Libro.getSheetByName('Pagosrecibidos')) {
    Libro.insertSheet('Pagosrecibidos').appendRow([
      'Idpago', 'Fechacorreo', 'Entidad', 'Monto', 'Referencia', 'Pagador', 'Remitente', 'Dkimvalido', 'Estado'
    ]);
  }
  if (!Libro.getSheetByName('Registro')) {
    Libro.insertSheet('Registro').appendRow(['Fechahora', 'Modulo', 'Accion', 'Detalle']);
  }
  if (typeof Obtenerhojausuarios === 'function') { Obtenerhojausuarios(); }
  Programarrelojesautomaticos();
  Registrarbitacora('Sistema', 'Inicializarhojas', 'Pestañas, columnas y relojes verificados correctamente.');
}

function Programarrelojesautomaticos() {
  const Disparadoresactuales = ScriptApp.getProjectTriggers();
  Disparadoresactuales.forEach(function(Disparador) {
    ScriptApp.deleteTrigger(Disparador);
  });

  ScriptApp.newTrigger('Revisarapartados').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('Leercorreospago').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('Liberarhabitacionesvencidas').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Enviarinformecorreodiario').timeBased().everyDays(1).atHour(Parametrosistema.horainformediario).create();
}

// Comprueba si un estado de reserva bloquea la habitacion actualmente
function Reservaestabloqueando(Filareserva, Ahorams) {
  const Estado = String(Filareserva[14] || '').trim();
  if (Estado === 'Confirmada' || Estado === 'Verificando' || Estado === 'En canal') {
    return true;
  }
  if (Estado === 'Apartada') {
    const Vencetexto = Filareserva[16];
    if (!Vencetexto) {
      return true;
    }
    const Vencems = new Date(Vencetexto).getTime();
    return isNaN(Vencems) || Vencems > (Ahorams || Date.now());
  }
  return false;
}

function Consultardisponibilidad(Fechallegada, Fechasalida, Cantidadhuespedes) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');

  const Filashabitaciones = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasreservas = Hojareservas.getDataRange().getValues().slice(1);

  const Llegadasolicitada = Fechallegada ? new Date(Fechallegada) : null;
  const Salidasolicitada = Fechasalida ? new Date(Fechasalida) : null;
  const Huespedesminimos = parseInt(Cantidadhuespedes || 1, 10);
  const Ahorams = Date.now();
  const Habitacionesocupadasenrango = {};

  if (Llegadasolicitada && Salidasolicitada) {
    Filasreservas.forEach(function(Filareserva) {
      if (Reservaestabloqueando(Filareserva, Ahorams)) {
        const Numerohab = String(Filareserva[4]).padStart(2, '0');
        const Llegadaexistente = new Date(Filareserva[5]);
        const Salidaexistente = new Date(Filareserva[6]);
        if (Llegadasolicitada < Salidaexistente && Salidasolicitada > Llegadaexistente) {
          Habitacionesocupadasenrango[Numerohab] = String(Filareserva[14]);
        }
      }
    });
  }

  const Listadodisponibles = [];
  const Listadogeneral = [];

  Filashabitaciones.forEach(function(Filahab) {
    const Numerohab = String(Filahab[0]).padStart(2, '0');
    const Tipohab = String(Filahab[1]);
    const Capacidadtexto = String(Filahab[2]);
    const Maxhuespedes = parseInt(Filahab[3], 10);
    const Tarifanoche = Number(Filahab[4]);
    const Estadopestana = String(Filahab[5]);

    const Ocupadahoy = !Llegadasolicitada && Estadopestana === 'Ocupada';
    const Ocupadafechas = Boolean(Habitacionesocupadasenrango[Numerohab]);
    const Disponible = !Ocupadahoy && !Ocupadafechas && Maxhuespedes >= Huespedesminimos;

    const Objetoestado = {
      numero: Numerohab,
      tipo: Tipohab,
      capacidad: Capacidadtexto,
      huespedesmaximos: Maxhuespedes,
      tarifanoche: Tarifanoche,
      estadoactual: Ocupadafechas ? 'Ocupada' : Estadopestana,
      disponible: Disponible
    };

    Listadogeneral.push(Objetoestado);
    if (Disponible) {
      Listadodisponibles.push(Objetoestado);
    }
  });

  return {
    fechallegada: Fechallegada || 'hoy',
    fechasalida: Fechasalida || 'por definir',
    disponibles: Listadodisponibles,
    todas: Listadogeneral
  };
}

// Aparta la habitacion de inmediato cuando el cliente la elige
function Apartarhabitacion(Celularcliente, Numerohabitacion, Fechallegada, Fechasalida, Cantidadhuespedes, Canalorigen) {
  const Candado = LockService.getScriptLock();
  Candado.waitLock(10000);
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojareservas = Libro.getSheetByName('Reservas');
    const Config = Leerconfiguracionhoja();
    const Numerohab = String(Numerohabitacion || '01').padStart(2, '0');
    const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');

    // Si el cliente ya tenia otro apartado activo, se libera el anterior (solo 1 apartado por cliente)
    if (Celularlimpio) {
      Liberarapartadosprevioscliente(Hojareservas, Celularlimpio);
    }

    const Disponibilidad = Consultardisponibilidad(Fechallegada, Fechasalida, Cantidadhuespedes || 1);
    const Hablibre = Disponibilidad.disponibles.find(function(H) {
      return H.numero === Numerohab;
    });

    if (!Hablibre) {
      return {
        exito: false,
        mensaje: `La habitación ${Numerohab} ya no está disponible para esas fechas.`
      };
    }

    const Noches = Math.max(1, Math.round((new Date(Fechasalida) - new Date(Fechallegada)) / 86400000));
    const Montototal = Noches * Hablibre.tarifanoche;
    const Codigo = `NS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const Ahora = new Date();
    const Vence = new Date(Ahora.getTime() + Number(Config.MINUTOSAPARTADO || 30) * 60000);

    const Nuevafila = [
      Codigo, Formatearfechahora(Ahora).slice(0, 16), 'Por confirmar', Sanitizarcelda(Celularlimpio, 20),
      Numerohab, Sanitizarcelda(Fechallegada, 15), Sanitizarcelda(Fechasalida, 15), Noches,
      Number(Cantidadhuespedes || 2), 'Por confirmar', Montototal, 0, '', '', 'Apartada',
      Sanitizarcelda(Canalorigen || 'WhatsApp', 20), Formatearfechahora(Vence), '', '', '', '', '', 'Apartada automáticamente'
    ];

    Hojareservas.appendRow(Nuevafila);
    if (typeof Actualizarconversacion === 'function' && Celularlimpio) {
      Actualizarconversacion(Celularlimpio, { codigoreserva: Codigo });
    }
    Registrarbitacora('Apartados', 'Apartarhabitacion', `Hab ${Numerohab} apartada (${Codigo}) hasta ${Formatearfechahora(Vence)}`);

    return {
      exito: true,
      codigo: Codigo,
      habitacion: Numerohab,
      tipo: Hablibre.tipo,
      noches: Noches,
      montototal: Montototal,
      minutosapartado: Number(Config.MINUTOSAPARTADO || 30),
      venceapartado: Formatearfechahora(Vence)
    };
  } finally {
    Candado.releaseLock();
  }
}

function Liberarapartadosprevioscliente(Hojareservas, Celularlimpio) {
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = 1; I < Filas.length; I++) {
    const Celularfila = String(Filas[I][3] || '').replace(/\D/g, '');
    const Estado = String(Filas[I][14] || '');
    if (Celularfila === Celularlimpio && Estado === 'Apartada') {
      Hojareservas.getRange(I + 1, 15).setValue('Vencida');
      Hojareservas.getRange(I + 1, 23).setValue('Liberada por cambio de habitación');
    }
  }
}

function Liberarapartado(Celularcliente, Codigoreserva, Motivo) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');

  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincidecodigo = Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase();
    const Coincidecelular = Celularlimpio && String(Filas[I][3]).replace(/\D/g, '') === Celularlimpio;
    if ((Coincidecodigo || Coincidecelular) && String(Filas[I][14]) === 'Apartada') {
      Hojareservas.getRange(I + 1, 15).setValue('Vencida');
      Hojareservas.getRange(I + 1, 23).setValue(Sanitizarcelda(Motivo || 'Desistió el cliente', 120));
      Registrarbitacora('Apartados', 'Liberarapartado', `Reserva ${Filas[I][0]} liberada.`);
      return { exito: true, codigo: Filas[I][0], mensaje: 'Apartado liberado correctamente.' };
    }
  }
  return { exito: false, mensaje: 'No se encontró un apartado activo para liberar.' };
}

function Cambiarocupacionhabitacion(Hojahabitaciones, Numerohabitacion, Nuevoestado) {
  const Datos = Hojahabitaciones.getDataRange().getValues();
  const Ahora = Formatearfechahora(new Date()).slice(0, 16);
  for (let Indice = 1; Indice < Datos.length; Indice++) {
    if (String(Datos[Indice][0]).padStart(2, '0') === String(Numerohabitacion).padStart(2, '0')) {
      Hojahabitaciones.getRange(Indice + 1, 6).setValue(Nuevoestado);
      Hojahabitaciones.getRange(Indice + 1, 7).setValue(Ahora);
      break;
    }
  }
}

// Guarda nombre completo, cedula y hora estimada de llegada en la reserva activa
function Guardardatoshuesped(Celularcliente, Codigoreserva, Nombre, Cedula, Horallegada) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');

  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincidecodigo = Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase();
    const Coincidecelular = Celularlimpio && String(Filas[I][3]).replace(/\D/g, '') === Celularlimpio;
    const Estado = String(Filas[I][14]);
    if ((Coincidecodigo || Coincidecelular) && (Estado === 'Apartada' || Estado === 'Verificando' || Estado === 'En canal')) {
      const Nombreconcedula = Cedula
        ? `${Sanitizarcelda(Nombre || 'Viajero', 70)} (C.C. ${Sanitizarcelda(Cedula, 20)})`
        : Sanitizarcelda(Nombre || 'Viajero', 80);
      Hojareservas.getRange(I + 1, 3).setValue(Nombreconcedula);
      if (Horallegada) {
        Hojareservas.getRange(I + 1, 10).setValue(Sanitizarcelda(Horallegada, 40));
      }
      if (typeof Actualizarconversacion === 'function' && Celularlimpio) {
        Actualizarconversacion(Celularlimpio, { nombre: Sanitizarcelda(Nombre, 60), codigoreserva: String(Filas[I][0]) });
      }
      return { exito: true, codigo: String(Filas[I][0]), nombre: Nombreconcedula, horallegada: Horallegada || 'Por confirmar' };
    }
  }
  return { exito: false, mensaje: 'Primero debes apartar una habitación antes de guardar los datos del huésped.' };
}

// Devuelve las cuentas de transferencia y el monto a pagar desde la hoja Configuracion
function Enviardatospago(Celularcliente, Codigoreserva) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Config = Leerconfiguracionhoja();
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = String(Celularcliente || '').replace(/\D/g, '');

  for (let I = Filas.length - 1; I >= 1; I--) {
    const Coincidecodigo = Codigoreserva && String(Filas[I][0]).toUpperCase() === String(Codigoreserva).toUpperCase();
    const Coincidecelular = Celularlimpio && String(Filas[I][3]).replace(/\D/g, '') === Celularlimpio;
    if ((Coincidecodigo || Coincidecelular) && String(Filas[I][14]) === 'Apartada') {
      const Total = Number(Filas[I][10] || 0);
      Hojareservas.getRange(I + 1, 18).setValue('Transferencia');
      return {
        exito: true,
        codigo: String(Filas[I][0]),
        habitacion: String(Filas[I][4]).padStart(2, '0'),
        montototal: Total,
        montoexigido: Total,
        cuentas: [Config.CUENTANEQUI, Config.CUENTADAVIPLATA, Config.CUENTABANCOLOMBIA],
        instruccion: `El pago mínimo es del 100% ($${Total.toLocaleString('es-CO')} COP). Tienes ${Config.MINUTOSAPARTADO} minutos para enviar la captura del comprobante por este chat.`
      };
    }
  }
  return { exito: false, mensaje: 'No se encontró una reserva apartada activa para este cliente.' };
}
