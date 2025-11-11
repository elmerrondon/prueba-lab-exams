CREATE DATABASE IF NOT EXISTS lab_examenes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE lab_examenes_db;

-- Deshabilitar la verificación de claves foráneas temporalmente.
SET FOREIGN_KEY_CHECKS = 0;

-- 1. TABLA: tipos_examen
-- Contiene todos los exámenes, usando la convención de prefijos 'tipo_'.

CREATE TABLE tipos_examen (
    tipo_id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único del tipo de examen',
    tipo_nombre VARCHAR(255) UNIQUE NOT NULL COMMENT 'Nombre legible del examen (ej. Hemograma, Glucosa)',
    tipo_es_compuesto BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Indica si este examen agrupa a otros exámenes simples',
    PRIMARY KEY (tipo_id),
    INDEX idx_tipo_nombre (tipo_nombre)
);

-- 2. TABLA: compuestos_examen (Tabla Pivote)

CREATE TABLE compuestos_examen (
    compuesto_tipo_id INT UNSIGNED NOT NULL COMMENT 'ID del examen compuesto (contenedor) que agrupa los componentes.',
    componente_tipo_id INT UNSIGNED NOT NULL COMMENT 'ID del examen simple que es un componente del examen compuesto.',
    
    -- PK Compuesta garantiza que la combinación (Contenedor, Componente) es única
    PRIMARY KEY (compuesto_tipo_id, componente_tipo_id),    
    -- La FK asegura que el ID del COMPUESTO exista en tipos_examen
    FOREIGN KEY (compuesto_tipo_id) REFERENCES tipos_examen(tipo_id) ON DELETE CASCADE,
    -- La FK asegura que el ID del COMPONENTE exista en tipos_examen
    FOREIGN KEY (componente_tipo_id) REFERENCES tipos_examen(tipo_id) ON DELETE CASCADE
);

-- 3. TABLA: campos_examen
-- Define los campos de resultados que debe tener un examen simple.

CREATE TABLE campos_examen (
    campo_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'Identificador único del campo',
    tipo_id INT UNSIGNED NOT NULL COMMENT 'Referencia al examen simple al que pertenece este campo',
    campo_nombre VARCHAR(255) NOT NULL COMMENT 'Nombre del campo de resultado (ej. Glóbulos Rojos, Nivel de pH)',
    campo_tipo_dato ENUM('TEXTO', 'NUMERO', 'LISTA') NOT NULL COMMENT 'Tipo de dato esperado para el resultado',
    campo_opc_lista JSON COMMENT 'Almacena un array JSON de opciones para el tipo de dato LISTA',
    
    -- Índice único compuesto para asegurar que un campo no se repita en el mismo tipo de examen
    UNIQUE KEY uk_tipo_campo (tipo_id, campo_nombre),
    
    FOREIGN KEY (tipo_id) REFERENCES tipos_examen(tipo_id) ON DELETE CASCADE
);


-- 4. TABLA: reportes_examen
-- Representa una orden de examen solicitada para un paciente.

CREATE TABLE reportes_examen (
    reporte_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID único de la orden/reporte',
    tipo_id INT UNSIGNED NOT NULL COMMENT 'Referencia al examen ordenado (puede ser simple o compuesto)',
    reporte_paciente VARCHAR(50) NOT NULL COMMENT 'Nombre del paciente',
    reporte_fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación de la orden',
    reporte_estado ENUM('PENDIENTE', 'COMPLETADO') NOT NULL DEFAULT 'PENDIENTE' COMMENT 'Estado actual del reporte',
    FOREIGN KEY (tipo_id) REFERENCES tipos_examen(tipo_id),
    INDEX idx_reporte_tipo_id (tipo_id) 
);

-- 5. TABLA: resultados_examen
-- Almacena el valor de resultado para cada campo de un reporte específico.

CREATE TABLE resultados_examen (
    resultado_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID único del valor de resultado',
    reporte_id INT UNSIGNED NOT NULL COMMENT 'Referencia a la orden/reporte',
    campo_id INT UNSIGNED NOT NULL COMMENT 'Referencia al campo de resultado (CampoExamen.id)',
    resultado_valor_texto TEXT COMMENT 'Valor de resultado si el tipo de dato es TEXTO o LISTA',
    resultado_valor_numero DECIMAL(10, 2) COMMENT 'Valor de resultado si el tipo de dato es NUMERO',
    
    -- Combinación única para asegurar que un campo solo se llene una vez por reporte
    UNIQUE KEY uk_campo_reporte (reporte_id, campo_id),
    
    FOREIGN KEY (reporte_id) REFERENCES reportes_examen(reporte_id) ON DELETE CASCADE,
    FOREIGN KEY (campo_id) REFERENCES campos_examen(campo_id) ON DELETE CASCADE
);


-- Habilitar nuevamente la verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;