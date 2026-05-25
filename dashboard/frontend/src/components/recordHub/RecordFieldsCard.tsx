import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { EntityFieldDefinition } from '../../types';
import { formatCellDisplay } from '../entityRowFormUtils';

type RecordFieldsCardProps = {
  fields: EntityFieldDefinition[];
  rowValues: Record<string, unknown>;
};

// Show non-identifier active fields for the anchor record.
export function RecordFieldsCard({ fields, rowValues }: RecordFieldsCardProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Fields
        </Typography>
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={3}
          sx={{ rowGap: 1.5, columnGap: 3 }}
        >
          {fields.map((field) => (
            <Stack key={field.id} spacing={0.25} sx={{ minWidth: 160, maxWidth: 320 }}>
              <Typography variant="caption" color="text.secondary">
                {field.field_name}
                {field.is_required ? ' *' : ''}
              </Typography>
              <Typography variant="body2">{formatCellDisplay(rowValues[field.field_name]) || '—'}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
