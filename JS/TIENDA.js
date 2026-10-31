/* =========================================
   PHONE PLANET - CATALOGO, CARRITO Y PEDIDO POR WHATSAPP
   El carrito se conserva en localStorage.
========================================= */

"use strict";

/* =========================================
   CONFIGURACIÓN - CAMBIA SOLO ESTO
   Número de WhatsApp que recibirá los pedidos.
   Escríbelo con el código de país y sin +, espacios ni guiones.
   Colombia = 57. Ejemplo: "573001234567"
========================================= */
const WHATSAPP_NUMERO = "";

const productos = [
    {
        id: "funda-space",
        nombre: "Funda Space Astronaut",
        categoria: "Fundas",
        precio: 25000,
        imagen: "IMG/funda-space.png",
        colores: [
            { nombre: "Negro", valor: "#111111" },
            { nombre: "Azul", valor: "#147bff" },
            { nombre: "Rosado", valor: "#ed35cf" },
            { nombre: "Blanco", valor: "#f4f4f4" }
        ],
        etiqueta: "Destacado"
    },
    {
        id: "funda-transparente",
        nombre: "Funda Transparente",
        categoria: "Fundas",
        precio: 20000,
        imagen: "IMG/funda-transparente.png",
        colores: [
            { nombre: "Transparente", valor: "#e6edf7" },
            { nombre: "Negro", valor: "#171717" }
        ],
        etiqueta: ""
    },
    {
        id: "audifonos",
        nombre: "Audífonos Inalámbricos",
        categoria: "Audífonos",
        precio: 100000,
        imagen: "IMG/audifonos.png",
        colores: [
            { nombre: "Negro", valor: "#111111" },
            { nombre: "Blanco", valor: "#f4f4f4" },
            { nombre: "Morado", valor: "#8d38e9" },
            { nombre: "Rosado", valor: "#ef65b9" }
        ],
        etiqueta: "Popular"
    },
    {
        id: "cargador",
        nombre: "Cargador Rápido 20W",
        categoria: "Cargadores",
        precio: 45000,
        imagen: "IMG/cargador.png",
        colores: [
            { nombre: "Blanco", valor: "#f4f4f4" },
            { nombre: "Negro", valor: "#171717" }
        ],
        etiqueta: ""
    },
    {
        id: "cable-tipo-c",
        nombre: "Cable Tipo C",
        categoria: "Cables",
        precio: 20000,
        imagen: "IMG/cable-tipo-c.png",
        colores: [
            { nombre: "Negro", valor: "#111111" },
            { nombre: "Blanco", valor: "#f4f4f4" },
            { nombre: "Rojo", valor: "#e52d37" },
            { nombre: "Azul", valor: "#1269e8" }
        ],
        etiqueta: ""
    },
    {
        id: "smartwatch",
        nombre: "Smartwatch X8",
        categoria: "Smartwatches",
        precio: 150000,
        imagen: "IMG/smartwatch.png",
        colores: [
            { nombre: "Negro", valor: "#111111" },
            { nombre: "Rosado", valor: "#ed70b8" },
            { nombre: "Beige", valor: "#e9d6b8" }
        ],
        etiqueta: "Nuevo"
    }
];

const CLAVE_CARRITO = "phonePlanetCarrito";
const formatoCOP = valor => new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
}).format(valor);

const porId = id => document.getElementById(id);
const rejillaProductos = porId("rejilla-productos");
const contadorCarrito = porId("contador-carrito");
const panelCarrito = porId("panel-carrito");
const fondoModal = porId("fondo-modal");
const listaCarrito = porId("lista-carrito");
const carritoVacio = porId("carrito-vacio");
const subtotalCarrito = porId("subtotal-carrito");
const toast = porId("toast");

let carrito = cargarCarrito();
let categoriaActiva = "Todos";
let textoBusqueda = "";
let toastTimeout;

