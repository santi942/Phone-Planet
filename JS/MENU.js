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
      warranties: []
    };
  }


  const clone = value => JSON.parse(JSON.stringify(value));
  const resultOrThrow = (result, label) => {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
    return result.data;
  };

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
      db.from("productos").select("id,codigo,nombre,descripcion,precio,stock,nivel_reorden,activo,creado_en,categoria,colores,imagen_url").eq("activo", true).order("nombre"),
     db.from("perfiles")
  .select("id,nombre,rol,codigo_usuario,email,activo")
  .order("nombre"),
      db.from("ventas").select("id,empleado_id,empleado_nombre,fecha,medio_pago,nota,subtotal,descuento,total,creado_en").order("fecha", { ascending: false }),
      db.from("detalle_ventas").select("id,venta_id,producto_id,codigo_producto,nombre_producto,cantidad,precio_original,descuento_unitario,precio_unitario,total_linea"),
      db.from("entradas_mercancia").select("id,producto_id,registrado_por,fecha,cantidad,costo_unitario,costo_total,proveedor,observaciones,creado_en").order("fecha", { ascending: false })
    ]);
    // Si todavía no se ejecutó el SQL que agrega ventas.empleado_nombre,
    // se consulta sin esa columna para no romper el sistema.
    if (salesR.error && salesR.error.code === "42703") {
      salesR = await db.from("ventas").select("id,empleado_id,fecha,medio_pago,nota,subtotal,descuento,total,creado_en").order("fecha", { ascending: false });
    }
    // Si todavía no se ejecutó el SQL de productos (categoria, colores, imagen_url),
    // se consulta sin esas columnas para no romper el sistema.
    if (productsR.error && productsR.error.code === "42703") {
      productsR = await db.from("productos").select("id,codigo,nombre,descripcion,precio,stock,nivel_reorden,activo,creado_en").eq("activo", true).order("nombre");
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
    state.products = products.map(p => ({ id:p.id, code:p.codigo, name:p.nombre, description:p.descripcion || p.nombre, price:Number(p.precio)||0, stock:Number(p.stock)||0, reorderLevel:Number(p.nivel_reorden)||0, active:p.activo, category:p.categoria || "", colors:Array.isArray(p.colores) ? p.colores : [], imageUrl:p.imagen_url || "" }));
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
      return { id:e.id, productId:e.producto_id, productName:product?.nombre || "Producto", code:product?.codigo || "—", qty:Number(e.cantidad)||0, unitValue:Number(e.costo_unitario)||0, totalCost:Number(e.costo_total)||0, date:e.fecha, supplier:e.proveedor || "", note:e.observaciones || "", employee:profile?.nombre || "Usuario", createdAt:e.creado_en };
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
        db.from("gastos").select("id,registrado_por,fecha,concepto,valor,observaciones,creado_en").order("fecha", { ascending:false }),
        db.from("nomina").select("id,empleado_id,registrado_por,periodo_inicio,periodo_fin,fecha_pago,concepto,valor,creado_en").order("fecha_pago", { ascending:false }),
        db.from("arriendos").select("id,registrado_por,fecha_pago,periodo,concepto,valor,observaciones,creado_en").order("fecha_pago", { ascending:false })
      ]);
      state.expenses = resultOrThrow(expensesR, "No se pudieron cargar los gastos").map(x => ({ id:x.id, date:x.fecha, concept:x.concepto, amount:Number(x.valor)||0, note:x.observaciones||"", createdAt:x.creado_en }));
      state.payroll = resultOrThrow(payrollR, "No se pudo cargar la nómina").map(x => ({ id:x.id, date:x.fecha_pago, concept:x.concepto, amount:Number(x.valor)||0, employeeId:x.empleado_id, periodStart:x.periodo_inicio, periodEnd:x.periodo_fin, createdAt:x.creado_en }));
      state.rent = resultOrThrow(rentR, "No se pudo cargar el arriendo").map(x => ({ id:x.id, date:x.fecha_pago, period:x.periodo, concept:x.concepto, amount:Number(x.valor)||0, note:x.observaciones||"", createdAt:x.creado_en }));
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
  async function shareElementAsImage(element, filename, title, text) {
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

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
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
  // PRODUCTOS (crear / editar) - solo administradores
  // =====================================================
  const CATEGORIAS_BASE = ["Fundas", "Cargadores", "Audífonos", "Cables", "Smartwatches"];
  const BUCKET_PRODUCTOS = "productos";
  const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
  let editingProductId = null;

  function productCategories() {
    const extra = state.products
      .map(product => product.category)
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

  function renderStock() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const editing = editingProductId
      ? state.products.find(product => product.id === editingProductId)
      : null;

    if (editingProductId && !editing) editingProductId = null;

    let colors = editing
      ? editing.colors.filter(color => color && color.nombre && isHexColor(color.valor))
          .map(color => ({ nombre: String(color.nombre), valor: String(color.valor).toLowerCase() }))
      : [];

    const categories = productCategories();
    const currentImage = editing ? safeImageUrl(editing.imageUrl) : "";

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>${editing ? "Editar producto" : "Crear producto"}</h3>

        <form id="productForm" class="form-grid">
          <div class="field">
            <label for="pCode">Referencia (código único)</label>
            <input id="pCode" maxlength="50" required>
          </div>

          <div class="field">
            <label for="pName">Nombre del producto</label>
            <input id="pName" maxlength="150" required>
          </div>

          <div class="field">
            <label for="pCategory">Categoría</label>
            <select id="pCategory" required>
              <option value="">Selecciona una categoría</option>
              ${categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("")}
              <option value="__otra">Otra categoría…</option>
            </select>
          </div>

          <div class="field" id="pCategoryOtherWrap" hidden>
            <label for="pCategoryOther">Nueva categoría</label>
            <input id="pCategoryOther" maxlength="30" placeholder="Ej. Protectores">
          </div>

          <div class="field wide">
            <label for="pDescription">Descripción</label>
            <input id="pDescription" maxlength="220" required>
          </div>

          <div class="field wide">
            <label for="pImage">Imagen del producto${editing ? " (déjala vacía para conservar la actual)" : ""}</label>
            <input id="pImage" type="file" accept="image/png,image/jpeg,image/webp" ${editing ? "" : "required"}>
            <small>PNG, JPG o WEBP de máximo 5 MB. Se verá mejor con fondo blanco o transparente.</small>
            <img id="pImagePreview" class="image-preview" alt="Vista previa de la imagen"
              ${currentImage ? `src="${escapeHTML(currentImage)}"` : "hidden"}>
          </div>

          <div class="field wide">
            <label for="pColorName">Colores disponibles</label>
            <div class="color-adder">
              <input id="pColorName" type="text" maxlength="30" placeholder="Nombre (ej. Negro)">
              <input id="pColorValue" type="color" value="#111111" aria-label="Elegir el tono del color">
              <button class="btn btn-ghost" type="button" id="pColorAdd">Agregar color</button>
            </div>
            <div id="pColorList" class="color-chips"></div>
            <small>Si no agregas colores, el producto se muestra como "Único".</small>
          </div>

          <div class="field">
            <label for="pPrice">Valor unitario de salida / venta (COP)</label>
            <input id="pPrice" type="number" min="0" step="1" required>
          </div>

          ${editing ? "" : `
          <div class="field">
            <label for="pStock">Cantidad inicial</label>
            <input id="pStock" type="number" min="0" step="1" value="0" required>
          </div>`}

          <div class="field">
            <label for="pReorder">Solicitar pedido cuando el stock sea igual o inferior a</label>
            <input id="pReorder" type="number" min="0" step="1" value="5" required>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit" id="productSubmit">
              ${editing ? "Guardar cambios" : "Crear producto"}
            </button>
            ${editing ? `<button class="btn btn-ghost" type="button" id="productCancel">Cancelar edición</button>` : ""}
          </div>
        </form>
      </div>

      <h3>Tabla general de stock</h3>
      <p class="muted">
        El total vendido corresponde a las ventas netas después de
        descuentos. El costo de entrada suma las entradas registradas.
      </p>

      <div id="stockTable"></div>
    `;

    // Valores iniciales al editar (se asignan por propiedad, no por HTML).
    if (editing) {
      $("pCode").value = editing.code;
      $("pName").value = editing.name;
      $("pDescription").value = editing.description || "";
      $("pPrice").value = editing.price;
      $("pReorder").value = editing.reorderLevel ?? 5;

      if (editing.category && !categories.includes(editing.category)) {
        $("pCategory").value = "__otra";
        $("pCategoryOtherWrap").hidden = false;
        $("pCategoryOther").value = editing.category;
      } else {
        $("pCategory").value = editing.category || "";
      }
    }

    const renderColors = () => {
      $("pColorList").innerHTML = colors.map((color, index) => `
        <span class="color-chip">
          <i style="background:${escapeHTML(color.valor)}"></i>
          ${escapeHTML(color.nombre)}
          <button type="button" data-remove-color="${index}" aria-label="Quitar ${escapeHTML(color.nombre)}">&times;</button>
        </span>
      `).join("");

      $("pColorList").querySelectorAll("[data-remove-color]").forEach(button => {
        button.addEventListener("click", () => {
          colors.splice(Number(button.dataset.removeColor), 1);
          renderColors();
        });
      });
    };

    const addColor = () => {
      const name = $("pColorName").value.trim().replace(/\s+/g, " ");
      const value = $("pColorValue").value.toLowerCase();

      if (!name) return notify("Escribe el nombre del color.", "error");
      if (!isHexColor(value)) return notify("Elige un tono válido.", "error");
      if (colors.length >= 8) return notify("Máximo 8 colores por producto.", "error");
      if (colors.some(color => color.nombre.toLowerCase() === name.toLowerCase())) {
        return notify("Ese color ya está agregado.", "error");
      }

      colors.push({ nombre: name, valor: value });
      $("pColorName").value = "";
      renderColors();
      notify("");
      $("pColorName").focus();
    };

    $("pColorAdd").addEventListener("click", addColor);
    $("pColorName").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addColor();
      }
    });
    renderColors();

    $("pCategory").addEventListener("change", () => {
      const other = $("pCategory").value === "__otra";
      $("pCategoryOtherWrap").hidden = !other;
      $("pCategoryOther").required = other;
      if (other) $("pCategoryOther").focus();
    });

    $("pImage").addEventListener("change", () => {
      const file = $("pImage").files[0];
      const preview = $("pImagePreview");

      if (!file) {
        preview.hidden = !currentImage;
        if (currentImage) preview.src = currentImage;
        return;
      }

      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    });

    if ($("productCancel")) {
      $("productCancel").addEventListener("click", () => {
        editingProductId = null;
        renderStock();
      });
    }

    $("productForm").addEventListener("submit", async event => {
      event.preventDefault();

      if (role !== "administrador") {
        return notify("Acceso restringido.", "error");
      }

      const submit = $("productSubmit");
      const code = $("pCode").value.trim().toUpperCase();
      const name = $("pName").value.trim();
      const description = $("pDescription").value.trim();
      const price = Number($("pPrice").value);
      const reorderLevel = Number($("pReorder").value);
      const stock = editing ? null : Number($("pStock").value);
      const file = $("pImage").files[0] || null;

      let category = $("pCategory").value;
      if (category === "__otra") {
        const typed = $("pCategoryOther").value.trim().replace(/\s+/g, " ");
        // Si coincide con una categoría existente (sin importar mayúsculas), se reutiliza.
        category = categories.find(item => item.toLowerCase() === typed.toLowerCase())
          || (typed ? typed.charAt(0).toUpperCase() + typed.slice(1) : "");
      }

      if (
        !name || !code || !description || !category ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(reorderLevel) || reorderLevel < 0 ||
        (!editing && (!Number.isInteger(stock) || stock < 0))
      ) {
        return notify("Revisa los datos del producto.", "error");
      }

      if (!editing && !file) {
        return notify("Selecciona la imagen del producto.", "error");
      }

      if (state.products.some(product =>
        product.id !== editingProductId &&
        product.code.toLowerCase() === code.toLowerCase()
      )) {
        return notify("Ya existe un producto con esa referencia.", "error");
      }

      const originalText = submit.textContent;
      submit.disabled = true;
      submit.textContent = file ? "Subiendo imagen..." : "Guardando...";

      let newImageUrl = null;

      try {
        if (file) newImageUrl = await uploadProductImage(file);

        submit.textContent = "Guardando...";

        const payload = {
          codigo: code,
          nombre: name,
          descripcion: description,
          precio: price,
          nivel_reorden: reorderLevel,
          categoria: category,
          colores: colors.length ? colors : [{ nombre: "Único", valor: "#9aabcc" }]
        };

        if (newImageUrl) payload.imagen_url = newImageUrl;

        let result;

        if (editing) {
          result = await db.from("productos").update(payload).eq("id", editing.id);
        } else {
          result = await db.from("productos").insert({
            ...payload,
            id: crypto.randomUUID(),
            stock,
            activo: true
          });
        }

        if (result.error) throw result.error;

        if (editing && newImageUrl && currentImage) {
          removeProductImage(currentImage);
        }
      } catch (error) {
        console.error("Error guardando producto:", error);

        // Si no se pudo guardar el producto, se borra la imagen que sí se subió.
        if (newImageUrl) removeProductImage(newImageUrl);

        let message = error.message || "No se pudo guardar el producto.";

        if (error.code === "42703" || /column .* does not exist|schema cache/i.test(message)) {
          message = "Faltan columnas en Supabase. Ejecuta el script SQL de productos y vuelve a intentarlo.";
        } else if (error.code === "23505") {
          message = "Ya existe un producto con esa referencia.";
        } else if (error.code === "42501" || /row-level security/i.test(message)) {
          message = "Supabase no permite esta acción con tu cuenta. Solo los administradores pueden crear o editar productos.";
        }

        notify(message, "error");
        submit.disabled = false;
        submit.textContent = originalText;
        return;
      }

      const wasEditing = Boolean(editing);
      editingProductId = null;

      try {
        await loadSupabaseState();
        renderDashboard();
        renderStock();
        notify(wasEditing ? "Producto actualizado." : "Producto creado. Ya aparece en la tienda.", "success");
      } catch (error) {
        console.error(error);
        notify("El producto se guardó, pero no se pudo refrescar la pantalla. Recarga la página.", "error");
      }
    });

    renderStockTable();
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
          <td>${
            safeImageUrl(product.imageUrl)
              ? `<img class="thumb" src="${escapeHTML(safeImageUrl(product.imageUrl))}" alt="" loading="lazy">`
              : "—"
          }</td>
          <td>${escapeHTML(product.code)}</td>
          <td>${escapeHTML(product.description || product.name)}</td>
          <td>${escapeHTML(product.category || "Sin categoría")}</td>
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
        "Imagen",
        "Referencia",
        "Descripción de producto",
        "Categoría",
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

  function editProduct(id) {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    if (!state.products.some(item => item.id === id)) return;

    editingProductId = id;
    renderStock();
    notify("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteProduct(id) {
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

    if (!confirm(`¿Eliminar "${product.name}" del catálogo?`)) return;

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

    const detailRows = state.sales.slice().reverse().map(sale => `
      <tr>
        <td>${escapeHTML(sale.date)}</td>
        <td>${escapeHTML(saleEmployeeName(sale))}</td>
        <td>${escapeHTML(sale.productCode || "—")}</td>
        <td>${escapeHTML(sale.productName)}</td>
        <td>${sale.qty}</td>
        <td>${money(sale.originalUnitPrice ?? sale.unitPrice)}</td>
        <td>${money((sale.discountPerUnit || 0) * sale.qty)}</td>
        <td>${money(sale.total)}</td>
        <td>${escapeHTML(sale.note || "—")}</td>
      </tr>
    `).join("");

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
      </div>

      <div id="salesDetailTable">
        ${table(
          [
            "Fecha", "Empleado", "Código", "Producto", "Cantidad",
            "Precio unit.", "Descuento", "Total final", "Nota"
          ],
          detailRows
        )}
      </div>
    `;

    $("applySalesFilter").addEventListener("click", filterSales);

    $("clearSalesFilter").addEventListener("click", () => {
      $("salesFilter").value = "";
      $("salesDateFrom").value = "";
      $("salesDateTo").value = "";
      filterSales();
    });
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

    const rows = filtered.slice().reverse().map(sale => `
      <tr>
        <td>${escapeHTML(sale.date)}</td>
        <td>${escapeHTML(saleEmployeeName(sale))}</td>
        <td>${escapeHTML(sale.productCode || "—")}</td>
        <td>${escapeHTML(sale.productName)}</td>
        <td>${sale.qty}</td>
        <td>${money(sale.originalUnitPrice ?? sale.unitPrice)}</td>
        <td>${money((sale.discountPerUnit || 0) * sale.qty)}</td>
        <td>${money(sale.total)}</td>
        <td>${escapeHTML(sale.note || "—")}</td>
      </tr>
    `).join("");

    $("salesDetailTable").innerHTML = table(
      [
        "Fecha", "Empleado", "Código", "Producto", "Cantidad",
        "Precio unit.", "Descuento", "Total final", "Nota"
      ],
      rows,
      "No hay ventas con esos filtros."
    );
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
      <td>${escapeHTML(employee.role || "—")}</td>
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
          <h3>Crear cuenta de empleado</h3>
          <p>Registra un nuevo integrante del equipo de Phone Planet.</p>
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

        <div class="employee-form__actions">
          <button type="submit" class="employee-submit">
            <span aria-hidden="true">＋</span>
            Crear empleado
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

    const resultado = await administrarEmpleado({
      accion: "crear",
      nombre,
      email,
      contrasena
    });

    const codigo =
      resultado?.empleado?.codigo_usuario ||
      resultado?.codigo_usuario ||
      resultado?.codigo;

    await loadSupabaseState();
    await renderEmployees();

    notify(
      codigo
        ? `Empleado creado correctamente. Código: ${codigo}`
        : "Empleado creado correctamente.",
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
    .querySelectorAll(".employee-toggle")
    .forEach(boton => {
      boton.addEventListener("click", async () => {
        const codigo = boton.dataset.code;
        const activo = boton.dataset.active === "true";

        if (!confirm(
          `¿Deseas ${activo ? "activar" : "desactivar"} la cuenta ${codigo}?`
        )) {
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

        if (!confirm(
          `¿Eliminar definitivamente a ${nombre} (${codigo})?\n\n` +
          `Se borrará su cuenta de acceso. Sus ventas y registros se conservan. Esta acción no se puede deshacer.`
        )) {
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

    const rows = state.incoming.slice().reverse().map(entry => `
      <tr>
        <td>${escapeHTML(entry.date)}</td>
        <td>${escapeHTML(entry.employee)}</td>
        <td>${escapeHTML(entry.code)}</td>
        <td>${escapeHTML(entry.productName)}</td>
        <td>${entry.qty}</td>
        <td>${money(entry.unitValue || 0)}</td>
        <td>${money(
          entry.totalCost ??
          ((entry.unitValue || 0) * entry.qty)
        )}</td>
        <td>${escapeHTML(entry.supplier || "—")}</td>
        <td>${escapeHTML(entry.note || "—")}</td>
      </tr>
    `).join("");

    $("workspaceContent").innerHTML = table(
      [
        "Fecha", "Registrado por", "Código", "Producto",
        "Cantidad", "Valor unitario", "Valor total",
        "Proveedor", "Observaciones"
      ],
      rows,
      "Todavía no hay entradas de mercancía."
    );
  }

  function renderMoneyLog(kind, title, conceptLabel, amountLabel) {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const records = state[kind];

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>${title}</h3>

        <form id="moneyForm" class="form-grid">
          ${kind === "payroll" ? `
            <div class="field wide">
              <label for="payrollEmployee">Empleado</label>
              <select id="payrollEmployee" required>
                ${employeeOptions()}
              </select>
            </div>
          ` : ""}
          <div class="field wide">
            <label for="moneyConcept">${kind === "payroll" ? "Concepto del pago" : conceptLabel}</label>
            <input id="moneyConcept" maxlength="140" required>
          </div>

          <div class="field">
            <label for="moneyAmount">${amountLabel} (COP)</label>
            <input id="moneyAmount" type="number" min="1"
              step="1" required>
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

      <div id="moneyTable"></div>
    `;

    const renderRows = () => {
      const rows = records.slice().reverse().map(record => `
        <tr>
          <td>${escapeHTML(record.date)}</td>
          <td>${escapeHTML(record.concept)}</td>
          <td>${money(record.amount)}</td>
        </tr>
      `).join("");

      $("moneyTable").innerHTML = `
        <p class="muted">
          Total registrado:
          <strong>${money(
            records.reduce((sum, record) => sum + record.amount, 0)
          )}</strong>
        </p>
        ${table(["Fecha", "Concepto", "Valor"], rows)}
      `;
    };

    renderRows();

    $("moneyForm").addEventListener("submit", event => {
      event.preventDefault();

      const concept = $("moneyConcept").value.trim();
      const amount = Number($("moneyAmount").value);

      if (!concept || !Number.isFinite(amount) || amount <= 0) {
        return notify(
          "Ingresa un concepto y un valor válido.",
          "error"
        );
      }

      records.push({
        id: uid(kind.toUpperCase()),
        concept,
        amount,
        employeeId: kind === "payroll" ? $("payrollEmployee").value : null,
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