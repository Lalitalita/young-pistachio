import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "./styles/global.css";

// Chargement paresseux : un téléphone ne télécharge jamais le code de /screen ou /admin.
const Visitor = lazy(() => import("./pages/Visitor"));
const Screen = lazy(() => import("./pages/Screen"));
const Admin = lazy(() => import("./pages/Admin"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="page">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<Visitor />} />
          <Route path="/screen" element={<Screen />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Visitor />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
