import {
  HTTPMethod,
  IAdapter,
  IContainer,
  IProxiedRoute,
  RequestHandlerFunction,
  SendErrorFunction,
  SendResponseFunction,
} from "maestro";
import { EventEmitter } from "events";
import { IPCResponse } from "../response/IPCResponse";
import { IPCRequest } from "../request/IPCRequest";
import { TransformRequest } from "../request/TransformRequest";
import { match } from "path-to-regexp";
import { MessagePort } from "worker_threads";

export class WorkerAdapter extends EventEmitter implements IAdapter {
  protected _containers: IContainer[] = [];

  protected _handler?: RequestHandlerFunction;

  protected _messagePortListener = async (req: IPCRequest) => {
    console.log("Message received", req);

    let route = this.findMatchingRoute(req.method, req.url);

    if (route == null) {
      let routeNotFound: IPCResponse = {
        _id: req._id,
        method: req.method,
        url: req.url,
        status: "error",
        payload: "required route was not found on the server!",
      };

      this.port.postMessage(routeNotFound);

      return;
    } else {
      req.urlParams = { ...route.urlParams };
    }

    console.log("New Request received", req);

    let request = TransformRequest(req, route.url);

    let sendResponse: SendResponseFunction = (response) => {

      let resp: IPCResponse = {
        _id: req._id,
        method: req.method,
        url: req.url,
        status: "resolved",
        payload: response.payload,
      };

      this.port.postMessage(resp);
    };

    let sendError: SendErrorFunction = (error) => {
      let resp: IPCResponse = {
        _id: req._id,
        method: req.method,
        url: req.url,
        status: "error",
        payload: error,
      };

      this.port.postMessage(resp);
    };

    if (this._handler == null) {
      return;
    }

    return this._handler(route, request, sendResponse, sendError);
  };

  get name(): string {
    return WorkerAdapterName;
  }

  constructor(private port: MessagePort) {
    super();
  }

  findMatchingRoute(
    method: HTTPMethod,
    url: string,
  ): IProxiedRoute & { urlParams: any } | void {
    let allRoutes = this._containers.map((c) => c.allRoutes()).flat();

    for (let route of allRoutes) {
      if (route.methods == null) {
        route.methods = "get";
      }
      // Check if method matches
      if (typeof route.methods === "string") {
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
          urlParams: doesItMatch.params,
        };
      }
    }

    console.info(`Route [${method}]${url} NOT FOUND`);

    return;
  }

  addContainer(container: IContainer): void {
    if (!this._containers.includes(container)) {
      this._containers.push(container);
    } else {
      console.warn("Container included twice in adapter!");
    }
  }

  setRequestHandler(handler: RequestHandlerFunction): void {
    this._handler = handler;
  }

  start(): void {
    this.port.on("message", this._messagePortListener);
  }

  stop() {
    this.port.off("message", this._messagePortListener);
  }
}

export const WorkerAdapterName = "WorkerAdapterIPC";
