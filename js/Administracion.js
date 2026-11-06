// Modulo de gestion y seguridad de acceso para administracion y recepcion

// Resumen criptografico unidireccional SHA-256 de la clave de recepcion (cero secretos en texto plano)
const Hashpincorporado = '9baed8fceea6e36d36670d72429d909547165efc038c293a14a41ef2edf83141';

const Estadorecepcion = {
  autenticado: false,
  pinactual: '',
  intentosfallidos: 0,
  bloqueadohasta: 0,
  habitaciones: [],
  habitacionseleccionada: null,
  cargando: false
};

// Calcula el resumen SHA-256 mediante Web Cryptography API
async function Calcularhashsha256(Texto) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const Buffertexto = new TextEncoder().encode(Texto);
      const Bufferhash = await window.crypto.subtle.digest('SHA-256', Buffertexto);
      return Array.from(new Uint8Array(Bufferhash))
        .map(function(B) {
          return B.toString(16).padStart(2, '0');
        })
        .join('');
    } catch (Errorcrypto) {}
  }
  return '';
}

// Control de teclado de seguridad con PIN
function Actualizarmarcadorpin() {
  const Puntos = document.querySelectorAll('.pin-dot');
  Puntos.forEach(function(Punto, Indice) {
    Punto.classList.toggle('is-filled', Indice < Estadorecepcion.pinactual.length);
  });
}

function Ingresardigitopin(Digito) {
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
      setTimeout(Verificarpin, 200);
    }
  }
}

function Borrardigitopin() {
  if (Estadorecepcion.pinactual.length > 0) {
    Estadorecepcion.pinactual = Estadorecepcion.pinactual.slice(0, -1);
    Actualizarmarcadorpin();
  }
}

async function Verificarpin() {
  const Mensajerror = document.getElementById('lockError');
  const Hashactual = await Calcularhashsha256(Estadorecepcion.pinactual);

  if (Hashactual === Hashpincorporado) {
    Estadorecepcion.autenticado = true;
    Estadorecepcion.intentosfallidos = 0;
    Estadorecepcion.bloqueadohasta = 0;
    const Bloqueo = document.getElementById('lockScreen');
    if (Bloqueo) {
      Bloqueo.hidden = true;
    }
    if (Mensajerror) {
      Mensajerror.textContent = '';
    }
    if (typeof Cargarhabitaciones === 'function') {
      Cargarhabitaciones();
    }
  } else {
    Estadorecepcion.intentosfallidos++;
    if (Estadorecepcion.intentosfallidos >= 5) {
      Estadorecepcion.bloqueadohasta = Date.now() + 30000;
      Estadorecepcion.intentosfallidos = 0;
      if (Mensajerror) {
        Mensajerror.textContent = 'Demasiados intentos. Bloqueado por 30 segundos.';
      }
    } else if (Mensajerror) {
      Mensajerror.textContent = 'PIN incorrecto. Intenta de nuevo.';
    }
    Estadorecepcion.pinactual = '';
    Actualizarmarcadorpin();
  }
}

function Cerrarsesionadmin() {
  Estadorecepcion.autenticado = false;
  Estadorecepcion.pinactual = '';
  sessionStorage.removeItem('nissi_admin_auth');
  const Bloqueo = document.getElementById('lockScreen');
  if (Bloqueo) {
    Bloqueo.hidden = false;
    Actualizarmarcadorpin();
  }
}

// Inicializacion al cargar el DOM: siempre pedir PIN al abrir o recargar
document.addEventListener('DOMContentLoaded', function() {
  Estadorecepcion.autenticado = false;
  Estadorecepcion.pinactual = '';
  sessionStorage.removeItem('nissi_admin_auth');
  const Bloqueo = document.getElementById('lockScreen');
  if (Bloqueo) {
    Bloqueo.hidden = false;
  }
  Actualizarmarcadorpin();

  // Teclado virtual de PIN
  document.querySelectorAll('[data-digit]').forEach(function(Boton) {
    Boton.addEventListener('click', function() {
      Ingresardigitopin(Boton.dataset.digit);
    });
  });

  const Botonborrar = document.getElementById('pinDelete');
  if (Botonborrar) {
    Botonborrar.addEventListener('click', Borrardigitopin);
  }

  // Refrescar datos en vivo
  const Botonrefrescar = document.getElementById('btnRefrescarRack');
  if (Botonrefrescar) {
    Botonrefrescar.addEventListener('click', function() {
      if (typeof Cargarhabitaciones === 'function') {
        Cargarhabitaciones();
      }
      if (typeof Cargardashboard === 'function' && document.getElementById('seccionDashboard') && !document.getElementById('seccionDashboard').hidden) {
        Cargardashboard();
      }
    });
  }

  // Cierre de sesion administrativo
  const Botonsalir = document.getElementById('btnSalirAdmin');
  if (Botonsalir) {
    Botonsalir.addEventListener('click', Cerrarsesionadmin);
  }

  // Captura de teclado fisico para el PIN
  document.addEventListener('keydown', function(Evento) {
    if (!Estadorecepcion.autenticado) {
      if (Evento.key >= '0' && Evento.key <= '9') {
        Ingresardigitopin(Evento.key);
      } else if (Evento.key === 'Backspace') {
        Borrardigitopin();
      }
    }
  });

  // Auto-refresco de habitaciones cada 60 segundos si esta autenticado
  setInterval(function() {
    if (Estadorecepcion.autenticado && typeof Cargarhabitaciones === 'function') {
      Cargarhabitaciones();
    }
  }, 60000);
});
