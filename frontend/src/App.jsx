import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const LOGS_PAGE_SIZE = 5
const FALLBACK_CHART = [62, 54, 58, 72, 64, 78, 88, 74, 69, 80, 92, 86]

function formatLatency(ms) {
  if (ms === null || ms === undefined) {
    return '--'
  }
  return `${ms} ms`
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue)
  const now = new Date()
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))

  if (seconds < 60) {
    return `${seconds} sec ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hr ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} day ago`
}

function getHealthLabel(service, latestLog) {
  if (!service.is_active) {
    return 'Degraded'
  }
  if (!latestLog) {
    return 'Degraded'
  }
  if (!latestLog.is_success || latestLog.status_code >= 500) {
    return 'Incident'
  }
  if (latestLog.status_code >= 400) {
    return 'Degraded'
  }
  return 'Healthy'
}

function computeServiceUptime(logs) {
  if (!logs.length) {
    return '--'
  }
  const successCount = logs.filter((entry) => entry.is_success).length
  const percent = (successCount / logs.length) * 100
  return `${percent.toFixed(2)}%`
}

function buildChartBars(allLogs) {
  const withLatency = allLogs
    .map((entry) => entry.response_time_ms)
    .filter((value) => typeof value === 'number' && value > 0)

  if (!withLatency.length) {
    return FALLBACK_CHART
  }

  const slice = withLatency.slice(0, 12)
  const max = Math.max(...slice)
  return slice.map((value) => Math.max(20, Math.round((value / max) * 100)))
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const errorBody = await response.json()
      if (errorBody?.detail) {
        detail = String(errorBody.detail)
      }
    } catch {
      // keep default detail
    }
    throw new Error(detail)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

