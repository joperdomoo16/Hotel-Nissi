// Panel gerencial de recepción: filtros por período, indicadores y tabla de movimientos

const Estadodashboard = {
  filtroactivo: 'diario',
  messeleccionado: '',
  terminobusqueda: '',
  reservasperiodo: [],
  reservasreales: null
};

const Nombresmesescompletos = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function Crearnodo(Etiqueta, Clase, Texto) {
  const Nodo = document.createElement(Etiqueta);
  if (Clase) Nodo.className = Clase;
  if (Texto !== undefined && Texto !== null) Nodo.textContent = String(Texto);
  return Nodo;
}

function Cambiarvistapanel(Nuevavista) {
  const Seccionrack = document.getElementById('seccionRack');
  const Secciondash = document.getElementById('seccionDashboard');
  const Tabrack = document.getElementById('btnTabRack');
  const Tabdash = document.getElementById('btnTabDashboard');
  const Esdash = Nuevavista === 'dashboard';

  if (Seccionrack) Seccionrack.hidden = Esdash;
  if (Secciondash) Secciondash.hidden = !Esdash;
  if (Tabrack) { Tabrack.classList.toggle('is-active', !Esdash); Tabrack.setAttribute('aria-selected', Esdash ? 'false' : 'true'); }
  if (Tabdash) { Tabdash.classList.toggle('is-active', Esdash); Tabdash.setAttribute('aria-selected', Esdash ? 'true' : 'false'); }

  if (Esdash) Cargardashboard();
  else if (typeof Cargarhabitaciones === 'function') Cargarhabitaciones();
}

function Poblarselectormeses() {
  const Selector = document.getElementById('dashSelectMes');
  if (!Selector) return;

  const Ahora = new Date();
  Selector.textContent = '';

  for (let Indice = 0; Indice < 12; Indice++) {
    const Fecha = new Date(Ahora.getFullYear(), Ahora.getMonth() - Indice, 1);
    const Anio = Fecha.getFullYear();
    const Mes = String(Fecha.getMonth() + 1).padStart(2, '0');
    const Opcion = Crearnodo('option', '', `${Nombresmesescompletos[Fecha.getMonth()]} ${Anio}${Indice === 0 ? ' (Mes actual)' : ''}`);
    Opcion.value = `${Anio}-${Mes}`;
    Selector.appendChild(Opcion);
  }
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
    if (Botones[Clave]) Botones[Clave].classList.toggle('is-active', Clave === Nuevofiltro);
  });

  const Selectormes = document.getElementById('dashSelectMes');
  if (Selectormes) Selectormes.hidden = Nuevofiltro !== 'mensual';
  const Cajapersonalizada = document.getElementById('dashCustomRange');
  if (Cajapersonalizada) Cajapersonalizada.hidden = Nuevofiltro !== 'personalizado';
  Cargardashboard();
}

