import { useEffect, useState } from 'react'

type Dashboard = {
  user: {
    id: number
    username: string
  }
  progress: {
    total: number
  }
  missions: {
    total: number
    completed: number
    pending: number
  }
  goals: {
    id: number
    title: string
    status: string
  }[]
}

function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/1')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }

        return response.json()
      })
      .then((data: Dashboard) => {
        setDashboard(data)
      })
      .catch((err: Error) => {
        setError(err.message)
      })
  }, [])

  if (error) {
    return <div>{error}</div>
  }

  if (!dashboard) {
    return <div>Loading SHINPO...</div>
  }

  return (
    <main>
      <h1>SHINPO</h1>

      <h2>Welcome, {dashboard.user.username}</h2>

      <section>
        <h3>Progress</h3>
        <p>{dashboard.progress.total}</p>
      </section>

      <section>
        <h3>Missions</h3>
        <p>Total: {dashboard.missions.total}</p>
        <p>Completed: {dashboard.missions.completed}</p>
        <p>Pending: {dashboard.missions.pending}</p>
      </section>

      <section>
        <h3>Goals</h3>

        {dashboard.goals.map((goal) => (
          <div key={goal.id}>
            <strong>{goal.title}</strong>
            <span> · {goal.status}</span>
          </div>
        ))}
      </section>
    </main>
  )
}

export default App