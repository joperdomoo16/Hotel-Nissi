// Rack de habitaciones en tiempo real y registro de ingresos presenciales

function Crearnodorack(Etiqueta, Clase, Texto) {
  const Nodo = document.createElement(Etiqueta);
  if (Clase) Nodo.className = Clase;
  if (Texto !== undefined && Texto !== null) Nodo.textContent = String(Texto);
  return Nodo;
}

function Cargarhabitaciones() {
  const Indicadorreloj = document.getElementById('adminClock');
  const Ahora = new Date();
  if (Indicadorreloj) {
    Indicadorreloj.textContent = Ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  const Cadenahoy = Formatearfechalocal(Ahora);
  const Manana = Formatearfechalocal(new Date(Ahora.getTime() + 86400000));

  if (typeof Consultardisponibilidadservidor === 'function') {
    Consultardisponibilidadservidor(Cadenahoy, Manana, 1)
      .then(function(Respuesta) {
        Estadorecepcion.habitaciones = (Respuesta && Array.isArray(Respuesta.todas)) ? Respuesta.todas : Obtenercatalogorespaldo();
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
        numero: Hab.numero, tipo: Hab.tipo, capacidad: Hab.capacidad,
        huespedesmaximos: Hab.huespedesmaximos, tarifanoche: Hab.precio,
        disponible: !Hab.mantenimiento, estadoactual: Hab.mantenimiento ? 'Mantenimiento' : 'Disponible'
      };
    });
  }
  return [];
}

function Dibujartablerohabitaciones() {
  const Contenedor = document.getElementById('rackGrid');
  if (!Contenedor) return;

  let Contadorlibres = 0;
  let Contadorocupadas = 0;
  Contenedor.textContent = '';

  Estadorecepcion.habitaciones.forEach(function(Hab) {
    const Estadohab = String(Hab.estadoactual || 'Disponible');
    const Esmantenimiento = Estadohab === 'Mantenimiento' || String(Hab.numero) === '03';
    const Eslimpieza = !Esmantenimiento && (Estadohab === 'Limpieza' || Estadohab === 'Pendiente de limpieza');
    const Esapartada = !Esmantenimiento && !Eslimpieza && (Estadohab === 'Apartada' || Estadohab === 'En proceso' || Estadohab === 'Verificando' || Estadohab === 'En canal');
    const Esocupada = !Esmantenimiento && !Eslimpieza && Estadohab === 'Ocupada';
    const Eslibre = !Esmantenimiento && !Eslimpieza && !Esapartada && !Esocupada && Hab.disponible !== false;

    if (Eslibre) Contadorlibres++;
    else if (!Esmantenimiento) Contadorocupadas++;

    const Clasetarjeta = Esmantenimiento ? 'is-maintenance' : (Eslimpieza ? 'is-cleaning' : (Eslibre ? 'is-available' : (Esapartada ? 'is-reserved' : 'is-occupied')));
    const Etiquetaestado = Esmantenimiento ? 'En rediseño' : (Eslimpieza ? 'Pendiente de limpieza' : (Eslibre ? 'Disponible' : (Esapartada ? 'Apartada · En proceso' : 'Ocupada')));
    const Preciomostrar = Esmantenimiento ? 'En rediseño' : `Desde $${Number(Hab.tarifanoche || 55000).toLocaleString('es-CO')} COP`;

    const Tarjeta = Crearnodorack('div', `room-card ${Clasetarjeta}`);
    const Cabecera = Crearnodorack('div', 'room-card-head');
    Cabecera.appendChild(Crearnodorack('span', 'room-card-num', Hab.numero || ''));
    Cabecera.appendChild(Crearnodorack('span', 'room-card-status', Etiquetaestado));

    const Bloqueinfo = Crearnodorack('div', 'room-card-info');
    Bloqueinfo.appendChild(Crearnodorack('span', '', Hab.capacidad || ''));
    Bloqueinfo.appendChild(Crearnodorack('span', 'room-card-price', Preciomostrar));

    const Bloqueaccion = Crearnodorack('div', 'room-card-action');
    const Botonaccion = Crearnodorack('button');
    Botonaccion.type = 'button';

    if (Eslibre) {
      Botonaccion.className = 'btn btn--cream btn--sm';
      Botonaccion.dataset.checkin = String(Hab.numero || '');
      Botonaccion.textContent = 'Check-in presencial';
    } else if (Eslimpieza) {
      Botonaccion.className = 'btn btn--cream btn--sm';
      Botonaccion.dataset.habilitar = String(Hab.numero || '');
      Botonaccion.textContent = 'Habilitar habitación';
    } else if (Esocupada) {
      Botonaccion.className = 'btn btn--ghost btn--sm';
      Botonaccion.dataset.limpieza = String(Hab.numero || '');
      Botonaccion.textContent = 'Registrar salida (Limpieza)';
    } else {
      Botonaccion.className = 'btn btn--ghost btn--sm';
      Botonaccion.disabled = true;
      Botonaccion.textContent = Esmantenimiento ? 'En rediseño (no disponible)' : 'Apartada en proceso (30 min)';
    }

    Bloqueaccion.appendChild(Botonaccion);
    Tarjeta.appendChild(Cabecera);
    Tarjeta.appendChild(Crearnodorack('h4', 'room-card-type', Hab.tipo || ''));
    Tarjeta.appendChild(Bloqueinfo);
    Tarjeta.appendChild(Bloqueaccion);
    Contenedor.appendChild(Tarjeta);
  });

  const Resumenlibres = document.getElementById('countAvailable');
  const Resumenocupadas = document.getElementById('countOccupied');
  if (Resumenlibres) Resumenlibres.textContent = Contadorlibres;
  if (Resumenocupadas) Resumenocupadas.textContent = Contadorocupadas;
}

