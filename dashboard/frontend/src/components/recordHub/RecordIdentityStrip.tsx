import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { EntityFieldDefinition } from '../../types';
import { formatCellDisplay } from '../entityRowFormUtils';

type RecordIdentityStripProps = {
  identifierFields: EntityFieldDefinition[];
  rowValues: Record<string, unknown>;
};

// Highlight identifier fields at the top of the record hub.
export function RecordIdentityStrip({ identifierFields, rowValues }: RecordIdentityStripProps) {
  if (identifierFields.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No identifier field on this record type. Mark one field as identifier in Edit structure
            to highlight business keys here.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Identity
        </Typography>
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={3}
          sx={{ rowGap: 1.5, columnGap: 3 }}
        >
          {identifierFields.map((field) => (
            <Stack key={field.id} spacing={0.25} sx={{ minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary">
                {field.field_name}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {formatCellDisplay(rowValues[field.field_name]) || '—'}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
