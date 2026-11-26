// Servidor en Google Apps Script para Hospedaje Nissi: Base de Datos Google Sheets, Apartados e Inventario

const Parametrosistema = {
  modeloia: 'gemini-3.5-flash-lite',
  urlgemini: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  versionapi: '2026-05-20',
  horacheckout: 11,
  horainformediario: 19,
  zonahoraria: 'America/Bogota'
};

function Sanitizarcelda(Valor, Maximo) {
  let Limpio = String(Valor == null ? '' : Valor).replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, Maximo || 120);
  return /^[=+\-@]/.test(Limpio) ? "'" + Limpio : Limpio;
}

function Normalizaridwhatsapp(Valor) {
  const Crudo = String(Valor == null ? '' : Valor).trim();
  if (!Crudo) { return ''; }
  return /[A-Za-z]/.test(Crudo) ? Crudo : Crudo.replace(/\D/g, '');
}

function Escaparhtmlservidor(Texto) {
  return String(Texto == null ? '' : Texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function Formatearfechahora(Fecha) {
  return Utilities.formatDate(Fecha || new Date(), Parametrosistema.zonahoraria, 'yyyy-MM-dd HH:mm:ss');
}

function Obtenercredenciales() {
  const Propiedades = PropertiesService.getScriptProperties().getProperties();
  const Confighoja = Leerconfiguracionhoja();
  let Adminlimpio = String(Confighoja.CELULARADMIN || Propiedades.CELULARADMIN || '573123639298').replace(/\D/g, '');
  if (Adminlimpio.length === 10 && Adminlimpio.indexOf('3') === 0) { Adminlimpio = '57' + Adminlimpio; }
  return {
    clavegemini: String(Propiedades.CLAVEGEMINI || '').trim(),
    tokenwhatsapp: String(Propiedades.TOKENWHATSAPP || '').trim(),
    idtelefonowhatsapp: String(Propiedades.IDTELEFONOWHATSAPP || '').trim(),
    tokenverificacion: String(Propiedades.TOKENVERIFICACION || '').trim(),
    llavewebhook: String(Propiedades.LLAVEWEBHOOK || '').trim(),
    celularadmin: Adminlimpio,
    correoadmin: Propiedades.CORREOADMIN || Session.getActiveUser().getEmail(),
    clavefirebase: String(Propiedades.CLAVEFIREBASE || '').trim()
  };
}

function Leerconfiguracionhoja() {
  const Mapa = {
    PAGOMINIMOPORCENTAJE: 100, MINUTOSAPARTADO: 30, MINUTOSESPERACORREO: 20,
    MINUTOSRECORDATORIOCLIENTE: 2, MINUTOSESPERAADMIN: 15, MINUTOSRECORDATORIOCANAL: 5,
    MINUTOSINACTIVIDADCANAL: 15, MINUTOSCIERREPOSTCANAL: 15, MINUTOSAVISOCANAL: 15,
    MINUTOSCIERREAUTO: 120, CELULARADMIN: '573123639298', MODOSOMBRA: 'NO',
    TARIFA1PERSONA: 55000, TARIFA2PERSONASCAMACOMPARTIDA: 70000, TARIFA2PERSONASCAMASSEPARADAS: 90000,
    TARIFA3PERSONAS: 110000, VALORHORAADICIONAL: 10000, HORACHECKOUT: 11, MINUTOSRECORDATORIOLIMPIEZA: 20,
    CUENTANEQUI: 'Nequi: 3123639298',
    REMITENTESBANCOS: 'nequi.com.co,nequi.com,notificacionesnequi.com,bancolombia.com.co,notificacionesbancolombia.com'
  };
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hoja = Libro && Libro.getSheetByName('Configuracion');
    if (!Hoja || Hoja.getLastRow() < 2) { return Mapa; }
    Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 2).getValues().forEach(function(Fila) {
      const Clave = String(Fila[0] || '').trim().toUpperCase();
      const Valor = String(Fila[1] == null ? '' : Fila[1]).trim();
      if (Clave && Valor !== '') {
        Mapa[Clave] = isNaN(Number(Valor)) || Clave === 'CELULARADMIN' ? Valor : Number(Valor);
      }
    });
  } catch (Errorconfig) {}
  return Mapa;
}

