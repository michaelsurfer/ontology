import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

type PlaybookInstructionsDialogProps = {
  open: boolean;
  playbookName: string;
  instructions: string;
  onClose: () => void;
};

// Show playbook usage instructions for operators.
export function PlaybookInstructionsDialog({
  open,
  playbookName,
  instructions,
  onClose,
}: PlaybookInstructionsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Instruction — {playbookName}</DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          component="div"
          sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', mt: 0.5 }}
        >
          {instructions}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