function Abrircheckin(Numerohabitacion) {
  const Hab = Estadorecepcion.habitaciones.find(function(H) { return H.numero === Numerohabitacion; });
  if (!Hab) return;

  Estadorecepcion.habitacionseleccionada = Hab;
  const Modal = document.getElementById('checkinModal');
  const Titulohab = document.getElementById('checkinRoomTitle');
  const Camposalida = document.getElementById('checkinSalida');
  const Campollegada = document.getElementById('checkinLlegada');

  const Hoy = Formatearfechalocal(new Date());
  const Manana = Formatearfechalocal(new Date(Date.now() + 86400000));

  if (Titulohab) Titulohab.textContent = `Habitación ${Hab.numero} (${Hab.tipo})`;
  if (Campollegada) Campollegada.value = Hoy;
  if (Camposalida) { Camposalida.min = Manana; Camposalida.value = Manana; }

  const Medio = document.getElementById('checkinMedio');
  const Mixtobox = document.getElementById('checkinMixtoCampos');
  const Inpnequi = document.getElementById('checkinMontoNequi');
  const Inpefec = document.getElementById('checkinMontoEfectivo');
  const Pago = document.getElementById('checkinPago');
  if (Medio) Medio.value = 'Efectivo';
  if (Mixtobox) Mixtobox.hidden = true;
  if (Inpnequi) Inpnequi.value = '';
  if (Inpefec) Inpefec.value = '';
  if (Pago) { delete Pago.dataset.manual; Pago.readOnly = false; }

  Actualizartotalcheckin();
  if (Modal) Modal.hidden = false;
}

function Cerrarcheckin() {
  const Modal = document.getElementById('checkinModal');
  if (Modal) Modal.hidden = true;
  const Errorbox = document.getElementById('checkinError');
  if (Errorbox) Errorbox.textContent = '';
}

