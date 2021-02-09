import { HTTPMethod, IAdapter, IContainer, IProxiedRoute, RequestHandlerFunction, SendErrorFunction, SendResponseFunction } from 'maestro';
import { EventEmitter } from 'events';
import { IpcMain, IpcMainEvent } from 'electron';
import { IPCResponse } from '../response/IPCResponse';
import { IPCRequest } from '../request/IPCRequest';
import { TransformRequest } from '../request/TransformRequest';
import { match } from 'path-to-regexp';

export class ElectronIPCAdapter extends EventEmitter implements IAdapter {

  protected _containers: IContainer[] = [];

  protected _handler?: RequestHandlerFunction;

  protected _ipcListener = async (event: IpcMainEvent, ...args: any[]) => {

    let req: IPCRequest = args[0];
    let route = this.findMatchingRoute(req.method, req.url);

    if (route == null) {

      let routeNotFound: IPCResponse = {
        _id: req._id,
        method: req.method,
        url: req.url,
        status: 'error',
        payload: 'required route was not found on the server!'
      };

      event.reply(IPCAdapterNewResponseEvent, routeNotFound);

      return;

    } else {
      req.urlParams = { ...route.urlParams };
    }

    console.log('[IPCAdapter]: -> new request received\n', req);

    let request = TransformRequest(req, route.url);

    let sendResponse: SendResponseFunction = (response) => {

      let resp: IPCResponse = {
        _id: req._id,
        method: req.method,
        url: req.url,
        status: 'resolved',
        payload: response.payload,
      };

      event.reply(IPCAdapterNewResponseEvent, resp);
    };

    let sendError: SendErrorFunction = (error) => {
      let resp: IPCResponse = {
        _id: req._id,
        method: req.method,
        url: req.url,
        status: 'error',
        payload: error,
      };

      event.reply(IPCAdapterNewResponseEvent, resp);
    };

    if (this._handler == null) {
      return;
    }

    return this._handler(route, request, sendResponse, sendError);


  };

  get name(): string {
    return IPCAdapterName;
  }

  constructor(private ipc: IpcMain) {
    super();
  }

  findMatchingRoute(method: HTTPMethod, url: string): IProxiedRoute & { urlParams: any; } | void {

    let allRoutes = this._containers.map(c => c.allRoutes()).flat();

    for (let route of allRoutes) {
      if (route.methods == null) {
        route.methods = 'get';
      }
      // Check if method matches
      if (typeof route.methods === 'string') {
        if (route.methods !== method) {
          continue;
        }
      } else {
        if (!route.methods.includes(method)) {
          continue;
        }
      }

      let matchingFn = match(route.url);
      let doesItMatch = matchingFn(url);

      if (doesItMatch) {
        console.log("Matches!", doesItMatch);
        return {
          ...route,
          urlParams: doesItMatch.params
        };
      }
    }

    console.info(`[IPCAdapter]: Route [${method}]${url} NOT FOUND`);

    return;
  }

  addContainer(container: IContainer): void {
    if (!this._containers.includes(container)) {
      this._containers.push(container);
    } else {
      console.warn('[IPCAdapter]: Container included twice in adapter!');
    }
  }

  setRequestHandler(handler: RequestHandlerFunction): void {
    this._handler = handler;
  }

  start(): void {
    console.log('[IPCAdapter]: IPC Adapter started!');
    this.ipc.on(IPCAdapterNewRequestEvent, this._ipcListener);
  }

  stop() {
    this.ipc.off(IPCAdapterNewRequestEvent, this._ipcListener);
  }

}

export const IPCAdapterName = 'ElectronIPCChannel';

export const IPCAdapterNewRequestEvent = `[${IPCAdapterName}]:NewRequest`;
export const IPCAdapterNewResponseEvent = `[${IPCAdapterName}]:NewResponse`;
