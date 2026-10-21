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

    // Elementos opcionales: el login funciona aunque no haya registro en el HTML.
    const enlaceRegistro = document.getElementById("enlaceRegistro");
    const titulo = document.getElementById("tituloFormulario");
    const campoNombre = document.getElementById("nombre");
    const contenedorNombre = document.getElementById("contenedorNombre");
    const opcionesLogin = document.getElementById("opcionesLogin");
    const textoPregunta = document.getElementById("textoPregunta");

    if (!formulario || !campoCodigo || !campoContrasena || !botonEnviar) {
        console.error("Phone Planet: faltan elementos requeridos del formulario. Revisa los id en LOGIN.html.");
        return;
    }

    let procesando = false;
    let modoRegistro = false;

    function mostrarMensaje(texto) {
        if (mensaje) mensaje.textContent = texto;
        if (texto) console.info("Phone Planet:", texto);
    }

    function obtenerCliente() {
        const cliente = typeof window.obtenerClienteSupabase === "function"
            ? window.obtenerClienteSupabase()
            : window.clienteSupabase;
        if (!cliente) mostrarMensaje("No se pudo conectar con Supabase. Revisa la configuración de JS/SUPABASE.js.");
        return cliente || null;
    }

    function cambiarEstadoBoton(ocupado) {
        procesando = ocupado;
        botonEnviar.disabled = ocupado;
        botonEnviar.textContent = ocupado ? "Verificando..." : (modoRegistro ? "Crear cuenta" : "Ingresar");
    }

    function traducirError(error) {
        const texto = String(error?.message || error?.context?.message || "").toLowerCase();
        if (texto.includes("failed to send a request") || texto.includes("fetch")) {
            return "No se pudo contactar a Supabase. Revisa la URL, CORS y la conexión.";
        }
        if (texto.includes("function not found") || texto.includes("404")) {
            return "No se encontró la función login-codigo. Verifica que esté desplegada con ese nombre.";
        }
        if (texto.includes("invalid") || texto.includes("incorrect") || texto.includes("unauthorized")) {
            return "Código o contraseña incorrectos.";
        }
        return error?.message || "No se pudo iniciar sesión. Revisa la configuración e inténtalo nuevamente.";
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
                if (textoPregunta) textoPregunta.textContent = "¿Ya tienes cuenta?";
                enlaceRegistro.textContent = "Inicia sesión aquí";
            } else {
                if (titulo) titulo.textContent = "Iniciar Sesión";
                if (contenedorNombre) contenedorNombre.style.display = "none";
                if (campoNombre) { campoNombre.required = false; campoNombre.value = ""; }
                if (opcionesLogin) opcionesLogin.style.display = "flex";
                botonEnviar.textContent = "Ingresar";
                if (textoPregunta) textoPregunta.textContent = "¿No tienes cuenta?";
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
            mostrarMensaje("El registro de empleados se administra desde la cuenta administradora.");
            return;
        }

        mostrarMensaje("");
        cambiarEstadoBoton(true);

        try {
            // La Edge Function espera { codigo, contrasena }.
            const { data, error } = await supabase.functions.invoke("login-codigo", {
                body: { codigo, contrasena }
            });

            if (error) {
                let detalle = error.message || "Error al llamar login-codigo.";
                try {
                    const respuesta = error.context;
                    if (respuesta && typeof respuesta.json === "function") {
                        const json = await respuesta.json();
                        if (json?.error) detalle = json.error;
                    }
                } catch (_) { /* Mantener el mensaje original si no hay JSON. */ }
                throw new Error(detalle);
            }

            if (data?.error) throw new Error(data.error);
            const accessToken = data?.session?.access_token;
            const refreshToken = data?.session?.refresh_token;
            if (!accessToken || !refreshToken) {
                throw new Error("La función no devolvió una sesión válida. Revisa el código de login-codigo.");
            }

            const { error: errorSesion } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });
            if (errorSesion) throw errorSesion;

            // Confirma que la sesión quedó guardada antes de cambiar de página.
            const { data: sesionConfirmada, error: errorSesionConfirmada } = await supabase.auth.getSession();
            if (errorSesionConfirmada) throw errorSesionConfirmada;
            if (!sesionConfirmada?.session) throw new Error("Supabase no pudo guardar la sesión. Inténtalo otra vez.");

            // El checkbox se conserva como preferencia visual; la sesión de Supabase persiste por configuración.
            if (campoRecordarme) localStorage.setItem("phonePlanetRecordarme", campoRecordarme.checked ? "1" : "0");
            mostrarMensaje("Inicio de sesión exitoso. Abriendo el menú...");
            window.location.replace("MENU.html");
        } catch (error) {
            console.error("Phone Planet - error de inicio de sesión:", error);
            mostrarMensaje(traducirError(error));
        } finally {
            cambiarEstadoBoton(false);
        }
    });

    if (enlaceRecuperar) {
        enlaceRecuperar.addEventListener("click", (evento) => {
            evento.preventDefault();
            mostrarMensaje("Para recuperar la contraseña de una cuenta PP, solicita el restablecimiento desde la administración de Phone Planet.");
        });
    }

    // Mostrar cualquier mensaje guardado al regresar al login.
    try {
        const aviso = sessionStorage.getItem("phonePlanetMensaje");
        if (aviso) {
            mostrarMensaje(aviso);
            sessionStorage.removeItem("phonePlanetMensaje");
        }
        if (campoRecordarme) campoRecordarme.checked = localStorage.getItem("phonePlanetRecordarme") === "1";
    } catch (_) { /* El login sigue funcionando si el almacenamiento está bloqueado. */ }
});
