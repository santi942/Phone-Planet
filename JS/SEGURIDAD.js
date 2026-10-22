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
        window.location.replace(PAGINA_LOGIN);
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
            cerrarSesion();
        }, TIEMPO_INACTIVIDAD);
    }

    async function cerrarSesion() {
        if (cerrandoSesion) return;

        cerrandoSesion = true;
        clearTimeout(temporizador);

        try {
            const { error } =
                await clienteSupabase.auth.signOut();

            if (error) {
                console.error("Error cerrando sesión:", error);
            }
        } catch (error) {
            console.error("Error cerrando sesión:", error);
        } finally {
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

    // Redirigir solo cuando la sesión se haya cerrado realmente.
    clienteSupabase.auth.onAuthStateChange((evento) => {
        if (evento === "SIGNED_OUT") {
            irAlLogin();
        }
    });

    // Comprobar la sesión al cargar o restaurar la página.
    window.addEventListener("pageshow", protegerPagina);

    protegerPagina();

    // Permitir que otros archivos usen estas funciones.
    window.GeoNorteSeguridad = {
        cerrarSesion,
        reiniciarTemporizador
    };
})();