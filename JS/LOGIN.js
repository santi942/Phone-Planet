
/* =========================================
  Phone Planet - LOGIN
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const formulario = document.getElementById("formularioLogin");
    const titulo = document.getElementById("tituloFormulario");

    const campoNombre = document.getElementById("nombre");
    const contenedorNombre = document.getElementById("contenedorNombre");

    const campoCorreo = document.getElementById("correo");
    const campoContrasena = document.getElementById("contrasena");

    const opcionesLogin = document.getElementById("opcionesLogin");
    const botonEnviar = document.getElementById("botonEnviar");

    const enlaceRegistro = document.getElementById("enlaceRegistro");
    const textoPregunta = document.getElementById("textoPregunta");
    const enlaceRecuperar = document.getElementById("enlaceRecuperar");

    const mensaje = document.getElementById("mensajeLogin");

    let modoRegistro = false;
    let procesando = false;

    function mostrarMensaje(texto) {
        mensaje.textContent = texto;
    }

    function obtenerCliente() {
        if (!clienteSupabase) {
            mostrarMensaje(
                "Configura la URL y la clave pública en SUPABASE.js."
            );
            return null;
        }

        return clienteSupabase;
    }

    function cambiarEstadoBoton(ocupado) {
        procesando = ocupado;
        botonEnviar.disabled = ocupado;

        botonEnviar.textContent = ocupado
            ? "Procesando..."
            : modoRegistro
                ? "Crear cuenta"
                : "Ingresar";
    }

    // Cambiar entre inicio de sesión y registro.
    enlaceRegistro.addEventListener("click", (evento) => {
        evento.preventDefault();

        modoRegistro = !modoRegistro;
        mostrarMensaje("");

        if (modoRegistro) {
            titulo.textContent = "Crear Cuenta";
            contenedorNombre.style.display = "flex";
            campoNombre.required = true;
            campoContrasena.autocomplete = "new-password";
            opcionesLogin.style.display = "none";
            botonEnviar.textContent = "Crear cuenta";
            textoPregunta.textContent = "¿Ya tienes cuenta?";
            enlaceRegistro.textContent = "Inicia sesión aquí";
        } else {
            titulo.textContent = "Iniciar Sesión";
            contenedorNombre.style.display = "none";
            campoNombre.required = false;
            campoNombre.value = "";
            campoContrasena.autocomplete = "current-password";
            opcionesLogin.style.display = "flex";
            botonEnviar.textContent = "Ingresar";
            textoPregunta.textContent = "¿No tienes cuenta?";
            enlaceRegistro.textContent = "Regístrate aquí";
        }
    });

    // Registrar un usuario o iniciar sesión.
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (procesando) return;

        const supabase = obtenerCliente();
        if (!supabase) return;

        const identificador = campoCorreo.value.trim();
        const contrasena = campoContrasena.value;

        mostrarMensaje("");
        cambiarEstadoBoton(true);

        try {
            if (modoRegistro) {
                const nombre = campoNombre.value.trim();

                if (!nombre) {
                    mostrarMensaje("Escribe tu nombre completo.");
                    return;
                }

                if (!identificador.includes("@")) {
                    mostrarMensaje(
                        "Para registrarte, escribe un correo electrónico válido."
                    );
                    return;
                }

                if (contrasena.length < 6) {
                    mostrarMensaje(
                        "La contraseña debe tener al menos 6 caracteres."
                    );
                    return;
                }

                const { data, error } = await supabase.auth.signUp({
                    email: identificador,
                    password: contrasena,
                    options: {
                        data: { nombre }
                    }
                });

                if (error) throw error;

                if (data.session) {
                    mostrarMensaje("Cuenta creada correctamente.");
                    window.location.href = "MENU.html";
                    return;
                }

                mostrarMensaje(
                    "Cuenta creada. Revisa tu correo y confirma el registro antes de iniciar sesión."
                );

                modoRegistro = false;
                titulo.textContent = "Iniciar Sesión";
                contenedorNombre.style.display = "none";
                campoNombre.required = false;
                campoNombre.value = "";
                campoContrasena.value = "";
                campoContrasena.autocomplete = "current-password";
                opcionesLogin.style.display = "flex";
                textoPregunta.textContent = "¿No tienes cuenta?";
                enlaceRegistro.textContent = "Regístrate aquí";

            } else {
                // Iniciar sesión mediante código de GeoNorte.
                const { data, error } =
                    await supabase.functions.invoke("rapid-function", {
                        body: {
                            usuario: identificador.toUpperCase(),
                            contrasena
                        }
                    });

                if (error) throw error;

                if (
                    !data?.session?.access_token ||
                    !data?.session?.refresh_token
                ) {
                    throw new Error("No se recibió una sesión válida.");
                }

                const { error: errorSesion } =
                    await supabase.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token
                    });

                if (errorSesion) throw errorSesion;

                mostrarMensaje("Inicio de sesión exitoso.");
                window.location.href = "MENU.html";
            }

        } catch (error) {
            console.error("Error de autenticación:", error);
            mostrarMensaje(traducirError(error));

        } finally {
            cambiarEstadoBoton(false);
        }
    });

    // Recuperar contraseña mediante correo electrónico.
    enlaceRecuperar.addEventListener("click", async (evento) => {
        evento.preventDefault();

        if (procesando) return;

        const supabase = obtenerCliente();
        if (!supabase) return;

        const correo = campoCorreo.value.trim();

        if (!correo || !correo.includes("@")) {
            mostrarMensaje(
                "Escribe tu correo electrónico para recuperar la contraseña."
            );
            campoCorreo.focus();
            return;
        }

        mostrarMensaje("Enviando solicitud de recuperación...");

        try {
            const { error } =
                await supabase.auth.resetPasswordForEmail(correo);

            if (error) throw error;

            mostrarMensaje(
                "Si el correo está registrado, recibirás las instrucciones de recuperación. Revisa también la carpeta de spam."
            );

        } catch (error) {
            console.error("Error al recuperar contraseña:", error);

            mostrarMensaje(
                "No se pudo procesar la recuperación. Verifica la configuración de Supabase e inténtalo nuevamente."
            );
        }
    });

    // Traducir errores de autenticación.
    function traducirError(error) {
        const codigo = error?.code || "";
        const texto = (error?.message || "").toLowerCase();

        if (
            codigo === "invalid_credentials" ||
            texto.includes("invalid login credentials")
        ) {
            return "Código, correo o contraseña incorrectos.";
        }

        if (
            codigo === "email_not_confirmed" ||
            texto.includes("email not confirmed")
        ) {
            return "Debes confirmar tu correo antes de iniciar sesión.";
        }

        if (
            codigo === "user_already_exists" ||
            texto.includes("user already registered")
        ) {
            return "Ya existe una cuenta con ese correo.";
        }

        if (
            codigo === "weak_password" ||
            texto.includes("password should be")
        ) {
            return "La contraseña no cumple los requisitos de seguridad.";
        }

        if (
            texto.includes("rate limit") ||
            texto.includes("too many requests")
        ) {
            return "Has realizado demasiados intentos. Espera un momento.";
        }

        return "No se pudo completar la operación. Verifica los datos e inténtalo nuevamente.";
    }

});
