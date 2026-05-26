import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import type { EntityDefinition, EntityFieldDefinition, EntityRowRecord } from '../types';
import {
  buildEmptyFormValues,
  convertFormValuesToRow,
  formValuesFromRow,
  formatCellDisplay,
  inputPropsForFieldType,
} from './entityRowFormUtils';

type EntityRowDataTableProps = {
  entity: EntityDefinition;
  rows: EntityRowRecord[];
  onCreateRow: (values: Record<string, unknown>) => Promise<void>;
  onUpdateRow: (rowId: number, values: Record<string, unknown>) => Promise<void>;
  onDeleteRow: (rowId: number) => Promise<void>;
};

type InlineFieldCellProps = {
  field: EntityFieldDefinition;
  value: string;
  onChange: (nextValue: string) => void;
  compact?: boolean;
};

// Single inline table cell input for one entity field.
function InlineFieldCell({ field, value, onChange, compact }: InlineFieldCellProps) {
  const inputProps = inputPropsForFieldType(field.field_type);

  return (
    <TextField
      size="small"
      variant="outlined"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.field_name}
      type={inputProps.type}
      inputProps={{
        inputMode: inputProps.inputMode,
        step: inputProps.step,
      }}
      sx={{
        minWidth: compact ? 100 : 120,
        '& .MuiInputBase-input': {
          py: compact ? 0.75 : 1,
          fontSize: 13,
        },
      }}
    />
  );
}

// Entity row table with inline edit and an append row for new data.
export function EntityRowDataTable({
  entity,
  rows,
  onCreateRow,
  onUpdateRow,
  onDeleteRow,
}: EntityRowDataTableProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeFields = useMemo(
    () => entity.fields.filter((field) => field.is_active !== false),
    [entity.fields],
  );

  const [tableError, setTableError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editFormValues, setEditFormValues] = useState<Record<string, string>>({});
  const [newRowFormValues, setNewRowFormValues] = useState<Record<string, string>>(() =>
    buildEmptyFormValues(activeFields),
  );

  function updateNewRowField(fieldName: string, nextValue: string) {
    setNewRowFormValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

  function updateEditField(fieldName: string, nextValue: string) {
    setEditFormValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

  function startEditingRow(row: EntityRowRecord) {
    setEditingRowId(row.id);
    setEditFormValues(formValuesFromRow(activeFields, row.values));
    setTableError('');
  }

  function cancelEditingRow() {
    setEditingRowId(null);
    setEditFormValues({});
    setTableError('');
  }

  function clearNewRowForm() {
    setNewRowFormValues(buildEmptyFormValues(activeFields));
    setTableError('');
  }

  async function handleSaveNewRow() {
    const conversion = convertFormValuesToRow(activeFields, newRowFormValues);
    if (!conversion.ok) {
      setTableError(conversion.errorMessage);
      return;
    }

    setSaving(true);
    setTableError('');
    try {
      await onCreateRow(conversion.values);
      clearNewRowForm();
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'Failed to add row');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEditedRow(rowId: number) {
    const conversion = convertFormValuesToRow(activeFields, editFormValues);
    if (!conversion.ok) {
      setTableError(conversion.errorMessage);
      return;
    }

    setSaving(true);
    setTableError('');
    try {
      await onUpdateRow(rowId, conversion.values);
      cancelEditingRow();
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'Failed to update row');
    } finally {
      setSaving(false);
    }
  }

  if (activeFields.length === 0) {
    return (
      <Alert severity="info">
        No active fields on this entity. Use Edit structure to add fields, then enter row data
        here.
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      {tableError ? <Alert severity="error">{tableError}</Alert> : null}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
            {activeFields.map((field) => (
              <TableCell key={field.id} sx={{ fontWeight: 700 }}>
                {field.field_name}
                {field.is_required ? ' *' : ''}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const isEditing = editingRowId === row.id;

            return (
              <TableRow key={row.id} hover selected={isEditing}>
                <TableCell>{row.id}</TableCell>
                {activeFields.map((field) => (
                  <TableCell key={`${row.id}-${field.field_name}`}>
                    {isEditing ? (
                      <InlineFieldCell
                        field={field}
                        value={editFormValues[field.field_name] ?? ''}
                        onChange={(nextValue) => updateEditField(field.field_name, nextValue)}
                        compact
                      />
                    ) : (
                      formatCellDisplay(row.values[field.field_name])
                    )}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <>
                      <Tooltip title="Save">
                        <span>
                          <IconButton
                            color="primary"
                            size="small"
                            disabled={saving}
                            onClick={() => void handleSaveEditedRow(row.id)}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Cancel">
                        <IconButton size="small" disabled={saving} onClick={cancelEditingRow}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip title="Record hub (360° view)">
                        <IconButton
                          size="small"
                          disabled={saving || editingRowId !== null}
                          onClick={() =>
                            navigate(`/entities/${entity.id}/rows/${row.id}`, {
                              state: location.state,
                            })
                          }
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit row">
                        <IconButton
                          size="small"
                          disabled={saving || editingRowId !== null}
                          onClick={() => startEditingRow(row)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete row">
                        <IconButton
                          color="error"
                          size="small"
                          disabled={saving || editingRowId !== null}
                          onClick={() => void onDeleteRow(row.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}

          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                New
              </Typography>
            </TableCell>
            {activeFields.map((field) => (
              <TableCell key={`new-${field.field_name}`}>
                <InlineFieldCell
                  field={field}
                  value={newRowFormValues[field.field_name] ?? ''}
                  onChange={(nextValue) => updateNewRowField(field.field_name, nextValue)}
                  compact
                />
              </TableCell>
            ))}
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <Tooltip title="Add row">
                <span>
                  <IconButton
                    color="primary"
                    size="small"
                    disabled={saving || editingRowId !== null}
                    onClick={() => void handleSaveNewRow()}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Clear">
                <IconButton
                  size="small"
                  disabled={saving || editingRowId !== null}
                  onClick={clearNewRowForm}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Typography variant="caption" color="text.secondary">
        Type values in the bottom row and click + to add. Use edit on existing rows to change data
        inline.
      </Typography>
    </Stack>
  );
}
