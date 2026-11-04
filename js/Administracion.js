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
  const Cedula = Sanitizartexto(document.getElementById('checkinCedula') ? document.getElementById('checkinCedula').value : '', 20);
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
  if (!Validarcedulacolombiana(Cedula)) {
    if (Errorbox) {
      Errorbox.textContent = 'Ingresa una cédula colombiana válida (6 a 10 dígitos).';
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
    noches: Calcularnochesestadia(Llegada, Salida) || 1,
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

  Enviarsolicitudservidor(Solicitud)
    .then(function() {
      Cerrarcheckin();
      Cargarhabitaciones();
      if (document.getElementById('seccionDashboard') && !document.getElementById('seccionDashboard').hidden) {
        Cargardashboard();
      }

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

// ==========================================================================
// Modulo de Dashboard, Filtros de Periodo y Metricas Gerenciales
// ==========================================================================
const Estadodashboard = {
  filtroactivo: 'diario',
  messeleccionado: '',
  fechainicio: '',
  fechafin: '',
  terminobusqueda: '',
  reservasperiodo: []
};

const Nombresmesescompletos = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function Cambiarvistapanel(Nuevavista) {
  const Seccionrack = document.getElementById('seccionRack');
  const Secciondash = document.getElementById('seccionDashboard');
  const Tabrack = document.getElementById('btnTabRack');
  const Tabdash = document.getElementById('btnTabDashboard');

  if (Nuevavista === 'dashboard') {
    if (Seccionrack) Seccionrack.hidden = true;
    if (Secciondash) Secciondash.hidden = false;
    if (Tabrack) {
      Tabrack.classList.remove('is-active');
      Tabrack.setAttribute('aria-selected', 'false');
    }
    if (Tabdash) {
      Tabdash.classList.add('is-active');
      Tabdash.setAttribute('aria-selected', 'true');
    }
    Cargardashboard();
  } else {
    if (Secciondash) Secciondash.hidden = true;
    if (Seccionrack) Seccionrack.hidden = false;
    if (Tabdash) {
      Tabdash.classList.remove('is-active');
      Tabdash.setAttribute('aria-selected', 'false');
    }
    if (Tabrack) {
      Tabrack.classList.add('is-active');
      Tabrack.setAttribute('aria-selected', 'true');
    }
    Cargarhabitaciones();
  }
}

function Poblarselectormeses() {
  const Selector = document.getElementById('dashSelectMes');
  if (!Selector) return;

  const Ahora = new Date();
  const Anohoy = Ahora.getFullYear();
  const Meshoy = Ahora.getMonth();

  let Opcioneshtml = '';
  for (let I = 0; I < 12; I++) {
    const Fechaevaluada = new Date(Anohoy, Meshoy - I, 1);
    const Ano = Fechaevaluada.getFullYear();
    const Mes = String(Fechaevaluada.getMonth() + 1).padStart(2, '0');
    const Clave = `${Ano}-${Mes}`;
    const Nombremes = Nombresmesescompletos[Fechaevaluada.getMonth()];
    const Esactual = I === 0;

    Opcioneshtml += `<option value="${Clave}">${Nombremes} ${Ano}${Esactual ? ' (Mes actual)' : ''}</option>`;
  }

  Selector.innerHTML = Opcioneshtml;
  Estadodashboard.messeleccionado = Selector.value;
}

function Cambiarfiltrodashboard(Nuevofiltro) {
  Estadodashboard.filtroactivo = Nuevofiltro;

  const Botones = {
    diario: document.getElementById('btnFiltroDiario'),
    semanal: document.getElementById('btnFiltroSemanal'),
    mensual: document.getElementById('btnFiltroMensual'),
    personalizado: document.getElementById('btnFiltroPersonalizado')
  };

  Object.keys(Botones).forEach(function(Clave) {
    if (Botones[Clave]) {
      Botones[Clave].classList.toggle('is-active', Clave === Nuevofiltro);
    }
  });

  const Selectormes = document.getElementById('dashSelectMes');
  if (Selectormes) {
    Selectormes.hidden = Nuevofiltro !== 'mensual';
  }

  const Cajapersonalizada = document.getElementById('dashCustomRange');
  if (Cajapersonalizada) {
    Cajapersonalizada.hidden = Nuevofiltro !== 'personalizado';
  }

  Cargardashboard();
}

function Obtenerrangofechasfiltro() {
  const Ahora = new Date();
  const Formateariso = function(D) {
    return D.toISOString().split('T')[0];
  };

  let Fechainicio = '';
  let Fechafin = '';
  let Descripciontexto = '';

  if (Estadodashboard.filtroactivo === 'diario') {
    Fechainicio = Formateariso(Ahora);
    Fechafin = Formateariso(Ahora);
    const Diames = Ahora.getDate();
    const Mesnombre = Nombresmesescompletos[Ahora.getMonth()];
    Descripciontexto = `Período: Hoy (${Diames} de ${Mesnombre} de ${Ahora.getFullYear()})`;
  } else if (Estadodashboard.filtroactivo === 'semanal') {
    const Hacesietedias = new Date(Ahora.getTime() - 6 * 86400000);
    Fechainicio = Formateariso(Hacesietedias);
    Fechafin = Formateariso(Ahora);
    Descripciontexto = `Período: Esta semana (${Fechainicio} al ${Fechafin})`;
  } else if (Estadodashboard.filtroactivo === 'mensual') {
    const Clavemes = Estadodashboard.messeleccionado || Formateariso(Ahora).slice(0, 7);
    const Partes = Clavemes.split('-');
    const Anoelegido = parseInt(Partes[0], 10);
    const Meselegido = parseInt(Partes[1], 10) - 1;

    const Primerdia = new Date(Anoelegido, Meselegido, 1);
    const Ultimodia = new Date(Anoelegido, Meselegido + 1, 0);

    Fechainicio = Formateariso(Primerdia);
    Fechafin = Formateariso(Ultimodia);
    Descripciontexto = `Período: ${Nombresmesescompletos[Meselegido]} de ${Anoelegido}`;
  } else if (Estadodashboard.filtroactivo === 'personalizado') {
    const Inputinicio = document.getElementById('dashFechaInicio');
    const Inputfin = document.getElementById('dashFechaFin');
    Fechainicio = Inputinicio && Inputinicio.value ? Inputinicio.value : Formateariso(Ahora);
    Fechafin = Inputfin && Inputfin.value ? Inputfin.value : Formateariso(Ahora);
    if (Fechafin < Fechainicio) {
      Fechafin = Fechainicio;
      if (Inputfin) Inputfin.value = Fechafin;
    }
    Descripciontexto = `Período: Del ${Fechainicio} al ${Fechafin}`;
  }

  return { inicio: Fechainicio, fin: Fechafin, texto: Descripciontexto };
}

function Cargardashboard() {
  const Rango = Obtenerrangofechasfiltro();
  const Badgetexto = document.getElementById('dashRangoTexto');
  if (Badgetexto) {
    Badgetexto.textContent = Rango.texto;
  }

  const Todaslasreservas = typeof Obtenerhistorialreservas === 'function' ? Obtenerhistorialreservas() : [];

  const Reservasfiltradas = Todaslasreservas.filter(function(Reserva) {
    const Fechareg = String(Reserva.fecharegistro || Reserva.llegada || '').slice(0, 10);
    const Fechallegada = String(Reserva.llegada || '').slice(0, 10);
    return (Fechareg >= Rango.inicio && Fechareg <= Rango.fin) ||
           (Fechallegada >= Rango.inicio && Fechallegada <= Rango.fin);
  });

  Estadodashboard.reservasperiodo = Reservasfiltradas;

  let Totalingresos = 0;
  let Totalnoches = 0;
  let Totalhuespedes = 0;
  const Totalcheckins = Reservasfiltradas.length;

  const Desglosemedios = {
    Efectivo: 0,
    Nequi: 0,
    Daviplata: 0,
    Transferencia: 0
  };

  const Desglosehabitaciones = {
    '01': { noches: 0, ingresos: 0, tipo: 'Sencilla' },
    '02': { noches: 0, ingresos: 0, tipo: 'Sencilla' },
    '03': { noches: 0, ingresos: 0, tipo: 'Doble' },
    '04': { noches: 0, ingresos: 0, tipo: 'Doble' },
    '05': { noches: 0, ingresos: 0, tipo: 'Triple' },
    '06': { noches: 0, ingresos: 0, tipo: 'Familiar' }
  };

  Reservasfiltradas.forEach(function(Res) {
    const Monto = Number(Res.montopagado || Res.montototal || 0);
    const Noches = Number(Res.noches || 1);
    const Huespedes = Number(Res.huespedes || 2);
    const Hab = String(Res.habitacion || '01').padStart(2, '0');
    const Mediopago = String(Res.entidadpago || Res.referenciapago || 'Efectivo');

    Totalingresos += Monto;
    Totalnoches += Noches;
    Totalhuespedes += Huespedes;

    let Medionormalizado = 'Efectivo';
    if (/nequi/i.test(Mediopago)) Medionormalizado = 'Nequi';
    else if (/daviplata/i.test(Mediopago)) Medionormalizado = 'Daviplata';
    else if (/transferencia|bancolombia/i.test(Mediopago)) Medionormalizado = 'Transferencia';

    Desglosemedios[Medionormalizado] = (Desglosemedios[Medionormalizado] || 0) + Monto;

    if (Desglosehabitaciones[Hab]) {
      Desglosehabitaciones[Hab].noches += Noches;
      Desglosehabitaciones[Hab].ingresos += Monto;
    }
  });

  const Milisegundosdia = 86400000;
  const Diasrango = Math.max(1, Math.round((new Date(Rango.fin) - new Date(Rango.inicio)) / Milisegundosdia) + 1);
  const Capacidadtotalnoches = Diasrango * 6;
  const Porcentajeocupacion = Math.min(100, Math.round((Totalnoches / Capacidadtotalnoches) * 1000) / 10);

  const ElIngresos = document.getElementById('kpiIngresos');
  const ElOcupacion = document.getElementById('kpiOcupacion');
  const ElNoches = document.getElementById('kpiNoches');
  const ElHuespedes = document.getElementById('kpiHuespedes');
  const ElCheckins = document.getElementById('kpiCheckins');
  const ElTotalmedios = document.getElementById('dashTotalMedios');

  if (ElIngresos) ElIngresos.textContent = `$${Totalingresos.toLocaleString('es-CO')} COP`;
  if (ElOcupacion) ElOcupacion.textContent = `${Porcentajeocupacion}%`;
  if (ElNoches) ElNoches.textContent = `${Totalnoches} noche${Totalnoches === 1 ? '' : 's'}`;
  if (ElHuespedes) ElHuespedes.textContent = `${Totalhuespedes} persona${Totalhuespedes === 1 ? '' : 's'}`;
  if (ElCheckins) ElCheckins.textContent = `${Totalcheckins}`;
  if (ElTotalmedios) ElTotalmedios.textContent = `$${Totalingresos.toLocaleString('es-CO')} COP`;

  const Contenedormedios = document.getElementById('dashPaymentsList');
  if (Contenedormedios) {
    const Coloresmedios = {
      Efectivo: '#55E482',
      Nequi: '#E040FB',
      Daviplata: '#FF5252',
      Transferencia: '#F3BA47'
    };

    let Htmlmedios = '';
    ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia'].forEach(function(Medio) {
      const Montomedio = Desglosemedios[Medio] || 0;
      const Porcentajemedio = Totalingresos > 0 ? Math.round((Montomedio / Totalingresos) * 100) : 0;
      const Color = Coloresmedios[Medio] || '#55E482';

      Htmlmedios += `
        <div class="dash-payment-item">
          <div class="dash-payment-row">
            <b>${Medio}</b>
            <span>$${Montomedio.toLocaleString('es-CO')} COP · <b>${Porcentajemedio}%</b></span>
          </div>
          <div class="dash-bar-bg">
            <div class="dash-bar-fill" style="width: ${Porcentajemedio}%; background: ${Color};"></div>
          </div>
        </div>
      `;
    });
    Contenedormedios.innerHTML = Htmlmedios;
  }

  const Contenedorhabs = document.getElementById('dashRoomsList');
  if (Contenedorhabs) {
    let Htmlhabs = '';
    Object.keys(Desglosehabitaciones).forEach(function(Num) {
      const Item = Desglosehabitaciones[Num];
      Htmlhabs += `
        <div class="dash-room-item">
          <div class="dash-room-info">
            <span class="dash-room-num">${Num}</span>
            <div>
              <b style="display:block; font-size:13px; color:var(--cream);">Habitación ${Num}</b>
              <small style="color:var(--sand); font-size:11px;">${Item.tipo}</small>
            </div>
          </div>
          <div class="dash-room-stats">
            <b>$${Item.ingresos.toLocaleString('es-CO')} COP</b>
            <small>${Item.noches} noche${Item.noches === 1 ? '' : 's'}</small>
          </div>
        </div>
      `;
    });
    Contenedorhabs.innerHTML = Htmlhabs;
  }

  Renderizartablamovimientos();
}

function Renderizartablamovimientos() {
  const Tablabody = document.getElementById('dashTableBody');
  const Totalindicador = document.getElementById('dashTotalRegistros');
  if (!Tablabody) return;

  const Termino = (Estadodashboard.terminobusqueda || '').toLowerCase().trim();
  const Reservasmostradas = Estadodashboard.reservasperiodo.filter(function(Res) {
    if (!Termino) return true;
    const Nombre = String(Res.nombre || '').toLowerCase();
    const Cedula = String(Res.cedula || '').toLowerCase();
    const Codigo = String(Res.codigo || '').toLowerCase();
    const Hab = String(Res.habitacion || '').toLowerCase();
    return Nombre.indexOf(Termino) !== -1 ||
           Cedula.indexOf(Termino) !== -1 ||
           Codigo.indexOf(Termino) !== -1 ||
           Hab.indexOf(Termino) !== -1;
  });

  if (Totalindicador) {
    Totalindicador.textContent = Reservasmostradas.length;
  }

  if (Reservasmostradas.length === 0) {
    Tablabody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="dash-empty-state">
            <span>📋</span>
            <b>No se encontraron reservas en este período</b>
            <p style="margin:4px 0 0; font-size:12px;">Prueba seleccionando otro rango de fechas o limpiando el filtro de búsqueda.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let Filashtml = '';
  Reservasmostradas.forEach(function(Res) {
    const Monto = Number(Res.montopagado || Res.montototal || 0);
    const Estado = Res.estado || 'Confirmada';
    const Esconfirmada = Estado === 'Confirmada';
    const Cedulatexto = Res.cedula ? Escaparhtml(Res.cedula) : '—';

    Filashtml += `
      <tr>
        <td><b>${Escaparhtml(Res.codigo || '—')}</b></td>
        <td><small style="color:var(--sand);">${Escaparhtml(Res.fecharegistro || Res.llegada || '—')}</small></td>
        <td><b>${Escaparhtml(Res.nombre || 'Viajero')}</b></td>
        <td><code>${Cedulatexto}</code></td>
        <td><span style="color:var(--sand);">Hab. ${Escaparhtml(String(Res.habitacion).padStart(2, '0'))}</span></td>
        <td><small>${Escaparhtml(Res.llegada)} → ${Escaparhtml(Res.salida)}</small></td>
        <td>${Res.noches || 1}</td>
        <td>${Res.huespedes || 2}</td>
        <td><small>${Escaparhtml(Res.entidadpago || Res.referenciapago || 'Efectivo')}</small></td>
        <td><b style="color:var(--cream);">$${Monto.toLocaleString('es-CO')}</b></td>
        <td>
          <span class="dash-badge ${Esconfirmada ? 'dash-badge--confirmada' : 'dash-badge--pendiente'}">
            ${Escaparhtml(Estado)}
          </span>
        </td>
      </tr>
    `;
  });

  Tablabody.innerHTML = Filashtml;
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

  // Inicializar configuracion de fechas y meses del dashboard
  Poblarselectormeses();
  const Hoycadena = new Date().toISOString().split('T')[0];
  const Inpinicio = document.getElementById('dashFechaInicio');
  const Inpfin = document.getElementById('dashFechaFin');
  if (Inpinicio) Inpinicio.value = Hoycadena;
  if (Inpfin) Inpfin.value = Hoycadena;

  // Conmutador de vistas Rack vs Dashboard
  const Tabrack = document.getElementById('btnTabRack');
  const Tabdash = document.getElementById('btnTabDashboard');
  if (Tabrack) {
    Tabrack.addEventListener('click', function() {
      Cambiarvistapanel('rack');
    });
  }
  if (Tabdash) {
    Tabdash.addEventListener('click', function() {
      Cambiarvistapanel('dashboard');
    });
  }

  // Filtros del Dashboard
  const BtnDiario = document.getElementById('btnFiltroDiario');
  const BtnSemanal = document.getElementById('btnFiltroSemanal');
  const BtnMensual = document.getElementById('btnFiltroMensual');
  const BtnPersonalizado = document.getElementById('btnFiltroPersonalizado');
  const Selectormes = document.getElementById('dashSelectMes');
  const BtnAplicarrango = document.getElementById('btnAplicarRango');
  const Inputbusqueda = document.getElementById('dashSearchInput');

  if (BtnDiario) {
    BtnDiario.addEventListener('click', function() {
      Cambiarfiltrodashboard('diario');
    });
  }
  if (BtnSemanal) {
    BtnSemanal.addEventListener('click', function() {
      Cambiarfiltrodashboard('semanal');
    });
  }
  if (BtnMensual) {
    BtnMensual.addEventListener('click', function() {
      Cambiarfiltrodashboard('mensual');
    });
  }
  if (Selectormes) {
    Selectormes.addEventListener('change', function() {
      Estadodashboard.messeleccionado = Selectormes.value;
      Cargardashboard();
    });
  }
  if (BtnPersonalizado) {
    BtnPersonalizado.addEventListener('click', function() {
      Cambiarfiltrodashboard('personalizado');
    });
  }
  if (BtnAplicarrango) {
    BtnAplicarrango.addEventListener('click', function() {
      Cargardashboard();
    });
  }
  if (Inputbusqueda) {
    Inputbusqueda.addEventListener('input', function(E) {
      Estadodashboard.terminobusqueda = E.target.value;
      Renderizartablamovimientos();
    });
  }

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
    Botonrefrescar.addEventListener('click', function() {
      Cargarhabitaciones();
      if (document.getElementById('seccionDashboard') && !document.getElementById('seccionDashboard').hidden) {
        Cargardashboard();
      }
    });
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
