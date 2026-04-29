import React, { useMemo } from 'react'
import { Box, Card, CardContent, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'

/* Show dashboard metrics for product demos. */
export function DashboardPage() {
  const dashboardData = useMemo(() => {
    return createFakeDashboardData()
  }, [])

  const violationsMaxValue = useMemo(() => {
    return Math.max(1, ...dashboardData.governance.violationsSeries.map((item) => item.count))
  }, [dashboardData])

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0.2 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Demo metrics. Hook this up to the backend later.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Basic data
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
            <MetricCard label="Objects" value={dashboardData.basic.objectsCount} helperText="Total object types" />
            <MetricCard
              label="Relationships"
              value={dashboardData.basic.relationshipsCount}
              helperText="Total relationship definitions"
            />
            <MetricCard
              label="AI token usage"
              value={formatNumber(dashboardData.basic.aiTokensUsed)}
              helperText="Tokens used (last 30 days)"
            />
            <MetricCard label="Users" value={dashboardData.basic.usersCount} helperText="Active users" />
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Governance data
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <Card variant="outlined" sx={{ flex: '1 1 360px' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Violations over time
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Count of guardrail violations detected per day.
                </Typography>

                <Sparkline
                  values={dashboardData.governance.violationsSeries.map((item) => item.count)}
                  maxValue={violationsMaxValue}
                />

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {dashboardData.governance.violationsSeries.slice(-7).map((item) => (
                    <Box
                      key={item.date}
                      sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {item.date}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {item.count}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: '2 1 520px' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  AI query log
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Recent AI questions and outcomes.
                </Typography>

                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Question</TableCell>
                        <TableCell align="right">Tokens</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboardData.governance.aiQueryLogs.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.time}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.user}</TableCell>
                          <TableCell sx={{ minWidth: 280 }}>{row.question}</TableCell>
                          <TableCell align="right">{formatNumber(row.tokens)}</TableCell>
                          <TableCell>
                            <StatusPill status={row.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: '1 1 320px' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Errors
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  System and query errors.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
                  <MetricCard label="Errors (24h)" value={dashboardData.governance.errorsLast24Hours} helperText="Total" />
                  <MetricCard label="Errors (7d)" value={dashboardData.governance.errorsLast7Days} helperText="Total" />
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {dashboardData.governance.recentErrors.map((item) => (
                    <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.time} · {item.source}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  )
}

/* Render a small metric card. */
function MetricCard({ label, value, helperText }) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 220px' }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.25 }}>
          {value}
        </Typography>
        {helperText ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {helperText}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

/* Render a simple status pill (no external deps). */
function StatusPill({ status }) {
  const normalizedStatus = String(status || '').toLowerCase()
  const isOk = normalizedStatus === 'ok'
  const isWarning = normalizedStatus === 'warning'

  const backgroundColor = isOk ? 'rgba(34, 197, 94, 0.12)' : isWarning ? 'rgba(245, 158, 11, 0.16)' : 'rgba(239, 68, 68, 0.12)'
  const foregroundColor = isOk ? '#166534' : isWarning ? '#92400e' : '#991b1b'

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 99,
        bgcolor: backgroundColor,
        color: foregroundColor,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {String(status || 'unknown')}
    </Box>
  )
}

/* Render a tiny sparkline using SVG. */
function Sparkline({ values, maxValue }) {
  const width = 520
  const height = 110
  const padding = 8

  const safeValues = Array.isArray(values) ? values.map((value) => (Number.isFinite(value) ? Number(value) : 0)) : []
  const safeMaxValue = Number.isFinite(maxValue) ? Math.max(1, Number(maxValue)) : 1

  const points = safeValues.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, safeValues.length - 1)
    const y = height - padding - (Math.max(0, value) * (height - padding * 2)) / safeMaxValue
    return { x, y }
  })

  const pathD = points
    .map((point, index) => {
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        sx={{
          width: '100%',
          minWidth: 360,
          height: 120,
          display: 'block',
        }}
      >
        <rect x="0" y="0" width={width} height={height} rx="10" fill="rgba(15, 23, 42, 0.03)" />
        <path d={pathD} stroke="#111827" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#111827" />
        ))}
      </Box>
    </Box>
  )
}

/* Create dashboard demo data. */
function createFakeDashboardData() {
  const today = new Date()

  const violationsSeries = createRecentDateSeries({ days: 14, endDate: today }).map((item, index) => {
    const wave = Math.round(6 + 4 * Math.sin(index / 2.5))
    const noise = index % 4 === 0 ? 3 : 0
    const count = Math.max(0, wave + noise)
    return { date: item, count }
  })

  return {
    basic: {
      objectsCount: 12,
      relationshipsCount: 27,
      aiTokensUsed: 182430,
      usersCount: 5,
    },
    governance: {
      violationsSeries,
      errorsLast24Hours: 3,
      errorsLast7Days: 19,
      aiQueryLogs: [
        {
          id: 'q1',
          time: '10:22',
          user: 'michael',
          question: 'Which accounts have contacts without an email?',
          tokens: 1450,
          status: 'ok',
        },
        {
          id: 'q2',
          time: '10:10',
          user: 'sarah',
          question: 'Show me deals linked to accounts in Canada',
          tokens: 2310,
          status: 'ok',
        },
        {
          id: 'q3',
          time: '09:58',
          user: 'michael',
          question: 'Why is the website guardrail failing for company abc?',
          tokens: 980,
          status: 'warning',
        },
        {
          id: 'q4',
          time: '09:41',
          user: 'daniel',
          question: 'List relationships between People and Company',
          tokens: 710,
          status: 'ok',
        },
        {
          id: 'q5',
          time: '09:05',
          user: 'sarah',
          question: 'Find duplicate leads by email',
          tokens: 1640,
          status: 'error',
        },
      ],
      recentErrors: [
        { id: 'e1', time: '09:06', source: 'AI', title: 'Query execution timeout' },
        { id: 'e2', time: '08:12', source: 'Ingestion', title: 'Invalid payload: entity_name missing' },
        { id: 'e3', time: 'Yesterday', source: 'Guardrails', title: 'Validation run failed' },
      ],
    },
  }
}

/* Format a number with separators. */
function formatNumber(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return String(value || '')
  }
  return numericValue.toLocaleString('en-US')
}

/* Create an ISO date series for the last N days. */
function createRecentDateSeries({ days, endDate }) {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 7
  const safeEndDate = endDate instanceof Date ? endDate : new Date()

  const result = []
  for (let index = safeDays - 1; index >= 0; index -= 1) {
    const date = new Date(safeEndDate)
    date.setDate(date.getDate() - index)
    result.push(date.toISOString().slice(0, 10))
  }
  return result
}

