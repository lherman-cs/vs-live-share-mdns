export const extNamespace = "extension.liveShareMdns";

import { userInfo } from "os";
export const userName = userInfo().username;
export const serviceName = "liveShare";

export const publishTimeout = 15; // in seconds
export const discoveryTimeout = 5; // in seconds