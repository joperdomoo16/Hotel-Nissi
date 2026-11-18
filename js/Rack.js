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
    Consultardisponibilidadservidor(Cadenahoy, Manana, 1)
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
    const Estadohab = String(Hab.estadoactual || 'Disponible');
    const Esmantenimiento = Estadohab === 'Mantenimiento' || String(Hab.numero) === '03';
    const Eslimpieza = !Esmantenimiento && (Estadohab === 'Limpieza' || Estadohab === 'Pendiente de limpieza');
    const Esapartada = !Esmantenimiento && !Eslimpieza && (Estadohab === 'Apartada' || Estadohab === 'En proceso' || Estadohab === 'Verificando' || Estadohab === 'En canal');
    const Esocupada = !Esmantenimiento && !Eslimpieza && Estadohab === 'Ocupada';
    const Eslibre = !Esmantenimiento && !Eslimpieza && !Esapartada && !Esocupada && Hab.disponible !== false;
    if (Eslibre) { Contadorlibres++; }
    else if (!Esmantenimiento) { Contadorocupadas++; }

    const Numeroseguro = typeof Escaparhtml === 'function' ? Escaparhtml(Hab.numero) : Hab.numero;
    const Tiposeguro = typeof Escaparhtml === 'function' ? Escaparhtml(Hab.tipo) : Hab.tipo;
    const Capacidadsegura = typeof Escaparhtml === 'function' ? Escaparhtml(Hab.capacidad) : Hab.capacidad;

    const Clasetarjeta = Esmantenimiento ? 'is-maintenance' : (Eslimpieza ? 'is-cleaning' : (Eslibre ? 'is-available' : (Esapartada ? 'is-reserved' : 'is-occupied')));
    const Etiquetaestado = Esmantenimiento ? '● En rediseño' : (Eslimpieza ? '◐ Pendiente de limpieza' : (Eslibre ? '● Disponible' : (Esapartada ? '◐ Apartada · En proceso' : '■ Ocupada')));
    const Preciomostrar = Esmantenimiento ? 'En rediseño' : `Desde $${Number(Hab.tarifanoche || 55000).toLocaleString('es-CO')} COP`;
    let Accionhtml = `<button class="btn btn--ghost btn--sm" type="button" disabled>${Esmantenimiento ? 'En rediseño (no disponible)' : 'Apartada en proceso (30 min)'}</button>`;
    if (Eslibre) { Accionhtml = `<button class="btn btn--cream btn--sm" type="button" data-checkin="${Numeroseguro}">Check-in presencial</button>`; }
    else if (Eslimpieza) { Accionhtml = `<button class="btn btn--cream btn--sm" type="button" data-habilitar="${Numeroseguro}">Habilitar habitación</button>`; }
    else if (Esocupada) { Accionhtml = `<button class="btn btn--ghost btn--sm" type="button" data-limpieza="${Numeroseguro}">Registrar salida (Limpieza)</button>`; }

    const Tarjeta = document.createElement('div');
    Tarjeta.className = `room-card ${Clasetarjeta}`;
    Tarjeta.innerHTML = `
      <div class="room-card-head">
        <span class="room-card-num">${Numeroseguro}</span>
        <span class="room-card-status">${Etiquetaestado}</span>
      </div>
      <h4 class="room-card-type">${Tiposeguro}</h4>
      <div class="room-card-info">
        <span>${Capacidadsegura}</span>
        <span class="room-card-price">${Preciomostrar}</span>
      </div>
      <div class="room-card-action">${Accionhtml}</div>
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
  if (Campollegada) { Campollegada.value = Hoy; }
  if (Camposalida) { Camposalida.min = Manana; Camposalida.value = Manana; }
  const Medio = document.getElementById('checkinMedio');
  const Mixtobox = document.getElementById('checkinMixtoCampos');
  const Inpnequi = document.getElementById('checkinMontoNequi');
  const Inpefec = document.getElementById('checkinMontoEfectivo');
  const Pago = document.getElementById('checkinPago');
  if (Medio) { Medio.value = 'Efectivo'; }
  if (Mixtobox) { Mixtobox.hidden = true; }
  if (Inpnequi) { Inpnequi.value = ''; }
  if (Inpefec) { Inpefec.value = ''; }
  if (Pago) { delete Pago.dataset.manual; }

  Actualizartotalcheckin();
  if (Modal) { Modal.hidden = false; }
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

function Actualizarmediocheckin() {
  const Medio = document.getElementById('checkinMedio');
  const Mixtobox = document.getElementById('checkinMixtoCampos');
  const Pago = document.getElementById('checkinPago');
  const EsMixto = Medio && Medio.value === 'Mixto';
  if (Mixtobox) { Mixtobox.hidden = !EsMixto; }
  if (Pago) { Pago.readOnly = EsMixto; }
  if (EsMixto) { Sumarmixtocheckin(); }
  else if (Pago && !Pago.dataset.manual) { Actualizartotalcheckin(); }
}

function Sumarmixtocheckin() {
  const Pago = document.getElementById('checkinPago');
  const Nequi = Math.max(0, parseInt((document.getElementById('checkinMontoNequi') || {}).value, 10) || 0);
  const Efec = Math.max(0, parseInt((document.getElementById('checkinMontoEfectivo') || {}).value, 10) || 0);
  if (Pago && (Nequi > 0 || Efec > 0)) { Pago.value = Nequi + Efec; }
}

function Actualizartotalcheckin() {
  const Hab = Estadorecepcion.habitacionseleccionada;
  if (!Hab) { return; }
  const Llegada = document.getElementById('checkinLlegada') ? document.getElementById('checkinLlegada').value : '';
  const Salida = document.getElementById('checkinSalida') ? document.getElementById('checkinSalida').value : '';
  const Personas = parseInt((document.getElementById('checkinHuespedes') || {}).value || 2, 10);
  const Admitecamas = Personas === 2 && ['01', '02', '06'].indexOf(Hab.numero) !== -1;
  const Selectcamas = document.getElementById('checkinCamas');
  const Wrapcamas = document.getElementById('checkinCamasWrap');
  if (Selectcamas) { Selectcamas.disabled = !Admitecamas; if (!Admitecamas) { Selectcamas.value = 'compartida'; } }
  if (Wrapcamas) { Wrapcamas.style.opacity = Admitecamas ? '1' : '0.45'; }

  const Camasseparadas = Admitecamas && Selectcamas && Selectcamas.value === 'separadas';
  const Tarifa = Personas <= 1 ? 55000 : (Personas === 2 ? (Camasseparadas ? 90000 : 70000) : 110000);
  const Noches = typeof Calcularnochesestadia === 'function' ? Calcularnochesestadia(Llegada, Salida) : 1;
  const Valortotal = Math.max(1, Noches) * Tarifa;
  const Totaltexto = document.getElementById('checkinTotal');
  const Montopagado = document.getElementById('checkinPago');
  const Medio = document.getElementById('checkinMedio');

  if (Totaltexto) { Totaltexto.textContent = `$${Valortotal.toLocaleString('es-CO')} COP (${Math.max(1, Noches)} noche${Noches > 1 ? 's' : ''})`; }
  if (Montopagado && !Montopagado.dataset.manual && (!Medio || Medio.value !== 'Mixto')) { Montopagado.value = Valortotal; }
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
  const Huespedes = Math.max(1, Math.min(3, parseInt(document.getElementById('checkinHuespedes').value, 10) || 2));
  const Camasseparadas = ((document.getElementById('checkinCamas') || {}).value === 'separadas');
  const Mediopago = typeof Sanitizartexto === 'function' ? Sanitizartexto(document.getElementById('checkinMedio').value, 30) : document.getElementById('checkinMedio').value;
  const Montonequi = Math.max(0, parseInt((document.getElementById('checkinMontoNequi') || {}).value, 10) || 0);
  const Montoefectivo = Math.max(0, parseInt((document.getElementById('checkinMontoEfectivo') || {}).value, 10) || 0);
  const EsMixto = Mediopago === 'Mixto';
  const Montopago = EsMixto ? (Montonequi + Montoefectivo) : Math.max(0, parseInt(document.getElementById('checkinPago').value, 10) || 0);

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
    if (Errorbox) { Errorbox.textContent = 'La fecha de salida debe ser posterior a la fecha de llegada.'; }
    return;
  }
  if (EsMixto && (Montonequi <= 0 || Montoefectivo <= 0)) {
    if (Errorbox) { Errorbox.textContent = 'En pago mixto debes escribir cuánto pagó por Nequi y cuánto en efectivo (ambos mayores a 0).'; }
    return;
  }
  if (Errorbox) { Errorbox.textContent = ''; }

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
    camasseparadas: Camasseparadas,
    horallegada: 'Check-in presencial',
    montopagado: Montopago,
    montonequi: EsMixto ? Montonequi : (Mediopago === 'Nequi' ? Montopago : 0),
    montoefectivo: EsMixto ? Montoefectivo : (Mediopago === 'Efectivo' ? Montopago : 0),
    referenciapago: EsMixto
      ? `Presencial · Nequi $${Montonequi.toLocaleString('es-CO')} + Efectivo $${Montoefectivo.toLocaleString('es-CO')}`
      : `Presencial - ${Mediopago}`,
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
    const Mensajebienvenida =
      `¡Bienvenido al Hospedaje Nissi, ${Nombre}! Tu reserva ${Codigo} en la habitación ${Hab.numero} (${Hab.tipo}) ha sido confirmada. ` +
      `Red Wi-Fi: HospedajeNissi_Huespedes.\n` +
      `📍 Cómo llegar rápido:\nGoogle Maps: ${Configuracionhotel.mapas}\nWaze: ${Configuracionhotel.waze}\n` +
      `¡Que tengas un excelente descanso en Mingueo!`;
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
      if (Botoncheckin) { return Abrircheckin(Botoncheckin.dataset.checkin); }
      const Botonhabilitar = Evento.target.closest('[data-habilitar]');
      if (Botonhabilitar) {
        const Habnum = Botonhabilitar.dataset.habilitar;
        if (!confirm(`¿Confirmas que la habitación ${Habnum} ya está limpia y lista para recibir huéspedes?`)) { return; }
        Botonhabilitar.disabled = true;
        Botonhabilitar.textContent = 'Habilitando...';
        Cambiarlimpiezahabitacionservidor(Habnum, true).finally(Cargarhabitaciones);
        return;
      }
      const Botonlimpieza = Evento.target.closest('[data-limpieza]');
      if (Botonlimpieza) {
        const Habnum = Botonlimpieza.dataset.limpieza;
        if (!confirm(`¿Registrar la salida de la habitación ${Habnum} y pasarla a pendiente de limpieza?`)) { return; }
        Botonlimpieza.disabled = true;
        Botonlimpieza.textContent = 'Actualizando...';
        Cambiarlimpiezahabitacionservidor(Habnum, false).finally(Cargarhabitaciones);
      }
    });
  }

  const Formulario = document.getElementById('checkinForm');
  if (Formulario) {
    Formulario.addEventListener('submit', Guardarcheckinpresencial);
  }

  const Camposalida = document.getElementById('checkinSalida');
  if (Camposalida) { Camposalida.addEventListener('change', Actualizartotalcheckin); }
  const Campopersonas = document.getElementById('checkinHuespedes');
  if (Campopersonas) { Campopersonas.addEventListener('change', Actualizartotalcheckin); }
  const Campocamas = document.getElementById('checkinCamas');
  if (Campocamas) { Campocamas.addEventListener('change', Actualizartotalcheckin); }

  const Campopago = document.getElementById('checkinPago');
  if (Campopago) { Campopago.addEventListener('input', function() { Campopago.dataset.manual = 'true'; }); }
  const Campomedio = document.getElementById('checkinMedio');
  if (Campomedio) { Campomedio.addEventListener('change', Actualizarmediocheckin); }
  const Camponequi = document.getElementById('checkinMontoNequi');
  if (Camponequi) { Camponequi.addEventListener('input', Sumarmixtocheckin); }
  const Campoefec = document.getElementById('checkinMontoEfectivo');
  if (Campoefec) { Campoefec.addEventListener('input', Sumarmixtocheckin); }
});