function Actualizarmediocheckin() {
  const Medio = document.getElementById('checkinMedio');
  const Mixtobox = document.getElementById('checkinMixtoCampos');
  const Pago = document.getElementById('checkinPago');
  const Esmixto = Medio && Medio.value === 'Mixto';
  if (Mixtobox) Mixtobox.hidden = !Esmixto;
  if (Pago) Pago.readOnly = Esmixto;
  if (Esmixto) Sumarmixtocheckin();
  else if (Pago && !Pago.dataset.manual) Actualizartotalcheckin();
}

function Sumarmixtocheckin() {
  const Pago = document.getElementById('checkinPago');
  const Nequi = Math.max(0, parseInt((document.getElementById('checkinMontoNequi') || {}).value, 10) || 0);
  const Efec = Math.max(0, parseInt((document.getElementById('checkinMontoEfectivo') || {}).value, 10) || 0);
  if (Pago && (Nequi > 0 || Efec > 0)) Pago.value = Nequi + Efec;
}

function Actualizartotalcheckin() {
  const Hab = Estadorecepcion.habitacionseleccionada;
  if (!Hab) return;
  const Llegada = document.getElementById('checkinLlegada') ? document.getElementById('checkinLlegada').value : '';
  const Salida = document.getElementById('checkinSalida') ? document.getElementById('checkinSalida').value : '';
  const Personas = parseInt((document.getElementById('checkinHuespedes') || {}).value || 2, 10);
  const Admitecamas = Personas === 2 && ['01', '02', '06'].indexOf(Hab.numero) !== -1;
  const Selectcamas = document.getElementById('checkinCamas');
  const Wrapcamas = document.getElementById('checkinCamasWrap');
  if (Selectcamas) { Selectcamas.disabled = !Admitecamas; if (!Admitecamas) Selectcamas.value = 'compartida'; }
  if (Wrapcamas) Wrapcamas.style.opacity = Admitecamas ? '1' : '0.45';

  const Camasseparadas = Admitecamas && Selectcamas && Selectcamas.value === 'separadas';
  const Tarifa = Personas <= 1 ? 55000 : (Personas === 2 ? (Camasseparadas ? 90000 : 70000) : 110000);
  const Noches = typeof Calcularnochesestadia === 'function' ? Calcularnochesestadia(Llegada, Salida) : 1;
  const Valortotal = Math.max(1, Noches) * Tarifa;
  const Totaltexto = document.getElementById('checkinTotal');
  const Montopagado = document.getElementById('checkinPago');
  const Medio = document.getElementById('checkinMedio');

  if (Totaltexto) Totaltexto.textContent = `$${Valortotal.toLocaleString('es-CO')} COP (${Math.max(1, Noches)} noche${Noches > 1 ? 's' : ''})`;
  if (Montopagado && !Montopagado.dataset.manual && (!Medio || Medio.value !== 'Mixto')) Montopagado.value = Valortotal;
}

