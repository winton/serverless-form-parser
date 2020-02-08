import { basename, extname } from "path"
import { IncomingMessage } from "http"
import { createWriteStream } from "fs"
import querystring from "querystring"
import tmp from "tmp-promise"

import Busboy from "busboy"
import { APIGatewayProxyEvent } from "aws-lambda"

export class ServerlessFormParser {
  async fromApiGateway(
    event: APIGatewayProxyEvent
  ): Promise<Record<string, any>> {
    const headers = this.cleanHeaders(event.headers)
    const params = {}
    const files = {}

    if (event.httpMethod === "GET") {
      return {
        params: Object.assign(
          {},
          event.queryStringParameters,
          event.pathParameters
        ),
      }
    }

    if (
      !headers["content-type"] ||
      event.httpMethod !== "POST"
    ) {
      return { files, params }
    }

    if (headers["content-type"] === "application/json") {
      return Promise.resolve(JSON.parse(event.body))
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

    if (req.method === "GET" && req.url.includes("?")) {
      return {
        params: querystring.parse(req.url.split("?")[1]),
      }
    }

    if (!headers["content-type"] || req.method !== "POST") {
      return { files, params }
    }

    if (headers["content-type"] === "application/json") {
      return await this.parseRequestStream(req)
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
    busboy.on(
      "file",
      async (
        fieldname,
        file,
        filename,
        encoding,
        mimetype
      ) => {
        const ext = extname(filename)
        const { path } = await tmp.file({ postfix: ext })
        const stream = createWriteStream(path)

        file.pipe(stream)

        file.on("data", () => {})
        file.on("end", function() {
          files[fieldname] = {
            path,
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

  async parseRequestStream(
    req: IncomingMessage
  ): Promise<Record<string, any>> {
    let json = ""

    req.on("data", chunk => {
      json += chunk
    })

    const finished = new Promise(resolve => {
      req.on("end", async () => {
        resolve({ params: JSON.parse(json) })
      })
    })

    return await finished
  }
}

export default new ServerlessFormParser()
