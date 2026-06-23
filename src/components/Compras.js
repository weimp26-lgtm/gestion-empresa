import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

function Compras() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [stock, setStock] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", proveedor: "", pago: "",
  });
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    proveedorId: "",
    proveedorNombre: "",
    producto: "",
    cantidad: 1,
    costoUnit: 0,
    pago: "pagado",
  });

  useEffect(() => {
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubProv = onSnapshot(collection(db, "proveedores"), (snap) => {
      setProveedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubStock = onSnapshot(collection(db, "stock"), (snap) => {
      setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCompras(); unsubProv(); unsubStock(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  const comprasFiltradas = compras.filter((c) => {
    if (filtros.desde && c.fecha < filtros.desde) return false;
    if (filtros.hasta && c.fecha > filtros.hasta) return false;
    if (filtros.proveedor && c.proveedorId !== filtros.proveedor) return false;
    if (filtros.pago && c.pago !== filtros.pago) return false;
    return true;
  });

  const totalFiltrado = comprasFiltradas.reduce((a, c) => a + (c.total || 0), 0);
  const pagadoFiltrado = comprasFiltradas.filter((c) => c.pago === "pagado").reduce((a, c) => a + (c.total || 0), 0);

  const guardarCompra = async (e) => {
    e.preventDefault();
    const total = Number(form.cantidad) * Number(form.costoUnit);
    await addDoc(collection(db, "compras"), {
      ...form,
      total,
      cantidad: Number(form.cantidad),
      costoUnit: Number(form.costoUnit),
    });
    const prod = stock.find((s) => s.nombre === form.producto);
    if (prod) {
      await updateDoc(doc(db, "stock", prod.id), {
        qty: (prod.qty || 0) + Number(form.cantidad),
        costo: Number(form.costoUnit),
      });
    }
    setMostrarForm(false);
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      proveedorId: "",
      proveedorNombre: "",
      producto: "",
      cantidad: 1,
      costoUnit: 0,
      pago: "pagado",
    });
  };

  const marcarPagado = async (id) => {
    await updateDoc(doc(db, "compras", id), { pago: "pagado" });
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Compras</h2>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Nueva compra"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card">
          <h3 className="card-title">Registrar compra</h3>
          <form onSubmit={guardarCompra}>
            <div className="form-grid">
              <div className="form-group">
                <label>Proveedor</label>
                <select
                  value={form.proveedorId}
                  onChange={(e) => {
                    const prov = proveedores.find((p) => p.id === e.target.value);
                    setForm({ ...form, proveedorId: e.target.value, proveedorNombre: prov?.empresa || "" });
                  }}
                  required
                >
                  <option value="">— seleccionar —</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.empresa}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Producto</label>
                <select
                  value={form.producto}
                  onChange={(e) => {
                    const prod = stock.find((s) => s.nombre === e.target.value);
                    setForm({ ...form, producto: e.target.value, costoUnit: prod?.costo || 0 });
                  }}
                  required
                >
                  <option value="">— seleccionar —</option>
                  {stock.map((s) => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Costo unitario</label>
                <input type="number" value={form.costoUnit} onChange={(e) => setForm({ ...form, costoUnit: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Estado pago</label>
                <select value={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.value })}>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
            </div>
            <div className="total-preview">
              Total: <strong>{fmt(Number(form.cantidad) * Number(form.costoUnit))}</strong>
            </div>
            <button type="submit" className="btn-primary">Guardar compra</button>
          </form>
        </div>
      )}

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
            <label>Proveedor</label>
            <select value={filtros.proveedor} onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })}>
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.empresa}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Pago</label>
            <select value={filtros.pago} onChange={(e) => setFiltros({ ...filtros, pago: e.target.value })}>
              <option value="">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", proveedor: "", pago: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Proveedor</th><th>Producto</th>
                <th>Cant.</th><th>Costo unit.</th><th>Total</th><th>Pago</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...comprasFiltradas].reverse().map((c) => (
                <tr key={c.id}>
                  <td>{c.fecha}</td>
                  <td>{c.proveedorNombre}</td>
                  <td>{c.producto}</td>
                  <td>{c.cantidad}</td>
                  <td>{fmt(c.costoUnit)}</td>
                  <td>{fmt(c.total)}</td>
                  <td>
                    <span className={`badge badge-${c.pago === "pagado" ? "green" : "red"}`}>
                      {c.pago}
                    </span>
                  </td>
                  <td>
                    {c.pago !== "pagado" && (
                      <button className="btn-xs" onClick={() => marcarPagado(c.id)}>✓ Pagado</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Total: <strong>{fmt(totalFiltrado)}</strong></span>
          <span>Pagado: <strong style={{ color: "#1D9E75" }}>{fmt(pagadoFiltrado)}</strong></span>
          <span>Adeudado: <strong style={{ color: "#A32D2D" }}>{fmt(totalFiltrado - pagadoFiltrado)}</strong></span>
        </div>
      </div>
    </div>
  );
}

export default Compras;