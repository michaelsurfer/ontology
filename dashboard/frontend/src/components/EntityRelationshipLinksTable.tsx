import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { ResolvedRelationshipLink } from './entityRelationshipLinksUtils';

type EntityRelationshipLinksTableProps = {
  links: ResolvedRelationshipLink[];
};

// Readable table: Subject | Relationship | Object.
export function EntityRelationshipLinksTable({ links }: EntityRelationshipLinksTableProps) {
  if (links.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No row links yet.{' '}
        <Link component={RouterLink} to="/relationships">
          Create links on Row links
        </Link>
        .
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>Relationship</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>Object</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {links.map((link) => (
          <TableRow key={link.recordId} hover>
            <TableCell>{link.subjectLabel}</TableCell>
            <TableCell>{link.relationshipName}</TableCell>
            <TableCell>{link.objectLabel}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
