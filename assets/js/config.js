/*
  Configuracion editable de la invitacion.
  Cambia datos del evento y URL de Google Apps Script desde aqui
  sin tocar la estructura HTML ni la logica de interaccion.
  Los invitados se editan en assets/data/invitados.json.
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxqVDAzHfm9HI488VBjN8PlZCMKMauKoaCfaZB0FwssUGVEfdm3idsdtKPlFe6QvgK3Uw/exec"; // Ej: "https://script.google.com/macros/s/AKfycb.../exec"
const INVITADOS_JSON_URL = "assets/data/invitados.json";

// Mesa de regalos
const GIFTS_ENABLED = true;                       // Pon false para ocultar toda la sección de regalos
const REGALOS_JSON_URL = "assets/data/regalos.json";

// Datos del evento
const EVENT = {
  nombre: "Baby Shower de Eros Salvatore",
  diaSemana: "Miercoles",
  fecha: "12 de agosto de 2026",
  hora: "7:00 PM",
  lugar: "Salón / dirección del evento",
  mapsUrl: "https://maps.google.com/?q=toledo+españa",
};
