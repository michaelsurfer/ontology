import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { PageHeader } from '../components/PageHeader';
import { ontologyApi, readApiErrorMessage } from '../api/client';

type TemplateDetailField = {
  field_name: string;
  field_type: string;
  is_required?: boolean;
  description?: string;
  example?: string;
};

type TemplateDetailEntity = {
  name: string;
  display_name?: string;
  fields: TemplateDetailField[];
};

type TemplateDetailEntityRelationship = {
  ref: string;
  relationship_name: string;
  subject_entity_name: string;
  object_entity_name: string;
};

type TemplateDetailWorkflow = {
  name: string;
  description?: string;
  pipelineSteps: string[];
};

type TemplateDetail = {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  installed: boolean;
  entities: TemplateDetailEntity[];
  entityRelationships: TemplateDetailEntityRelationship[];
  workflows: TemplateDetailWorkflow[];
};

// Detail page for an uninstalled (or installed) template pack before/after install.
export function TemplateDetailPage() {
  const { templateId = '' } = useParams();
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    void loadTemplateDetail();
  }, [templateId]);

  async function loadTemplateDetail() {
    if (!templateId) {
      setErrorMessage('Template id is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const response = await ontologyApi.getTemplate(templateId);
      setTemplateDetail(response.data);
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
      setTemplateDetail(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleInstall() {
    if (!templateId) {
      return;
    }

    setInstalling(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const response = await ontologyApi.installTemplate(templateId);
      const createdEntities = response.data.entities.filter((row) => row.created).length;
      const createdWorkflows = response.data.workflows.filter((row) => row.created).length;
      setSuccessMessage(
        `Installed "${response.data.templateName}": ${createdEntities} new record type(s), ${createdWorkflows} new workflow(s).`,
      );
      await loadTemplateDetail();
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error));
    } finally {
      setInstalling(false);
    }
  }

  if (loading) {
    return <Typography color="text.secondary">Loading template…</Typography>;
  }

  if (!templateDetail) {
    return (
      <Stack spacing={2}>
        <Button component={RouterLink} to="/templates" startIcon={<ArrowBackIcon />} sx={{ alignSelf: 'flex-start' }}>
          Back to templates
        </Button>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>
    );
  }

  const displayNameByEntityName = new Map(
    templateDetail.entities.map((entity) => [
      entity.name,
      entity.display_name || entity.name,
    ]),
  );

  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/templates"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Back to templates
      </Button>

      <PageHeader
        title={templateDetail.name}
        subtitle={templateDetail.description}
        actions={
          templateDetail.installed ? (
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Chip
                color="success"
                icon={<CheckCircleOutlineIcon />}
                label="Installed"
                size="small"
              />
              <Button variant="contained" component={RouterLink} to="/templates">
                View on templates list
              </Button>
            </Stack>
          ) : (
            <Button
              variant="contained"
              onClick={() => void handleInstall()}
              disabled={installing}
              startIcon={installing ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {installing ? 'Installing…' : 'Install'}
            </Button>
          )
        }
      />

      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {templateDetail.instructions ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Getting started
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: 'pre-wrap' }}
            >
              {templateDetail.instructions}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <StorageOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Record types ({templateDetail.entities.length})
            </Typography>
          </Stack>
          <Stack spacing={3} divider={<Divider flexItem />}>
            {templateDetail.entities.map((entity) => (
              <Box key={entity.name}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {entity.display_name || entity.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Internal name: {entity.name}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Field</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Required</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entity.fields.map((field) => (
                      <TableRow key={field.field_name}>
                        <TableCell>{field.field_name}</TableCell>
                        <TableCell>{field.field_type}</TableCell>
                        <TableCell>{field.is_required ? 'Yes' : '—'}</TableCell>
                        <TableCell>
                          {field.description || '—'}
                          {field.example ? (
                            <Typography variant="caption" display="block" color="text.secondary">
                              e.g. {field.example}
                            </Typography>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <HubOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Schema relationships ({templateDetail.entityRelationships.length})
            </Typography>
          </Stack>
          {templateDetail.entityRelationships.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              This template does not define schema-level relationships.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {templateDetail.entityRelationships.map((relationship) => (
                <Box key={relationship.ref}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {relationship.relationship_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {displayNameByEntityName.get(relationship.subject_entity_name) ||
                      relationship.subject_entity_name}{' '}
                    →{' '}
                    {displayNameByEntityName.get(relationship.object_entity_name) ||
                      relationship.object_entity_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ref: {relationship.ref}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <TimelineOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Workflows ({templateDetail.workflows.length})
            </Typography>
          </Stack>
          <Stack spacing={3} divider={<Divider flexItem />}>
            {templateDetail.workflows.map((workflow) => (
              <Box key={workflow.name}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {workflow.name}
                </Typography>
                {workflow.description ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {workflow.description}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Pipeline
                </Typography>
                <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
                  {workflow.pipelineSteps.map((step, stepIndex) => (
                    <Typography component="li" variant="body2" key={`${workflow.name}-${stepIndex}`}>
                      {step}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {!templateDetail.installed ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => void handleInstall()}
            disabled={installing}
            startIcon={installing ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {installing ? 'Installing…' : 'Install template'}
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
