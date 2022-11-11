import * as Streams from "../streams"

export namespace Server {
    export interface HeaderResponse {
        statusCode: number
        statusMessage?: string | undefined
    }
    export function isHeaderResponse(value: any): value is HeaderResponse {
        return typeof value == "object" && value.statusCode && typeof value.statusCode == "number"
    }
}