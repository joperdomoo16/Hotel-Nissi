// Modulo de Dashboard, Filtros de Periodo y Metricas Gerenciales en Recepcion

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
    if (typeof Cargarhabitaciones === 'function') {
      Cargarhabitaciones();
    }
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
  if (Badgetexto) { Badgetexto.textContent = Rango.texto; }

  const Tablabody = document.getElementById('dashTableBody');
  if (Tablabody && !Estadodashboard.reservasreales) {
    Tablabody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--sand);">Sincronizando reservas reales desde Google Sheets...</td></tr>';
  }

  if (typeof Obtenerreservasservidor === 'function') {
    Obtenerreservasservidor()
      .then(function(Respuesta) {
        if (Respuesta && Array.isArray(Respuesta.reservas)) {
          Estadodashboard.reservasreales = Respuesta.reservas;
          Procesarydibujardashboard(Respuesta.reservas, Rango);
        } else {
          const Local = typeof Obtenerhistorialreservas === 'function' ? Obtenerhistorialreservas() : [];
          Procesarydibujardashboard(Local, Rango);
        }
      })
      .catch(function() {
        const Local = typeof Obtenerhistorialreservas === 'function' ? Obtenerhistorialreservas() : [];
        Procesarydibujardashboard(Local, Rango);
      });
  } else {
    const Local = typeof Obtenerhistorialreservas === 'function' ? Obtenerhistorialreservas() : [];
    Procesarydibujardashboard(Local, Rango);
  }
}

function Procesarydibujardashboard(Todaslasreservas, Rango) {
  const Reservasfiltradas = Todaslasreservas.filter(function(Reserva) {
    const Fechareg = String(Reserva.fecharegistro || Reserva.llegada || '').slice(0, 10);
    const Fechallegada = String(Reserva.llegada || '').slice(0, 10);
    const Est = String(Reserva.estado || '');
    if (Est === 'Vencida' || Est === 'Rechazada' || Est === 'Cancelada') { return false; }
    return (Fechareg >= Rango.inicio && Fechareg <= Rango.fin) ||
           (Fechallegada >= Rango.inicio && Fechallegada <= Rango.fin);
  });

  Estadodashboard.reservasperiodo = Reservasfiltradas;

  let Totalingresos = 0;
  let Totalnoches = 0;
  let Totalhuespedes = 0;
  let Totalcheckins = 0;
  const Desglosemedios = { Efectivo: 0, Nequi: 0 };
  const Desglosehabitaciones = {
    '01': { noches: 0, ingresos: 0, tipo: 'Triple · Queen + Sencilla' },
    '02': { noches: 0, ingresos: 0, tipo: 'Triple · Queen + Sencilla' },
    '03': { noches: 0, ingresos: 0, tipo: 'En rediseño' },
    '04': { noches: 0, ingresos: 0, tipo: 'Doble' },
    '05': { noches: 0, ingresos: 0, tipo: 'Doble' },
    '06': { noches: 0, ingresos: 0, tipo: 'Triple · Doble + Sencilla' }
  };

  Reservasfiltradas.forEach(function(Res) {
    const Est = String(Res.estado || '');
    const Valida = Est === 'Confirmada' || Est === 'Finalizada';
    if (!Valida) { return; }

    Totalcheckins++;
    const Monto = Number(Res.montopagado || Res.montototal || 0);
    const Noches = Number(Res.noches || 1);
    const Huespedes = Number(Res.huespedes || 1);
    const Hab = String(Res.habitacion || '01').padStart(2, '0');
    const Mediopago = String(Res.entidadpago || Res.referenciapago || 'Efectivo');

    Totalingresos += Monto;
    Totalnoches += Noches;
    Totalhuespedes += Huespedes;

    const Mnequi = Number(Res.montonequi || 0);
    const Mefec = Number(Res.montoefectivo || 0);
    if (Mnequi > 0 || Mefec > 0) {
      Desglosemedios.Nequi += Mnequi;
      Desglosemedios.Efectivo += Mefec;
    } else if (/nequi/i.test(Mediopago)) {
      Desglosemedios.Nequi += Monto;
    } else {
      Desglosemedios.Efectivo += Monto;
    }

    if (Desglosehabitaciones[Hab]) {
      Desglosehabitaciones[Hab].noches += Noches;
      Desglosehabitaciones[Hab].ingresos += Monto;
    }
  });

  const Diasrango = Math.max(1, Math.round((new Date(Rango.fin) - new Date(Rango.inicio)) / 86400000) + 1);
  const Porcentajeocupacion = Math.min(100, Math.round((Totalnoches / (Diasrango * 5)) * 1000) / 10);

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
    const Coloresmedios = { Efectivo: '#55E482', Nequi: '#E040FB' };
    Contenedormedios.innerHTML = ['Efectivo', 'Nequi'].map(function(Medio) {
      const Montomedio = Desglosemedios[Medio] || 0;
      const Porcmedio = Totalingresos > 0 ? Math.round((Montomedio / Totalingresos) * 100) : 0;
      return `<div class="dash-payment-item"><div class="dash-payment-row"><b>${Medio}</b><span>$${Montomedio.toLocaleString('es-CO')} COP · <b>${Porcmedio}%</b></span></div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Porcmedio}%;background:${Coloresmedios[Medio]};"></div></div></div>`;
    }).join('');
  }

  const Contenedorhabs = document.getElementById('dashRoomsList');
  if (Contenedorhabs) {
    Contenedorhabs.innerHTML = Object.keys(Desglosehabitaciones).map(function(Num) {
      const Item = Desglosehabitaciones[Num];
      return `<div class="dash-room-item"><div class="dash-room-info"><span class="dash-room-num">${Num}</span><div><b style="display:block;font-size:13px;color:var(--cream);">Habitación ${Num}</b><small style="color:var(--sand);font-size:11px;">${Item.tipo}</small></div></div><div class="dash-room-stats"><b>$${Item.ingresos.toLocaleString('es-CO')} COP</b><small>${Item.noches} noche${Item.noches === 1 ? '' : 's'}</small></div></div>`;
    }).join('');
  }

  Renderizartablamovimientos();
}

