import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { apiClient, LONG_RUNNING_AI_TIMEOUT_MS } from '../api/apiClient'

/* Convert an Axios-style error into a readable string. */
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

/* Merge PUT /api/ai/plan/prompt response into prompt panel state. */
function mergePromptPutResponse(previousInfo, data) {
  const safePrevious = previousInfo && typeof previousInfo === 'object' ? previousInfo : {}
  const row = data?.row && typeof data.row === 'object' ? data.row : null
  return {
    ...safePrevious,
    plannerSystemPrompt: data?.plannerSystemPrompt ?? safePrevious.plannerSystemPrompt,
    defaultPlannerSystemPrompt: data?.defaultPlannerSystemPrompt ?? safePrevious.defaultPlannerSystemPrompt,
    finalizePromptAppend: data?.finalizePromptAppend ?? safePrevious.finalizePromptAppend,
    finalizeSystemPromptCombined: data?.finalizeSystemPromptCombined ?? safePrevious.finalizeSystemPromptCombined,
    storedPlannerSystemPrompt: row?.planner_system_prompt ?? safePrevious.storedPlannerSystemPrompt,
    updatedAt: row?.updated_at ?? safePrevious.updatedAt,
  }
}

/* Derive a readable list of graph-query steps from the planner trace for the approval step. */
function plannedActionsFromTrace(traceSteps) {
  if (!Array.isArray(traceSteps) || traceSteps.length === 0) {
    return []
  }
  return traceSteps.map((step, index) => ({
    key: `step-${step.step ?? index}`,
    stepLabel: step.step ?? index + 1,
    question: step.question ? String(step.question).trim() : '',
    reason: step.reason ? String(step.reason).trim() : '',
    rowCount: Number.isFinite(step.rowCount) ? step.rowCount : 0,
    queryOk: step.ok !== false,
    queryError: step.error ? String(step.error) : '',
  }))
}