function Registrarbitacora(Modulo, Accion, Detalle) {
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    let Hoja = Libro.getSheetByName('Registro');
    if (!Hoja) {
      Hoja = Libro.insertSheet('Registro');
      Hoja.appendRow(['Fechahora', 'Modulo', 'Accion', 'Detalle']);
    }
    Hoja.appendRow([
      Formatearfechahora(new Date()), Sanitizarcelda(Modulo, 40), Sanitizarcelda(Accion, 80),
      Sanitizarcelda(typeof Detalle === 'string' ? Detalle : JSON.stringify(Detalle), 500)
    ]);
  } catch (Errorbitacora) {}
}

function Programarrelojesautomaticos() {
  ScriptApp.getProjectTriggers().forEach(function(Disparador) { ScriptApp.deleteTrigger(Disparador); });
  ScriptApp.newTrigger('Revisarcanales').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('Revisarapartados').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('Leercorreospago').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('Liberarhabitacionesvencidas').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Enviarrecordatoriocheckout').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('Enviarinformecorreodiario').timeBased().everyDays(1).atHour(Parametrosistema.horainformediario).create();
}

function Reservaestabloqueando(Filareserva, Ahorams) {
  const Estado = String(Filareserva[15] || '').trim();
  if (Estado === 'Confirmada' || Estado === 'Verificando' || Estado === 'En canal') { return true; }
  if (Estado === 'Apartada') {
    if (!Filareserva[17]) { return true; }
    const Vencems = new Date(Filareserva[17]).getTime();
    return isNaN(Vencems) || Vencems > (Ahorams || Date.now());
  }
  return false;
}

function Consultardisponibilidad(Fechallegada, Fechasalida, Cantidadhuespedes, Camasseparadas) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Obtenerhojareservas();

  const Filashabitaciones = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasreservas = Hojareservas.getDataRange().getValues().slice(1);

  const Llegadasolicitada = Fechallegada ? new Date(Fechallegada) : null;
  const Salidasolicitada = Fechasalida ? new Date(Fechasalida) : null;
  const Huespedesminimos = parseInt(Cantidadhuespedes || 1, 10);
  if (Huespedesminimos > 3) {
    return { fechallegada: Fechallegada || 'hoy', fechasalida: Fechasalida || 'por definir', requiereadmin: true, disponibles: [], todas: [], mensaje: 'Grupos de más de 3 personas requieren atención directa de un administrador.' };
  }

  const Ahorams = Date.now();
  const Habitacionesocupadasenrango = {};
  const Habitacionesenproceso = {};

  Filasreservas.forEach(function(Filareserva) {
    if (Reservaestabloqueando(Filareserva, Ahorams)) {
      const Numerohab = String(Filareserva[5]).padStart(2, '0');
      const Estado = String(Filareserva[15] || '').trim();
      if (Estado === 'Apartada' || Estado === 'Verificando' || Estado === 'En canal') {
        Habitacionesenproceso[Numerohab] = Estado;
      }
      if (Llegadasolicitada && Salidasolicitada) {
        const Llegadaexistente = new Date(Filareserva[6]);
        const Salidaexistente = new Date(Filareserva[7]);
        if (Llegadasolicitada < Salidaexistente && Salidasolicitada > Llegadaexistente) {
          Habitacionesocupadasenrango[Numerohab] = Estado;
        }
      }
    }
  });

  const Config = Leerconfiguracionhoja();
  const Listadodisponibles = [];
  const Listadogeneral = [];

  Filashabitaciones.forEach(function(Filahab) {
    const Numerohab = String(Filahab[0]).padStart(2, '0');
    const Tipohab = String(Filahab[1]);
    const Capacidadtexto = String(Filahab[2]);
    const Maxhuespedes = parseInt(Filahab[3], 10);
    const Estadopestana = String(Filahab[5]);
    const Camastexto = String(Filahab[7] || '');
    const Comodidades = String(Filahab[9] || 'Aire acondicionado, Wi-Fi, TV, parqueadero');
    const Enmantenimiento = Numerohab === '03' || Estadopestana === 'Mantenimiento';
    const Enlimpieza = !Enmantenimiento && (Estadopestana === 'Limpieza' || Estadopestana === 'Pendiente de limpieza');

    const Estadorango = Habitacionesocupadasenrango[Numerohab] || '';
    const Estadoproceso = Habitacionesenproceso[Numerohab] || '';
    const Ocupadahoy = !Llegadasolicitada && Estadopestana === 'Ocupada';
    const Ocupadaconfirmada = Ocupadahoy || Estadorango === 'Confirmada';
    const Enapartado = !Enmantenimiento && !Enlimpieza && !Ocupadaconfirmada && Boolean(Estadoproceso || (Estadorango && Estadorango !== 'Confirmada'));
    const Disponible = !Enmantenimiento && !Enlimpieza && !Ocupadaconfirmada && !Enapartado && Maxhuespedes >= Huespedesminimos;
    const Estadomostrar = Enmantenimiento ? 'Mantenimiento' : (Enlimpieza ? 'Limpieza' : (Ocupadaconfirmada ? 'Ocupada' : (Enapartado ? 'Apartada' : 'Disponible')));

    const Tarifaobj = Calculartarifanoche(Huespedesminimos, Camasseparadas, Numerohab);
    const Objetoestado = {
      numero: Numerohab, tipo: Tipohab, capacidad: Capacidadtexto, huespedesmaximos: Maxhuespedes,
      camas: Camastexto, comodidades: Comodidades, admitecamasseparadas: Habitacionadmitecamasseparadas(Numerohab),
      tarifanoche: Tarifaobj.tarifanoche || Number(Config.TARIFA1PERSONA || 55000),
      tarifacamacompartida: Number(Config.TARIFA2PERSONASCAMACOMPARTIDA || 70000),
      tarifacamasseparadas: Number(Config.TARIFA2PERSONASCAMASSEPARADAS || 90000),
      estadoactual: Estadomostrar, disponible: Disponible
    };
    Listadogeneral.push(Objetoestado);
    if (Disponible) { Listadodisponibles.push(Objetoestado); }
  });

  return { fechallegada: Fechallegada || 'hoy', fechasalida: Fechasalida || 'por definir', disponibles: Listadodisponibles, todas: Listadogeneral };
}