function cargarCarrito() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || "[]");
        if (!Array.isArray(datos)) return [];
        return datos.filter(item =>
            item && typeof item.id === "string" &&
            typeof item.color === "string" &&
            productos.some(p => p.id === item.id) &&
            Number.isInteger(Number(item.cantidad)) &&
            Number(item.cantidad) > 0
        ).map(item => ({
            id: item.id,
            color: item.color,
            precio: productos.find(p => p.id === item.id).precio,
            cantidad: Math.min(10, Number(item.cantidad))
        }));
    } catch {
        return [];
    }
}

function guardarCarrito() {
    try {
        localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    } catch {
        mostrarToast("No fue posible guardar el carrito en este navegador.");
    }
    renderizarCarrito();
}

function escaparHTML(valor) {
    return String(valor).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[caracter]));
}

function renderizarProductos() {
    const lista = productos.filter(producto => {
        const coincideCategoria = categoriaActiva === "Todos" || producto.categoria === categoriaActiva;
        const busqueda = `${producto.nombre} ${producto.categoria}`.toLocaleLowerCase("es");
        return coincideCategoria && busqueda.includes(textoBusqueda);
    });

    rejillaProductos.replaceChildren();

    if (lista.length === 0) {
        rejillaProductos.innerHTML = `
            <div class="sin-resultados">
                <i class="fa-solid fa-satellite-dish"></i>
                <strong>No encontramos productos</strong>
                <p>Prueba con otro nombre o selecciona otra categoría.</p>
            </div>`;
        return;
    }

    lista.forEach(producto => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-producto";
        tarjeta.dataset.id = producto.id;

        const colores = producto.colores.map((color, indice) => `
            <button
                type="button"
                class="opcion-color"
                style="background:${color.valor}"
                data-color="${escaparHTML(color.nombre)}"
                aria-label="Color ${escaparHTML(color.nombre)}"
                aria-pressed="${indice === 0 ? "true" : "false"}"
                title="${escaparHTML(color.nombre)}">
            </button>`).join("");

        tarjeta.innerHTML = `
            <div class="imagen-producto">
                ${producto.etiqueta ? `<span class="etiqueta-producto">${escaparHTML(producto.etiqueta)}</span>` : ""}
                <img src="${escaparHTML(producto.imagen)}"
                     alt="${escaparHTML(producto.nombre)}"
                     loading="lazy"
                     onerror="this.onerror=null;this.src='IMG/fondo-galactico.png';">
            </div>
            <div class="detalle-producto">
                <span class="categoria-producto">${escaparHTML(producto.categoria)}</span>
                <h3 class="nombre-producto">${escaparHTML(producto.nombre)}</h3>
                <p class="precio-producto">${formatoCOP(producto.precio)}</p>
                <div class="opciones-producto">
                    <span class="etiqueta-opcion">Color: <strong class="color-elegido">${escaparHTML(producto.colores[0].nombre)}</strong></span>
                    <div class="colores-producto">${colores}</div>
                    <div class="fila-cantidad">
                        <label class="etiqueta-opcion" for="cantidad-${producto.id}">Cantidad</label>
                        <select class="selector-cantidad" id="cantidad-${producto.id}" aria-label="Cantidad de ${escaparHTML(producto.nombre)}">
                            ${Array.from({length:10}, (_,i) => `<option value="${i+1}" ${i === 0 ? "selected" : ""}>${i+1}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <button type="button" class="boton-agregar">
                    <i class="fa-solid fa-cart-plus"></i> Agregar al carrito
                </button>
            </div>`;

        tarjeta.querySelectorAll(".opcion-color").forEach(boton => {
            boton.addEventListener("click", () => {
                tarjeta.querySelectorAll(".opcion-color").forEach(opcion =>
                    opcion.setAttribute("aria-pressed", String(opcion === boton))
                );
                tarjeta.querySelector(".color-elegido").textContent = boton.dataset.color;
            });
        });

        tarjeta.querySelector(".boton-agregar").addEventListener("click", () => agregarProducto(producto, tarjeta));
        rejillaProductos.appendChild(tarjeta);
    });
}

function agregarProducto(producto, tarjeta) {
    const colorSeleccionado = tarjeta.querySelector('.opcion-color[aria-pressed="true"]');
    const color = colorSeleccionado ? colorSeleccionado.dataset.color : producto.colores[0].nombre;
    const cantidad = Number(tarjeta.querySelector(".selector-cantidad").value);

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10) {
        mostrarToast("Selecciona una cantidad válida entre 1 y 10.");
        return;
    }

    const existente = carrito.find(item => item.id === producto.id && item.color === color);
    if (existente) {
        if (existente.cantidad + cantidad > 10) {
            mostrarToast("Máximo 10 unidades por producto y color.");
            return;
        }
        existente.cantidad += cantidad;
    } else {
        carrito.push({ id: producto.id, color, precio: producto.precio, cantidad });
    }

    guardarCarrito();
    mostrarToast(`${producto.nombre} agregado al carrito.`);
}

function renderizarCarrito() {
    const cantidadTotal = carrito.reduce((suma, item) => suma + item.cantidad, 0);
    contadorCarrito.textContent = cantidadTotal;
    contadorCarrito.setAttribute("aria-label", `${cantidadTotal} artículos en el carrito`);

    listaCarrito.replaceChildren();
    carritoVacio.hidden = carrito.length > 0;
    listaCarrito.hidden = carrito.length === 0;

    carrito.forEach(item => {
        const producto = productos.find(p => p.id === item.id);
        if (!producto) return;

        const fila = document.createElement("article");
        fila.className = "item-carrito";
        fila.innerHTML = `
            <img src="${escaparHTML(producto.imagen)}" alt="${escaparHTML(producto.nombre)}">
            <div class="info-item-carrito">
                <strong>${escaparHTML(producto.nombre)}</strong>
                <small>Color: ${escaparHTML(item.color)}</small>
                <div class="precio-item-carrito">${formatoCOP(item.precio * item.cantidad)}</div>
                <div class="controles-item">
                    <button type="button" data-accion="restar" aria-label="Reducir cantidad">−</button>
                    <span>${item.cantidad}</span>
                    <button type="button" data-accion="sumar" aria-label="Aumentar cantidad">+</button>
                    <button type="button" data-accion="eliminar" class="eliminar-item" aria-label="Eliminar producto">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <span></span>`;

        fila.querySelector('[data-accion="restar"]').addEventListener("click", () => cambiarCantidad(item, -1));
        fila.querySelector('[data-accion="sumar"]').addEventListener("click", () => cambiarCantidad(item, 1));
        fila.querySelector('[data-accion="eliminar"]').addEventListener("click", () => eliminarProducto(item));
        listaCarrito.appendChild(fila);
    });

    subtotalCarrito.textContent = formatoCOP(calcularSubtotal());
    porId("vaciar-carrito").disabled = carrito.length === 0;
}

function cambiarCantidad(item, cambio) {
    const producto = carrito.find(p => p.id === item.id && p.color === item.color);
    if (!producto) return;
    const nuevaCantidad = producto.cantidad + cambio;

    if (nuevaCantidad < 1) {
        eliminarProducto(item);
        return;
    }
    if (nuevaCantidad > 10) {
        mostrarToast("Máximo 10 unidades por producto y color.");
        return;
    }

    producto.cantidad = nuevaCantidad;
    guardarCarrito();
}

function eliminarProducto(item) {
    carrito = carrito.filter(p => !(p.id === item.id && p.color === item.color));
    guardarCarrito();
    mostrarToast("Producto eliminado del carrito.");
}

function vaciarCarrito() {
    if (carrito.length === 0) return;
    carrito = [];
    guardarCarrito();
    mostrarToast("Se vació el carrito.");
}

function abrirCarrito() {
    panelCarrito.classList.add("abierto");
    panelCarrito.setAttribute("aria-hidden", "false");
    fondoModal.hidden = false;
    document.body.classList.add("carrito-abierto");
    porId("cerrar-carrito").focus();
}

function cerrarCarrito() {
    panelCarrito.classList.remove("abierto");
    panelCarrito.setAttribute("aria-hidden", "true");
    fondoModal.hidden = true;
    document.body.classList.remove("carrito-abierto");
    porId("abrir-carrito").focus();
}

function mostrarToast(mensaje) {
    toast.textContent = mensaje;
    toast.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2600);
}

/* BÚSQUEDA Y FILTROS */
porId("form-busqueda").addEventListener("submit", evento => evento.preventDefault());

porId("buscar-productos").addEventListener("input", evento => {
    textoBusqueda = evento.target.value.trim().toLocaleLowerCase("es");
    porId("limpiar-busqueda").hidden = !evento.target.value;
    renderizarProductos();
});

porId("limpiar-busqueda").addEventListener("click", () => {
    porId("buscar-productos").value = "";
    textoBusqueda = "";
    porId("limpiar-busqueda").hidden = true;
    renderizarProductos();
});

porId("filtro-categoria").addEventListener("change", evento => {
    categoriaActiva = evento.target.value;
    renderizarProductos();
});

document.querySelectorAll(".tarjeta-categoria").forEach(boton => {
    boton.addEventListener("click", () => {
        categoriaActiva = boton.dataset.categoria;
        porId("filtro-categoria").value = categoriaActiva;
        renderizarProductos();
        porId("productos").scrollIntoView({ behavior: "smooth" });
    });
});

/* PANEL DEL CARRITO */
porId("abrir-carrito").addEventListener("click", abrirCarrito);
porId("cerrar-carrito").addEventListener("click", cerrarCarrito);
porId("seguir-comprando").addEventListener("click", cerrarCarrito);
fondoModal.addEventListener("click", cerrarCarrito);
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && panelCarrito.classList.contains("abierto")) cerrarCarrito();
});
porId("vaciar-carrito").addEventListener("click", vaciarCarrito);

/* PEDIDO POR WHATSAPP */
const dialogoPedido = porId("dialogo-pedido");
const formPedido = porId("form-pedido");
const errorPedido = porId("pedido-error");
const CLAVE_CLIENTE = "phonePlanetCliente";

const calcularSubtotal = () => carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);

function numeroWhatsAppValido() {
    return /^\d{10,15}$/.test(WHATSAPP_NUMERO);
}

// Quita los caracteres que WhatsApp interpreta como formato (*, _, ~, `).
function limpiarTexto(valor) {
    return String(valor).replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
}

function mostrarErrorPedido(mensaje) {
    errorPedido.textContent = mensaje;
    errorPedido.hidden = !mensaje;
}

function abrirPedido() {
    if (carrito.length === 0) {
        mostrarToast("Tu carrito está vacío. Agrega productos primero.");
        return;
    }
    if (!numeroWhatsAppValido()) {
        console.error("Phone Planet: falta configurar WHATSAPP_NUMERO en JS/TIENDA.js (ej. \"573001234567\").");
        mostrarToast("Los pedidos por WhatsApp aún no están disponibles.");
        return;
    }

    try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE_CLIENTE) || "{}");
        ["nombre", "ciudad", "telefono", "direccion"].forEach(campo => {
            if (guardado[campo] && !formPedido.elements[campo].value) {
                formPedido.elements[campo].value = String(guardado[campo]).slice(0, 120);
            }
        });
    } catch { /* sin datos guardados */ }

    mostrarErrorPedido("");
    formPedido.querySelectorAll("[aria-invalid]").forEach(campo => campo.removeAttribute("aria-invalid"));
    porId("pedido-total").textContent = formatoCOP(calcularSubtotal());
    document.body.classList.add("pedido-abierto");
    dialogoPedido.showModal();
}

