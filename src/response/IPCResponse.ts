import { IPCCookie } from "../client/IPCCookie";

export interface IPCResponse<T = any> {
  _id: string;
  method: string;
  url: string;
  headers?: {
    [name: string]: string;
  };
  cookies?: {
    [name: string]: IPCCookie;
  };
  payload: T;
  status: 'error' | 'resolved';
}
