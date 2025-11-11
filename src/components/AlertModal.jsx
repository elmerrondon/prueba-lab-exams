'use client';

import React, { useEffect } from 'react';
import './AlertModal.css'; 

const AlertModal = ({ 
    isOpen, 
    onClose, 
    msg = 'Operación en curso...', 
    type = 'success', // 'success', 'error', o 'confirm'
    onConfirm = () => {} // Función callback para el modo 'confirm'
}) => {
    
    // Lógica de Auto-Cierre (Solo para 'success' y 'error')
    useEffect(() => {
        if (isOpen && type !== 'confirm') { 
            const timer = setTimeout(() => {
                onClose();
            }, 3000); 
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose, type]); 

    if (!isOpen) {
        return null;
    }

    // 1. Determinar Clases y Título
    let contentClass = 'modal-content-base';
    let title = 'Información';

    switch (type) {
        case 'success':
            contentClass += ' modal-content-success';
            title = '✅ Éxito';
            break;
        case 'error':
            contentClass += ' modal-content-error';
            title = '⚠️ Error';
            break;
        case 'confirm':
            contentClass += ' modal-content-confirm';
            title = '❓ Confirmar';
            break;
        default:
            // Fallback por defecto si se pasa un tipo inválido
            contentClass += ' modal-content-confirm';
            title = 'Información';
    }
    
    // 2. Manejador para la Confirmación
    const handleConfirm = () => {
        onConfirm(); // Ejecuta la acción principal
        onClose();   // Cierra el modal
    };

    // La función que previene el cierre al hacer clic en el contenido
    const stopPropagation = (e) => e.stopPropagation();

    return (
        <div 
            className="modal-backdrop-alert" 
            // Permite cerrar al hacer clic afuera SOLO si no es una confirmación
            onClick={type !== 'confirm' ? onClose : undefined} 
        > 
            <div 
                className={contentClass} 
                onClick={stopPropagation} 
            >
                <h3>{title}</h3>
                <p>{msg}</p>

                {/* 3. Renderizado Condicional de Botones de Confirmación */}
                {type === 'confirm' && (
                    <div className='modal-actions'>
                        <button onClick={handleConfirm} className='btn-confirm'>Confirmar</button>
                        <button onClick={onClose} className='btn-cancel'>Cancelar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertModal;