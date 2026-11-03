// Reglas para validar datos del viajero, fechas y formatos de contacto
function Validarcorreoelectronico(Correotexto) {
  const Patrontipico = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Patrontipico.test((Correotexto || '').trim());
}

function Validarnumerocelular(Celulartexto) {
  const Solodigitos = (Celulartexto || '').replace(/\D/g, '');
  return Solodigitos.length >= 7 && Solodigitos.length <= 13;
}

function Validarrangofechas(Fechallegada, Fechasalida) {
  if (!Fechallegada || !Fechasalida) {
    return false;
  }
  const Momentollegada = new Date(Fechallegada);
  const Momentosalida = new Date(Fechasalida);
  return Momentosalida > Momentollegada;
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
  const Letrasazar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NS-${Letrasazar}`;
}

