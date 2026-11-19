// Diseno empresarial de Google Sheets, reinicio limpio para produccion y consulta real para el Dashboard

function Obtenerreservasreales() {
  const Hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reservas');
  if (!Hoja || Hoja.getLastRow() < 2) { return { exito: true, reservas: [] }; }
  const Filas = Hoja.getDataRange().getValues().slice(1);
  const Lista = [];
  for (let I = Filas.length - 1; I >= 0; I--) {
    const F = Filas[I];
    const Codigo = String(F[0] || '').trim();
    if (!Codigo) { continue; }
    const Nombrecrudo = String(F[2] || '').trim();
    const Matchcc = Nombrecrudo.match(/^(.+?)\s*\(C\.C\.\s*([^)]+)\)$/i);
    const Nombre = Matchcc ? Matchcc[1].trim() : Nombrecrudo;
    const Cedula = Matchcc ? Matchcc[2].trim() : '';
    const Mediopago = String(F[17] || F[13] || 'Efectivo').trim();
    const Obs = String(F[22] || '').trim();
    const Montototal = Number(F[10] || 0);
    const Montopagado = Number(F[11] || 0);
    const Mixmatch = Obs.match(/\[Mixto Nequi:(\d+)\s+Efectivo:(\d+)/i);
    let Montonequi = 0, Montoefectivo = 0;
    if (Mixmatch) {
      Montonequi = Number(Mixmatch[1] || 0);
      Montoefectivo = Number(Mixmatch[2] || 0);
    } else if (/nequi/i.test(Mediopago) || /nequi/i.test(String(F[13] || ''))) {
      Montonequi = Montopagado || Montototal;
    } else if (/efectivo/i.test(Mediopago) || /efectivo/i.test(String(F[13] || ''))) {
      Montoefectivo = Montopagado || Montototal;
    }
    const Fechareg = F[1] instanceof Date ? Formatearfechahora(F[1]).slice(0, 16) : String(F[1] || '').trim();
    Lista.push({
      codigo: Codigo, fecharegistro: Fechareg, nombre: Nombre, cedula: Cedula,
      celular: String(F[3] || ''), habitacion: String(F[4] || '').padStart(2, '0'),
      llegada: Normalizarfecha(F[5]), salida: Normalizarfecha(F[6]),
      noches: Number(F[7] || 1), huespedes: Number(F[8] || 1), horallegada: String(F[9] || ''),
      montototal: Montototal, montopagado: Montopagado, montonequi: Montonequi, montoefectivo: Montoefectivo,
      referenciapago: String(F[12] || ''), entidadpago: Mediopago, estado: String(F[14] || ''),
      canal: String(F[15] || ''), observaciones: Obs
    });
  }
  return { exito: true, reservas: Lista };
}

function Definicionesdisenohojas() {
  return [
    { nombre: 'Reservas', color: '#4F5A2E', anchos: [100, 145, 220, 145, 95, 115, 115, 75, 95, 115, 120, 120, 140, 110, 125, 105, 145, 105, 125, 140, 145, 130, 290, 100, 120, 120], moneda: [11, 12, 19, 26], centro: [1, 2, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 21, 24, 25], ajuste: [23] },
    { nombre: 'Habitaciones', color: '#4F5A2E', anchos: [85, 200, 130, 145, 125, 130, 155, 225, 135, 300], moneda: [5], centro: [1, 3, 4, 6, 7, 9], ajuste: [2, 8, 10] },
    { nombre: 'Conversaciones', color: '#8C3B1F', anchos: [165, 185, 145, 120, 155, 155, 155, 145, 165, 220, 170, 220, 320], moneda: [], centro: [1, 3, 4, 5, 6, 7, 8, 9, 11], ajuste: [12, 13] },
    { nombre: 'Mensajescanal', color: '#8C3B1F', anchos: [260, 165, 120, 145, 165], moneda: [], centro: [2, 3, 4, 5], ajuste: [1] },
    { nombre: 'Pagosrecibidos', color: '#5A5C4E', anchos: [185, 155, 120, 125, 145, 185, 235, 95, 120], moneda: [4], centro: [2, 3, 5, 8, 9], ajuste: [7] },
    { nombre: 'Usuarios', color: '#1A1C13', anchos: [225, 200, 245, 120, 155, 110], moneda: [], centro: [4, 5, 6], ajuste: [] },
    { nombre: 'Configuracion', color: '#1A1C13', anchos: [255, 220, 440], moneda: [], centro: [], ajuste: [2, 3] },
    { nombre: 'Registro', color: '#5A5C4E', anchos: [160, 130, 175, 480], moneda: [], centro: [1, 2, 3], ajuste: [4] }
  ];
}

