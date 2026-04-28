import { getDatabase } from './database.js'
import { getCrmTableSchema } from './tableSchemas.js'

/* Fetch a list of rows for a given CRM table. */
export function getAllRows(tableName) {
  getCrmTableSchema(tableName)
  const database = getDatabase()
  return database.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 200`).all()
}

/* Fetch a single row by id for a given CRM table. */
export function getRowById(tableName, id) {
  getCrmTableSchema(tableName)
  const database = getDatabase()
  return database.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(Number(id))
}

/* Insert a row into a CRM table, using only allowed columns. */
export function insertRow(tableName, inputData) {
  const schema = getCrmTableSchema(tableName)
  const database = getDatabase()

  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}
  const insertData = pickAllowedColumns(safeInputData, schema.insertableColumns)

  if (Object.keys(insertData).length === 0) {
    throw new Error('No insertable fields provided')
  }

  const insertColumns = Object.keys(insertData)
  const insertPlaceholders = insertColumns.map(() => '?')
  const insertValues = insertColumns.map((columnName) => insertData[columnName])

  const result = database
    .prepare(`INSERT INTO ${tableName} (${insertColumns.join(',')}) VALUES (${insertPlaceholders.join(',')})`)
    .run(...insertValues)

  return getRowById(tableName, result.lastInsertRowid)
}

/* Update a row in a CRM table by id, using only allowed columns. */
export function updateRowById(tableName, id, inputData) {
  const schema = getCrmTableSchema(tableName)
  const database = getDatabase()

  const safeInputData = inputData && typeof inputData === 'object' ? inputData : {}
  const updateData = pickAllowedColumns(safeInputData, schema.updatableColumns)

  if (Object.keys(updateData).length === 0) {
    return getRowById(tableName, id)
  }

  const updateColumns = Object.keys(updateData)
  const setClause = updateColumns.map((columnName) => `${columnName} = ?`).join(', ')
  const updateValues = updateColumns.map((columnName) => updateData[columnName])

  database
    .prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`)
    .run(...updateValues, Number(id))

  return getRowById(tableName, id)
}

/* Delete a row from a CRM table by id. */
export function deleteById(tableName, id) {
  getCrmTableSchema(tableName)
  const database = getDatabase()
  database.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(Number(id))
}

/* Keep only the keys that are explicitly allowed. */
function pickAllowedColumns(inputData, allowedColumns) {
  const pickedData = {}
  for (const columnName of allowedColumns) {
    if (Object.prototype.hasOwnProperty.call(inputData, columnName)) {
      pickedData[columnName] = inputData[columnName]
    }
  }
  return pickedData
}

