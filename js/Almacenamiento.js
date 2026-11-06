// Lectura y guardado de datos en el almacenamiento del navegador y sincronizacion con Google Sheets
const Clavealmacenamientoreserva = 'nissisolicitud';
const Clavealmacenamientousuario = 'nissiusuario';
const Clavealmacenamientohistorial = 'nissihistorialreservas';

function Generarsemillahistorial() {
  const Ahora = new Date();
  const Formatearfecha = function(Diasdesplazamiento) {
    const D = new Date(Ahora.getTime() + Diasdesplazamiento * 86400000);
    return D.toISOString().split('T')[0];
  };

  return [
    {
      codigo: 'NS-W101',
      fecharegistro: `${Formatearfecha(0)} 08:30`,
      nombre: 'Carlos Restrepo',
      cedula: '1098765432',
      celular: '3001234567',
      habitacion: '01',
      llegada: Formatearfecha(0),
      salida: Formatearfecha(1),
      noches: 1,
      huespedes: 2,
      horallegada: 'Check-in presencial',
      montopagado: 90000,
      entidadpago: 'Efectivo',
      referenciapago: 'Presencial - Efectivo',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W102',
      fecharegistro: `${Formatearfecha(0)} 10:15`,
      nombre: 'Andrea Gómez',
      cedula: '1045238910',
      celular: '3109876543',
      habitacion: '03',
      llegada: Formatearfecha(0),
      salida: Formatearfecha(2),
      noches: 2,
      huespedes: 2,
      horallegada: 'Check-in presencial',
      montopagado: 240000,
      entidadpago: 'Nequi',
      referenciapago: 'Presencial - Nequi',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W103',
      fecharegistro: `${Formatearfecha(0)} 14:00`,
      nombre: 'Luis Fernando Díaz',
      cedula: '88123456',
      celular: '3154567890',
      habitacion: '05',
      llegada: Formatearfecha(0),
      salida: Formatearfecha(1),
      noches: 1,
      huespedes: 3,
      horallegada: 'Check-in presencial',
      montopagado: 150000,
      entidadpago: 'Daviplata',
      referenciapago: 'Presencial - Daviplata',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W098',
      fecharegistro: `${Formatearfecha(-2)} 09:20`,
      nombre: 'Mariana Torres',
      cedula: '1128098765',
      celular: '3123456789',
      habitacion: '02',
      llegada: Formatearfecha(-2),
      salida: Formatearfecha(0),
      noches: 2,
      huespedes: 1,
      horallegada: 'Check-in presencial',
      montopagado: 180000,
      entidadpago: 'Transferencia',
      referenciapago: 'Presencial - Transferencia',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W099',
      fecharegistro: `${Formatearfecha(-1)} 11:45`,
      nombre: 'Jorge Eliecer Gaitán',
      cedula: '72345678',
      celular: '3187654321',
      habitacion: '06',
      llegada: Formatearfecha(-1),
      salida: Formatearfecha(1),
      noches: 2,
      huespedes: 4,
      horallegada: 'Check-in presencial',
      montopagado: 360000,
      entidadpago: 'Efectivo',
      referenciapago: 'Presencial - Efectivo',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W095',
      fecharegistro: `${Formatearfecha(-4)} 15:30`,
      nombre: 'Claudia Patricia Méndez',
      cedula: '1098456123',
      celular: '3012349876',
      habitacion: '04',
      llegada: Formatearfecha(-4),
      salida: Formatearfecha(-2),
      noches: 2,
      huespedes: 2,
      horallegada: 'Check-in presencial',
      montopagado: 240000,
      entidadpago: 'Nequi',
      referenciapago: 'Presencial - Nequi',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W089',
      fecharegistro: `${Formatearfecha(-15)} 10:00`,
      nombre: 'Felipe Sandoval',
      cedula: '1082345678',
      celular: '3145678901',
      habitacion: '01',
      llegada: Formatearfecha(-15),
      salida: Formatearfecha(-13),
      noches: 2,
      huespedes: 2,
      horallegada: 'Web',
      montopagado: 180000,
      entidadpago: 'Transferencia',
      referenciapago: 'Bancolombia - Web',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W085',
      fecharegistro: `${Formatearfecha(-20)} 16:40`,
      nombre: 'Diana Marcela Castro',
      cedula: '1067891234',
      celular: '3023456789',
      habitacion: '03',
      llegada: Formatearfecha(-20),
      salida: Formatearfecha(-18),
      noches: 2,
      huespedes: 2,
      horallegada: 'Check-in presencial',
      montopagado: 240000,
      entidadpago: 'Efectivo',
      referenciapago: 'Presencial - Efectivo',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W080',
      fecharegistro: `${Formatearfecha(-35)} 12:10`,
      nombre: 'Rodrigo Barreto',
      cedula: '12345678',
      celular: '3009876543',
      habitacion: '05',
      llegada: Formatearfecha(-35),
      salida: Formatearfecha(-33),
      noches: 2,
      huespedes: 3,
      horallegada: 'Check-in presencial',
      montopagado: 300000,
      entidadpago: 'Daviplata',
      referenciapago: 'Presencial - Daviplata',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W075',
      fecharegistro: `${Formatearfecha(-42)} 18:00`,
      nombre: 'Sofia Vergara Orozco',
      cedula: '1047654321',
      celular: '3167890123',
      habitacion: '06',
      llegada: Formatearfecha(-42),
      salida: Formatearfecha(-40),
      noches: 2,
      huespedes: 4,
      horallegada: 'Check-in presencial',
      montopagado: 360000,
      entidadpago: 'Nequi',
      referenciapago: 'Presencial - Nequi',
      estado: 'Confirmada'
    },
    {
      codigo: 'NS-W070',
      fecharegistro: `${Formatearfecha(-65)} 11:00`,
      nombre: 'Manuel Guillermo Polo',
      cedula: '85234567',
      celular: '3178901234',
      habitacion: '02',
      llegada: Formatearfecha(-65),
      salida: Formatearfecha(-63),
      noches: 2,
      huespedes: 2,
      horallegada: 'Check-in presencial',
      montopagado: 180000,
      entidadpago: 'Efectivo',
      referenciapago: 'Presencial - Efectivo',
      estado: 'Confirmada'
    }
  ];
}

