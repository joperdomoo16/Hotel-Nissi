// Servidor en Google Apps Script para Hotel Nissi: Base de Datos Google Sheets, Disponibilidad e Inventario

const Parametrosistema = {
  modeloia: 'gemini-3.8-flash',
  urlgemini: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  versionapi: '2026-05-20',
  horacheckout: 12,
  horainformediario: 19
};

const Catalogoinicial = [
  ['01', 'Sencilla', '1 a 2 personas', 2, 90000, 'Disponible'],
  ['02', 'Sencilla', '1 a 2 personas', 2, 90000, 'Disponible'],
  ['03', 'Doble', '2 personas', 2, 120000, 'Disponible'],
  ['04', 'Doble', '2 personas', 2, 120000, 'Disponible'],
  ['05', 'Triple', '3 personas', 3, 150000, 'Disponible'],
  ['06', 'Familiar', '4 personas', 4, 180000, 'Disponible']
];

// Funciones de sanitizacion contra inyeccion de formulas en Sheets y XSS en correos
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

// Lee las claves guardadas en Propiedades del Script (Clave Gemini, Token WhatsApp, Celular y Correo Admin)
function Obtenercredenciales() {
  const Propiedades = PropertiesService.getScriptProperties().getProperties();
  return {
    clavegemini: Propiedades.CLAVEGEMINI || '',
    tokenwhatsapp: Propiedades.TOKENWHATSAPP || '',
    idtelefonowhatsapp: Propiedades.IDTELEFONOWHATSAPP || '',
    tokenverificacion: Propiedades.TOKENVERIFICACION || 'nissiverificacion',
    celularadmin: Propiedades.CELULARADMIN || '573001234567',
    correoadmin: Propiedades.CORREOADMIN || Session.getActiveUser().getEmail()
  };
}

// Crea las pestañas Habitaciones y Reservas si no existen y programa los relojes automaticos
function Inicializarhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();

  let Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojahabitaciones) {
    Hojahabitaciones = Libro.insertSheet('Habitaciones');
    Hojahabitaciones.appendRow([
      'Numero', 'Tipo', 'Capacidad', 'Huespedesmaximos', 'Tarifanoche', 'Estadoactual', 'Ultimaactualizacion'
    ]);
    const Fechahoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
    Catalogoinicial.forEach(function(Filahabitacion) {
      Hojahabitaciones.appendRow(Filahabitacion.concat([Fechahoy]));
    });
  }

  let Hojareservas = Libro.getSheetByName('Reservas');
  if (!Hojareservas) {
    Hojareservas = Libro.insertSheet('Reservas');
    Hojareservas.appendRow([
      'Codigo', 'Fecharegistro', 'Nombre', 'Celular', 'Habitacion',
      'Fechallegada', 'Fechasalida', 'Noches', 'Huespedes', 'Horallegada',
      'Montototal', 'Montopagado', 'Referenciapago', 'Entidadpago', 'Estado'
    ]);
  }

  Programarrelojesautomaticos();
}

// Configura el reloj cada hora (liberar habitaciones vencidas) y el reloj diario (enviar correo de informe)
function Programarrelojesautomaticos() {
  const Disparadoresactuales = ScriptApp.getProjectTriggers();
  Disparadoresactuales.forEach(function(Disparador) {
    ScriptApp.deleteTrigger(Disparador);
  });

  ScriptApp.newTrigger('Liberarhabitacionesvencidas')
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger('Enviarinformecorreodiario')
    .timeBased()
    .everyDays(1)
    .atHour(Parametrosistema.horainformediario)
    .create();
}

