/* =========================================
   PHONE PLANET - CONEXIÓN CON SUPABASE
   Ruta esperada: JS/SUPABASE.js
========================================= */
(() => {
    "use strict";

    const SUPABASE_URL = "https://ebyqulenhirnvuaceczp.supabase.co";
    // Clave pública/publishable: puede estar en el frontend.
    // Nunca pegues aquí una clave sb_secret_ o service_role.
    const SUPABASE_PUBLIC_KEY = "sb_publishable_mu44vvkbB66wT6OZbWDJyA_ssYSogD8";

    let clienteSupabase = null;

    function obtenerClienteSupabase() {
        if (clienteSupabase) return clienteSupabase;

        if (!SUPABASE_URL.startsWith("https://ebyqulenhirnvuaceczp.supabase.co") ||
            !SUPABASE_PUBLIC_KEY ||
            SUPABASE_PUBLIC_KEY.includes("sb_publishable_mu44vvkbB66wT6OZbWDJyA_ssYSogD8")) {
            console.error("Phone Planet: configura SUPABASE_URL y la clave pública en JS/SUPABASE.js.");
            return null;
        }

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            console.error("Phone Planet: no se cargó la librería de Supabase JS.");
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
        console.info("Phone Planet: cliente Supabase inicializado.");
        return clienteSupabase;
    }

    window.obtenerClienteSupabase = obtenerClienteSupabase;
    window.clienteSupabase = obtenerClienteSupabase();
})();
