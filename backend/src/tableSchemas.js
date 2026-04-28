const crmTableSchemas = {
  accounts: {
    insertableColumns: ['account_name', 'website', 'industry'],
    updatableColumns: ['account_name', 'website', 'industry'],
  },
  contacts: {
    insertableColumns: ['account_id', 'first_name', 'last_name', 'email', 'phone'],
    updatableColumns: ['account_id', 'first_name', 'last_name', 'email', 'phone'],
  },
  opportunities: {
    insertableColumns: ['account_id', 'opportunity_name', 'stage', 'amount', 'close_date'],
    updatableColumns: ['account_id', 'opportunity_name', 'stage', 'amount', 'close_date'],
  },
  activities: {
    insertableColumns: [
      'activity_type',
      'subject',
      'due_date',
      'account_id',
      'contact_id',
      'opportunity_id',
      'notes',
    ],
    updatableColumns: [
      'activity_type',
      'subject',
      'due_date',
      'account_id',
      'contact_id',
      'opportunity_id',
      'notes',
    ],
  },
  products: {
    insertableColumns: ['product_name', 'sku', 'unit_price'],
    updatableColumns: ['product_name', 'sku', 'unit_price'],
  },
  orders: {
    insertableColumns: ['account_id', 'order_number', 'order_date', 'status'],
    updatableColumns: ['account_id', 'order_number', 'order_date', 'status'],
  },
  order_items: {
    insertableColumns: ['order_id', 'product_id', 'quantity', 'unit_price'],
    updatableColumns: ['order_id', 'product_id', 'quantity', 'unit_price'],
  },
}

/* Get the allowed schema definition for a CRM table name. */
export function getCrmTableSchema(tableName) {
  const schema = crmTableSchemas[tableName]
  if (!schema) {
    throw new Error(`Unsupported table: ${tableName}`)
  }
  return schema
}