function cerrarPedido() {
    if (dialogoPedido.open) dialogoPedido.close();
}

dialogoPedido.addEventListener("close", () => document.body.classList.remove("pedido-abierto"));
porId("cerrar-pedido").addEventListener("click", cerrarPedido);
porId("cancelar-pedido").addEventListener("click", cerrarPedido);

function construirMensaje(cliente) {
    const lineas = carrito.map((item, indice) => {
        const producto = productos.find(p => p.id === item.id);
        const nombre = producto ? producto.nombre : item.id;
        return `${indice + 1}. ${nombre} - Color: ${item.color} - ${item.cantidad} x ${formatoCOP(item.precio)} = ${formatoCOP(item.precio * item.cantidad)}`;
    });

    const partes = [
        "*Nuevo pedido - Phone Planet*",
        "",
        `*Cliente:* ${cliente.nombre}`,
        `*Celular:* ${cliente.telefono}`,
        `*Ciudad:* ${cliente.ciudad}`,
        `*Dirección:* ${cliente.direccion}`,
        "",
        "*Pedido:*",
        ...lineas,
        "",
        `*Total productos:* ${formatoCOP(calcularSubtotal())}`
    ];

    if (cliente.notas) partes.push("", `*Notas:* ${cliente.notas}`);
    partes.push("", "El envío y el pago los coordinamos por este chat.");

    return partes.join("\n");
}

