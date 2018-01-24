const assert = require('assert')
const express = require('express')
const bodyParser = require('body-parser')
const IRCClient = require('./irc-client')

const HTTP_PORT = process.env.HTTP_PORT || 3000
const IRC_HOST = process.env.IRC_HOST
const IRC_PORT = process.env.IRC_PORT || 6667
const IRC_NICK = process.env.IRC_NICK
const IRC_CHANNEL = process.env.IRC_CHANNEL

// Quick sanity check
assert(IRC_HOST, 'Missing IRC_HOST')
assert(IRC_PORT, 'Missing IRC_PORT')
assert(IRC_NICK, 'Missing IRC_NICK')
assert(IRC_CHANNEL, 'Missing IRC_CHANNEL')

const app = express()

// To hold the server instance later on
let server

// IRC Client
console.log('Connecting to IRC')
const client = new IRCClient({
  host: IRC_HOST,
  port: IRC_PORT,
  nick: IRC_NICK
})

// HTTP API
app.post(`/${IRC_CHANNEL}`, bodyParser.json(), (req, res, next) => {
  const msg = req.body.msg

  if (!msg || !msg.length)
    return res.status(400).json({error: 'Message must be longer than 0 chars'})

  //client.msg(IRC_CHANNEL, msg)
  client.notice(IRC_CHANNEL, msg)
  return res.status(201).json({error: null})
})

client.on('ready', () => client.join(`#IRC_CHANNEL`))
client.on('end', () => {
  process.exit(0)
  // Close HTTP server too
  if (server)
    server.destroy()
})
//client.on('msg', (msg) => console.log(msg))

// Set up HTTP After IRC has connected
client.on('ready', () => {
  server = app.listen(HTTP_PORT, () => {
    console.log(`Listening on HTTP on port ${HTTP_PORT}`)
  })
})

// Docker container stop request
process.on('SIGTERM', () => {
  console.log('SIGTERM received')
  attemptExit()
})

// On CTRL+C
process.on('SIGINT', () => {
  console.log('SIGINT received')
  attemptExit()
})

// Handle process exit attempts
let quitAttempts = 0
function attemptExit () {
  if (++quitAttempts > 1) {
    console.error('Forcefully exiting!')
    process.exit(1)
  }
  console.log('Waiting for connection to close gracefully...')
  client.send('QUIT :quitting', () => {
    console.log('Quit successfully')
  })
}