function Guardarcheckinpresencial(Evento) {
  Evento.preventDefault();
  const Hab = Estadorecepcion.habitacionseleccionada;
  if (!Hab || !Estadorecepcion.tokensession) {
    if (!Estadorecepcion.tokensession && typeof Manejarsesionexpirada === 'function') Manejarsesionexpirada();
    return;
  }

  const Errorbox = document.getElementById('checkinError');
  const Nombre = Sanitizartexto(document.getElementById('checkinNombre').value, 80);
  const Cedula = Sanitizartexto((document.getElementById('checkinCedula') || {}).value || '', 20);
  const Celular = Sanitizartexto(document.getElementById('checkinCelular').value, 20);
  const Llegada = document.getElementById('checkinLlegada').value;
  const Salida = document.getElementById('checkinSalida').value;
  const Huespedes = Math.max(1, Math.min(3, parseInt(document.getElementById('checkinHuespedes').value, 10) || 2));
  const Camasseparadas = ((document.getElementById('checkinCamas') || {}).value === 'separadas');
  const Mediopago = Sanitizartexto(document.getElementById('checkinMedio').value, 30);
  const Montonequi = Math.max(0, parseInt((document.getElementById('checkinMontoNequi') || {}).value, 10) || 0);
  const Montoefectivo = Math.max(0, parseInt((document.getElementById('checkinMontoEfectivo') || {}).value, 10) || 0);
  const Esmixto = Mediopago === 'Mixto';
  const Montopago = Esmixto ? (Montonequi + Montoefectivo) : Math.max(0, parseInt(document.getElementById('checkinPago').value, 10) || 0);

  if (!Nombre) { if (Errorbox) Errorbox.textContent = 'Escribe el nombre del huésped.'; return; }
  if (!Validarcedulacolombiana(Cedula)) { if (Errorbox) Errorbox.textContent = 'Ingresa una cédula colombiana válida (6 a 8 dígitos, o 10 dígitos iniciando en 1).'; return; }
  if (!Validarnumerocelular(Celular)) { if (Errorbox) Errorbox.textContent = 'Ingresa un celular colombiano válido de 10 dígitos (ej. 3001234567).'; return; }
  if (!Validarrangofechas(Llegada, Salida)) { if (Errorbox) Errorbox.textContent = 'La fecha de salida debe ser posterior a la fecha de llegada.'; return; }
  if (Esmixto && (Montonequi <= 0 || Montoefectivo <= 0)) {
    if (Errorbox) Errorbox.textContent = 'En pago mixto debes escribir cuánto pagó por Nequi y cuánto en efectivo (ambos mayores a 0).';
    return;
  }
  if (Errorbox) Errorbox.textContent = '';

  const Celularnormalizado = Normalizarcelularcolombianocliente(Celular) || Celular;
  const Codigo = Generarcodigoreserva();
  const Botonguardar = document.getElementById('btnGuardarCheckin');
  if (Botonguardar) { Botonguardar.disabled = true; Botonguardar.textContent = 'Registrando...'; }

  const Solicitud = {
    codigo: Codigo, fecharegistro: Formatearfechalocal(new Date()), nombre: Nombre,
    cedula: Cedula.replace(/\D/g, ''), celular: Celularnormalizado, habitacion: Hab.numero,
    llegada: Llegada, salida: Salida, noches: Calcularnochesestadia(Llegada, Salida) || 1,
    huespedes: Huespedes, camasseparadas: Camasseparadas, horallegada: 'Check-in presencial',
    montopagado: Montopago,
    montonequi: Esmixto ? Montonequi : (Mediopago === 'Nequi' ? Montopago : 0),
    montoefectivo: Esmixto ? Montoefectivo : (Mediopago === 'Efectivo' ? Montopago : 0),
    referenciapago: Esmixto
      ? `Presencial · Nequi $${Montonequi.toLocaleString('es-CO')} + Efectivo $${Montoefectivo.toLocaleString('es-CO')}`
      : `Presencial - ${Mediopago}`,
    entidadpago: Mediopago, estado: 'Confirmada'
  };

  Enviarsolicitudservidor(Solicitud, Estadorecepcion.tokensession)
    .then(function(Respuesta) {
      if (Respuesta && Respuesta.noautorizado) {
        Cerrarcheckin();
        if (typeof Manejarsesionexpirada === 'function') Manejarsesionexpirada();
        return;
      }
      if (!Respuesta || Respuesta.exito === false) {
        if (Errorbox) {
          Errorbox.textContent = (Respuesta && Respuesta.mensaje)
            ? Respuesta.mensaje
            : 'No pudimos guardar el check-in en el servidor. Intenta de nuevo.';
        }
        return;
      }
      Finalizarcheckinpresencial(Respuesta.codigo || Codigo, Nombre, Hab, Celular);
    })
    .catch(function() {
      if (Errorbox) Errorbox.textContent = 'Error de conexión al registrar el ingreso.';
    })
    .finally(function() {
      if (Botonguardar) { Botonguardar.disabled = false; Botonguardar.textContent = 'Confirmar ingreso y entregar llaves'; }
    });
}

