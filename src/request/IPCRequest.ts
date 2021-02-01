import { IPCCookie } from "../client/IPCCookie";
import { HTTPMethod } from "maestro";

export interface IPCRequest {
  _id: string;
  url: string;
  method: HTTPMethod;
  urlParams?: any;
  queryParams?: any;
  body?: any;
  headers?: {
    [name: string]: string;
  };
  cookies?: {
    [name: string]: IPCCookie;
  };
  created_at: Date;
}