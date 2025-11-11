import { NextResponse } from 'next/server';
import pool from '@/libs/db';

// GET: Listar reportes con BÚSQUEDA, FILTRO y PAGINACIÓN

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || '';
    const filterStatus = searchParams.get('status');
    
    // Parámetros de Paginación
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 8; 
    const skip = (page - 1) * limit; 

    // cláusula WHERE y los parámetros para la búsqueda con JOIN
    let whereClauses = [];
    let queryParams = [];
    
    // Alias y JOINs correctos
    const joinSql = `FROM reportes_examen AS RE JOIN tipos_examen AS TE ON RE.tipo_id = TE.tipo_id`.trim();

    // Filtro por Estado (PENDIENTE/COMPLETADO)
    if (filterStatus && filterStatus !== 'ALL') {
        whereClauses.push("RE.reporte_estado = ?"); 
        queryParams.push(filterStatus);
    }

    // Búsqueda (Search Term)
    if (searchTerm) {
        // Buscamos por nombre de paciente o nombre de examen
        whereClauses.push(`
            (
                RE.reporte_paciente LIKE ? 
                OR TE.tipo_nombre LIKE ?
            )
        `.trim());
        // El LIKE requiere que los comodines (%) se pasen dentro del parámetro:
        queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`); 
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    try {
        // 1. Contar el número TOTAL de reportes ---
        const countSql = `SELECT COUNT(RE.reporte_id) AS total ${joinSql} ${whereString}`.trim();
        // 💡 CAMBIO CLAVE: Usamos pool.query() en lugar de pool.execute()
        const [countRows] = await pool.query(countSql, queryParams);
        const totalReports = countRows[0].total; 
        const totalPages = Math.ceil(totalReports / limit);
        
        // 2. Listar los reportes de la página actual ---
        
        // Se construye el array de parámetros final: filtros + paginación (limit, skip)
        const dataQueryParams = [...queryParams, Number(limit), Number(skip)];
        
        // Seleccionamos todas las columnas necesarias con alias claros
        const selectFields = `
            RE.reporte_id AS id, 
            RE.reporte_paciente AS paciente, 
            RE.reporte_fecha AS fecha, 
            RE.reporte_estado AS estado, 
            TE.tipo_id AS tipoE_id,
            TE.tipo_nombre AS tipoE_nombre,
            TE.tipo_es_compuesto AS tipoE_compuesto
        `.trim();
        
        const selectSql = `SELECT ${selectFields} ${joinSql} ${whereString} 
                           ORDER BY RE.reporte_fecha DESC 
                           LIMIT ? OFFSET ?`.trim();
        
        // 💡 CAMBIO CLAVE: Usamos pool.query() en lugar de pool.execute()
        const [rows] = await pool.query(selectSql, dataQueryParams);
        
        // Mapear los resultados a una estructura limpia para el frontend
        const reports = rows.map(row => ({
            id: row.id,
            identificador_paciente: row.paciente,
            fecha_reporte: row.fecha,
            estado: row.estado,
            tipoExamen: { 
                id: row.tipoE_id,
                nombre: row.tipoE_nombre,
                es_compuesto: !!row.tipoE_compuesto, // Convertir 1/0 a boolean
            }
        }));
        
        return NextResponse.json({ reports, totalReports, totalPages });
        
    } catch (error) {
        console.error('Error al listar reportes con paginación:', error);
        return NextResponse.json({ error: 'Fallo al listar los reportes.' }, { status: 500 });
    }
}

// Crear una nueva Orden de Examen PENDIENTE (POST) - Sin cambios, usa execute()
// El POST usa execute() para una consulta simple y es menos propenso al error.
export async function POST(request) {
    try {
        const reqBody = await request.json();
        const { id_tipo_examen, identificador_paciente } = reqBody;
        
        if (!id_tipo_examen || !identificador_paciente) {
            return NextResponse.json({ error: 'Se requiere el tipo de examen y el identificador del paciente.' }, { status: 400 });
        }

        const createSql = `INSERT INTO reportes_examen (tipo_id, reporte_paciente, reporte_estado, reporte_fecha) VALUES (?, ?, ?, NOW())`.trim();
        
        const [result] = await pool.execute(createSql, [
            parseInt(id_tipo_examen), 
            identificador_paciente, 
            'PENDIENTE'
        ]);

        const nuevoReporteId = result.insertId;

        return NextResponse.json({ 
            id: nuevoReporteId,
            id_tipo_examen: parseInt(id_tipo_examen),
            identificador_paciente,
            estado: 'PENDIENTE',
            fecha_reporte: new Date().toISOString(), // Usar fecha local para la respuesta
        }, { status: 201 });
        
    } catch (error) {
        console.error('Error al crear el reporte:', error);
        
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) { 
            return NextResponse.json(
                { error: 'El ID del tipo de examen proporcionado no existe.' }, 
                { status: 409 } 
            );
        }

        return NextResponse.json({ error: 'Fallo al crear la orden de reporte.' }, { status: 500 });
    }
}