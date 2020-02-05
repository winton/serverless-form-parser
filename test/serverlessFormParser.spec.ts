import expect from "./expect"
import { ServerlessFormParser } from "../src"

describe("serverlessFormParser", () => {
  it("should instantiate", () => {
    new ServerlessFormParser()
  })

  it("should assert", () => {
    expect(true).toBe(true)
  })
})
