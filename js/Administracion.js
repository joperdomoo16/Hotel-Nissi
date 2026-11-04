// Modulo de gestion y atencion presencial para administracion y recepcion

const Estadorecepcion = {
  autenticado: false,
  pincorrecto: '1973',
  pinactual: '',
  intentosfallidos: 0,
  bloqueadohasta: 0,
  habitaciones: [],
  habitacionseleccionada: null,
  cargando: false
};

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

function Verificarpin() {
  const Mensajerror = document.getElementById('lockError');
  if (Estadorecepcion.pinactual === Estadorecepcion.pincorrecto) {
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
    Cargarhabitaciones();
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

// Consulta de habitaciones y estado en Google Sheets
function Cargarhabitaciones() {
  const Indicadorreloj = document.getElementById('adminClock');
  const Ahora = new Date();
  if (Indicadorreloj) {
    Indicadorreloj.textContent = Ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  const Cadenahoy = Ahora.toISOString().split('T')[0];
  const Manana = new Date(Ahora.getTime() + 86400000).toISOString().split('T')[0];

  Consultardisponibilidadservidor(Cadenahoy, Manana, 2)
    .then(function(Respuesta) {
      if (Respuesta && Array.isArray(Respuesta.todas)) {
        Estadorecepcion.habitaciones = Respuesta.todas;
      } else {
        // Catalogo base local de respaldo
        Estadorecepcion.habitaciones = Habitacioneshotel.map(function(Hab) {
          return {
            numero: Hab.numero,
            tipo: Hab.tipo,
            capacidad: Hab.capacidad,
            huespedesmaximos: Hab.huespedesmaximos,
            tarifanoche: Hab.precio,
            disponible: true,
            estadoactual: 'Disponible'
          };
        });
      }
      Dibujartablerohabitaciones();
    })
    .catch(function() {
      Dibujartablerohabitaciones();
    });
}

function Dibujartablerohabitaciones() {
  const Contenedor = document.getElementById('rackGrid');
  if (!Contenedor) {
    return;
  }

  let Contadorlibres = 0;
  let Contadorocupadas = 0;
  Contenedor.innerHTML = '';

  Estadorecepcion.habitaciones.forEach(function(Hab) {
    const Eslibre = Hab.disponible !== false && Hab.estadoactual !== 'Ocupada';
    if (Eslibre) {
      Contadorlibres++;
    } else {
      Contadorocupadas++;
    }

    const Numeroseguro = Escaparhtml(Hab.numero);
    const Tiposeguro = Escaparhtml(Hab.tipo);
    const Capacidadsegura = Escaparhtml(Hab.capacidad);

    const Tarjeta = document.createElement('div');
    Tarjeta.className = `room-card ${Eslibre ? 'is-available' : 'is-occupied'}`;
    Tarjeta.innerHTML = `
      <div class="room-card-head">
        <span class="room-card-num">${Numeroseguro}</span>
        <span class="room-card-status">${Eslibre ? '● Disponible' : '■ Ocupada'}</span>
      </div>
      <h4 class="room-card-type">${Tiposeguro}</h4>
      <div class="room-card-info">
        <span>${Capacidadsegura}</span>
        <span class="room-card-price">$${Number(Hab.tarifanoche || 0).toLocaleString('es-CO')} COP</span>
      </div>
      <div class="room-card-action">
        ${
          Eslibre
            ? `<button class="btn btn--cream btn--sm" type="button" data-checkin="${Numeroseguro}">Check-in presencial</button>`
            : `<button class="btn btn--ghost btn--sm" type="button" disabled>Ocupada actualmente</button>`
        }
      </div>
    `;
    Contenedor.appendChild(Tarjeta);
  });

  const Resumenlibres = document.getElementById('countAvailable');
  const Resumenocupadas = document.getElementById('countOccupied');
  if (Resumenlibres) {
    Resumenlibres.textContent = Contadorlibres;
  }
  if (Resumenocupadas) {
    Resumenocupadas.textContent = Contadorocupadas;
  }
}

// Ventana modal de Check-in presencial
function Abrircheckin(Numerohabitacion) {
  const Hab = Estadorecepcion.habitaciones.find(function(H) {
    return H.numero === Numerohabitacion;
  });
  if (!Hab) {
    return;
  }

  Estadorecepcion.habitacionseleccionada = Hab;
  const Modal = document.getElementById('checkinModal');
  const Titulohab = document.getElementById('checkinRoomTitle');
  const Camposalida = document.getElementById('checkinSalida');
  const Campollegada = document.getElementById('checkinLlegada');

  const Hoy = new Date().toISOString().split('T')[0];
  const Manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  if (Titulohab) {
    Titulohab.textContent = `Habitación ${Hab.numero} (${Hab.tipo})`;
  }
  if (Campollegada) {
    Campollegada.value = Hoy;
  }
  if (Camposalida) {
    Camposalida.min = Manana;
    Camposalida.value = Manana;
  }

  Actualizartotalcheckin();

  if (Modal) {
    Modal.hidden = false;
  }
}

function Cerrarcheckin() {
  const Modal = document.getElementById('checkinModal');
  if (Modal) {
    Modal.hidden = true;
  }
  const Errorbox = document.getElementById('checkinError');
  if (Errorbox) {
    Errorbox.textContent = '';
  }
}

function Actualizartotalcheckin() {
  const Hab = Estadorecepcion.habitacionseleccionada;
  if (!Hab) {
    return;
  }
  const Campollegada = document.getElementById('checkinLlegada');
  const Camposalida = document.getElementById('checkinSalida');
  const Totaltexto = document.getElementById('checkinTotal');
  const Montopagado = document.getElementById('checkinPago');

  const Llegada = Campollegada ? Campollegada.value : '';
  const Salida = Camposalida ? Camposalida.value : '';

  const Noches = Calcularnochesestadia(Llegada, Salida);
  const Valortotal = Math.max(1, Noches) * Number(Hab.tarifanoche || 0);

  if (Totaltexto) {
    Totaltexto.textContent = `$${Valortotal.toLocaleString('es-CO')} COP (${Math.max(1, Noches)} noche${Noches > 1 ? 's' : ''})`;
  }
  if (Montopagado && !Montopagado.dataset.manual) {
    Montopagado.value = Valortotal;
  }
}

function Guardarcheckinpresencial(Evento) {
  Evento.preventDefault();
  const Hab = Estadorecepcion.habitacionseleccionada;
  if (!Hab) {
    return;
  }

  const Errorbox = document.getElementById('checkinError');
  const Nombre = Sanitizartexto(document.getElementById('checkinNombre').value, 80);
  const Celular = Sanitizartexto(document.getElementById('checkinCelular').value, 20);
  const Llegada = document.getElementById('checkinLlegada').value;
  const Salida = document.getElementById('checkinSalida').value;
  const Huespedes = Math.max(1, Math.min(4, parseInt(document.getElementById('checkinHuespedes').value, 10) || 2));
  const Mediopago = Sanitizartexto(document.getElementById('checkinMedio').value, 30);
  const Montopago = Math.max(0, parseInt(document.getElementById('checkinPago').value, 10) || 0);

  if (!Nombre) {
    if (Errorbox) {
      Errorbox.textContent = 'Escribe el nombre del huésped.';
    }
    return;
  }
  if (!Validarnumerocelular(Celular)) {
    if (Errorbox) {
      Errorbox.textContent = 'Escribe un celular válido de contacto.';
    }
    return;
  }

  const Codigo = `NS-W${Math.floor(100 + Math.random() * 900)}`;
  const Botonguardar = document.getElementById('btnGuardarCheckin');
  if (Botonguardar) {
    Botonguardar.disabled = true;
    Botonguardar.textContent = 'Registrando...';
  }

  const Solicitud = {
    codigo: Codigo,
    nombre: Nombre,
    celular: Celular,
    habitacion: Hab.numero,
    llegada: Llegada,
    salida: Salida,
    huespedes: Huespedes,
    horallegada: 'Check-in presencial',
    montopagado: Montopago,
    referenciapago: `Presencial - ${Mediopago}`,
    entidadpago: Mediopago,
    estado: 'Confirmada'
  };

  Enviarsolicitudservidor(Solicitud)
    .then(function() {
      Cerrarcheckin();
      Cargarhabitaciones();

      // Abrir confirmacion opcional por WhatsApp con clave WiFi
      const Enviarwa = confirm(`¡Ingreso registrado con éxito! Código: ${Codigo}.\n\n¿Deseas enviar el recibo y la bienvenida por WhatsApp al huésped?`);
      if (Enviarwa) {
        const Mensajebienvenida = `¡Bienvenido al Hotel Nissi, ${Nombre}! Tu ingreso a la habitación ${Hab.numero} (${Hab.tipo}) ha sido confirmado. Código: ${Codigo}. Red Wi-Fi: HotelNissi_Huespedes. ¡Que tengas un excelente descanso en Mingueo!`;
        window.open(`https://wa.me/57${Celular.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(Mensajebienvenida)}`, '_blank', 'noopener,noreferrer');
      }
    })
    .catch(function(Errorregistro) {
      if (Errorbox) {
        Errorbox.textContent = 'No se pudo sincronizar con Google Sheets. Revisa la conexión.';
      }
    })
    .finally(function() {
      if (Botonguardar) {
        Botonguardar.disabled = false;
        Botonguardar.textContent = 'Confirmar ingreso y entregar llaves';
      }
    });
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

  const Botonrefrescar = document.getElementById('btnRefrescarRack');
  if (Botonrefrescar) {
    Botonrefrescar.addEventListener('click', Cargarhabitaciones);
  }

  const Botonsalir = document.getElementById('btnSalirAdmin');
  if (Botonsalir) {
    Botonsalir.addEventListener('click', Cerrarsesionadmin);
  }

  document.querySelectorAll('.js-cerrar-checkin').forEach(function(Botoncerrar) {
    Botoncerrar.addEventListener('click', Cerrarcheckin);
  });

  const Contenedorrack = document.getElementById('rackGrid');
  if (Contenedorrack) {
    Contenedorrack.addEventListener('click', function(Evento) {
      const Botoncheckin = Evento.target.closest('[data-checkin]');
      if (Botoncheckin) {
        Abrircheckin(Botoncheckin.dataset.checkin);
      }
    });
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

  // Eventos de formulario de Check-in
  const Formulario = document.getElementById('checkinForm');
  if (Formulario) {
    Formulario.addEventListener('submit', Guardarcheckinpresencial);
  }

  const Camposalida = document.getElementById('checkinSalida');
  if (Camposalida) {
    Camposalida.addEventListener('change', Actualizartotalcheckin);
  }

  const Campopago = document.getElementById('checkinPago');
  if (Campopago) {
    Campopago.addEventListener('input', function() {
      Campopago.dataset.manual = 'true';
    });
  }

  // Auto-refresco de habitaciones cada 60 segundos
  setInterval(function() {
    if (Estadorecepcion.autenticado) {
      Cargarhabitaciones();
    }
  }, 60000);
});
