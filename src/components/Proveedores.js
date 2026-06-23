import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
} from "firebase/firestore";

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    empresa: "",
    contacto: "",
    tel: "",
    email: "",
    cat: "Computadoras",
  });

  useEffect(() => {
    const unsubProv = onSnapshot(collection(db, "proveedores"), (snap) => {
      setProveedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubProv(); unsubCompras(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  const guardarProveedor = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "proveedores"), { ...form });
    setMostrarForm(false);
    setForm({ empresa: "", contacto: "", tel: "", email: "", cat: "Computadoras" });
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Proveedores</h2>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Nuevo proveedor"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card">
          <h3 className="card-title">Agregar proveedor</h3>
          <form onSubmit={guardarProveedor}>
            <div className="form-grid">
              <div className="form-group">
                <label>Empresa</label>
                <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Contacto</label>
                <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                  <option>Computadoras</option>
                  <option>Monitores</option>
                  <option>Periféricos</option>
                  <option>Redes</option>
                  <option>Accesorios</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary">Guardar proveedor</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Categoría</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Compras</th>
                <th>Total pagado</th>
                <th>Deuda</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => {
                const cs = compras.filter((c) => c.proveedorId === p.id);
                const totalPagado = cs.filter((c) => c.pago === "pagado").reduce((a, c) => a + (c.total || 0), 0);
                const deuda = cs.filter((c) => c.pago === "pendiente").reduce((a, c) => a + (c.total || 0), 0);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.empresa}</strong></td>
                    <td>{p.contacto}</td>
                    <td>{p.cat}</td>
                    <td>{p.tel}</td>
                    <td>{p.email}</td>
                    <td>{cs.length}</td>
                    <td>{fmt(totalPagado)}</td>
                    <td>
                      {deuda > 0
                        ? <span className="badge badge-red">{fmt(deuda)}</span>
                        : <span className="badge badge-green">Sin deuda</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Proveedores;