function Apartarhabitacion(Celularcliente, Numerohabitacion, Fechallegada, Fechasalida, Cantidadhuespedes, Canalorigen, Camasseparadas) {
  const Candado = LockService.getScriptLock();
  Candado.waitLock(10000);
  try {
    const Libro = SpreadsheetApp.getActiveSpreadsheet();
    const Hojareservas = Obtenerhojareservas();
    const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
    const Config = Leerconfiguracionhoja();
    const Numerohab = String(Numerohabitacion || '01').padStart(2, '0');
    const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
    const Personas = parseInt(Cantidadhuespedes || 1, 10);

    if (Personas > 3) {
      return { exito: false, requiereadmin: true, mensaje: 'Para más de 3 personas se requiere atención directa de un administrador.' };
    }
    if (Celularlimpio) { Liberarapartadosprevioscliente(Hojareservas, Hojahabitaciones, Celularlimpio); }

    const Disponibilidad = Consultardisponibilidad(Fechallegada, Fechasalida, Personas, Camasseparadas);
    const Hablibre = Disponibilidad.disponibles.find(function(H) { return H.numero === Numerohab; });
    if (!Hablibre) {
      const Habestado = Disponibilidad.todas.find(function(H) { return H.numero === Numerohab; });
      const Otras = Disponibilidad.disponibles.map(function(H) { return H.numero; });
      if (Habestado && Habestado.estadoactual === 'Apartada') {
        return {
          exito: false, enproceso: true, habitacion: Numerohab, otrasdisponibles: Otras,
          mensajecliente: '¡Qué pena contigo! Acabo de revisar en tiempo real y justo hace un momento otro huésped inició el proceso para reservar esta misma habitación, aunque todavía no la ha confirmado.\n\nSi quieres, podemos esperar unos minutos: si no concreta el pago, te la aparto de una vez y te aviso. O si prefieres no esperar, podemos revisar otra habitación disponible ahora mismo. ¿Cómo te gustaría que sigamos?'
        };
      }
      return { exito: false, enproceso: false, otrasdisponibles: Otras, mensaje: `La habitación ${Numerohab} ya no está disponible para esas fechas.` };
    }

    const Estadoconv = (typeof Obtenerestadoconversacion === 'function' && Celularlimpio) ? Obtenerestadoconversacion(Celularlimpio) : null;
    const Nombreprevio = (Estadoconv && Estadoconv.nombre && !/^(cliente|viajero|por confirmar)$/i.test(Estadoconv.nombre)) ? Estadoconv.nombre.trim() : '';
    const Celularvisible = Normalizarcelularcolombiano(Celularlimpio) || (Estadoconv && Normalizarcelularcolombiano(Estadoconv.telefonocontacto)) || 'Por confirmar';

    const Calculo = Calculartarifanoche(Personas, Camasseparadas, Numerohab);
    const Noches = Math.max(1, Math.round((new Date(Fechasalida) - new Date(Fechallegada)) / 86400000));
    const Montototal = Noches * Calculo.tarifanoche;
    const Codigo = Generarcodigoreservaservidor();
    const Ahora = new Date();
    const Vence = new Date(Ahora.getTime() + Number(Config.MINUTOSAPARTADO || 30) * 60000);
    const Horasalidadefault = `${String(Number(Config.HORACHECKOUT || 11)).padStart(2, '0')}:00`;
    const Numfila = Hojareservas.getLastRow() + 1;

    Hojareservas.appendRow([
      Codigo, Formatearfechahora(Ahora).slice(0, 16), Sanitizarcelda(Nombreprevio || 'Por confirmar', 80), '',
      Celularvisible, Numerohab, Sanitizarcelda(Fechallegada, 15), Sanitizarcelda(Fechasalida, 15), Noches,
      Personas, 'Por confirmar', Montototal, 0, '', '', 'Apartada',
      Sanitizarcelda(Canalorigen || 'WhatsApp', 20), Formatearfechahora(Vence), '', '', '', '', '',
      Sanitizarcelda(Calculo.detallecamas, 100), Horasalidadefault, 0, 0, Sanitizarcelda(Celularlimpio, 60)
    ]);
    Hojareservas.getRange(Numfila, 4, 1, 3).setNumberFormat('@');
    Hojareservas.getRange(Numfila, 5).setValue(Celularvisible);
    Hojareservas.getRange(Numfila, 6).setValue(Numerohab);

    Cambiarocupacionhabitacion(Hojahabitaciones, Numerohab, 'Apartada');
    if (typeof Actualizarconversacion === 'function' && Celularlimpio) {
      Actualizarconversacion(Celularlimpio, { codigoreserva: Codigo });
    }
    Registrarbitacora('Apartados', 'Apartarhabitacion', `Hab ${Numerohab} apartada (${Codigo}) · ${Calculo.detallecamas} · $${Montototal}`);

    return {
      exito: true, codigo: Codigo, habitacion: Numerohab, tipo: Hablibre.tipo, noches: Noches,
      tarifanoche: Calculo.tarifanoche, detallecamas: Calculo.detallecamas, montototal: Montototal,
      nombreactual: Nombreprevio, tieneapellido: Tieneapellidonombre(Nombreprevio),
      celularregistrado: Celularvisible !== 'Por confirmar' ? Celularvisible : '',
      minutosapartado: Number(Config.MINUTOSAPARTADO || 30), venceapartado: Formatearfechahora(Vence)
    };
  } finally {
    Candado.releaseLock();
  }
}

