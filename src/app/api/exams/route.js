import { NextResponse } from 'next/server';
import pool from '@/libs/db'; 

// Listar tipos de examen con BÚSQUEDA, FILTRO y PAGINACIÓN
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || '';
    const filterType = searchParams.get('type'); 
    
    // Convertir a número entero, con valores predeterminados
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 8; 
    const skip = (page - 1) * limit; // OFFSET

    let whereClauses = [];
    let queryParams = [];

    // --- Lógica de Filtros ---
    if (filterType === 'SIMPLE') {
        whereClauses.push("tipo_es_compuesto = ?");
        queryParams.push(0); 
    } else if (filterType === 'COMPUESTO') {
        whereClauses.push("tipo_es_compuesto = ?");
        queryParams.push(1); 
    }

    // Nota: La búsqueda LIKE necesita el % fuera del placeholder
    if (searchTerm) {
        whereClauses.push("tipo_nombre LIKE ?");
        queryParams.push(`%${searchTerm}%`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    try {
        // 1. Contar el total de registros ---
        const countSql = `SELECT COUNT(tipo_id) AS total FROM tipos_examen ${whereString}`.trim(); 
        
        // Usamos query() para el conteo, aunque execute() generalmente funciona aquí.
        const [countRows] = await pool.query(countSql, queryParams);
        
        const totalExams = countRows[0].total; 
        const totalPages = Math.ceil(totalExams / limit);

        // 2. Obtener los exámenes con paginación ---
        
        // dataQueryParams es la concatenación de filtros y paginación
        // Forzamos los tipos de dato (Number)
        const dataQueryParams = [...queryParams, Number(limit), Number(skip)];
        
        let paginationSql = `SELECT tipo_id, tipo_nombre, tipo_es_compuesto FROM tipos_examen ${whereString} ORDER BY tipo_nombre ASC LIMIT ? OFFSET ?`.trim(); 
        
        // 💡 CAMBIO CLAVE: USAMOS pool.query() EN LUGAR DE pool.execute()
        // Esto evita el error de argumentos en sentencias preparadas.
        const [exams] = await pool.query(paginationSql, dataQueryParams); 
        
        const mappedExams = exams.map(exam => ({
            id: exam.tipo_id,
            nombre: exam.tipo_nombre,
            es_compuesto: !!exam.tipo_es_compuesto,
        }));

        return NextResponse.json({ exams: mappedExams, totalExams, totalPages });
        
    } catch (error) {
        console.error('Error al listar tipos de examen:', error); 
        return NextResponse.json({ error: 'Fallo al listar los tipos de examen.' }, { status: 500 });
    }
}


// --- POST (Crear un Examen) - Adaptado para usar query() donde se usaba execute() ---

export async function POST(request) {
    const reqBody = await request.json();
    const { nombre, es_compuesto, campos, composicion } = reqBody;
    
    let connection;

    try {
        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 });
        }
        
        connection = await pool.getConnection();
        await connection.beginTransaction(); 

        const createExamSql = `INSERT INTO tipos_examen (tipo_nombre, tipo_es_compuesto) VALUES (?, ?)`.trim();
        // 💡 Usamos connection.query()
        const [result] = await connection.query(createExamSql, [
            nombre,
            es_compuesto ? 1 : 0 // 1/0 para BOOLEAN en MySQL
        ]);

        const nuevoExamenId = result.insertId;

        if (es_compuesto && composicion && composicion.length > 0) {
            // Es Compuesto: Insertar en compuestos_examen
            const compositionValues = composicion.map(simpleId => [
                nuevoExamenId, 
                simpleId 
            ]);

            const compositionSql = `INSERT INTO compuestos_examen (compuesto_tipo_id, componente_tipo_id) VALUES ?`.trim();
            await connection.query(compositionSql, [compositionValues]); 

        } else if (!es_compuesto && campos && campos.length > 0) {
            // No es Compuesto: Insertar en campos_examen
            const fieldsValues = campos.map(campo => [
                nuevoExamenId, 
                campo.nombre_campo, 
                campo.tipo_dato, 
                campo.opciones_lista ? JSON.stringify(campo.opciones_lista) : null, 
            ]);

            const fieldsSql = `INSERT INTO campos_examen (tipo_id, campo_nombre, campo_tipo_dato, campo_opc_lista) VALUES ?`.trim();
            await connection.query(fieldsSql, [fieldsValues]);
        }

        await connection.commit(); 
        connection.release(); 

        return NextResponse.json({ id: nuevoExamenId, nombre, es_compuesto }, { status: 201 });
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error al crear tipo de examen:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'Ya existe un tipo de examen con ese nombre.' }, { status: 409 });
        }
        
        return NextResponse.json({ error: 'Fallo al crear el tipo de examen. Revise log.' }, { status: 500 });
    }
}