function Finalizarcheckinpresencial(Codigo, Nombre, Hab, Celular) {
  Cerrarcheckin();
  Cargarhabitaciones();
  if (typeof Cargardashboard === 'function' && document.getElementById('seccionDashboard') && !document.getElementById('seccionDashboard').hidden) {
    Cargardashboard();
  }

  const Enviarwa = confirm(`Ingreso registrado con éxito. Código: ${Codigo}.\n\n¿Deseas enviar el recibo y la bienvenida por WhatsApp al huésped?`);
  if (Enviarwa) {
    const Mensajebienvenida =
      `Bienvenido a Hospedaje Nissi, ${Nombre}. Tu reserva ${Codigo} en la habitación ${Hab.numero} (${Hab.tipo}) quedó confirmada. ` +
      `Red Wi-Fi: HospedajeNissi_Huespedes.\nCómo llegar rápido:\nGoogle Maps: ${Configuracionhotel.mapas}\nWaze: ${Configuracionhotel.waze}\n` +
      `Que tengas un excelente descanso en Mingueo.`;
    window.open(`https://wa.me/57${Celular.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(Mensajebienvenida)}`, '_blank', 'noopener,noreferrer');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.js-cerrar-checkin').forEach(function(Botoncerrar) {
    Botoncerrar.addEventListener('click', Cerrarcheckin);
  });

  const Contenedorrack = document.getElementById('rackGrid');
  if (Contenedorrack) {
    Contenedorrack.addEventListener('click', function(Evento) {
      const Botoncheckin = Evento.target.closest('[data-checkin]');
      if (Botoncheckin) return Abrircheckin(Botoncheckin.dataset.checkin);

      const Botonhabilitar = Evento.target.closest('[data-habilitar]');
      if (Botonhabilitar) {
        const Habnum = Botonhabilitar.dataset.habilitar;
        if (!confirm(`¿Confirmas que la habitación ${Habnum} ya está limpia y lista para recibir huéspedes?`)) return;
        Botonhabilitar.disabled = true;
        Botonhabilitar.textContent = 'Habilitando...';
        Cambiarlimpiezahabitacionservidor(Habnum, true, Estadorecepcion.tokensession)
          .then(function(Respuesta) {
            if (Respuesta && Respuesta.noautorizado && typeof Manejarsesionexpirada === 'function') Manejarsesionexpirada();
          })
          .finally(Cargarhabitaciones);
        return;
      }

      const Botonlimpieza = Evento.target.closest('[data-limpieza]');
      if (Botonlimpieza) {
        const Habnum = Botonlimpieza.dataset.limpieza;
        if (!confirm(`¿Registrar la salida de la habitación ${Habnum} y pasarla a pendiente de limpieza?`)) return;
        Botonlimpieza.disabled = true;
        Botonlimpieza.textContent = 'Actualizando...';
        Cambiarlimpiezahabitacionservidor(Habnum, false, Estadorecepcion.tokensession)
          .then(function(Respuesta) {
            if (Respuesta && Respuesta.noautorizado && typeof Manejarsesionexpirada === 'function') Manejarsesionexpirada();
          })
          .finally(Cargarhabitaciones);
      }
    });
  }

  const Formulario = document.getElementById('checkinForm');
  if (Formulario) Formulario.addEventListener('submit', Guardarcheckinpresencial);

  ['checkinSalida', 'checkinHuespedes', 'checkinCamas'].forEach(function(Id) {
    const Campo = document.getElementById(Id);
    if (Campo) Campo.addEventListener('change', Actualizartotalcheckin);
  });

  const Campopago = document.getElementById('checkinPago');
  if (Campopago) Campopago.addEventListener('input', function() { Campopago.dataset.manual = 'true'; });
  const Campomedio = document.getElementById('checkinMedio');
  if (Campomedio) Campomedio.addEventListener('change', Actualizarmediocheckin);
  ['checkinMontoNequi', 'checkinMontoEfectivo'].forEach(function(Id) {
    const Campo = document.getElementById(Id);
    if (Campo) Campo.addEventListener('input', Sumarmixtocheckin);
  });
});