function Obtenerrangofechasfiltro() {
  const Ahora = new Date();
  let Fechainicio = '';
  let Fechafin = '';
  let Descripciontexto = '';

  if (Estadodashboard.filtroactivo === 'diario') {
    Fechainicio = Formatearfechalocal(Ahora);
    Fechafin = Fechainicio;
    Descripciontexto = `Período: Hoy (${Ahora.getDate()} de ${Nombresmesescompletos[Ahora.getMonth()]} de ${Ahora.getFullYear()})`;
  } else if (Estadodashboard.filtroactivo === 'semanal') {
    Fechainicio = Formatearfechalocal(new Date(Ahora.getTime() - 6 * 86400000));
    Fechafin = Formatearfechalocal(Ahora);
    Descripciontexto = `Período: Esta semana (${Fechainicio} al ${Fechafin})`;
  } else if (Estadodashboard.filtroactivo === 'mensual') {
    const Partes = (Estadodashboard.messeleccionado || Formatearfechalocal(Ahora).slice(0, 7)).split('-');
    const Anoelegido = parseInt(Partes[0], 10);
    const Meselegido = parseInt(Partes[1], 10) - 1;
    Fechainicio = Formatearfechalocal(new Date(Anoelegido, Meselegido, 1));
    Fechafin = Formatearfechalocal(new Date(Anoelegido, Meselegido + 1, 0));
    Descripciontexto = `Período: ${Nombresmesescompletos[Meselegido]} de ${Anoelegido}`;
  } else {
    const Inputinicio = document.getElementById('dashFechaInicio');
    const Inputfin = document.getElementById('dashFechaFin');
    Fechainicio = Inputinicio && Inputinicio.value ? Inputinicio.value : Formatearfechalocal(Ahora);
    Fechafin = Inputfin && Inputfin.value ? Inputfin.value : Formatearfechalocal(Ahora);
    if (Fechafin < Fechainicio) {
      Fechafin = Fechainicio;
      if (Inputfin) Inputfin.value = Fechafin;
    }
    Descripciontexto = `Período: Del ${Fechainicio} al ${Fechafin}`;
  }

  return { inicio: Fechainicio, fin: Fechafin, texto: Descripciontexto };
}

function Mostrarfilamensajetabla(Titulo, Detalle) {
  const Tablabody = document.getElementById('dashTableBody');
  if (!Tablabody) return;
  Tablabody.textContent = '';

  const Fila = Crearnodo('tr');
  const Celda = Crearnodo('td');
  Celda.colSpan = 11;
  const Caja = Crearnodo('div', 'dash-empty-state');
  Caja.appendChild(Crearnodo('b', '', Titulo));
  if (Detalle) {
    const Parrafo = Crearnodo('p', '', Detalle);
    Parrafo.style.margin = '4px 0 0';
    Parrafo.style.fontSize = '12px';
    Caja.appendChild(Parrafo);
  }
  Celda.appendChild(Caja);
  Fila.appendChild(Celda);
  Tablabody.appendChild(Fila);
}

function Cargardashboard() {
  if (!Estadorecepcion.tokensession) return;
  const Rango = Obtenerrangofechasfiltro();
  const Badgetexto = document.getElementById('dashRangoTexto');
  if (Badgetexto) Badgetexto.textContent = Rango.texto;

  if (!Estadodashboard.reservasreales) {
    Mostrarfilamensajetabla('Sincronizando reservas desde Google Sheets...', '');
  }

  Obtenerreservasservidor(Estadorecepcion.tokensession)
    .then(function(Respuesta) {
      if (Respuesta && Respuesta.noautorizado) {
        if (typeof Manejarsesionexpirada === 'function') Manejarsesionexpirada();
        return;
      }
      if (Respuesta && Array.isArray(Respuesta.reservas)) {
        Estadodashboard.reservasreales = Respuesta.reservas;
        Procesarydibujardashboard(Respuesta.reservas, Rango);
      } else {
        Procesarydibujardashboard(Estadodashboard.reservasreales || [], Rango);
      }
    })
    .catch(function() {
      Procesarydibujardashboard(Estadodashboard.reservasreales || [], Rango);
    });
}

function Dibujarbarrasmedios(Contenedormedios, Desglosemedios, Totalingresos) {
  Contenedormedios.textContent = '';
  const Coloresmedios = { Efectivo: '#55E482', Nequi: '#D6B889' };

  ['Efectivo', 'Nequi'].forEach(function(Medio) {
    const Montomedio = Desglosemedios[Medio] || 0;
    const Porcmedio = Totalingresos > 0 ? Math.round((Montomedio / Totalingresos) * 100) : 0;

    const Item = Crearnodo('div', 'dash-payment-item');
    const Fila = Crearnodo('div', 'dash-payment-row');
    const Resumen = Crearnodo('span', '', `$${Montomedio.toLocaleString('es-CO')} COP · `);
    Resumen.appendChild(Crearnodo('b', '', `${Porcmedio}%`));
    Fila.appendChild(Crearnodo('b', '', Medio));
    Fila.appendChild(Resumen);

    const Fondo = Crearnodo('div', 'dash-bar-bg');
    const Relleno = Crearnodo('div', 'dash-bar-fill');
    Relleno.style.width = `${Porcmedio}%`;
    Relleno.style.background = Coloresmedios[Medio];
    Fondo.appendChild(Relleno);

    Item.appendChild(Fila);
    Item.appendChild(Fondo);
    Contenedormedios.appendChild(Item);
  });
}

