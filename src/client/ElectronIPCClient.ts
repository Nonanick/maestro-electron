import { IPCAdapterNewRequestEvent, IPCAdapterNewResponseEvent } from "../adapter/ElectronIPCAdapter";
import { IpcRenderer, IpcRendererEvent } from "electron";
import { IPCRequest } from "../request/IPCRequest";
import { IPCResponse } from "../response/IPCResponse";
import { IPCCookie } from "./IPCCookie";
import { nanoid } from "nanoid";

export class ElectronIPCClient {

  private _requestTimeout = 10000;

  private __cookies: {
    [name: string]: IPCCookie;
  } = {};

  private __injectHeaders: {
    [name: string]: string;
  } = {};

  private __pendingRequests: {
    [requestId: string]: OnTransitRequest<any>;
  } = {};

  private __resolvedRequests: {
    [requestId: string]: ResolvedRequest;
  } = {};

  private __preserveResolvedRequests = false;

  private __responseListener = async (event: IpcRendererEvent, ...args: any[]) => {

    let response: IPCResponse = args[0];

    if (response.status === 'error') {
      this.rejectPending(response._id, response.payload);
      return;
    }

    if (response.status === "resolved") {
      this.resolvePending(response._id, response);
      return;
    }

    console.error("Abnormal response status -> ", response.status);

  };

  constructor(private ipc: IpcRenderer) { }

  setCookie(name: string, info: IPCCookie) {
    this.__cookies[name] = info;
  }

  removeCookie(name: string) {
    delete this.__cookies[name];
  }

  cookies() {
    return { ...this.__cookies };
  }

  async get<T = any>(url: string, params: Partial<IPCRequest> = {}) {

    let newRequest: IPCRequest = {
      ...params,
      _id: nanoid(),
      created_at: new Date(Date.now()),
      method: 'get',
      url,
      cookies: { ...this.__cookies },
      headers: { ...this.__injectHeaders }
    };

    return this.request<T>(newRequest);

  }

  rejectPending(_id: string, reason: string | Error) {

    let req = this.__pendingRequests[_id];
    delete this.__pendingRequests[_id];

    if (this.__preserveResolvedRequests) {

      this.__resolvedRequests[_id] = {
        ...req,
        status: 'error',
        resolution_time: new Date(Date.now() - req.created_at.getTime()),
        response: {
          _id: req._id,
          method: req.method,
          payload: reason,
          status: 'error',
          url: req.url,
        }
      };

    }

    req.reject(reason);
  }

  resolvePending<T = any>(_id: string, response: IPCResponse<T>) {
    let req = this.__pendingRequests[_id];
    delete this.__pendingRequests[_id];

    if (this.__preserveResolvedRequests) {
      this.__resolvedRequests[_id] = {
        ...req,
        status: 'resolved',
        resolution_time: new Date(Date.now() - req.created_at.getTime()),
        response
      };
    }

    req.resolve(response.payload);
  }


  async put<T = any>(url: string, body?: any, queryParams?: any) {

    let newRequest: IPCRequest = {
      _id: nanoid(),
      created_at: new Date(Date.now()),
      method: 'put',
      url,
      queryParams: queryParams ?? {},
      body,
      cookies: { ...this.__cookies },
      headers: { ...this.__injectHeaders }
    };

    return this.request<T>(newRequest);

  }

  async post<T = any>(url: string, body?: any, queryParams?: any) {
    let newRequest: IPCRequest = {
      _id: nanoid(),
      created_at: new Date(Date.now()),
      method: 'post',
      url,
      queryParams: queryParams ?? {},
      body,
      cookies: { ...this.__cookies },
      headers: { ...this.__injectHeaders }
    };

    return this.request<T>(newRequest);
  }

  async delete<T = any>(url: string, queryParams?: any) {
    let newRequest: IPCRequest = {
      _id: nanoid(),
      created_at: new Date(Date.now()),
      method: 'delete',
      url,
      queryParams: queryParams ?? {},
      cookies: { ...this.__cookies },
      headers: { ...this.__injectHeaders }
    };

    return this.request<T>(newRequest);
  }

  async patch<T = any>(url: string, body?: any, queryParams?: any) {
    let newRequest: IPCRequest = {
      _id: nanoid(),
      created_at: new Date(Date.now()),
      method: 'patch',
      url,
      queryParams: queryParams ?? {},
      body,
      cookies: { ...this.__cookies },
      headers: { ...this.__injectHeaders }
    };

    return this.request<T>(newRequest);
  }

  private request<T = any>(info: IPCRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {

      // Add a timeout rejection
      if (this._requestTimeout > 0) {

        let promiseResolution = resolve;
        let promiseRejection = reject;

        let timeoutId = setTimeout(
          () => {
            const reason = 'Request timeout, maximum of ' + this._requestTimeout + 'mili was reached!';
            this.rejectPending(info._id, reason);
          },
          this._requestTimeout
        );

        resolve = (v) => {
          clearTimeout(timeoutId);
          promiseResolution(v);
        };

        reject = (r) => {
          clearTimeout(timeoutId);
          promiseRejection;
        };
      }

      this.__pendingRequests[info._id] = {
        ...info,
        resolve,
        reject
      };

      this.ipc.send(IPCAdapterNewRequestEvent, info);
    });
  }

  preserveResolvedRequests(preserve = true) {
    this.__preserveResolvedRequests = preserve;

    if (preserve === false) {
      this.flushResolvedRequests();
    }
  }

  resolvedRequests() {
    return { ...this.__resolvedRequests };
  }

  flushResolvedRequests() {
    this.__resolvedRequests = {};
  }

  start() {
    this.ipc.on(IPCAdapterNewResponseEvent, this.__responseListener);
  }
}

type OnTransitRequest<T> = IPCRequest & {
  resolve: (response: T) => void;
  reject: (reason: Error | string) => void;
};

type ResolvedRequest = IPCRequest & {
  status: 'resolved' | 'error';
  resolution_time: Date;
  response: IPCResponse;

};
