// Lectura y guardado de datos en el almacenamiento del navegador y sincronizacion con Google Sheets
const Clavealmacenamientoreserva = 'nissisolicitud';
const Clavealmacenamientousuario = 'nissiusuario';
const Clavealmacenamientohistorial = 'nissihistorialreservas';

const Codigossemilla = ['NS-W101', 'NS-W102', 'NS-W103', 'NS-W098', 'NS-W099', 'NS-W095', 'NS-W089', 'NS-W085', 'NS-W080', 'NS-W075', 'NS-W070'];

function Obtenerhistorialreservas() {
  try {
    const Historialguardado = localStorage.getItem(Clavealmacenamientohistorial);
    if (Historialguardado) {
      const Lista = JSON.parse(Historialguardado);
      if (Array.isArray(Lista)) {
        const Limpia = Lista.filter(function(R) { return Codigossemilla.indexOf(String(R.codigo || '')) === -1; });
        if (Limpia.length !== Lista.length) {
          localStorage.setItem(Clavealmacenamientohistorial, JSON.stringify(Limpia));
        }
        return Limpia;
      }
    }
  } catch (Errorlectura) {}
  return [];
}

function Guardarhistorialreserva(Nuevajreserva) {
  try {
    const Historial = Obtenerhistorialreservas();
    Historial.unshift(Nuevajreserva);
    localStorage.setItem(Clavealmacenamientohistorial, JSON.stringify(Historial));
  } catch (Error) {}
}

function Obtenerreservasservidor() {
  if (!Configuracionhotel.urlservidor) {
    return Promise.resolve(null);
  }
  return fetch(`${Configuracionhotel.urlservidor}?tipo=reservas`)
    .then(function(Respuesta) {
      return Respuesta.json();
    })
    .catch(function() {
      return null;
    });
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

function Cambiarlimpiezahabitacionservidor(Numerohabitacion, Habilitar) {
  if (!Configuracionhotel.urlservidor) {
    return Promise.resolve(null);
  }
  return fetch(Configuracionhotel.urlservidor, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      accion: Habilitar ? 'habilitarhabitacion' : 'marcarlimpieza',
      habitacion: Numerohabitacion
    })
  })
    .then(function(Respuesta) {
      return Respuesta.json();
    })
    .catch(function() {
      return null;
    });
}
