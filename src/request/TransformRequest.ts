import { IRouteRequest, RouteRequest } from "maestro";
import { IPCAdapterName } from "../adapter/ElectronIPCAdapter";
import { IPCRequest } from "./IPCRequest";

export function TransformRequest(request: IPCRequest, pattern: string): IRouteRequest {

  let newReq = new RouteRequest(IPCAdapterName, request.url, pattern);
  newReq.method = request.method;
  newReq.identification = 'ElectronIPCClient';

  for (let propName in request.body ?? {}) {
    newReq.add(propName, request.body[propName], 'body');
  }

  for (let propName in request.urlParams ?? {}) {
    newReq.add(propName, request.urlParams[propName], 'url');
  }

  for (let propName in request.queryParams ?? {}) {
    newReq.add(propName, request.queryParams[propName], 'query');
  }

  for (let propName in request.cookies ?? {}) {
    newReq.add(propName, request.cookies?.[propName], 'cookie');
  }

  for (let propName in request.headers ?? {}) {
    newReq.add(propName, request.headers?.[propName], 'header');
  }

  newReq.setAsRaw();

  return newReq;

}