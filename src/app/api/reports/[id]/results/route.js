import { NextResponse } from 'next/server';
import pool from '@/libs/db';

// Limpiar lista de Opciones
// Función de Deserialización JSON/CSV para opciones 
const parseOptionsList = (optionsString) => {
    if (!optionsString) return [];
    
    // Intentar parsear como JSON (Formato preferido)
    try {
        const jsonParsed = JSON.parse(optionsString);
        if (Array.isArray(jsonParsed)) {
            return jsonParsed.map(String);
        }
    } catch (e) {
        // Si falla el parseo JSON, intentar parsear como CSV (Fallback)
        let cleanString = String(optionsString).trim();
        cleanString = cleanString.replace(/^[\["]+|[\]"]+$/g, '');

        return cleanString
            .split(',')
            .map(s => s.trim().replace(/^"|"$/g, ''))
            .filter(Boolean); // Eliminar elementos vacíos
    }
    return [];
};


// Get Obtener el resultado del reporte

export async function GET(request, { params }) {
    const { id: idString } = await params; 

    if (!idString || isNaN(parseInt(idString, 10))) {
        return NextResponse.json({ error: 'ID de reporte inválido.' }, { status: 400 });
    }

    const reporteId = parseInt(idString, 10);

    try {
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
        };

        let camposNecesarios = [];

        if (reporte.tipoExamen.es_compuesto) {
            const fieldsSql = `
                SELECT 
                    CE_S.campo_id, 
                    CE_S.campo_nombre, 
                    CE_S.campo_tipo_dato, 
                    CE_S.campo_opc_lista,
                    TE_S.tipo_nombre AS examenSimpleNombre 
                FROM compuestos_examen AS CE 
                JOIN tipos_examen AS TE_S ON CE.componente_tipo_id = TE_S.tipo_id 
                JOIN campos_examen AS CE_S ON TE_S.tipo_id = CE_S.tipo_id 
                WHERE CE.compuesto_tipo_id = ?
                ORDER BY TE_S.tipo_nombre ASC, CE_S.campo_nombre ASC
            `.trim();
            const [fieldRows] = await pool.execute(fieldsSql, [reporte.tipoExamen.id]);

            camposNecesarios = fieldRows.map(campo => ({
                id: campo.campo_id,
                nombre_campo: campo.campo_nombre,
                tipo_dato: campo.campo_tipo_dato,
                opciones_lista: parseOptionsList(campo.campo_opc_lista), 
                examenSimpleNombre: campo.examenSimpleNombre,
            }));

        } else {
            const fieldsSql = `
                SELECT campo_id, campo_nombre, campo_tipo_dato, campo_opc_lista
                FROM campos_examen
                WHERE tipo_id = ?
                ORDER BY campo_nombre ASC
            `.trim();
            const [fieldRows] = await pool.execute(fieldsSql, [reporte.tipoExamen.id]);
            
            camposNecesarios = fieldRows.map(campo => ({
                id: campo.campo_id,
                nombre_campo: campo.campo_nombre,
                tipo_dato: campo.campo_tipo_dato,
                opciones_lista: parseOptionsList(campo.campo_opc_lista),
            }));
        }

        const resultsSql = `
            SELECT campo_id, resultado_valor_texto, resultado_valor_numero
            FROM resultados_examen
            WHERE reporte_id = ?
        `.trim();
        const [resultsRows] = await pool.execute(resultsSql, [reporteId]);

        const resultadosMapeados = resultsRows.reduce((acc, valor) => {
            // Priorizar el valor numérico, si es nulo, usar texto
            const valorFinal = valor.resultado_valor_numero !== null 
                ? valor.resultado_valor_numero
                : valor.resultado_valor_texto;
                
            acc[valor.campo_id] = valorFinal;
            return acc;
        }, {});

        return NextResponse.json({ reporte, camposNecesarios, resultadosMapeados });

    } catch (err) {
        console.error('Error al obtener datos del reporte (GET):', err);
        return NextResponse.json({ error: 'Fallo al obtener la estructura del reporte.'}, { status: 500 });
    }
}

// POST: Guarda los resultados y cambia el estado del reporte a COMPLETADO (Transaccional)

export async function POST(request, { params }) {
    const { id: idString } = await params;
    
    if (!idString || isNaN(parseInt(idString, 10))) {
        return NextResponse.json({ error: 'ID de reporte inválido.' }, { status: 400 });
    }
    
    const reporteId = parseInt(idString, 10);
    const { resultados } = await request.json(); 
    let connection;

    try {
        if (!resultados || resultados.length === 0) {
            return NextResponse.json({ error: 'Se requieren resultados para guardar.' }, { status: 400 });
        }
        
        // --- 1. Preparar los datos para la inserción ---
        const datosParaInsertar = resultados.map(r => {
            const campoId = parseInt(r.campo_id, 10);

            const rawText = r.valor_texto;
            const rawNumber = r.valor_numero;
            
            // 1. Validar Valor de Texto: si es nulo, indefinido, o string vacío (después de trim), es NULL.
            const textValue = (rawText === null || rawText === undefined || String(rawText).trim() === '') ? null : String(rawText);

            // 2. Validar y Parsear Valor Numérico: si es un número válido, se parsea, sino es NULL.
            let numValue = null;
            if (rawNumber !== null && rawNumber !== undefined && rawNumber !== '') {
                const parsedNum = parseFloat(rawNumber);
                if (!isNaN(parsedNum)) {
                    numValue = parsedNum;
                }
            }
            
            if (textValue === null && numValue === null) {
                return null; // Omitir resultados vacíos
            }

            return [
                reporteId,
                campoId,
                textValue,
                numValue,
            ];
        }).filter(r => r !== null); 

        console.log('Datos preparados para insertar en resultados_examen:', datosParaInsertar);

        if (datosParaInsertar.length === 0) {
            return NextResponse.json({ message: 'No hay resultados válidos para guardar. El estado del reporte no fue cambiado.' });
        }

        // --- 2. Ejecutar Transacción ---
        connection = await pool.getConnection();
        await connection.beginTransaction(); 
        
        // a. Borrar resultados anteriores
        await connection.execute(`
            DELETE FROM resultados_examen 
            WHERE reporte_id = ?
        `.trim(), [reporteId]);

        const insertResultsSql = `
            INSERT INTO resultados_examen (reporte_id, campo_id, resultado_valor_texto, resultado_valor_numero) 
            VALUES ?
        `.trim();
        await connection.query(insertResultsSql, [datosParaInsertar]);

        // c. Actualizar el estado del reporte a COMPLETADO y la fecha
        await connection.execute(`
            UPDATE reportes_examen 
            SET reporte_estado = 'COMPLETADO', reporte_fecha = NOW()
            WHERE reporte_id = ?
        `.trim(), [reporteId]);
        
        await connection.commit();
        connection.release();

        return NextResponse.json({ message: 'Resultados guardados y reporte completado.' });

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }

        console.error('Error al guardar resultados (POST):', err);
        
        if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) { 
            return NextResponse.json(
                { error: 'Alguno de los IDs de campo de examen proporcionados no existe.' }, 
                { status: 409 } 
            );
        }

        return NextResponse.json({ 
            error: 'Fallo al procesar y guardar los resultados. (Error interno).'
        }, { status: 500 });
    }
}