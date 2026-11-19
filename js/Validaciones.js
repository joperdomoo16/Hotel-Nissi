// Validación de datos del huésped, fechas, enlaces y generación de códigos

function Sanitizartexto(Texto, Longitudmaxima) {
  const Limite = Longitudmaxima || 120;
  return String(Texto == null ? '' : Texto)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, Limite);
}

function Esurlsegura(Url) {
  const Limpia = String(Url || '').trim();
  if (!Limpia) {
    return false;
  }
  if (Limpia.startsWith('/') || Limpia.startsWith('assets/')) {
    return true;
  }
  try {
    const Analizada = new URL(Limpia, window.location.origin);
    return Analizada.protocol === 'https:';
  } catch (Errorurl) {
    return false;
  }
}

function Validarcorreoelectronico(Correotexto) {
  const Patrontipico = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Patrontipico.test((Correotexto || '').trim());
}

function Validarnumerocelular(Celulartexto) {
  const Solodigitos = (Celulartexto || '').replace(/\D/g, '');
  return Solodigitos.length >= 7 && Solodigitos.length <= 13;
}

function Validarcedulacolombiana(Cedulatexto) {
  const Solodigitos = String(Cedulatexto || '').replace(/\D/g, '');
  return /^[1-9]\d{5,9}$/.test(Solodigitos);
}

function Formatearfechalocal(Fecha) {
  const Base = Fecha instanceof Date ? Fecha : new Date();
  const Anio = Base.getFullYear();
  const Mes = String(Base.getMonth() + 1).padStart(2, '0');
  const Dia = String(Base.getDate()).padStart(2, '0');
  return `${Anio}-${Mes}-${Dia}`;
}

function Validarrangofechas(Fechallegada, Fechasalida) {
  if (!Fechallegada || !Fechasalida) {
    return false;
  }
  const Momentollegada = new Date(Fechallegada);
  const Momentosalida = new Date(Fechasalida);
  return !isNaN(Momentollegada.getTime()) && !isNaN(Momentosalida.getTime()) && Momentosalida > Momentollegada;
}

function Calcularnochesestadia(Fechallegada, Fechasalida) {
  if (!Validarrangofechas(Fechallegada, Fechasalida)) {
    return 0;
  }
  const Milisegundosdia = 86400000;
  const Diferenciamilisegundos = new Date(Fechasalida) - new Date(Fechallegada);
  return Math.round(Diferenciamilisegundos / Milisegundosdia);
}

function Formatearfechalegible(Fechacadena) {
  if (!Fechacadena) {
    return '';
  }
  const Partesfecha = Fechacadena.split('-');
  if (Partesfecha.length !== 3) {
    return Fechacadena;
  }
  const Indicemes = parseInt(Partesfecha[1], 10) - 1;
  const Indicedia = parseInt(Partesfecha[2], 10);
  const Nombremes = Mesesano[Indicemes] || '';
  return `${Indicedia} ${Nombremes}`;
}

function Generarcodigoreserva() {
  const Caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const Valores = new Uint32Array(6);
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(Valores);
  } else {
    for (let Indice = 0; Indice < Valores.length; Indice++) {
      Valores[Indice] = Math.floor((Date.now() + Indice * 997) % 4294967295);
    }
  }
  let Sufijo = '';
  for (let Pos = 0; Pos < Valores.length; Pos++) {
    Sufijo += Caracteres[Valores[Pos] % Caracteres.length];
  }
  return `NS-${Sufijo}`;
}
