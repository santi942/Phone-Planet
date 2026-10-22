
/* =========================================
   PHONE PLANET - CONEXIÓN CON SUPABASE
========================================= */

// URL de tu proyecto de Supabase.
const SUPABASE_URL =
    "https://ebyqulenhirnvuaceczp.supabase.co";

// Clave pública del proyecto.
// MODIFICADO: se conserva tu clave pública actual.
// Nunca coloques aquí una clave secreta.
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
const clienteSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// MODIFICADO 3 - IMPORTANTE:
// Exponer el cliente en window para que LOGIN.js y SEGURIDAD.js
// puedan acceder a él si utilizan window.clienteSupabase.
window.clienteSupabase = clienteSupabase;

// También ofrecer la función que espera tu LOGIN.js.
window.obtenerClienteSupabase = function () {
    return clienteSupabase;
};

console.log(
    "PHONE PLANET: cliente de Supabase inicializado correctamente."
);


// =========================================
// CREAR CUENTA DESDE EL ADMINISTRADOR
// =========================================

// MODIFICADO 4:
// Se conserva el flujo existente hacia smart-worker.
// El rol predeterminado cambia a "empleado" para Phone Planet.
// Confirma que smart-worker admita "empleado" y "administrador".
async function crearUsuarioGeoNorte(
    nombre,
    correo,
    contrasena,
    rol = "empleado"
) {
    // Verificar que exista una sesión.
    const {
        data: sesionData,
        error: sesionError
    } = await clienteSupabase.auth.getSession();

    if (sesionError) {
        throw new Error(
            "No se pudo verificar la sesión."
        );
    }

    if (!sesionData.session) {
        throw new Error(
            "Debes iniciar sesión como administrador."
        );
    }

    // Validar los datos antes de enviarlos.
    nombre = String(nombre || "").trim();
    correo = String(correo || "").trim();
    contrasena = String(contrasena || "");

    if (!nombre || !correo || !contrasena) {
        throw new Error(
            "Completa todos los campos obligatorios."
        );
    }

    // MODIFICADO 5:
    // Validar los roles utilizados por Phone Planet.
    if (!["empleado", "administrador"].includes(rol)) {
        throw new Error(
            "El rol seleccionado no es válido."
        );
    }

    // Enviar los datos a la función del servidor.
    const { data, error } =
        await clienteSupabase.functions.invoke(
            "smart-worker",
            {
                body: {
                    nombre,
                    correo,
                    contrasena,
                    rol
                }
            }
        );

    if (error) {
        console.error(
            "Error de smart-worker:",
            error
        );

        let mensaje =
            error.message ||
            "No se pudo crear la cuenta.";

        // Intentar recuperar el mensaje del servidor.
        try {
            if (error.context) {
                const respuesta =
                    await error.context.clone().json();

                if (respuesta.error) {
                    mensaje = respuesta.error;
                } else if (respuesta.message) {
                    mensaje = respuesta.message;
                }
            }
        } catch (_) {
            // La respuesta no necesariamente contiene JSON.
        }

        throw new Error(mensaje);
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

// MODIFICADO 6:
// Exponer la función para que otros archivos puedan utilizarla.
window.crearUsuarioGeoNorte = crearUsuarioGeoNorte;
