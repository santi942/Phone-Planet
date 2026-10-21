/* =========================================
   PHONE PLANET - SEGURIDAD DE SESIÓN
   Incluir únicamente en páginas protegidas, como MENU.html.
========================================= */
(() => {
    "use strict";

    const TIEMPO_INACTIVIDAD = 15 * 60 * 1000;
    const PAGINA_LOGIN = "LOGIN.html";
    let temporizador = null;
    let comprobandoSesion = false;
    let cerrandoSesion = false;
    let paginaProtegida = false;

    const supabase = typeof window.obtenerClienteSupabase === "function"
        ? window.obtenerClienteSupabase()
        : (window.clienteSupabase || null);

    function irAlLogin(mensaje) {
        if (mensaje) {
            try { sessionStorage.setItem("phonePlanetMensaje", mensaje); } catch (_) {}
        }
        window.location.replace(PAGINA_LOGIN);
    }

    function mostrarPagina() { document.documentElement.style.visibility = "visible"; }
    function ocultarPagina() { document.documentElement.style.visibility = "hidden"; }

    function reiniciarTemporizador() {
        if (!paginaProtegida || cerrandoSesion) return;
        clearTimeout(temporizador);
        temporizador = setTimeout(() => cerrarSesion("Tu sesión se cerró por inactividad."), TIEMPO_INACTIVIDAD);
    }

    async function cerrarSesion(mensaje = "") {
        if (cerrandoSesion) return;
        cerrandoSesion = true;
        paginaProtegida = false;
        clearTimeout(temporizador);
        try {
            if (supabase) {
                const { error } = await supabase.auth.signOut();
                if (error) console.error("Phone Planet: error al cerrar sesión:", error.message);
            }
        } catch (error) {
            console.error("Phone Planet: no se pudo cerrar la sesión:", error);
        } finally {
            irAlLogin(mensaje);
        }
    }

    async function protegerPagina() {
        if (comprobandoSesion || cerrandoSesion) return;
        comprobandoSesion = true;
        ocultarPagina();
        try {
            if (!supabase) throw new Error("No se inicializó el cliente de Supabase.");
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (!data?.session) {
                irAlLogin("Inicia sesión para acceder a Phone Planet.");
                return;
            }
            const { data: usuario, error: errorUsuario } = await supabase.auth.getUser();
            if (errorUsuario || !usuario?.user) {
                irAlLogin("Tu sesión expiró. Inicia sesión nuevamente.");
                return;
            }
            paginaProtegida = true;
            mostrarPagina();
            reiniciarTemporizador();
        } catch (error) {
            console.error("Phone Planet: error comprobando sesión:", error);
            irAlLogin("No se pudo validar la sesión. Inicia sesión nuevamente.");
        } finally {
            comprobandoSesion = false;
        }
    }

    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizador, { passive: true });
    });

    if (supabase) {
        supabase.auth.onAuthStateChange((evento) => {
            if (evento === "SIGNED_OUT" && paginaProtegida && !cerrandoSesion) {
                paginaProtegida = false;
                clearTimeout(temporizador);
                irAlLogin("La sesión se cerró. Vuelve a ingresar.");
            }
        });
    }

    window.addEventListener("pageshow", protegerPagina);
    protegerPagina();
    window.PhonePlanetSeguridad = { cerrarSesion, reiniciarTemporizador };
})();
