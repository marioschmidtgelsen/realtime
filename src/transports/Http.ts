import * as Transports from "."

export namespace Server {
    export interface Request {
        method: string
        url: string
    }
    export interface HeaderResponse {
        statusCode: number
        statusMessage?: string | undefined
    }
    export function isHeaderResponse(value: any): value is HeaderResponse {
        return typeof value == "object" && value.statusCode && typeof value.statusCode == "number"
    }
    export interface Endpoint extends Transports.Endpoint<Request, HeaderResponse & any> { }
}