/* =====================================================
   PHONE PLANET - MENU conectado a Supabase
   Conserva el HTML/CSS y los formularios existentes.
   ===================================================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const db = window.clienteSupabase || window.supabaseClient || (typeof clienteSupabase !== "undefined" ? clienteSupabase : null);
  let currentUser = null;
  let currentProfile = null;
  let persistedState = null;
  let saveQueue = Promise.resolve();

  const money = (value) => new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const dateText = (value) => new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  });

  const today = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const PAYMENT_METHODS = [
    "Efectivo",
    "Bold",
    "QR Bold",
    "Transferencia Bancolombia"
  ];

  const LOCAL_NAME = "Phone Planet";
  const LOCAL_NIT = "PENDIENTE POR CONFIGURAR";
  let state = emptyState();
  let role = "empleado";
  let activeModule = null;
  let catalogUnavailable = false;

  const modules = [
    {
      id: "sales",
      icon: "🛍️",
      title: "Registrar ventas",
      desc: "Registra ventas y consulta sus detalles.",
      roles: ["administrador", "empleado"]
    },
    {
      id: "incoming",
      icon: "📦",
      title: "Entrada de mercancía",
      desc: "Registra mercancía recibida y actualiza stock.",
      roles: ["administrador", "empleado"]
    },
    
    {
      id: "warranties",
      icon: "🛡️",
      title: "Garantías",
      desc: "Registra garantías, calcula vencimientos y comparte comprobantes.",
      roles: ["administrador", "empleado"]
    },

    {
      id: "stock",
      icon: "📱",
      title: "Stock de productos",
      desc: "Crea, edita y elimina productos del catálogo.",
      roles: ["administrador"]
    },
    {
      id: "catalog",
      icon: "🖼️",
      title: "Catálogo de la tienda",
      desc: "Crea y administra los productos que se publican en la página web.",
      roles: ["administrador"]
    },
    {
      id: "salesHistory",
      icon: "📈",
      title: "Historial de ventas",
      desc: "Consulta ventas y cuánto vendió cada empleado.",
      roles: ["administrador"]
    },
    {
      id: "employees",
      icon: "👥",
      title: "Empleados",
      desc: "Consulta los usuarios y roles registrados en Supabase.",
      roles: ["administrador"]
    },
    {
      id: "incomingHistory",
      icon: "🧾",
      title: "Historial de mercancía",
      desc: "Consulta las entradas de inventario.",
      roles: ["administrador"]
    },
    {
      id: "expenses",
      icon: "💳",
      title: "Historial de gastos",
      desc: "Registra y consulta gastos de la tienda.",
      roles: ["administrador"]
    },
    {
      id: "payroll",
      icon: "💵",
      title: "Historial de nómina",
      desc: "Registra pagos de nómina de prueba.",
      roles: ["administrador"]
    },
    {
      id: "rent",
      icon: "🏢",
      title: "Historial de arriendo",
      desc: "Registra pagos de arriendo.",
      roles: ["administrador"]
    },
    {
      id: "monthClose",
      icon: "🗓️",
      title: "Cierre de mes",
      desc: "Resumen mensual por medio de pago: ventas, pagos y sobrante que pasa al mes siguiente.",
      roles: ["administrador"]
    }
  ];


  function emptyState() {
    return {
      employees: [],
      products: [],
      sales: [],
      incoming: [],
      expenses: [],
      payroll: [],
      rent: [],
      warranties: [],
      catalog: []
    };
  }


  const clone = value => JSON.parse(JSON.stringify(value));
  const resultOrThrow = (result, label) => {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
    return result.data;
  };

  // Lee una tabla con su columna medio_pago. Si todavía no existe (falta el SQL),
  // se consulta sin ella para no romper el sistema.
  let paymentColumnsMissing = false;

  async function selectWithPayment(table, columns, orderColumn) {
    const run = cols => db.from(table).select(cols).order(orderColumn, { ascending: false });
    const first = await run(`${columns},medio_pago`);

    if (first.error && first.error.code === "42703") {
      paymentColumnsMissing = true;
      return run(columns);
    }

    return first;
  }

  async function loadSupabaseState() {
    if (!db) throw new Error("No se encontró window.clienteSupabase. Revisa que SUPABASE.js se cargue antes de MENU.js.");
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError) throw authError;
    currentUser = authData?.user;
    if (!currentUser) throw new Error("No hay una sesión activa. Inicia sesión nuevamente.");

    
    const profileResult = await db
  .from("perfiles")
  .select("id,nombre,rol,codigo_usuario,email,activo")
  .eq("id", currentUser.id)
  .single();

    currentProfile = resultOrThrow(profileResult, "No se pudo consultar el perfil");
    const normalizedRole = String(currentProfile.rol || "").toLowerCase();
    role = normalizedRole.includes("admin") || normalizedRole === "administrador" ? "administrador" : "empleado";

    let [productsR, profilesR, salesR, detailsR, incomingR] = await Promise.all([
      db.from("productos").select("id,codigo,nombre,descripcion,precio,stock,nivel_reorden,activo,creado_en").eq("activo", true).order("nombre"),
     db.from("perfiles")
  .select("id,nombre,rol,codigo_usuario,email,activo")
  .order("nombre"),
      db.from("ventas").select("id,empleado_id,empleado_nombre,fecha,medio_pago,nota,subtotal,descuento,total,creado_en").order("fecha", { ascending: false }),
      db.from("detalle_ventas").select("id,venta_id,producto_id,codigo_producto,nombre_producto,cantidad,precio_original,descuento_unitario,precio_unitario,total_linea"),
      selectWithPayment("entradas_mercancia", "id,producto_id,registrado_por,fecha,cantidad,costo_unitario,costo_total,proveedor,observaciones,creado_en", "fecha")
    ]);
    // Si todavía no se ejecutó el SQL que agrega ventas.empleado_nombre,
    // se consulta sin esa columna para no romper el sistema.
    if (salesR.error && salesR.error.code === "42703") {
      salesR = await db.from("ventas").select("id,empleado_id,fecha,medio_pago,nota,subtotal,descuento,total,creado_en").order("fecha", { ascending: false });
    }
    const products = resultOrThrow(productsR, "No se pudieron cargar los productos");
    const profiles = resultOrThrow(profilesR, "No se pudieron cargar los perfiles");
    const sales = resultOrThrow(salesR, "No se pudieron cargar las ventas");
    const details = resultOrThrow(detailsR, "No se pudieron cargar los detalles de venta");
    const incoming = resultOrThrow(incomingR, "No se pudieron cargar las entradas de mercancía");
    
    // Cargar las garantías registradas en Supabase.
    const warrantiesR = await db
      .from("garantias")
      .select(`
        id,
        producto_id,
        venta_id,
        detalle_venta_id,
        registrado_por,
        comprador_nombre,
        comprador_documento,
        comprador_telefono,
        fecha_compra,
        duracion_valor,
        duracion_unidad,
        fecha_vencimiento,
        precio_venta,
        observaciones,
        creado_en
      `)
      .order("creado_en", { ascending: false });

    const warranties = resultOrThrow(
      warrantiesR,
      "No se pudieron cargar las garantías"
    );


    state = emptyState();
    state.products = products.map(p => ({ id:p.id, code:p.codigo, name:p.nombre, description:p.descripcion || p.nombre, price:Number(p.precio)||0, stock:Number(p.stock)||0, reorderLevel:Number(p.nivel_reorden)||0, active:p.activo }));
    state.employees = profiles.map(p => ({
  id: p.id,
  name: p.nombre || p.email || p.codigo_usuario || "Usuario",
  username: p.codigo_usuario,
  email: p.email,
  role: p.rol,
  active: p.activo === true
}));
    state.sales = details.map(d => {
      const sale = sales.find(s => s.id === d.venta_id) || {};
      return { id:d.id, transactionId:d.venta_id, employeeId:sale.empleado_id, employeeLabel:sale.empleado_nombre || "", productId:d.producto_id, productCode:d.codigo_producto, productName:d.nombre_producto, description:d.nombre_producto, qty:Number(d.cantidad)||0, originalUnitPrice:Number(d.precio_original)||0, discountPerUnit:Number(d.descuento_unitario)||0, unitPrice:Number(d.precio_unitario)||0, total:Number(d.total_linea)||0, paymentMethod:sale.medio_pago, date:sale.fecha, createdAt:sale.creado_en, note:sale.nota || "" };
    });
    state.incoming = incoming.map(e => {
      const product = products.find(p => p.id === e.producto_id);
      const profile = profiles.find(p => p.id === e.registrado_por);
      return { id:e.id, productId:e.producto_id, productName:product?.nombre || "Producto", code:product?.codigo || "—", qty:Number(e.cantidad)||0, unitValue:Number(e.costo_unitario)||0, totalCost:Number(e.costo_total)||0, date:e.fecha, supplier:e.proveedor || "", note:e.observaciones || "", employee:profile?.nombre || "Usuario", paymentMethod:e.medio_pago || "", createdAt:e.creado_en };
    });

    state.warranties = warranties.map(w => ({
      id: w.id,
      productId: w.producto_id,
      saleId: w.venta_id,
      saleDetailId: w.detalle_venta_id,
      registeredBy: w.registrado_por,
      buyerName: w.comprador_nombre,
      buyerDocument: w.comprador_documento || "",
      buyerPhone: w.comprador_telefono,
      purchaseDate: w.fecha_compra,
      durationValue: Number(w.duracion_valor),
      durationUnit: w.duracion_unidad,
      expirationDate: w.fecha_vencimiento,
      salePrice: Number(w.precio_venta) || 0,
      note: w.observaciones || "",
      createdAt: w.creado_en
    }));

    if (role === "administrador") {
      const [expensesR, payrollR, rentR] = await Promise.all([
        selectWithPayment("gastos", "id,registrado_por,fecha,concepto,valor,observaciones,creado_en", "fecha"),
        selectWithPayment("nomina", "id,empleado_id,registrado_por,periodo_inicio,periodo_fin,fecha_pago,concepto,valor,creado_en", "fecha_pago"),
        selectWithPayment("arriendos", "id,registrado_por,fecha_pago,periodo,concepto,valor,observaciones,creado_en", "fecha_pago")
      ]);
      state.expenses = resultOrThrow(expensesR, "No se pudieron cargar los gastos").map(x => ({ id:x.id, date:x.fecha, concept:x.concepto, amount:Number(x.valor)||0, note:x.observaciones||"", paymentMethod:x.medio_pago||"", createdAt:x.creado_en }));
      state.payroll = resultOrThrow(payrollR, "No se pudo cargar la nómina").map(x => ({ id:x.id, date:x.fecha_pago, concept:x.concepto, amount:Number(x.valor)||0, employeeId:x.empleado_id, periodStart:x.periodo_inicio, periodEnd:x.periodo_fin, paymentMethod:x.medio_pago||"", createdAt:x.creado_en }));
      // Catálogo de la tienda web (independiente del stock). Si todavía no existe
      // la tabla, el resto del sistema sigue funcionando.
      const catalogR = await db
        .from("catalogo_web")
        .select("id,referencia,nombre,descripcion,precio,categoria,colores,imagen_url,activo,creado_en")
        .order("creado_en", { ascending: false });

      if (catalogR.error) {
        console.warn("Catálogo de la tienda no disponible:", catalogR.error.message);
        catalogUnavailable = true;
        state.catalog = [];
      } else {
        catalogUnavailable = false;
        state.catalog = catalogR.data.map(c => ({
          id: c.id,
          reference: c.referencia,
          name: c.nombre,
          description: c.descripcion || "",
          price: Number(c.precio) || 0,
          category: c.categoria || "",
          colors: Array.isArray(c.colores) ? c.colores : [],
          imageUrl: c.imagen_url || "",
          active: c.activo !== false,
          createdAt: c.creado_en
        }));
      }

      state.rent = resultOrThrow(rentR, "No se pudo cargar el arriendo").map(x => ({ id:x.id, date:x.fecha_pago, period:x.periodo, concept:x.concepto, amount:Number(x.valor)||0, note:x.observaciones||"", paymentMethod:x.medio_pago||"", createdAt:x.creado_en }));
    }

    persistedState = clone(state);
  }

  function saveState() {
    const target = clone(state);
    saveQueue = saveQueue.then(() => syncChanges(persistedState || emptyState(), target)).then(() => {
      persistedState = target;
      return true;
    }).catch(error => {
      console.error("Error guardando en Supabase:", error);
      notify(`No se guardó en Supabase: ${error.message}`, "error");
      return false;
    });
    return true;
  }

  
async function syncChanges(previous, next) {
    if (!db || !currentUser) {
      throw new Error("No hay conexión autenticada con Supabase.");
    }

    // =====================================================
    // 1. PRODUCTOS
    // =====================================================
    const oldProducts = new Map((previous.products || []).map(x => [x.id, x]));
    const newProducts = new Map((next.products || []).map(x => [x.id, x]));

    for (const product of next.products || []) {
      const old = oldProducts.get(product.id);

      if (!old) {
        const payload = {
          codigo: product.code,
          nombre: product.name,
          descripcion: product.description || product.name,
          precio: product.price,
          stock: product.stock,
          nivel_reorden: product.reorderLevel ?? 5,
          activo: true
        };

        if (isUuid(product.id)) payload.id = product.id;

        const r = await db.from("productos").insert(payload);
        resultOrThrow(r, "No se pudo crear el producto");

      } else if (
        old.code !== product.code ||
        old.name !== product.name ||
        old.description !== product.description ||
        Number(old.price) !== Number(product.price) ||
        Number(old.reorderLevel) !== Number(product.reorderLevel)
      ) {
        const r = await db.from("productos")
          .update({
            codigo: product.code,
            nombre: product.name,
            descripcion: product.description || product.name,
            precio: product.price,
            nivel_reorden: product.reorderLevel ?? 5
          })
          .eq("id", product.id);

        resultOrThrow(r, "No se pudo actualizar el producto");
      }
    }

    for (const old of previous.products || []) {
      if (!newProducts.has(old.id)) {
        const r = await db.from("productos")
          .update({ activo: false })
          .eq("id", old.id);

        resultOrThrow(r, "No se pudo desactivar el producto");
      }
    }

    // =====================================================
    // 2. VENTAS
    // =====================================================
    const oldTransactions = new Set(
      (previous.sales || []).map(x => x.transactionId || x.id)
    );

    const newTransactions = new Map();

    for (const line of next.sales || []) {
      const key = line.transactionId || line.id;

      if (!oldTransactions.has(key)) {
        if (!newTransactions.has(key)) {
          newTransactions.set(key, []);
        }

        newTransactions.get(key).push(line);
      }
    }

    for (const lines of newTransactions.values()) {
      if (!lines.length) continue;

      const first = lines[0];

      const subtotal = lines.reduce(
        (sum, x) => sum + Number(x.originalUnitPrice || 0) * Number(x.qty || 0),
        0
      );

      const discount = lines.reduce(
        (sum, x) => sum + Number(x.discountPerUnit || 0) * Number(x.qty || 0),
        0
      );

      const total = lines.reduce(
        (sum, x) => sum + Number(x.total || 0),
        0
      );

      const payload = lines.map(x => ({
        producto_id: x.productId,
        cantidad: x.qty,
        precio_original: x.originalUnitPrice,
        descuento_unitario: x.discountPerUnit,
        precio_unitario: x.unitPrice,
        total_linea: x.total,
        codigo_producto: x.productCode,
        nombre_producto: x.productName
      }));

      const r = await db.rpc("registrar_venta", {
        p_fecha: first.date || today(),
        p_medio_pago: first.paymentMethod,
        p_nota: first.note || null,
        p_subtotal: subtotal,
        p_descuento: discount,
        p_total: total,
        p_detalles: payload,
        p_empleado_id: first.employeeId || currentUser.id
      });

      resultOrThrow(r, "No se pudo registrar la venta");
    }

    // =====================================================
    // 3. ENTRADAS DE MERCANCÍA
    // =====================================================
    const oldIncoming = new Set(
      (previous.incoming || []).map(x => x.id)
    );

    for (const entry of next.incoming || []) {
      if (oldIncoming.has(entry.id)) continue;

      
const r = await db.rpc("registrar_entrada_mercancia", {
  p_producto_id: entry.productId,
  p_fecha: entry.date || today(),
  p_cantidad: entry.qty,
  p_costo_unitario: entry.unitValue,
  p_proveedor: entry.supplier || null,
  p_observaciones: entry.note || null,
  p_medio_pago: entry.paymentMethod || null
});


      resultOrThrow(r, "No se pudo registrar la entrada de mercancía");
    }

    // =====================================================
    // 4. GARANTÍAS
    // =====================================================
    const oldWarranties = new Set(
      (previous.warranties || []).map(x => x.id)
    );

    for (const warranty of next.warranties || []) {
      if (oldWarranties.has(warranty.id)) continue;

      const productId = warranty.productId;
      if (!productId || !isUuid(productId)) {
        throw new Error(
          "La garantía no tiene un producto válido de Supabase."
        );
      }

      const durationValue = Number(warranty.durationValue);
      const salePrice = Number(warranty.salePrice);

      if (!Number.isInteger(durationValue) || durationValue <= 0) {
        throw new Error("La duración de la garantía debe ser mayor que cero.");
      }

      if (!Number.isFinite(salePrice) || salePrice < 0) {
        throw new Error("El precio de venta de la garantía no es válido.");
      }

      const warrantyPayload = {
        producto_id: productId,
        venta_id: isUuid(warranty.saleId) ? warranty.saleId : null,
        detalle_venta_id: isUuid(warranty.saleDetailId)
          ? warranty.saleDetailId
          : null,
        registrado_por: currentUser.id,
        comprador_nombre: String(warranty.buyerName || "").trim(),
        comprador_documento: String(warranty.buyerDocument || "").trim() || null,
        comprador_telefono: String(warranty.buyerPhone || "").trim(),
        fecha_compra: warranty.purchaseDate || today(),
        duracion_valor: durationValue,
        duracion_unidad: warranty.durationUnit,
        fecha_vencimiento: warranty.expirationDate,
        precio_venta: salePrice,
        observaciones: String(warranty.note || "").trim() || null
      };

      if (!warrantyPayload.comprador_nombre) {
        throw new Error("Falta el nombre del comprador de la garantía.");
      }

      if (!warrantyPayload.comprador_telefono) {
        throw new Error("Falta el teléfono del comprador de la garantía.");
      }

      if (!["dias", "meses"].includes(warrantyPayload.duracion_unidad)) {
        throw new Error("La unidad de duración debe ser días o meses.");
      }

      if (!warrantyPayload.fecha_vencimiento) {
        throw new Error("Falta la fecha de vencimiento de la garantía.");
      }

      const r = await db
        .from("garantias")
        .insert(warrantyPayload);

      resultOrThrow(r, "No se pudo guardar la garantía");
    }

    // =====================================================
    // 5. GASTOS
    // =====================================================
    await syncMoneyRecords(
      "expenses",
      "gastos",
      previous,
      next,
      item => ({
        registrado_por: currentUser.id,
        fecha: item.date || today(),
        concepto: item.concept,
        valor: item.amount,
        observaciones: item.note || null,
        medio_pago: item.paymentMethod || null
      })
    );

    // =====================================================
    // 6. NÓMINA
    // =====================================================
    await syncMoneyRecords(
      "payroll",
      "nomina",
      previous,
      next,
      item => ({
        empleado_id: item.employeeId || null,
        registrado_por: currentUser.id,
        periodo_inicio: item.periodStart || item.date || today(),
        periodo_fin: item.periodEnd || item.date || today(),
        fecha_pago: item.date || today(),
        concepto: item.concept,
        valor: item.amount,
        medio_pago: item.paymentMethod || null
      })
    );

    // =====================================================
    // 7. ARRIENDO
    // =====================================================
    await syncMoneyRecords(
      "rent",
      "arriendos",
      previous,
      next,
      item => ({
        registrado_por: currentUser.id,
        fecha_pago: item.date || today(),
        periodo: item.period || item.date || today(),
        concepto: item.concept,
        valor: item.amount,
        observaciones: item.note || null,
        medio_pago: item.paymentMethod || null
      })
    );
}


  async function syncMoneyRecords(key, tableName, previous, next, mapRecord) {
    const oldIds = new Set((previous[key]||[]).map(x => x.id));
    for (const item of next[key] || []) {
      if (oldIds.has(item.id)) continue;
      const r = await db.from(tableName).insert(mapRecord(item));
      resultOrThrow(r, `No se pudo guardar el registro de ${key}`);
    }
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function notify(message, type = "") {
  const notice = $("notice");

  if (!notice) {
    if (message) console.info("Phone Planet:", message);
    return;
  }

  notice.textContent = message;
  notice.className = `notice ${type}`;
}

  function setRole(newRole) {
    role = newRole === "administrador" ? "administrador" : "empleado";
    const currentUserElement = $("currentUser");
    if (currentUserElement) currentUserElement.textContent = currentProfile?.nombre || currentProfile?.codigo_usuario || currentUser?.email || "Usuario";
    $("welcomeTitle").textContent = role === "administrador" ? `Bienvenido, ${currentProfile?.nombre || "administrador"}` : `Bienvenido, ${currentProfile?.nombre || "al equipo"}`;
    $("welcomeText").textContent = role === "administrador"
      ? "Controla ventas, inventario, empleados y finanzas de Phone Planet."
      : "Registra las ventas y la mercancía que ingresa a la tienda.";
    const roleSwitcher = $("roleSwitcher");
    if (roleSwitcher) { roleSwitcher.value = role; roleSwitcher.disabled = true; }
    activeModule = null;
    $("workspace").hidden = true;
    $("moduleMenu").hidden = false;
    renderDashboard();
    renderMenu();
  }
  function renderDashboard() {
    const sales = role === "administrador"
      ? state.sales
      : state.sales.filter(sale => sale.employeeId === currentUser?.id);

    const totalSales = sales.reduce(
      (sum, sale) => sum + sale.total,
      0
    );

    const products = state.products.length;

    const stockUnits = state.products.reduce(
      (sum, product) => sum + product.stock,
      0
    );

    const stats = [
      {
        label: "Ventas registradas",
        value: sales.length,
        hint: "Transacciones"
      },
      {
        label: "Total vendido",
        value: money(totalSales),
        hint: role === "administrador"
          ? "Todos los empleados"
          : "Tus ventas de prueba"
      },
      {
        label: "Productos",
        value: products,
        hint: "Referencias activas"
      },
      {
        label: "Unidades en stock",
        value: stockUnits,
        hint: "Existencias actuales"
      }
    ];

    $("dashboardStats").innerHTML = stats.map(stat => `
      <div class="stat">
        <span>${stat.label}</span>
        <strong>${stat.value}</strong>
        <small>${stat.hint}</small>
      </div>
    `).join("");
  }

  function renderMenu() {
    $("moduleMenu").innerHTML = modules
      .filter(module => module.roles.includes(role))
      .map(module => `
        <button
          type="button"
          class="module-card"
          data-module="${module.id}"
        >
          <span class="module-icon">${module.icon}</span>
          <strong>${module.title}</strong>
          <small>${module.desc}</small>
        </button>
      `).join("");

    $("moduleMenu")
      .querySelectorAll("[data-module]")
      .forEach(button => {
        button.addEventListener("click", () => {
          openModule(button.dataset.module);
        });
      });
  }

  function openModule(id) {
    const module = modules.find(item => item.id === id);

    if (!module || !module.roles.includes(role)) {
      notify("No tienes permiso para abrir este módulo.", "error");
      return;
    }

    activeModule = id;
    $("moduleMenu").hidden = true;
    $("dashboardStats").hidden = true;
    $("workspace").hidden = false;

    $("workspaceEyebrow").textContent = role === "administrador"
      ? "ADMINISTRACIÓN"
      : "OPERACIÓN";

    $("workspaceTitle").textContent = module.title;
    $("workspaceDescription").textContent = module.desc;

    notify("");
    renderModule();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    activeModule = null;
    $("workspace").hidden = true;
    $("moduleMenu").hidden = false;
    $("dashboardStats").hidden = false;

    renderDashboard();
    notify("");
  }

  function employeeOptions() {
    return state.employees
      .filter(employee => employee.active !== false)
      .map(employee => `
        <option value="${escapeHTML(employee.id)}">
          ${escapeHTML(employee.name)}
        </option>
      `).join("");
  }

  function productOptions() {
    return state.products.map(product => `
      <option value="${escapeHTML(product.id)}">
        ${escapeHTML(product.code)}
        · ${escapeHTML(product.name)}
        · ${money(product.price)}
        · stock ${product.stock}
      </option>
    `).join("");
  }

  function table(headers, rows, emptyText = "Todavía no hay registros.") {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows || `
              <tr>
                <td class="empty" colspan="${headers.length}">
                  ${escapeHTML(emptyText)}
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderModule() {
    const renderers = {
      sales: renderSalesForm,
      incoming: renderIncomingForm,
      warranties: renderWarranties,
      stock: renderStock,
      catalog: renderCatalog,
      monthClose: renderMonthClose,
      salesHistory: renderSalesHistory,
      employees: renderEmployees,
      incomingHistory: renderIncomingHistory,
      expenses: () => renderMoneyLog(
        "expenses",
        "Registrar gasto",
        "Concepto",
        "Valor del gasto"
      ),
      payroll: () => renderMoneyLog(
        "payroll",
        "Registrar nómina",
        "Empleado / concepto",
        "Valor pagado"
      ),
      rent: () => renderMoneyLog(
        "rent",
        "Registrar arriendo",
        "Concepto",
        "Valor del arriendo"
      )
    };

    (renderers[activeModule] || (() => {
      $("workspaceContent").innerHTML =
        "<p class='muted'>Módulo no disponible.</p>";
    }))();
  }

  function renderSalesForm() {
    const employeeList = role === "empleado"
      ? `<option value="${escapeHTML(currentUser?.id || "")}">${escapeHTML(currentProfile?.nombre || "Mi usuario")}</option>`
      : `<option value="${escapeHTML(currentUser?.id || "")}">${escapeHTML(currentProfile?.nombre || "Mis ventas")}</option>${employeeOptions()}`;

    const cart = [];
    const noProducts = state.products.length === 0;

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>Nueva venta · Carrito</h3>

        <form id="cartAddForm" class="form-grid">
          <div class="field">
            <label for="saleEmployee">Empleado</label>
            <select id="saleEmployee" required
              ${role === "empleado" ? "disabled" : ""}>
              ${employeeList}
            </select>
          </div>

          <div class="field">
            <label for="saleCode">Código del producto</label>
            <input id="saleCode" placeholder="Ej. CAB-004"
              autocomplete="off" required>
          </div>

          <div class="field">
            <label for="saleDescription">Descripción del producto</label>
            <input id="saleDescription" readonly
              placeholder="Se completa con el código">
          </div>

          <div class="field">
            <label for="saleUnitPrice">Precio de venta unitario</label>
            <input id="saleUnitPrice" readonly value="">
          </div>

          <div class="field">
            <label for="saleStock">Disponible en stock</label>
            <input id="saleStock" readonly value="">
          </div>

          <div class="field">
            <label for="saleQty">Cantidad</label>
            <input id="saleQty" type="number" min="1"
              step="1" value="1" required>
          </div>

          <div class="field">
            <label for="saleDiscountToggle">¿Aplicar descuento?</label>
            <select id="saleDiscountToggle">
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>

          <div class="field">
            <label for="saleDiscount">
              Descuento por unidad (máx. $5.000)
            </label>
            <input id="saleDiscount" type="number" min="0"
              max="5000" step="1" value="0" disabled>
          </div>

          <div class="field">
            <label for="saleLineTotal">Total de esta línea</label>
            <input id="saleLineTotal" readonly value="">
          </div>

          <div>
            <button class="btn btn-ghost" type="submit"
              ${noProducts ? "disabled" : ""}>
              Agregar al carrito
            </button>
          </div>
        </form>
      </div>

      <h3>Carrito de venta</h3>
      <div id="cartTable"></div>

      <div class="form-panel" style="margin-top:18px">
        <div class="form-grid">
          <div class="field">
            <label for="saleDate">Fecha de venta</label>
            <input id="saleDate" type="date"
              value="${today()}" required>
          </div>

          <div class="field">
            <label for="salePayment">Medio de pago</label>
            <select id="salePayment" required>
              ${PAYMENT_METHODS.map(method => `
                <option value="${method}">${method}</option>
              `).join("")}
            </select>
          </div>

          <div class="field wide">
            <label for="saleNote">Nota (opcional)</label>
            <input id="saleNote" maxlength="180"
              placeholder="Ej. Venta de mostrador">
          </div>
        </div>

        <div id="cartTotals" class="stats"></div>

        <div class="form-actions">
          <button class="btn btn-primary" type="button"
            id="finishSale" ${noProducts ? "disabled" : ""}>
            Finalizar venta
          </button>

          <button class="btn btn-ghost" type="button" id="clearCart">
            Vaciar carrito
          </button>

          <button class="btn btn-primary" type="button" id="closeSale">
            Cerrar venta del día
          </button>
        </div>

        <div id="closingReport"></div>
      </div>

      <h3>Ventas recientes</h3>
      ${table(
        ["Fecha", "Empleado", "Producto", "Cantidad", "Total"],
        state.sales.slice().reverse().slice(0, 8).map(sale => `
          <tr>
            <td>${escapeHTML(sale.date)}</td>
            <td>${escapeHTML(saleEmployeeName(sale))}</td>
            <td>${escapeHTML(sale.productName)}</td>
            <td>${sale.qty}</td>
            <td>${money(sale.total)}</td>
          </tr>
        `).join("")
      )}
    `;

    const codeInput = $("saleCode");

    const findByCode = () => state.products.find(product =>
      product.code.trim().toLowerCase() ===
      codeInput.value.trim().toLowerCase()
    );

    const getLineValues = () => {
      const product = findByCode();
      const qty = Number($("saleQty").value) || 0;

      const discount = $("saleDiscountToggle").value === "si"
        ? Math.min(
            5000,
            Math.max(0, Number($("saleDiscount").value) || 0)
          )
        : 0;

      return {
        product,
        qty,
        discount,
        total: product && qty > 0
          ? Math.max(0, product.price - discount) * qty
          : 0
      };
    };

    const updateLineTotal = () => {
      const values = getLineValues();

      $("saleLineTotal").value =
        values.product &&
        Number.isInteger(values.qty) &&
        values.qty > 0
          ? money(values.total)
          : "";
    };

    const updateProductPreview = () => {
      const product = findByCode();

      $("saleDescription").value = product
        ? (product.description || product.name)
        : "";

      $("saleUnitPrice").value = product ? money(product.price) : "";
      $("saleStock").value = product ? String(product.stock) : "";

      if (product && Number($("saleDiscount").value) > product.price) {
        $("saleDiscount").value = Math.min(5000, product.price);
      }

      updateLineTotal();

      if (codeInput.value.trim() && !product) {
        notify("No se encontró un producto con ese código.", "error");
      } else if (product) {
        notify("");
      }
    };

    const toggleDiscount = () => {
      const enabled = $("saleDiscountToggle").value === "si";

      $("saleDiscount").disabled = !enabled;

      if (!enabled) {
        $("saleDiscount").value = "0";
      }

      updateLineTotal();
    };

    codeInput.addEventListener("input", updateProductPreview);
    $("saleQty").addEventListener("input", updateLineTotal);

    $("saleDiscount").addEventListener("input", () => {
      let value = Number($("saleDiscount").value) || 0;
      const product = findByCode();

      value = Math.max(
        0,
        Math.min(5000, product ? product.price : 5000, value)
      );

      $("saleDiscount").value = String(value);
      updateLineTotal();
    });

    $("saleDiscountToggle").addEventListener("change", toggleDiscount);

    $("cartAddForm").addEventListener("submit", event => {
      event.preventDefault();

      const values = getLineValues();

      if (!values.product) {
        return notify("Escribe un código de producto válido.", "error");
      }

      if (!Number.isInteger(values.qty) || values.qty < 1) {
        return notify(
          "La cantidad debe ser un entero mayor que cero.",
          "error"
        );
      }

      const inCart = cart
        .filter(item => item.productId === values.product.id)
        .reduce((sum, item) => sum + item.qty, 0);

      if (inCart + values.qty > values.product.stock) {
        return notify(
          `Stock insuficiente. Disponible: ${
            Math.max(0, values.product.stock - inCart)
          } unidad(es).`,
          "error"
        );
      }

      cart.push({
        productId: values.product.id,
        code: values.product.code,
        productName: values.product.name,
        description: values.product.description || values.product.name,
        qty: values.qty,
        originalUnitPrice: values.product.price,
        discountPerUnit: values.discount,
        unitPrice: Math.max(0, values.product.price - values.discount),
        total: values.total
      });

      renderCart();

      codeInput.value = "";
      $("saleDescription").value = "";
      $("saleUnitPrice").value = "";
      $("saleStock").value = "";
      $("saleQty").value = "1";
      $("saleDiscountToggle").value = "no";
      $("saleDiscount").value = "0";
      $("saleDiscount").disabled = true;
      $("saleLineTotal").value = "";
      codeInput.focus();

      notify("Producto agregado al carrito.", "success");
    });

    function renderCart() {
      const rows = cart.map((item, index) => `
        <tr>
          <td>${escapeHTML(item.code)}</td>
          <td>${escapeHTML(item.description)}</td>
          <td>${item.qty}</td>
          <td>${money(item.originalUnitPrice)}</td>
          <td>${money(item.discountPerUnit)}</td>
          <td>${money(item.unitPrice)}</td>
          <td>${money(item.total)}</td>
          <td>
            <button class="btn btn-danger btn-small"
              type="button" data-remove-cart="${index}">
              Quitar
            </button>
          </td>
        </tr>
      `).join("");

      $("cartTable").innerHTML = table(
        [
          "Código",
          "Descripción",
          "Cantidad",
          "Precio unit.",
          "Descuento unit.",
          "Precio final unit.",
          "Total línea",
          "Acción"
        ],
        rows,
        "El carrito está vacío."
      );

      const subtotal = cart.reduce(
        (sum, item) => sum + item.originalUnitPrice * item.qty,
        0
      );

      const discountTotal = cart.reduce(
        (sum, item) => sum + item.discountPerUnit * item.qty,
        0
      );

      const finalTotal = cart.reduce(
        (sum, item) => sum + item.total,
        0
      );

      $("cartTotals").innerHTML = `
        <div class="stat">
          <span>Subtotal</span>
          <strong>${money(subtotal)}</strong>
        </div>
        <div class="stat">
          <span>Descuentos</span>
          <strong>${money(discountTotal)}</strong>
        </div>
        <div class="stat">
          <span>Total final</span>
          <strong>${money(finalTotal)}</strong>
        </div>
      `;

      $("finishSale").disabled = cart.length === 0;

      $("cartTable")
        .querySelectorAll("[data-remove-cart]")
        .forEach(button => {
          button.addEventListener("click", () => {
            cart.splice(Number(button.dataset.removeCart), 1);
            renderCart();
          });
        });
    }

    $("clearCart").addEventListener("click", () => {
      cart.length = 0;
      renderCart();
      notify("Carrito vacío.", "success");
    });
        $("finishSale").addEventListener("click", () => {
      if (!cart.length) {
        return notify("Agrega al menos un producto al carrito.", "error");
      }

      const employeeId = role === "empleado"
        ? currentUser.id
        : $("saleEmployee").value;

      const paymentMethod = $("salePayment").value;

      if (!employeeId) {
        return notify("Selecciona un empleado válido.", "error");
      }

      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return notify("Selecciona un medio de pago válido.", "error");
      }

      for (const item of cart) {
        const product = state.products.find(
          entry => entry.id === item.productId
        );

        if (!product || product.stock < item.qty) {
          return notify(
            `Stock insuficiente para ${item.productName}.`,
            "error"
          );
        }
      }

      const transactionId = uid("VENTA");
      const date = $("saleDate").value || today();
      const note = $("saleNote").value.trim();

      for (const item of cart) {
        const product = state.products.find(
          entry => entry.id === item.productId
        );

        product.stock -= item.qty;

        state.sales.push({
          id: uid("VEN"),
          transactionId,
          employeeId,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          description: product.description || product.name,
          qty: item.qty,
          originalUnitPrice: item.originalUnitPrice,
          discountPerUnit: item.discountPerUnit,
          unitPrice: item.unitPrice,
          total: item.total,
          paymentMethod,
          date,
          createdAt: new Date().toISOString(),
          note
        });
      }

      if (!saveState()) return;

      const finalTotal = cart.reduce(
        (sum, item) => sum + item.total,
        0
      );

      cart.length = 0;
      renderDashboard();
      renderSalesForm();

      notify(
        `Venta registrada. Total cobrado: ${money(finalTotal)}.`,
        "success"
      );
    });

    $("closeSale").addEventListener("click", () => {
      const closingDate = today();

      // Cada rol cierra únicamente sus propias ventas.
      const employeeId = currentUser.id;

      const todaysSales = state.sales.filter(sale =>
        sale.date === closingDate &&
        sale.employeeId === employeeId
      );

      const totalsByMethod = Object.fromEntries(
        PAYMENT_METHODS.map(method => [method, 0])
      );

      let legacyPaymentTotal = 0;

      todaysSales.forEach(sale => {
        if (PAYMENT_METHODS.includes(sale.paymentMethod)) {
          totalsByMethod[sale.paymentMethod] += Number(sale.total) || 0;
        } else {
          legacyPaymentTotal += Number(sale.total) || 0;
        }
      });

      const total = todaysSales.reduce(
        (sum, sale) => sum + (Number(sale.total) || 0),
        0
      );

      const transactionCount = new Set(
        todaysSales.map(sale => sale.transactionId || sale.id)
      ).size;

      const employee = employeeName(currentUser.id);

      const generatedAt = new Date().toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short"
      });

      const paymentRows = PAYMENT_METHODS.map(method => `
        <tr>
          <td>${escapeHTML(method)}</td>
          <td>${money(totalsByMethod[method])}</td>
        </tr>
      `).join("") + (
        legacyPaymentTotal
          ? `
            <tr>
              <td>Ventas anteriores sin medio registrado</td>
              <td>${money(legacyPaymentTotal)}</td>
            </tr>
          `
          : ""
      );

      const reportHTML = `
        <section class="form-panel closing-report" id="printClosingReport">
          <div style="text-align:center">
            <h2>${escapeHTML(LOCAL_NAME)}</h2>
            <h3>REPORTE DE CIERRE DE VENTAS</h3>
          </div>

          <p><strong>NIT del local:</strong> ${escapeHTML(LOCAL_NIT)}</p>
          <p><strong>Nombre del empleado:</strong> ${escapeHTML(employee)}</p>
          <p><strong>Fecha del cierre:</strong> ${escapeHTML(closingDate)}</p>
          <p><strong>Generado:</strong> ${escapeHTML(generatedAt)}</p>

          <hr>
          <h3>Ventas por medio de pago</h3>

          ${table(["Medio de pago", "Total vendido"], paymentRows)}

          <p><strong>Número de ventas:</strong> ${transactionCount}</p>

          <h2 style="text-align:right">
            TOTAL VENDIDO: ${money(total)}
          </h2>

          ${
            todaysSales.length
              ? ""
              : "<p class='muted'>No hay ventas de hoy asociadas a este usuario.</p>"
          }

          <div class="form-actions no-print">
  <button class="btn btn-primary" type="button" id="shareClosing">
    Compartir imagen
  </button>
</div>
        </section>
      `;

      $("closingReport").innerHTML = reportHTML;


$("shareClosing").addEventListener("click", async () => {
  const report = $("printClosingReport");

  if (!report) {
    notify("No se encontró el reporte de cierre.", "error");
    return;
  }

  try {
    if (typeof html2canvas === "undefined") {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const canvas = await html2canvas(report, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(image => {
        if (image) resolve(image);
        else reject(new Error("No se pudo crear la imagen."));
      }, "image/png");
    });

    const file = new File(
      [blob],
      "PhonePlanet_Cierre.png",
      { type: "image/png" }
    );

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: "Cierre de ventas - Phone Planet",
        text: "Reporte de cierre de ventas",
        files: [file]
      });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "PhonePlanet_Cierre.png";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      notify("Imagen PNG descargada correctamente.", "success");
    }
  } catch (error) {
    console.error(error);
    notify("No se pudo generar o compartir la imagen.", "error");
  }
});


      $("closingReport").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      notify(
        "Reporte generado con las ventas de hoy de tu usuario.",
        "success"
      );
    });

    renderCart();
  }
    // =====================================================
  // Utilidades compartidas
  // =====================================================
  function describeSupabaseError(error, fallback) {
    if (!error) return fallback;

    const code = error.code ? ` (código ${error.code})` : "";

    if (error.code === "PGRST202") {
      return `${fallback}: la función de Supabase no existe o sus parámetros no coinciden con los que envía la página.${code}`;
    }

    const parts = [error.message || fallback];
    if (error.details && !String(parts[0]).includes(error.details)) parts.push(error.details);
    if (error.hint) parts.push(`Sugerencia: ${error.hint}`);

    return `${fallback}: ${parts.join(" · ")}${code}`;
  }

  async function loadHtml2Canvas() {
    if (typeof html2canvas !== "undefined") return;

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar html2canvas."));
      document.head.appendChild(script);
    });
  }

  // Convierte un elemento en PNG y lo comparte (o lo descarga).
  async function shareElementAsImage(element, filename, title, text, forceDownload = false) {
    await loadHtml2Canvas();

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(image => {
        if (image) resolve(image);
        else reject(new Error("No se pudo crear la imagen."));
      }, "image/png");
    });

    const file = new File([blob], filename, { type: "image/png" });

    if (!forceDownload && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, text, files: [file] });
        return "compartida";
      } catch (error) {
        if (error?.name === "AbortError") return "cancelada";
        throw error;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return "descargada";
  }

  // =====================================================
  // CIERRE DE MES
  // =====================================================
  const CLOSE_METHODS = [...PAYMENT_METHODS, "Sin medio"];
  let closeMonth = null;

  const methodKey = method => PAYMENT_METHODS.includes(method) ? method : "Sin medio";
  const emptyByMethod = () => Object.fromEntries(CLOSE_METHODS.map(key => [key, 0]));
  const totalOf = values => CLOSE_METHODS.reduce((sum, key) => sum + values[key], 0);

  function shiftMonth(month, delta) {
    const [year, number] = month.split("-").map(Number);
    const date = new Date(year, number - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthLabel(month) {
    const [year, number] = month.split("-").map(Number);
    const text = new Date(year, number - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Saldo anterior = todo lo vendido menos todo lo pagado ANTES del mes, por medio de pago.
  // Así el sobrante de cada mes pasa solo al siguiente, sin guardar nada aparte.
  function computeMonthClose(month) {
    const start = `${month}-01`;
    const end = `${shiftMonth(month, 1)}-01`;

    const sources = {
      sales: state.sales.map(item => ({ date: item.date, method: item.paymentMethod, amount: item.total })),
      merchandise: state.incoming.map(item => ({ date: item.date, method: item.paymentMethod, amount: entryTotal(item) })),
      expenses: state.expenses.map(item => ({ date: item.date, method: item.paymentMethod, amount: item.amount })),
      payroll: state.payroll.map(item => ({ date: item.date, method: item.paymentMethod, amount: item.amount })),
      rent: state.rent.map(item => ({ date: item.date, method: item.paymentMethod, amount: item.amount }))
    };

    const rows = {
      sales: emptyByMethod(),
      merchandise: emptyByMethod(),
      expenses: emptyByMethod(),
      payroll: emptyByMethod(),
      rent: emptyByMethod()
    };
    const opening = emptyByMethod();

    Object.entries(sources).forEach(([kind, list]) => {
      list.forEach(item => {
        const date = String(item.date || "").slice(0, 10);
        const amount = Number(item.amount) || 0;
        if (!date || !amount) return;

        const key = methodKey(item.method);
        const sign = kind === "sales" ? 1 : -1;

        if (date < start) opening[key] += sign * amount;
        else if (date < end) rows[kind][key] += amount;
      });
    });

    const available = emptyByMethod();
    const paid = emptyByMethod();
    const leftover = emptyByMethod();

    CLOSE_METHODS.forEach(key => {
      available[key] = opening[key] + rows.sales[key];
      paid[key] = rows.merchandise[key] + rows.expenses[key] + rows.payroll[key] + rows.rent[key];
      leftover[key] = available[key] - paid[key];
    });

    const lines = [
      { label: "Saldo del mes anterior", values: opening, kind: "normal" },
      { label: "Ventas del mes (total ingreso)", values: rows.sales, kind: "strong" },
      { label: "Total disponible (saldo anterior + ventas)", values: available, kind: "total" },
      { label: "Pagos del mes", kind: "section" },
      { label: "Mercancía", values: rows.merchandise, kind: "normal" },
      { label: "Gastos", values: rows.expenses, kind: "normal" },
      { label: "Nómina", values: rows.payroll, kind: "normal" },
      { label: "Arriendo", values: rows.rent, kind: "normal" },
      { label: "Total pagado", values: paid, kind: "total" },
      { label: "Sobrante (pasa al mes siguiente)", values: leftover, kind: "result" }
    ];

    // La columna "Sin medio" solo aparece si hay registros sin medio de pago.
    const showUnknown = lines.some(line => line.values && Math.abs(line.values["Sin medio"]) > 0);
    const methods = showUnknown ? CLOSE_METHODS : PAYMENT_METHODS;

    return { month, lines, methods, showUnknown, totals: { paid: totalOf(paid), income: totalOf(rows.sales), leftover: totalOf(leftover) } };
  }

  function monthCloseHTML(data) {
    const generated = new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

    const cells = line => data.methods.map(key => {
      const value = line.values[key];
      return `<td class="num ${value < 0 ? "neg" : ""}">${money(value)}</td>`;
    }).join("");

    const body = data.lines.map(line => {
      if (line.kind === "section") {
        return `<tr class="close-section"><td colspan="${data.methods.length + 2}">${escapeHTML(line.label)}</td></tr>`;
      }

      const total = totalOf(line.values);
      return `
        <tr class="close-${line.kind}">
          <td>${escapeHTML(line.label)}</td>
          ${cells(line)}
          <td class="num ${total < 0 ? "neg" : ""}"><strong>${money(total)}</strong></td>
        </tr>
      `;
    }).join("");

    return `
      <section class="close-report">
        <div class="close-head">
          <h2>${escapeHTML(LOCAL_NAME)}</h2>
          <h3>Cierre de mes · ${escapeHTML(monthLabel(data.month))}</h3>
          <p>Generado: ${escapeHTML(generated)}</p>
        </div>

        <table class="close-table">
          <thead>
            <tr>
              <th>Concepto</th>
              ${data.methods.map(key => `<th>${escapeHTML(key === "Sin medio" ? "Sin medio registrado" : key)}</th>`).join("")}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>

        <div class="close-summary">
          <div><span>Total ingreso del mes</span><strong>${money(data.totals.income)}</strong></div>
          <div><span>Total pagado</span><strong>${money(data.totals.paid)}</strong></div>
          <div class="${data.totals.leftover < 0 ? "neg" : "ok"}">
            <span>${data.totals.leftover < 0 ? "Faltante" : "Sobrante"}</span>
            <strong>${money(data.totals.leftover)}</strong>
          </div>
        </div>

        <p class="close-note">
          El sobrante de este mes pasa automáticamente al mes siguiente como saldo anterior.
          ${data.showUnknown ? "<br>Hay registros sin medio de pago (anteriores a este control); se muestran aparte." : ""}
        </p>
      </section>
    `;
  }

  function exportMonthCloseExcel(data) {
    const methodCount = data.methods.length;
    const headers = ["Concepto", ...data.methods.map(key => key === "Sin medio" ? "Sin medio registrado" : key), "Total"];

    const rows = [
      [{ v: `${LOCAL_NAME} - Cierre de mes`, s: "title" }],
      [{ v: monthLabel(data.month), s: "bold" }],
      [],
      headers.map(text => ({ v: text, s: "header" }))
    ];

    data.lines.forEach(line => {
      if (line.kind === "section") {
        rows.push([
          { v: line.label, s: "section" },
          ...Array.from({ length: methodCount + 1 }, () => ({ v: "", s: "section" }))
        ]);
        return;
      }

      const labelStyle = line.kind === "result" ? "resultLabel" : (line.kind === "normal" ? undefined : "bold");
      const moneyStyle = line.kind === "result" ? "result" : (line.kind === "normal" ? "money" : "moneyBold");

      rows.push([
        labelStyle ? { v: line.label, s: labelStyle } : line.label,
        ...data.methods.map(key => ({ v: line.values[key], s: moneyStyle })),
        { v: totalOf(line.values), s: line.kind === "result" ? "result" : "moneyBold" }
      ]);
    });

    rows.push([], ["El sobrante de este mes pasa automáticamente al mes siguiente como saldo anterior."]);

    downloadExcel(`PhonePlanet_Cierre_${data.month}.xlsx`, [
      {
        name: `Cierre ${data.month}`,
        widths: [44, ...data.methods.map(() => 22), 20],
        rows
      }
    ]);
  }

  async function downloadMonthCloseImage(data) {
    const holder = document.createElement("div");
    holder.className = "close-image-holder";
    holder.innerHTML = monthCloseHTML(data);
    document.body.appendChild(holder);

    try {
      await shareElementAsImage(
        holder.firstElementChild,
        `PhonePlanet_Cierre_${data.month}.png`,
        `Cierre de mes - ${monthLabel(data.month)}`,
        "Cierre de mes de Phone Planet",
        true
      );
      notify("Imagen del cierre descargada.", "success");
    } catch (error) {
      console.error("Error generando la imagen del cierre:", error);
      notify("No se pudo generar la imagen del cierre.", "error");
    } finally {
      holder.remove();
    }
  }

  function renderMonthClose() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    if (!closeMonth) closeMonth = today().slice(0, 7);

    $("workspaceContent").innerHTML = `
      <div class="toolbar">
        <button class="btn btn-ghost" id="closePrev" type="button">← Mes anterior</button>

        <div class="field">
          <label for="closeMonthInput">Mes (AAAA-MM)</label>
          <input id="closeMonthInput" type="month" value="${closeMonth}" placeholder="2026-10" maxlength="7">
        </div>

        <button class="btn btn-ghost" id="closeNext" type="button">Mes siguiente →</button>
        <button class="btn btn-primary" id="closeImage" type="button">Descargar imagen</button>
        <button class="btn btn-primary" id="closeExcel" type="button">Descargar Excel</button>
      </div>

      ${paymentColumnsMissing ? `
        <p class="notice error" style="display:block">
          Faltan columnas de medio de pago en Supabase. Ejecuta el script cierre_mes.sql
          para que el cierre separe mercancía, gastos, nómina y arriendo por medio de pago.
        </p>` : ""}

      <div id="closeView"></div>
    `;

    const draw = () => {
      $("closeView").innerHTML = `<div class="table-wrap">${monthCloseHTML(computeMonthClose(closeMonth))}</div>`;
    };

    const go = month => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return notify("Escribe el mes como AAAA-MM, por ejemplo 2026-10.", "error");
      closeMonth = month;
      $("closeMonthInput").value = month;
      notify("");
      draw();
    };

    $("closePrev").addEventListener("click", () => go(shiftMonth(closeMonth, -1)));
    $("closeNext").addEventListener("click", () => go(shiftMonth(closeMonth, 1)));
    $("closeMonthInput").addEventListener("change", () => go($("closeMonthInput").value.trim()));
    $("closeExcel").addEventListener("click", () => exportMonthCloseExcel(computeMonthClose(closeMonth)));

    $("closeImage").addEventListener("click", async () => {
      const button = $("closeImage");
      button.disabled = true;
      await downloadMonthCloseImage(computeMonthClose(closeMonth));
      button.disabled = false;
    });

    draw();
  }

  // =====================================================
  // EXCEL: descargas y ayudantes
  // =====================================================
  function excelAvailable() {
    if (!window.PhonePlanetExcel) {
      notify("No se cargó EXCEL.js. Verifica que MENU.html lo incluya.", "error");
      return false;
    }
    return true;
  }

  // columns: [{ header, width, type: "text" | "money" | "date" | "int" }]
  // totals: { indiceColumna: valor } (solo columnas de dinero)
  function dataSheet(name, columns, rows, totals) {
    const styleOf = { money: "money", date: "date", int: "int" };

    const sheetRows = [
      columns.map(column => ({ v: column.header, s: "header" })),
      ...rows.map(row => row.map((value, index) => {
        const style = styleOf[columns[index].type];
        return style ? { v: value, s: style } : value;
      }))
    ];

    if (totals) {
      sheetRows.push(columns.map((column, index) => {
        if (index === 0) return { v: "TOTAL", s: "resultLabel" };
        if (totals[index] !== undefined) return { v: totals[index], s: "result" };
        return { v: "", s: "resultLabel" };
      }));
    }

    return {
      name,
      widths: columns.map(column => column.width || 14),
      freezeRows: 1,
      rows: sheetRows
    };
  }

  function downloadExcel(filename, sheets) {
    if (!excelAvailable()) return false;

    try {
      window.PhonePlanetExcel.download(filename, sheets);
      notify("Archivo Excel descargado.", "success");
      return true;
    } catch (error) {
      console.error("Error creando Excel:", error);
      notify(`No se pudo crear el archivo Excel: ${error.message}`, "error");
      return false;
    }
  }

  function dateFilterHTML(prefix) {
    return `
      <div class="field">
        <label for="${prefix}From">Desde</label>
        <input id="${prefix}From" type="date">
      </div>
      <div class="field">
        <label for="${prefix}To">Hasta</label>
        <input id="${prefix}To" type="date">
      </div>
    `;
  }

  const inDateRange = (date, from, to) => {
    const day = String(date || "").slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  };

  const entryTotal = entry =>
    Number(entry.totalCost) || (Number(entry.unitValue) || 0) * (Number(entry.qty) || 0);

  const sumBy = (list, pick) => list.reduce((sum, item) => sum + (Number(pick(item)) || 0), 0);

  // =====================================================
  // GARANTÍAS
  // =====================================================
  function addDaysISO(isoDate, days) {
    const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
    const date = new Date(y, m - 1, d + Number(days));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatDateOnly(isoDate) {
    if (!isoDate) return "—";
    const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function warrantyDurationText(warranty) {
    const value = Number(warranty.durationValue) || 0;
    const months = warranty.durationUnit === "meses";
    const unit = months ? (value === 1 ? "mes" : "meses") : (value === 1 ? "día" : "días");
    return `${value} ${unit}`;
  }

  function warrantyCode(warranty) {
    return "GAR-" + String(warranty.id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
  }

  function warrantyProduct(warranty) {
    const product = state.products.find(item => item.id === warranty.productId);
    return product
      ? { code: product.code, description: product.description || product.name }
      : { code: "—", description: "Producto" };
  }

  function warrantyCardHTML(warranty) {
    const product = warrantyProduct(warranty);

    return `
      <div class="warranty-card">
        <div class="warranty-card__head">
          <img src="../IMG/LOGO.png" alt="" onerror="this.style.display='none'">
          <div>
            <strong>PHONE PLANET</strong>
            <span>Certificado de garantía</span>
          </div>
        </div>

        <div class="warranty-card__code">${escapeHTML(warrantyCode(warranty))}</div>

        <dl class="warranty-card__rows">
          <div><dt>Cliente</dt><dd>${escapeHTML(warranty.buyerName)}</dd></div>
          <div><dt>Cédula</dt><dd>${escapeHTML(warranty.buyerDocument || "—")}</dd></div>
          <div><dt>Producto</dt><dd>${escapeHTML(product.code)} · ${escapeHTML(product.description)}</dd></div>
          <div><dt>Valor de compra</dt><dd>${money(warranty.salePrice)}</dd></div>
          <div><dt>Fecha de compra</dt><dd>${escapeHTML(formatDateOnly(warranty.purchaseDate))}</dd></div>
          <div><dt>Duración</dt><dd>${escapeHTML(warrantyDurationText(warranty))}</dd></div>
          <div><dt>Vence el</dt><dd><strong>${escapeHTML(formatDateOnly(warranty.expirationDate))}</strong></dd></div>
        </dl>

        <p class="warranty-card__foot">
          Presenta este comprobante para hacer válida tu garantía.
        </p>
      </div>
    `;
  }

  async function shareWarrantyImage(warranty) {
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;";
    holder.innerHTML = warrantyCardHTML(warranty);
    document.body.appendChild(holder);

    try {
      // Esperar el logo antes de generar la imagen.
      await Promise.all(
        [...holder.querySelectorAll("img")].map(img =>
          img.complete ? null : new Promise(resolve => {
            img.onload = img.onerror = resolve;
          })
        )
      );

      return await shareElementAsImage(
        holder.firstElementChild,
        `PhonePlanet_${warrantyCode(warranty)}.png`,
        "Garantía - Phone Planet",
        "Comprobante de garantía"
      );
    } finally {
      holder.remove();
    }
  }

  async function shareWarrantyAndNotify(warranty) {
    try {
      const result = await shareWarrantyImage(warranty);
      if (result === "descargada") notify("Imagen de la garantía descargada.", "success");
      if (result === "compartida") notify("Garantía compartida.", "success");
    } catch (error) {
      console.error("Error compartiendo garantía:", error);
      notify("No se pudo generar o compartir la imagen de la garantía.", "error");
    }
  }

  function renderWarranties() {
    const noProducts = state.products.length === 0;

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>Registrar garantía</h3>

        <form id="warrantyForm" class="form-grid">
          <div class="field wide">
            <label for="warrantyName">Nombre completo</label>
            <input id="warrantyName" maxlength="120" autocomplete="off" required>
          </div>

          <div class="field">
            <label for="warrantyDocument">Cédula</label>
            <input id="warrantyDocument" inputmode="numeric"
              maxlength="15" autocomplete="off" required>
          </div>

          <div class="field">
            <label for="warrantyDate">Fecha de compra</label>
            <input id="warrantyDate" type="date"
              value="${today()}" max="${today()}" required>
          </div>

          <div class="field">
            <label for="warrantyCode">Código del producto</label>
            <input id="warrantyCode" placeholder="Ej. CAB-004"
              autocomplete="off" required>
          </div>

          <div class="field wide">
            <label for="warrantyDescription">Descripción del producto</label>
            <input id="warrantyDescription" readonly
              placeholder="Se completa con el código">
          </div>

          <div class="field">
            <label for="warrantyPrice">Valor de compra</label>
            <input id="warrantyPrice" readonly>
          </div>

          <div class="field">
            <label for="warrantyDays">¿Por cuántos días es la garantía?</label>
            <input id="warrantyDays" type="number" min="1" max="3650"
              step="1" placeholder="Ej. 30" required>
          </div>

          <div class="field">
            <label for="warrantyExpiry">La garantía vence el</label>
            <input id="warrantyExpiry" readonly>
          </div>

          <div>
            <button class="btn btn-primary" type="submit"
              ${noProducts ? "disabled" : ""}>
              Registrar garantía
            </button>
          </div>
        </form>
      </div>

      <div id="warrantyResult"></div>

      <h3>Garantías registradas</h3>
      <div id="warrantyTable"></div>
    `;

    const findProduct = () => state.products.find(product =>
      product.code.trim().toLowerCase() === $("warrantyCode").value.trim().toLowerCase()
    );

    const updateProduct = () => {
      const product = findProduct();
      $("warrantyDescription").value = product ? (product.description || product.name) : "";
      $("warrantyPrice").value = product ? money(product.price) : "";

      if ($("warrantyCode").value.trim() && !product) {
        notify("No se encontró un producto con ese código.", "error");
      } else if (product) {
        notify("");
      }
    };

    const updateExpiry = () => {
      const days = Number($("warrantyDays").value);
      const date = $("warrantyDate").value;

      $("warrantyExpiry").value = date && Number.isInteger(days) && days > 0
        ? formatDateOnly(addDaysISO(date, days))
        : "";
    };

    $("warrantyCode").addEventListener("input", updateProduct);
    $("warrantyDays").addEventListener("input", updateExpiry);
    $("warrantyDate").addEventListener("input", updateExpiry);

    $("warrantyForm").addEventListener("submit", async event => {
      event.preventDefault();

      const button = event.currentTarget.querySelector('button[type="submit"]');
      const name = $("warrantyName").value.trim().replace(/\s+/g, " ");
      const documentId = $("warrantyDocument").value.replace(/[.\s]/g, "");
      const product = findProduct();
      const days = Number($("warrantyDays").value);
      const purchaseDate = $("warrantyDate").value || today();

      if (name.length < 3) {
        return notify("Escribe el nombre completo del cliente.", "error");
      }

      if (!/^\d{5,15}$/.test(documentId)) {
        return notify("La cédula debe tener solo números (entre 5 y 15 dígitos).", "error");
      }

      if (!product) {
        return notify("Escribe un código de producto válido.", "error");
      }

      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        return notify("Indica los días de garantía (un número entero entre 1 y 3650).", "error");
      }

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Registrando...";

      try {
        const result = await db.from("garantias").insert({
          producto_id: product.id,
          venta_id: null,
          detalle_venta_id: null,
          registrado_por: currentUser.id,
          comprador_nombre: name,
          comprador_documento: documentId,
          comprador_telefono: "",
          fecha_compra: purchaseDate,
          duracion_valor: days,
          duracion_unidad: "dias",
          fecha_vencimiento: addDaysISO(purchaseDate, days),
          precio_venta: product.price,
          observaciones: null
        });

        if (result.error) throw result.error;

        await loadSupabaseState();

        const saved = state.warranties.find(item =>
          item.registeredBy === currentUser.id &&
          item.productId === product.id &&
          item.buyerDocument === documentId
        ) || state.warranties[0];

        renderWarranties();

        if (saved) {
          $("warrantyResult").innerHTML = `
            <div class="form-panel">
              <h3>Garantía registrada</h3>
              ${warrantyCardHTML(saved)}
              <div class="form-actions">
                <button class="btn btn-primary" type="button" id="shareWarrantyNow">
                  Compartir imagen
                </button>
              </div>
            </div>
          `;

          $("shareWarrantyNow").addEventListener("click", () => shareWarrantyAndNotify(saved));
          $("warrantyResult").scrollIntoView({ behavior: "smooth", block: "start" });
        }

        notify("Garantía registrada correctamente.", "success");
      } catch (error) {
        console.error("Error registrando garantía:", error);
        notify(describeSupabaseError(error, "No se pudo registrar la garantía"), "error");
        button.disabled = false;
        button.textContent = originalText;
      }
    });

    const rows = state.warranties.map(warranty => {
      const product = warrantyProduct(warranty);
      const valid = String(warranty.expirationDate).slice(0, 10) >= today();

      return `
        <tr>
          <td>${escapeHTML(formatDateOnly(warranty.purchaseDate))}</td>
          <td>${escapeHTML(warranty.buyerName)}</td>
          <td>${escapeHTML(warranty.buyerDocument || "—")}</td>
          <td>${escapeHTML(product.code)} · ${escapeHTML(product.description)}</td>
          <td>${money(warranty.salePrice)}</td>
          <td>${escapeHTML(warrantyDurationText(warranty))}</td>
          <td>${escapeHTML(formatDateOnly(warranty.expirationDate))}</td>
          <td><strong class="${valid ? "stock-ok" : "stock-low"}">${valid ? "Vigente" : "Vencida"}</strong></td>
          <td>
            <button class="btn btn-ghost btn-small" type="button"
              data-share-warranty="${escapeHTML(warranty.id)}">
              Compartir imagen
            </button>
          </td>
        </tr>
      `;
    }).join("");

    $("warrantyTable").innerHTML = table(
      ["Compra", "Cliente", "Cédula", "Producto", "Valor", "Duración", "Vence", "Estado", "Acción"],
      rows,
      "Todavía no hay garantías registradas."
    );

    $("warrantyTable").querySelectorAll("[data-share-warranty]").forEach(button => {
      button.addEventListener("click", async () => {
        const warranty = state.warranties.find(item => item.id === button.dataset.shareWarranty);
        if (!warranty) return;

        button.disabled = true;
        await shareWarrantyAndNotify(warranty);
        button.disabled = false;
      });
    });
  }

  function renderIncomingForm() {
    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>Registrar entrada de mercancía</h3>

        <form id="incomingForm" class="form-grid">
          <div class="field">
            <label for="incomingProduct">Producto</label>
            <select id="incomingProduct" required>
              ${productOptions()}
            </select>
          </div>

          <div class="field">
            <label for="incomingQty">Cantidad recibida</label>
            <input id="incomingQty" type="number" min="1"
              step="1" value="1" required>
          </div>

          <div class="field">
            <label for="incomingUnitValue">
              Valor unitario de compra (COP)
            </label>
            <input id="incomingUnitValue" type="number" min="0.01"
              step="0.01" placeholder="Ej. 8500" required>
          </div>

          <div class="field">
            <label for="incomingTotal">Valor total de la entrada</label>
            <input id="incomingTotal" type="text" value="$ 0"
              readonly aria-live="polite">
          </div>

          <div class="field">
            <label for="incomingDate">Fecha</label>
            <input id="incomingDate" type="date"
              value="${today()}" required>
          </div>

          <div class="field">
            <label for="incomingSupplier">Proveedor (opcional)</label>
            <input id="incomingSupplier" maxlength="100">
          </div>

<div class="field">
  <label for="incomingPaymentMethod">Medio de pago</label>
  <select id="incomingPaymentMethod" required>
    <option value="">Selecciona un medio de pago</option>
    ${PAYMENT_METHODS.map(method => `
      <option value="${method}">${method}</option>
    `).join("")}
  </select>
</div>

          <div class="field wide">
            <label for="incomingNote">Observaciones</label>
            <input id="incomingNote" maxlength="180">
          </div>

          <div>
            <button class="btn btn-primary" type="submit"
              ${state.products.length ? "" : "disabled"}>
              Registrar entrada
            </button>
          </div>
        </form>
      </div>

      <h3>Stock actual</h3>

      ${table(
        ["Código", "Producto", "Existencias"],
        state.products.map(product => `
          <tr>
            <td>${escapeHTML(product.code)}</td>
            <td>${escapeHTML(product.name)}</td>
            <td>${product.stock}</td>
          </tr>
        `).join("")
      )}
    `;

    const updateIncomingTotal = () => {
      const qty = Number($("incomingQty").value) || 0;
      const unitValue = Number($("incomingUnitValue").value) || 0;
      $("incomingTotal").value = money(qty * unitValue);
    };

    $("incomingQty").addEventListener("input", updateIncomingTotal);
    $("incomingUnitValue").addEventListener("input", updateIncomingTotal);

    $("incomingForm").addEventListener("submit", async event => {
      event.preventDefault();

      const button = event.currentTarget.querySelector('button[type="submit"]');

      const product = state.products.find(
        item => item.id === $("incomingProduct").value
      );

      const qty = Number($("incomingQty").value);
      const unitValue = Number($("incomingUnitValue").value);
      const paymentMethod = $("incomingPaymentMethod").value;

      if (
        !product ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        !Number.isFinite(unitValue) ||
        unitValue <= 0
      ) {
        return notify(
          "Verifica el producto, la cantidad y el valor unitario.",
          "error"
        );
      }

      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return notify("Selecciona un medio de pago válido.", "error");
      }

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Registrando...";

      try {
        // Se guarda directamente en Supabase y solo se confirma si funcionó.
        const result = await db.rpc("registrar_entrada_mercancia", {
          p_producto_id: product.id,
          p_fecha: $("incomingDate").value || today(),
          p_cantidad: qty,
          p_costo_unitario: unitValue,
          p_proveedor: $("incomingSupplier").value.trim() || null,
          p_observaciones: $("incomingNote").value.trim() || null,
          p_medio_pago: paymentMethod
        });

        if (result.error) throw result.error;

        // Respaldo: si la función no guardó el medio de pago, se completa aquí
        // para que el cierre de mes lo cuente en el medio correcto.
        try {
          const newId = typeof result.data === "string" ? result.data : result.data?.id;
          if (isUuid(newId)) {
            await db.from("entradas_mercancia")
              .update({ medio_pago: paymentMethod })
              .eq("id", newId)
              .is("medio_pago", null);
          }
        } catch (_) {
          // Sin permiso o sin columna: el cierre mostrará esta entrada como "Sin medio".
        }
      } catch (error) {
        console.error("Error registrando entrada de mercancía:", error);
        notify(
          describeSupabaseError(error, "No se pudo registrar la entrada de mercancía"),
          "error"
        );
        button.disabled = false;
        button.textContent = originalText;
        return;
      }

      // La entrada ya quedó guardada: se recargan stock e historial reales.
      try {
        await loadSupabaseState();
        renderDashboard();
        renderIncomingForm();
        notify(
          `Entrada registrada. Total de compra: ${money(qty * unitValue)}. Stock actualizado.`,
          "success"
        );
      } catch (error) {
        console.error(error);
        notify(
          "La entrada se guardó en Supabase, pero no se pudo refrescar la pantalla. Recarga la página.",
          "error"
        );
      }
    });
  }

  // =====================================================
  // CATÁLOGO DE LA TIENDA WEB - solo administradores
  // =====================================================
  const CATEGORIAS_BASE = ["Fundas", "Cargadores", "Audífonos", "Cables", "Smartwatches"];
  const BUCKET_PRODUCTOS = "productos";
  const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
  let editingCatalogId = null;

  function catalogCategories() {
    const extra = state.catalog
      .map(item => item.category)
      .filter(category => category && !CATEGORIAS_BASE.includes(category));
    return [...CATEGORIAS_BASE, ...new Set(extra)];
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function safeImageUrl(url) {
    return /^https:\/\//i.test(String(url || "")) ? String(url) : "";
  }

  // Reduce la imagen (máx. 900 px) conservando su formato para no subir fotos pesadas.
  async function prepareProductImage(file) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("La imagen debe ser PNG, JPG o WEBP.");
    }
    if (file.size > MAX_IMAGEN_BYTES) {
      throw new Error("La imagen pesa más de 5 MB. Usa una más liviana.");
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, file.type, 0.88));
    if (!blob) throw new Error("No se pudo procesar la imagen.");

    const type = ["image/png", "image/jpeg", "image/webp"].includes(blob.type) ? blob.type : "image/png";
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[type];
    return { blob, type, ext };
  }

  async function uploadProductImage(file) {
    const image = await prepareProductImage(file);
    const path = `${crypto.randomUUID()}.${image.ext}`;

    const upload = await db.storage.from(BUCKET_PRODUCTOS).upload(path, image.blob, {
      contentType: image.type,
      cacheControl: "31536000",
      upsert: false
    });

    if (upload.error) {
      const message = String(upload.error.message || "");
      if (/bucket not found/i.test(message)) {
        throw new Error("Falta crear la carpeta de imágenes en Supabase. Ejecuta el script SQL de productos.");
      }
      if (/row-level security|violates|not authorized|unauthorized/i.test(message)) {
        throw new Error("Supabase no permite subir imágenes con esta cuenta. Solo los administradores pueden hacerlo.");
      }
      throw new Error(`No se pudo subir la imagen: ${message}`);
    }

    return db.storage.from(BUCKET_PRODUCTOS).getPublicUrl(path).data.publicUrl;
  }

  async function removeProductImage(url) {
    const marker = `/storage/v1/object/public/${BUCKET_PRODUCTOS}/`;
    const index = String(url || "").indexOf(marker);
    if (index === -1) return;

    try {
      await db.storage.from(BUCKET_PRODUCTOS).remove([decodeURIComponent(url.slice(index + marker.length))]);
    } catch (error) {
      console.warn("No se pudo borrar la imagen anterior:", error);
    }
  }

  function renderCatalog() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    if (catalogUnavailable) {
      $("workspaceContent").innerHTML = `
        <div class="form-panel">
          <h3>Falta preparar el catálogo en Supabase</h3>
          <p class="muted">
            Ejecuta el script <strong>catalogo_tienda.sql</strong> en el SQL Editor de Supabase
            y vuelve a cargar esta página.
          </p>
        </div>
      `;
      return;
    }

    const editing = editingCatalogId
      ? state.catalog.find(item => item.id === editingCatalogId)
      : null;

    if (editingCatalogId && !editing) editingCatalogId = null;

    let colors = editing
      ? editing.colors.filter(color => color && color.nombre && isHexColor(color.valor))
          .map(color => ({ nombre: String(color.nombre), valor: String(color.valor).toLowerCase() }))
      : [];

    const categories = catalogCategories();
    const currentImage = editing ? safeImageUrl(editing.imageUrl) : "";

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>${editing ? "Editar producto de la tienda" : "Nuevo producto para la tienda"}</h3>
        <p class="muted">
          Esto es lo que ven los clientes en la página web. No modifica el stock ni el inventario.
        </p>

        <form id="catalogForm" class="form-grid">
          <div class="field">
            <label for="cRef">Referencia</label>
            <input id="cRef" maxlength="50" required>
          </div>

          <div class="field">
            <label for="cName">Nombre del producto</label>
            <input id="cName" maxlength="150" required>
          </div>

          <div class="field">
            <label for="cCategory">Categoría</label>
            <select id="cCategory" required>
              <option value="">Selecciona una categoría</option>
              ${categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("")}
              <option value="__otra">Otra categoría…</option>
            </select>
          </div>

          <div class="field" id="cCategoryOtherWrap" hidden>
            <label for="cCategoryOther">Nueva categoría</label>
            <input id="cCategoryOther" maxlength="30" placeholder="Ej. Protectores">
          </div>

          <div class="field wide">
            <label for="cDescription">Descripción</label>
            <input id="cDescription" maxlength="220" required>
          </div>

          <div class="field wide">
            <label for="cImage">Imagen del producto${editing ? " (déjala vacía para conservar la actual)" : ""}</label>
            <input id="cImage" type="file" accept="image/png,image/jpeg,image/webp" ${editing ? "" : "required"}>
            <small>PNG, JPG o WEBP de máximo 5 MB. Se verá mejor con fondo blanco o transparente.</small>
            <img id="cImagePreview" class="image-preview" alt="Vista previa de la imagen"
              ${currentImage ? `src="${escapeHTML(currentImage)}"` : "hidden"}>
          </div>

          <div class="field wide">
            <label for="cColorName">Colores disponibles</label>
            <div class="color-adder">
              <input id="cColorName" type="text" maxlength="30" placeholder="Nombre (ej. Negro)">
              <input id="cColorValue" type="color" value="#111111" aria-label="Elegir el tono del color">
              <button class="btn btn-ghost" type="button" id="cColorAdd">Agregar color</button>
            </div>
            <div id="cColorList" class="color-chips"></div>
            <small>Si no agregas colores, el producto se muestra como "Único".</small>
          </div>

          <div class="field">
            <label for="cPrice">Precio en la tienda (COP)</label>
            <input id="cPrice" type="number" min="1" step="1" required>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit" id="catalogSubmit">
              ${editing ? "Guardar cambios" : "Publicar en la tienda"}
            </button>
            ${editing ? `<button class="btn btn-ghost" type="button" id="catalogCancel">Cancelar edición</button>` : ""}
          </div>
        </form>
      </div>

      <h3>Productos de la tienda</h3>
      <div id="catalogTable"></div>
    `;

    if (editing) {
      $("cRef").value = editing.reference;
      $("cName").value = editing.name;
      $("cDescription").value = editing.description || "";
      $("cPrice").value = editing.price;

      if (editing.category && !categories.includes(editing.category)) {
        $("cCategory").value = "__otra";
        $("cCategoryOtherWrap").hidden = false;
        $("cCategoryOther").value = editing.category;
      } else {
        $("cCategory").value = editing.category || "";
      }
    }

    const renderColors = () => {
      $("cColorList").innerHTML = colors.map((color, index) => `
        <span class="color-chip">
          <i style="background:${escapeHTML(color.valor)}"></i>
          ${escapeHTML(color.nombre)}
          <button type="button" data-remove-color="${index}" aria-label="Quitar ${escapeHTML(color.nombre)}">&times;</button>
        </span>
      `).join("");

      $("cColorList").querySelectorAll("[data-remove-color]").forEach(button => {
        button.addEventListener("click", () => {
          colors.splice(Number(button.dataset.removeColor), 1);
          renderColors();
        });
      });
    };

    const addColor = () => {
      const name = $("cColorName").value.trim().replace(/\s+/g, " ");
      const value = $("cColorValue").value.toLowerCase();

      if (!name) return notify("Escribe el nombre del color.", "error");
      if (!isHexColor(value)) return notify("Elige un tono válido.", "error");
      if (colors.length >= 8) return notify("Máximo 8 colores por producto.", "error");
      if (colors.some(color => color.nombre.toLowerCase() === name.toLowerCase())) {
        return notify("Ese color ya está agregado.", "error");
      }

      colors.push({ nombre: name, valor: value });
      $("cColorName").value = "";
      renderColors();
      notify("");
      $("cColorName").focus();
    };

    $("cColorAdd").addEventListener("click", addColor);
    $("cColorName").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addColor();
      }
    });
    renderColors();

    $("cCategory").addEventListener("change", () => {
      const other = $("cCategory").value === "__otra";
      $("cCategoryOtherWrap").hidden = !other;
      $("cCategoryOther").required = other;
      if (other) $("cCategoryOther").focus();
    });

    $("cImage").addEventListener("change", () => {
      const file = $("cImage").files[0];
      const preview = $("cImagePreview");

      if (!file) {
        preview.hidden = !currentImage;
        if (currentImage) preview.src = currentImage;
        return;
      }

      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    });

    if ($("catalogCancel")) {
      $("catalogCancel").addEventListener("click", () => {
        editingCatalogId = null;
        renderCatalog();
      });
    }

    $("catalogForm").addEventListener("submit", async event => {
      event.preventDefault();

      if (role !== "administrador") {
        return notify("Acceso restringido.", "error");
      }

      const submit = $("catalogSubmit");
      const reference = $("cRef").value.trim().toUpperCase();
      const name = $("cName").value.trim();
      const description = $("cDescription").value.trim();
      const price = Number($("cPrice").value);
      const file = $("cImage").files[0] || null;

      let category = $("cCategory").value;
      if (category === "__otra") {
        const typed = $("cCategoryOther").value.trim().replace(/\s+/g, " ");
        // Si coincide con una categoría existente (sin importar mayúsculas), se reutiliza.
        category = categories.find(item => item.toLowerCase() === typed.toLowerCase())
          || (typed ? typed.charAt(0).toUpperCase() + typed.slice(1) : "");
      }

      if (!name || !reference || !description || !category || !Number.isFinite(price) || price <= 0) {
        return notify("Revisa los datos del producto.", "error");
      }

      if (!editing && !file) {
        return notify("Selecciona la imagen del producto.", "error");
      }

      if (state.catalog.some(item =>
        item.id !== editingCatalogId &&
        item.reference.toLowerCase() === reference.toLowerCase()
      )) {
        return notify("Ya existe un producto en la tienda con esa referencia.", "error");
      }

      const originalText = submit.textContent;
      submit.disabled = true;
      submit.textContent = file ? "Subiendo imagen..." : "Guardando...";

      let newImageUrl = null;

      try {
        if (file) newImageUrl = await uploadProductImage(file);

        submit.textContent = "Guardando...";

        const payload = {
          referencia: reference,
          nombre: name,
          descripcion: description,
          categoria: category,
          precio: price,
          colores: colors.length ? colors : [{ nombre: "Único", valor: "#9aabcc" }]
        };

        if (newImageUrl) payload.imagen_url = newImageUrl;

        const result = editing
          ? await db.from("catalogo_web").update(payload).eq("id", editing.id)
          : await db.from("catalogo_web").insert({
              ...payload,
              id: crypto.randomUUID(),
              activo: true
            });

        if (result.error) throw result.error;

        if (editing && newImageUrl && currentImage) {
          removeProductImage(currentImage);
        }
      } catch (error) {
        console.error("Error guardando el producto de la tienda:", error);

        // Si no se pudo guardar el producto, se borra la imagen que sí se subió.
        if (newImageUrl) removeProductImage(newImageUrl);

        let message = error.message || "No se pudo guardar el producto.";

        if (error.code === "42P01" || error.code === "42703" || /does not exist|schema cache/i.test(message)) {
          message = "Falta preparar el catálogo en Supabase. Ejecuta el script catalogo_tienda.sql.";
        } else if (error.code === "23505") {
          message = "Ya existe un producto en la tienda con esa referencia.";
        } else if (error.code === "42501" || /row-level security/i.test(message)) {
          message = "Supabase no permite esta acción con tu cuenta. Solo los administradores pueden administrar el catálogo.";
        }

        notify(message, "error");
        submit.disabled = false;
        submit.textContent = originalText;
        return;
      }

      const wasEditing = Boolean(editing);
      editingCatalogId = null;

      try {
        await loadSupabaseState();
        renderCatalog();
        notify(wasEditing ? "Producto de la tienda actualizado." : "Producto publicado en la tienda.", "success");
      } catch (error) {
        console.error(error);
        notify("El producto se guardó, pero no se pudo refrescar la pantalla. Recarga la página.", "error");
      }
    });

    renderCatalogTable();
  }

  function renderCatalogTable() {
    const rows = state.catalog.map(item => {
      const image = safeImageUrl(item.imageUrl);
      const dots = item.colors
        .filter(color => color && isHexColor(color.valor))
        .map(color => `<i class="color-dot" title="${escapeHTML(color.nombre)}" style="background:${escapeHTML(color.valor)}"></i>`)
        .join("");

      return `
        <tr>
          <td>${image ? `<img class="thumb" src="${escapeHTML(image)}" alt="" loading="lazy">` : "—"}</td>
          <td>${escapeHTML(item.reference)}</td>
          <td>
            <strong>${escapeHTML(item.name)}</strong><br>
            <span class="muted">${escapeHTML(item.description)}</span>
          </td>
          <td>${escapeHTML(item.category || "—")}</td>
          <td>${money(item.price)}</td>
          <td>${dots || "—"}</td>
          <td>
            <strong class="${item.active ? "stock-ok" : "stock-low"}">
              ${item.active ? "Publicado" : "Oculto"}
            </strong>
          </td>
          <td>
            <button class="btn btn-ghost btn-small" data-catalog-edit="${escapeHTML(item.id)}">Editar</button>
            <button class="btn btn-ghost btn-small" data-catalog-toggle="${escapeHTML(item.id)}">
              ${item.active ? "Ocultar" : "Publicar"}
            </button>
            <button class="btn btn-danger btn-small" data-catalog-delete="${escapeHTML(item.id)}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join("");

    $("catalogTable").innerHTML = table(
      ["Imagen", "Referencia", "Producto", "Categoría", "Precio", "Colores", "Estado", "Acciones"],
      rows,
      "Todavía no hay productos en la tienda. Crea el primero con el formulario."
    );

    $("catalogTable").querySelectorAll("[data-catalog-edit]").forEach(button => {
      button.addEventListener("click", () => {
        editingCatalogId = button.dataset.catalogEdit;
        renderCatalog();
        notify("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    $("catalogTable").querySelectorAll("[data-catalog-toggle]").forEach(button => {
      button.addEventListener("click", async () => {
        const item = state.catalog.find(entry => entry.id === button.dataset.catalogToggle);
        if (!item || role !== "administrador") return;

        button.disabled = true;

        try {
          const result = await db.from("catalogo_web").update({ activo: !item.active }).eq("id", item.id);
          if (result.error) throw result.error;

          await loadSupabaseState();
          renderCatalog();
          notify(item.active ? "Producto oculto de la tienda." : "Producto publicado en la tienda.", "success");
        } catch (error) {
          console.error(error);
          notify(error.message || "No se pudo cambiar el estado.", "error");
          button.disabled = false;
        }
      });
    });

    $("catalogTable").querySelectorAll("[data-catalog-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const item = state.catalog.find(entry => entry.id === button.dataset.catalogDelete);
        if (!item || role !== "administrador") return;

        if (!await confirmAction({
          title: "Quitar de la tienda",
          text: `¿Eliminar "${item.name}" de la tienda? Esto no afecta el stock ni las ventas.`,
          confirmLabel: "Eliminar",
          danger: true
        })) return;

        button.disabled = true;

        try {
          const result = await db.from("catalogo_web").delete().eq("id", item.id);
          if (result.error) throw result.error;

          removeProductImage(item.imageUrl);
          if (editingCatalogId === item.id) editingCatalogId = null;

          await loadSupabaseState();
          renderCatalog();
          notify("Producto eliminado de la tienda.", "success");
        } catch (error) {
          console.error(error);
          notify(error.message || "No se pudo eliminar el producto.", "error");
          button.disabled = false;
        }
      });
    });
  }

  function renderStock() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>Crear producto</h3>

        <form id="productForm" class="form-grid">
          <div class="field">
            <label for="pCode">Código único</label>
            <input id="pCode" maxlength="50" required>
          </div>

          <div class="field">
            <label for="pName">Nombre del producto</label>
            <input id="pName" maxlength="150" required>
          </div>

          <div class="field wide">
            <label for="pDescription">Descripción</label>
            <input id="pDescription" maxlength="220" required>
          </div>

          <div class="field">
            <label for="pPrice">
              Valor unitario de salida / venta (COP)
            </label>
            <input id="pPrice" type="number" min="0"
              step="1" required>
          </div>

          <div class="field">
            <label for="pStock">Cantidad inicial</label>
            <input id="pStock" type="number" min="0"
              step="1" value="0" required>
          </div>

          <div class="field">
            <label for="pReorder">
              Solicitar pedido cuando el stock sea igual o inferior a
            </label>
            <input id="pReorder" type="number" min="0"
              step="1" value="5" required>
          </div>

          <div>
            <button class="btn btn-primary" type="submit">
              Crear producto
            </button>
          </div>
        </form>
      </div>

      <div class="form-panel">
        <h3>Cargar stock desde Excel</h3>
        <p class="muted">
          Sube un archivo .xlsx con tus productos. Los códigos nuevos se crean con su cantidad inicial.
          Los códigos que ya existen solo actualizan nombre, descripción, precio y nivel de pedido;
          su cantidad no cambia (para sumar unidades usa "Entrada de mercancía").
        </p>

        <div class="toolbar">
          <button class="btn btn-ghost" type="button" id="stockTemplate">Descargar plantilla</button>

          <div class="field">
            <label for="stockFile">Archivo Excel (.xlsx)</label>
            <input id="stockFile" type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
          </div>

          <button class="btn btn-ghost" type="button" id="stockExport">Descargar stock actual</button>
        </div>

        <div id="stockImportPreview"></div>
      </div>

      <h3>Tabla general de stock</h3>
      <p class="muted">
        El total vendido corresponde a las ventas netas después de
        descuentos. El costo de entrada suma las entradas registradas.
      </p>

      <div id="stockTable"></div>
    `;

    $("productForm").addEventListener("submit", event => {
      event.preventDefault();

      if (role !== "administrador") {
        return notify("Acceso restringido.", "error");
      }

      const code = $("pCode").value.trim().toUpperCase();
      const name = $("pName").value.trim();
      const description = $("pDescription").value.trim();
            const price = Number($("pPrice").value);
      const stock = Number($("pStock").value);
      const reorderLevel = Number($("pReorder").value);

      if (
        !name ||
        !code ||
        !description ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(stock) ||
        stock < 0 ||
        !Number.isInteger(reorderLevel) ||
        reorderLevel < 0
      ) {
        return notify("Revisa los datos del producto.", "error");
      }

      if (state.products.some(product =>
        product.code.toLowerCase() === code.toLowerCase()
      )) {
        return notify(
          "Ya existe un producto con ese código.",
          "error"
        );
      }

      state.products.push({
        id: crypto.randomUUID(),
        name,
        description,
        code,
        price,
        stock,
        reorderLevel
      });

      if (!saveState()) return;

      notify("Producto creado correctamente.", "success");
      renderDashboard();
      renderStock();
    });

    renderStockTable();
    setupStockExcel();
  }

  // =====================================================
  // STOCK <-> EXCEL
  // =====================================================
  const STOCK_HEADERS = {
    code: ["codigo", "codigodeproducto", "referencia", "ref"],
    name: ["nombre", "nombredelproducto", "nombreproducto", "producto"],
    description: ["descripcion", "descripciondeproducto"],
    price: ["precio", "preciodeventa", "precioventa", "valor", "valorunitario", "preciounitario", "valorunitariodesalida"],
    stock: ["cantidad", "cantidadinicial", "stock", "existencias", "inventario"],
    reorder: ["niveldepedido", "nivelreorden", "reorden", "minimo", "stockminimo"]
  };

  const MAX_IMPORT_ROWS = 500;

  const normalizeHeader = value => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  // Acepta 25000, "25.000", "$ 25.000" o "25000,50".
  function parseNumberCell(value) {
    if (typeof value === "number") return value;

    let text = String(value ?? "").trim().replace(/[$\s]/g, "");
    if (!text) return NaN;

    if (/^\d{1,3}([.,]\d{3})+$/.test(text)) text = text.replace(/[.,]/g, "");
    else text = text.replace(",", ".");

    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
  }

  const cellText = value => String(value ?? "").replace(/\s+/g, " ").trim();

  // Convierte las filas del Excel en un plan: qué se crea, qué se actualiza y qué tiene errores.
  function buildStockPlan(rows, inactiveCodes) {
    let headerIndex = -1;
    let columns = {};

    for (let i = 0; i < Math.min(rows.length, 10) && headerIndex < 0; i++) {
      const found = {};
      (rows[i] || []).forEach((value, column) => {
        const key = normalizeHeader(value);
        Object.entries(STOCK_HEADERS).forEach(([field, names]) => {
          if (names.includes(key) && found[field] === undefined) found[field] = column;
        });
      });

      if (found.code !== undefined && found.name !== undefined && found.price !== undefined) {
        headerIndex = i;
        columns = found;
      }
    }

    if (headerIndex < 0) {
      throw new Error('No se encontraron las columnas. La primera fila debe tener: Código, Nombre y Precio (y opcionalmente Descripción, Cantidad y Nivel de pedido). Descarga la plantilla.');
    }

    const existing = new Map(state.products.map(product => [product.code.toLowerCase(), product]));
    const seen = new Set();
    const items = [];

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const get = field => columns[field] === undefined ? "" : row[columns[field]];

      if (row.every(value => cellText(value) === "")) continue;

      const item = {
        line: i + 1,
        code: cellText(get("code")).toUpperCase(),
        name: cellText(get("name")),
        description: cellText(get("description")),
        price: parseNumberCell(get("price")),
        stock: cellText(get("stock")) === "" ? 0 : parseNumberCell(get("stock")),
        reorder: cellText(get("reorder")) === "" ? 5 : parseNumberCell(get("reorder")),
        status: "new",
        error: ""
      };

      if (!item.description) item.description = item.name;
      const key = item.code.toLowerCase();

      if (!item.code) item.error = "Falta el código.";
      else if (item.code.length > 50) item.error = "El código supera 50 caracteres.";
      else if (!item.name) item.error = "Falta el nombre.";
      else if (item.name.length > 150) item.error = "El nombre supera 150 caracteres.";
      else if (!Number.isFinite(item.price) || item.price < 0) item.error = "El precio no es válido.";
      else if (!Number.isInteger(item.stock) || item.stock < 0) item.error = "La cantidad debe ser un entero de 0 o más.";
      else if (!Number.isInteger(item.reorder) || item.reorder < 0) item.error = "El nivel de pedido debe ser un entero de 0 o más.";
      else if (seen.has(key)) item.error = "Código repetido dentro del archivo.";
      else if (inactiveCodes.has(key)) item.error = "Existe un producto desactivado con este código.";

      if (item.error) {
        item.status = "error";
      } else {
        seen.add(key);
        const current = existing.get(key);
        if (current) {
          item.status = "update";
          item.id = current.id;
          item.changed =
            current.name !== item.name ||
            (current.description || "") !== item.description ||
            Number(current.price) !== item.price ||
            Number(current.reorderLevel) !== item.reorder;
        }
      }

      items.push(item);
      if (items.length > MAX_IMPORT_ROWS) {
        throw new Error(`El archivo tiene más de ${MAX_IMPORT_ROWS} productos. Divídelo en varios archivos.`);
      }
    }

    if (!items.length) throw new Error("El archivo no tiene productos debajo de los encabezados.");
    return items;
  }

  function setupStockExcel() {
    let plan = [];

    $("stockTemplate").addEventListener("click", () => {
      const header = ["Código", "Nombre", "Descripción", "Precio de venta", "Cantidad inicial", "Nivel de pedido"]
        .map(text => ({ v: text, s: "header" }));

      downloadExcel("PhonePlanet_Plantilla_Stock.xlsx", [
        {
          name: "Productos",
          widths: [16, 30, 38, 18, 18, 18],
          freezeRows: 1,
          rows: [
            header,
            ["CAB-001", "Cable Tipo C", "Cable de carga rápida 1 m", { v: 20000, s: "money" }, 10, 5],
            ["FUN-002", "Funda Transparente", "Funda antigolpes", { v: 25000, s: "money" }, 6, 3]
          ]
        },
        {
          name: "Instrucciones",
          widths: [90],
          rows: [
            [{ v: "Cómo llenar la plantilla", s: "title" }],
            ["1. Escribe un producto por fila, debajo de los encabezados. Borra las filas de ejemplo."],
            ["2. Código, Nombre y Precio de venta son obligatorios."],
            ["3. Descripción es opcional (si la dejas vacía se usa el nombre)."],
            ["4. Cantidad inicial es opcional (por defecto 0). Nivel de pedido es opcional (por defecto 5)."],
            ["5. Si el código ya existe, solo se actualizan nombre, descripción, precio y nivel de pedido."],
            ["6. La cantidad de un producto que ya existe NO cambia: usa 'Entrada de mercancía'."],
            ["7. Máximo 500 productos por archivo."]
          ]
        }
      ]);
    });

    $("stockExport").addEventListener("click", () => {
      const rows = state.products.map(product => {
        const reorder = Number(product.reorderLevel ?? 5);
        return [
          product.code, product.name, product.description || product.name, product.stock,
          product.price, productSalesTotal(product.id), productIncomingCost(product.id),
          Number(product.stock) <= reorder ? "SÍ" : "NO"
        ];
      });

      downloadExcel(`PhonePlanet_Stock_${today()}.xlsx`, [
        dataSheet("Stock", [
          { header: "Código", width: 16 },
          { header: "Nombre", width: 30 },
          { header: "Descripción", width: 38 },
          { header: "Cantidad", width: 12, type: "int" },
          { header: "Valor unitario de salida", width: 22, type: "money" },
          { header: "Total vendido", width: 18, type: "money" },
          { header: "Total costo entrada", width: 20, type: "money" },
          { header: "¿Hacer pedido?", width: 16 }
        ], rows, { 5: sumBy(state.products, p => productSalesTotal(p.id)), 6: sumBy(state.products, p => productIncomingCost(p.id)) })
      ]);
    });

    const preview = $("stockImportPreview");

    const badge = item => ({
      new: '<span class="import-badge badge-new">Nuevo</span>',
      update: item.changed
        ? '<span class="import-badge badge-update">Se actualiza</span>'
        : '<span class="import-badge badge-same">Sin cambios</span>',
      error: `<span class="import-badge badge-error">${escapeHTML(item.error)}</span>`
    }[item.status]);

    const drawPlan = () => {
      const created = plan.filter(item => item.status === "new");
      const updated = plan.filter(item => item.status === "update" && item.changed);
      const failed = plan.filter(item => item.status === "error");
      const nothing = !created.length && !updated.length;

      preview.innerHTML = `
        <p class="import-summary">
          <strong>${created.length}</strong> nuevos ·
          <strong>${updated.length}</strong> por actualizar ·
          <strong class="${failed.length ? "stock-low" : ""}">${failed.length}</strong> con errores
          ${failed.length ? '<br><span class="muted">Las filas con error no se cargarán. Corrígelas en el Excel y vuelve a subirlo si las necesitas.</span>' : ""}
        </p>

        ${table(
          ["Fila", "Código", "Nombre", "Precio", "Cantidad", "Nivel de pedido", "Resultado"],
          plan.map(item => `
            <tr>
              <td>${item.line}</td>
              <td>${escapeHTML(item.code || "—")}</td>
              <td>${escapeHTML(item.name || "—")}</td>
              <td>${Number.isFinite(item.price) ? money(item.price) : "—"}</td>
              <td>${item.status === "update" ? "No cambia" : (Number.isFinite(item.stock) ? item.stock : "—")}</td>
              <td>${Number.isFinite(item.reorder) ? item.reorder : "—"}</td>
              <td>${badge(item)}</td>
            </tr>
          `).join("")
        )}

        <div class="form-actions">
          <button class="btn btn-primary" type="button" id="stockConfirm" ${nothing ? "disabled" : ""}>
            Confirmar carga (${created.length} nuevos, ${updated.length} por actualizar)
          </button>
          <button class="btn btn-ghost" type="button" id="stockCancel">Cancelar</button>
        </div>
      `;

      $("stockCancel").addEventListener("click", () => {
        plan = [];
        preview.innerHTML = "";
        $("stockFile").value = "";
        notify("");
      });

      $("stockConfirm").addEventListener("click", async () => {
        if (role !== "administrador") return notify("Acceso restringido.", "error");

        const confirmButton = $("stockConfirm");
        confirmButton.disabled = true;

        let createdCount = 0;
        let updatedCount = 0;

        try {
          for (let i = 0; i < created.length; i += 100) {
            confirmButton.textContent = `Cargando… ${Math.min(i + 100, created.length)} de ${created.length}`;

            const chunk = created.slice(i, i + 100).map(item => ({
              id: crypto.randomUUID(),
              codigo: item.code,
              nombre: item.name,
              descripcion: item.description,
              precio: item.price,
              stock: item.stock,
              nivel_reorden: item.reorder,
              activo: true
            }));

            const result = await db.from("productos").insert(chunk);
            if (result.error) throw result.error;
            createdCount += chunk.length;
          }

          for (const item of updated) {
            confirmButton.textContent = `Actualizando… ${updatedCount + 1} de ${updated.length}`;

            const result = await db.from("productos")
              .update({
                nombre: item.name,
                descripcion: item.description,
                precio: item.price,
                nivel_reorden: item.reorder
              })
              .eq("id", item.id);

            if (result.error) throw result.error;
            updatedCount++;
          }
        } catch (error) {
          console.error("Error cargando stock desde Excel:", error);

          let message = error.message || "No se pudo completar la carga.";
          if (error.code === "23505") message = "Hay un código repetido en la base de datos. Revisa los códigos del archivo.";
          if (error.code === "42501" || /row-level security/i.test(message)) message = "Supabase no permite esta acción con tu cuenta.";

          notify(`${message} Se cargaron ${createdCount} nuevos y ${updatedCount} actualizaciones antes del error.`, "error");

          try { await loadSupabaseState(); renderDashboard(); renderStock(); } catch (_) { /* sin refrescar */ }
          return;
        }

        await loadSupabaseState();
        renderDashboard();
        renderStock();
        notify(`Stock cargado: ${createdCount} productos nuevos y ${updatedCount} actualizados.`, "success");
      });
    };

    $("stockFile").addEventListener("change", async () => {
      const file = $("stockFile").files[0];
      plan = [];
      preview.innerHTML = "";
      if (!file) return;

      if (!excelAvailable()) return;

      if (!/\.xlsx$/i.test(file.name)) {
        return notify("Usa un archivo de Excel con extensión .xlsx.", "error");
      }

      try {
        notify("Leyendo el archivo…");
        const sheet = await window.PhonePlanetExcel.read(file);

        // Códigos de productos desactivados (si existen, no se pueden volver a crear).
        const inactive = await db.from("productos").select("codigo").eq("activo", false);
        const inactiveCodes = new Set(
          (inactive.data || []).map(row => String(row.codigo || "").toLowerCase())
        );

        plan = buildStockPlan(sheet.rows, inactiveCodes);
        drawPlan();
        notify("Revisa el resultado y confirma la carga.", "success");
      } catch (error) {
        console.error("Error leyendo Excel:", error);
        notify(error.message || "No se pudo leer el archivo.", "error");
        $("stockFile").value = "";
      }
    });
  }

  function productSalesTotal(productId) {
    return state.sales
      .filter(sale => sale.productId === productId)
      .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  }

  function productIncomingCost(productId) {
    return state.incoming
      .filter(entry => entry.productId === productId)
      .reduce((sum, entry) =>
        sum + (
          Number(entry.totalCost) ||
          (Number(entry.unitValue) || 0) * (Number(entry.qty) || 0)
        ), 0);
  }

  function renderStockTable() {
    const rows = state.products.map(product => {
      const salesTotal = productSalesTotal(product.id);
      const incomingCost = productIncomingCost(product.id);
      const reorder = Number(product.reorderLevel ?? 5);
      const orderNeeded = Number(product.stock) <= reorder;

      return `
        <tr>
          <td>${escapeHTML(product.code)}</td>
          <td>${escapeHTML(product.description || product.name)}</td>
          <td>${product.stock}</td>
          <td>${money(product.price)}</td>
          <td>${money(salesTotal)}</td>
          <td>${money(incomingCost)}</td>
          <td>
            <strong class="${orderNeeded ? "stock-low" : "stock-ok"}">
              ${orderNeeded ? "SÍ · Hacer pedido" : "NO"}
            </strong>
          </td>
          <td>
            <button class="btn btn-ghost btn-small"
              data-edit="${escapeHTML(product.id)}">
              Editar
            </button>
            <button class="btn btn-danger btn-small"
              data-delete="${escapeHTML(product.id)}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join("");

    $("stockTable").innerHTML = table(
      [
        "Código de producto",
        "Descripción de producto",
        "Cantidad",
        "Valor unitario de salida",
        "Total vendido",
        "Total costo entrada",
        "¿Hacer pedido?",
        "Acciones"
      ],
      rows
    );

    $("stockTable")
      .querySelectorAll("[data-edit]")
      .forEach(button => {
        button.addEventListener("click", () => {
          editProduct(button.dataset.edit);
        });
      });

    $("stockTable")
      .querySelectorAll("[data-delete]")
      .forEach(button => {
        button.addEventListener("click", () => {
          deleteProduct(button.dataset.delete);
        });
      });
  }

  async function editProduct(id) {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const product = state.products.find(item => item.id === id);
    if (!product) return;

    const values = await formDialog({
      title: "Editar producto",
      text: `Modifica los datos de ${product.name}. El stock actual no cambia.`,
      confirmLabel: "Guardar cambios",
      fields: [
        { name: "code", label: "Código del producto", value: product.code, maxLength: 40 },
        { name: "name", label: "Nombre del producto", value: product.name, maxLength: 160 },
        { name: "description", label: "Descripción", value: product.description || product.name, maxLength: 300 },
        { name: "price", label: "Valor unitario de venta (COP)", type: "number", value: product.price, min: 0, step: "1" },
        { name: "reorder", label: "Pedir cuando el stock sea igual o inferior a", type: "number", value: product.reorderLevel ?? 5, min: 0, step: "1" }
      ]
    });
    if (!values) return;

    const code = values.code;
    const name = values.name;
    const description = values.description;
    const priceText = values.price;
    const reorderText = values.reorder;

    const price = Number(priceText);
    const reorderLevel = Number(reorderText);
    const normalizedCode = code.trim().toUpperCase();

    if (
      !normalizedCode ||
      !name.trim() ||
      !description.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0
    ) {
      return notify("Datos inválidos.", "error");
    }

    if (state.products.some(item =>
      item.id !== id &&
      item.code.toLowerCase() === normalizedCode.toLowerCase()
    )) {
      return notify(
        "Ese código ya pertenece a otro producto.",
        "error"
      );
    }

    product.code = normalizedCode;
    product.name = name.trim();
    product.description = description.trim();
    product.price = price;
    product.reorderLevel = reorderLevel;

    if (!saveState()) return;

    renderDashboard();
    renderStock();
    notify("Producto actualizado.", "success");
  }

  async function deleteProduct(id) {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const product = state.products.find(item => item.id === id);
    if (!product) return;

    if (
      state.sales.some(sale => sale.productId === id) ||
      state.incoming.some(entry => entry.productId === id)
    ) {
      return notify(
        "No se puede eliminar porque tiene ventas o entradas asociadas. Puedes dejarlo sin stock.",
        "error"
      );
    }

    if (!await confirmAction({
      title: "Eliminar producto",
      text: `¿Eliminar "${product.name}" del catálogo?`,
      confirmLabel: "Eliminar",
      danger: true
    })) return;

    state.products = state.products.filter(item => item.id !== id);

    if (!saveState()) return;

    renderDashboard();
    renderStock();
    notify("Producto eliminado.", "success");
  }
    function renderSalesHistory() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const total = state.sales.reduce(
      (sum, sale) => sum + sale.total,
      0
    );

    const counts = {};

    state.sales.forEach(sale => {
      if (!counts[sale.employeeId]) {
        counts[sale.employeeId] = { count: 0, total: 0 };
      }

      counts[sale.employeeId].count++;
      counts[sale.employeeId].total += sale.total;
    });

    const summaryRows = state.employees.map(employee => {
      const count = counts[employee.id] || { count: 0, total: 0 };

      return `
        <tr>
          <td>${escapeHTML(employee.name)}</td>
          <td>${count.count}</td>
          <td>${money(count.total)}</td>
          <td>${count.count ? money(count.total / count.count) : money(0)}</td>
        </tr>
      `;
    }).join("");

    const orphanSales = state.sales.filter(
      sale => !state.employees.some(e => e.id === sale.employeeId)
    );

    const orphanRow = orphanSales.length
      ? `
        <tr>
          <td>Empleados eliminados</td>
          <td>${orphanSales.length}</td>
          <td>${money(orphanSales.reduce((sum, sale) => sum + sale.total, 0))}</td>
          <td>${money(orphanSales.reduce((sum, sale) => sum + sale.total, 0) / orphanSales.length)}</td>
        </tr>
      `
      : "";


    $("workspaceContent").innerHTML = `
      <div class="stats">
        <div class="stat">
          <span>Total vendido</span>
          <strong>${money(total)}</strong>
          <small>Todas las ventas</small>
        </div>
        <div class="stat">
          <span>Transacciones</span>
          <strong>${state.sales.length}</strong>
          <small>Ventas registradas</small>
        </div>
        <div class="stat">
          <span>Promedio por venta</span>
          <strong>${money(state.sales.length ? total / state.sales.length : 0)}</strong>
          <small>Ticket promedio</small>
        </div>
        <div class="stat">
          <span>Empleados con ventas</span>
          <strong>${state.employees.filter(e => counts[e.id]).length}</strong>
          <small>Con al menos una venta</small>
        </div>
      </div>

      <h3>Ventas por empleado</h3>

      ${table(
        ["Empleado", "N.º ventas", "Total vendido", "Promedio por venta"],
        summaryRows + orphanRow,
        "Todavía no hay ventas registradas."
      )}

      <h3 style="margin-top:25px">Detalle de ventas</h3>

      <div class="toolbar">
        <div class="field">
          <label for="salesFilter">Filtrar por empleado</label>
          <select id="salesFilter">
            <option value="">Todos los empleados</option>
            ${employeeOptions()}
          </select>
        </div>

        <div class="field">
          <label for="salesDateFrom">Desde</label>
          <input id="salesDateFrom" type="date">
        </div>

        <div class="field">
          <label for="salesDateTo">Hasta</label>
          <input id="salesDateTo" type="date">
        </div>

        <button class="btn btn-ghost" id="applySalesFilter" type="button">
          Aplicar filtros
        </button>

        <button class="btn btn-ghost" id="clearSalesFilter" type="button">
          Limpiar
        </button>

        <button class="btn btn-primary" id="salesExcel" type="button">
          Descargar Excel
        </button>
      </div>

      <div id="salesDetailTable"></div>
    `;

    $("applySalesFilter").addEventListener("click", filterSales);

    $("clearSalesFilter").addEventListener("click", () => {
      $("salesFilter").value = "";
      $("salesDateFrom").value = "";
      $("salesDateTo").value = "";
      filterSales();
    });

    $("salesExcel").addEventListener("click", exportSalesExcel);

    filterSales();
  }

  let salesShown = [];

  function exportSalesExcel() {
    const rows = salesShown.slice().reverse().map(sale => [
      sale.date,
      saleEmployeeName(sale),
      sale.productCode || "",
      sale.productName,
      sale.qty,
      sale.originalUnitPrice ?? sale.unitPrice,
      (sale.discountPerUnit || 0) * sale.qty,
      sale.paymentMethod || "Sin registrar",
      sale.total,
      sale.note || ""
    ]);

    downloadExcel(`PhonePlanet_Ventas_${today()}.xlsx`, [
      dataSheet("Ventas", [
        { header: "Fecha", width: 12, type: "date" },
        { header: "Empleado", width: 26 },
        { header: "Código", width: 14 },
        { header: "Producto", width: 34 },
        { header: "Cantidad", width: 10, type: "int" },
        { header: "Precio unitario", width: 16, type: "money" },
        { header: "Descuento", width: 14, type: "money" },
        { header: "Medio de pago", width: 24 },
        { header: "Total final", width: 16, type: "money" },
        { header: "Nota", width: 30 }
      ], rows, { 6: sumBy(salesShown, s => (s.discountPerUnit || 0) * s.qty), 8: sumBy(salesShown, s => s.total) })
    ]);
  }

  function filterSales() {
    const employee = $("salesFilter").value;
    const from = $("salesDateFrom").value;
    const to = $("salesDateTo").value;

    const filtered = state.sales.filter(sale =>
      (!employee || sale.employeeId === employee) &&
      (!from || sale.date >= from) &&
      (!to || sale.date <= to)
    );

    salesShown = filtered;

    const rows = filtered.slice().reverse().map(sale => `
      <tr>
        <td>${escapeHTML(sale.date)}</td>
        <td>${escapeHTML(saleEmployeeName(sale))}</td>
        <td>${escapeHTML(sale.productCode || "—")}</td>
        <td>${escapeHTML(sale.productName)}</td>
        <td>${sale.qty}</td>
        <td>${money(sale.originalUnitPrice ?? sale.unitPrice)}</td>
        <td>${money((sale.discountPerUnit || 0) * sale.qty)}</td>
        <td>${escapeHTML(sale.paymentMethod || "—")}</td>
        <td>${money(sale.total)}</td>
        <td>${escapeHTML(sale.note || "—")}</td>
      </tr>
    `).join("");

    $("salesDetailTable").innerHTML = table(
      [
        "Fecha", "Empleado", "Código", "Producto", "Cantidad",
        "Precio unit.", "Descuento", "Medio de pago", "Total final", "Nota"
      ],
      rows,
      "No hay ventas con esos filtros."
    );
  }

 


  // =====================================================
  // Ventana de confirmación con el diseño del panel
  // (reemplaza la ventana nativa del navegador).
  // =====================================================
  function confirmAction({
    title = "Confirmar acción",
    text = "¿Deseas continuar?",
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
    icon = danger ? "🗑️" : "❔"
  } = {}) {
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "confirm-dialog confirm-dialog--custom";
      dialog.innerHTML = `
        <div class="confirm-dialog__body">
          <div class="confirm-dialog__icon ${danger ? "is-danger" : ""}" aria-hidden="true">${icon}</div>
          <h3></h3>
          <p></p>
        </div>
        <div class="confirm-dialog__actions">
          <button type="button" class="btn btn-ghost" data-cancel></button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok></button>
        </div>
      `;
      dialog.querySelector("h3").textContent = title;
      dialog.querySelector("p").textContent = text;
      dialog.querySelector("[data-cancel]").textContent = cancelLabel;
      dialog.querySelector("[data-ok]").textContent = confirmLabel;

      let answer = false;
      const finish = value => {
        answer = value;
        dialog.close();
      };

      dialog.querySelector("[data-ok]").addEventListener("click", () => finish(true));
      dialog.querySelector("[data-cancel]").addEventListener("click", () => finish(false));
      dialog.addEventListener("cancel", () => { answer = false; });
      dialog.addEventListener("click", event => {
        if (event.target === dialog) finish(false);
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        resolve(answer);
      });

      document.body.appendChild(dialog);

      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }

      dialog.querySelector(danger ? "[data-cancel]" : "[data-ok]").focus();
    });
  }


  // Ventana con formulario del diseño del panel (reemplaza prompt()).
  // fields: [{name,label,type,value,hint,step,min}] -> resuelve con
  // un objeto {name: valor} o null si se cancela.
  function formDialog({ title, text = "", fields = [], confirmLabel = "Guardar", icon = "✏️" }) {
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "confirm-dialog confirm-dialog--custom confirm-dialog--form";
      dialog.innerHTML = `
        <form class="confirm-dialog__form" novalidate>
          <div class="confirm-dialog__body">
            <div class="confirm-dialog__icon" aria-hidden="true">${icon}</div>
            <h3></h3>
            <p></p>
          </div>
          <div class="confirm-dialog__fields"></div>
          <p class="confirm-dialog__error" role="alert" hidden></p>
          <div class="confirm-dialog__actions">
            <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
            <button type="submit" class="btn btn-primary"></button>
          </div>
        </form>
      `;
      dialog.querySelector("h3").textContent = title;
      const pText = dialog.querySelector(".confirm-dialog__body p");
      pText.textContent = text;
      pText.hidden = !text;
      dialog.querySelector('[type="submit"]').textContent = confirmLabel;

      const box = dialog.querySelector(".confirm-dialog__fields");
      fields.forEach((field, index) => {
        const wrap = document.createElement("label");
        wrap.className = "confirm-dialog__field";
        const span = document.createElement("span");
        span.textContent = field.label;
        const input = document.createElement("input");
        input.type = field.type || "text";
        input.name = field.name;
        input.value = field.value ?? "";
        if (field.step) input.step = field.step;
        if (field.min !== undefined) input.min = field.min;
        if (field.maxLength) input.maxLength = field.maxLength;
        input.autocomplete = "off";
        wrap.append(span, input);
        if (field.hint) {
          const small = document.createElement("small");
          small.textContent = field.hint;
          wrap.append(small);
        }
        box.append(wrap);
        input.dataset.index = index;
      });

      let result = null;
      const form = dialog.querySelector("form");

      form.addEventListener("submit", event => {
        event.preventDefault();
        const values = {};
        form.querySelectorAll("input").forEach(input => {
          values[input.name] = input.value;
        });
        result = values;
        dialog.close();
      });
      dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        resolve(result);
      });

      document.body.appendChild(dialog);
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      const first = dialog.querySelector("input");
      if (first) { first.focus(); first.select?.(); }
    });
  }

  // =====================================================
  // Llamada a la Edge Function "administrar-empleados".
  // Solo la usa el panel de administrador; el servidor
  // vuelve a validar que quien llama sea administrador.
  // =====================================================
  async function administrarEmpleado(payload) {
    if (role !== "administrador") {
      throw new Error("Solo un administrador puede realizar esta acción.");
    }

    const { data: sesion } = await db.auth.getSession();
    if (!sesion?.session) {
      throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    }

    const { data, error } = await db.functions.invoke("administrar-empleados", {
      body: payload
    });

    if (error) {
      let mensaje = error.message || "No se pudo completar la operación.";

      // Error HTTP: la función respondió con { error: "..." }.
      try {
        const cuerpo = await error.context.json();
        if (cuerpo?.error) mensaje = cuerpo.error;
      } catch (_) {
        // Error de red/CORS: la función no respondió.
        if (error.name === "FunctionsFetchError") {
          mensaje = "No se pudo contactar la función. Verifica que esté desplegada y que abras el sistema desde https://santi942.github.io";
        }
      }

      throw new Error(mensaje);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }

async function renderEmployees() {
  if (role !== "administrador") {
    return notify("Acceso restringido.", "error");
  }

  const rows = state.employees.map(employee => `
    <tr>
      <td>${escapeHTML(employee.name)}</td>
      <td>${escapeHTML(employee.username || "—")}</td>
      <td>${escapeHTML(employee.email || "—")}</td>
      <td>
        ${
          employee.id === currentProfile?.id || !employee.username
            ? `<span class="role-badge role-badge--${employee.role === "administrador" ? "admin" : "staff"}">${escapeHTML(employee.role || "—")}</span>`
            : `<select
                 class="employee-role"
                 aria-label="Rol de ${escapeHTML(employee.name || "")}"
                 data-code="${escapeHTML(employee.username || "")}"
                 data-name="${escapeHTML(employee.name || "")}"
                 data-current="${escapeHTML(employee.role || "empleado")}">
                 <option value="empleado" ${employee.role === "empleado" ? "selected" : ""}>empleado</option>
                 <option value="administrador" ${employee.role === "administrador" ? "selected" : ""}>administrador</option>
               </select>`
        }
      </td>
      <td>
        ${state.sales.filter(
          sale => sale.employeeId === employee.id
        ).length}
      </td>
      <td>
        <span style="color:${employee.active ? "#16803c" : "#c62828"}">
          ${employee.active ? "Activo" : "Inactivo"}
        </span>
      </td>
      <td>
        ${
          employee.role === "empleado"
            ? `<div class="employee-actions">
                 <button
                   type="button"
                   class="employee-toggle"
                   data-code="${escapeHTML(employee.username || "")}"
                   data-active="${employee.active ? "false" : "true"}">
                   ${employee.active ? "Desactivar" : "Activar"}
                 </button>
                 <button
                   type="button"
                   class="employee-delete"
                   data-code="${escapeHTML(employee.username || "")}"
                   data-name="${escapeHTML(employee.name || "")}">
                   Eliminar
                 </button>
               </div>`
            : "—"
        }
      </td>
    </tr>
  `).join("");

  $("workspaceContent").innerHTML = `
    <section class="employee-panel">
      <div class="employee-panel__heading">
        <div class="employee-panel__icon" aria-hidden="true">👤</div>
        <div>
          <h3>Crear cuenta de usuario</h3>
          <p>Registra un integrante del equipo y elige su rol.</p>
        </div>
      </div>

      <form id="formCrearEmpleado" class="employee-form">
        <div class="employee-field employee-field--full">
          <label for="empleadoNombre">Nombre completo</label>
          <input
            id="empleadoNombre"
            name="nombre"
            type="text"
            maxlength="120"
            placeholder="Ej. María Rodríguez"
            autocomplete="name"
            required
          >
        </div>

        <div class="employee-field">
          <label for="empleadoEmail">Correo electrónico</label>
          <input
            id="empleadoEmail"
            name="email"
            type="email"
            maxlength="254"
            placeholder="empleado@ejemplo.com"
            autocomplete="email"
            required
          >
        </div>

        <div class="employee-field">
          <label for="empleadoContrasena">Contraseña inicial</label>
          <input
            id="empleadoContrasena"
            name="contrasena"
            type="password"
            minlength="8"
            placeholder="Mínimo 8 caracteres"
            autocomplete="new-password"
            required
          >
          <small>Comparte la contraseña inicial de forma segura.</small>
        </div>

        <div class="employee-field">
          <label for="empleadoRol">Rol</label>
          <select id="empleadoRol" name="rol">
            <option value="empleado">Empleado (ventas y consultas)</option>
            <option value="administrador">Administrador (acceso total)</option>
          </select>
          <small>Tú decides qué permisos tendrá esta cuenta.</small>
        </div>

        <div class="employee-form__actions">
          <button type="submit" class="employee-submit">
            <span aria-hidden="true">＋</span>
            Crear usuario
          </button>
        </div>
      </form>
    </section>

    <section class="employee-list-section">
      <div class="employee-list-heading">
        <div>
          <h3>Usuarios registrados</h3>
          <p class="muted">
            Consulta los códigos, roles y estados de acceso.
          </p>
        </div>
        <span class="employee-count">
          ${state.employees.length} usuarios
        </span>
      </div>

      ${table(
        [
          "Nombre",
          "Código",
          "Correo",
          "Rol",
          "Líneas de venta",
          "Estado",
          "Acciones"
        ],
        rows,
        "No hay perfiles visibles para esta cuenta."
      )}
    </section>
  `;

  const form = $("formCrearEmpleado");

  
form.addEventListener("submit", async event => {
  event.preventDefault();

  const boton = form.querySelector('button[type="submit"]');

  if (boton.disabled) return;

  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.innerHTML = "Creando cuenta...";

  try {
    const nombre = $("empleadoNombre").value.trim();
    const email = $("empleadoEmail").value.trim();
    const contrasena = $("empleadoContrasena").value;

    if (!nombre || !email || contrasena.length < 8) {
      throw new Error(
        "Completa los campos y usa una contraseña de mínimo 8 caracteres."
      );
    }

    const rolNuevo = $("empleadoRol").value === "administrador"
      ? "administrador"
      : "empleado";

    if (rolNuevo === "administrador" && !await confirmAction({
      title: "Crear administrador",
      text: `${nombre} tendrá acceso total: podrá ver todas las ventas, crear y eliminar usuarios y administrar la tienda. ¿Continuar?`,
      confirmLabel: "Crear administrador",
      icon: "🛡️"
    })) {
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
      return;
    }

    const resultado = await administrarEmpleado({
      accion: "crear",
      nombre,
      email,
      contrasena,
      rol: rolNuevo
    });

    const codigo =
      resultado?.empleado?.codigo_usuario ||
      resultado?.codigo_usuario ||
      resultado?.codigo;

    await loadSupabaseState();
    await renderEmployees();

    notify(
      codigo
        ? `Usuario creado correctamente. Código: ${codigo}`
        : "Usuario creado correctamente.",
      "success"
    );
  } catch (error) {
    console.error("Error al crear empleado:", error);

    notify(
      error.message || "No se pudo crear el empleado.",
      "error"
    );

    boton.disabled = false;
    boton.innerHTML = textoOriginal;
  }
});


  $("workspaceContent")
    .querySelectorAll(".employee-role")
    .forEach(select => {
      select.addEventListener("change", async () => {
        const codigo = select.dataset.code;
        const nombre = select.dataset.name || codigo;
        const anterior = select.dataset.current;
        const nuevo = select.value;

        if (nuevo === anterior) return;

        const aceptado = await confirmAction({
          title: "Cambiar rol",
          text: nuevo === "administrador"
            ? `${nombre} (${codigo}) pasará a administrador y tendrá acceso total al sistema.`
            : `${nombre} (${codigo}) pasará a empleado y perderá el acceso de administrador.`,
          confirmLabel: "Cambiar rol",
          icon: "🛡️"
        });

        if (!aceptado) {
          select.value = anterior;
          return;
        }

        select.disabled = true;

        try {
          await administrarEmpleado({
            accion: "cambiar_rol",
            codigo_usuario: codigo,
            rol: nuevo
          });

          await loadSupabaseState();
          await renderEmployees();

          notify(`${nombre} ahora es ${nuevo}.`, "success");
        } catch (error) {
          console.error("Error al cambiar rol:", error);
          notify(error.message || "No se pudo cambiar el rol.", "error");
          select.value = anterior;
          select.disabled = false;
        }
      });
    });

  $("workspaceContent")
    .querySelectorAll(".employee-toggle")
    .forEach(boton => {
      boton.addEventListener("click", async () => {
        const codigo = boton.dataset.code;
        const activo = boton.dataset.active === "true";

        if (!await confirmAction({
          title: activo ? "Activar cuenta" : "Desactivar cuenta",
          text: activo
            ? `¿Deseas activar la cuenta ${codigo}? Podrá iniciar sesión de nuevo.`
            : `¿Deseas desactivar la cuenta ${codigo}? No podrá iniciar sesión hasta que la actives.`,
          confirmLabel: activo ? "Activar" : "Desactivar",
          danger: !activo,
          icon: activo ? "✅" : "⏸️"
        })) {
          return;
        }

        boton.disabled = true;

        try {
          await administrarEmpleado({
            accion: "cambiar_estado",
            codigo_usuario: codigo,
            activo
          });

          await loadSupabaseState();
          await renderEmployees();

          notify(
            `Cuenta ${codigo} ${
              activo ? "activada" : "desactivada"
            }.`,
            "success"
          );
        } catch (error) {
          notify(
            error.message || "No se pudo cambiar el estado.",
            "error"
          );

          boton.disabled = false;
        }
      });
    });

  $("workspaceContent")
    .querySelectorAll(".employee-delete")
    .forEach(boton => {
      boton.addEventListener("click", async () => {
        const codigo = boton.dataset.code;
        const nombre = boton.dataset.name || codigo;

        if (!codigo) {
          return notify("Este usuario no tiene código asignado.", "error");
        }

        if (!await confirmAction({
          title: "Eliminar empleado",
          text: `¿Eliminar definitivamente a ${nombre} (${codigo})? Se borrará su cuenta de acceso. Sus ventas y registros se conservan. Esta acción no se puede deshacer.`,
          confirmLabel: "Eliminar",
          danger: true
        })) {
          return;
        }

        boton.disabled = true;
        const textoOriginal = boton.textContent;
        boton.textContent = "Eliminando...";

        try {
          await administrarEmpleado({
            accion: "eliminar",
            codigo_usuario: codigo
          });

          await loadSupabaseState();
          await renderEmployees();

          notify(`Empleado ${codigo} eliminado correctamente.`, "success");
        } catch (error) {
          console.error("Error al eliminar empleado:", error);
          notify(error.message || "No se pudo eliminar el empleado.", "error");

          boton.disabled = false;
          boton.textContent = textoOriginal;
        }
      });
    });
}


  function renderIncomingHistory() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    $("workspaceContent").innerHTML = `
      <div class="toolbar">
        ${dateFilterHTML("incoming")}
        <button class="btn btn-ghost" id="incomingApply" type="button">Aplicar filtros</button>
        <button class="btn btn-ghost" id="incomingClear" type="button">Limpiar</button>
        <button class="btn btn-primary" id="incomingExcel" type="button">Descargar Excel</button>
      </div>
      <div id="incomingTable"></div>
    `;

    let shown = [];

    const draw = () => {
      shown = state.incoming.filter(entry =>
        inDateRange(entry.date, $("incomingFrom").value, $("incomingTo").value)
      );

      const rows = shown.slice().reverse().map(entry => `
        <tr>
          <td>${escapeHTML(entry.date)}</td>
          <td>${escapeHTML(entry.employee)}</td>
          <td>${escapeHTML(entry.code)}</td>
          <td>${escapeHTML(entry.productName)}</td>
          <td>${entry.qty}</td>
          <td>${money(entry.unitValue || 0)}</td>
          <td>${money(entryTotal(entry))}</td>
          <td>${escapeHTML(entry.paymentMethod || "—")}</td>
          <td>${escapeHTML(entry.supplier || "—")}</td>
          <td>${escapeHTML(entry.note || "—")}</td>
        </tr>
      `).join("");

      $("incomingTable").innerHTML = `
        <p class="muted">Total comprado: <strong>${money(sumBy(shown, entryTotal))}</strong></p>
        ${table(
          [
            "Fecha", "Registrado por", "Código", "Producto",
            "Cantidad", "Valor unitario", "Valor total", "Medio de pago",
            "Proveedor", "Observaciones"
          ],
          rows,
          "Todavía no hay entradas de mercancía."
        )}
      `;
    };

    $("incomingApply").addEventListener("click", draw);
    $("incomingClear").addEventListener("click", () => {
      $("incomingFrom").value = "";
      $("incomingTo").value = "";
      draw();
    });

    $("incomingExcel").addEventListener("click", () => {
      const rows = shown.slice().reverse().map(entry => [
        entry.date, entry.employee, entry.code, entry.productName, entry.qty,
        entry.unitValue || 0, entryTotal(entry),
        entry.paymentMethod || "Sin registrar", entry.supplier || "", entry.note || ""
      ]);

      downloadExcel(`PhonePlanet_Mercancia_${today()}.xlsx`, [
        dataSheet("Mercancía", [
          { header: "Fecha", width: 12, type: "date" },
          { header: "Registrado por", width: 24 },
          { header: "Código", width: 14 },
          { header: "Producto", width: 34 },
          { header: "Cantidad", width: 10, type: "int" },
          { header: "Valor unitario", width: 16, type: "money" },
          { header: "Valor total", width: 16, type: "money" },
          { header: "Medio de pago", width: 24 },
          { header: "Proveedor", width: 24 },
          { header: "Observaciones", width: 30 }
        ], rows, { 6: sumBy(shown, entryTotal) })
      ]);
    });

    draw();
  }

  function renderMoneyLog(kind, title, conceptLabel, amountLabel) {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const records = state[kind];
    const label = { expenses: "Gastos", payroll: "Nómina", rent: "Arriendos" }[kind];
    const isPayroll = kind === "payroll";

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>${title}</h3>

        <form id="moneyForm" class="form-grid">
          ${isPayroll ? `
            <div class="field wide">
              <label for="payrollEmployee">Empleado</label>
              <select id="payrollEmployee" required>
                ${employeeOptions()}
              </select>
            </div>
          ` : ""}
          <div class="field wide">
            <label for="moneyConcept">${isPayroll ? "Concepto del pago" : conceptLabel}</label>
            <input id="moneyConcept" maxlength="140" required>
          </div>

          <div class="field">
            <label for="moneyAmount">${amountLabel} (COP)</label>
            <input id="moneyAmount" type="number" min="1"
              step="1" required>
          </div>

          <div class="field">
            <label for="moneyPayment">Medio de pago</label>
            <select id="moneyPayment" required>
              <option value="">Selecciona un medio de pago</option>
              ${PAYMENT_METHODS.map(method => `<option value="${method}">${method}</option>`).join("")}
            </select>
          </div>

          <div class="field">
            <label for="moneyDate">Fecha</label>
            <input id="moneyDate" type="date"
              value="${today()}" required>
          </div>

          <div>
            <button class="btn btn-primary" type="submit">
              Guardar registro
            </button>
          </div>
        </form>
      </div>

      <div class="toolbar">
        ${dateFilterHTML("money")}
        <button class="btn btn-ghost" id="moneyApply" type="button">Aplicar filtros</button>
        <button class="btn btn-ghost" id="moneyClear" type="button">Limpiar</button>
        <button class="btn btn-primary" id="moneyExcel" type="button">Descargar Excel</button>
      </div>

      <div id="moneyTable"></div>
    `;

    const employeeLabel = record => record.employeeId ? employeeName(record.employeeId) : "—";
    let shown = [];

    const renderRows = () => {
      shown = records.filter(record =>
        inDateRange(record.date, $("moneyFrom").value, $("moneyTo").value)
      );

      const rows = shown.slice().reverse().map(record => `
        <tr>
          <td>${escapeHTML(record.date)}</td>
          <td>${escapeHTML(record.concept)}</td>
          ${isPayroll ? `<td>${escapeHTML(employeeLabel(record))}</td>` : ""}
          <td>${escapeHTML(record.paymentMethod || "—")}</td>
          <td>${money(record.amount)}</td>
        </tr>
      `).join("");

      $("moneyTable").innerHTML = `
        <p class="muted">
          Total registrado:
          <strong>${money(sumBy(shown, record => record.amount))}</strong>
        </p>
        ${table(
          isPayroll
            ? ["Fecha", "Concepto", "Empleado", "Medio de pago", "Valor"]
            : ["Fecha", "Concepto", "Medio de pago", "Valor"],
          rows
        )}
      `;
    };

    renderRows();

    $("moneyApply").addEventListener("click", renderRows);
    $("moneyClear").addEventListener("click", () => {
      $("moneyFrom").value = "";
      $("moneyTo").value = "";
      renderRows();
    });

    $("moneyExcel").addEventListener("click", () => {
      const columns = [
        { header: "Fecha", width: 12, type: "date" },
        { header: "Concepto", width: 36 },
        ...(isPayroll ? [{ header: "Empleado", width: 26 }] : []),
        { header: "Medio de pago", width: 24 },
        { header: "Valor", width: 16, type: "money" }
      ];

      const rows = shown.slice().reverse().map(record => [
        record.date,
        record.concept,
        ...(isPayroll ? [employeeLabel(record)] : []),
        record.paymentMethod || "Sin registrar",
        record.amount
      ]);

      downloadExcel(`PhonePlanet_${label}_${today()}.xlsx`, [
        dataSheet(label, columns, rows, { [columns.length - 1]: sumBy(shown, record => record.amount) })
      ]);
    });

    $("moneyForm").addEventListener("submit", event => {
      event.preventDefault();

      const concept = $("moneyConcept").value.trim();
      const amount = Number($("moneyAmount").value);
      const paymentMethod = $("moneyPayment").value;

      if (!concept || !Number.isFinite(amount) || amount <= 0) {
        return notify(
          "Ingresa un concepto y un valor válido.",
          "error"
        );
      }

      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return notify("Selecciona el medio de pago.", "error");
      }

      records.push({
        id: uid(kind.toUpperCase()),
        concept,
        amount,
        paymentMethod,
        employeeId: isPayroll ? $("payrollEmployee").value : null,
        date: $("moneyDate").value || today(),
        createdAt: new Date().toISOString()
      });

      if (!saveState()) return;

      renderRows();
      $("moneyForm").reset();
      $("moneyDate").value = today();

      notify("Registro guardado.", "success");
    });
  }

  // Nombre del vendedor de una venta. Si el empleado fue eliminado,
  // se muestra el nombre que quedó guardado junto a la venta.
  function saleEmployeeName(sale) {
    if (sale.employeeId && state.employees.some(e => e.id === sale.employeeId)) {
      return employeeName(sale.employeeId);
    }
    if (sale.employeeLabel) return `${sale.employeeLabel} (eliminado)`;
    if (!sale.employeeId) return "Empleado eliminado";
    return employeeName(sale.employeeId);
  }

  function employeeName(id) {
    return state.employees.find(employee => employee.id === id)?.name
      || (id === currentUser?.id ? (currentProfile?.nombre || currentUser?.email) : "Empleado no encontrado");
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const roleSwitcherElement = $("roleSwitcher");
  if (roleSwitcherElement) {
    roleSwitcherElement.addEventListener("change", () => {
      if (roleSwitcherElement.value !== role) roleSwitcherElement.value = role;
    });
  }
  if ($("backToMenu")) $("backToMenu").addEventListener("click", goBack);

  // Cerrar sesión: limpia la pantalla, cierra Supabase y vuelve al login.
  const logoutButton = $("logoutBtn");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      // Borrar de la pantalla cualquier dato antes de salir.
      state = emptyState();
      persistedState = null;
      ["dashboardStats", "moduleMenu", "workspaceContent"].forEach(id => {
        const element = $(id);
        if (element) element.innerHTML = "";
      });

      const seguridad = window.PhonePlanetSeguridad || window.GeoNorteSeguridad;

      if (seguridad && typeof seguridad.cerrarSesion === "function") {
        await seguridad.cerrarSesion();
        return;
      }

      try {
        await db.auth.signOut();
      } catch (error) {
        console.error("Error cerrando sesión:", error);
      }

      window.location.replace("LOGIN.html");
    });
  }

  // Indicadores de reposición visibles aunque el CSS no tenga estas clases.
  if (!document.getElementById("phonePlanetStockStatusStyle")) {
    const style = document.createElement("style");
    style.id = "phonePlanetStockStatusStyle";
    style.textContent = ".stock-low{color:#b91c1c}.stock-ok{color:#047857}";
    document.head.appendChild(style);
  }

  async function initializePhonePlanet() {
    try {
      notify("Conectando con Supabase…");
      await loadSupabaseState();
      setRole(role);
      notify("Datos cargados desde Supabase.", "success");
    } catch (error) {
      console.error(error);
      notify(`No se pudo iniciar Phone Planet: ${error.message}`, "error");
    }
  }
  initializePhonePlanet();
})();