function Liberarapartadosprevioscliente(Hojareservas, Hojahabitaciones, Celularlimpio) {
  const Filas = Hojareservas.getDataRange().getValues();
  for (let I = 1; I < Filas.length; I++) {
    if (Coincidereservacliente(Filas[I], '', Celularlimpio) && String(Filas[I][15] || '') === 'Apartada') {
      Hojareservas.getRange(I + 1, 16).setValue('Vencida');
      Hojareservas.getRange(I + 1, 24).setValue('Liberada por cambio de habitación');
      if (Hojahabitaciones) { Cambiarocupacionhabitacion(Hojahabitaciones, Filas[I][5], 'Disponible'); }
    }
  }
}

function Liberarapartado(Celularcliente, Codigoreserva, Motivo) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Obtenerhojareservas();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  for (let I = Filas.length - 1; I >= 1; I--) {
    const Est = String(Filas[I][15]);
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && (Est === 'Apartada' || Est === 'Confirmada' || Est === 'En canal')) {
      const Nuevoest = Est === 'Confirmada' ? 'Cancelada' : 'Vencida';
      Hojareservas.getRange(I + 1, 16).setValue(Nuevoest);
      Hojareservas.getRange(I + 1, 24).setValue(Sanitizarcelda(Motivo || 'Cancelada por el cliente', 120));
      if (Hojahabitaciones) { Cambiarocupacionhabitacion(Hojahabitaciones, Filas[I][5], 'Disponible'); }
      if (Est === 'Confirmada' && typeof Enviarmensajeinteligente === 'function') {
        Enviarmensajeinteligente(Obtenercredenciales().celularadmin, `Reserva cancelada por el cliente · ${Filas[I][0]} (Hab. ${String(Filas[I][5]).padStart(2, '0')} · ${Filas[I][2]}). Motivo: ${Motivo || 'Solicitado en chat'}.`, '', []);
      }
      Registrarbitacora('Apartados', 'Liberarapartado', `Reserva ${Filas[I][0]} -> ${Nuevoest}`);
      if (typeof Notificaresperahabitacion === 'function') { Notificaresperahabitacion(Filas[I][5]); }
      return { exito: true, codigo: Filas[I][0], estado: Nuevoest, mensaje: `Reserva ${Nuevoest.toLowerCase()} correctamente.` };
    }
  }
  return { exito: false, mensaje: 'No se encontró una reserva activa para cancelar o liberar.' };
}

