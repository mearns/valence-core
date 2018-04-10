import express from 'express'
import HttpStatusCodes from 'http-status-codes'
import Promise from 'bluebird'
import uuid from 'uuid'

class JobManager {
  constructor () {
    this.jobs = {}
    this.nextJobId = 0
    this.serverAsPromised = this._createServer()
    this.serverUrlAsPromised = this.serverAsPromised.then(server => {
      const address = server.address()
      console.log('Listening on: ', address)
      return `${address.address}:${address.port}`
    })
  }

  _reserveJobId () {
    const jobId = this.nextJobId
    this.nextJobId += 1
    this.jobs[jobId] = {
      jobState: 'reserved',
      creationTime: new Date()
    }
    return jobId
  }

  _generateAuthToken () {
    return uuid.v4()
  }

  createJob ({command, args = []} = {}) {
    const jobId = this._reserveJobId()
    const authToken = this._generateAuthToken()
    this.jobs[jobId] = {
      command,
      args: [...args],
      authToken
    }
    console.log(jobId, this.jobs[jobId])
  }

  _createServer () {
    const app = express()

    app.get('/', (request, response) => {
      response.status(HttpStatusCodes.OK).type('text/plain').send('valence\n')
    })

    const jobServiceRouter = express.Router()
    app.use('/jobs-service/rest/v1/', jobServiceRouter)

    jobServiceRouter.use('/jobs/:jobId/:authToken', (request, response, next) => {
      const job = this.jobs[request.params.jobId]
      console.log('Hit middleware', request.params)
      if (!job) {
        response.status(HttpStatusCodes.NOT_FOUND).type('text/plain').send('no such job-id\n')
      } else if (request.params.authToken !== job.authToken) {
        response.status(HttpStatusCodes.FORBIDDEN).type('text/plain').send('Incorrect auth token\n')
      } else {
        request.job = job
        request.jobId = request.params.jobId
        request.url = request.url.substr(`/jobs/${request.params.jobId}/${request.params.authToken}`.length)
        next()
      }
    })
    const jobHandler = express.Router()
    jobServiceRouter.use(jobHandler)
    jobHandler.get('', (request, response) => {
      response.status(HttpStatusCodes.OK).type('text/plain').send('Found me!\n')
    })

    return new Promise((resolve, reject) => {
      const HOST = 'localhost'
      const server = app.listen(0, HOST, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve(server)
        }
      })
    })
  }
}

class Job {

}

export function getJobManager () {
  const jobManager = new JobManager()
  return ['createJob'].reduce((api, propName) => {
    api[propName] = jobManager[propName].bind(jobManager)
    return api
  }, {})
}
