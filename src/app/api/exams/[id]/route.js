import { NextResponse } from 'next/server';
import pool from '@/libs/db'; 

// GET: Obtener un Tipo Examen por ID

export async function GET(request, { params }) {
    const { id: idString } = await params; 

    if (!idString || isNaN(parseInt(idString))) {
        return NextResponse.json({ error: 'ID de examen inválido.' }, { status: 400 });
    }
    
    const examId = parseInt(idString);

    try {
        const examSql = `SELECT tipo_id, tipo_nombre, tipo_es_compuesto FROM tipos_examen WHERE tipo_id = ?`.trim();
        const [examRows] = await pool.execute(examSql, [examId]);
        
        if (examRows.length === 0) {
            return NextResponse.json({ error: 'Examen no encontrado.' }, { status: 404 });
        }
        
        const examen = examRows[0];
        const es_compuesto = !!examen.tipo_es_compuesto; 
        
        let campos = [];
        let composicion = [];

        if (es_compuesto) {
            // Examen Compuesto: Obtener los IDs de los exámenes simples
            const compositionSql = `
                SELECT componente_tipo_id 
                FROM compuestos_examen 
                WHERE compuesto_tipo_id = ?
            `.trim();
            const [compositionRows] = await pool.execute(compositionSql, [examId]);
            composicion = compositionRows.map(c => c.componente_tipo_id); 

        } else {
            // Examen Simple: Obtener los campos
            const fieldsSql = `
                SELECT campo_id, tipo_id, campo_nombre, campo_tipo_dato, campo_opc_lista 
                FROM campos_examen 
                WHERE tipo_id = ?
            `.trim();
            const [fieldsRows] = await pool.execute(fieldsSql, [examId]);
            
            // Convertir la columna JSON de vuelta a objeto JS y asignar
            campos = fieldsRows.map(campo => ({
                id: campo.campo_id,
                tipo_id: campo.tipo_id, 
                nombre_campo: campo.campo_nombre,
                tipo_dato: campo.campo_tipo_dato,
                opciones_lista: campo.campo_opc_lista ? JSON.parse(campo.campo_opc_lista) : null,
            }));
        }

        const dataResponse = {
            id: examen.tipo_id,
            nombre: examen.tipo_nombre,
            es_compuesto: es_compuesto,
            campos: campos,
            composicion: composicion,
        };

        return NextResponse.json(dataResponse);

    } catch (error) {
        console.error(`Error al obtener el examen ${examId}:`, error);
        return NextResponse.json({ error: 'Fallo al obtener los datos del examen.' }, { status: 500 });
    }
}


// PUT: Actualizar un TipoExamen (Transaccional)

export async function PUT(request, { params }) {
    const { id: idString } = await params;

    if (!idString || isNaN(parseInt(idString))) {
        return NextResponse.json({ error: 'ID de examen inválido.' }, { status: 400 });
    }

    const examId = parseInt(idString);
    let connection;

    try {
        const reqBody = await request.json();
        const { nombre, es_compuesto, campos, composicion } = reqBody;

        if (!nombre) {
             return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 });
        }
        
        connection = await pool.getConnection();
        await connection.beginTransaction(); 

        const updateExamSql = `UPDATE tipos_examen SET tipo_nombre = ?, tipo_es_compuesto = ? WHERE tipo_id = ?`.trim();
        await connection.execute(updateExamSql, [
            nombre, 
            es_compuesto ? 1 : 0, // Convertir booleano JS a 1/0 de MySQL
            examId
        ]);
        
        // Lógica destructiva: Borrar TODAS las relaciones (campos y composición)

        await connection.execute(`DELETE FROM campos_examen WHERE tipo_id = ?`.trim(), [examId]);
        
        await connection.execute(`DELETE FROM compuestos_examen WHERE compuesto_tipo_id = ?`.trim(), [examId]);


        if (es_compuesto && composicion && composicion.length > 0) {
            // Es Compuesto: Insertar en compuestos_examen
            const compositionValues = composicion.map(simpleId => [
                examId, 
                simpleId
            ]);
            
            await connection.query(`INSERT INTO compuestos_examen (compuesto_tipo_id, componente_tipo_id) VALUES ?`.trim(), [compositionValues]);

        } else if (!es_compuesto && campos && campos.length > 0) {
            const fieldsValues = campos.map(campo => [
                examId,                                                                          // tipo_id
                campo.nombre_campo,                                                              // campo_nombre
                campo.tipo_dato,                                                                 // campo_tipo_dato
                campo.opciones_lista ? JSON.stringify(campo.opciones_lista) : null,              // campo_opc_lista (JSON)
            ]);
            
            await connection.query(`INSERT INTO campos_examen (tipo_id, campo_nombre, campo_tipo_dato, campo_opc_lista) VALUES ?`.trim(), [fieldsValues]);
        }

        await connection.commit();
        connection.release(); 
        return NextResponse.json({ id: examId, nombre, message: 'Examen actualizado con éxito.' });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error(`Error al actualizar el examen ${examId}:`, error);

        // Manejo de error de duplicado (ej. si el tipo_nombre ya existe)
        if (error.code === 'ER_DUP_ENTRY') {
             return NextResponse.json({ error: 'Ya existe un tipo de examen con ese nombre.' }, { status: 409 });
        }

        return NextResponse.json({ error: 'Fallo al actualizar el tipo de examen. Revise log.' }, { status: 500 });
    }
}


// DELETE: Eliminar un TipoExamen

export async function DELETE(request, { params }) {
    const { id: idString } = await params;
    
    if (!idString || isNaN(parseInt(idString))) {
        return NextResponse.json({ error: 'ID de examen inválido.' }, { status: 400 });
    }

    const examId = parseInt(idString);

    try {
        const deleteSql = `DELETE FROM tipos_examen WHERE tipo_id = ?`.trim();
        const [result] = await pool.execute(deleteSql, [examId]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Tipo de examen no encontrado.' }, { status: 404 });
        }

        return NextResponse.json({ 
            message: `Examen ${examId} eliminado con éxito.`
        });

    } catch (error) {
        console.error(`Error al eliminar el examen ${examId}:`, error);

        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) { 
            return NextResponse.json(
                { error: 'No se puede eliminar este examen porque tiene reportes de pacientes asociados. Elimine los reportes primero.' }, 
                { status: 409 } 
            );
        }

        return NextResponse.json({ error: 'Fallo al eliminar el tipo de examen. Revise log.' }, { status: 500 });
    }
}