function Restaurarencanalpendiente(Celularcliente, Codigoreserva) {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Hojareservas = Obtenerhojareservas();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Ahorams = Date.now();
  for (let I = Filas.length - 1; I >= 1; I--) {
    if (!Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) || String(Filas[I][15]) !== 'En canal') { continue; }
    const Numhab = String(Filas[I][5] || '').padStart(2, '0');
    const Tienecomprobante = Number(Filas[I][19] || 0) > 0 || Boolean(String(Filas[I][20] || '').trim());
    if (Tienecomprobante) { return { estadofinal: 'En canal', habitacion: Numhab }; }
    const Vencems = Filas[I][17] ? new Date(Filas[I][17]).getTime() : 0;
    const Expirada = Boolean(Vencems && !isNaN(Vencems) && Ahorams > Vencems);
    const Nuevoest = Expirada ? 'Vencida' : 'Apartada';
    const Obsactual = String(Filas[I][23] || '').replace(/\s*·?\s*En canal\s*\([^)]*\)/gi, '').trim();
    const Nota = Expirada ? 'Vencida tras espera de administrador sin pago' : 'Devuelta a apartado temporal tras espera';
    Hojareservas.getRange(I + 1, 16).setValue(Nuevoest);
    Hojareservas.getRange(I + 1, 24).setValue(Sanitizarcelda(Obsactual ? `${Obsactual} · ${Nota}` : Nota, 140));
    const Bloqueada = Filas.some(function(R, Idx) { return Idx > 0 && Idx !== I && String(R[5]).padStart(2, '0') === Numhab && Reservaestabloqueando(R, Ahorams); });
    if (Hojahabitaciones && !Bloqueada) { Cambiarocupacionhabitacion(Hojahabitaciones, Numhab, Expirada ? 'Disponible' : 'Apartada'); }
    return { estadofinal: Nuevoest, habitacion: Numhab };
  }
  return { estadofinal: '', habitacion: '' };
}

function Cambiarocupacionhabitacion(Hojahabitaciones, Numerohabitacion, Nuevoestado) {
  const Num = String(Numerohabitacion).padStart(2, '0');
  if (Num === '03' && Nuevoestado !== 'Mantenimiento') { return; }
  const Datos = Hojahabitaciones.getDataRange().getValues();
  const Ahora = Formatearfechahora(new Date()).slice(0, 16);
  for (let Indice = 1; Indice < Datos.length; Indice++) {
    if (String(Datos[Indice][0]).padStart(2, '0') === Num) {
      Hojahabitaciones.getRange(Indice + 1, 6).setValue(Nuevoestado);
      Hojahabitaciones.getRange(Indice + 1, 7).setValue(Ahora);
      break;
    }
  }
}

