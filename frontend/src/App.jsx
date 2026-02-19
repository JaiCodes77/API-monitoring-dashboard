import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const TOKEN_KEY = 'api_monitor_token'
const LOGS_PAGE_SIZE = 8
const FALLBACK_CHART = [62, 54, 58, 72, 64, 78, 88, 74, 69, 80, 92, 86]

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const payload = await response.json()
      if (payload?.detail) {
        message = Array.isArray(payload.detail) ? JSON.stringify(payload.detail) : payload.detail
      }
    } catch {
      // keep fallback
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

function formatLatency(ms) {
  if (ms === null || ms === undefined || ms <= 0) {
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

function formatDate(value) {
  return new Date(value).toLocaleString()
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

function buildChartBars(logs) {
  const valid = logs
    .map((item) => item.response_time_ms)
    .filter((value) => typeof value === 'number' && value > 0)

  if (!valid.length) {
    return FALLBACK_CHART
  }

  const slice = valid.slice(0, 12)
  const max = Math.max(...slice)
  return slice.map((value) => Math.max(20, Math.round((value / max) * 100)))
}

function AuthScreen({ authMode, setAuthMode, authForm, setAuthForm, authBusy, authError, onSubmit }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">API Monitoring Dashboard</p>
        <h1>{authMode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="muted">
          {authMode === 'login'
            ? 'Use your credentials to access your monitoring projects.'
            : 'Create your account and start monitoring APIs.'}
        </p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            value={authForm.email}
            onChange={(event) =>
              setAuthForm((prev) => ({
                ...prev,
                email: event.target.value,
              }))
            }
            placeholder="you@example.com"
            required
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={authForm.password}
            onChange={(event) =>
              setAuthForm((prev) => ({
                ...prev,
                password: event.target.value,
              }))
            }
            placeholder="Minimum 8 characters"
            minLength={8}
            required
          />
          {authError && <p className="form-error">{authError}</p>}
          <button className="primary" type="submit" disabled={authBusy}>
            {authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>
        <button
          className="ghost"
          onClick={() => setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))}
          disabled={authBusy}
        >
          {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

function OverviewPage({ stats, chartBars, services, alerts, onAddService, submitting }) {
  return (
    <>
      <section className="stats">
        {stats.map((item) => (
          <div key={item.label} className="stat-card">
            <p className="muted">{item.label}</p>
            <div className="stat-row">
              <h2>{item.value}</h2>
              <span className="trend">{item.change}</span>
            </div>
            <div className="sparkline">
              {chartBars.map((value, index) => (
                <span key={`${item.label}-${index}`} className="spark" style={{ height: `${value}%` }} />
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
              <p className="muted">Latest status and response metrics by service</p>
            </div>
            <button className="ghost" onClick={onAddService} disabled={submitting}>
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
              <p className="muted">Detected from latest logs</p>
            </div>
          </div>
          <div className="alert-list">
            {alerts.length === 0 && <p className="muted">No active alerts.</p>}
            {alerts.map((alert) => (
              <div key={`${alert.title}-${alert.time}`} className="alert">
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
    </>
  )
}

function ProjectsPage({ projects, selectedProjectId, onSelectProject }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h3>Your Projects</h3>
          <p className="muted">Switch active project context for services and logs.</p>
        </div>
      </div>
      <div className="table">
        <div className="table-row table-head projects-grid">
          <span>Name</span>
          <span>Created</span>
          <span>Action</span>
        </div>
        {projects.map((item) => (
          <div key={item.id} className="table-row projects-grid">
            <div>
              <p className="table-title">{item.name}</p>
              <p className="muted">Project #{item.id}</p>
            </div>
            <span>{formatDate(item.created_at)}</span>
            <button
              className={item.id === selectedProjectId ? 'primary' : 'ghost'}
              onClick={() => onSelectProject(item.id)}
            >
              {item.id === selectedProjectId ? 'Active' : 'Set active'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function ServicesPage({ services, onAddService, onToggleService, submitting }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h3>Services</h3>
          <p className="muted">Manage monitored endpoints for the active project.</p>
        </div>
        <button className="primary" onClick={onAddService} disabled={submitting}>
          Add service
        </button>
      </div>
      <div className="table">
        <div className="table-row table-head services-grid">
          <span>Service</span>
          <span>Method</span>
          <span>Status</span>
          <span>Response</span>
          <span>Action</span>
        </div>
        {services.map((service) => (
          <div key={service.id} className="table-row services-grid">
            <div>
              <p className="table-title">{service.name}</p>
              <p className="muted">{service.url}</p>
            </div>
            <span className="mono">{service.method}</span>
            <span className={`pill ${service.status.toLowerCase()}`}>{service.status}</span>
            <span>{service.response}</span>
            <button className="ghost" onClick={() => onToggleService(service)} disabled={submitting}>
              {service.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function AlertsPage({ alerts }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h3>Alerts</h3>
          <p className="muted">Current incidents and degraded services.</p>
        </div>
      </div>
      <div className="alert-list">
        {alerts.length === 0 && <p className="muted">No active alerts.</p>}
        {alerts.map((alert) => (
          <div key={`${alert.title}-${alert.time}`} className="alert">
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
    </section>
  )
}

function LogsPage({
  filteredLogs,
  logFilter,
  onCycleFilter,
  onExportCsv,
  page,
  setPage,
  totalPages,
}) {
  const start = (page - 1) * LOGS_PAGE_SIZE
  const visibleLogs = filteredLogs.slice(start, start + LOGS_PAGE_SIZE)

  return (
    <section className="card logs">
      <div className="card-header">
        <div>
          <h3>Logs</h3>
          <p className="muted">Recent health-check and failure events.</p>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={onExportCsv}>
            Export CSV
          </button>
          <button className="ghost" onClick={onCycleFilter}>
            Filter: {logFilter}
          </button>
        </div>
      </div>
      <div className="table">
        <div className="table-row table-head logs-grid">
          <span>Log ID</span>
          <span>Service</span>
          <span>Status</span>
          <span>Latency</span>
          <span>Time</span>
          <span>Detail</span>
        </div>
        {visibleLogs.map((log) => (
          <div className="table-row logs-grid" key={log.id}>
            <span className="mono">LG-{String(log.id).padStart(5, '0')}</span>
            <span>{log.service_name}</span>
            <span className={`pill ${log.status_code >= 500 || !log.is_success ? 'incident' : 'healthy'}`}>
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
  )
}

function IntegrationsPage({ token, user }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h3>Integrations</h3>
          <p className="muted">Connection details for external tooling.</p>
        </div>
      </div>
      <div className="integration-grid">
        <div className="integration-item">
          <p className="sidebar-label">API Base URL</p>
          <p className="mono">{API_BASE_URL}</p>
        </div>
        <div className="integration-item">
          <p className="sidebar-label">Authenticated User</p>
          <p>{user?.email || '--'}</p>
        </div>
        <div className="integration-item">
          <p className="sidebar-label">Token Status</p>
          <p>{token ? 'Available' : 'Missing'}</p>
        </div>
      </div>
    </section>
  )
}

function DashboardApp() {
  const navigate = useNavigate()
  const location = useLocation()

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [lastSync, setLastSync] = useState('')

  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [services, setServices] = useState([])
  const [alerts, setAlerts] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState([
    { label: 'Uptime (30d)', value: '--', change: 'No logs' },
    { label: 'Avg Response', value: '--', change: 'No data' },
    { label: 'Incidents', value: '0', change: 'No services' },
    { label: 'Checks / hour', value: '0', change: 'No checks' },
  ])
  const [chartBars, setChartBars] = useState(FALLBACK_CHART)

  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [serviceForm, setServiceForm] = useState({ name: '', url: '', method: 'GET' })

  const [logFilter, setLogFilter] = useState('all')
  const [page, setPage] = useState(1)

  const activeProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  )

  const navItems = [
    { to: '/overview', label: 'Overview' },
    { to: '/projects', label: 'Projects' },
    { to: '/services', label: 'Services' },
    { to: '/alerts', label: 'Alerts' },
    { to: '/logs', label: 'Logs' },
    { to: '/integrations', label: 'Integrations' },
  ]

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith('/projects')) return 'Projects'
    if (location.pathname.startsWith('/services')) return 'Services'
    if (location.pathname.startsWith('/alerts')) return 'Alerts'
    if (location.pathname.startsWith('/logs')) return 'Logs'
    if (location.pathname.startsWith('/integrations')) return 'Integrations'
    return 'Overview'
  }, [location.pathname])

  const filteredLogs = useMemo(() => {
    if (logFilter === 'errors') {
      return logs.filter((item) => !item.is_success || item.status_code >= 400)
    }
    if (logFilter === 'success') {
      return logs.filter((item) => item.is_success && item.status_code < 400)
    }
    return logs
  }, [logs, logFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PAGE_SIZE))

  const loadDashboard = useCallback(
    async (initial = false) => {
      if (!token) {
        return
      }

      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        const projectList = await apiRequest('/projects/?skip=0&limit=100', { token })
        setProjects(projectList)

        if (!projectList.length) {
          setSelectedProjectId(null)
          setServices([])
          setAlerts([])
          setLogs([])
          setStats([
            { label: 'Uptime (30d)', value: '--', change: 'No logs' },
            { label: 'Avg Response', value: '--', change: 'No data' },
            { label: 'Incidents', value: '0', change: 'No services' },
            { label: 'Checks / hour', value: '0', change: 'No checks' },
          ])
          setChartBars(FALLBACK_CHART)
          setErrorMessage('No projects found. Create a project to begin monitoring.')
          return
        }

        const nextProjectId =
          selectedProjectId && projectList.some((item) => item.id === selectedProjectId)
            ? selectedProjectId
            : projectList[0].id

        if (nextProjectId !== selectedProjectId) {
          setSelectedProjectId(nextProjectId)
        }

        const serviceList = await apiRequest(`/projects/${nextProjectId}/services/?skip=0&limit=200`, {
          token,
        })

        const logsPerService = await Promise.all(
          serviceList.map(async (service) => {
            const serviceLogs = await apiRequest(
              `/projects/${nextProjectId}/services/${service.id}/logs/?skip=0&limit=100`,
              { token },
            )
            return { service, logs: serviceLogs }
          }),
        )

        const allLogs = logsPerService
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
            project_id: service.project_id,
            name: service.name,
            method: service.method,
            url: service.url,
            is_active: service.is_active,
            status: getHealthLabel(service, latestLog),
            response: latestLog ? formatLatency(latestLog.response_time_ms) : '--',
            uptime: computeServiceUptime(serviceLogs),
            region: 'n/a',
          }
        })

        const activeAlerts = mappedServices
          .filter((item) => item.status !== 'Healthy')
          .map((item) => ({
            title: item.name,
            status: item.status,
            time: 'Needs attention',
            message: `${item.status} status detected for ${item.name}.`,
          }))

        const oneHourAgo = Date.now() - 60 * 60 * 1000
        const checksLastHour = allLogs.filter(
          (entry) => new Date(entry.created_at).getTime() >= oneHourAgo,
        ).length

        const measurable = allLogs.filter((entry) => entry.response_time_ms > 0)
        const avgResponse = measurable.length
          ? Math.round(measurable.reduce((sum, item) => sum + item.response_time_ms, 0) / measurable.length)
          : 0

        const uptime = allLogs.length
          ? ((allLogs.filter((entry) => entry.is_success).length / allLogs.length) * 100).toFixed(2)
          : '--'

        const incidentCount = mappedServices.filter((service) => service.status === 'Incident').length

        setServices(mappedServices)
        setAlerts(activeAlerts)
        setLogs(allLogs)
        setStats([
          {
            label: 'Uptime (30d)',
            value: uptime === '--' ? '--' : `${uptime}%`,
            change: `${allLogs.length} checks`,
          },
          {
            label: 'Avg Response',
            value: avgResponse ? `${avgResponse} ms` : '--',
            change: `${measurable.length} logs`,
          },
          {
            label: 'Incidents',
            value: String(incidentCount),
            change: `${mappedServices.length} services`,
          },
          {
            label: 'Checks / hour',
            value: String(checksLastHour),
            change: 'Rolling 60m',
          },
        ])
        setChartBars(buildChartBars(allLogs))
        setErrorMessage('')
        setLastSync(new Date().toLocaleTimeString())
      } catch (error) {
        setErrorMessage(`Sync failed: ${error.message}`)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [token, selectedProjectId],
  )

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const me = await apiRequest('/auth/me', { token })
        if (cancelled) {
          return
        }
        setUser(me)
      } catch {
        if (cancelled) {
          return
        }
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        setUser(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !user) {
      setLoading(false)
      return
    }

    loadDashboard(true)
    const timer = setInterval(() => loadDashboard(false), 60000)
    return () => clearInterval(timer)
  }, [token, user, loadDashboard])

  useEffect(() => {
    setPage(1)
  }, [logFilter, selectedProjectId])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')

    try {
      if (authMode === 'register') {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: authForm,
        })
      }

      const loginResponse = await apiRequest('/auth/login', {
        method: 'POST',
        body: authForm,
      })
      localStorage.setItem(TOKEN_KEY, loginResponse.access_token)
      setToken(loginResponse.access_token)
      setAuthForm({ email: '', password: '' })
      navigate('/overview')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setUser(null)
    setProjects([])
    setSelectedProjectId(null)
    setServices([])
    setLogs([])
    setAlerts([])
    setActionMessage('')
    setErrorMessage('')
  }

  const handleCreateProject = async (event) => {
    event.preventDefault()
    if (!projectName.trim()) {
      setActionMessage('Project name is required.')
      return
    }

    setSubmitting(true)
    setActionMessage('')
    try {
      const created = await apiRequest('/projects/', {
        method: 'POST',
        token,
        body: { name: projectName.trim() },
      })
      setProjectName('')
      setShowProjectForm(false)
      setSelectedProjectId(created.id)
      setActionMessage(`Project created: ${created.name}`)
      await loadDashboard(false)
      navigate('/projects')
    } catch (error) {
      setActionMessage(`Create project failed: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateService = async (event) => {
    event.preventDefault()
    if (!activeProject) {
      setActionMessage('Select or create a project first.')
      return
    }

    setSubmitting(true)
    setActionMessage('')
    try {
      const created = await apiRequest(`/projects/${activeProject.id}/services/`, {
        method: 'POST',
        token,
        body: {
          name: serviceForm.name.trim(),
          url: serviceForm.url.trim(),
          method: serviceForm.method.toUpperCase(),
        },
      })
      setServiceForm({ name: '', url: '', method: 'GET' })
      setShowServiceForm(false)
      setActionMessage(`Service created: ${created.name}`)
      await loadDashboard(false)
      navigate('/services')
    } catch (error) {
      setActionMessage(`Add service failed: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleService = async (service) => {
    if (!activeProject) {
      return
    }

    setSubmitting(true)
    setActionMessage('')
    try {
      await apiRequest(`/projects/${activeProject.id}/services/${service.id}`, {
        method: 'PATCH',
        token,
        body: { is_active: !service.is_active },
      })
      setActionMessage(
        `${service.name} ${service.is_active ? 'disabled' : 'enabled'} successfully.`,
      )
      await loadDashboard(false)
    } catch (error) {
      setActionMessage(`Update service failed: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCycleFilter = () => {
    setLogFilter((prev) => {
      if (prev === 'all') return 'errors'
      if (prev === 'errors') return 'success'
      return 'all'
    })
  }

  const handleExportCsv = () => {
    const rows = [
      ['id', 'service', 'status_code', 'response_time_ms', 'is_success', 'created_at', 'message'],
      ...filteredLogs.map((log) => [
        log.id,
        log.service_name,
        log.status_code,
        log.response_time_ms,
        log.is_success,
        log.created_at,
        (log.message || '').replaceAll(',', ' '),
      ]),
    ]

    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `logs-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!token || !user) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authBusy={authBusy}
        authError={authError}
        onSubmit={handleAuthSubmit}
      />
    )
  }

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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <p className="sidebar-label">Active Project</p>
          <h3>{activeProject?.name || 'No Project'}</h3>
          <p className="sidebar-meta">{services.length} services • {projects.length} projects</p>
          <button className="primary" onClick={() => setShowServiceForm(true)} disabled={submitting}>
            New Service
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{pageTitle}</p>
            <h1>{pageTitle} Dashboard</h1>
            <p className="muted">
              {loading
                ? 'Loading live monitoring data...'
                : `Last sync ${lastSync || '--'}${refreshing ? ' (refreshing...)' : ''}`}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="ghost" onClick={() => navigate('/logs')}>
              View logs
            </button>
            <button className="ghost" onClick={() => loadDashboard(false)} disabled={refreshing || loading}>
              Refresh
            </button>
            <button className="primary" onClick={() => setShowProjectForm(true)} disabled={submitting}>
              Create project
            </button>
            <button className="ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {(showProjectForm || showServiceForm) && (
          <section className="card">
            {showProjectForm && (
              <form className="form-grid" onSubmit={handleCreateProject}>
                <h3>Create Project</h3>
                <label htmlFor="project-name">Project name</label>
                <input
                  id="project-name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Fintech API Core"
                  minLength={2}
                  required
                />
                <div className="topbar-actions">
                  <button className="primary" type="submit" disabled={submitting}>
                    Save project
                  </button>
                  <button className="ghost" type="button" onClick={() => setShowProjectForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {showServiceForm && (
              <form className="form-grid" onSubmit={handleCreateService}>
                <h3>Add Service</h3>
                <label htmlFor="service-name">Service name</label>
                <input
                  id="service-name"
                  value={serviceForm.name}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Auth API"
                  minLength={2}
                  required
                />
                <label htmlFor="service-url">URL</label>
                <input
                  id="service-url"
                  type="url"
                  value={serviceForm.url}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://api.example.com/health"
                  required
                />
                <label htmlFor="service-method">Method</label>
                <select
                  id="service-method"
                  value={serviceForm.method}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      method: event.target.value,
                    }))
                  }
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <div className="topbar-actions">
                  <button className="primary" type="submit" disabled={submitting}>
                    Save service
                  </button>
                  <button className="ghost" type="button" onClick={() => setShowServiceForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

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

        <Routes>
          <Route
            path="/overview"
            element={
              <OverviewPage
                stats={stats}
                chartBars={chartBars}
                services={services}
                alerts={alerts}
                onAddService={() => setShowServiceForm(true)}
                submitting={submitting}
              />
            }
          />
          <Route
            path="/projects"
            element={
              <ProjectsPage
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
              />
            }
          />
          <Route
            path="/services"
            element={
              <ServicesPage
                services={services}
                onAddService={() => setShowServiceForm(true)}
                onToggleService={handleToggleService}
                submitting={submitting}
              />
            }
          />
          <Route path="/alerts" element={<AlertsPage alerts={alerts} />} />
          <Route
            path="/logs"
            element={
              <LogsPage
                filteredLogs={filteredLogs}
                logFilter={logFilter}
                onCycleFilter={handleCycleFilter}
                onExportCsv={handleExportCsv}
                page={page}
                setPage={setPage}
                totalPages={totalPages}
              />
            }
          />
          <Route path="/integrations" element={<IntegrationsPage token={token} user={user} />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <DashboardApp />
}
