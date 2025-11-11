'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
// Mantenemos useSearchParams y useRouter aquí
import { useRouter, useSearchParams } from 'next/navigation'; 
import AlertModal from './AlertModal'; 

// Tipos de datos disponibles para registrar 
const TIPOS_DATO = ['TEXTO', 'NUMERO', 'LISTA'];

// Campo examen (Mantenemos el componente auxiliar)
const CampoExamen = ({ campo, index, handleCampoChange, handleRemoveCampo }) => {
    
    const getListaValue = () => 
        Array.isArray(campo.opciones_lista) ? campo.opciones_lista.join(', ') : campo.opciones_lista || '';
    
    return (
        <div className="exam-field-row" key={index}> 
            
            <div className="form-group exam-field-group">
                <label>Nombre del Campo</label>
                <input
                    type="text"
                    value={campo.nombre_campo}
                    onChange={(e) => handleCampoChange(index, 'nombre_campo', e.target.value)}
                    required
                />
            </div>
            
            <div className="form-group exam-field-group">
                <label>Tipo</label>
                <select
                    value={campo.tipo_dato}
                    onChange={(e) => handleCampoChange(index, 'tipo_dato', e.target.value)}
                >
                    {TIPOS_DATO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
            </div>
            
            {campo.tipo_dato === 'LISTA' && (
                <div className="form-group exam-field-group exam-list-options-group">
                    <label>Opciones (separadas por coma)</label>
                    <input
                        type="text"
                        placeholder="Ej: Positivo, Negativo"
                        value={getListaValue()}
                        onChange={(e) => handleCampoChange(index, 'opciones_lista', e.target.value)}
                        required
                    />
                </div>
            )}
            
            <button 
                type="button" 
                onClick={() => handleRemoveCampo(index)} 
                className="btn btn-danger btn-remove-field"
            >
                🗑️
            </button>
        </div>
    );
}

// Renombramos la función a CreateExamForm
export default function CreateExamForm() {
    const router = useRouter();
    // EL HOOK QUE CAUSABA EL ERROR: useSearchParams
    const searchParams = useSearchParams(); 
    const examId = searchParams.get('id');
    
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const [nombre, setNombre] = useState('');
    const [esCompuesto, setEsCompuesto] = useState(false);
    const [campos, setCampos] = useState([]);
    const [examenesDisponibles, setExamenesDisponibles] = useState([]);
    const [composicionSeleccionada, setComposicionSeleccionada] = useState([]);
    const [loadingExams, setLoadingExams] = useState(true);

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
            .then(res => res.json())
            .then(data => {
                const allExams = data.exams || []; 
                // Filtramos el examen que estamos editando si existe, para evitar incluirse a sí mismo
                const filteredExams = allExams.filter(e => !e.es_compuesto && e.id !== parseInt(examId));
                setExamenesDisponibles(filteredExams);
            }) 
            .catch(error => {
                console.error("Error al cargar exámenes disponibles:", error);
                openModal("Fallo al cargar la lista de exámenes simples disponibles para composición.", 'error'); 
            })
            .finally(() => setLoadingExams(false));
    }, [openModal, examId]); // Agregamos examId a las dependencias

    useEffect(() => {
        if (examId) {
            setIsEditing(true);
            setIsLoading(true);
            
            fetch(`/api/exams/${examId}`) 
                .then(res => {
                    if (!res.ok) throw new Error('Error al cargar datos del examen.');
                    return res.json();
                })
                .then(data => {
                    setNombre(data.nombre);
                    setEsCompuesto(data.es_compuesto);
                    
                    if (data.es_compuesto) {
                        setComposicionSeleccionada(data.composicion || []); 
                    } else {
                        setCampos(data.campos || []); 
                    }
                })
                .catch(err => {
                    console.error("Error en la carga:", err);
                    openModal(`No se pudieron cargar los datos del examen: ${err.message}`, 'error');
                })
                .finally(() => setIsLoading(false));
        }
    }, [examId, openModal]);


    const handleAddCampo = () => {
        setCampos([...campos, { nombre_campo: '', tipo_dato: 'TEXTO', opciones_lista: '' }]);
    };

    const handleRemoveCampo = (index) => {
        setCampos(campos.filter((_, i) => i !== index));
    };

    const handleCampoChange = (index, field, value) => {
        const nuevosCampos = campos.map((campo, i) => {
            if (i === index) {
              return { ...campo, [field]: value };
            }
            return campo;
        });
        setCampos(nuevosCampos);
    };

    const handleToggleSimpleExam = (id) => {
        const idNum = parseInt(id);
        if (composicionSeleccionada.includes(idNum)) {
          setComposicionSeleccionada(composicionSeleccionada.filter(item => item !== idNum));
        } else {
          setComposicionSeleccionada([...composicionSeleccionada, idNum]);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let body = { nombre, es_compuesto: esCompuesto };

        
        if (!nombre || nombre.trim() === '') {
            openModal("Debe ingresar un **nombre** para el examen.", 'error');
            return;
        }

        if (esCompuesto) {
            if (composicionSeleccionada.length === 0) {
                openModal("Un examen compuesto debe seleccionar **al menos un examen simple**.", 'error'); 
                return;
            }
            body.composicion = composicionSeleccionada;
        } else {
            if (campos.length === 0) {
                openModal("Un examen simple debe tener **al menos un campo de resultado** definido.", 'error'); 
                return;
            }
            
            const campoSinNombre = campos.some(c => c.nombre_campo.trim() === '');
            const listaVacia = campos.some(c => 
                c.tipo_dato === 'LISTA' && 
                (!c.opciones_lista || c.opciones_lista.trim() === '')
            );
            
            if (campoSinNombre) {
                openModal("Todos los campos de resultado deben tener un **nombre**.", 'error');
                return;
            }
            
            if (listaVacia) {
                openModal("Si un campo es de tipo **LISTA**, sus opciones no pueden estar vacías.", 'error'); 
                return;
            }
            
            body.campos = campos.map(campo => ({
                nombre_campo: campo.nombre_campo.trim(),
                tipo_dato: campo.tipo_dato,
                opciones_lista: campo.tipo_dato === 'LISTA' 
                    ? campo.opciones_lista.split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0)
                    : null,
            }));
        }

        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `/api/exams/${examId}` : '/api/exams';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                // Éxito
                openModal(`Examen "${nombre}" ${isEditing ? 'actualizado' : 'creado'} exitosamente.`, 'success');
                setTimeout(() => router.push('/'), 1000); 
            } else {
                // Error de API
                const errorData = await res.json();
                openModal(`Fallo al procesar el examen: ${errorData.error || 'Error desconocido.'}`, 'error');
            }
        } catch (error) {
            console.error('Error al enviar:', error);
            // Error de Conexión
            openModal('Hubo un error de conexión al servidor. Intente de nuevo más tarde.', 'error');
        }
    };
    
    if (isLoading) return <div className="container card">Cargando datos del examen para edición...</div>;


    return (
        <div className="container">
            <h1 className="title">{isEditing ? `✏️ Editar Examen: ${nombre}` : '➕ Crear Tipo de Examen'}</h1>
            <Link href="/" className="btn btn-primary" style={{ marginBottom: '20px' }}>
                ← Volver al Listado
            </Link>

            <div className="card">
                <form onSubmit={handleSubmit}>
                    
                    <div className="form-group">
                        <label>Nombre del Examen</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Tipo de Examen</label>
                        <select
                            value={esCompuesto}
                            onChange={(e) => setEsCompuesto(e.target.value === 'true')}
                            disabled={isEditing}
                        >
                            <option value={false}>Simple</option>
                            <option value={true}>Compuesto</option>
                        </select>
                        {isEditing && <small style={{ color: 'gray' }}>No se puede cambiar el tipo de examen al editar.</small>}
                    </div>

                    {esCompuesto ? (
                        <div className="section-box composition-box">
                            <h3>Selección de Composición (Exámenes Simples)</h3>
                            <p style={{ color: loadingExams ? 'gray' : 'inherit' }}>
                                {loadingExams ? 'Cargando exámenes simples...' : 'Seleccione los exámenes simples que componen este nuevo examen:'}
                            </p>
                            
                            <div className="composition-list">
                                {examenesDisponibles.map(exam => (
                                    <button
                                        key={exam.id}
                                        type="button"
                                        className="btn btn-toggle"
                                        style={{
                                            backgroundColor: composicionSeleccionada.includes(exam.id) ? 'var(--color-success)' : 'var(--color-secondary)',
                                            color: 'white'
                                        }}
                                        onClick={() => handleToggleSimpleExam(exam.id)}
                                        disabled={loadingExams}
                                    >
                                        {exam.nombre}
                                    </button>
                                ))}
                                {examenesDisponibles.length === 0 && !loadingExams && (
                                    <p style={{ color: 'var(--color-danger)' }}>No hay exámenes simples creados.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="section-box field-definition-box">
                            <h3>Definición de Campos de Resultado</h3>
                            
                            {campos.map((campo, index) => (
                                <CampoExamen 
                                    key={index} 
                                    campo={campo} 
                                    index={index} 
                                    handleCampoChange={handleCampoChange} 
                                    handleRemoveCampo={handleRemoveCampo} 
                                />
                            ))}

                            <button type="button" onClick={handleAddCampo} className="btn btn-primary" style={{ width: '100%' }}>
                                + Añadir Campo
                            </button>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="btn btn-success" 
                        style={{ width: '100%', marginTop: '30px' }} 
                    >
                        {isEditing ? 'Guardar Cambios' : 'Crear Examen'}
                    </button>
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