function Dibujarrendimientohabitaciones(Contenedorhabs, Desglosehabitaciones) {
  Contenedorhabs.textContent = '';

  Object.keys(Desglosehabitaciones).forEach(function(Num) {
    const Datos = Desglosehabitaciones[Num];
    const Fila = Crearnodo('div', 'dash-room-item');
    const Info = Crearnodo('div', 'dash-room-info');
    const Detalle = Crearnodo('div');
    const Titulo = Crearnodo('b', '', `Habitación ${Num}`);
    Titulo.style.cssText = 'display:block;font-size:13px;color:var(--cream);';
    const Tipo = Crearnodo('small', '', Datos.tipo);
    Tipo.style.cssText = 'color:var(--sand);font-size:11px;';
    Detalle.appendChild(Titulo);
    Detalle.appendChild(Tipo);
    Info.appendChild(Crearnodo('span', 'dash-room-num', Num));
    Info.appendChild(Detalle);

    const Stats = Crearnodo('div', 'dash-room-stats');
    Stats.appendChild(Crearnodo('b', '', `$${Datos.ingresos.toLocaleString('es-CO')} COP`));
    Stats.appendChild(Crearnodo('small', '', `${Datos.noches} noche${Datos.noches === 1 ? '' : 's'}`));

    Fila.appendChild(Info);
    Fila.appendChild(Stats);
    Contenedorhabs.appendChild(Fila);
  });
}

