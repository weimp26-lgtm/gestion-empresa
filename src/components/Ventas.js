import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [verDetalle, setVerDetalle] = useState(null);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", cliente: "", pago: "", entrega: "", medio: "", estafa: "", vendedor: "",
  });

  const formVacio = {
    fecha: new Date().toISOString().split("T")[0],
    cliente: "",
    emailCliente: "",
    telCliente: "",
    domicilioCliente: "",
    vendedor: "",
    producto: "",
    cantidad: 1,
    precio: 0,
    medio: "Efectivo",
    pago: "cobrado",
    entrega: "entregado",
    fechaEntrega: "",
    moneda: "ARS",
    estafa: false,
    notaEstafa: "",
    precioUSD: "",
    tipoCambio: "",
  };

  const [form, setForm] = useState(formVacio);

  useEffect(() => {
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubVentas(); unsubCompras(); };
  }, []);

  const fmt = (n, moneda) => {
    const simbolo = moneda === "USD" ? "USD " : "$";
    return simbolo + Number(n || 0).toLocaleString("es-AR");
  };

  const buscarClienteDuplicado = (campo, valor) => {
    if (!valor || valor.trim() === "") return null;
    return ventas.find((v) => {
      if (v.id === editando) return false;
      if (campo === "email") return v.emailCliente?.toLowerCase() === valor.toLowerCase();
      if (campo === "tel") return v.telCliente?.trim() === valor.trim();
      if (campo === "domicilio") return v.domicilioCliente?.toLowerCase() === valor.toLowerCase();
      return false;
    });
  };

  const manejarDuplicado = (campo, valor) => {
    const dup = buscarClienteDuplicado(campo, valor);
    if (!dup) return;
    const copiar = window.confirm(
      `⚠️ Este ${campo === "email" ? "email" : campo === "tel" ? "teléfono" : "domicilio"} ya está registrado en la venta de ${dup.cliente} (${dup.fecha}).\n\n¿Querés copiar los datos de ese cliente?\n\nAceptar = Copiar datos del cliente anterior\nCancelar = Continuar con los datos nuevos`
    );
    if (copiar) {
      setForm(f => ({
        ...f,
        cliente: dup.cliente || f.cliente,
        emailCliente: dup.emailCliente || f.emailCliente,
        telCliente: dup.telCliente || f.telCliente,
        domicilioCliente: dup.domicilioCliente || f.domicilioCliente,
      }));
    }
  };

  const calcularStock = () => {
    const productos = {};
    compras.forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, vendido: 0 };
      productos[nombre].comprado += Number(c.cantidad || 0);
    });
    ventas.forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, vendido: 0 };
      productos[nombre].vendido += Number(v.cantidad || 0);
    });
    return Object.entries(productos)
      .map(([nombre, d]) => ({ nombre, stockActual: d.comprado - d.vendido }))
      .filter((p) => p.stockActual > 0);
  };

  const stockDisponible = calcularStock();

  const calcularTotalVenta = (f) => {
    if (f.medio === "Efectivo" && f.precioUSD && f.tipoCambio) {
      return Number(f.precioUSD) * Number(f.cantidad) * Number(f.tipoCambio);
    }
    return Number(f.cantidad) * Number(f.precio);
  };

  const ventasFiltradas = ventas.filter((v) => {
    if (filtros.desde && v.fecha < filtros.desde) return false;
    if (filtros.hasta && v.fecha > filtros.hasta) return false;
    if (filtros.cliente && !v.cliente?.toLowerCase().includes(filtros.cliente.toLowerCase())) return false;
    if (filtros.pago && v.pago !== filtros.pago) return false;
    if (filtros.entrega && v.entrega !== filtros.entrega) return false;
    if (filtros.medio && v.medio !== filtros.medio) return false;
    if (filtros.estafa === "si" && !v.estafa) return false;
    if (filtros.estafa === "no" && v.estafa) return false;
    if (filtros.vendedor && !v.vendedor?.toLowerCase().includes(filtros.vendedor.toLowerCase())) return false;
    return true;
  });

  const totalFiltradoARS = ventasFiltradas.filter(v => !v.estafa && v.moneda !== "USD").reduce((a, v) => a + (v.total || 0), 0);
  const totalFiltradoUSD = ventasFiltradas.filter(v => !v.estafa && v.moneda === "USD").reduce((a, v) => a + (v.total || 0), 0);
  const cobradoARS = ventasFiltradas.filter(v => !v.estafa && v.pago === "cobrado" && v.moneda !== "USD").reduce((a, v) => a + (v.total || 0), 0);
  const cobradoUSD = ventasFiltradas.filter(v => !v.estafa && v.pago === "cobrado" && v.moneda === "USD").reduce((a, v) => a + (v.total || 0), 0);
  const totalEstafas = ventas.filter(v => v.estafa).reduce((a, v) => a + (v.total || 0), 0);
  const cantEstafas = ventas.filter(v => v.estafa).length;

  const abrirEditar = (v) => {
    setVerDetalle(null);
    setEditando(v.id);
    setForm({
      fecha: v.fecha || "",
      cliente: v.cliente || "",
      emailCliente: v.emailCliente || "",
      telCliente: v.telCliente || "",
      domicilioCliente: v.domicilioCliente || "",
      vendedor: v.vendedor || "",
      producto: v.producto || "",
      cantidad: v.cantidad || 1,
      precio: v.precio || 0,
      medio: v.medio || "Efectivo",
      pago: v.pago || "cobrado",
      entrega: v.entrega || "entregado",
      fechaEntrega: v.fechaEntrega || "",
      moneda: v.moneda || "ARS",
      estafa: v.estafa || false,
      notaEstafa: v.notaEstafa || "",
      precioUSD: v.precioUSD || "",
      tipoCambio: v.tipoCambio || "",
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelar = () => {
    setMostrarForm(false);
    setEditando(null);
    setForm(formVacio);
  };

  const guardarVenta = async (e) => {
    e.preventDefault();
    const total = calcularTotalVenta(form);
    if (!editando) {
      const prodStock = stockDisponible.find((s) => s.nombre === form.producto);
      if (prodStock && Number(form.cantidad) > prodStock.stockActual) {
        alert(`Solo tenés ${prodStock.stockActual} unidades disponibles de ${form.producto}`);
        return;
      }
    }
    const monedaFinal = (form.medio === "Efectivo" && form.precioUSD && form.tipoCambio) ? "ARS" : form.moneda;
    const datos = {
      ...form,
      total,
      cantidad: Number(form.cantidad),
      precio: Number(form.precio),
      moneda: monedaFinal,
    };
    if (editando) {
      await updateDoc(doc(db, "ventas", editando), datos);
    } else {
      await addDoc(collection(db, "ventas"), datos);
    }
    cancelar();
  };

  const marcarEntregado = async (id) => {
    await updateDoc(doc(db, "ventas", id), { entrega: "entregado" });
  };

  const marcarCobrado = async (id) => {
    await updateDoc(doc(db, "ventas", id), { pago: "cobrado" });
  };

  const marcarEstafa = async (v) => {
    if (v.estafa) {
      if (window.confirm("¿Querés quitar la marca de estafa?")) {
        await updateDoc(doc(db, "ventas", v.id), { estafa: false, notaEstafa: "" });
      }
    } else {
      const nota = window.prompt("Describí brevemente la estafa (opcional):");
      if (nota === null) return;
      await updateDoc(doc(db, "ventas", v.id), { estafa: true, notaEstafa: nota, pago: "pendiente" });
    }
  };

  const badgePago = (pago) => {
    if (pago === "cobrado") return "green";
    if (pago === "parcial") return "amber";
    return "red";
  };

  const FilaDetalle = ({ label, value }) => {
    if (!value) return null;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #e0dfd8" }}>
        <span style={{ fontSize: "12px", color: "#888" }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
      </div>
    );
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Ventas</h2>
        <button className="btn-primary" onClick={() => { cancelar(); setMostrarForm(!mostrarForm); }}>
          {mostrarForm ? "Cancelar" : "+ Nueva venta"}
        </button>
      </div>

      {cantEstafas > 0 && (
        <div className="alert alert-red" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>🚨 {cantEstafas} venta(s) marcada(s) como estafa — {fmt(totalEstafas, "ARS")} en riesgo</span>
          <button className="btn-xs" style={{ borderColor: "#A32D2D", color: "#A32D2D" }} onClick={() => setFiltros({ ...filtros, estafa: "si" })}>
            Ver estafas
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {verDetalle && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setVerDetalle(null)}
        >
          <div
            style={{ background: "white", borderRadius: "16px", padding: "1.5rem", width: "480px", maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 500 }}>Detalle de venta</h3>
              <button className="btn-secondary" onClick={() => setVerDetalle(null)}>✕ Cerrar</button>
            </div>

            {verDetalle.estafa && (
              <div className="alert alert-red" style={{ marginBottom: "1rem" }}>
                🚨 Marcada como estafa{verDetalle.notaEstafa ? `: ${verDetalle.notaEstafa}` : ""}
              </div>
            )}

            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "8px" }}>Cliente</p>
            <FilaDetalle label="Nombre" value={verDetalle.cliente} />
            <FilaDetalle label="Email" value={verDetalle.emailCliente} />
            <FilaDetalle label="Teléfono" value={verDetalle.telCliente} />
            <FilaDetalle label="Domicilio" value={verDetalle.domicilioCliente} />

            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", margin: "12px 0 8px" }}>Venta</p>
            <FilaDetalle label="Vendedor" value={verDetalle.vendedor} />
            <FilaDetalle label="Fecha de venta" value={verDetalle.fecha} />
            <FilaDetalle label="Fecha de entrega" value={verDetalle.fechaEntrega || "No especificada"} />
            <FilaDetalle label="Producto" value={verDetalle.producto} />
            <FilaDetalle label="Cantidad" value={verDetalle.cantidad} />
            {verDetalle.medio === "Efectivo" && verDetalle.precioUSD && verDetalle.tipoCambio ? (
              <>
                <FilaDetalle label="Precio en USD" value={`USD ${Number(verDetalle.precioUSD).toLocaleString("es-AR")}`} />
                <FilaDetalle label="Tipo de cambio" value={`1 USD = $${Number(verDetalle.tipoCambio).toLocaleString("es-AR")}`} />
                <FilaDetalle label="Total en ARS (efectivo)" value={`$${(Number(verDetalle.precioUSD) * Number(verDetalle.cantidad) * Number(verDetalle.tipoCambio)).toLocaleString("es-AR")}`} />
              </>
            ) : (
              <>
                <FilaDetalle label="Precio unitario" value={fmt(verDetalle.precio, verDetalle.moneda)} />
                <FilaDetalle label="Total" value={fmt(verDetalle.total, verDetalle.moneda)} />
              </>
            )}

            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", margin: "12px 0 8px" }}>Cobro y entrega</p>
            <FilaDetalle label="Medio de pago" value={verDetalle.medio} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #e0dfd8" }}>
              <span style={{ fontSize: "12px", color: "#888" }}>Estado cobro</span>
              <span className={`badge badge-${badgePago(verDetalle.pago)}`}>{verDetalle.pago}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #e0dfd8" }}>
              <span style={{ fontSize: "12px", color: "#888" }}>Estado entrega</span>
              <span className={`badge badge-${verDetalle.entrega === "entregado" ? "green" : verDetalle.entrega === "programado" ? "blue" : "amber"}`}>{verDetalle.entrega}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: "12px", color: "#888" }}>Estafa</span>
              <span className={`badge badge-${verDetalle.estafa ? "red" : "green"}`}>{verDetalle.estafa ? "🚨 Sí" : "No"}</span>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "8px" }}>
              <button className="btn-primary" onClick={() => abrirEditar(verDetalle)}>✏️ Editar</button>
              <button
                className="btn-xs"
                style={{ borderColor: verDetalle.estafa ? "#888" : "#A32D2D", color: verDetalle.estafa ? "#888" : "#A32D2D" }}
                onClick={() => { marcarEstafa(verDetalle); setVerDetalle(null); }}
              >
                {verDetalle.estafa ? "✓ Quitar estafa" : "🚨 Marcar estafa"}
              </button>
              <button className="btn-secondary" onClick={() => setVerDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div className="card">
          <h3 className="card-title">{editando ? "Editar venta" : "Registrar venta"}</h3>
          <form onSubmit={guardarVenta}>
            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "8px" }}>Datos del cliente</p>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre del cliente</label>
                <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email (opcional)</label>
                <input
                  type="email"
                  value={form.emailCliente}
                  onChange={(e) => setForm({ ...form, emailCliente: e.target.value })}
                  onBlur={(e) => manejarDuplicado("email", e.target.value)}
                  placeholder="cliente@email.com"
                />
              </div>
              <div className="form-group">
                <label>Teléfono (opcional)</label>
                <input
                  value={form.telCliente}
                  onChange={(e) => setForm({ ...form, telCliente: e.target.value })}
                  onBlur={(e) => manejarDuplicado("tel", e.target.value)}
                  placeholder="11-1234-5678"
                />
              </div>
              <div className="form-group">
                <label>Domicilio (opcional)</label>
                <input
                  value={form.domicilioCliente}
                  onChange={(e) => setForm({ ...form, domicilioCliente: e.target.value })}
                  onBlur={(e) => manejarDuplicado("domicilio", e.target.value)}
                  placeholder="Calle 123, Ciudad"
                />
              </div>
            </div>

            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", margin: "12px 0 8px" }}>Datos de la venta</p>
            <div className="form-grid">
              <div className="form-group">
                <label>Vendedor</label>
                <input value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} placeholder="Nombre del vendedor" required />
              </div>
              <div className="form-group">
                <label>Fecha de venta</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Fecha de entrega</label>
                <input type="date" value={form.fechaEntrega} onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Producto (stock disponible)</label>
                <select value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} required>
                  <option value="">— seleccionar —</option>
                  {stockDisponible.map((s) => (
                    <option key={s.nombre} value={s.nombre}>{s.nombre} ({s.stockActual} disponibles)</option>
                  ))}
                  {editando && form.producto && !stockDisponible.find(s => s.nombre === form.producto) && (
                    <option value={form.producto}>{form.producto}</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Medio de pago</label>
                <select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta crédito</option>
                  <option>Tarjeta débito</option>
                  <option>Mercado Pago</option>
                </select>
              </div>

              {form.medio === "Efectivo" ? (
                <>
                  <div className="form-group">
                    <label>Precio en USD</label>
                    <input
                      type="number"
                      value={form.precioUSD}
                      onChange={(e) => setForm({ ...form, precioUSD: e.target.value })}
                      placeholder="Ej: 500"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipo de cambio (1 USD = ? ARS)</label>
                    <input
                      type="number"
                      value={form.tipoCambio}
                      onChange={(e) => setForm({ ...form, tipoCambio: e.target.value })}
                      placeholder="Ej: 1200"
                    />
                  </div>
                  {!form.precioUSD && (
                    <div className="form-group">
                      <label>Precio en ARS</label>
                      <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="0" />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Precio unitario</label>
                    <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Moneda</label>
                    <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                      <option value="ARS">Pesos (ARS)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Estado cobro</label>
                <select value={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.value })}>
                  <option value="cobrado">Cobrado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="parcial">Parcial</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado entrega</label>
                <select value={form.entrega} onChange={(e) => setForm({ ...form, entrega: e.target.value })}>
                  <option value="entregado">Entregado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="programado">Programado</option>
                </select>
              </div>
            </div>

            <div className="total-preview">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {form.medio === "Efectivo" && form.precioUSD && form.tipoCambio ? (
                  <>
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      USD {Number(form.precioUSD).toLocaleString("es-AR")} × {form.cantidad} uds × TC ${Number(form.tipoCambio).toLocaleString("es-AR")}
                    </span>
                    <span>Total a cobrar en efectivo: <strong style={{ color: "#1D9E75", fontSize: "16px" }}>
                      ${(Number(form.precioUSD) * Number(form.cantidad) * Number(form.tipoCambio)).toLocaleString("es-AR")} ARS
                    </strong></span>
                  </>
                ) : (
                  <span>Total: <strong>{fmt(Number(form.cantidad) * Number(form.precio), form.moneda)}</strong></span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="btn-primary">{editando ? "Guardar cambios" : "Guardar venta"}</button>
              <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="card">
        <h3 className="card-title">Filtros</h3>
        <div className="filters">
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Cliente</label>
            <input placeholder="Buscar..." value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Vendedor</label>
            <input placeholder="Buscar..." value={filtros.vendedor} onChange={(e) => setFiltros({ ...filtros, vendedor: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Cobro</label>
            <select value={filtros.pago} onChange={(e) => setFiltros({ ...filtros, pago: e.target.value })}>
              <option value="">Todos</option>
              <option value="cobrado">Cobrado</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>
          <div className="form-group">
            <label>Entrega</label>
            <select value={filtros.entrega} onChange={(e) => setFiltros({ ...filtros, entrega: e.target.value })}>
              <option value="">Todos</option>
              <option value="entregado">Entregado</option>
              <option value="pendiente">Pendiente</option>
              <option value="programado">Programado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Medio</label>
            <select value={filtros.medio} onChange={(e) => setFiltros({ ...filtros, medio: e.target.value })}>
              <option value="">Todos</option>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta crédito</option>
              <option>Tarjeta débito</option>
              <option>Mercado Pago</option>
            </select>
          </div>
          <div className="form-group">
            <label>Estafa</label>
            <select value={filtros.estafa} onChange={(e) => setFiltros({ ...filtros, estafa: e.target.value })}>
              <option value="">Todas</option>
              <option value="no">Sin estafa</option>
              <option value="si">Solo estafas</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", cliente: "", pago: "", entrega: "", medio: "", estafa: "", vendedor: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha venta</th><th>Fecha entrega</th><th>Cliente</th>
                <th>Teléfono</th><th>Vendedor</th><th>Producto</th><th>Cant.</th>
                <th>Total</th><th>Moneda</th><th>Detalle precio</th><th>Entrega</th><th>Cobro</th><th>Medio</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...ventasFiltradas].reverse().map((v) => (
                <tr key={v.id} style={v.estafa ? { background: "#FFF5F5" } : {}}>
                  <td>{v.fecha}</td>
                  <td>{v.fechaEntrega || "—"}</td>
                  <td>
                    <div>
                      <p style={{ fontWeight: 500 }}>{v.cliente}</p>
                      {v.estafa && <span className="badge badge-red">🚨 Estafa</span>}
                      {v.emailCliente && <p style={{ fontSize: "11px", color: "#888" }}>{v.emailCliente}</p>}
                    </div>
                  </td>
                  <td>{v.telCliente || "—"}</td>
                  <td>{v.vendedor || "—"}</td>
                  <td>{v.producto}</td>
                  <td>{v.cantidad}</td>
                  <td><strong>{fmt(v.total, v.moneda)}</strong></td>
                  <td><span className={`badge badge-${v.moneda === "USD" ? "blue" : "green"}`}>{v.moneda || "ARS"}</span></td>
                  <td>
                    {v.medio === "Efectivo" && v.precioUSD && v.tipoCambio ? (
                      <span style={{ fontSize: "11px", color: "#185FA5" }}>
                        USD {Number(v.precioUSD).toLocaleString("es-AR")} × TC {Number(v.tipoCambio).toLocaleString("es-AR")}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#888" }}>—</span>
                    )}
                  </td>
                  <td><span className={`badge badge-${v.entrega === "entregado" ? "green" : v.entrega === "programado" ? "blue" : "amber"}`}>{v.entrega}</span></td>
                  <td><span className={`badge badge-${badgePago(v.pago)}`}>{v.pago}</span></td>
                  <td>{v.medio}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-xs" onClick={() => setVerDetalle(v)}>🔍 Ver</button>
                      <button className="btn-xs" onClick={() => abrirEditar(v)}>✏️ Editar</button>
                      <button
                        className="btn-xs"
                        style={{ borderColor: v.estafa ? "#888" : "#A32D2D", color: v.estafa ? "#888" : "#A32D2D" }}
                        onClick={() => marcarEstafa(v)}
                      >
                        {v.estafa ? "✓ Quitar" : "🚨 Estafa"}
                      </button>
                      {v.entrega !== "entregado" && !v.estafa && <button className="btn-xs" onClick={() => marcarEntregado(v.id)}>✓ Entregado</button>}
                      {v.pago !== "cobrado" && !v.estafa && <button className="btn-xs" onClick={() => marcarCobrado(v.id)}>✓ Cobrado</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Total ARS: <strong>${Number(totalFiltradoARS).toLocaleString("es-AR")}</strong></span>
          <span>Cobrado ARS: <strong style={{ color: "#1D9E75" }}>${Number(cobradoARS).toLocaleString("es-AR")}</strong></span>
          <span>Total USD: <strong>USD {Number(totalFiltradoUSD).toLocaleString("es-AR")}</strong></span>
          <span>Cobrado USD: <strong style={{ color: "#1D9E75" }}>USD {Number(cobradoUSD).toLocaleString("es-AR")}</strong></span>
          {cantEstafas > 0 && <span>En estafas: <strong style={{ color: "#A32D2D" }}>{fmt(totalEstafas, "ARS")}</strong></span>}
        </div>
      </div>
    </div>
  );
}

export default Ventas;