function Guardardatoshuesped(Celularcliente, Codigoreserva, Nombre, Cedula, Horallegada, Celularcontacto, Parqueadero) {
  const Hojareservas = Obtenerhojareservas();
  const Filas = Hojareservas.getDataRange().getValues();
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Estadoconv = (typeof Obtenerestadoconversacion === 'function' && Celularlimpio) ? Obtenerestadoconversacion(Celularlimpio) : null;

  const Cedulavalida = Normalizarcedulacolombiana(Cedula);
  if (!Cedulavalida) {
    return {
      exito: false,
      errorcampo: 'cedula',
      mensaje: 'El número de cédula no es válido en Colombia. Debe contener solo números: entre 6 y 8 dígitos (cédulas antiguas) o exactamente 10 dígitos iniciando por 1 (cédulas NUIP). Pídele amablemente al huésped verificar su cédula.'
    };
  }

  const Contactodigitado = String(Celularcontacto || '').trim();
  const Celularvalidado = Contactodigitado ? Normalizarcelularcolombiano(Contactodigitado) : '';
  if (Contactodigitado && !Celularvalidado) {
    return {
      exito: false,
      errorcampo: 'celular',
      mensaje: 'El número de celular no es válido en Colombia. Debe tener exactamente 10 dígitos y comenzar por 3 (rango 300 a 399, por ejemplo 3001234567). Pídele amablemente al huésped verificar su celular.'
    };
  }

  for (let I = Filas.length - 1; I >= 1; I--) {
    const Estado = String(Filas[I][15]);
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && (Estado === 'Apartada' || Estado === 'Verificando' || Estado === 'En canal')) {
      const Nombrefinal = Combinarnombreyapellido(Estadoconv ? Estadoconv.nombre : Filas[I][2], Nombre);
      if (!Tieneapellidonombre(Nombrefinal)) {
        return {
          exito: false,
          errorcampo: 'apellido',
          mensaje: `Solo tenemos el primer nombre ("${Nombrefinal || 'huésped'}"). Pídele únicamente su apellido para completar el registro.`
        };
      }
      const Celularfinal = Celularvalidado || Normalizarcelularcolombiano(Filas[I][4]) || Normalizarcelularcolombiano(Celularlimpio) || (Estadoconv && Normalizarcelularcolombiano(Estadoconv.telefonocontacto)) || '';
      if (!Celularfinal) {
        return {
          exito: false,
          errorcampo: 'celular',
          mensaje: 'Falta el número de celular colombiano de 10 dígitos del huésped (su WhatsApp envía un identificador oculto). Pídele su número de celular de 10 dígitos iniciando en 3.'
        };
      }

      Hojareservas.getRange(I + 1, 4, 1, 2).setNumberFormat('@');
      Hojareservas.getRange(I + 1, 3).setValue(Sanitizarcelda(Nombrefinal, 80));
      Hojareservas.getRange(I + 1, 4).setValue(Cedulavalida);
      Hojareservas.getRange(I + 1, 5).setValue(Celularfinal);
      if (!Filas[I][27] && Celularlimpio) { Hojareservas.getRange(I + 1, 28).setValue(Celularlimpio); }
      if (Horallegada) { Hojareservas.getRange(I + 1, 11).setValue(Sanitizarcelda(Horallegada, 40)); }

      const Obslimpia = String(Filas[I][23] || '').replace(/\s*·?\s*Parqueadero:[^·]*/gi, '').trim();
      const Detalles = [Obslimpia].filter(Boolean);
      if (Parqueadero) { Detalles.push(`Parqueadero: ${Parqueadero}`); }
      if (Detalles.length) { Hojareservas.getRange(I + 1, 24).setValue(Sanitizarcelda(Detalles.join(' · '), 140)); }

      if (typeof Actualizarconversacion === 'function' && Celularlimpio) {
        Actualizarconversacion(Celularlimpio, { nombre: Nombrefinal, codigoreserva: String(Filas[I][0]), telefonocontacto: Celularfinal });
      }
      return { exito: true, codigo: String(Filas[I][0]), nombre: Nombrefinal, cedula: Cedulavalida, celular: Celularfinal, horallegada: Horallegada || 'Por confirmar', parqueadero: Parqueadero || 'No especificado' };
    }
  }
  return { exito: false, mensaje: 'Primero debes apartar una habitación antes de guardar los datos del huésped.' };
}
