

/* =========================================
   PHONE PLANET - CONEXIÓN CON SUPABASE
========================================= */

const SUPABASE_URL =
    "https://ebyqulenhirnvuaceczp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_mu44vvkbB66wT6OZbWDJyA_ssYSogD8";

const clienteSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("PHONE PLANET: cliente de Supabase inicializado.");

/* =========================================
   CREAR CUENTA DESDE EL ADMINISTRADOR
========================================= */

async function crearUsuarioGeoNorte(
    nombre,
    correo,
    contrasena,
    rol = "estudiante"
) {
    // Verificar que exista una sesión.
    const {
        data: sesionData,
        error: sesionError
    } = await clienteSupabase.auth.getSession();

    if (sesionError) {
        throw new Error("No se pudo verificar la sesión.");
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

    if (!["estudiante", "administrador"].includes(rol)) {
        throw new Error("El rol seleccionado no es válido.");
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
