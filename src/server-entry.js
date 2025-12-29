import { Hono } from 'hono'

const app = new Hono()

app.get('/api/time', (c) => {
  return c.json({ time: new Date().toISOString() })
})

export default {
  fetch: app.fetch,
  port: process.env.PORT || 3000,
}