function Construirreglasestado(Hoja, Columna, Pares) {
  const Rango = Hoja.getRange(2, Columna, Math.max(Hoja.getMaxRows() - 1, 200), 1);
  return Pares.map(function(P) {
    const Constructor = SpreadsheetApp.newConditionalFormatRule().setRanges([Rango]).setBackground(P[1]).setFontColor(P[2]).setBold(true);
    return P[3] ? Constructor.whenTextContains(P[0]).build() : Constructor.whenTextEqualTo(P[0]).build();
  });
}

function Reglashoja(Hoja, Nombre) {
  if (Nombre === 'Habitaciones') {
    return Construirreglasestado(Hoja, 6, [['Disponible', '#E6F4EA', '#137333'], ['Ocupada', '#FCE8E6', '#A50E0E'], ['Apartada', '#FEF7E0', '#B06000'], ['Limpieza', '#E8F0FE', '#1967D2'], ['Mantenimiento', '#ECEFF1', '#455A64']]);
  }
  if (Nombre === 'Reservas') {
    return Construirreglasestado(Hoja, 15, [['Confirmada', '#E6F4EA', '#137333'], ['Apartada', '#FEF7E0', '#B06000'], ['Verificando', '#FEF7E0', '#B06000'], ['En canal', '#E8F0FE', '#1967D2'], ['Finalizada', '#EDF1E6', '#3E4A22'], ['Cancelada', '#FCE8E6', '#A50E0E'], ['Rechazada', '#FCE8E6', '#A50E0E'], ['Vencida', '#FCE8E6', '#A50E0E']]);
  }
  if (Nombre === 'Conversaciones') {
    return Construirreglasestado(Hoja, 3, [['IA', '#E6F4EA', '#137333'], ['PendienteAdmin', '#FEF7E0', '#B06000'], ['Canal', '#E8F0FE', '#1967D2'], ['PostCanal', '#F3E8FD', '#7627BB'], ['PendienteContacto', '#FDECE6', '#8C3B1F'], ['Finalizado', '#ECEFF1', '#455A64']]);
  }
  if (Nombre === 'Pagosrecibidos') {
    return Construirreglasestado(Hoja, 9, [['Libre', '#FEF7E0', '#B06000'], ['Usado', '#E6F4EA', '#137333'], ['Conciliado', '#E6F4EA', '#137333']]);
  }
  if (Nombre === 'Registro') {
    return Construirreglasestado(Hoja, 3, [['Error', '#FCE8E6', '#A50E0E', true], ['Timeout', '#FEF7E0', '#B06000', true]]);
  }
  return [];
}

