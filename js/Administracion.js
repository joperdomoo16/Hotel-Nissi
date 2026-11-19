// Acceso de recepción mediante validación de PIN en servidor y sesión en memoria

const Estadorecepcion = {
  autenticado: false,
  tokensession: '',
  pinactual: '',
  verificando: false,
  bloqueadohasta: 0,
  habitaciones: [],
  habitacionseleccionada: null
};

function Actualizarmarcadorpin() {
  const Puntos = document.querySelectorAll('.pin-dot');
  Puntos.forEach(function(Punto, Indice) {
    Punto.classList.toggle('is-filled', Indice < Estadorecepcion.pinactual.length);
  });
}

function Ingresardigitopin(Digito) {
  if (Estadorecepcion.verificando) {
    return;
  }
  const Ahora = Date.now();
  const Mensajerror = document.getElementById('lockError');
  if (Estadorecepcion.bloqueadohasta > Ahora) {
    const Segundosrestantes = Math.ceil((Estadorecepcion.bloqueadohasta - Ahora) / 1000);
    if (Mensajerror) {
      Mensajerror.textContent = `Demasiados intentos. Espera ${Segundosrestantes} s.`;
    }
    return;
  }

  if (Estadorecepcion.pinactual.length < 4) {
    Estadorecepcion.pinactual += String(Digito).replace(/\D/g, '').slice(0, 1);
    Actualizarmarcadorpin();

    if (Estadorecepcion.pinactual.length === 4) {
      setTimeout(Verificarpin, 150);
    }
  }
}

function Borrardigitopin() {
  if (Estadorecepcion.verificando) {
    return;
  }
  if (Estadorecepcion.pinactual.length > 0) {
    Estadorecepcion.pinactual = Estadorecepcion.pinactual.slice(0, -1);
    Actualizarmarcadorpin();
  }
}

function Verificarpin() {
  if (Estadorecepcion.verificando) {
    return;
  }
  const Mensajerror = document.getElementById('lockError');
  const Piningresado = Estadorecepcion.pinactual;
  Estadorecepcion.verificando = true;

  if (Mensajerror) {
    Mensajerror.textContent = 'Verificando acceso...';
  }

  Autenticaradminservidor(Piningresado)
    .then(function(Respuesta) {
      if (Respuesta && Respuesta.exito && Respuesta.token) {
        Estadorecepcion.autenticado = true;
        Estadorecepcion.tokensession = Respuesta.token;
        Estadorecepcion.pinactual = '';
        Estadorecepcion.bloqueadohasta = 0;

        const Bloqueo = document.getElementById('lockScreen');
        if (Bloqueo) {
          Bloqueo.hidden = true;
        }
        if (Mensajerror) {
          Mensajerror.textContent = '';
        }
        Actualizarmarcadorpin();

        if (typeof Cargarhabitaciones === 'function') {
          Cargarhabitaciones();
        }
        return;
      }

      if (Respuesta && Respuesta.bloqueadosegundos) {
        Estadorecepcion.bloqueadohasta = Date.now() + Number(Respuesta.bloqueadosegundos) * 1000;
      }
      if (Mensajerror) {
        Mensajerror.textContent = (Respuesta && Respuesta.mensaje)
          ? Respuesta.mensaje
          : 'No pudimos verificar el PIN. Revisa tu conexión e intenta de nuevo.';
      }
      Estadorecepcion.pinactual = '';
      Actualizarmarcadorpin();
    })
    .catch(function() {
      if (Mensajerror) {
        Mensajerror.textContent = 'Error de conexión al validar el PIN.';
      }
      Estadorecepcion.pinactual = '';
      Actualizarmarcadorpin();
    })
    .finally(function() {
      Estadorecepcion.verificando = false;
    });
}

function Manejarsesionexpirada() {
  Estadorecepcion.autenticado = false;
  Estadorecepcion.tokensession = '';
  Estadorecepcion.pinactual = '';
  Limpiarvistaprivadaadmin();

  const Bloqueo = document.getElementById('lockScreen');
  const Mensajerror = document.getElementById('lockError');
  if (Bloqueo) {
    Bloqueo.hidden = false;
    Actualizarmarcadorpin();
  }
  if (Mensajerror) {
    Mensajerror.textContent = 'Tu sesión venció por seguridad. Digita el PIN nuevamente.';
  }
}

function Limpiarvistaprivadaadmin() {
  if (typeof Estadodashboard !== 'undefined') {
    Estadodashboard.reservasreales = null;
    Estadodashboard.reservasperiodo = [];
  }
  const Tablabody = document.getElementById('dashTableBody');
  if (Tablabody) {
    Tablabody.textContent = '';
  }
}

function Cerrarsesionadmin() {
  const Tokenactual = Estadorecepcion.tokensession;
  Estadorecepcion.autenticado = false;
  Estadorecepcion.tokensession = '';
  Estadorecepcion.pinactual = '';
  Limpiarvistaprivadaadmin();

  if (Tokenactual && typeof Cerrarsesionadminservidor === 'function') {
    Cerrarsesionadminservidor(Tokenactual);
  }

  const Bloqueo = document.getElementById('lockScreen');
  const Mensajerror = document.getElementById('lockError');
  if (Bloqueo) {
    Bloqueo.hidden = false;
    Actualizarmarcadorpin();
  }
  if (Mensajerror) {
    Mensajerror.textContent = '';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  Estadorecepcion.autenticado = false;
  Estadorecepcion.tokensession = '';
  Estadorecepcion.pinactual = '';
  const Bloqueo = document.getElementById('lockScreen');
  if (Bloqueo) {
    Bloqueo.hidden = false;
  }
  Actualizarmarcadorpin();

  document.querySelectorAll('[data-digit]').forEach(function(Boton) {
    Boton.addEventListener('click', function() {
      Ingresardigitopin(Boton.dataset.digit);
    });
  });

  const Botonborrar = document.getElementById('pinDelete');
  if (Botonborrar) {
    Botonborrar.addEventListener('click', Borrardigitopin);
  }

  const Botonrefrescar = document.getElementById('btnRefrescarRack');
  if (Botonrefrescar) {
    Botonrefrescar.addEventListener('click', function() {
      if (!Estadorecepcion.autenticado) {
        return;
      }
      if (typeof Cargarhabitaciones === 'function') {
        Cargarhabitaciones();
      }
      if (typeof Cargardashboard === 'function' && document.getElementById('seccionDashboard') && !document.getElementById('seccionDashboard').hidden) {
        Cargardashboard();
      }
    });
  }

  const Botonsalir = document.getElementById('btnSalirAdmin');
  if (Botonsalir) {
    Botonsalir.addEventListener('click', Cerrarsesionadmin);
  }

  document.addEventListener('keydown', function(Evento) {
    if (!Estadorecepcion.autenticado) {
      if (Evento.key >= '0' && Evento.key <= '9') {
        Ingresardigitopin(Evento.key);
      } else if (Evento.key === 'Backspace') {
        Borrardigitopin();
      }
    }
  });

  setInterval(function() {
    if (Estadorecepcion.autenticado && typeof Cargarhabitaciones === 'function') {
      Cargarhabitaciones();
    }
  }, 15000);
});
