/* =========================================
   PHONE PLANET - SEGURIDAD GENERAL
========================================= */

(() => {
    "use strict";

    const TIEMPO_INACTIVIDAD = 15 * 60 * 1000;
    const PAGINA_LOGIN = "LOGIN.html";

    let temporizador = null;
    let comprobandoSesion = false;
    let cerrandoSesion = false;

    function irAlLogin() {
        // replace() evita que esta página quede en el historial:
        // la flecha "atrás" no puede volver al panel.
        window.location.replace(PAGINA_LOGIN);
    }

    function limpiarSesionLocal() {
        try {
            Object.keys(localStorage)
                .filter(clave => /^sb-.*-auth-token/.test(clave))
                .forEach(clave => localStorage.removeItem(clave));
        } catch (_) {
            // El almacenamiento puede estar bloqueado.
        }
    }

    async function protegerPagina() {
        if (comprobandoSesion || cerrandoSesion) return;

        comprobandoSesion = true;

        document.documentElement.style.visibility = "hidden";

        try {
            const { data, error } =
                await clienteSupabase.auth.getUser();

            if (error || !data.user) {
                irAlLogin();
                return;
            }

            document.documentElement.style.visibility = "visible";
            reiniciarTemporizador();

        } catch (error) {
            console.error("Error comprobando sesión:", error);
            irAlLogin();

        } finally {
            comprobandoSesion = false;
        }
    }

    function reiniciarTemporizador() {
        if (cerrandoSesion) return;

        clearTimeout(temporizador);

        temporizador = setTimeout(() => {
            cerrarSesion("Tu sesión se cerró por inactividad.");
        }, TIEMPO_INACTIVIDAD);
    }

    async function cerrarSesion(
        motivo = "Sesión cerrada correctamente."
    ) {
        if (cerrandoSesion) return;

        cerrandoSesion = true;
        clearTimeout(temporizador);

        // Ocultar de inmediato lo que haya en pantalla.
        document.documentElement.style.visibility = "hidden";

        try {
            sessionStorage.setItem("phonePlanetMensaje", motivo);
        } catch (_) {
            // Sin almacenamiento simplemente no se muestra el aviso.
        }

        try {
            const { error } =
                await clienteSupabase.auth.signOut();

            if (error) {
                console.error("Error cerrando sesión:", error);
            }
        } catch (error) {
            console.error("Error cerrando sesión:", error);
        } finally {
            limpiarSesionLocal();
            irAlLogin();
        }
    }

    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(
        evento => {
            document.addEventListener(
                evento,
                reiniciarTemporizador,
                { passive: true }
            );
        }
    );

    // Redirigir solo cuando la sesión se haya cerrado realmente
    // (también cuando se cierra desde otra pestaña).
    clienteSupabase.auth.onAuthStateChange((evento) => {
        if (evento === "SIGNED_OUT") {
            irAlLogin();
        }
    });

    // Al volver con la flecha "atrás" el navegador puede restaurar la
    // página desde su memoria (bfcache) con todo su estado anterior.
    // Se vuelve a comprobar la sesión siempre.
    window.addEventListener("pageshow", (evento) => {
        if (cerrandoSesion) {
            irAlLogin();
            return;
        }

        if (evento.persisted) {
            comprobandoSesion = false;
        }

        protegerPagina();
    });

    protegerPagina();

    // Permitir que otros archivos usen estas funciones.
    const api = { cerrarSesion, reiniciarTemporizador };
    window.PhonePlanetSeguridad = api;
    window.GeoNorteSeguridad = api; // nombre anterior, por compatibilidad
})();
