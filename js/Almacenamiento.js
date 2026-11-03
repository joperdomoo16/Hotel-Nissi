// Lectura y guardado de datos en el almacenamiento del navegador y sincronizacion con Google Sheets
const Clavealmacenamientoreserva = 'nissisolicitud';
const Clavealmacenamientousuario = 'nissiusuario';

function Guardardatossesion(Nombreusuario) {
  try {
    localStorage.setItem(Clavealmacenamientousuario, Nombreusuario);
  } catch (Erroralmacenamiento) {
    // Si el modo privado bloquea el almacenamiento continuamos normalmente
  }
}

function Obtenerdatossesion() {
  try {
    return localStorage.getItem(Clavealmacenamientousuario) || '';
  } catch (Erroralmacenamiento) {
    return '';
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
