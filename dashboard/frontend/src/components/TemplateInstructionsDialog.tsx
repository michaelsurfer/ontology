import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

type TemplateInstructionsDialogProps = {
  open: boolean;
  templateName: string;
  instructions: string;
  onClose: () => void;
};

// Show template usage instructions for operators.
export function TemplateInstructionsDialog({
  open,
  templateName,
  instructions,
  onClose,
}: TemplateInstructionsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Instruction — {templateName}</DialogTitle>
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