/* AI Planning page: looping planner that calls the SPARQL skill to gather facts, then proposes a plan. */
export function AiPlanningPage() {
  const [goalText, setGoalText] = useState('')
  const [maxIterations, setMaxIterations] = useState(5)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [promptInfo, setPromptInfo] = useState(null)
  const [promptLoadError, setPromptLoadError] = useState('')
  const [draftPlannerPrompt, setDraftPlannerPrompt] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [promptSaveError, setPromptSaveError] = useState('')
  const [planAnswerRevealed, setPlanAnswerRevealed] = useState(false)
  const scrollAnchorRef = useRef(null)

  /* Load planner system prompt from the API (matches ai_planning_settings in the database). */
  useEffect(() => {
    let cancelled = false
    async function loadPrompts() {
      setPromptLoadError('')
      try {
        const response = await apiClient.get('/ai/plan/prompt')
        const data = response.data && typeof response.data === 'object' ? response.data : null
        if (!cancelled) {
          setPromptInfo(data)
          if (data?.plannerSystemPrompt !== undefined && data.plannerSystemPrompt !== null) {
            setDraftPlannerPrompt(String(data.plannerSystemPrompt))
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPromptLoadError(getErrorMessage(error))
          setPromptInfo(null)
        }
      }
    }
    void loadPrompts()
    return () => {
      cancelled = true
    }
  }, [])

  /* Persist edited planner system prompt to the database. */
  async function savePlannerPrompt() {
    const text = String(draftPlannerPrompt || '').trim()
    if (!text) {
      setPromptSaveError('Planner system prompt cannot be empty.')
      return
    }
    setPromptSaveError('')
    setIsSavingPrompt(true)
    try {
      const response = await apiClient.put('/ai/plan/prompt', { plannerSystemPrompt: text })
      const data = response.data || {}
      setPromptInfo((previous) => mergePromptPutResponse(previous, data))
      if (data.plannerSystemPrompt !== undefined) {
        setDraftPlannerPrompt(String(data.plannerSystemPrompt))
      }
    } catch (error) {
      setPromptSaveError(getErrorMessage(error))
    } finally {
      setIsSavingPrompt(false)
    }
  }

  /* Reload prompt text from the server (discard unsaved edits). */
  async function revertPlannerDraft() {
    setPromptSaveError('')
    setIsSavingPrompt(true)
    try {
      const response = await apiClient.get('/ai/plan/prompt')
      const data = response.data && typeof response.data === 'object' ? response.data : null
      setPromptInfo(data)
      if (data?.plannerSystemPrompt !== undefined && data.plannerSystemPrompt !== null) {
        setDraftPlannerPrompt(String(data.plannerSystemPrompt))
      }
    } catch (error) {
      setPromptLoadError(getErrorMessage(error))
    } finally {
      setIsSavingPrompt(false)
    }
  }

  const traceSteps = useMemo(() => {
    if (!lastResult || !Array.isArray(lastResult.trace)) {
      return []
    }
    return lastResult.trace
  }, [lastResult])

  const plannedActionItems = useMemo(() => plannedActionsFromTrace(traceSteps), [traceSteps])

  function scrollToBottom() {
    const element = scrollAnchorRef.current
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  async function runPlanning() {
    const normalizedGoal = String(goalText || '').trim()
    if (!normalizedGoal || isLoading) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setLastResult(null)
    setPlanAnswerRevealed(false)

    try {
      const response = await apiClient.post(
        '/ai/plan',
        {
          goal: normalizedGoal,
          max_iterations: maxIterations,
          includeOntology: true,
          includeData: true,
          maxRowsPerEntity: 200,
        },
        { timeout: LONG_RUNNING_AI_TIMEOUT_MS },
      )

      setLastResult(response.data || {})
      setTimeout(scrollToBottom, 50)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const planText = lastResult?.planText ? String(lastResult.planText) : ''
  const stoppedReason = lastResult?.stoppedReason ? String(lastResult.stoppedReason) : ''
  const ok = lastResult?.ok === true

  return (
    <Stack spacing={2}>
      <Typography variant="h5">AI Planning</Typography>
      <Typography variant="body2" color="text.secondary">
        Describe an operational goal. The planner queries your ontology (via the SPARQL skill) in a loop. When it
        finishes successfully, you first see the planned graph lookups, approve them, then read the written answer.
        Technical SPARQL detail stays under an expandable trace. This does not save missions or waypoints unless you
        add them elsewhere.
      </Typography>

      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Current planner prompts</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {promptLoadError ? (
              <Typography color="error" variant="body2">
                {promptLoadError}
              </Typography>
            ) : null}
            {promptInfo?.updatedAt ? (
              <Typography variant="caption" color="text.secondary">
                Stored prompt last updated: {String(promptInfo.updatedAt)}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              Edit the system prompt below and click Save to store it in the database. The planner reads this text on
              each run. Graph lookups still use the Query Studio NL→SPARQL skill.
            </Typography>
            {promptSaveError ? (
              <Typography color="error" variant="body2">
                {promptSaveError}
              </Typography>
            ) : null}
            <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => void savePlannerPrompt()}
                disabled={isSavingPrompt || !promptInfo}
              >
                {isSavingPrompt ? 'Saving…' : 'Save prompt'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => void revertPlannerDraft()}
                disabled={isSavingPrompt || !promptInfo}
              >
                Reload from server
              </Button>
            </Box>
            <TextField
              label="Planner system prompt (editable)"
              value={draftPlannerPrompt}
              onChange={(event) => setDraftPlannerPrompt(event.target.value)}
              multiline
              minRows={8}
              fullWidth
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
              placeholder={promptInfo ? 'Enter system prompt…' : 'Loading…'}
            />
            <TextField
              label="Append when max iterations reached"
              value={
                promptInfo?.finalizePromptAppend ? String(promptInfo.finalizePromptAppend) : ''
              }
              multiline
              minRows={3}
              fullWidth
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11 } }}
            />
            {promptInfo?.userIterationPayloadShape ? (
              <Typography variant="caption" color="text.secondary">
                Iteration user payload: {String(promptInfo.userIterationPayloadShape)}
              </Typography>
            ) : null}
            {promptInfo?.userFinalizePayloadShape ? (
              <Typography variant="caption" color="text.secondary">
                Finalize user payload: {String(promptInfo.userFinalizePayloadShape)}
              </Typography>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Planning goal"
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              placeholder='Example: "Plan a short corridor survey using existing platforms and policies"'
              fullWidth
              multiline
              minRows={3}
            />

            <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Max graph queries"
                type="number"
                size="small"
                value={maxIterations}
                onChange={(event) => setMaxIterations(Number(event.target.value))}
                inputProps={{ min: 1, max: 10 }}
                sx={{ width: 180 }}
              />
              <Button variant="contained" onClick={() => void runPlanning()} disabled={isLoading}>
                {isLoading ? 'Planning…' : 'Run planner'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {lastResult ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="subtitle1">Result</Typography>
                <Typography variant="caption" color="text.secondary">
                  {stoppedReason ? `Stopped: ${stoppedReason}` : ''}
                </Typography>
                <Typography variant="caption" color={ok ? 'success.main' : 'error'}>
                  {ok ? 'ok' : 'not ok'}
                </Typography>
              </Box>

              {lastResult.error ? (
                <Typography color="error" variant="body2">
                  {String(lastResult.error)}
                </Typography>
              ) : null}

              {lastResult.partialPlanHint ? (
                <Typography variant="body2" color="text.secondary">
                  {String(lastResult.partialPlanHint)}
                </Typography>
              ) : null}

              {ok ? (
                <>
                  {!planAnswerRevealed ? (
                    <>
                      <Divider />
                      <Typography variant="subtitle2">Planned actions</Typography>
                      <Typography variant="body2" color="text.secondary">
                        The planner ran these graph lookups (via NL→SPARQL). Review them, then approve to see the
                        written answer for your goal.
                      </Typography>
                      {plannedActionItems.length === 0 ? (
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px dashed',
                            borderColor: 'divider',
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            No intermediate graph queries were recorded in the trace (the planner may have answered
                            directly). Approve below to show the synthesized answer.
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={1.5}>
                          {plannedActionItems.map((item) => (
                            <Box
                              key={item.key}
                              sx={{
                                p: 1.5,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                bgcolor: 'background.default',
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                Step {item.stepLabel}
                                {!item.queryOk ? ' • query issue' : ''}
                              </Typography>
                              {item.question ? (
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                  {item.question}
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  (no question text)
                                </Typography>
                              )}
                              {item.reason ? (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                  Reason: {item.reason}
                                </Typography>
                              ) : null}
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                Rows returned: {item.rowCount}
                                {item.queryError ? ` • ${item.queryError}` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1, pt: 0.5 }}>
                        <Button
                          variant="contained"
                          onClick={() => {
                            setPlanAnswerRevealed(true)
                            setTimeout(scrollToBottom, 50)
                          }}
                        >
                          Approve and show answer
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Divider />
                      <Typography variant="subtitle2">Answer</Typography>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.default',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <Typography variant="body2">{planText || '(no plan text)'}</Typography>
                      </Box>

                      {lastResult.caveats ? (
                        <>
                          <Typography variant="subtitle2">Caveats</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                            {String(lastResult.caveats)}
                          </Typography>
                        </>
                      ) : null}

                      {Array.isArray(lastResult.assumptions) && lastResult.assumptions.length > 0 ? (
                        <>
                          <Typography variant="subtitle2">Assumptions</Typography>
                          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            {lastResult.assumptions.map((item, index) => (
                              <Typography component="li" variant="body2" key={`${index}:${item}`}>
                                {String(item)}
                              </Typography>
                            ))}
                          </Box>
                        </>
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Plan</Typography>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <Typography variant="body2">{planText || '(no plan text)'}</Typography>
                  </Box>
                </>
              )}

              <Accordion defaultExpanded={false}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Planner trace — technical detail ({traceSteps.length} steps)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {traceSteps.map((step, index) => (
                      <Box
                        key={`trace-${step.step ?? index}`}
                        sx={{
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Step {step.step ?? index + 1}
                          {step.ok === false ? ' • query failed' : ''}
                        </Typography>
                        {step.question ? (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Q: {String(step.question)}
                          </Typography>
                        ) : null}
                        {step.reason ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Reason: {String(step.reason)}
                          </Typography>
                        ) : null}
                        {step.sparqlText ? (
                          <TextField
                            value={String(step.sparqlText)}
                            multiline
                            minRows={4}
                            fullWidth
                            size="small"
                            sx={{ mt: 1 }}
                            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
                          />
                        ) : null}
                        <Typography variant="caption" color="text.secondary">
                          Rows: {Number.isFinite(step.rowCount) ? step.rowCount : 0} •{' '}
                          {Number.isFinite(step.executionTimeMs) ? `${step.executionTimeMs}ms` : ''}
                        </Typography>
                        {step.error ? (
                          <Typography variant="caption" color="error">
                            {String(step.error)}
                          </Typography>
                        ) : null}
                        <TextField
                          value={JSON.stringify(step.rowsSample || [], null, 2)}
                          multiline
                          minRows={4}
                          fullWidth
                          size="small"
                          InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11 } }}
                          label="Row sample"
                        />
                      </Box>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <div ref={scrollAnchorRef} />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  )
}
