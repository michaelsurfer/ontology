import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { EntityFieldDefinition } from '../types';

type EntityFieldsMetadataTableProps = {
  fields: EntityFieldDefinition[];
};

// Read-only table of entity fields including AI extraction metadata.
export function EntityFieldsMetadataTable({ fields }: EntityFieldsMetadataTableProps) {
  const activeFields = fields.filter((field) => field.is_active !== false);

  if (activeFields.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No active fields defined.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Field</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Flags</TableCell>
          <TableCell>Description</TableCell>
          <TableCell>Example</TableCell>
          <TableCell>Extraction hint</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {activeFields.map((field) => (
          <TableRow key={field.id} hover>
            <TableCell sx={{ fontWeight: 600 }}>{field.field_name}</TableCell>
            <TableCell>{field.field_type}</TableCell>
            <TableCell>
              {field.is_required ? (
                <Chip label="Required" size="small" sx={{ mr: 0.5, mb: 0.5 }} />
              ) : null}
              {field.is_identifier ? (
                <Chip label="Identifier" size="small" color="primary" sx={{ mr: 0.5, mb: 0.5 }} />
              ) : null}
            </TableCell>
            <TableCell sx={{ maxWidth: 200 }}>{field.description || '—'}</TableCell>
            <TableCell sx={{ maxWidth: 160 }}>{field.example || '—'}</TableCell>
            <TableCell sx={{ maxWidth: 220 }}>{field.extraction_hint || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
