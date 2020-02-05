import { basename } from "path"
import { PassThrough } from "stream"
import { IncomingMessage } from "http"

import Busboy from "busboy"
import { APIGatewayProxyEvent } from "aws-lambda"

export class ServerlessFormParser {
  async fromApiGateway(
    event: APIGatewayProxyEvent
  ): Promise<Record<string, any>> {
    const headers = this.cleanHeaders(event.headers)
    const params = {}
    const files = {}

    if (!headers["content-type"]) {
      return { files, params }
    }

    const [busboy, finished] = this.buildBusboy(
      headers,
      files,
      params
    )

    busboy.write(
      event.body,
      event.isBase64Encoded ? "base64" : "binary"
    )

    busboy.end()

    return await finished
  }

  async fromHttpRequest(
    req: IncomingMessage
  ): Promise<Record<string, any>> {
    const headers = this.cleanHeaders(req.headers)
    const params = {}
    const files = {}

    if (!headers["content-type"]) {
      return { files, params }
    }

    const [busboy, finished] = this.buildBusboy(
      headers,
      files,
      params
    )

    req.pipe(busboy)

    return await finished
  }

  buildBusboy(
    headers: Record<string, any>,
    files: Record<string, any>,
    params: Record<string, any>
  ): [busboy.Busboy, Promise<Record<string, any>>] {
    const busboy = new Busboy({ headers: headers })
    const stream = new PassThrough()

    busboy.on(
      "file",
      (fieldname, file, filename, encoding, mimetype) => {
        file.on("data", data => {
          stream.write(data)
        })
        file.on("end", function() {
          stream.end()
          files[fieldname] = {
            file: stream,
            filename,
            name: basename(filename),
            encoding,
            mimetype,
          }
        })
      }
    )

    busboy.on("field", (fieldname, val) => {
      params[fieldname] = val
    })

    const finished = new Promise((resolve, reject) => {
      busboy.on("finish", function() {
        resolve({ params, files })
      })
    })

    return [busboy, finished]
  }

  cleanHeaders(
    headers: Record<string, any>
  ): Record<string, any> {
    const clean = {}

    for (const key of Object.keys(headers)) {
      clean[key.toLowerCase()] = headers[key]
    }

    return clean
  }
}

export default new ServerlessFormParser()
