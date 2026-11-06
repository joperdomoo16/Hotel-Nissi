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
    const Cedulatexto = Res.cedula ? (typeof Escaparhtml === 'function' ? Escaparhtml(Res.cedula) : Res.cedula) : '—';
    const Codigo = typeof Escaparhtml === 'function' ? Escaparhtml(Res.codigo || '—') : (Res.codigo || '—');
    const Fechareg = typeof Escaparhtml === 'function' ? Escaparhtml(Res.fecharegistro || Res.llegada || '—') : (Res.fecharegistro || Res.llegada || '—');
    const Nombre = typeof Escaparhtml === 'function' ? Escaparhtml(Res.nombre || 'Viajero') : (Res.nombre || 'Viajero');
    const Hab = typeof Escaparhtml === 'function' ? Escaparhtml(String(Res.habitacion).padStart(2, '0')) : String(Res.habitacion).padStart(2, '0');
    const Llegada = typeof Escaparhtml === 'function' ? Escaparhtml(Res.llegada || '') : (Res.llegada || '');
    const Salida = typeof Escaparhtml === 'function' ? Escaparhtml(Res.salida || '') : (Res.salida || '');
    const Mediopago = typeof Escaparhtml === 'function' ? Escaparhtml(Res.entidadpago || Res.referenciapago || 'Efectivo') : (Res.entidadpago || Res.referenciapago || 'Efectivo');

    Filashtml += `
      <tr>
        <td><b>${Codigo}</b></td>
        <td><small style="color:var(--sand);">${Fechareg}</small></td>
        <td><b>${Nombre}</b></td>
        <td><code>${Cedulatexto}</code></td>
        <td><span style="color:var(--sand);">Hab. ${Hab}</span></td>
        <td><small>${Llegada} → ${Salida}</small></td>
        <td>${Res.noches || 1}</td>
        <td>${Res.huespedes || 2}</td>
        <td><small>${Mediopago}</small></td>
        <td><b style="color:var(--cream);">$${Monto.toLocaleString('es-CO')}</b></td>
        <td>
          <span class="dash-badge ${Esconfirmada ? 'dash-badge--confirmada' : 'dash-badge--pendiente'}">
            ${typeof Escaparhtml === 'function' ? Escaparhtml(Estado) : Estado}
          </span>
        </td>
      </tr>
    `;
  });

  Tablabody.innerHTML = Filashtml;
}

// Inicializacion de eventos para el panel de metricas gerenciales
document.addEventListener('DOMContentLoaded', function() {
  Poblarselectormeses();
  const Hoycadena = new Date().toISOString().split('T')[0];
  const Inpinicio = document.getElementById('dashFechaInicio');
  const Inpfin = document.getElementById('dashFechaFin');
  if (Inpinicio) Inpinicio.value = Hoycadena;
  if (Inpfin) Inpfin.value = Hoycadena;

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
});

