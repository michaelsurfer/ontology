import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export type RelatedRecordRow = {
  linkId: number;
  relationshipName: string;
  direction: 'outgoing' | 'incoming';
  relatedEntityId: number;
  relatedEntityName: string;
  relatedEntityDisplayName: string;
  relatedRowId: number;
  relatedRowLabel: string;
};

type RelatedRecordsPanelProps = {
  relatedRows: RelatedRecordRow[];
};

// List row links from the anchor record with navigation to other record hubs.
export function RelatedRecordsPanel({ relatedRows }: RelatedRecordsPanelProps) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ overflowX: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Related records ({relatedRows.length})
        </Typography>

        {relatedRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No row links yet. Links are created by ingest workflows or on the Row links page.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Relationship</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Direction</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Record type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Record</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relatedRows.map((relatedRow) => (
                <TableRow key={`${relatedRow.linkId}-${relatedRow.direction}`} hover>
                  <TableCell>{relatedRow.relationshipName}</TableCell>
                  <TableCell>{relatedRow.direction === 'outgoing' ? '→ outgoing' : '← incoming'}</TableCell>
                  <TableCell>
                    {relatedRow.relatedEntityDisplayName || relatedRow.relatedEntityName}
                  </TableCell>
                  <TableCell>{relatedRow.relatedRowLabel}</TableCell>
                  <TableCell align="right">
                    <Button
                      component={RouterLink}
                      to={`/entities/${relatedRow.relatedEntityId}/rows/${relatedRow.relatedRowId}`}
                      size="small"
                      variant="outlined"
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
