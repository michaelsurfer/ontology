/* Describe CRM entities and the fields shown in the UI forms and tables. */
export const crmEntities = [
  {
    entityName: 'accounts',
    label: 'Accounts',
    fields: [
      { name: 'account_name', label: 'Account name', type: 'text', required: true },
      { name: 'website', label: 'Website', type: 'text' },
      { name: 'industry', label: 'Industry', type: 'text' },
    ],
  },
  {
    entityName: 'contacts',
    label: 'Contacts',
    fields: [
      { name: 'account_id', label: 'Account id', type: 'number' },
      { name: 'first_name', label: 'First name', type: 'text' },
      { name: 'last_name', label: 'Last name', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
    ],
  },
  {
    entityName: 'opportunities',
    label: 'Opportunities',
    fields: [
      { name: 'account_id', label: 'Account id', type: 'number' },
      { name: 'opportunity_name', label: 'Opportunity name', type: 'text', required: true },
      { name: 'stage', label: 'Stage', type: 'text' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'close_date', label: 'Close date', type: 'text' },
    ],
  },
  {
    entityName: 'activities',
    label: 'Activities',
    fields: [
      { name: 'activity_type', label: 'Activity type', type: 'text', required: true },
      { name: 'subject', label: 'Subject', type: 'text' },
      { name: 'due_date', label: 'Due date', type: 'text' },
      { name: 'account_id', label: 'Account id', type: 'number' },
      { name: 'contact_id', label: 'Contact id', type: 'number' },
      { name: 'opportunity_id', label: 'Opportunity id', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'text', multiline: true },
    ],
  },
  {
    entityName: 'products',
    label: 'Products',
    fields: [
      { name: 'product_name', label: 'Product name', type: 'text', required: true },
      { name: 'sku', label: 'SKU', type: 'text' },
      { name: 'unit_price', label: 'Unit price', type: 'number' },
    ],
  },
  {
    entityName: 'orders',
    label: 'Orders',
    fields: [
      { name: 'account_id', label: 'Account id', type: 'number' },
      { name: 'order_number', label: 'Order number', type: 'text', required: true },
      { name: 'order_date', label: 'Order date', type: 'text' },
      { name: 'status', label: 'Status', type: 'text' },
    ],
  },
  {
    entityName: 'order_items',
    label: 'Order items',
    fields: [
      { name: 'order_id', label: 'Order id', type: 'number', required: true },
      { name: 'product_id', label: 'Product id', type: 'number', required: true },
      { name: 'quantity', label: 'Quantity', type: 'number' },
      { name: 'unit_price', label: 'Unit price', type: 'number' },
    ],
  },
]

/* Get a CRM entity config by its API entityName. */
export function getCrmEntity(entityName) {
  return crmEntities.find((entity) => entity.entityName === entityName) || null
}

