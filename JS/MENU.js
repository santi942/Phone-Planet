/* =====================================================
   PHONE PLANET - PROTOTIPO LOCAL CON DATOS DE PRUEBA
   No conectado a Supabase. Los roles son simulados.
   ===================================================== */
(() => {
  "use strict";

  const STORAGE_KEY = "phonePlanetDemo_v1";
  const ROLE_KEY = "phonePlanetDemoRole_v1";
  const $ = (id) => document.getElementById(id);

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
  const ADMIN_EMPLOYEE_ID = "admin-demo";

  let state = loadState();
  let role = localStorage.getItem(ROLE_KEY) || "administrador";
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
      desc: "Registra y administra el personal de prueba.",
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

  function seedState() {
    const employees = [
      {
        id: "emp-1",
        name: "Laura Gómez",
        username: "Laura Gómez",
        active: true
      },
      {
        id: "emp-2",
        name: "Daniel Rodríguez",
        username: "Daniel Rodríguez",
        active: true
      },
      {
        id: "emp-3",
        name: "Camila Torres",
        username: "Camila Torres",
        active: true
      }
    ];

    const products = [
      {
        id: "prd-1",
        name: "Audífonos inalámbricos",
        description: "Audífonos Bluetooth inalámbricos",
        code: "AUD-001",
        price: 65000,
        stock: 18,
        reorderLevel: 5
      },
      {
        id: "prd-2",
        name: "Cargador USB-C 25W",
        description: "Cargador de pared USB-C de 25W",
        code: "CAR-002",
        price: 45000,
        stock: 25,
        reorderLevel: 5
      },
      {
        id: "prd-3",
        name: "Funda transparente",
        description: "Funda protectora transparente para celular",
        code: "FUN-003",
        price: 18000,
        stock: 40,
        reorderLevel: 5
      },
      {
        id: "prd-4",
        name: "Cable USB-C",
        description: "Cable de carga y datos USB-C",
        code: "CAB-004",
        price: 15000,
        stock: 32,
        reorderLevel: 5
      },
      {
        id: "prd-5",
        name: "Protector de pantalla",
        description: "Protector de pantalla para celular",
        code: "PRO-005",
        price: 12000,
        stock: 50,
        reorderLevel: 5
      }
    ];

    return {
      employees,
      products,
      sales: [],
      incoming: [],
      expenses: [],
      payroll: [],
      rent: []
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (
          parsed &&
          Array.isArray(parsed.products) &&
          Array.isArray(parsed.sales)
        ) {
          parsed.employees ||= [];
          parsed.incoming ||= [];
          parsed.expenses ||= [];
          parsed.payroll ||= [];
          parsed.rent ||= [];

          parsed.products.forEach(product => {
            product.description ||= product.name || "Sin descripción";
            product.reorderLevel = Number.isFinite(
              Number(product.reorderLevel)
            )
              ? Number(product.reorderLevel)
              : 5;
          });

          parsed.sales.forEach(sale => {
            sale.discountPerUnit = Number(sale.discountPerUnit) || 0;
            sale.originalUnitPrice = Number(
              sale.originalUnitPrice ?? sale.unitPrice
            ) || 0;
            sale.unitPrice = Number(sale.unitPrice) || 0;
            sale.total = Number(sale.total) || 0;
          });

          return parsed;
        }
      }
    } catch (error) {
      console.warn("No se pudieron leer los datos guardados", error);
    }

    const fresh = seedState();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch (error) {}

    return fresh;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      notify(
        "No se pudo guardar en el navegador. Revisa el almacenamiento disponible.",
        "error"
      );
      return false;
    }
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
    notice.textContent = message;
    notice.className = `notice ${type}`;
  }

  function setRole(newRole) {
    role = newRole === "empleado"
      ? "empleado"
      : "administrador";

    localStorage.setItem(ROLE_KEY, role);
    $("roleSwitcher").value = role;

    $("currentUser").textContent = role === "administrador"
      ? "Administrador de prueba"
      : "Empleado de prueba";

    $("welcomeTitle").textContent = role === "administrador"
      ? "Bienvenido, administrador"
      : "Bienvenido al equipo";

    $("welcomeText").textContent = role === "administrador"
      ? "Controla ventas, inventario, empleados y finanzas de Phone Planet."
      : "Registra las ventas y la mercancía que ingresa a la tienda.";

    activeModule = null;
    $("workspace").hidden = true;
    $("moduleMenu").hidden = false;

    renderDashboard();
    renderMenu();

    notify(
      `Modo de prueba: ${role}. Recuerda que no es un control de seguridad real.`,
      "success"
    );
  }

  function renderDashboard() {
    const sales = role === "administrador"
      ? state.sales
      : state.sales.filter(sale => sale.employeeId === "emp-1");

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
      ? `<option value="emp-1">Empleado de prueba</option>`
      : `
        <option value="${ADMIN_EMPLOYEE_ID}">
          Administrador de prueba (mis ventas)
        </option>
        ${employeeOptions()}
      `;

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
            <td>${escapeHTML(employeeName(sale.employeeId))}</td>
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
        ? "emp-1"
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
      const employeeId = role === "empleado"
        ? "emp-1"
        : ADMIN_EMPLOYEE_ID;

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

      const employee = role === "empleado"
        ? employeeName("emp-1")
        : "Administrador de prueba";

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

    $("incomingForm").addEventListener("submit", event => {
      event.preventDefault();

      const product = state.products.find(
        item => item.id === $("incomingProduct").value
      );

      const qty = Number($("incomingQty").value);
      const unitValue = Number($("incomingUnitValue").value);

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

      const totalCost = qty * unitValue;
      product.stock += qty;

      state.incoming.push({
        id: uid("ENT"),
        productId: product.id,
        productName: product.name,
        code: product.code,
        qty,
        unitValue,
        totalCost,
        date: $("incomingDate").value || today(),
        supplier: $("incomingSupplier").value.trim(),
        note: $("incomingNote").value.trim(),
        employee: role === "empleado"
          ? "Empleado de prueba"
          : "Administrador de prueba",
        createdAt: new Date().toISOString()
      });

      if (!saveState()) return;

      notify(
        `Entrada registrada. Total de compra: ${money(totalCost)}. Stock actualizado.`,
        "success"
      );

      renderDashboard();
      renderIncomingForm();
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
        id: uid("PRD"),
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

  function editProduct(id) {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    const product = state.products.find(item => item.id === id);
    if (!product) return;

    const code = prompt("Código del producto:", product.code);
    if (code === null) return;

    const name = prompt("Nombre del producto:", product.name);
    if (name === null) return;

    const description = prompt(
      "Descripción del producto:",
      product.description || product.name
    );
    if (description === null) return;

    const priceText = prompt(
      "Valor unitario de salida / venta en COP:",
      String(product.price)
    );
    if (priceText === null) return;

    const reorderText = prompt(
      "Solicitar pedido cuando el stock sea igual o inferior a:",
      String(product.reorderLevel ?? 5)
    );
    if (reorderText === null) return;

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

    const detailRows = state.sales.slice().reverse().map(sale => `
      <tr>
        <td>${escapeHTML(sale.date)}</td>
        <td>${escapeHTML(employeeName(sale.employeeId))}</td>
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
          <strong>${Object.keys(counts).length}</strong>
          <small>Con al menos una venta</small>
        </div>
      </div>

      <h3>Ventas por empleado</h3>

      ${table(
        ["Empleado", "N.º ventas", "Total vendido", "Promedio por venta"],
        summaryRows,
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
        <td>${escapeHTML(employeeName(sale.employeeId))}</td>
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

  function renderEmployees() {
    if (role !== "administrador") {
      return notify("Acceso restringido.", "error");
    }

    $("workspaceContent").innerHTML = `
      <div class="form-panel">
        <h3>Registrar empleado de prueba</h3>

        <form id="employeeForm" class="toolbar">
          <div class="field">
            <label for="employeeName">Nombre completo</label>
            <input id="employeeName" maxlength="100" required>
          </div>

          <button class="btn btn-primary" type="submit">
            Agregar empleado
          </button>
        </form>
      </div>

      <div id="employeesTable"></div>
    `;

    $("employeeForm").addEventListener("submit", event => {
      event.preventDefault();

      const name = $("employeeName").value.trim();
      if (!name) return;

      state.employees.push({
        id: uid("EMP"),
        name,
        active: true
      });

      if (!saveState()) return;

      renderEmployees();
      notify("Empleado de prueba agregado.", "success");
    });

    const rows = state.employees.map(employee => `
      <tr>
        <td>${escapeHTML(employee.name)}</td>
        <td>${employee.active === false ? "Inactivo" : "Activo"}</td>
        <td>${state.sales.filter(sale => sale.employeeId === employee.id).length}</td>
        <td>
          <button class="btn btn-ghost btn-small"
            data-toggle="${escapeHTML(employee.id)}">
            ${employee.active === false ? "Activar" : "Desactivar"}
          </button>
        </td>
      </tr>
    `).join("");

    $("employeesTable").innerHTML = table(
      ["Empleado", "Estado", "Ventas registradas", "Acción"],
      rows
    );

    $("employeesTable")
      .querySelectorAll("[data-toggle]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const employee = state.employees.find(
            item => item.id === button.dataset.toggle
          );

          if (employee) {
            employee.active = employee.active === false;
          }

          if (!saveState()) return;

          renderEmployees();
          notify("Estado actualizado.", "success");
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
          <div class="field wide">
            <label for="moneyConcept">${conceptLabel}</label>
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

  function employeeName(id) {
    if (id === ADMIN_EMPLOYEE_ID) {
      return "Administrador de prueba";
    }

    return state.employees.find(employee => employee.id === id)?.name
      || "Empleado no encontrado";
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  $("roleSwitcher").addEventListener("change", event => {
    setRole(event.target.value);
  });

  $("backToMenu").addEventListener("click", goBack);

  $("resetDemo").addEventListener("click", () => {
    if (!confirm(
      "Esto borrará los cambios locales de la demo y restaurará los datos de ejemplo. ¿Continuar?"
    )) {
      return;
    }

    state = seedState();
    saveState();
    setRole("administrador");

    notify(
      "Demo reiniciada con datos de ejemplo.",
      "success"
    );
  });

  // Indicadores de reposición visibles aunque el CSS no tenga estas clases.
  if (!document.getElementById("phonePlanetStockStatusStyle")) {
    const style = document.createElement("style");
    style.id = "phonePlanetStockStatusStyle";
    style.textContent = ".stock-low{color:#b91c1c}.stock-ok{color:#047857}";
    document.head.appendChild(style);
  }

  setRole(role);
})();