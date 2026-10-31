/* =========================================
   PHONE PLANET - CONEXIÓN CON SUPABASE
========================================= */

// URL de tu proyecto de Supabase.
const SUPABASE_URL =
    "https://ebyqulenhirnvuaceczp.supabase.co";

// Clave PÚBLICA (publishable) del proyecto. Está hecha para verse en el
// navegador: lo que protege los datos son las políticas RLS de Supabase.
// NUNCA coloques aquí una clave secreta (secret / service_role).
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_mu44vvkbB66wT6OZbWDJyA_ssYSogD8";

// =========================================
// INICIALIZACIÓN DEL CLIENTE
// =========================================

// MODIFICADO 1:
// Comprobar que la biblioteca de Supabase esté cargada.
if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
) {
    console.error(
        "No se cargó la biblioteca de Supabase. Revisa el CDN en LOGIN.html."
    );

    throw new Error(
        "No se pudo cargar la biblioteca de Supabase."
    );
}

// MODIFICADO 2:
// Validar la URL y la clave pública antes de crear el cliente.
if (
    !SUPABASE_URL ||
    !SUPABASE_URL.startsWith("https://") ||
    !SUPABASE_PUBLISHABLE_KEY
) {
    console.error(
        "La URL o la clave pública de Supabase no están configuradas."
    );

    throw new Error(
        "La configuración de Supabase está incompleta."
    );
}

// Crear el cliente de Supabase.
// La sesión se renueva sola y se guarda únicamente en este navegador.
const clienteSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);

// MODIFICADO 3 - IMPORTANTE:
// Exponer el cliente en window para que LOGIN.js y SEGURIDAD.js
// puedan acceder a él si utilizan window.clienteSupabase.
window.clienteSupabase = clienteSupabase;

// También ofrecer la función que espera tu LOGIN.js.
window.obtenerClienteSupabase = function () {
    return clienteSupabase;
};