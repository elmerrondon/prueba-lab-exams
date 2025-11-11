// Este componente es ahora un Server Component por defecto (no tiene 'use client')
// y se encarga únicamente de la estructura de la página y el Suspense.

import { Suspense } from 'react';
// Asegúrate de que la ruta de importación sea correcta
import CreateExamForm from '@/components/CreateExamForm'; 

// Componente principal de la página
export default function CreateExamPage() {
  return (
    <Suspense fallback={<div className="container card">Cargando formulario...</div>}>
      {/* El componente CreateExamForm utiliza useSearchParams(),
        al envolverlo en Suspense, Next.js resuelve el problema de
        prerenderizado en el servidor.
      */}
      <CreateExamForm />
    </Suspense>
  );
}