import { getDatabase } from './database.js'
import { getCustomEntityByName } from './customEntities.js'

/* List rows for a custom entity table. */
export function listCustomEntityRows(entityName) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entityName)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const safeTableName = entity.entity_name
  return database.prepare(`SELECT * FROM "${safeTableName}" ORDER BY id DESC LIMIT 200`).all()
}

/* Insert a row for a custom entity table. */
export function createCustomEntityRow(entityName, inputData) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entityName)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const safeTableName = entity.entity_name
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const allowedColumns = entity.fields.filter((field) => field.is_active).map((field) => field.field_name)
  const insertData = pickAllowedColumns(safeInputData, allowedColumns)

  if (Object.keys(insertData).length === 0) {
    throw new Error('No insertable fields provided')
  }

  const insertColumns = Object.keys(insertData)
  const insertPlaceholders = insertColumns.map(() => '?')
  const insertValues = insertColumns.map((columnName) => insertData[columnName])

  const result = database
    .prepare(
      `INSERT INTO "${safeTableName}" (${insertColumns.map((name) => `"${name}"`).join(',')}) VALUES (${insertPlaceholders.join(',')})`,
    )
    .run(...insertValues)

  return database.prepare(`SELECT * FROM "${safeTableName}" WHERE id = ?`).get(result.lastInsertRowid)
}

/* Update a row for a custom entity table. */
export function updateCustomEntityRow(entityName, rowId, inputData) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entityName)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const safeTableName = entity.entity_name
  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}

  const allowedColumns = entity.fields.filter((field) => field.is_active).map((field) => field.field_name)
  const updateData = pickAllowedColumns(safeInputData, allowedColumns)

  if (Object.keys(updateData).length === 0) {
    return database.prepare(`SELECT * FROM "${safeTableName}" WHERE id = ?`).get(Number(rowId))
  }

  const updateColumns = Object.keys(updateData)
  const setClause = updateColumns.map((columnName) => `"${columnName}" = ?`).join(', ')
  const updateValues = updateColumns.map((columnName) => updateData[columnName])

  database
    .prepare(`UPDATE "${safeTableName}" SET ${setClause} WHERE id = ?`)
    .run(...updateValues, Number(rowId))

  return database.prepare(`SELECT * FROM "${safeTableName}" WHERE id = ?`).get(Number(rowId))
}

/* Delete a row from a custom entity table. */
export function deleteCustomEntityRow(entityName, rowId) {
  const database = getDatabase()
  const entity = getCustomEntityByName(entityName)
  if (!entity) {
    throw new Error('Custom entity not found')
  }

  const safeTableName = entity.entity_name
  database.prepare(`DELETE FROM "${safeTableName}" WHERE id = ?`).run(Number(rowId))
}

/* Keep only keys that are explicitly allowed. */
function pickAllowedColumns(inputData, allowedColumns) {
  const pickedData = {}
  for (const columnName of allowedColumns) {
    if (Object.prototype.hasOwnProperty.call(inputData, columnName)) {
      pickedData[columnName] = inputData[columnName]
    }
  }
  return pickedData
}