// Aplica estilo corporativo uniforme a todas las pestanas de Google Sheets
function Aplicardisenoempresarialhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojauno = Libro.getSheetByName('Hoja 1');
  if (Hojauno && Libro.getSheets().length > 1 && Hojauno.getLastRow() <= 1 && Hojauno.getLastColumn() <= 1) {
    Libro.deleteSheet(Hojauno);
  }
  let Pos = 1;
  Definicionesdisenohojas().forEach(function(Def) {
    const Hoja = Libro.getSheetByName(Def.nombre);
    if (!Hoja) { return; }
    const Ncols = Math.max(Hoja.getLastColumn(), Def.anchos.length);
    const Filasvis = Math.max(Hoja.getLastRow(), Def.nombre === 'Habitaciones' ? 7 : 25);

    Hoja.setTabColor(Def.color);
    Hoja.setHiddenGridlines(true);
    Hoja.setFrozenRows(1);

    const Filtroprevio = Hoja.getFilter();
    if (Filtroprevio) { Filtroprevio.remove(); }
    Hoja.getRange(1, 1, Math.max(Hoja.getLastRow(), 2), Ncols).createFilter();

    Hoja.getBandings().forEach(function(B) { B.remove(); });
    Hoja.getRange(1, 1, Filasvis, Ncols).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
      .setHeaderRowColor('#1A1C13').setFirstRowColor('#FFFFFF').setSecondRowColor('#F7F4EC');

    const Encabezado = Hoja.getRange(1, 1, 1, Ncols);
    Encabezado.setBackground('#1A1C13').setFontColor('#F2EADB').setFontFamily('Roboto').setFontSize(10).setFontWeight('bold')
      .setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true);
    Hoja.setRowHeight(1, 36);

    const Cuerpo = Hoja.getRange(2, 1, Filasvis - 1, Ncols);
    Cuerpo.setFontFamily('Roboto').setFontSize(10).setFontColor('#1A1C13').setVerticalAlignment('middle')
      .setHorizontalAlignment('left').setWrap(false)
      .setBorder(true, true, true, true, true, true, '#D9CDB5', SpreadsheetApp.BorderStyle.SOLID);
    Hoja.setRowHeights(2, Filasvis - 1, 28);

    Def.anchos.forEach(function(Ancho, Idx) { Hoja.setColumnWidth(Idx + 1, Ancho); });
    Def.centro.forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setHorizontalAlignment('center'); } });
    Def.moneda.forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setNumberFormat('$#,##0').setHorizontalAlignment('right'); } });
    Def.ajuste.forEach(function(Col) { if (Col <= Ncols) { Hoja.getRange(2, Col, Filasvis - 1, 1).setWrap(true); } });

    Hoja.setConditionalFormatRules(Reglashoja(Hoja, Def.nombre));
    Libro.setActiveSheet(Hoja);
    Libro.moveActiveSheet(Pos++);
  });
}

// Limpia registros de prueba, restaura catalogo/configuracion, instala relojes y aplica diseno empresarial
function Reiniciarydisenarhojas() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  Inicializarhojas();
  ['Reservas', 'Conversaciones', 'Mensajescanal', 'Pagosrecibidos', 'Registro'].forEach(function(Nombre) {
    const H = Libro.getSheetByName(Nombre);
    if (H && H.getLastRow() > 1) { H.getRange(2, 1, H.getLastRow() - 1, H.getLastColumn()).clearContent(); }
  });
  const Hojahab = Libro.getSheetByName('Habitaciones');
  if (Hojahab) {
    if (Hojahab.getLastRow() > 1) { Hojahab.getRange(2, 1, Hojahab.getLastRow() - 1, Hojahab.getLastColumn()).clearContent(); }
    const Ahora = Formatearfechahora(new Date()).slice(0, 16);
    const Filashab = Catalogoreal.map(function(F) { return [F[0], F[1], F[2], F[3], F[4], F[5], Ahora, F[6], F[7], F[8]]; });
    Hojahab.getRange(2, 1, Filashab.length, 10).setValues(Filashab);
  }
  PropertiesService.getScriptProperties().deleteProperty('CANAL_ACTIVO_ADMIN');
  Programarrelojesautomaticos();
  Aplicardisenoempresarialhojas();
  Registrarbitacora('Sistema', 'Reiniciarydisenarhojas', 'Hojas reiniciadas, relojes activos y diseño corporativo aplicado.');
}