function enviarPorWhatsApp(mensaje) {
    const enlace = document.createElement("a");
    enlace.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
}

formPedido.addEventListener("submit", evento => {
    evento.preventDefault();

    const datos = {
        nombre: limpiarTexto(formPedido.elements.nombre.value),
        ciudad: limpiarTexto(formPedido.elements.ciudad.value),
        telefono: formPedido.elements.telefono.value.replace(/[^\d+]/g, ""),
        direccion: limpiarTexto(formPedido.elements.direccion.value),
        notas: limpiarTexto(formPedido.elements.notas.value)
    };

    const errores = {
        nombre: datos.nombre.length < 3 ? "Escribe tu nombre completo." : "",
        telefono: datos.telefono.replace(/\D/g, "").length < 7 ? "Escribe un número de celular válido." : "",
        ciudad: datos.ciudad.length < 2 ? "Escribe tu ciudad." : "",
        direccion: datos.direccion.length < 5 ? "Escribe la dirección de entrega." : ""
    };

    ["nombre", "telefono", "ciudad", "direccion"].forEach(campo => {
        if (errores[campo]) formPedido.elements[campo].setAttribute("aria-invalid", "true");
        else formPedido.elements[campo].removeAttribute("aria-invalid");
    });

    const primerError = Object.keys(errores).find(campo => errores[campo]);
    if (primerError) {
        mostrarErrorPedido(errores[primerError]);
        formPedido.elements[primerError].focus();
        return;
    }

    if (carrito.length === 0) {
        mostrarErrorPedido("Tu carrito está vacío.");
        return;
    }

    mostrarErrorPedido("");

    try {
        localStorage.setItem(CLAVE_CLIENTE, JSON.stringify({
            nombre: datos.nombre,
            ciudad: datos.ciudad,
            telefono: datos.telefono,
            direccion: datos.direccion
        }));
    } catch { /* no se pudo recordar los datos */ }

    enviarPorWhatsApp(construirMensaje(datos));
    cerrarPedido();
    mostrarToast("Se abrió WhatsApp. Envía el mensaje para confirmar tu pedido.");
});

porId("boton-pagar").addEventListener("click", abrirPedido);
porId("portada-carrito").addEventListener("click", abrirCarrito);

/* MENÚ MÓVIL */
const botonMenu = porId("menu-movil");
const navegacion = porId("navegacion");
botonMenu.addEventListener("click", () => {
    const abierto = navegacion.classList.toggle("abierto");
    botonMenu.setAttribute("aria-expanded", String(abierto));
    botonMenu.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
});
navegacion.querySelectorAll("a").forEach(enlace => {
    enlace.addEventListener("click", () => {
        navegacion.classList.remove("abierto");
        botonMenu.setAttribute("aria-expanded", "false");
    });
});

porId("anio-actual").textContent = new Date().getFullYear();
renderizarProductos();
renderizarCarrito();
