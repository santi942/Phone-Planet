
/* =========================================
   PHONE PLANET - SEGURIDAD DE SESIÓN
   Requiere: JS/SUPABASE.js
========================================= */

(() => {
    "use strict";

    const TIEMPO_INACTIVIDAD = 15 * 60 * 1000;

    // MENU.html y LOGIN.html están en la misma carpeta.
    const PAGINA_LOGIN = "LOGIN.html";

    let temporizador = null;
    let comprobandoSesion = false;
    let cerrandoSesion = false;
    let paginaProtegida = false;

    // Obtener el cliente inicializado por SUPABASE.js.
    function obtenerClienteSeguro() {
        if (typeof window.obtenerClienteSupabase === "function") {
            return window.obtenerClienteSupabase();
        }

        return window.clienteSupabase || null;
    }

    const supabase = obtenerClienteSeguro();

    function irAlLogin() {
        window.location.replace(PAGINA_LOGIN);
    }

    function mostrarPagina() {
        document.documentElement.style.visibility = "visible";
    }

    function ocultarPagina() {
        document.documentElement.style.visibility = "hidden";
    }

    function reiniciarTemporizador() {
        if (!paginaProtegida || cerrandoSesion) return;

        clearTimeout(temporizador);

        temporizador = setTimeout(() => {
            cerrarSesion("Tu sesión se cerró por inactividad.");
        }, TIEMPO_INACTIVIDAD);
    }

    async function cerrarSesion(mensaje = "") {
        if (cerrandoSesion) return;

        cerrandoSesion = true;
        paginaProtegida = false;

        clearTimeout(temporizador);

        try {
            if (mensaje) {
                sessionStorage.setItem(
                    "phonePlanetMensaje",
                    mensaje
                );
            }

            if (supabase) {
                const { error } = await supabase.auth.signOut();

                if (error) {
                    console.error(
                        "Phone Planet: error al cerrar sesión:",
                        error.message
                    );
                }
            }
        } catch (error) {
            console.error(
                "Phone Planet: no se pudo cerrar la sesión:",
                error
            );
        } finally {
            irAlLogin();
        }
    }

    async function protegerPagina() {
        if (comprobandoSesion || cerrandoSesion) return;

        comprobandoSesion = true;
        ocultarPagina();

        try {
            if (!supabase) {
                throw new Error(
                    "No se ha inicializado el cliente de Supabase."
                );
            }

            const {
                data: { session },
                error
            } = await supabase.auth.getSession();

            if (error) throw error;

            if (!session) {
                console.warn(
                    "Phone Planet: no hay una sesión activa."
                );

                irAlLogin();
                return;
            }

            // Validar la sesión con el servidor.
            const {
                data: { user },
                error: errorUsuario
            } = await supabase.auth.getUser();

            if (errorUsuario || !user) {
                console.warn(
                    "Phone Planet: la sesión no es válida."
                );

                irAlLogin();
                return;
            }

            paginaProtegida = true;
            mostrarPagina();
            reiniciarTemporizador();

        } catch (error) {
            console.error(
                "Phone Planet: error al comprobar la sesión:",
                error
            );

            irAlLogin();

        } finally {
            comprobandoSesion = false;
        }
    }

    // Actividad del usuario.
    [
        "pointerdown",
        "keydown",
        "scroll",
        "touchstart"
    ].forEach(evento => {
        document.addEventListener(
            evento,
            reiniciarTemporizador,
            { passive: true }
        );
    });

    // Solo redirigir cuando se cierre realmente una sesión
    // de una página protegida. No redirigir por eventos
    // de inicialización que todavía no tengan sesión.
    if (supabase) {
        supabase.auth.onAuthStateChange((evento) => {
            if (
                evento === "SIGNED_OUT" &&
                paginaProtegida &&
                !cerrandoSesion
            ) {
                paginaProtegida = false;
                clearTimeout(temporizador);
                irAlLogin();
            }
        });
    }

    // Revalidar al cargar o regresar a la página.
    window.addEventListener("pageshow", () => {
        protegerPagina();
    });

    // Proteger el menú desde el inicio.
    protegerPagina();

    // Permitir que otros scripts cierren la sesión.
    window.PhonePlanetSeguridad = {
        cerrarSesion,
        reiniciarTemporizador
    };

})();
