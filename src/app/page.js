'use client'; 

import { useState, useEffect, useCallback, useRef } from 'react'; 
import Link from 'next/link';
import AlertModal from '@/components/AlertModal';

const ITEMS_PER_PAGE = 8; 

// Funcion debounce para retrasar la busqueda unos segundos

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

// Componente Homepage 

export default function HomePage() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para BÚSQUEDA y FILTRADO
    const [inputSearchTerm, setInputSearchTerm] = useState(''); 
    const [searchTerm, setSearchTerm] = useState(''); 
    const [filterType, setFilterType] = useState('ALL'); 
    
    // Estados para PAGINACIÓN
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // ESTADO DEL MODAL (Confirmación, Éxito, Error)

    const [modal, setModal] = useState({
        isOpen: false,
        msg: '',
        type: 'success', 
        onConfirm: () => {}, // Función a ejecutar si es de tipo 'confirm'
    });

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openModal = useCallback((msg, type, onConfirm = () => {}) => {
        setModal({ isOpen: true, msg, type, onConfirm });
    }, []);


    // Buscar examenes 

    const fetchExams = useCallback(async () => {
        setLoading(true);
        setError(null);

        const currentSearchTerm = searchTerm;
        const params = new URLSearchParams();
        
        if (currentSearchTerm) params.append('search', currentSearchTerm);
        if (filterType !== 'ALL') params.append('type', filterType); 
        
        params.append('page', currentPage.toString());
        params.append('limit', ITEMS_PER_PAGE.toString());
        
        const queryString = params.toString();
        const url = `/api/exams${queryString ? `?${queryString}` : ''}`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Fallo al cargar exámenes: ${res.status}`);
            }
            const data = await res.json(); 
            setExams(data.exams); 
            setTotalPages(data.totalPages); 
            setError(null);
        } catch (err) {
            console.error('Error fetching exams:', err);
            openModal(err.message || 'Error al conectar con la API y cargar la lista de exámenes.', 'error');
            setError(err.message || 'Error al conectar con la API.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterType, currentPage, openModal]); // Dependencias

    useEffect(() => {
        fetchExams();
    }, [fetchExams]); 


    // LÓGICA DE BÚSQUEDA (DEBOUNCE)

    const debouncedUpdate = useRef(
        debounce((value) => {
            setSearchTerm(value);
            setCurrentPage(1); 
        }, 500)
    ).current;

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setInputSearchTerm(value); 
        debouncedUpdate(value); 
    };
    
    const handleFilterTypeChange = (e) => {
        const newType = e.target.value;
        setFilterType(newType);
        setCurrentPage(1); 
    };
    
    
    // Eliminar examen 
    const executeDelete = useCallback(async (id, nombre) => {
        try {
            const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
            
            if (res.ok) {
                openModal(`Examen "${nombre}" eliminado con éxito.`, 'success');
                fetchExams(); 
            } else {
                const errorData = await res.json();
                const errMsg = errorData.error || res.statusText;
                
                if (res.status === 409) {
                    openModal(`No se puede eliminar el examen "${nombre}" porque aún tiene reportes asociados.`, 'error');
                } else {
                    openModal(`Error al eliminar: ${errMsg}.`, 'error');
                }
            }
        } catch (err) {
            console.error('Error en la solicitud DELETE:', err);
            openModal('Fallo de conexión al intentar eliminar el examen. Intente de nuevo más tarde.', 'error');
        } 
    }, [openModal, fetchExams]); // Dependencias para useCallback


    const handleDeleteConfirmation = useCallback((id, nombre) => {
        const confirmationCallback = () => executeDelete(id, nombre);
        
        openModal(
            `¿Está seguro de que desea eliminar el examen "${nombre}" (ID: ${id})? Esta acción es irreversible.`, 
            'confirm', 
            confirmationCallback
        );
    }, [openModal, executeDelete]);

    
    // Componente de Controles de Paginación 

    const PaginationControls = () => {
        if (totalPages <= 1) return null;
        
        const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    &larr; Anterior
                </button>
    
                {pageNumbers.map(page => (
                    <button
                        key={page}
                        className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCurrentPage(page)}
                        style={{ minWidth: '35px' }}
                    >
                        {page}
                    </button>
                ))}
    
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                >
                    Siguiente &rarr;
                </button>
            </div>
        );
    };

    // Loading Cargando examenes

    if (loading) return <div className="container card">Cargando tipos de examen...</div>;

    if (error && !exams.length) return <div className="container card danger">Error: {error}</div>;

    return (
        <div className="container">
            <h1 className="title">🔬 Módulo de Gestión de Exámenes</h1> 
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <Link href="/exams/create" className="btn btn-success">
                    + Crear Nuevo Examen
                </Link>
                <Link href="/reports" className="btn btn-secondary">
                    📋 Ver Reportes de Pacientes
                </Link>
            </div>


            <div className="card" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                    <input
                        type="text"
                        placeholder="Buscar por nombre de examen..."
                        value={inputSearchTerm} 
                        onChange={handleSearchChange} 
                        style={{ width: '100%', padding: '8px 12px' }}
                    />
                </div>
                
                <div className="form-group" style={{ width: '200px', marginBottom: 0 }}>
                    <select
                        value={filterType}
                        onChange={handleFilterTypeChange} 
                        style={{ width: '100%', padding: '10px 12px' }}
                    >
                        <option value="ALL">Mostrar Todos</option>
                        <option value="SIMPLE">Simples</option>
                        <option value="COMPUESTO">Compuestos</option>
                    </select>
                </div>
            </div>

            <div className="card">
                <h2>Tipos de Examen (Página {currentPage} de {totalPages})</h2>
                
                {exams.length === 0 && !loading ? (
                    <p style={{ textAlign: 'center', padding: '20px' }}>No se encontraron exámenes con los criterios de búsqueda/filtro.</p>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th style={{ width: '150px' }}>Acciones</th>
                            </tr>
                        </thead>
                    <tbody>{exams.map((exam) => (
                        <tr key={exam.id}>
                            <td>{exam.id}</td>
                            <td>{exam.nombre}</td>
                            <td>
                                <span className={`badge ${exam.es_compuesto ? 'badge-info' : 'badge-secondary'}`}>
                                    {exam.es_compuesto ? 'Compuesto' : 'Simple'}
                                </span>
                            </td>
                            <td>
                                <div className="action-buttons">
                                    <Link 
                                        href={`/exams/create?id=${exam.id}`} 
                                        className="btn btn-sm btn-primary" 
                                        style={{ flexGrow: 1 }}
                                    >
                                        Editar
                                    </Link>
                                    <button 
                                        onClick={() => handleDeleteConfirmation(exam.id, exam.nombre)} 
                                        className="btn btn-sm btn-danger" 
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}</tbody>
                    </table>
                )}
                
                <PaginationControls />
            </div>
            
            <AlertModal
                isOpen={modal.isOpen}
                onClose={closeModal}
                msg={modal.msg}
                type={modal.type}
                onConfirm={modal.onConfirm}
            />
        </div>
    );
}