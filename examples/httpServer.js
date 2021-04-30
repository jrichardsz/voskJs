const http = require('http')
const path = require('path')

const { logLevel, loadModel, transcript, freeModel } = require('../voskjs')
const { getArgs } = require('../lib/getArgs')

const HTTP_METHOD = 'POST' 
const HTTP_PATH = '/transcript'
const HTTP_PORT = 3000

let model

function unixTimeMsecs() {
  return Math.floor(Date.now())
}  


/**
 * log
 *
 * @param {String} text
 * @param {String} type
 * @return {Number} timestamp
 *
 */
function log(text, type) {

  const time = unixTimeMsecs()

  if (type)
    console.log(`${time} ${type} ${text}`)
  else
    console.log(`${time} ${text}`)

  return time

}


/**
 * errorResponse
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
 */ 
function errorResponse(message, statusCode, res) {
  res.statusCode = statusCode
  res.end(`{"error":"${message}"}`)
  log(message, 'ERROR')
}


function requestListener(req, res) {
  
  // This function is called once the headers have been received
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== HTTP_METHOD || req.url !== HTTP_PATH) {
    return errorResponse('method or url not allowed', 405, res)
  }

  let body = ''

  // This function is called as chunks of body are received
  req.on('data', (data) => { body += data })

  // This function is called once the body has been fully received
  req.on('end', async () => {

    // log request body and assign to the request an identifier (timestamp)
    const requestId = log(`request  ${body}`)

    let parsedBody

    try {
      parsedBody = JSON.parse(body)
    }
    catch (error) {
      return errorResponse(`id ${requestId} cannot parse request body ${error}`, 400, res)
    }

    //
    // validate body data
    //
    if ( !parsedBody.speech || !parsedBody.model ) 
      return errorResponse(`id ${requestId} invalid body data ${body}`, 405, res)

    try {
      // speech recognition of an audio file
      const transcriptData = await transcript(parsedBody.speech, model)

      const latency = transcriptData.latency
      
      // return JSON data structure
      const json = JSON.stringify({
        ... parsedBody,
        ... { requestId },
        ... { latency },
        ... transcriptData.result 
        })

      log(`latency  ${requestId} ${latency}ms`)
      log(`response ${requestId} ${json}`)
      res.end(json)
    }  
    catch (error) {
      return errorResponse(`id ${requestId} transcript function ${error}`, 415, res)
    }  

  })
}  


function helpAndExit(programName) {
  
  console.log()
  console.log('usage:')
  console.log()
  console.log(`    ${programName} --model=<model directory path> [--port=<port number, default=3000>]`)
  console.log()    
  console.log('example:')
  console.log()
  console.log(`    ${programName} --model=../models/vosk-model-en-us-aspire-0.2 --port=8086`)
  console.log('or:')
  console.log(`    ${programName} --model=../models/vosk-model-small-en-us-0.15`)
  console.log()

  process.exit(1)

}  


/**
 * checkArgs
 * command line parsing
 *
 * @param {String}                    args
 * @param {String}                    programName
 *
 * @returns {SentenceAndAttributes}
 * @typedef {Object} SentenceAndAttributes
 * @property {String} language 
 * 
 */
function checkArgs(args, programName) {

  const modelDirectory = args.model 
  let port = args.port 

  if ( !modelDirectory ) 
    helpAndExit(programName)

  if ( !port ) 
    port = HTTP_PORT 

  return { modelDirectory, port }
}


function shutdown(signal) {

  log(`${signal} received...`)
  
  // free the Vosk runtime model
  freeModel(model)
  
  log('Shutdown done.')
  
  process.exit(0)
}  


async function main() {

  // get command line arguments 
  const { args } = getArgs()
  
  // set the language model
  const { modelDirectory, port } = checkArgs(args, `node ${path.basename(__filename, '.js')}`)

  log(`Model path: ${modelDirectory}`)

  const modelName = path.basename(modelDirectory, '/')
  log(`Model name: ${modelName}`)
  
  log(`HTTP server port: ${port}`)

  // set the vosk log level to silence 
  logLevel(-1) 

  let latency

  log(`loading model: ${modelName} ...`);

  // create a Vosk runtime model
  ( { model, latency } = await loadModel(modelDirectory) );

  log(`load model latency: ${latency}ms`)

  // create the HTTP server instance
  const server = http.createServer( (req, res) => requestListener(req, res) )

  // listen incoming client requests
  server.listen( port, () => {
    log(`Server ${path.basename(__filename)} running at http://localhost:${HTTP_PORT}`)
    log(`Endpoint http://localhost:${port}${HTTP_PATH}`)
  })
  
  // shutdown management
  process.on('SIGTERM', shutdown )
  process.on('SIGINT', shutdown )
  
  log('Press Ctrl-C to shutdown')

}

main()

