'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AlertModal from '@/components/AlertModal'; 

// componente de report detalles

export default function ReportDetailPage() {
    const params = useParams();
    const id = params.id;
    
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formValues, setFormValues] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [modal, setModal] = useState({
        isOpen: false,
        msg: '',
        type: 'success', // 'success', 'error', 'warning'
    });

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openModal = useCallback((msg, type) => {
        setModal({ isOpen: true, msg, type });
    }, []);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id, openModal]); // Dependencia de openModal

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        
        if (!id) {
            setError('Error interno: ID no disponible para la solicitud.');
            setLoading(false);
            return;
        }

        try {
            const fetchUrl = `/api/reports/${id}/results`;
            const res = await fetch(fetchUrl);

            if (res.status === 404) {
                throw new Error('Reporte no encontrado (404).');
            }
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Fallo al cargar reporte: ${res.status}`);
            }

            const data = await res.json();
            setData(data);

            const initialValues = {};
            data.camposNecesarios.forEach(campo => {
                initialValues[campo.id] = data.resultadosMapeados[campo.id] !== undefined 
                    ? data.resultadosMapeados[campo.id] 
                    : '';
            });
            setFormValues(initialValues);

        } catch (err) {
            console.error('Error fetching report data:', err);
            setError(err.message);
            openModal(`Error al cargar datos del reporte: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormValues(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const requiredFields = data.camposNecesarios;

        for (const campo of requiredFields) {
            const value = formValues[campo.id];
            
            // Si el valor es nulo, indefinido, o una cadena vacía (después de trim)
            // consideramos que falta un dato requerido.
            if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                openModal(
                    `Por favor, complete el campo requerido: **${campo.nombre_campo}** (en el sub-examen: ${campo.examenSimpleNombre || data.reporte.tipoExamen.nombre}).`, 
                    'error'
                );
                return false;
            }
        }
        return true;
    };
    
    const handleSubmitResults = async (e) => {
        e.preventDefault();
        
        // 1. VALIDACIÓN
        if (!validateForm()) {
            return; // Detiene el proceso y el modal de error ya ha sido mostrado
        }
        
        setIsSubmitting(true);
        
        if (!id) {
            openModal('No se pudo determinar el ID del reporte para guardar.', 'error');
            setIsSubmitting(false);
            return;
        }
        
        const resultados = data.camposNecesarios.map(campo => {
            const rawValue = formValues[campo.id];
            // Si el valor es una cadena vacía, lo pasamos como null a la API
            const value = rawValue === '' ? null : rawValue; 
            
            const base = { campo_id: campo.id };
            
            if (campo.tipo_dato === 'NUMERO') {
                return { ...base, valor_numero: value }; 
            }
            return { ...base, valor_texto: value };
        });


        try {
            const res = await fetch(`/api/reports/${id}/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ resultados }),
            });

            if (res.ok) {
                openModal('Resultados guardados con éxito y reporte marcado como completado.', 'success');
                await fetchData(); 
            } else {
                const errorData = await res.json();
                openModal(`Error al guardar: ${errorData.error || 'Fallo desconocido de la API.'}`, 'error');
            }
        } catch (err) {
            console.error('Error en el submit:', err);
            openModal('Hubo un error de conexión al intentar completar el reporte.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loading) return <div className="container card">Cargando reporte...</div>;
    if (error && !data) return <div className="container card" style={{ color: 'var(--color-danger)' }}>Error al cargar: {error}</div>;
    if (!data || !data.reporte) return <div className="container card" style={{ color: 'var(--color-danger)' }}>Reporte no encontrado o datos incompletos.</div>;

    const { reporte, camposNecesarios } = data;
    const isCompleted = reporte.estado === 'COMPLETADO';
    const hasFields = camposNecesarios.length > 0;

    return (
        <div className="container">
            <AlertModal
                isOpen={modal.isOpen}
                onClose={closeModal}
                msg={modal.msg}
                type={modal.type}
            />

            <Link href="/reports" className="btn btn-primary" style={{ marginBottom: '20px' }}>
                ← Volver al Listado de Reportes
            </Link>

            <div className="reporte-documento">
                <div className="reporte-header">
                    <h2>Laboratorio de Análisis Clínicos</h2>
                    <h1 style={{ color: isCompleted ? 'var(--color-success)' : 'orange', fontSize: '1.5em' }}>
                        REPORTE {isCompleted ? 'COMPLETADO' : 'PENDIENTE'}
                    </h1>
                </div>

                <div className="reporte-info-paciente">
                    <p><strong>Paciente:</strong> {reporte.identificador_paciente}</p>
                    <p><strong>Examen:</strong> {reporte.tipoExamen.nombre}</p>
                    <p><strong>Fecha:</strong> {new Date(reporte.fecha_reporte).toLocaleDateString()}</p>
                </div>

                {!isCompleted && hasFields && (
                    <form onSubmit={handleSubmitResults} className="card">
                        <h3 className="title" style={{ borderBottomColor: 'var(--color-primary)' }}>Ingreso de Resultados</h3>
                        {camposNecesarios.map((campo) => (
                            <div className="form-group" key={campo.id}>
                                
                                {campo.examenSimpleNombre && (
                                    <span className="sub-examen-label">
                                        {campo.examenSimpleNombre}
                                    </span>
                                )}
                                
                                <label>
                                    {campo.nombre_campo} ({campo.tipo_dato}{campo.unidad_medida ? ` - ${campo.unidad_medida}` : ''})
                                </label>
                                
                                {campo.tipo_dato === 'LISTA' ? (
                                    <select
                                        name={campo.id}
                                        value={formValues[campo.id] || ''}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Seleccione una opción</option>
                                        {Array.isArray(campo.opciones_lista) && campo.opciones_lista.map((option, index) => (
                                            <option key={index} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={campo.tipo_dato === 'NUMERO' ? 'number' : 'text'}
                                        name={campo.id}
                                        value={formValues[campo.id] || ''}
                                        onChange={handleInputChange}
                                        step={campo.tipo_dato === 'NUMERO' ? "0.01" : undefined}
                                        placeholder={campo.tipo_dato === 'NUMERO' ? 'Ingrese valor numérico' : 'Ingrese resultado'}
                                    />
                                )}
                            </div>
                        ))}
                        <button type="submit" className="btn btn-success" style={{ width: '100%' }} disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar y Completar Reporte'}
                        </button>
                    </form>
                )}

                <div className="reporte-resultados">
                    <h3 className="title" style={{ borderBottomColor: '#000' }}>Resultados del Examen</h3>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Examen</th>
                                <th>Campo de Resultado</th>
                                <th>Resultado Reportado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {camposNecesarios.map((campo) => (
                                <tr key={campo.id}>
                                    <td>{campo.examenSimpleNombre || reporte.tipoExamen.nombre}</td>
                                    <td>{campo.nombre_campo}{campo.unidad_medida && ` (${campo.unidad_medida})`}</td>
                                    <td>
                                        {formValues[campo.id] ? (
                                            <strong style={{ color: isCompleted ? 'var(--color-text)' : 'blue' }}>{formValues[campo.id]}</strong>
                                        ) : (
                                            <span style={{ color: isCompleted ? 'gray' : 'orange', fontStyle: 'italic' }}>{isCompleted ? 'Sin dato' : 'Pendiente'}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!hasFields && <p style={{ textAlign: 'center', marginTop: '15px' }}>Este examen no tiene campos definidos para reportar resultados.</p>}
                </div>
            </div>
            

            {isCompleted && (
                <button onClick={() => window.print()} className="btn btn-primary" style={{ display: 'block', margin: '20px auto', fontSize: '1.1em' }}>
                    🖨️ Imprimir / Exportar a PDF
                </button>
            )}
        </div>
    );
}