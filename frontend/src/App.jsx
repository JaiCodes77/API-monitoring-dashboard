import './App.css'

const stats = [
  { label: 'Uptime (30d)', value: '99.94%', change: '+0.08%', trend: 'up' },
  { label: 'Avg Response', value: '182 ms', change: '-16 ms', trend: 'up' },
  { label: 'Incidents', value: '3', change: '-2', trend: 'up' },
  { label: 'Checks / hour', value: '1,440', change: '+4%', trend: 'up' },
]

const services = [
  {
    name: 'Auth Gateway',
    url: 'https://api.example.com/auth/health',
    status: 'Healthy',
    response: '164 ms',
    uptime: '99.98%',
    region: 'us-east-1',
  },
  {
    name: 'Payments Core',
    url: 'https://api.example.com/payments/health',
    status: 'Degraded',
    response: '412 ms',
    uptime: '99.62%',
    region: 'us-west-2',
  },
  {
    name: 'Notifications',
    url: 'https://api.example.com/notify/health',
    status: 'Healthy',
    response: '138 ms',
    uptime: '99.91%',
    region: 'eu-central-1',
  },
  {
    name: 'User Profile',
    url: 'https://api.example.com/profile/health',
    status: 'Incident',
    response: '—',
    uptime: '98.73%',
    region: 'us-east-1',
  },
]

const logs = [
  {
    id: 'LG-10492',
    service: 'Payments Core',
    code: 502,
    latency: '1,202 ms',
    time: '2 min ago',
    detail: 'Bad gateway from upstream provider',
  },
  {
    id: 'LG-10491',
    service: 'Auth Gateway',
    code: 200,
    latency: '148 ms',
    time: '4 min ago',
    detail: 'Token refreshed',
  },
  {
    id: 'LG-10490',
    service: 'User Profile',
    code: 503,
    latency: '—',
    time: '6 min ago',
    detail: 'Service unavailable',
  },
  {
    id: 'LG-10489',
    service: 'Notifications',
    code: 200,
    latency: '133 ms',
    time: '9 min ago',
    detail: 'Health check ok',
  },
  {
    id: 'LG-10488',
    service: 'Payments Core',
    code: 500,
    latency: '962 ms',
    time: '12 min ago',
    detail: 'Timeout on charge',
  },
]

const alerts = [
  {
    title: 'User Profile',
    status: 'Incident',
    time: 'Started 12 min ago',
    message: 'Health endpoint failing from us-east-1',
  },
  {
    title: 'Payments Core',
    status: 'Degraded',
    time: 'Ongoing for 43 min',
    message: 'High p95 latency on /charge',
  },
]

const chartBars = [62, 54, 58, 72, 64, 78, 88, 74, 69, 80, 92, 86]

function App() {
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
          <h3>Fintech Core</h3>
          <p className="sidebar-meta">4 services • 2 regions</p>
          <button className="primary">New Service</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Status Overview</p>
            <h1>Good afternoon, Jai</h1>
            <p className="muted">Monitors run every 60 seconds. Last sync 24 sec ago.</p>
          </div>
          <div className="topbar-actions">
            <button className="ghost">View logs</button>
            <button className="primary">Create project</button>
          </div>
        </header>

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
                <p className="muted">Current status and response time across regions</p>
              </div>
              <button className="ghost">Add service</button>
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
                <div className="table-row" key={service.name}>
                  <div>
                    <p className="table-title">{service.name}</p>
                    <p className="muted">{service.url}</p>
                  </div>
                  <span className={`pill ${service.status.toLowerCase()}`}>
                    {service.status}
                  </span>
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
                <p className="muted">Escalate failures instantly</p>
              </div>
              <button className="ghost">Manage</button>
            </div>
            <div className="alert-list">
              {alerts.map((alert) => (
                <div key={alert.title} className="alert">
                  <div>
                    <p className="alert-title">{alert.title}</p>
                    <p className="muted">{alert.message}</p>
                  </div>
                  <div className="alert-meta">
                    <span className={`pill ${alert.status.toLowerCase()}`}>
                      {alert.status}
                    </span>
                    <span className="muted">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="timeline">
              <div className="timeline-bar" />
              <div>
                <p className="muted">Next scheduled check</p>
                <h4>In 36 seconds</h4>
              </div>
            </div>
          </div>
        </section>

        <section className="card logs">
          <div className="card-header">
            <div>
              <h3>Recent Logs</h3>
              <p className="muted">Auto-collected health checks and errors</p>
            </div>
            <div className="topbar-actions">
              <button className="ghost">Export CSV</button>
              <button className="ghost">Filter</button>
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
            {logs.map((log) => (
              <div className="table-row" key={log.id}>
                <span className="mono">{log.id}</span>
                <span>{log.service}</span>
                <span className={`pill ${log.code >= 500 ? 'incident' : 'healthy'}`}>
                  {log.code}
                </span>
                <span>{log.latency}</span>
                <span className="muted">{log.time}</span>
                <span className="muted">{log.detail}</span>
              </div>
            ))}
          </div>
          <div className="pagination">
            <button className="ghost">Previous</button>
            <div className="page-indicator">
              <span className="active">1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </div>
            <button className="ghost">Next</button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
