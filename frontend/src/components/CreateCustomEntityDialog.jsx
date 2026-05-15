import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { apiClient } from '../api/apiClient'
import {
  createEmptyEntityForm,
  createEmptyField,
  getEntityNameErrorText,
  getFieldNameErrorText,
} from '../customEntities/customEntityFormShared.js'

/* Reusable create-object dialog used by Objects and Landing zone (POST /api/custom-entities). */
export function CreateCustomEntityDialog({ open, onClose, entities, initialFormData, onCreated }) {
  const theme = useTheme()
  const isSmallViewport = useMediaQuery(theme.breakpoints.down('md'))

  const [formData, setFormData] = useState(createEmptyEntityForm())
  const [submitError, setSubmitError] = useState('')
  const hasUserCustomizedDisplayNameRef = useRef(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setSubmitError('')
    const isPlainObject =
      initialFormData &&
      typeof initialFormData === 'object' &&
      !Array.isArray(initialFormData)
    if (isPlainObject) {
      const cloned = JSON.parse(JSON.stringify(initialFormData))
      setFormData(cloned)
      const entityName = String(cloned.entity_name || '')
      const displayName = String(cloned.display_name || '')
      hasUserCustomizedDisplayNameRef.current = displayName.trim() !== entityName.trim()
    } else {
      setFormData(createEmptyEntityForm())
      hasUserCustomizedDisplayNameRef.current = false
    }
  }, [open, initialFormData])

  useEffect(() => {
    if (!open) {
      return
    }
    const entityName = String(formData.entity_name || '')
    const displayName = String(formData.display_name || '')
    hasUserCustomizedDisplayNameRef.current = displayName !== entityName
  }, [open, formData.entity_name, formData.display_name])

  const canCreate = useMemo(() => {
    const entityNameErrorText = getEntityNameErrorText({
      entityName: formData.entity_name,
      existingEntities: entities,
    })
    if (entityNameErrorText) {
      return false
    }
    if (!formData.entity_name.trim()) {
      return false
    }
    if (!formData.display_name.trim()) {
      return false
    }
    if (formData.fields.length === 0) {
      return false
    }
    if (formData.fields.some((field) => !field.field_name.trim())) {
      return false
    }
    if (formData.fields.some((field) => getFieldNameErrorText(field.field_name))) {
      return false
    }
    const fieldNames = formData.fields.map((field) =>
      String(field.field_name || '').trim().toLowerCase(),
    )
    if (new Set(fieldNames).size !== fieldNames.length) {
      return false
    }
    return true
  }, [formData, entities])

  const entityNameErrorText = useMemo(() => {
    return getEntityNameErrorText({ entityName: formData.entity_name, existingEntities: entities })
  }, [formData.entity_name, entities])

  function handleClose() {
    setFormData(createEmptyEntityForm())
    hasUserCustomizedDisplayNameRef.current = false
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      fullScreen={isSmallViewport}
      maxWidth="lg"
      scroll="paper"
      PaperProps={{ sx: { maxHeight: isSmallViewport ? '100%' : '90vh' } }}
    >
      <DialogTitle>Create custom entity</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {submitError ? (
          <Typography color="error" variant="body2">
            {submitError}
          </Typography>
        ) : null}
        <TextField
          label="Entity name (table name)"
          value={formData.entity_name}
          onChange={(event) => {
            const newEntityName = event.target.value
            setFormData((previous) => ({
              ...previous,
              entity_name: newEntityName,
              display_name: hasUserCustomizedDisplayNameRef.current
                ? previous.display_name
                : newEntityName,
            }))
          }}
          error={Boolean(entityNameErrorText)}
          helperText={entityNameErrorText || 'Must match: /^[a-z][a-z0-9_]*$/ (example: "projects")'}
          required
        />
        <TextField
          label="Display name"
          value={formData.display_name}
          onChange={(event) => {
            hasUserCustomizedDisplayNameRef.current = true
            setFormData((previous) => ({ ...previous, display_name: event.target.value }))
          }}
          required
        />

        <Divider />

        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Fields
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                fields: [...prev.fields, createEmptyField()],
              }))
            }
          >
            Add field
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary">
          System fields are created automatically: <b>id</b> (INTEGER, auto-increment). You do not need to add it and you
          cannot edit or delete it.
        </Typography>

        <Stack
          spacing={1}
          sx={{
            maxHeight: isSmallViewport ? 'unset' : 520,
            overflowY: isSmallViewport ? 'visible' : 'auto',
            pr: isSmallViewport ? 0 : 1,
          }}
        >
          {formData.fields.map((field, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                py: 1,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <TextField
                label="Field name"
                value={field.field_name}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    fields: prev.fields.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, field_name: event.target.value } : item,
                    ),
                  }))
                }
                sx={{ flex: '1 1 240px' }}
                placeholder="example: account_id"
                required
                error={Boolean(getFieldNameErrorText(field.field_name))}
                helperText={
                  getFieldNameErrorText(field.field_name) ||
                  'Must match: /^[a-z][a-z0-9_]*$/ (lowercase snake_case)'
                }
              />

              <TextField
                select
                label="Type"
                value={field.field_type}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    fields: prev.fields.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, field_type: event.target.value } : item,
                    ),
                  }))
                }
                sx={{ width: 200 }}
              >
                <MenuItem value="TEXT">TEXT</MenuItem>
                <MenuItem value="INTEGER">INTEGER</MenuItem>
                <MenuItem value="REAL">REAL</MenuItem>
              </TextField>

              <TextField
                select
                label="Required"
                value={field.is_required ? 'yes' : 'no'}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    fields: prev.fields.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, is_required: event.target.value === 'yes' } : item,
                    ),
                  }))
                }
                sx={{ width: 160 }}
              >
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>

              <IconButton
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    fields: prev.fields.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canCreate}
          onClick={() =>
            void submitCreateEntity({
              formData,
              onCreated,
              handleClose,
              setSubmitError,
            })
          }
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* POST /api/custom-entities then notify parent. */
async function submitCreateEntity({ formData, onCreated, handleClose, setSubmitError }) {
  setSubmitError('')
  try {
    await apiClient.post('/custom-entities', formData)
    if (typeof onCreated === 'function') {
      await onCreated()
    }
    handleClose()
  } catch (error) {
    setSubmitError(getErrorMessage(error))
  }
}

/* Convert an Axios error into a readable string. */
function getErrorMessage(error) {
  if (error && typeof error === 'object') {
    const response = error.response
    if (response && response.data && typeof response.data === 'object' && response.data.error) {
      return String(response.data.error)
    }
    if (error.message) {
      return String(error.message)
    }
  }
  return 'Request failed'
}
