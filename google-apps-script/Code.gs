/**
 * Baby Shower Eros — Backend en Google Apps Script
 * ------------------------------------------------------------------
 * Este script recibe:
 *   1) Confirmaciones de asistencia (RSVP)      -> hoja "Confirmaciones"
 *   2) Reservas de regalos (mesa de regalos)     -> hoja "Regalos"
 * Y expone (doGet) el conteo de reservas por regalo para que la web
 * pueda bloquear los regalos ya completos.
 *
 * DESPLIEGUE:
 *   1. Abre la hoja de cálculo de Google donde quieres guardar los datos.
 *   2. Extensiones > Apps Script. Pega este código en Code.gs.
 *   3. Implementar > Nueva implementación > Tipo: "Aplicación web".
 *        - Ejecutar como: Yo
 *        - Quién tiene acceso: Cualquier usuario
 *   4. Copia la URL /exec y pégala en assets/js/config.js (APPS_SCRIPT_URL).
 *   5. Si ya tenías una implementación para el RSVP, usa "Gestionar
 *      implementaciones" > editar > Nueva versión, para conservar la misma URL.
 * ------------------------------------------------------------------
 */

var SHEET_RSVP = "Confirmaciones";
var SHEET_GIFTS = "Regalos";

/* ============ ENTRADA (POST): RSVP y reservas de regalo ============ */
function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    if (String(p.tipo || "").toLowerCase() === "regalo") {
      return guardarRegalo_(p);
    }
    return guardarRsvp_(p);

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ============ SALIDA (GET): conteo de reservas de regalos ============ */
function doGet(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var tipo = String(p.tipo || "").toLowerCase();
    if (tipo === "regalos") {
      return json_({ ok: true, conteos: contarRegalos_() });
    }
    if (tipo === "confirmacion") {
      // Devuelve la confirmación previa de un invitado (o null) para bloquear
      // la re-confirmación desde cualquier dispositivo.
      return json_({ ok: true, confirmacion: buscarConfirmacion_(p.telefono) });
    }
    // Por defecto, salud del servicio.
    return json_({ ok: true, servicio: "baby-shower-eros" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ============ RSVP ============ */
function guardarRsvp_(p) {
  var sheet = hoja_(SHEET_RSVP, [
    "Fecha", "Teléfono", "Nombre", "Asistencia",
    "Acompañantes", "Total personas", "Comentario"
  ]);
  var fila = [
    p.fechaConfirmacion || new Date().toISOString(),
    p.telefono || "",
    p.nombre || "",
    p.asistencia || "",
    p.acompanantesConfirmados || 0,
    p.totalPersonas || 0,
    p.comentario || ""
  ];

  // Una sola fila por invitado: si ya existe su teléfono, se actualiza.
  if (p.telefono) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(p.telefono)) {
        sheet.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
        return json_({ ok: true, actualizado: true });
      }
    }
  }

  sheet.appendRow(fila);
  return json_({ ok: true });
}

/* ============ Buscar confirmación previa de un invitado ============ */
function buscarConfirmacion_(telefono) {
  if (!telefono) return null;
  var sheet = hoja_(SHEET_RSVP, [
    "Fecha", "Teléfono", "Nombre", "Asistencia",
    "Acompañantes", "Total personas", "Comentario"
  ]);
  var data = sheet.getDataRange().getValues();
  var found = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(telefono)) {
      found = {
        fechaConfirmacion: data[i][0],
        telefono: String(data[i][1]),
        nombre: data[i][2],
        asistencia: data[i][3],
        acompanantesConfirmados: Number(data[i][4]) || 0,
        totalPersonas: Number(data[i][5]) || 0,
        comentario: data[i][6] || "",
        yaConfirmo: "Sí"
      };
    }
  }
  return found;
}

/* ============ Reserva de regalo ============ */
function guardarRegalo_(p) {
  var sheet = hoja_(SHEET_GIFTS, [
    "Fecha", "ID Regalo", "Regalo", "Teléfono", "Invitado"
  ]);

  // Evita que el mismo invitado reserve dos veces el mismo regalo.
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(p.idRegalo) &&
        String(data[i][3]) === String(p.telefono)) {
      return json_({ ok: true, duplicado: true });
    }
  }

  sheet.appendRow([
    p.fecha || new Date().toISOString(),
    p.idRegalo || "",
    p.nombreRegalo || "",
    p.telefono || "",
    p.nombreInvitado || ""
  ]);
  return json_({ ok: true });
}

/* ============ Conteo de reservas por idRegalo ============ */
function contarRegalos_() {
  var sheet = hoja_(SHEET_GIFTS, [
    "Fecha", "ID Regalo", "Regalo", "Teléfono", "Invitado"
  ]);
  var data = sheet.getDataRange().getValues();
  var conteos = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][1] || "").trim();
    if (!id) continue;
    conteos[id] = (conteos[id] || 0) + 1;
  }
  return conteos;
}

/* ============ Utilidades ============ */
function hoja_(nombre, encabezados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(encabezados);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
