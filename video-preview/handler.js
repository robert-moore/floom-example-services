const { execFile } = require("child_process");
const util = require("util");
const { readFileSync, existsSync } = require("fs");
const { join, extname } = require('path');
const AWS = require("aws-sdk");
const  { buildResponse, handleError } = require('./utils')
const  { downloadFile, ensureDir } = require('./file-utils')
const ffmpeg = require('fluent-ffmpeg')
let tmpPath = 'tmp'
let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'
const prod = true
if (prod) {
  tmpPath = '/tmp'
  ffmpegPath = '/opt/ffmpeg/ffmpeg'
  ffprobePath = '/opt/ffmpeg/ffprobe'
  ffmpeg.setFfmpegPath(ffmpegPath)
  ffmpeg.setFfprobePath(ffprobePath)
}
const probe = util.promisify(ffmpeg.ffprobe)
const mpeg = util.promisify(ffmpeg.ffprobe)
const exec = util.promisify(execFile)
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();
const bucket = "your-bucket"

const livePreviewPromise = async ({
  video,
  id,
}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const videoProbe = await probe(video)
      const videoDuration = videoProbe.format.duration
      // between 6 and 15 seconds
      const estimatedDuration = Math.max(6, Math.min(15, Math.pow(videoDuration, 1/3)))
      const previewDuration = Math.round(Math.min(videoDuration, estimatedDuration))
      await ensureDir(`${tmpPath}/${id}`)
      const previewOut = join(tmpPath,`${id}`, 'preview.mp4')
      const clipDuration = 1
      const clipCount = Math.floor(previewDuration / clipDuration)
      const clipSpacing = Math.max(clipDuration, videoDuration / clipCount)
      let clipStarts = []
      for(let i = 0; i < clipCount; i++) {
        const s = ((i + 0.5) * clipSpacing)
        if (s + clipDuration < videoDuration) {
          clipStarts.push([s.toFixed(2), (s + clipDuration).toFixed(2)])
        }
      }
      const select = clipStarts.map(d => {
        return `between(t,${d[0]},${d[1]})`
      }).join('+')
      const vf = `select='${select}',setpts=N/FRAME_RATE/TB`
      const af = `aselect='${select}',asetpts=N/SR/TB`
      await exec(
        ffmpegPath,
        [
          "-i", video,
          "-vf", vf,
          "-af", af,
          previewOut,
        ],
        { stdio: "inherit" },
      )
      resolve(previewOut)
    } catch(e) {
      console.log(e)
      reject(e)
    }
  })
}

module.exports.livePreview = async (event, context) => {
  console.log(event)
  let params = event
  if (event.body) {
    params = JSON.parse(event.body)
  }
  const { video, id } = params
  try {
    const ext = extname(video)
    const videoFile = await downloadFile(video, join(tmpPath, `${id}-video${ext}`))
    const previewOut = await livePreviewPromise({
      video: videoFile,
      id,
    })
    console.log({ previewOut })
    const fileOutput = readFileSync(previewOut);
    const s3Params = {
      Bucket: bucket,
      Key: `out/${id}.mp4`,
      Expires: 86400,
      ContentType: 'video/mp4',
      ACL: 'public-read',
      Body: fileOutput,
    }
    const sOut = await s3.putObject(s3Params).promise()
    console.log(sOut)
    return buildResponse({ id })
  } catch(e) {
    return handleError(e)
  }
}

module.exports.runLivePreview = async (event, context) => {
  const maxVideoMinutes = 60.5 // in minutes
  const minVideoMinutes = 0
  const displayMaxVideoMinutes = 60 // in minutes
  try {
    let params = event
    if (event.body) {
      params = JSON.parse(event.body)
    }
    const { video, id } = params
    const ext = extname(video)
    const file = await downloadFile(video, join(tmpPath, `${id}-probe${ext}`))
    console.log({ file })
    const exists = existsSync(file)
    const meta = await probe(file)
    const duration = meta.format.duration
    if (duration > 60 * maxVideoMinutes) {
      return buildResponse(
        {
          status: "reject",
          note: `Max video length is ${displayMaxVideoMinutes} minutes. Your video is ${(duration / 60).toFixed(1)} minutes long`
        })
    }
    if (duration < 60 * minVideoMinutes) {
      return buildResponse(
        {
          status: "reject",
          note: `Minimum video length is 12 seconds. Your video is ${(duration).toFixed(1)} seconds long`
        })
    }
    const invokeResponse = await lambda.invoke({
      FunctionName: `video-edits-${process.env.STAGE}-live-preview`,
      InvocationType: 'Event',
      Payload: JSON.stringify({ video, id })
    }).promise()
    console.log({ invokeResponse })
    return buildResponse({ status: "received" })
  } catch(e) {
    return handleError(e)
  }
}

module.exports.livePreviewStatus = async (event, context) => {
  const { id } = JSON.parse(event.body)
  try {
    console.log({ id })
    // will throw error if object doesn't exist
    const exists = await s3.headObject({
      Bucket: bucket,
      Key: `out/${id}.mp4`,
    }).promise()
    return buildResponse({
      status: "complete",
      output: [{
        key: 'preview',
        type: 'VIDEO',
        value: `https://s3.amazonaws.com/${bucket}/out/${id}.mp4`,
        label: 'Your Preview',
      }]
    })
  } catch(e) {
    console.log(JSON.stringify(e))
    if (e.code === 'NotFound') {
      return buildResponse({ status: "pending" })
    }
    return handleError(e)
  }
}

// for local testing
module.exports.makeLivePreview = livePreviewPromise