function Escaparcampo(Valor) {
  return typeof Escaparhtml === 'function' ? Escaparhtml(Valor) : Valor;
}

function Renderizartablamovimientos() {
  const Tablabody = document.getElementById('dashTableBody');
  const Totalindicador = document.getElementById('dashTotalRegistros');
  if (!Tablabody) return;

  const Termino = (Estadodashboard.terminobusqueda || '').toLowerCase().trim();
  const Reservasmostradas = Estadodashboard.reservasperiodo.filter(function(Res) {
    if (!Termino) return true;
    return [Res.nombre, Res.cedula, Res.codigo, Res.habitacion].some(function(V) {
      return String(V || '').toLowerCase().indexOf(Termino) !== -1;
    });
  });

  if (Totalindicador) Totalindicador.textContent = Reservasmostradas.length;

  if (Reservasmostradas.length === 0) {
    Tablabody.innerHTML = `<tr><td colspan="11"><div class="dash-empty-state"><b>No se encontraron reservas reales en este período</b><p style="margin:4px 0 0;font-size:12px;">Prueba seleccionando otro rango de fechas o limpiando el filtro de búsqueda.</p></div></td></tr>`;
    return;
  }

  Tablabody.innerHTML = Reservasmostradas.map(function(Res) {
    const Monto = Number(Res.montopagado || Res.montototal || 0);
    const Estado = Res.estado || 'Confirmada';
    const Clasebadge = Estado === 'Confirmada' ? 'dash-badge--confirmada' : 'dash-badge--pendiente';
    const Hab = Escaparcampo(String(Res.habitacion).padStart(2, '0'));
    const Mediopago = Escaparcampo(Res.entidadpago || Res.referenciapago || 'Efectivo');
    return `<tr>
      <td><b>${Escaparcampo(Res.codigo || '—')}</b></td>
      <td><small style="color:var(--sand);">${Escaparcampo(Res.fecharegistro || Res.llegada || '—')}</small></td>
      <td><b>${Escaparcampo(Res.nombre || 'Viajero')}</b></td>
      <td><code>${Res.cedula ? Escaparcampo(Res.cedula) : '—'}</code></td>
      <td><span style="color:var(--sand);">Hab. ${Hab}</span></td>
      <td><small>${Escaparcampo(Res.llegada || '')} → ${Escaparcampo(Res.salida || '')}</small></td>
      <td>${Res.noches || 1}</td>
      <td>${Res.huespedes || 2}</td>
      <td><small>${Mediopago}</small></td>
      <td><b style="color:var(--cream);">$${Monto.toLocaleString('es-CO')}</b></td>
      <td><span class="dash-badge ${Clasebadge}">${Escaparcampo(Estado)}</span></td>
    </tr>`;
  }).join('');
}

// Inicializacion de eventos para el panel de metricas gerenciales
document.addEventListener('DOMContentLoaded', function() {
  Poblarselectormeses();
  const Hoycadena = new Date().toISOString().split('T')[0];
  ['dashFechaInicio', 'dashFechaFin'].forEach(function(Id) {
    const El = document.getElementById(Id);
    if (El) El.value = Hoycadena;
  });

  const Asignarclic = function(Id, Fn) {
    const El = document.getElementById(Id);
    if (El) El.addEventListener('click', Fn);
  };
  Asignarclic('btnTabRack', function() { Cambiarvistapanel('rack'); });
  Asignarclic('btnTabDashboard', function() { Cambiarvistapanel('dashboard'); });
  Asignarclic('btnFiltroDiario', function() { Cambiarfiltrodashboard('diario'); });
  Asignarclic('btnFiltroSemanal', function() { Cambiarfiltrodashboard('semanal'); });
  Asignarclic('btnFiltroMensual', function() { Cambiarfiltrodashboard('mensual'); });
  Asignarclic('btnFiltroPersonalizado', function() { Cambiarfiltrodashboard('personalizado'); });
  Asignarclic('btnAplicarRango', function() { Cargardashboard(); });

  const Selectormes = document.getElementById('dashSelectMes');
  if (Selectormes) {
    Selectormes.addEventListener('change', function() {
      Estadodashboard.messeleccionado = Selectormes.value;
      Cargardashboard();
    });
  }
  const Inputbusqueda = document.getElementById('dashSearchInput');
  if (Inputbusqueda) {
    Inputbusqueda.addEventListener('input', function(E) {
      Estadodashboard.terminobusqueda = E.target.value;
      Renderizartablamovimientos();
    });
  }
});