function Procesarydibujardashboard(Todaslasreservas, Rango) {
  const Reservasfiltradas = Todaslasreservas.filter(function(Reserva) {
    const Fechareg = String(Reserva.fecharegistro || Reserva.llegada || '').slice(0, 10);
    const Fechallegada = String(Reserva.llegada || '').slice(0, 10);
    const Estado = String(Reserva.estado || '');
    if (Estado === 'Vencida' || Estado === 'Rechazada' || Estado === 'Cancelada') return false;
    return (Fechareg >= Rango.inicio && Fechareg <= Rango.fin) || (Fechallegada >= Rango.inicio && Fechallegada <= Rango.fin);
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
    const Estado = String(Res.estado || '');
    if (Estado !== 'Confirmada' && Estado !== 'Finalizada') return;

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

  const Valoreskpi = {
    kpiIngresos: `$${Totalingresos.toLocaleString('es-CO')} COP`,
    kpiOcupacion: `${Porcentajeocupacion}%`,
    kpiNoches: `${Totalnoches} noche${Totalnoches === 1 ? '' : 's'}`,
    kpiHuespedes: `${Totalhuespedes} persona${Totalhuespedes === 1 ? '' : 's'}`,
    kpiCheckins: String(Totalcheckins),
    dashTotalMedios: `$${Totalingresos.toLocaleString('es-CO')} COP`
  };
  Object.keys(Valoreskpi).forEach(function(Id) {
    const Elemento = document.getElementById(Id);
    if (Elemento) Elemento.textContent = Valoreskpi[Id];
  });

  const Contenedormedios = document.getElementById('dashPaymentsList');
  if (Contenedormedios) Dibujarbarrasmedios(Contenedormedios, Desglosemedios, Totalingresos);
  const Contenedorhabs = document.getElementById('dashRoomsList');
  if (Contenedorhabs) Dibujarrendimientohabitaciones(Contenedorhabs, Desglosehabitaciones);
  Renderizartablamovimientos();
}

function Crearceldatablacontenido(Etiqueta, Texto, Estilocolor, Clase) {
  const Celda = Crearnodo('td');
  if (!Etiqueta) {
    Celda.textContent = String(Texto);
    return Celda;
  }
  const Nodo = Crearnodo(Etiqueta, Clase, Texto);
  if (Estilocolor) Nodo.style.color = Estilocolor;
  Celda.appendChild(Nodo);
  return Celda;
}

function Renderizartablamovimientos() {
  const Tablabody = document.getElementById('dashTableBody');
  const Totalindicador = document.getElementById('dashTotalRegistros');
  if (!Tablabody) return;

  const Termino = (Estadodashboard.terminobusqueda || '').toLowerCase().trim();
  const Reservasmostradas = Estadodashboard.reservasperiodo.filter(function(Res) {
    if (!Termino) return true;
    return [Res.nombre, Res.cedula, Res.codigo, Res.habitacion].some(function(Valor) {
      return String(Valor || '').toLowerCase().indexOf(Termino) !== -1;
    });
  });

  if (Totalindicador) Totalindicador.textContent = Reservasmostradas.length;

  if (Reservasmostradas.length === 0) {
    Mostrarfilamensajetabla(
      'No se encontraron reservas en este período',
      'Prueba seleccionando otro rango de fechas o limpiando el filtro de búsqueda.'
    );
    return;
  }

  Tablabody.textContent = '';
  Reservasmostradas.forEach(function(Res) {
    const Monto = Number(Res.montopagado || Res.montototal || 0);
    const Estado = String(Res.estado || 'Confirmada');
    const Clasebadge = Estado === 'Confirmada' ? 'dash-badge dash-badge--confirmada' : 'dash-badge dash-badge--pendiente';
    const Hab = String(Res.habitacion || '').padStart(2, '0');
    const Mediopago = String(Res.entidadpago || Res.referenciapago || 'Efectivo');

    const Fila = Crearnodo('tr');
    Fila.appendChild(Crearceldatablacontenido('b', Res.codigo || '—', '', ''));
    Fila.appendChild(Crearceldatablacontenido('small', Res.fecharegistro || Res.llegada || '—', 'var(--sand)', ''));
    Fila.appendChild(Crearceldatablacontenido('b', Res.nombre || 'Viajero', '', ''));
    Fila.appendChild(Crearceldatablacontenido('code', Res.cedula || '—', '', ''));
    Fila.appendChild(Crearceldatablacontenido('span', `Hab. ${Hab}`, 'var(--sand)', ''));
    Fila.appendChild(Crearceldatablacontenido('small', `${Res.llegada || ''} → ${Res.salida || ''}`, '', ''));
    Fila.appendChild(Crearceldatablacontenido('', Res.noches || 1, '', ''));
    Fila.appendChild(Crearceldatablacontenido('', Res.huespedes || 2, '', ''));
    Fila.appendChild(Crearceldatablacontenido('small', Mediopago, '', ''));
    Fila.appendChild(Crearceldatablacontenido('b', `$${Monto.toLocaleString('es-CO')}`, 'var(--cream)', ''));
    Fila.appendChild(Crearceldatablacontenido('span', Estado, '', Clasebadge));
    Tablabody.appendChild(Fila);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  Poblarselectormeses();
  const Hoycadena = Formatearfechalocal(new Date());
  ['dashFechaInicio', 'dashFechaFin'].forEach(function(Id) {
    const Campo = document.getElementById(Id);
    if (Campo) Campo.value = Hoycadena;
  });

  const Asignarclic = function(Id, Accion) {
    const Elemento = document.getElementById(Id);
    if (Elemento) Elemento.addEventListener('click', Accion);
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
    Inputbusqueda.addEventListener('input', function(Evento) {
      Estadodashboard.terminobusqueda = Evento.target.value;
      Renderizartablamovimientos();
    });
  }
});
