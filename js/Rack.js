// Modulo del Rack de Habitaciones y Check-in Presencial en Recepcion

function Cargarhabitaciones() {
  const Indicadorreloj = document.getElementById('adminClock');
  const Ahora = new Date();
  if (Indicadorreloj) {
    Indicadorreloj.textContent = Ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  const Cadenahoy = Ahora.toISOString().split('T')[0];
  const Manana = new Date(Ahora.getTime() + 86400000).toISOString().split('T')[0];

  if (typeof Consultardisponibilidadservidor === 'function') {
    Consultardisponibilidadservidor(Cadenahoy, Manana, 2)
      .then(function(Respuesta) {
        if (Respuesta && Array.isArray(Respuesta.todas)) {
          Estadorecepcion.habitaciones = Respuesta.todas;
        } else {
          Estadorecepcion.habitaciones = Obtenercatalogorespaldo();
        }
        Dibujartablerohabitaciones();
      })
      .catch(function() {
        Estadorecepcion.habitaciones = Obtenercatalogorespaldo();
        Dibujartablerohabitaciones();
      });
  } else {
    Estadorecepcion.habitaciones = Obtenercatalogorespaldo();
    Dibujartablerohabitaciones();
  }
}

function Obtenercatalogorespaldo() {
  if (typeof Habitacioneshotel !== 'undefined' && Array.isArray(Habitacioneshotel)) {
    return Habitacioneshotel.map(function(Hab) {
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
  return [];
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

    const Numeroseguro = typeof Escaparhtml === 'function' ? Escaparhtml(Hab.numero) : Hab.numero;
    const Tiposeguro = typeof Escaparhtml === 'function' ? Escaparhtml(Hab.tipo) : Hab.tipo;
    const Capacidadsegura = typeof Escaparhtml === 'function' ? Escaparhtml(Hab.capacidad) : Hab.capacidad;

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

  const Noches = typeof Calcularnochesestadia === 'function' ? Calcularnochesestadia(Llegada, Salida) : 1;
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
  const Nombre = typeof Sanitizartexto === 'function' ? Sanitizartexto(document.getElementById('checkinNombre').value, 80) : document.getElementById('checkinNombre').value;
  const CedulaRaw = document.getElementById('checkinCedula') ? document.getElementById('checkinCedula').value : '';
  const Cedula = typeof Sanitizartexto === 'function' ? Sanitizartexto(CedulaRaw, 20) : CedulaRaw;
  const Celular = typeof Sanitizartexto === 'function' ? Sanitizartexto(document.getElementById('checkinCelular').value, 20) : document.getElementById('checkinCelular').value;
  const Llegada = document.getElementById('checkinLlegada').value;
  const Salida = document.getElementById('checkinSalida').value;
  const Huespedes = Math.max(1, Math.min(4, parseInt(document.getElementById('checkinHuespedes').value, 10) || 2));
  const Mediopago = typeof Sanitizartexto === 'function' ? Sanitizartexto(document.getElementById('checkinMedio').value, 30) : document.getElementById('checkinMedio').value;
  const Montopago = Math.max(0, parseInt(document.getElementById('checkinPago').value, 10) || 0);

  if (!Nombre) {
    if (Errorbox) {
      Errorbox.textContent = 'Escribe el nombre del huésped.';
    }
    return;
  }
  if (typeof Validarcedulacolombiana === 'function' && !Validarcedulacolombiana(Cedula)) {
    if (Errorbox) {
      Errorbox.textContent = 'Ingresa una cédula colombiana válida (6 a 10 dígitos).';
    }
    return;
  }
  if (typeof Validarnumerocelular === 'function' && !Validarnumerocelular(Celular)) {
    if (Errorbox) {
      Errorbox.textContent = 'Escribe un celular válido de contacto.';
    }
    return;
  }
  if (typeof Validarrangofechas === 'function' && !Validarrangofechas(Llegada, Salida)) {
    if (Errorbox) {
      Errorbox.textContent = 'La fecha de salida debe ser posterior a la fecha de llegada.';
    }
    return;
  }

  const Codigo = `NS-W${Math.floor(100 + Math.random() * 900)}`;
  const Botonguardar = document.getElementById('btnGuardarCheckin');
  if (Botonguardar) {
    Botonguardar.disabled = true;
    Botonguardar.textContent = 'Registrando...';
  }

  const Fechahoyregistro = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const Solicitud = {
    codigo: Codigo,
    fecharegistro: Fechahoyregistro,
    nombre: Nombre,
    cedula: Cedula.replace(/\D/g, ''),
    celular: Celular,
    habitacion: Hab.numero,
    llegada: Llegada,
    salida: Salida,
    noches: typeof Calcularnochesestadia === 'function' ? Calcularnochesestadia(Llegada, Salida) || 1 : 1,
    huespedes: Huespedes,
    horallegada: 'Check-in presencial',
    montopagado: Montopago,
    referenciapago: `Presencial - ${Mediopago}`,
    entidadpago: Mediopago,
    estado: 'Confirmada'
  };

  if (typeof Guardarhistorialreserva === 'function') {
    Guardarhistorialreserva(Solicitud);
  }

  if (typeof Enviarsolicitudservidor === 'function') {
    Enviarsolicitudservidor(Solicitud)
      .then(function() {
        Finalizarcheckinpresencial(Codigo, Nombre, Hab, Celular);
      })
      .catch(function() {
        Finalizarcheckinpresencial(Codigo, Nombre, Hab, Celular);
      })
      .finally(function() {
        if (Botonguardar) {
          Botonguardar.disabled = false;
          Botonguardar.textContent = 'Confirmar ingreso y entregar llaves';
        }
      });
  } else {
    Finalizarcheckinpresencial(Codigo, Nombre, Hab, Celular);
    if (Botonguardar) {
      Botonguardar.disabled = false;
      Botonguardar.textContent = 'Confirmar ingreso y entregar llaves';
    }
  }
}

function Finalizarcheckinpresencial(Codigo, Nombre, Hab, Celular) {
  Cerrarcheckin();
  Cargarhabitaciones();
  if (typeof Cargardashboard === 'function' && document.getElementById('seccionDashboard') && !document.getElementById('seccionDashboard').hidden) {
    Cargardashboard();
  }

  const Enviarwa = confirm(`¡Ingreso registrado con éxito! Código: ${Codigo}.\n\n¿Deseas enviar el recibo y la bienvenida por WhatsApp al huésped?`);
  if (Enviarwa) {
    const Mensajebienvenida = `¡Bienvenido al Hotel Nissi, ${Nombre}! Tu ingreso a la habitación ${Hab.numero} (${Hab.tipo}) ha sido confirmado. Código: ${Codigo}. Red Wi-Fi: HotelNissi_Huespedes. ¡Que tengas un excelente descanso en Mingueo!`;
    window.open(`https://wa.me/57${Celular.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(Mensajebienvenida)}`, '_blank', 'noopener,noreferrer');
  }
}

// Inicializacion de eventos para el rack de recepcion
document.addEventListener('DOMContentLoaded', function() {
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
});

