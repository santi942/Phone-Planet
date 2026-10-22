
/* =========================================
   PHONE PLANET - INICIO DE SESIÓN
   Compatible con la Edge Function: login-codigo
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const formulario = document.getElementById("formularioLogin");
    const campoCodigo = document.getElementById("correo");
    const campoContrasena = document.getElementById("contrasena");
    const botonEnviar = document.getElementById("botonEnviar");
    const mensaje = document.getElementById("mensajeLogin");
    const enlaceRecuperar = document.getElementById("enlaceRecuperar");
    const campoRecordarme = document.getElementById("recordarme");

    const enlaceRegistro = document.getElementById("enlaceRegistro");
    const titulo = document.getElementById("tituloFormulario");
    const campoNombre = document.getElementById("nombre");
    const contenedorNombre = document.getElementById("contenedorNombre");
    const opcionesLogin = document.getElementById("opcionesLogin");
    const textoPregunta = document.getElementById("textoPregunta");

    if (!formulario || !campoCodigo || !campoContrasena || !botonEnviar) {
        console.error(
            "Phone Planet: faltan elementos del formulario. Revisa los ID de LOGIN.html."
        );
        return;
    }

    let procesando = false;
    let modoRegistro = false;

    function mostrarMensaje(texto) {
        if (mensaje) mensaje.textContent = texto;
        if (texto) console.info("Phone Planet:", texto);
    }

    // MODIFICADO 1:
    // Detectar si SUPABASE.js expuso el cliente correctamente.
    function obtenerCliente() {
        const cliente =
            typeof window.obtenerClienteSupabase === "function"
                ? window.obtenerClienteSupabase()
                : window.clienteSupabase;

        if (
            !cliente ||
            !cliente.auth ||
            !cliente.functions
        ) {
            console.error(
                "Cliente Supabase no disponible. Revisa las rutas y el orden de los scripts en LOGIN.html."
            );

            mostrarMensaje(
                "No se pudo inicializar Supabase. Revisa la carga de JS/SUPABASE.js."
            );

            return null;
        }

        return cliente;
    }

    function cambiarEstadoBoton(ocupado) {
        procesando = ocupado;
        botonEnviar.disabled = ocupado;
        botonEnviar.textContent = ocupado
            ? "Verificando..."
            : (modoRegistro ? "Crear cuenta" : "Ingresar");
    }

    // MODIFICADO 2:
    // Diferenciar errores de conexión, función y credenciales.
    function traducirError(error) {
        const texto = String(error?.message || "").toLowerCase();

        if (
            texto.includes("failed to fetch") ||
            texto.includes("failed to send a request") ||
            texto.includes("networkerror") ||
            texto.includes("fetch")
        ) {
            return "No se pudo contactar a Supabase. Revisa la conexión, la URL y CORS.";
        }

        if (
            texto.includes("function not found") ||
            texto.includes("404")
        ) {
            return "No se encontró login-codigo. Verifica que la función esté desplegada.";
        }

        if (
            texto.includes("código o contraseña incorrectos") ||
            texto.includes("invalid login credentials") ||
            texto.includes("unauthorized")
        ) {
            return "Código o contraseña incorrectos.";
        }

        return error?.message ||
            "No se pudo iniciar sesión. Revisa la consola para conocer el error.";
    }

    if (enlaceRegistro) {
        enlaceRegistro.addEventListener("click", (evento) => {
            evento.preventDefault();
            modoRegistro = !modoRegistro;
            mostrarMensaje("");

            if (modoRegistro) {
                if (titulo) titulo.textContent = "Crear Cuenta";
                if (contenedorNombre) contenedorNombre.style.display = "flex";
                if (campoNombre) campoNombre.required = true;
                if (opcionesLogin) opcionesLogin.style.display = "none";

                botonEnviar.textContent = "Crear cuenta";

                if (textoPregunta) {
                    textoPregunta.textContent = "¿Ya tienes cuenta?";
                }

                enlaceRegistro.textContent = "Inicia sesión aquí";
            } else {
                if (titulo) titulo.textContent = "Iniciar Sesión";
                if (contenedorNombre) contenedorNombre.style.display = "none";

                if (campoNombre) {
                    campoNombre.required = false;
                    campoNombre.value = "";
                }

                if (opcionesLogin) opcionesLogin.style.display = "flex";

                botonEnviar.textContent = "Ingresar";

                if (textoPregunta) {
                    textoPregunta.textContent = "¿No tienes cuenta?";
                }

                enlaceRegistro.textContent = "Regístrate aquí";
            }
        });
    }

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (procesando) return;

        const supabase = obtenerCliente();
        if (!supabase) return;

        const codigo = campoCodigo.value.trim().toUpperCase();
        const contrasena = campoContrasena.value;

        if (!codigo || !contrasena) {
            mostrarMensaje("Escribe tu código de usuario y contraseña.");
            return;
        }

        if (modoRegistro) {
            mostrarMensaje(
                "El registro de empleados se administra desde la cuenta administradora."
            );
            return;
        }

        mostrarMensaje("");
        cambiarEstadoBoton(true);

        try {
            // Se envían los nombres que espera login-codigo.
            const { data, error } = await supabase.functions.invoke(
                "login-codigo",
                {
                    body: {
                        codigo,
                        contrasena
                    }
                }
            );

            // MODIFICADO 3:
            // Registrar el error completo para poder diagnosticarlo.
            if (error) {
                console.error(
                    "Error invocando login-codigo:",
                    error
                );

                throw new Error(
                    error.message || "Error al llamar login-codigo."
                );
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            const accessToken = data?.session?.access_token;
            const refreshToken = data?.session?.refresh_token;

            if (!accessToken || !refreshToken) {
                throw new Error(
                    "login-codigo no devolvió una sesión válida."
                );
            }

            // Establecer la sesión de Supabase Auth.
            const { error: errorSesion } =
                await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

            if (errorSesion) throw errorSesion;

            // Confirmar que la sesión se guardó.
            const {
                data: sesionConfirmada,
                error: errorSesionConfirmada
            } = await supabase.auth.getSession();

            if (errorSesionConfirmada) {
                throw errorSesionConfirmada;
            }

            if (!sesionConfirmada?.session) {
                throw new Error(
                    "Supabase no pudo guardar la sesión. Inténtalo otra vez."
                );
            }

            if (campoRecordarme) {
                localStorage.setItem(
                    "phonePlanetRecordarme",
                    campoRecordarme.checked ? "1" : "0"
                );
            }

            mostrarMensaje(
                "Inicio de sesión exitoso. Abriendo el menú..."
            );

            // MODIFICADO 4:
            // Usar la ruta relativa al proyecto actual.
            window.location.href = "MENU.html";

        } catch (error) {
            console.error(
                "Phone Planet - error de inicio de sesión:",
                error
            );

            mostrarMensaje(traducirError(error));

        } finally {
            cambiarEstadoBoton(false);
        }
    });

    if (enlaceRecuperar) {
        enlaceRecuperar.addEventListener("click", (evento) => {
            evento.preventDefault();

            mostrarMensaje(
                "Para recuperar la contraseña de una cuenta PP, solicita el restablecimiento desde la administración de Phone Planet."
            );
        });
    }

    try {
        const aviso = sessionStorage.getItem("phonePlanetMensaje");

        if (aviso) {
            mostrarMensaje(aviso);
            sessionStorage.removeItem("phonePlanetMensaje");
        }

        if (campoRecordarme) {
            campoRecordarme.checked =
                localStorage.getItem("phonePlanetRecordarme") === "1";
        }
    } catch (_) {
        // El formulario sigue funcionando si el almacenamiento está bloqueado.
    }
});
