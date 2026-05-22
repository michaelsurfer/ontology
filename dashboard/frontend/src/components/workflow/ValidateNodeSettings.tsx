import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { FieldValidationFormat, FieldValidationRule } from '../../types/workflow';

const validationFormatOptions: Array<{ value: FieldValidationFormat; label: string }> = [
  { value: 'required', label: 'Required (non-empty)' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number (decimal)' },
  { value: 'integer', label: 'Integer (whole number)' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date (YYYY-MM-DD)' },
];

type ValidateNodeSettingsProps = {
  rules: FieldValidationRule[];
  onUpdate: (patch: Record<string, unknown>) => void;
};

// Build a new empty validation rule for the editor.
function createEmptyValidationRule(): FieldValidationRule {
  return {
    jsonField: '',
    format: 'required',
    minValue: null,
    maxValue: null,
  };
}

// Validate / Quality gate node configuration in the workflow editor.
export function ValidateNodeSettings({ rules, onUpdate }: ValidateNodeSettingsProps) {
  function updateRuleAtIndex(index: number, patch: Partial<FieldValidationRule>) {
    const nextRules = rules.map((rule, ruleIndex) =>
      ruleIndex === index ? { ...rule, ...patch } : rule,
    );
    onUpdate({ rules: nextRules });
  }

  function addValidationRule() {
    onUpdate({ rules: [...rules, createEmptyValidationRule()] });
  }

  function removeRuleAtIndex(index: number) {
    onUpdate({ rules: rules.filter((_rule, ruleIndex) => ruleIndex !== index) });
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Define rules on incoming JSON fields. Records that fail any rule follow the{' '}
        <strong>failure</strong> output (connect to Fallback or another handler). Passing records
        use the <strong>success</strong> output.
      </Typography>

      <Alert severity="info" sx={{ py: 0.5 }}>
        Connect the <strong>failure</strong> handle (lower right) to Fallback for quarantine.
      </Alert>

      {rules.length === 0 ? (
        <Alert severity="warning">No validation rules yet. Add at least one rule.</Alert>
      ) : null}

      {rules.map((rule, index) => {
        const showRange = rule.format === 'number' || rule.format === 'integer';

        return (
          <Box
            key={`validation-rule-${index}`}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Rule {index + 1}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  aria-label="Remove rule"
                  onClick={() => removeRuleAtIndex(index)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>

              <TextField
                label="JSON field"
                size="small"
                fullWidth
                value={rule.jsonField}
                onChange={(event) => updateRuleAtIndex(index, { jsonField: event.target.value })}
                placeholder="email"
              />

              <TextField
                select
                label="Format"
                size="small"
                fullWidth
                value={rule.format}
                onChange={(event) =>
                  updateRuleAtIndex(index, {
                    format: event.target.value as FieldValidationFormat,
                    minValue: null,
                    maxValue: null,
                  })
                }
              >
                {validationFormatOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              {showRange ? (
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Min"
                    size="small"
                    type="number"
                    fullWidth
                    value={rule.minValue ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      updateRuleAtIndex(index, {
                        minValue: raw === '' ? null : Number(raw),
                      });
                    }}
                  />
                  <TextField
                    label="Max"
                    size="small"
                    type="number"
                    fullWidth
                    value={rule.maxValue ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      updateRuleAtIndex(index, {
                        maxValue: raw === '' ? null : Number(raw),
                      });
                    }}
                  />
                </Stack>
              ) : null}
            </Stack>
          </Box>
        );
      })}

      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addValidationRule}>
        Add rule
      </Button>
    </Stack>
  );
}
