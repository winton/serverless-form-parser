# serverless-form-parser

Form and file upload parser for serverless environments 🌋

## Install

```bash
npm i serverless-form-parser
```

## HTTP usage

```ts
import http from "http"
import parser from "serverless-form-parser"

const port = 4000

http
  .createServer(async (req, res) => {
    const { files, params } = await parser.fromHttpRequest(
      req
    )
    res.end(JSON.stringify(params))
  })
  .listen(4000)
```

## API Gateway usage

```ts
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda"

import parser from "serverless-form-parser"

export async function lambda(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { files, params } = await parser.fromApiGateway(
    event
  )
  return { body: JSON.stringify(params) }
}
```
