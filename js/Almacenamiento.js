// Persistencia mínima de sesión del huésped y comunicación segura con el servidor

const Clavealmacenamientousuario = 'nissiusuario';

function Depuraralmacenamientolegado() {
  try {
    localStorage.removeItem('nissisolicitud');
    localStorage.removeItem('nissihistorialreservas');
    sessionStorage.removeItem('nissi_admin_auth');
  } catch (Errorlimpieza) {}
}

Depuraralmacenamientolegado();

function Guardardatossesion(Nombreusuario) {
  try {
    const Nombrelimpio = typeof Sanitizartexto === 'function'
      ? Sanitizartexto(Nombreusuario, 80)
      : String(Nombreusuario || '').replace(/[<>]/g, '').slice(0, 80);
    localStorage.setItem(Clavealmacenamientousuario, Nombrelimpio);
  } catch (Erroralmacenamiento) {}
}

function Obtenerdatossesion() {
  try {
    const Guardado = localStorage.getItem(Clavealmacenamientousuario) || '';
    return typeof Sanitizartexto === 'function'
      ? Sanitizartexto(Guardado, 80)
      : Guardado.replace(/[<>]/g, '').slice(0, 80);
  } catch (Erroralmacenamiento) {
    return '';
  }
}

function Limpiardatossesion() {
  try {
    localStorage.removeItem(Clavealmacenamientousuario);
  } catch (Erroralmacenamiento) {}
}

function Enviarpeticionservidor(Cuerpo) {
  if (!Configuracionhotel.urlservidor) {
    return Promise.resolve(null);
  }
  return fetch(Configuracionhotel.urlservidor, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Cuerpo)
  })
    .then(function(Respuesta) {
      return Respuesta.json();
    })
    .catch(function() {
      return null;
    });
}

function Autenticaradminservidor(Pin) {
  return Enviarpeticionservidor({
    accion: 'autenticaradmin',
    pin: String(Pin || '').replace(/\D/g, '').slice(0, 8)
  });
}

function Cerrarsesionadminservidor(Tokenadmin) {
  if (!Tokenadmin) {
    return Promise.resolve(null);
  }
  return Enviarpeticionservidor({
    accion: 'cerrarsesionadmin',
    tokenadmin: Tokenadmin
  });
}

function Obtenerreservasservidor(Tokenadmin) {
  if (!Tokenadmin) {
    return Promise.resolve({ exito: false, noautorizado: true });
  }
  return Enviarpeticionservidor({
    accion: 'obtenerreservas',
    tokenadmin: Tokenadmin
  });
}

function Enviarsolicitudservidor(Datosreserva, Tokenadmin) {
  const Carga = {
    accion: 'registrarreserva',
    datos: Datosreserva
  };
  if (Tokenadmin) {
    Carga.tokenadmin = Tokenadmin;
  }
  return Enviarpeticionservidor(Carga);
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

function Cambiarlimpiezahabitacionservidor(Numerohabitacion, Habilitar, Tokenadmin) {
  if (!Tokenadmin) {
    return Promise.resolve({ exito: false, noautorizado: true });
  }
  return Enviarpeticionservidor({
    accion: Habilitar ? 'habilitarhabitacion' : 'marcarlimpieza',
    habitacion: Numerohabitacion,
    tokenadmin: Tokenadmin
  });
}
