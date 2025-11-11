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

export default function ReportsListPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null); 
    
    // Estado para el valor del campo de entrada
    const [inputSearchTerm, setInputSearchTerm] = useState(''); 
    
    // Estado que dispara la búsqueda (actualizado vía debounce)
    const [searchTerm, setSearchTerm] = useState(''); 
    
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);


    // Estado para el modal 

    const [modal, setModal] = useState({
        isOpen: false,
        msg: '',
        type: 'success', // 'success', 'error', 'confirm'
        onConfirm: null, // Callback solo para el tipo 'confirm'
    });

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);


    const openModal = useCallback((msg, type, onConfirm = null) => {
        setModal({ isOpen: true, msg, type, onConfirm });
    }, []);


    // Buscar reportes

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        
        const currentSearchTerm = searchTerm; 
        
        const params = new URLSearchParams();
        
        if (currentSearchTerm) params.append('search', currentSearchTerm);
        if (filterStatus !== 'ALL') params.append('status', filterStatus);
        
        params.append('page', currentPage.toString());
        params.append('limit', ITEMS_PER_PAGE.toString());
        
        const queryString = params.toString();
        const url = `/api/reports${queryString ? `?${queryString}` : ''}`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) {
                const errorDetail = await res.text();
                throw new Error(`Fallo al cargar reportes: ${res.status} - ${errorDetail.substring(0, 50)}...`);
            }
            const data = await res.json(); 
            setReports(data.reports);
            setTotalPages(data.totalPages);
            
        } catch (err) {
            console.error('Error fetching reports:', err);
            const errorMessage = err.message || 'Error al conectar con la API.';
            setFetchError(errorMessage);
            openModal(`No se pudieron cargar los reportes. ${errorMessage}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterStatus, currentPage, openModal]); 

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
            return;
        }
        fetchReports();
    }, [fetchReports, currentPage, totalPages]); 
    
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
    
    const handleFilterStatusChange = (e) => {
        const newStatus = e.target.value;
        setFilterStatus(newStatus);
        setCurrentPage(1); 
    };
    
    const handleConfirmDelete = async (reportId) => {
        closeModal(); 

        try {
            const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json(); 
                throw new Error(errorData.error || `Fallo al eliminar el reporte: ${res.status}`);
            }
            
            setReports(prevReports => {
                const updatedReports = prevReports.filter(r => r.id !== reportId);

                if (updatedReports.length === 0) {
                    if (currentPage > 1) {
                        setCurrentPage(prev => prev - 1); // Ir a la página anterior
                    } else {
                        // Si estamos en la página 1 y queda vacía, forzamos la recarga de la lista
                        // para que muestre el mensaje de "no encontrados".
                        fetchReports();
                    }
                }
                
                return updatedReports;
            });
            
            openModal(`Reporte ID ${reportId} eliminado con éxito.`, 'success');

        } catch (err) {
            console.error('Error deleting report:', err);
            openModal(`Error al eliminar el reporte: ${err.message || 'Error de conexión.'}`, 'error');
            // Si hay un error, forzamos una recarga para asegurar que la lista sea consistente
            fetchReports();
        }
    };

    const handleDeleteClick = (reportId) => {
        openModal(
            `¿Estás seguro de que quieres eliminar la orden de reporte ID: **${reportId}**? Esta acción es irreversible.`, 
            'confirm', 
            () => handleConfirmDelete(reportId)
        );
    };

    // Paginacion 

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

    // Loading de cargar reportes 

    if (loading) return <div className="container card">Cargando órdenes de reporte...</div>;
    if (fetchError && reports.length === 0) return <div className="container card danger">Error al cargar reportes: {fetchError}</div>;

    return (
        <div className="container">
            <h1 className="title">📋 Gestión de Reportes Clínicos</h1>
            
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Volver a Tipos de Examen
                </Link>
                <Link href="/reports/create" className="btn btn-success">
                    + Crear Nueva Orden
                </Link>
            </div>

            <div className="card" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                    <input
                        type="text"
                        placeholder="Buscar por Paciente o Examen..."
                        value={inputSearchTerm} 
                        onChange={handleSearchChange} 
                        style={{ width: '100%', padding: '8px 12px' }}
                    />
                </div>
                
                <div className="form-group" style={{ width: '200px', marginBottom: 0 }}>
                    <select
                        value={filterStatus}
                        onChange={handleFilterStatusChange} 
                        style={{ width: '100%', padding: '10px 12px' }}
                    >
                        <option value="ALL">Mostrar Todos</option>
                        <option value="PENDIENTE">Pendientes</option>
                        <option value="COMPLETADO">Completados</option>
                    </select>
                </div>
            </div>
            
            <div className="card">
                <h2>Órdenes (Página {currentPage} de {totalPages})</h2>
                
                {reports.length === 0 && !loading ? (
                    <p style={{ textAlign: 'center', padding: '20px' }}>No se encontraron reportes con los criterios de búsqueda/filtro.</p>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Paciente</th>
                                <th>Examen Solicitado</th>
                                <th>Estado</th>
                                <th>Fecha de Orden</th>
                                <th style={{ width: '220px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report) => (
                                <tr key={report.id}>
                                    <td>{report.id}</td>
                                    <td>{report.identificador_paciente}</td>
                                    <td>{report.tipoExamen.nombre}</td>
                                    <td>
                                        <span className={`badge ${report.estado === 'PENDIENTE' ? 'badge-warning' : 'badge-success'}`}>
                                            {report.estado}
                                        </span>
                                    </td>
                                    <td>{new Date(report.fecha_reporte).toLocaleDateString()}</td>
                                    <td className="actions-cell">
                                        <div className="action-buttons">
                                            <Link 
                                                href={`/reports/${report.id}`} 
                                                className={`btn btn-sm ${report.estado === 'COMPLETADO' ? 'btn-info' : 'btn-primary'}`} 
                                            >
                                                {report.estado === 'PENDIENTE' ? 'Ingresar Resultados' : 'Ver Reporte Final'}
                                            </Link>

                                            <button
                                                onClick={() => handleDeleteClick(report.id)}
                                                className="btn btn-sm btn-danger btn-icon-danger" 
                                            >
                                                ❌
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                
                <PaginationControls />
            </div>

            {/*Modal*/}        
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