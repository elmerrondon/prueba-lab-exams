import { NextResponse } from 'next/server';
import pool from '@/libs/db'; 

// Obtener un Reporte específico, su TipoExamen asociado y sus Resultados

export async function GET(request, { params }) {
    const { id: reportIdString } = await params;
    
    if (!reportIdString || isNaN(parseInt(reportIdString))) {
        return NextResponse.json({ error: 'ID de reporte inválido.' }, { status: 400 });
    }

    const reporteId = parseInt(reportIdString);

    try {
        // 1. Obtener ReporteExamen principal y el TipoExamen (JOIN)
        const reportSql = `
            SELECT RE.reporte_id, RE.reporte_paciente, RE.reporte_fecha, RE.reporte_estado,
            TE.tipo_id AS tipoExamen_id, 
            TE.tipo_nombre AS tipoExamen_nombre, 
            TE.tipo_es_compuesto AS tipoExamen_es_compuesto
            FROM reportes_examen AS RE 
            JOIN tipos_examen AS TE ON RE.tipo_id = TE.tipo_id 
            WHERE RE.reporte_id = ?
        `.trim(); 
        const [reportRows] = await pool.execute(reportSql, [reporteId]);
        
        if (reportRows.length === 0) {
            return NextResponse.json({ error: 'Reporte no encontrado.' }, { status: 404 });
        }
        
        const row = reportRows[0];
        
        // 2. Obtener resultados asociados
        const resultsSql = `
            SELECT campo_id, resultado_valor_texto, resultado_valor_numero 
            FROM resultados_examen 
            WHERE reporte_id = ?
        `.trim(); 

        const [resultsRows] = await pool.execute(resultsSql, [reporteId]);
        
        const reporte = {
            id: row.reporte_id,
            identificador_paciente: row.reporte_paciente,
            fecha_reporte: row.reporte_fecha, 
            estado: row.reporte_estado, 
            
            tipoExamen: {
                id: row.tipoExamen_id,
                nombre: row.tipoExamen_nombre,
                es_compuesto: !!row.tipoExamen_es_compuesto, 
            },
            
            resultados: resultsRows.map(resultado => ({
                id_campo_examen: resultado.campo_id,
                valor: resultado.resultado_valor_numero !== null 
                       ? resultado.resultado_valor_numero 
                       : resultado.resultado_valor_texto, 
            })),
        };

        return NextResponse.json(reporte);

    } catch (error) {
        console.error(`Error al obtener el reporte ${reporteId}:`, error);
        return NextResponse.json({ error: 'Fallo al obtener los datos del reporte.' }, { status: 500 });
    }
}

 
// Actualizar el estado y/o guardar los resultados

export async function PATCH(request, { params }) {
    const { id: reportIdString } = await params;

    if (!reportIdString || isNaN(parseInt(reportIdString))) {
        return NextResponse.json({ error: 'ID de reporte inválido.' }, { status: 400 });
    }
    
    const reporteId = parseInt(reportIdString);
    let connection;

    try {
        const reqBody = await request.json();
        const { estado, resultados } = reqBody; 
        if (!estado && (!resultados || resultados.length === 0)) {
            return NextResponse.json({ error: 'Se requiere el campo "estado" o "resultados" para actualizar.' }, { status: 400 });
        }
        
        connection = await pool.getConnection();
        await connection.beginTransaction(); // Iniciar Transacción

        if (estado) {
            const updateReportSql = `
                UPDATE reportes_examen 
                SET reporte_estado = ?, reporte_fecha = NOW() 
                WHERE reporte_id = ?
            `.trim();
            await connection.execute(updateReportSql, [estado, reporteId]);
        }
        
        if (resultados && resultados.length > 0) {
            // Lógica destructiva: Primero borramos todos los resultados existentes para este reporte
            await connection.execute(`DELETE FROM resultados_examen WHERE reporte_id = ?`.trim(), [reporteId]);
            
            // Creamos los valores para la inserción masiva
            const resultValues = resultados.map(resultado => {
                // Determinar si el valor es numérico o de texto
                const isNumeric = typeof resultado.valor === 'number' && !isNaN(resultado.valor);

                return [
                    reporteId,                                
                    resultado.id_campo_examen,                 
                    isNumeric ? null : String(resultado.valor),
                    isNumeric ? resultado.valor : null,        
                ];
            });

            const insertResultsSql = `
                INSERT INTO resultados_examen (reporte_id, campo_id, resultado_valor_texto, resultado_valor_numero) 
                VALUES ?
            `.trim();

            await connection.query(insertResultsSql, [resultValues]);
        }
        
        await connection.commit(); 
        connection.release(); 

        return NextResponse.json({ 
            id: reporteId, 
            message: `Reporte ${reporteId} actualizado con éxito.`,
            nuevo_estado: estado
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error(`Error al actualizar el reporte ${reporteId}:`, error);
        
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) { 
            return NextResponse.json(
                { error: 'Alguno de los IDs de campo de examen (campo_id) o el ID del reporte no existen.' }, 
                { status: 409 } 
            );
        }

        return NextResponse.json({ error: 'Fallo al actualizar el reporte. (Error interno).' }, { status: 500 });
    }
}


// DELETE: Eliminar un reporte específico por ID

export async function DELETE(request, { params }) {
    const { id: reportIdString } = await params;
    
    if (!reportIdString || isNaN(parseInt(reportIdString))) {
        return NextResponse.json({ error: 'ID de reporte inválido.' }, { status: 400 });
    }

    const reporteId = parseInt(reportIdString);

    try {
        const deleteSql = `DELETE FROM reportes_examen WHERE reporte_id = ?`.trim();
        const [result] = await pool.execute(deleteSql, [reporteId]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Reporte no encontrado para eliminar.' }, { status: 404 });
        }

        return NextResponse.json({ 
            message: `Reporte con ID ${reporteId} eliminado exitosamente.`, 
        });

    } catch (error) {
        console.error('Error al eliminar el reporte:', error);
        return NextResponse.json({ error: 'Fallo al eliminar el reporte. (Error interno).' }, { status: 500 });
    }
}