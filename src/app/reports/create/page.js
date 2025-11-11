'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AlertModal from '@/components/AlertModal'; 

// Componente de reporte

export default function CreateReportPage() {
    const router = useRouter();
    const [nombrePaciente, setNombrePaciente] = useState(''); 
    const [idTipoExamen, setIdTipoExamen] = useState(''); 
    const [examenesDisponibles, setExamenesDisponibles] = useState([]); 
    
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const [modal, setModal] = useState({
        isOpen: false,
        msg: '',
        type: 'success', 
    });

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openModal = useCallback((msg, type) => {
        setModal({ isOpen: true, msg, type });
    }, []);

    useEffect(() => {
        fetch('/api/exams?limit=999') 
            .then(res => {
                if (!res.ok) throw new Error(`Fallo al cargar tipos de examen: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const examsArray = data.exams || data || []; 
                setExamenesDisponibles(examsArray);
            })
            .catch(err => {
                console.error('Error cargando exámenes:', err);
                const errorMessage = err.message || 'Error de conexión';
                setFetchError(errorMessage);
                openModal(`Error de configuración: ${errorMessage}`, 'error');
                setExamenesDisponibles([]); 
            })
            .finally(() => setLoading(false));
    }, [openModal]);

    const handleSubmit = async () => {
        try {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id_tipo_examen: parseInt(idTipoExamen, 10), 
                    identificador_paciente: nombrePaciente 
                }),
            });

            if (res.ok) {
                openModal(`Orden Creada (Paciente: ${nombrePaciente}). Redirigiendo...`, 'success');
                setTimeout(() => {
                    router.push(`/reports`); 
                }, 1500);
                
            } else {
                const errorData = await res.json();
                openModal(`Error al crear la orden: ${errorData.error || 'Fallo desconocido de API.'}`, 'error');
            }
        } catch (err) {
            console.error('Error al enviar:', err);
            openModal('Hubo un error de conexión al crear la orden.', 'error');
        }
    };
    
    // Validacion de nombre de paciente
    
    const handleValidationAndSubmit = (e) => {
        e.preventDefault();

        const nombreLimpio = nombrePaciente.trim();

        if (!nombreLimpio) {
            openModal('El Nombre del Paciente no puede estar vacío.', 'error');
            return;
        }
        
        // VALIDACIÓN DE FORMATO: Solo Letras, Espacios, Acentos y Ñ.
        // La RegEx /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/g asegura que solo haya caracteres alfabéticos.
        const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        
        if (!nameRegex.test(nombreLimpio)) {
            openModal(
                'El Nombre del Paciente solo debe contener letras, espacios y acentos. No se permiten números ni símbolos.', 
                'error'
            );
            return;
        }

        if (!idTipoExamen) {
            openModal('Debe seleccionar un tipo de examen.', 'error');
            return;
        }
        
        handleSubmit();
    };

    if (loading) return <div className="container card">Cargando datos de configuración...</div>;
    if (fetchError && examenesDisponibles.length === 0) return <div className="container card danger">Error: {fetchError}</div>;

    return (
        <div className="container">
            <h1 className="title">➕ Crear Nueva Orden de Examen</h1>
            <Link href="/reports" className="btn btn-primary" style={{ marginBottom: '20px' }}>
                ← Volver a Reportes
            </Link>

            <div className="card">
                <form onSubmit={handleValidationAndSubmit}> 
                    <div className="form-group">
                        {/* 💡 Etiqueta actualizada */}
                        <label>Nombre del Paciente</label>
                        <input
                            type="text"
                            // 💡 Usamos la variable renombrada
                            value={nombrePaciente} 
                            // 💡 Usamos la variable renombrada
                            onChange={(e) => setNombrePaciente(e.target.value)}
                            placeholder="Ej: Juan Pérez"
                        />
                    </div>

                    <div className="form-group form-group-select">
                        <label>Examen a Ordenar</label>
                        <select
                            value={idTipoExamen}
                            onChange={(e) => setIdTipoExamen(e.target.value)}
                        >
                            <option value="" disabled>
                                {examenesDisponibles.length === 0 ? 'Cree exámenes primero' : 'Seleccione un Examen'}
                            </option>
                            {examenesDisponibles.map(exam => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.nombre} ({exam.es_compuesto ? 'Compuesto' : 'Simple'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-success" 
                        style={{ width: '100%' }} 
                        disabled={examenesDisponibles.length === 0}
                    >
                        Crear Orden PENDIENTE
                    </button>
                    {examenesDisponibles.length === 0 && <p style={{ color: 'var(--color-danger)', marginTop: '10px' }}>* Debe crear al menos un Tipo de Examen primero.</p>}
                </form>
            </div>
            
            <AlertModal
                isOpen={modal.isOpen}
                onClose={closeModal}
                msg={modal.msg}
                type={modal.type}
            />
        </div>
    );
}