function Obtenerhistorialreservas() {
  try {
    const Historialguardado = localStorage.getItem(Clavealmacenamientohistorial);
    if (Historialguardado) {
      return JSON.parse(Historialguardado);
    }
  } catch (Errorlectura) {}
  const Semilla = Generarsemillahistorial();
  try {
    localStorage.setItem(Clavealmacenamientohistorial, JSON.stringify(Semilla));
  } catch (Error) {}
  return Semilla;
}

function Guardarhistorialreserva(Nuevajreserva) {
  try {
    const Historial = Obtenerhistorialreservas();
    Historial.unshift(Nuevajreserva);
    localStorage.setItem(Clavealmacenamientohistorial, JSON.stringify(Historial));
  } catch (Error) {}
}

function Guardardatossesion(Nombreusuario) {
  try {
    const Nombrelimpio = typeof Sanitizartexto === 'function' ? Sanitizartexto(Nombreusuario, 80) : String(Nombreusuario || '').replace(/[<>]/g, '').slice(0, 80);
    localStorage.setItem(Clavealmacenamientousuario, Nombrelimpio);
  } catch (Erroralmacenamiento) {
    // Si el modo privado bloquea el almacenamiento continuamos normalmente
  }
}

function Obtenerdatossesion() {
  try {
    const Guardado = localStorage.getItem(Clavealmacenamientousuario) || '';
    return typeof Sanitizartexto === 'function' ? Sanitizartexto(Guardado, 80) : Guardado.replace(/[<>]/g, '').slice(0, 80);
  } catch (Erroralmacenamiento) {
    return '';
  }
}

function Limpiardatossesion() {
  try {
    localStorage.removeItem(Clavealmacenamientousuario);
  } catch (Erroralmacenamiento) {
    // Control de almacenamiento
  }
}

function Guardarborradorreserva(Datosreserva) {
  try {
    localStorage.setItem(Clavealmacenamientoreserva, JSON.stringify(Datosreserva));
  } catch (Erroralmacenamiento) {
    // Control de almacenamiento
  }
}

function Obtenerborradorreserva() {
  try {
    const Datoscacheados = localStorage.getItem(Clavealmacenamientoreserva);
    return Datoscacheados ? JSON.parse(Datoscacheados) : null;
  } catch (Erroralmacenamiento) {
    return null;
  }
}

function Limpiarborradorreserva() {
  try {
    localStorage.removeItem(Clavealmacenamientoreserva);
  } catch (Erroralmacenamiento) {
    // Control de almacenamiento
  }
}

function Enviarsolicitudservidor(Datosreserva) {
  if (!Configuracionhotel.urlservidor) {
    return Promise.resolve(null);
  }
  return fetch(Configuracionhotel.urlservidor, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      accion: 'registrarreserva',
      datos: Datosreserva
    })
  })
    .then(function(Respuesta) {
      return Respuesta.json();
    })
    .catch(function() {
      return null;
    });
}

function Consultardisponibilidadservidor(Fechallegada, Fechasalida, Cantidadhuespedes) {
  if (!Configuracionhotel.urlservidor) {
    return Promise.resolve(null);
  }
  const Parametros = `?llegada=${encodeURIComponent(Fechallegada || '')}&salida=${encodeURIComponent(Fechasalida || '')}&huespedes=${encodeURIComponent(Cantidadhuespedes || 2)}`;
  return fetch(`${Configuracionhotel.urlservidor}${Parametros}`)
    .then(function(Respuesta) {
      return Respuesta.json();
    })
    .catch(function() {
      return null;
    });
}