function App() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [lastSync, setLastSync] = useState('')
  const [project, setProject] = useState(null)
  const [projectsCount, setProjectsCount] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [defaultOwnerId, setDefaultOwnerId] = useState(null)
  const [services, setServices] = useState([])
  const [alerts, setAlerts] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState([])
  const [chartBars, setChartBars] = useState(FALLBACK_CHART)
  const [page, setPage] = useState(1)

  const loadDashboard = useCallback(
    async (initialLoad = false) => {
      if (initialLoad) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        const allProjects = await fetchJson('/projects/?skip=0&limit=100')
        const sortedProjects = [...allProjects].sort((a, b) => b.id - a.id)
        setProjectsCount(sortedProjects.length)

        if (!sortedProjects.length) {
          setProject(null)
          setServices([])
          setAlerts([])
          setLogs([])
          setStats([
            { label: 'Uptime (30d)', value: '--', change: 'No logs', trend: 'up' },
            { label: 'Avg Response', value: '--', change: 'No logs', trend: 'up' },
            { label: 'Incidents', value: '0', change: 'No services', trend: 'up' },
            { label: 'Checks / hour', value: '0', change: 'No checks', trend: 'up' },
          ])
          setChartBars(FALLBACK_CHART)
          setErrorMessage('No project found. Use the Create project button to add one.')
          return
        }

        const activeProject =
          sortedProjects.find((item) => item.id === selectedProjectId) || sortedProjects[0]

        setSelectedProjectId(activeProject.id)
        setDefaultOwnerId(activeProject.owner_id)

        const serviceList = await fetchJson(`/projects/${activeProject.id}/services/?skip=0&limit=100`)

        const logsPerService = await Promise.all(
          serviceList.map(async (service) => {
            const serviceLogs = await fetchJson(
              `/projects/${activeProject.id}/services/${service.id}/logs/?skip=0&limit=50`,
            )
            return { service, logs: serviceLogs }
          }),
        )

        const mergedLogs = logsPerService
          .flatMap(({ service, logs: serviceLogs }) =>
            serviceLogs.map((entry) => ({
              ...entry,
              service_name: service.name,
            })),
          )
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        const mappedServices = logsPerService.map(({ service, logs: serviceLogs }) => {
          const latestLog = serviceLogs[0]
          return {
            id: service.id,
            name: service.name,
            url: service.url,
            status: getHealthLabel(service, latestLog),
            response: latestLog ? formatLatency(latestLog.response_time_ms) : '--',
            uptime: computeServiceUptime(serviceLogs),
            region: 'n/a',
          }
        })

        const mappedAlerts = mappedServices
          .filter((service) => service.status !== 'Healthy')
          .map((service) => ({
            title: service.name,
            status: service.status,
            time: 'Needs attention',
            message: `Status is ${service.status.toLowerCase()} for ${service.name}`,
          }))

        const oneHourAgo = Date.now() - 60 * 60 * 1000
        const checksLastHour = mergedLogs.filter(
          (entry) => new Date(entry.created_at).getTime() >= oneHourAgo,
        ).length

        const avgResponseFromSuccess = mergedLogs.filter((entry) => entry.response_time_ms > 0)
        const avgResponse = avgResponseFromSuccess.length
          ? Math.round(
              avgResponseFromSuccess.reduce((sum, entry) => sum + entry.response_time_ms, 0) /
                avgResponseFromSuccess.length,
            )
          : 0

        const overallUptime = mergedLogs.length
          ? (
              (mergedLogs.filter((entry) => entry.is_success).length / mergedLogs.length) *
              100
            ).toFixed(2)
          : '--'

        const incidentCount = mappedServices.filter((service) => service.status === 'Incident').length

        const mappedStats = [
          {
            label: 'Uptime (30d)',
            value: overallUptime === '--' ? '--' : `${overallUptime}%`,
            change: `${mergedLogs.length} checks`,
            trend: 'up',
          },
          {
            label: 'Avg Response',
            value: avgResponse ? `${avgResponse} ms` : '--',
            change: `${avgResponseFromSuccess.length} logs`,
            trend: 'up',
          },
          {
            label: 'Incidents',
            value: String(incidentCount),
            change: `${mappedServices.length} services`,
            trend: 'up',
          },
          {
            label: 'Checks / hour',
            value: String(checksLastHour),
            change: 'Rolling 60m',
            trend: 'up',
          },
        ]

        setProject(activeProject)
        setServices(mappedServices)
        setAlerts(mappedAlerts)
        setLogs(mergedLogs)
        setStats(mappedStats)
        setChartBars(buildChartBars(mergedLogs))
        setErrorMessage('')
        setPage(1)
        setLastSync(new Date().toLocaleTimeString())
      } catch (error) {
        setErrorMessage(
          `Backend sync failed: ${error.message}. Make sure backend is running at ${API_BASE_URL}.`,
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedProjectId],
  )

  useEffect(() => {
    loadDashboard(true)
    const intervalId = setInterval(() => loadDashboard(false), 60000)
    return () => clearInterval(intervalId)
  }, [loadDashboard])

  const handleCreateProject = async () => {
    const name = window.prompt('Project name:')
    if (!name) {
      return
    }

    setSubmitting(true)
    setActionMessage('')

    try {
      let ownerId = defaultOwnerId
      if (!ownerId) {
        const timestamp = Date.now()
        const demoUser = await fetchJson('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: `demo_owner_${timestamp}@example.com`,
            password: 'password123',
          }),
        })
        ownerId = demoUser.id
        setDefaultOwnerId(ownerId)
      }

      const created = await fetchJson(`/projects/?owner_id=${ownerId}`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setSelectedProjectId(created.id)
      setActionMessage(`Project created: ${created.name}`)
      await loadDashboard(false)
    } catch (error) {
      setActionMessage(`Create project failed: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateService = async () => {
    if (!project) {
      setActionMessage('Add service failed: create a project first.')
      return
    }

    const name = window.prompt('Service name:')
    if (!name) {
      return
    }

    const url = window.prompt('Service URL (health endpoint):', 'https://api.example.com/health')
    if (!url) {
      return
    }

    const methodInput = window.prompt('HTTP method:', 'GET')
    if (!methodInput) {
      return
    }

    setSubmitting(true)
    setActionMessage('')

    try {
      const created = await fetchJson(`/projects/${project.id}/services/`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          url,
          method: methodInput.toUpperCase(),
        }),
      })
      setActionMessage(`Service added: ${created.name}`)
      await loadDashboard(false)
    } catch (error) {
      setActionMessage(`Add service failed: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PAGE_SIZE))
  const visibleLogs = useMemo(() => {
    const start = (page - 1) * LOGS_PAGE_SIZE
    return logs.slice(start, start + LOGS_PAGE_SIZE)
  }, [logs, page])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">API</span>
          <div>
            <p className="brand-title">API Pulse</p>
            <p className="brand-subtitle">Monitoring</p>
          </div>
        </div>
        <nav className="nav">
          <button className="nav-item active">Overview</button>
          <button className="nav-item">Projects</button>
          <button className="nav-item">Services</button>
          <button className="nav-item">Alerts</button>
          <button className="nav-item">Logs</button>
          <button className="nav-item">Integrations</button>
        </nav>
        <div className="sidebar-card">
          <p className="sidebar-label">Active Project</p>
          <h3>{project?.name || 'No Project'}</h3>
          <p className="sidebar-meta">{services.length} services • {projectsCount} projects</p>
          <button className="primary" onClick={handleCreateService} disabled={submitting}>
            New Service
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Status Overview</p>
            <h1>Backend Connected Dashboard</h1>
            <p className="muted">
              {loading
                ? 'Loading live monitoring data...'
                : `Last sync ${lastSync || '--'}${refreshing ? ' (refreshing...)' : ''}`}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="ghost" onClick={() => loadDashboard(false)} disabled={submitting}>
              Refresh
            </button>
            <button className="primary" onClick={handleCreateProject} disabled={submitting}>
              Create project
            </button>
          </div>
        </header>

        {actionMessage && (
          <section className="card">
            <p className="muted">{actionMessage}</p>
          </section>
        )}

        {errorMessage && (
          <section className="card">
            <p className="muted">{errorMessage}</p>
          </section>
        )}

        <section className="stats">
          {stats.map((item) => (
            <div key={item.label} className="stat-card">
              <p className="muted">{item.label}</p>
              <div className="stat-row">
                <h2>{item.value}</h2>
                <span className={`trend ${item.trend}`}>{item.change}</span>
              </div>
              <div className="sparkline">
                {chartBars.map((value, index) => (
                  <span
                    key={`${item.label}-${index}`}
                    className="spark"
                    style={{ height: `${Math.max(20, value)}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="grid">
          <div className="card wide">
            <div className="card-header">
              <div>
                <h3>Service Health</h3>
                <p className="muted">Current status and response time across services</p>
              </div>
              <button className="ghost" onClick={handleCreateService} disabled={submitting}>
                Add service
              </button>
            </div>
            <div className="table">
              <div className="table-row table-head">
                <span>Service</span>
                <span>Status</span>
                <span>Response</span>
                <span>Uptime</span>
                <span>Region</span>
              </div>
              {services.map((service) => (
                <div className="table-row" key={service.id}>
                  <div>
                    <p className="table-title">{service.name}</p>
                    <p className="muted">{service.url}</p>
                  </div>
                  <span className={`pill ${service.status.toLowerCase()}`}>{service.status}</span>
                  <span>{service.response}</span>
                  <span>{service.uptime}</span>
                  <span className="muted">{service.region}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3>Active Alerts</h3>
                <p className="muted">Detected from latest service checks</p>
              </div>
              <button className="ghost" disabled>
                Manage
              </button>
            </div>
            <div className="alert-list">
              {alerts.length === 0 && <p className="muted">No active alerts.</p>}
              {alerts.map((alert) => (
                <div key={alert.title} className="alert">
                  <div>
                    <p className="alert-title">{alert.title}</p>
                    <p className="muted">{alert.message}</p>
                  </div>
                  <div className="alert-meta">
                    <span className={`pill ${alert.status.toLowerCase()}`}>{alert.status}</span>
                    <span className="muted">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="timeline">
              <div className="timeline-bar" />
              <div>
                <p className="muted">Refresh interval</p>
                <h4>Every 60 seconds</h4>
              </div>
            </div>
          </div>
        </section>

        <section className="card logs">
          <div className="card-header">
            <div>
              <h3>Recent Logs</h3>
              <p className="muted">Live data from backend log endpoints</p>
            </div>
            <div className="topbar-actions">
              <button className="ghost" disabled>
                Export CSV
              </button>
              <button className="ghost" disabled>
                Filter
              </button>
            </div>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>Log ID</span>
              <span>Service</span>
              <span>Status</span>
              <span>Latency</span>
              <span>Time</span>
              <span>Detail</span>
            </div>
            {visibleLogs.map((log) => (
              <div className="table-row" key={log.id}>
                <span className="mono">LG-{String(log.id).padStart(5, '0')}</span>
                <span>{log.service_name}</span>
                <span className={`pill ${log.status_code >= 500 ? 'incident' : 'healthy'}`}>
                  {log.status_code}
                </span>
                <span>{formatLatency(log.response_time_ms)}</span>
                <span className="muted">{formatRelativeTime(log.created_at)}</span>
                <span className="muted">{log.message || 'Health check result'}</span>
              </div>
            ))}
          </div>
          <div className="pagination">
            <button className="ghost" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </button>
            <div className="page-indicator">
              <span className="active">
                {page}/{totalPages}
              </span>
            </div>
            <button
              className="ghost"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
