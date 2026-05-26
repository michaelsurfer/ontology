import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { PolicyRoleDefinition } from '../types';

type FieldReadRoleSelectProps = {
  availableRoles: PolicyRoleDefinition[];
  selectedRoleId: string;
  onChange: (nextRoleId: string) => void;
  disabled?: boolean;
};

// Single-select dropdown for choosing one OSS role that may read an entity field.
export function FieldReadRoleSelect({
  availableRoles,
  selectedRoleId,
  onChange,
  disabled = false,
}: FieldReadRoleSelectProps) {
  return (
    <FormControl
      size="small"
      sx={{ minWidth: 200, flex: '0 0 200px', m: 0 }}
      disabled={disabled}
    >
      <InputLabel id="field-read-role-label">Visible to role</InputLabel>
      <Select
        labelId="field-read-role-label"
        label="Visible to role"
        value={selectedRoleId}
        onChange={(changeEvent) => onChange(String(changeEvent.target.value))}
      >
        <MenuItem value="">
          <em>All roles</em>
        </MenuItem>
        {availableRoles.map((role) => (
          <MenuItem key={role.id} value={role.id}>
            {role.display_name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