// Devuelve las habitaciones libres cruzando el estado actual y los rangos de fechas en Reservas
function Consultardisponibilidad(Fechallegada, Fechasalida, Cantidadhuespedes) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');

  const Filashabitaciones = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasreservas = Hojareservas.getDataRange().getValues().slice(1);

  const Llegadasolicitada = Fechallegada ? new Date(Fechallegada) : null;
  const Salidasolicitada = Fechasalida ? new Date(Fechasalida) : null;
  const Huespedesminimos = parseInt(Cantidadhuespedes || 1, 10);

  const Habitacionesocupadasenrango = {};

  if (Llegadasolicitada && Salidasolicitada) {
    Filasreservas.forEach(function(Filareserva) {
      const Numerohab = String(Filareserva[4]).padStart(2, '0');
      const Llegadaexistente = new Date(Filareserva[5]);
      const Salidaexistente = new Date(Filareserva[6]);
      const Estadoreserva = String(Filareserva[14]);

      if (Estadoreserva === 'Confirmada') {
        const Haycruce = Llegadasolicitada < Salidaexistente && Salidasolicitada > Llegadaexistente;
        if (Haycruce) {
          Habitacionesocupadasenrango[Numerohab] = true;
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
      estadoactual: Ocupadafechas ? 'Ocupada en esas fechas' : Estadopestana,
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

// Registra una solicitud nueva o actualiza una existente en la pestaña Reservas
function Registrarosincronizarreserva(Datos) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');

  const Numerohab = String(Datos.habitacion || '01').padStart(2, '0');
  const Disponibilidad = Consultardisponibilidad(Datos.llegada, Datos.salida, Datos.huespedes);
  const Habitacionlibre = Disponibilidad.disponibles.find(function(Hab) {
    return Hab.numero === Numerohab;
  });

  if (!Habitacionlibre) {
    return {
      exito: false,
      mensaje: `La habitación ${Numerohab} no está disponible para las fechas indicadas.`
    };
  }

  const Milisegundosdia = 86400000;
  const Noches = Math.max(1, Math.round((new Date(Datos.salida) - new Date(Datos.llegada)) / Milisegundosdia));
  const Montototal = Noches * Habitacionlibre.tarifanoche;
  const Codigoreserva = Datos.codigo || `NS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const Fecharegistro = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
  const Estadoinicial = Datos.estado || 'Pendiente';

  const Filas = Hojareservas.getDataRange().getValues();
  let Filaencontrada = -1;
  for (let Indice = 1; Indice < Filas.length; Indice++) {
    if (String(Filas[Indice][0]).toUpperCase() === Codigoreserva.toUpperCase()) {
      Filaencontrada = Indice + 1;
      break;
    }
  }

  const Nombreconcedula = Datos.cedula
    ? `${Sanitizarcelda(Datos.nombre || 'Viajero', 70)} (C.C. ${Sanitizarcelda(Datos.cedula, 20)})`
    : Sanitizarcelda(Datos.nombre || 'Viajero', 80);

  const Nuevafila = [
    Sanitizarcelda(Codigoreserva, 20),
    Fecharegistro,
    Nombreconcedula,
    Sanitizarcelda(Datos.celular || '', 20),
    Numerohab,
    Sanitizarcelda(Datos.llegada, 15),
    Sanitizarcelda(Datos.salida, 15),
    Noches,
    Number(Datos.huespedes || 2),
    Sanitizarcelda(Datos.horallegada || 'Por confirmar', 40),
    Montototal,
    Number(Datos.montopagado || 0),
    Sanitizarcelda(Datos.referenciapago || '', 60),
    Sanitizarcelda(Datos.entidadpago || '', 40),
    Sanitizarcelda(Estadoinicial, 20)
  ];

  if (Filaencontrada > 0) {
    Hojareservas.getRange(Filaencontrada, 1, 1, Nuevafila.length).setValues([Nuevafila]);
  } else {
    Hojareservas.appendRow(Nuevafila);
  }

  if (Estadoinicial === 'Confirmada') {
    Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, 'Ocupada');
  }

  return {
    exito: true,
    codigo: Codigoreserva,
    habitacion: Numerohab,
    noches: Noches,
    montototal: Montototal,
    estado: Estadoinicial
  };
}

// Cambia el estado de una habitacion en la pestaña Habitaciones (Disponible u Ocupada)
function Cambiarocupacionhabitacion(Hojahabitaciones, Numerohabitacion, Nuevoestado) {
  const Datos = Hojahabitaciones.getDataRange().getValues();
  const Ahora = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
  for (let Indice = 1; Indice < Datos.length; Indice++) {
    if (String(Datos[Indice][0]).padStart(2, '0') === String(Numerohabitacion).padStart(2, '0')) {
      Hojahabitaciones.getRange(Indice + 1, 6).setValue(Nuevoestado);
      Hojahabitaciones.getRange(Indice + 1, 7).setValue(Ahora);
      break;
    }
  }
}

// Valida un pago recibido, marca la habitacion como Ocupada y avisa por WhatsApp al administrador
function Confirmarpagoyocuparhabitacion(Codigoreserva, Montopagado, Referenciapago, Entidadpago) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Filas = Hojareservas.getDataRange().getValues();

  // Verificar que la referencia de pago no haya sido usada antes
  for (let Indice = 1; Indice < Filas.length; Indice++) {
    const Referenciaexistente = String(Filas[Indice][12] || '').trim();
    const Codigoexistente = String(Filas[Indice][0] || '').trim();
    if (Referenciaexistente && Referenciaexistente === String(Referenciapago).trim() && Codigoexistente !== Codigoreserva) {
      return {
        exito: false,
        mensaje: `El comprobante con referencia ${Referenciapago} ya fue registrado previamente en otra reserva.`
      };
    }
  }

  for (let Indice = 1; Indice < Filas.length; Indice++) {
    if (String(Filas[Indice][0]).toUpperCase() === String(Codigoreserva).toUpperCase()) {
      const Numerofila = Indice + 1;
      const Nombrehuesped = Filas[Indice][2];
      const Celularhuesped = Filas[Indice][3];
      const Numerohab = String(Filas[Indice][4]).padStart(2, '0');
      const Fechallegada = Utilities.formatDate(new Date(Filas[Indice][5]), 'America/Bogota', 'yyyy-MM-dd');
      const Fechasalida = Utilities.formatDate(new Date(Filas[Indice][6]), 'America/Bogota', 'yyyy-MM-dd');
      const Horallegada = Filas[Indice][9];
      const Montoesperado = Number(Filas[Indice][10]);
      const Montorecibido = Number(Montopagado);

      if (Montorecibido < Montoesperado * 0.5) {
        return {
          exito: false,
          mensaje: `El monto del comprobante ($${Montorecibido} COP) es menor al mínimo requerido ($${Montoesperado * 0.5} COP).`
        };
      }

      Hojareservas.getRange(Numerofila, 12).setValue(Montorecibido);
      Hojareservas.getRange(Numerofila, 13).setValue(Referenciapago);
      Hojareservas.getRange(Numerofila, 14).setValue(Entidadpago || 'Transferencia');
      Hojareservas.getRange(Numerofila, 15).setValue('Confirmada');

      Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, 'Ocupada');

      const Resumenadmin =
        `Nueva reserva confirmada en Hotel Nissi\n` +
        `Código: ${Codigoreserva}\n` +
        `Habitación: ${Numerohab} (marcada como Ocupada)\n` +
        `Huésped: ${Nombrehuesped} (+${Celularhuesped})\n` +
        `Estadía: ${Fechallegada} al ${Fechasalida}\n` +
        `Llegada estimada: ${Horallegada}\n` +
        `Pago validado: $${Montorecibido.toLocaleString('es-CO')} COP (${Entidadpago || 'Transferencia'} · Ref: ${Referenciapago})`;

      if (typeof Notificaradministradorwhatsapp === 'function') {
        Notificaradministradorwhatsapp(Resumenadmin);
      }

      return {
        exito: true,
        codigo: Codigoreserva,
        habitacion: Numerohab,
        estado: 'Confirmada',
        mensaje: 'Pago validado, habitación marcada como Ocupada y administrador notificado por WhatsApp.'
      };
    }
  }

  return {
    exito: false,
    mensaje: `No se encontró ninguna solicitud con el código ${Codigoreserva}.`
  };
}

// Reloj automatico cada hora: libera habitaciones cuyo tiempo de reserva ya termino
function Liberarhabitacionesvencidas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  if (!Hojareservas || !Hojahabitaciones) {
    return;
  }

  const Ahora = new Date();
  const Hoytexto = Utilities.formatDate(Ahora, 'America/Bogota', 'yyyy-MM-dd');
  const Horaactual = parseInt(Utilities.formatDate(Ahora, 'America/Bogota', 'HH'), 10);

  const Filas = Hojareservas.getDataRange().getValues();
  const Habitacionesactivas = {};

  for (let Indice = 1; Indice < Filas.length; Indice++) {
    const Estado = String(Filas[Indice][14]);
    const Numerohab = String(Filas[Indice][4]).padStart(2, '0');
    const Fechallegada = Utilities.formatDate(new Date(Filas[Indice][5]), 'America/Bogota', 'yyyy-MM-dd');
    const Fechasalida = Utilities.formatDate(new Date(Filas[Indice][6]), 'America/Bogota', 'yyyy-MM-dd');

    if (Estado === 'Confirmada') {
      const Venciofecha = Fechasalida < Hoytexto || (Fechasalida === Hoytexto && Horaactual >= Parametrosistema.horacheckout);
      if (Venciofecha) {
        Hojareservas.getRange(Indice + 1, 15).setValue('Finalizada');
      } else if (Fechallegada <= Hoytexto && Fechasalida >= Hoytexto) {
        Habitacionesactivas[Numerohab] = true;
      }
    }
  }

  const Filashab = Hojahabitaciones.getDataRange().getValues();
  for (let Indice = 1; Indice < Filashab.length; Indice++) {
    const Numerohab = String(Filashab[Indice][0]).padStart(2, '0');
    const Nuevoestado = Habitacionesactivas[Numerohab] ? 'Ocupada' : 'Disponible';
    if (String(Filashab[Indice][5]) !== Nuevoestado) {
      Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, Nuevoestado);
    }
  }
}
