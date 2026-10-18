
/* =========================================
   PHONE PLANET - CONEXIÓN CON SUPABASE
   Archivo: JS/SUPABASE.js
========================================= */

(() => {
    "use strict";

    // =====================================
    // CONFIGURACIÓN DEL PROYECTO
    // =====================================

    const SUPABASE_URL =
        "https://ebyqulenhirnvuaceczp.supabase.co";

    // Pega aquí tu clave PUBLICABLE (sb_publishable_...)
    // o tu clave pública anon (JWT antiguo).
    // NUNCA uses service_role ni una clave secreta aquí.
    const SUPABASE_PUBLIC_KEY =
        "sb_publishable_mu44vvkbB66wT6OZbWDJyA_ssYSogD8";

    let clienteSupabase = null;

    // =====================================
    // INICIALIZAR CLIENTE
    // =====================================

    function obtenerCliente() {
        if (clienteSupabase) {
            return clienteSupabase;
        }

        if (
            !SUPABASE_URL.startsWith("https://ebyqulenhirnvuaceczp.supabase.co") ||
            !SUPABASE_PUBLIC_KEY ||
            SUPABASE_PUBLIC_KEY.includes("sb_publishable_mu44vvkbB66wT6OZbWDJyA_ssYSogD8")
        ) {
            console.error(
                "Phone Planet: configura la URL y la clave pública en SUPABASE.js."
            );
            return null;
        }

        if (
            !window.supabase ||
            typeof window.supabase.createClient !== "function"
        ) {
            console.error(
                "Phone Planet: no se ha cargado la librería de Supabase JS."
            );
            return null;
        }

        clienteSupabase = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLIC_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage
                }
            }
        );

        window.clienteSupabase = clienteSupabase;

        console.info(
            "Phone Planet: conexión con Supabase inicializada."
        );

        return clienteSupabase;
    }

    // =====================================
    // FUNCIONES DISPONIBLES GLOBALMENTE
    // =====================================

    window.obtenerClienteSupabase = obtenerCliente;

    window.clienteSupabase = obtenerCliente();

})();
